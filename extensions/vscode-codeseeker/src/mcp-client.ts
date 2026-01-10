/**
 * MCP Client
 *
 * Communicates with CodeSeeker MCP server to sync file changes.
 * Uses stdio transport to invoke the MCP server process.
 */

import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import { FileChange } from './file-watcher';

export interface McpClientConfig {
  command: string;
  projectPath: string;
}

export interface SyncResult {
  success: boolean;
  mode: 'incremental' | 'full_reindex';
  filesIndexed?: number;
  chunksAdded?: number;
  chunksRemoved?: number;
  durationMs?: number;
  error?: string;
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export class McpClient implements vscode.Disposable {
  private process: ChildProcess | undefined;
  private requestId = 0;
  private pendingRequests: Map<number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }> = new Map();
  private buffer = '';
  private connected = false;
  private outputChannel: vscode.OutputChannel;

  constructor(private config: McpClientConfig) {
    this.outputChannel = vscode.window.createOutputChannel('CodeSeeker MCP');
  }

  /**
   * Connect to MCP server
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(this.config.command, ['serve', '--mcp'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true
        });

        this.process.stdout?.on('data', (data: Buffer) => {
          this.handleData(data.toString());
        });

        this.process.stderr?.on('data', (data: Buffer) => {
          this.outputChannel.appendLine(`[stderr] ${data.toString()}`);
        });

        this.process.on('error', (error) => {
          this.outputChannel.appendLine(`[error] ${error.message}`);
          this.connected = false;
          reject(error);
        });

        this.process.on('close', (code) => {
          this.outputChannel.appendLine(`[closed] exit code: ${code}`);
          this.connected = false;
        });

        // Initialize MCP connection
        this.sendRequest('initialize', {
          protocolVersion: '2024-11-05',
          clientInfo: {
            name: 'vscode-codeseeker',
            version: '0.1.0'
          },
          capabilities: {}
        }).then(() => {
          this.connected = true;
          this.outputChannel.appendLine('[connected] MCP server initialized');
          resolve();
        }).catch(reject);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from MCP server
   */
  disconnect(): void {
    if (this.process) {
      this.process.kill();
      this.process = undefined;
    }
    this.connected = false;
    this.pendingRequests.clear();
    this.buffer = '';
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Sync file changes to CodeSeeker
   */
  async syncChanges(changes: FileChange[]): Promise<SyncResult> {
    if (!this.connected) {
      await this.connect();
    }

    try {
      const result = await this.callTool('notify_file_changes', {
        project: this.config.projectPath,
        changes: changes.map(c => ({ type: c.type, path: c.path }))
      });

      return this.parseToolResult(result);
    } catch (error) {
      return {
        success: false,
        mode: 'incremental',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Trigger a full reindex
   */
  async fullReindex(): Promise<SyncResult> {
    if (!this.connected) {
      await this.connect();
    }

    try {
      const result = await this.callTool('notify_file_changes', {
        project: this.config.projectPath,
        full_reindex: true
      });

      return this.parseToolResult(result);
    } catch (error) {
      return {
        success: false,
        mode: 'full_reindex',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * List indexed projects
   */
  async listProjects(): Promise<unknown> {
    if (!this.connected) {
      await this.connect();
    }

    return this.callTool('list_projects', {});
  }

  /**
   * Call an MCP tool
   */
  private async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    return this.sendRequest('tools/call', {
      name,
      arguments: args
    });
  }

  /**
   * Send a JSON-RPC request
   */
  private sendRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error('MCP process not running'));
        return;
      }

      const id = ++this.requestId;
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      this.pendingRequests.set(id, { resolve, reject });

      const message = JSON.stringify(request);
      this.outputChannel.appendLine(`[request] ${message}`);

      // Send with content-length header (JSON-RPC over stdio)
      this.process.stdin.write(`Content-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Handle incoming data from MCP server
   */
  private handleData(data: string): void {
    this.buffer += data;

    // Parse JSON-RPC messages (delimited by Content-Length header)
    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;

      const header = this.buffer.substring(0, headerEnd);
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        // Skip malformed header
        this.buffer = this.buffer.substring(headerEnd + 4);
        continue;
      }

      const contentLength = parseInt(match[1], 10);
      const messageStart = headerEnd + 4;
      const messageEnd = messageStart + contentLength;

      if (this.buffer.length < messageEnd) {
        // Wait for more data
        break;
      }

      const message = this.buffer.substring(messageStart, messageEnd);
      this.buffer = this.buffer.substring(messageEnd);

      try {
        const response: JsonRpcResponse = JSON.parse(message);
        this.outputChannel.appendLine(`[response] ${message}`);
        this.handleResponse(response);
      } catch (error) {
        this.outputChannel.appendLine(`[parse error] ${error}`);
      }
    }
  }

  /**
   * Handle a JSON-RPC response
   */
  private handleResponse(response: JsonRpcResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) return;

    this.pendingRequests.delete(response.id);

    if (response.error) {
      pending.reject(new Error(response.error.message));
    } else {
      pending.resolve(response.result);
    }
  }

  /**
   * Parse tool result into SyncResult
   */
  private parseToolResult(result: unknown): SyncResult {
    const content = (result as { content?: Array<{ text?: string }> })?.content?.[0]?.text;

    if (!content) {
      return {
        success: false,
        mode: 'incremental',
        error: 'No response from server'
      };
    }

    try {
      const parsed = JSON.parse(content);
      return {
        success: true,
        mode: parsed.mode || 'incremental',
        filesIndexed: parsed.files_indexed,
        chunksAdded: parsed.chunks_added,
        chunksRemoved: parsed.chunks_removed,
        durationMs: parsed.duration_ms
      };
    } catch {
      // Fallback for text response
      return {
        success: true,
        mode: content.includes('full_reindex') ? 'full_reindex' : 'incremental'
      };
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<McpClientConfig>): void {
    const needsReconnect = config.command && config.command !== this.config.command;
    this.config = { ...this.config, ...config };

    if (needsReconnect && this.connected) {
      this.disconnect();
    }
  }

  /**
   * Show output channel
   */
  showOutput(): void {
    this.outputChannel.show();
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.disconnect();
    this.outputChannel.dispose();
  }
}