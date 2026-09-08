/**
 * A minimal MCP client that speaks the real protocol to a real server process.
 *
 * This is deliberately not a wrapper around the SDK client. The contract suite exists to
 * verify what a *foreign* client observes over stdio — if it shared the SDK's framing
 * code with the server, a framing bug would cancel itself out and the suite would pass
 * while real clients broke.
 *
 * Transport: line-delimited JSON-RPC 2.0 on stdout. The server logs to stderr, so stderr
 * is captured separately and never parsed as protocol.
 */

import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';

export interface ToolDescriptor {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface CallResult {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

const PROTOCOL_VERSION = '2024-11-05';

export class McpProbe {
  private proc?: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private stdoutBuffer = '';
  private stderrText = '';
  private nonProtocolLines: string[] = [];

  /** Server log output. Useful when a contract fails and the reason is a startup error. */
  get stderr(): string {
    return this.stderrText;
  }

  /**
   * Every stdout line that was not valid JSON-RPC.
   *
   * The probe skips such lines so one stray write cannot break the whole run, but a
   * skipped line is exactly what a strict client refuses to tolerate. Recording them
   * makes the tolerance visible instead of load-bearing.
   */
  get nonProtocolStdout(): string[] {
    return [...this.nonProtocolLines];
  }

  async start(env: Record<string, string> = {}): Promise<void> {
    const serverPath = path.join(__dirname, '..', '..', 'dist', 'cli', 'codeseeker-cli.js');

    this.proc = spawn(process.execPath, [serverPath, 'serve', '--mcp'], {
      // cwd is deliberately NOT the project under test. An MCP server's working directory
      // belongs to its launcher, and requirement R3 says no action may depend on it.
      cwd: path.join(__dirname),
      env: { ...process.env, CODESEEKER_STORAGE_MODE: 'embedded', ...env },
      shell: false,
    }) as ChildProcessWithoutNullStreams;

    this.proc.stdout.on('data', (buf: Buffer) => this.onStdout(buf.toString()));
    this.proc.stderr.on('data', (buf: Buffer) => { this.stderrText += buf.toString(); });
    this.proc.on('error', (err) => this.failAll(err));
    this.proc.on('exit', (code) => {
      this.failAll(new Error(`server exited with code ${code}\nstderr:\n${this.stderrText}`));
    });

    await this.request('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'codeseeker-contract-probe', version: '1' },
    });
    this.notify('notifications/initialized');
  }

  async listTools(): Promise<ToolDescriptor[]> {
    const res = (await this.request('tools/list', {})) as { tools: ToolDescriptor[] };
    return res.tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<CallResult> {
    return (await this.request('tools/call', { name, arguments: args })) as CallResult;
  }

  /** The text of the first content block, which is how this server returns everything. */
  async callText(name: string, args: Record<string, unknown>): Promise<{ text: string; isError: boolean }> {
    const res = await this.callTool(name, args);
    return { text: res.content?.[0]?.text ?? '', isError: res.isError === true };
  }

  async stop(): Promise<void> {
    if (!this.proc) return;
    const p = this.proc;
    this.proc = undefined;
    this.pending.clear();
    p.removeAllListeners('exit');
    p.kill();
    await new Promise<void>((resolve) => {
      p.once('exit', () => resolve());
      setTimeout(resolve, 2000).unref?.();
    });
  }

  // ── transport ──────────────────────────────────────────────────────────────

  private onStdout(chunk: string): void {
    this.stdoutBuffer += chunk;
    let idx: number;
    while ((idx = this.stdoutBuffer.indexOf('\n')) >= 0) {
      const line = this.stdoutBuffer.slice(0, idx).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(idx + 1);
      if (!line) continue;
      let msg: { id?: number; jsonrpc?: string; result?: unknown; error?: { message?: string } };
      try {
        msg = JSON.parse(line);
      } catch {
        // Not protocol. Recorded rather than merely skipped — see `nonProtocolStdout`.
        this.nonProtocolLines.push(line.slice(0, 200));
        continue;
      }
      if (msg.jsonrpc !== '2.0') {
        this.nonProtocolLines.push(`non-jsonrpc: ${line.slice(0, 180)}`);
        continue;
      }
      if (typeof msg.id !== 'number') continue;
      const waiter = this.pending.get(msg.id);
      if (!waiter) continue;
      this.pending.delete(msg.id);
      if (msg.error) waiter.reject(new Error(msg.error.message ?? 'rpc error'));
      else waiter.resolve(msg.result);
    }
  }

  private request(method: string, params: unknown, timeoutMs = 30000): Promise<unknown> {
    if (!this.proc) return Promise.reject(new Error('probe not started'));
    const id = this.nextId++;
    const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out after ${timeoutMs}ms\nstderr:\n${this.stderrText}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      this.proc!.stdin.write(payload);
    });
  }

  private notify(method: string, params: unknown = {}): void {
    this.proc?.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
  }

  private failAll(err: Error): void {
    for (const [, waiter] of this.pending) waiter.reject(err);
    this.pending.clear();
  }
}
