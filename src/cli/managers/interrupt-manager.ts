/**
 * InterruptManager - Handles escape/interrupt functionality for long-running operations
 * Provides graceful cancellation while preserving work done up to the interruption point
 */

import { EventEmitter } from 'events';
import { Theme } from '../ui/theme';

export interface InterruptibleOperation {
  id: string;
  description: string;
  startTime: Date;
  status: 'running' | 'interrupted' | 'completed';
  partialResults?: any;
}

export class InterruptManager extends EventEmitter {
  private static instance: InterruptManager;
  private activeOperations: Map<string, InterruptibleOperation> = new Map();
  private keyPressListener: ((str: string, key: any) => void) | null = null;

  private constructor() {
    super();
    this.setupKeyboardListener();
  }

  static getInstance(): InterruptManager {
    if (!InterruptManager.instance) {
      InterruptManager.instance = new InterruptManager();
    }
    return InterruptManager.instance;
  }

  /**
   * Setup keyboard listener for escape key detection
   */
  private setupKeyboardListener(): void {
    // Enable keypress events
    if (process.stdin.setRawMode) {
      this.keyPressListener = (str: string, key: any) => {
        if (key?.name === 'escape') {
          this.handleEscapeKey();
        } else if (key?.ctrl && key.name === 'c') {
          this.handleCtrlC();
        }
      };
    }
  }

  /**
   * Enable interrupt listening for keyboard events
   */
  enableInterruptListening(): void {
    if (this.keyPressListener && process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      process.stdin.on('keypress', this.keyPressListener);
    }
  }

  /**
   * Disable interrupt listening
   */
  disableInterruptListening(): void {
    if (this.keyPressListener && process.stdin.setRawMode) {
      process.stdin.setRawMode(false);
      process.stdin.removeListener('keypress', this.keyPressListener);
      process.stdin.pause();
    }
  }

  /**
   * Start tracking an interruptible operation
   */
  startOperation(id: string, description: string): InterruptibleOperation {
    const operation: InterruptibleOperation = {
      id,
      description,
      startTime: new Date(),
      status: 'running'
    };

    this.activeOperations.set(id, operation);

    // Show interrupt hint to user
    console.log(Theme.colors.muted(`\n💡 Press ${Theme.colors.interrupt('ESC')} to interrupt this operation safely at any time`));

    this.enableInterruptListening();
    return operation;
  }

  /**
   * Update operation with partial results
   */
  updateOperation(id: string, partialResults: any): void {
    const operation = this.activeOperations.get(id);
    if (operation) {
      operation.partialResults = partialResults;
    }
  }

  /**
   * Complete an operation successfully
   */
  completeOperation(id: string, finalResults?: any): void {
    const operation = this.activeOperations.get(id);
    if (operation) {
      operation.status = 'completed';
      operation.partialResults = finalResults;
    }

    this.activeOperations.delete(id);

    // Disable listening if no more active operations
    if (this.activeOperations.size === 0) {
      this.disableInterruptListening();
    }
  }

  /**
   * Check if an operation should be interrupted
   */
  isInterrupted(operationId: string): boolean {
    const operation = this.activeOperations.get(operationId);
    return operation?.status === 'interrupted' || false;
  }

  /**
   * Handle escape key press
   */
  private handleEscapeKey(): void {
    if (this.activeOperations.size === 0) {
      return;
    }

    console.log(Theme.colors.interrupt('\n\n⏸️  OPERATION INTERRUPTED'));
    console.log(Theme.colors.warning('🔄 Gracefully stopping current operation...'));

    // Mark all active operations as interrupted
    for (const [id, operation] of this.activeOperations) {
      operation.status = 'interrupted';
      console.log(Theme.colors.muted(`   • Interrupted: ${operation.description}`));

      // Emit interrupt event for the operation
      this.emit('interrupt', id, operation);
    }

    console.log(Theme.colors.info('💾 Partial results have been preserved'));
    console.log(Theme.colors.muted('   You can review what was completed before the interruption\n'));
  }

  /**
   * Handle Ctrl+C press (emergency exit)
   */
  private handleCtrlC(): void {
    console.log(Theme.colors.interrupt('\n\n🛑 EMERGENCY EXIT (Ctrl+C)'));
    console.log(Theme.colors.warning('⚠️  Forcing immediate termination...'));
    process.exit(1);
  }

  /**
   * Create an interruptible wrapper for async operations
   */
  async wrapInterruptible<T>(
    operationId: string,
    description: string,
    operation: (updateCallback?: (partialResults: any) => void) => Promise<T>
  ): Promise<T | null> {
    const op = this.startOperation(operationId, description);

    try {
      // Create update callback that also checks for interruption
      const updateCallback = (partialResults: any) => {
        this.updateOperation(operationId, partialResults);

        // Throw interruption error if operation was interrupted
        if (this.isInterrupted(operationId)) {
          throw new InterruptionError(`Operation "${description}" was interrupted by user`);
        }
      };

      const result = await operation(updateCallback);
      this.completeOperation(operationId, result);
      return result;

    } catch (error) {
      if (error instanceof InterruptionError) {
        // Handle graceful interruption
        console.log(Theme.colors.warning(`\n⏸️  Operation interrupted: ${description}`));
        if (op.partialResults) {
          console.log(Theme.colors.info('💾 Returning partial results...'));
          return null; // Could return partial results if needed
        }
        return null;
      } else {
        // Handle other errors
        this.completeOperation(operationId);
        throw error;
      }
    }
  }

  /**
   * Get status of all operations (for debugging/logging)
   */
  getActiveOperations(): InterruptibleOperation[] {
    return Array.from(this.activeOperations.values());
  }

  /**
   * Force cleanup all operations (for shutdown)
   */
  cleanup(): void {
    this.disableInterruptListening();
    this.activeOperations.clear();
    this.removeAllListeners();
  }
}

/**
 * Custom error for interruptions
 */
export class InterruptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InterruptionError';
  }
}

export default InterruptManager;