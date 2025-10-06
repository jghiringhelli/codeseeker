"use strict";
/**
 * InterruptManager - Handles escape/interrupt functionality for long-running operations
 * Provides graceful cancellation while preserving work done up to the interruption point
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InterruptionError = exports.InterruptManager = void 0;
const events_1 = require("events");
const theme_1 = require("../ui/theme");
class InterruptManager extends events_1.EventEmitter {
    static instance;
    activeOperations = new Map();
    keyPressListener = null;
    constructor() {
        super();
        this.setupKeyboardListener();
    }
    static getInstance() {
        if (!InterruptManager.instance) {
            InterruptManager.instance = new InterruptManager();
        }
        return InterruptManager.instance;
    }
    /**
     * Setup keyboard listener for escape key detection
     */
    setupKeyboardListener() {
        // Enable keypress events
        if (process.stdin.setRawMode) {
            this.keyPressListener = (str, key) => {
                if (key && key.name === 'escape') {
                    this.handleEscapeKey();
                }
                else if (key && key.ctrl && key.name === 'c') {
                    this.handleCtrlC();
                }
            };
        }
    }
    /**
     * Enable interrupt listening for keyboard events
     */
    enableInterruptListening() {
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
    disableInterruptListening() {
        if (this.keyPressListener && process.stdin.setRawMode) {
            process.stdin.setRawMode(false);
            process.stdin.removeListener('keypress', this.keyPressListener);
            process.stdin.pause();
        }
    }
    /**
     * Start tracking an interruptible operation
     */
    startOperation(id, description) {
        const operation = {
            id,
            description,
            startTime: new Date(),
            status: 'running'
        };
        this.activeOperations.set(id, operation);
        // Show interrupt hint to user
        console.log(theme_1.Theme.colors.muted(`\n💡 Press ${theme_1.Theme.colors.interrupt('ESC')} to interrupt this operation safely at any time`));
        this.enableInterruptListening();
        return operation;
    }
    /**
     * Update operation with partial results
     */
    updateOperation(id, partialResults) {
        const operation = this.activeOperations.get(id);
        if (operation) {
            operation.partialResults = partialResults;
        }
    }
    /**
     * Complete an operation successfully
     */
    completeOperation(id, finalResults) {
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
    isInterrupted(operationId) {
        const operation = this.activeOperations.get(operationId);
        return operation?.status === 'interrupted' || false;
    }
    /**
     * Handle escape key press
     */
    handleEscapeKey() {
        if (this.activeOperations.size === 0) {
            return;
        }
        console.log(theme_1.Theme.colors.interrupt('\n\n⏸️  OPERATION INTERRUPTED'));
        console.log(theme_1.Theme.colors.warning('🔄 Gracefully stopping current operation...'));
        // Mark all active operations as interrupted
        for (const [id, operation] of this.activeOperations) {
            operation.status = 'interrupted';
            console.log(theme_1.Theme.colors.muted(`   • Interrupted: ${operation.description}`));
            // Emit interrupt event for the operation
            this.emit('interrupt', id, operation);
        }
        console.log(theme_1.Theme.colors.info('💾 Partial results have been preserved'));
        console.log(theme_1.Theme.colors.muted('   You can review what was completed before the interruption\n'));
    }
    /**
     * Handle Ctrl+C press (emergency exit)
     */
    handleCtrlC() {
        console.log(theme_1.Theme.colors.interrupt('\n\n🛑 EMERGENCY EXIT (Ctrl+C)'));
        console.log(theme_1.Theme.colors.warning('⚠️  Forcing immediate termination...'));
        process.exit(1);
    }
    /**
     * Create an interruptible wrapper for async operations
     */
    async wrapInterruptible(operationId, description, operation) {
        const op = this.startOperation(operationId, description);
        try {
            // Create update callback that also checks for interruption
            const updateCallback = (partialResults) => {
                this.updateOperation(operationId, partialResults);
                // Throw interruption error if operation was interrupted
                if (this.isInterrupted(operationId)) {
                    throw new InterruptionError(`Operation "${description}" was interrupted by user`);
                }
            };
            const result = await operation(updateCallback);
            this.completeOperation(operationId, result);
            return result;
        }
        catch (error) {
            if (error instanceof InterruptionError) {
                // Handle graceful interruption
                console.log(theme_1.Theme.colors.warning(`\n⏸️  Operation interrupted: ${description}`));
                if (op.partialResults) {
                    console.log(theme_1.Theme.colors.info('💾 Returning partial results...'));
                    return null; // Could return partial results if needed
                }
                return null;
            }
            else {
                // Handle other errors
                this.completeOperation(operationId);
                throw error;
            }
        }
    }
    /**
     * Get status of all operations (for debugging/logging)
     */
    getActiveOperations() {
        return Array.from(this.activeOperations.values());
    }
    /**
     * Force cleanup all operations (for shutdown)
     */
    cleanup() {
        this.disableInterruptListening();
        this.activeOperations.clear();
        this.removeAllListeners();
    }
}
exports.InterruptManager = InterruptManager;
/**
 * Custom error for interruptions
 */
class InterruptionError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InterruptionError';
    }
}
exports.InterruptionError = InterruptionError;
exports.default = InterruptManager;
//# sourceMappingURL=interrupt-manager.js.map