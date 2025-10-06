/**
 * InterruptManager - Handles escape/interrupt functionality for long-running operations
 * Provides graceful cancellation while preserving work done up to the interruption point
 */
import { EventEmitter } from 'events';
export interface InterruptibleOperation {
    id: string;
    description: string;
    startTime: Date;
    status: 'running' | 'interrupted' | 'completed';
    partialResults?: any;
}
export declare class InterruptManager extends EventEmitter {
    private static instance;
    private activeOperations;
    private keyPressListener;
    private constructor();
    static getInstance(): InterruptManager;
    /**
     * Setup keyboard listener for escape key detection
     */
    private setupKeyboardListener;
    /**
     * Enable interrupt listening for keyboard events
     */
    enableInterruptListening(): void;
    /**
     * Disable interrupt listening
     */
    disableInterruptListening(): void;
    /**
     * Start tracking an interruptible operation
     */
    startOperation(id: string, description: string): InterruptibleOperation;
    /**
     * Update operation with partial results
     */
    updateOperation(id: string, partialResults: any): void;
    /**
     * Complete an operation successfully
     */
    completeOperation(id: string, finalResults?: any): void;
    /**
     * Check if an operation should be interrupted
     */
    isInterrupted(operationId: string): boolean;
    /**
     * Handle escape key press
     */
    private handleEscapeKey;
    /**
     * Handle Ctrl+C press (emergency exit)
     */
    private handleCtrlC;
    /**
     * Create an interruptible wrapper for async operations
     */
    wrapInterruptible<T>(operationId: string, description: string, operation: (updateCallback?: (partialResults: any) => void) => Promise<T>): Promise<T | null>;
    /**
     * Get status of all operations (for debugging/logging)
     */
    getActiveOperations(): InterruptibleOperation[];
    /**
     * Force cleanup all operations (for shutdown)
     */
    cleanup(): void;
}
/**
 * Custom error for interruptions
 */
export declare class InterruptionError extends Error {
    constructor(message: string);
}
export default InterruptManager;
//# sourceMappingURL=interrupt-manager.d.ts.map