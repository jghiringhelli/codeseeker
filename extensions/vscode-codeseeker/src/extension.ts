/**
 * CodeSeeker VSCode Extension
 *
 * Keeps the CodeSeeker semantic index in sync with file changes.
 * Automatically notifies the CodeSeeker MCP server when files are
 * created, modified, or deleted.
 */

import * as vscode from 'vscode';
import { FileWatcher, FileChange } from './file-watcher';
import { McpClient, SyncResult } from './mcp-client';
import { StatusBarManager } from './status-bar';

let fileWatcher: FileWatcher | undefined;
let mcpClient: McpClient | undefined;
let statusBar: StatusBarManager | undefined;

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('CodeSeeker extension activating...');

  // Initialize components
  statusBar = new StatusBarManager();
  context.subscriptions.push(statusBar);

  // Get configuration
  const config = getConfiguration();

  // Initialize MCP client
  mcpClient = new McpClient({
    command: config.mcpCommand,
    projectPath: config.projectPath || getWorkspacePath()
  });
  context.subscriptions.push(mcpClient);

  // Initialize file watcher
  fileWatcher = new FileWatcher(
    {
      excludePatterns: config.excludePatterns,
      debounceMs: config.syncDebounceMs
    },
    (changes) => handleFileChanges(changes)
  );
  context.subscriptions.push(fileWatcher);

  // Set initial state
  if (config.autoSync) {
    fileWatcher.start();
    statusBar.setStatus('idle');
  } else {
    statusBar.setStatus('disabled');
  }

  statusBar.setVisible(config.showStatusBar);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('codeseeker.syncNow', cmdSyncNow),
    vscode.commands.registerCommand('codeseeker.fullReindex', cmdFullReindex),
    vscode.commands.registerCommand('codeseeker.showStatus', cmdShowStatus),
    vscode.commands.registerCommand('codeseeker.toggleAutoSync', cmdToggleAutoSync)
  );

  // Watch for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('codeseeker')) {
        handleConfigChange();
      }
    })
  );

  console.log('CodeSeeker extension activated');
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
  console.log('CodeSeeker extension deactivating...');
}

/**
 * Get extension configuration
 */
function getConfiguration(): {
  autoSync: boolean;
  syncDebounceMs: number;
  projectPath: string;
  excludePatterns: string[];
  mcpCommand: string;
  showStatusBar: boolean;
} {
  const config = vscode.workspace.getConfiguration('codeseeker');

  return {
    autoSync: config.get('autoSync', true),
    syncDebounceMs: config.get('syncDebounceMs', 2000),
    projectPath: config.get('projectPath', ''),
    excludePatterns: config.get('excludePatterns', [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/out/**',
      '**/*.log'
    ]),
    mcpCommand: config.get('mcpCommand', 'codeseeker'),
    showStatusBar: config.get('showStatusBar', true)
  };
}

/**
 * Get workspace root path
 */
function getWorkspacePath(): string {
  const folders = vscode.workspace.workspaceFolders;
  return folders?.[0]?.uri.fsPath || '';
}

/**
 * Handle file changes from watcher
 */
async function handleFileChanges(changes: FileChange[]): Promise<void> {
  if (!mcpClient || !statusBar || changes.length === 0) return;

  statusBar.setStatus('syncing', `Syncing ${changes.length} file(s)...`);

  try {
    const result = await mcpClient.syncChanges(changes);
    handleSyncResult(result, changes.length);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    statusBar.setStatus('error', `Sync failed: ${message}`);
    vscode.window.showErrorMessage(`CodeSeeker sync failed: ${message}`);
  }
}

/**
 * Handle sync result
 */
function handleSyncResult(result: SyncResult, changeCount?: number): void {
  if (!statusBar) return;

  if (result.success) {
    const message = result.mode === 'full_reindex'
      ? `Full reindex complete (${result.filesIndexed} files)`
      : `Synced ${changeCount || result.chunksAdded || 0} change(s)`;

    statusBar.setStatus('success', message);

    if (result.durationMs && result.durationMs > 5000) {
      vscode.window.showInformationMessage(
        `CodeSeeker: ${message} in ${(result.durationMs / 1000).toFixed(1)}s`
      );
    }
  } else {
    statusBar.setStatus('error', result.error || 'Unknown error');
    vscode.window.showErrorMessage(`CodeSeeker sync failed: ${result.error}`);
  }
}

