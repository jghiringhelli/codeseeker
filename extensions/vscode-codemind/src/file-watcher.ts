/**
 * File Watcher Service
 *
 * Watches for file changes in the workspace and batches them
 * for efficient synchronization with CodeMind MCP server.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { minimatch } from 'minimatch';

export interface FileChange {
  type: 'created' | 'modified' | 'deleted';
  path: string;
}

export interface FileWatcherConfig {
  excludePatterns: string[];
  debounceMs: number;
}

export class FileWatcher implements vscode.Disposable {
  private watcher: vscode.FileSystemWatcher | undefined;
  private pendingChanges: Map<string, FileChange> = new Map();
  private debounceTimer: NodeJS.Timeout | undefined;
  private disposables: vscode.Disposable[] = [];
  private enabled = true;

  constructor(
    private config: FileWatcherConfig,
    private onChanges: (changes: FileChange[]) => void
  ) {}

  /**
   * Start watching for file changes
   */
  start(): void {
    // Watch all files in workspace
    this.watcher = vscode.workspace.createFileSystemWatcher('**/*');

    // Register event handlers
    this.disposables.push(
      this.watcher.onDidCreate(uri => this.handleChange(uri, 'created')),
      this.watcher.onDidChange(uri => this.handleChange(uri, 'modified')),
      this.watcher.onDidDelete(uri => this.handleChange(uri, 'deleted'))
    );

    this.disposables.push(this.watcher);
  }

  /**
   * Stop watching for file changes
   */
  stop(): void {
    this.clearDebounce();
    this.pendingChanges.clear();
  }

  /**
   * Enable or disable the watcher
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clearDebounce();
      this.pendingChanges.clear();
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<FileWatcherConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Flush pending changes immediately
   */
  flush(): FileChange[] {
    this.clearDebounce();
    const changes = Array.from(this.pendingChanges.values());
    this.pendingChanges.clear();

    if (changes.length > 0) {
      this.onChanges(changes);
    }

    return changes;
  }

  /**
   * Get count of pending changes
   */
  getPendingCount(): number {
    return this.pendingChanges.size;
  }

  /**
   * Handle a file change event
   */
  private handleChange(uri: vscode.Uri, type: FileChange['type']): void {
    if (!this.enabled) return;

    const filePath = uri.fsPath;

    // Check if file should be excluded
    if (this.shouldExclude(filePath)) {
      return;
    }

    // Get relative path from workspace root
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    const relativePath = workspaceFolder
      ? path.relative(workspaceFolder.uri.fsPath, filePath)
      : filePath;

    // Merge changes (last change type wins, except delete after create = no-op)
    const existing = this.pendingChanges.get(filePath);

    if (existing) {
      if (existing.type === 'created' && type === 'deleted') {
        // File was created then deleted - no net change
        this.pendingChanges.delete(filePath);
      } else if (existing.type === 'deleted' && type === 'created') {
        // File was deleted then recreated - treat as modified
        this.pendingChanges.set(filePath, { type: 'modified', path: relativePath });
      } else {
        // Update to latest change type
        this.pendingChanges.set(filePath, { type, path: relativePath });
      }
    } else {
      this.pendingChanges.set(filePath, { type, path: relativePath });
    }

    // Reset debounce timer
    this.scheduleFlush();
  }

  /**
   * Check if a file should be excluded from watching
   */
  private shouldExclude(filePath: string): boolean {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const relativePath = workspaceFolder
      ? path.relative(workspaceFolder.uri.fsPath, filePath)
      : filePath;

    // Normalize path separators for matching
    const normalizedPath = relativePath.replace(/\\/g, '/');

    for (const pattern of this.config.excludePatterns) {
      if (minimatch(normalizedPath, pattern, { dot: true })) {
        return true;
      }
    }

    return false;
  }

  /**
   * Schedule a debounced flush
   */
  private scheduleFlush(): void {
    this.clearDebounce();

    this.debounceTimer = setTimeout(() => {
      this.flush();
    }, this.config.debounceMs);
  }

  /**
   * Clear the debounce timer
   */
  private clearDebounce(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.stop();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }
}