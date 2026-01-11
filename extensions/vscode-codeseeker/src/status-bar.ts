/**
 * Status Bar Manager
 *
 * Shows CodeSeeker sync status in the VSCode status bar.
 */

import * as vscode from 'vscode';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'disabled';

export class StatusBarManager implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private currentStatus: SyncStatus = 'idle';
  private pendingCount = 0;
  private lastSyncTime: Date | undefined;
  private visible = true;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'codeseeker.showStatus';
    this.update();
  }

  /**
   * Set sync status
   */
  setStatus(status: SyncStatus, message?: string): void {
    this.currentStatus = status;

    if (status === 'success') {
      this.lastSyncTime = new Date();
    }

    this.update(message);

    // Auto-reset to idle after success/error
    if (status === 'success' || status === 'error') {
      setTimeout(() => {
        if (this.currentStatus === status) {
          this.setStatus('idle');
        }
      }, 3000);
    }
  }

  /**
   * Set pending changes count
   */
  setPendingCount(count: number): void {
    this.pendingCount = count;
    this.update();
  }

  /**
   * Set visibility
   */
  setVisible(visible: boolean): void {
    this.visible = visible;
    if (visible) {
      this.statusBarItem.show();
    } else {
      this.statusBarItem.hide();
    }
  }

  /**
   * Get current status
   */
  getStatus(): SyncStatus {
    return this.currentStatus;
  }

  /**
   * Get last sync time
   */
  getLastSyncTime(): Date | undefined {
    return this.lastSyncTime;
  }

  /**
   * Update status bar display
   */
  private update(customMessage?: string): void {
    const { icon, text, tooltip, color } = this.getDisplayInfo(customMessage);

    this.statusBarItem.text = `${icon} ${text}`;
    this.statusBarItem.tooltip = tooltip;
    this.statusBarItem.color = color;

    if (this.visible) {
      this.statusBarItem.show();
    }
  }

  /**
   * Get display information for current status
   */
  private getDisplayInfo(customMessage?: string): {
    icon: string;
    text: string;
    tooltip: string;
    color: string | vscode.ThemeColor | undefined;
  } {
    switch (this.currentStatus) {
      case 'syncing':
        return {
          icon: '$(sync~spin)',
          text: 'CodeSeeker',
          tooltip: customMessage || 'Syncing changes to CodeSeeker...',
          color: undefined
        };

      case 'success':
        return {
          icon: '$(check)',
          text: 'CodeSeeker',
          tooltip: customMessage || 'Changes synced successfully',
          color: new vscode.ThemeColor('charts.green')
        };

      case 'error':
        return {
          icon: '$(error)',
          text: 'CodeSeeker',
          tooltip: customMessage || 'Sync failed - click for details',
          color: new vscode.ThemeColor('errorForeground')
        };

      case 'disabled':
        return {
          icon: '$(circle-slash)',
          text: 'CodeSeeker',
          tooltip: 'Auto-sync disabled - click to enable',
          color: new vscode.ThemeColor('disabledForeground')
        };

      case 'idle':
      default:
        const pendingText = this.pendingCount > 0
          ? ` (${this.pendingCount} pending)`
          : '';

        const lastSyncText = this.lastSyncTime
          ? `\nLast sync: ${this.formatTime(this.lastSyncTime)}`
          : '';

        return {
          icon: '$(database)',
          text: `CodeSeeker${pendingText}`,
          tooltip: `CodeSeeker Index Sync${lastSyncText}\n\nClick for options`,
          color: undefined
        };
    }
  }

  /**
   * Format time for display
   */
  private formatTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) {
      return 'just now';
    } else if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleTimeString();
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.statusBarItem.dispose();
  }
}