/**
 * Handle configuration changes
 */
function handleConfigChange(): void {
  const config = getConfiguration();

  // Update file watcher
  if (fileWatcher) {
    fileWatcher.updateConfig({
      excludePatterns: config.excludePatterns,
      debounceMs: config.syncDebounceMs
    });
    fileWatcher.setEnabled(config.autoSync);
  }

  // Update MCP client
  if (mcpClient) {
    mcpClient.updateConfig({
      command: config.mcpCommand,
      projectPath: config.projectPath || getWorkspacePath()
    });
  }

  // Update status bar
  if (statusBar) {
    statusBar.setVisible(config.showStatusBar);

    if (config.autoSync) {
      statusBar.setStatus('idle');
    } else {
      statusBar.setStatus('disabled');
    }
  }
}

/**
 * Command: Sync Now
 */
async function cmdSyncNow(): Promise<void> {
  if (!fileWatcher || !statusBar) return;

  const changes = fileWatcher.flush();

  if (changes.length === 0) {
    vscode.window.showInformationMessage('CodeSeeker: No pending changes to sync');
    return;
  }

  // Changes are handled by the onChanges callback
}

/**
 * Command: Full Reindex
 */
async function cmdFullReindex(): Promise<void> {
  if (!mcpClient || !statusBar) return;

  const confirm = await vscode.window.showWarningMessage(
    'This will rebuild the entire CodeSeeker index for this project. Continue?',
    'Yes, Reindex',
    'Cancel'
  );

  if (confirm !== 'Yes, Reindex') return;

  statusBar.setStatus('syncing', 'Full reindex in progress...');

  try {
    const result = await mcpClient.fullReindex();
    handleSyncResult(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    statusBar.setStatus('error', `Reindex failed: ${message}`);
    vscode.window.showErrorMessage(`CodeSeeker reindex failed: ${message}`);
  }
}

/**
 * Command: Show Status
 */
async function cmdShowStatus(): Promise<void> {
  if (!statusBar || !fileWatcher) return;

  const config = getConfiguration();
  const status = statusBar.getStatus();
  const lastSync = statusBar.getLastSyncTime();
  const pending = fileWatcher.getPendingCount();

  const items: vscode.QuickPickItem[] = [
    {
      label: '$(sync) Sync Now',
      description: pending > 0 ? `${pending} pending changes` : 'No pending changes',
      detail: 'Immediately sync any pending file changes'
    },
    {
      label: '$(database) Full Reindex',
      description: 'Rebuild entire index',
      detail: 'Clear and rebuild the entire CodeSeeker index for this project'
    },
    {
      label: config.autoSync ? '$(circle-slash) Disable Auto-Sync' : '$(check) Enable Auto-Sync',
      description: config.autoSync ? 'Currently enabled' : 'Currently disabled',
      detail: 'Toggle automatic syncing of file changes'
    },
    {
      label: '$(terminal) Show Output',
      description: 'View MCP communication logs',
      detail: 'Open the CodeSeeker MCP output channel'
    }
  ];

  // Add status info header
  const statusInfo = [
    `Status: ${status}`,
    lastSync ? `Last sync: ${lastSync.toLocaleTimeString()}` : 'No syncs yet',
    `Project: ${config.projectPath || getWorkspacePath()}`
  ].join(' | ');

  const selected = await vscode.window.showQuickPick(items, {
    title: `CodeSeeker Index Sync`,
    placeHolder: statusInfo
  });

  if (!selected) return;

  if (selected.label.includes('Sync Now')) {
    await cmdSyncNow();
  } else if (selected.label.includes('Full Reindex')) {
    await cmdFullReindex();
  } else if (selected.label.includes('Auto-Sync')) {
    await cmdToggleAutoSync();
  } else if (selected.label.includes('Show Output')) {
    mcpClient?.showOutput();
  }
}

/**
 * Command: Toggle Auto-Sync
 */
async function cmdToggleAutoSync(): Promise<void> {
  const config = vscode.workspace.getConfiguration('codeseeker');
  const current = config.get('autoSync', true);
  await config.update('autoSync', !current, vscode.ConfigurationTarget.Workspace);

  vscode.window.showInformationMessage(
    `CodeSeeker auto-sync ${!current ? 'enabled' : 'disabled'}`
  );
}