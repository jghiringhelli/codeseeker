#!/usr/bin/env node
"use strict";
/**
 * CodeMindCLI - SOLID Principles Implementation
 * Single Responsibility: Orchestrate components and manage CLI lifecycle
 * Following SOLID architecture with proper dependency injection
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeMindCLI = void 0;
exports.main = main;
const readline = __importStar(require("readline"));
const dotenv = __importStar(require("dotenv"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const crypto = __importStar(require("crypto"));
const theme_1 = require("./ui/theme");
const welcome_display_1 = require("./ui/welcome-display");
const command_service_factory_1 = require("../core/factories/command-service-factory");
const command_processor_1 = require("./managers/command-processor");
const database_manager_1 = require("./managers/database-manager");
const platform_utils_1 = require("../shared/platform-utils");
// Environment variables will be loaded in start() method based on current working directory
class CodeMindCLI {
    rl;
    commandProcessor;
    context;
    currentProject = null;
    activeOperations = new Set();
    currentAbortController;
    transparentMode = false;
    commandMode = false; // True when running single command with -c flag
    commandModeCompleted = false; // True when command mode has finished
    replMode = false; // True when in interactive REPL mode
    explicitExitRequested = false; // True when user explicitly requests exit
    commandHistory = [];
    historyFile;
    historyDir;
    static MAX_HISTORY_SIZE = 100;
    constructor() {
        // Initialize all components using SOLID dependency injection factory
        const commandServiceFactory = command_service_factory_1.CommandServiceFactory.getInstance();
        this.context = commandServiceFactory.createCommandContext();
        this.commandProcessor = new command_processor_1.CommandProcessor(this.context);
        // Setup project-specific history directory in user's home
        this.historyDir = path.join(os.homedir(), '.codemind', 'history');
        this.ensureHistoryDir();
        // Determine project-specific history file based on current working directory
        const userCwd = process.env.CODEMIND_USER_CWD || process.cwd();
        this.historyFile = this.getProjectHistoryFile(userCwd);
        this.loadHistory();
        // Setup readline interface with history support
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: theme_1.Theme.colors.prompt('codemind> '),
            historySize: CodeMindCLI.MAX_HISTORY_SIZE,
            history: this.commandHistory
        });
        // Setup Escape key handling for interrupting operations
        // We use stdin keypress events to capture Escape without conflicting with readline
        this.setupEscapeKeyHandler();
        // Pass readline interface to command processor for assumption detection
        this.commandProcessor.setReadlineInterface(this.rl);
        // Register history callbacks for /history command
        this.commandProcessor.setHistoryCallbacks({
            getHistory: () => this.getHistory(),
            clearHistory: () => this.clearHistory(),
            getHistoryFile: () => this.getHistoryFile()
        });
        this.setupEventHandlers();
        // Setup cleanup on exit - with immediate exit option
        process.on('exit', () => void this.cleanup());
        // Enhanced SIGINT handling for Ctrl+C
        let sigintCount = 0;
        process.on('SIGINT', () => {
            sigintCount++;
            if (sigintCount === 1) {
                console.log(theme_1.Theme.colors.warning('\n\n⚠ Interrupt received. Press Ctrl+C again to force exit.'));
                void this.cleanup();
                // Give cleanup 3 seconds to complete
                setTimeout(() => {
                    if (sigintCount === 1) {
                        console.log(theme_1.Theme.colors.warning('Cleanup taking too long. Press Ctrl+C to force exit.'));
                    }
                }, 3000);
            }
            else {
                console.log(theme_1.Theme.colors.error('\n❌ Force exit!'));
                process.exit(1);
            }
        });
        process.on('SIGTERM', () => void this.cleanup());
        // Handle uncaught exceptions to prevent CLI from freezing
        process.on('uncaughtException', (error) => {
            console.error(theme_1.Theme.colors.error(`\n❌ Uncaught exception: ${error.message}`));
            console.error(theme_1.Theme.colors.muted('CLI will attempt to continue. Type "/help" if you need assistance.'));
            if (this.rl) {
                this.rl.prompt();
            }
        });
        process.on('unhandledRejection', (reason) => {
            console.error(theme_1.Theme.colors.error(`\n❌ Unhandled promise rejection: ${String(reason)}`));
            console.error(theme_1.Theme.colors.muted('CLI will attempt to continue. Type "/help" if you need assistance.'));
            if (this.rl) {
                this.rl.prompt();
            }
        });
    }
    /**
     * Start silently for command mode (no welcome, no interactive prompt)
     */
    async startSilent() {
        try {
            // Get user's original working directory (set by bin/codemind.js)
            const userCwd = process.env.CODEMIND_USER_CWD || process.cwd();
            // Load environment variables from user's working directory (not CodeMind installation)
            // Suppress dotenv logs during init for cleaner output
            const originalStderr = process.stderr.write.bind(process.stderr);
            try {
                // Temporarily suppress stderr to hide dotenv injection logs
                process.stderr.write = () => true;
                dotenv.config({ path: userCwd + '/.env' });
            }
            finally {
                // Restore stderr
                process.stderr.write = originalStderr;
            }
            // Auto-detect project in background (non-blocking)
            await this.autoDetectProjectSilent();
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(theme_1.Theme.colors.error(`Failed to start CLI: ${errorMessage}`));
            process.exit(1);
        }
    }
    /**
     * Start the CLI - SOLID implementation with immediate prompt
     */
    async start() {
        try {
            // Get user's original working directory (set by bin/codemind.js)
            const userCwd = process.env.CODEMIND_USER_CWD || process.cwd();
            // Load environment variables from user's working directory (not CodeMind installation)
            // Suppress dotenv logs during init for cleaner output
            const originalStderr = process.stderr.write.bind(process.stderr);
            try {
                // Temporarily suppress stderr to hide dotenv injection logs
                process.stderr.write = () => true;
                dotenv.config({ path: userCwd + '/.env' });
            }
            finally {
                // Restore stderr
                process.stderr.write = originalStderr;
            }
            // Display welcome message
            welcome_display_1.WelcomeDisplay.displayWelcome();
            // Show platform information for debugging
            const platformInfo = platform_utils_1.PlatformUtils.getPlatformInfo();
            console.log(theme_1.Theme.colors.muted(`\n💻 Platform: ${platformInfo.platform} (${platformInfo.arch}) Node ${platformInfo.nodeVersion}`));
            console.log(theme_1.Theme.colors.muted(`🐚 Shell: ${platformInfo.shell} | File Command: ${platformInfo.fileCommand}${platformInfo.isGitBash ? ' (Git Bash)' : ''}${platformInfo.isWSL ? ' (WSL)' : ''}`));
            // Check database connections on startup (wait for completion before prompt)
            try {
                await this.checkDatabaseConnections();
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.log(theme_1.Theme.colors.warning(`\n⚠️  Database check failed: ${errorMessage}`));
            }
            // Auto-detect project before showing ready message
            try {
                await this.autoDetectProject();
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.log(theme_1.Theme.colors.warning(`\n⚠ Project detection failed: ${errorMessage}`));
            }
            // Show ready message and prompt AFTER all initialization is complete
            console.log(theme_1.Theme.colors.primary('\n🎯 CodeMind CLI is ready! Type /help for commands or ask questions directly.\n'));
            this.rl.prompt();
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(theme_1.Theme.colors.error(`Failed to start CLI: ${errorMessage}`));
            process.exit(1);
        }
    }
    /**
     * Setup event handlers for readline - SOLID event handling
     */
    setupEventHandlers() {
        // Handle user input with robust error handling
        this.rl.on('line', async (input) => {
            // Pause readline to prevent input during processing
            this.rl.pause();
            try {
                if (input.trim()) {
                    // Add to history before processing
                    this.addToHistory(input.trim());
                    await this.processInput(input.trim());
                }
            }
            catch (error) {
                // Ensure errors don't break the readline interface
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(theme_1.Theme.colors.error(`❌ Unexpected error: ${errorMessage}`));
                console.error(theme_1.Theme.colors.muted('CLI will continue running. Type "/help" for available commands.'));
            }
            // Resume and show prompt AFTER processing completes
            this.rl.resume();
            this.rl.prompt();
        });
        // Handle Ctrl+Z as an interrupt signal (similar to Escape in Claude Code)
        // Note: We use Ctrl+Z instead of Escape to avoid conflicts with readline
        this.rl.on('SIGTSTP', () => {
            // If there are active operations, interrupt them
            if (this.activeOperations.size > 0) {
                console.log(theme_1.Theme.colors.warning('\n\n⏸ Operation interrupted (Ctrl+Z pressed)...'));
                // The interrupt manager tracks operations but doesn't have a public interrupt method
                // We'll rely on the abort controller and clearing operations
                // Abort the current operation if available
                if (this.currentAbortController) {
                    this.currentAbortController.abort();
                }
                // Clear active operations
                this.activeOperations.clear();
                console.log(theme_1.Theme.colors.muted('Operation cancelled. Ready for new input.'));
            }
            else {
                // No operations running
                console.log(theme_1.Theme.colors.muted('\n✓ Ready for new command.'));
            }
            this.rl.prompt();
        });
        // Handle CLI exit - wait for active operations
        this.rl.on('close', async () => {
            // In command mode, ignore premature close events from inquirer
            // The main() function will handle the exit after processInput completes
            if (this.commandMode && !this.commandModeCompleted) {
                // Recreate readline interface for continued use with inquirer
                this.recreateReadlineInterface();
                return;
            }
            // In REPL mode, only exit if explicitly requested
            // This prevents accidental exit from inquirer prompts or EOF signals
            if (this.replMode && !this.explicitExitRequested) {
                // Recreate readline interface and continue
                this.recreateReadlineInterface();
                console.log(theme_1.Theme.colors.muted('\n✓ Ready for new command. Type /exit to quit.'));
                this.rl.prompt();
                return;
            }
            console.log(theme_1.Theme.colors.primary('\n👋 Goodbye! Thank you for using CodeMind.'));
            // Wait for all active operations to complete
            if (this.activeOperations.size > 0) {
                console.log(theme_1.Theme.colors.warning(`⏳ Waiting for ${this.activeOperations.size} active operation(s) to complete...`));
                await Promise.allSettled(Array.from(this.activeOperations));
            }
            process.exit(0);
        });
        // Handle Ctrl+C gracefully with double-press detection
        let lastCtrlCTime = 0;
        this.rl.on('SIGINT', () => {
            const now = Date.now();
            if (now - lastCtrlCTime < 2000) {
                // Double Ctrl+C within 2 seconds - exit immediately
                console.log(theme_1.Theme.colors.primary('\n👋 Goodbye!'));
                process.exit(0);
            }
            lastCtrlCTime = now;
            if (this.activeOperations.size > 0) {
                console.log(theme_1.Theme.colors.warning(`\n⚠ ${this.activeOperations.size} active operation(s) running. Ctrl+C again to force exit.`));
            }
            else {
                console.log(theme_1.Theme.colors.muted('\nCtrl+C again to exit, or type /exit'));
            }
            this.rl.prompt();
        });
    }
    /**
     * Process user input through command processor - Single Responsibility
     */
    async processInput(input) {
        // Update command context with current project (only when it changes)
        this.syncProjectContext();
        // Create operation promise for tracking
        const operation = this.processInputOperation(input);
        this.activeOperations.add(operation);
        try {
            await operation;
        }
        finally {
            this.activeOperations.delete(operation);
        }
    }
    /**
     * Sync project context with command processor (optimized)
     */
    syncProjectContext() {
        const processorContext = this.commandProcessor.context;
        if (processorContext.currentProject !== this.currentProject) {
            processorContext.currentProject = this.currentProject;
        }
    }
    /**
     * Internal operation handler to be tracked
     * Note: No global timeout here - timeouts are handled at the service level
     * (database connections, Claude CLI calls) to avoid timing out during user input
     */
    async processInputOperation(input) {
        try {
            // Create an AbortController for cancellation (reuse if possible)
            if (!this.currentAbortController || this.currentAbortController.signal.aborted) {
                this.currentAbortController = new AbortController();
            }
            // Process input through command processor (SOLID delegation)
            // No global timeout - user prompts (inquirer) should wait indefinitely
            // Individual operations (DB, Claude CLI) have their own timeouts
            const result = await this.commandProcessor.processInput(input);
            // Handle results through UserInterface (SOLID separation)
            if (!result.success && result.message) {
                this.context.userInterface.showError(result.message);
            }
            else if (result.success && result.message) {
                this.context.userInterface.showSuccess(result.message);
            }
            // Handle exit command
            if (result.data?.shouldExit) {
                this.explicitExitRequested = true;
                await this.cleanup();
                process.exit(0);
            }
            // Update current project if it changed
            if (result.data?.projectId) {
                this.currentProject = result.data;
            }
            // Don't show redundant completion message - commands show their own success/failure
            // Add a small delay to ensure all output is flushed before prompt
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        catch (error) {
            // Enhanced error handling with more context
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(theme_1.Theme.colors.error(`❌ Command processing failed: ${errorMessage}`));
            if (error instanceof Error && error.stack && !errorMessage.includes('timed out')) {
                console.error(theme_1.Theme.colors.muted('Stack trace:'));
                console.error(theme_1.Theme.colors.muted(error.stack));
            }
            if (errorMessage.includes('timed out')) {
                console.error(theme_1.Theme.colors.warning('⏰ The operation took too long and was cancelled to prevent CLI hanging.'));
                console.error(theme_1.Theme.colors.muted('Try breaking down complex requests into smaller parts.'));
            }
            console.error(theme_1.Theme.colors.muted('The CLI will continue running. Try again or type "/help" for assistance.'));
        }
        finally {
            // Always show prompt, even if there was an error
            this.rl.prompt();
        }
    }
    /**
     * Auto-detect CodeMind project silently (no output)
     */
    async autoDetectProjectSilent() {
        const userCwd = process.env.CODEMIND_USER_CWD || process.cwd();
        const projectConfig = await this.context.projectManager.detectProject(userCwd);
        if (projectConfig) {
            this.currentProject = projectConfig;
            // Skip instruction loading in silent mode to avoid authentication issues
        }
    }
    /**
     * Auto-detect CodeMind project - Delegated to ProjectManager (SOLID)
     */
    async autoDetectProject() {
        const userCwd = process.env.CODEMIND_USER_CWD || process.cwd();
        const projectConfig = await this.context.projectManager.detectProject(userCwd);
        if (projectConfig) {
            this.currentProject = projectConfig;
            console.log(theme_1.Theme.colors.success(`✓ Project loaded: ${projectConfig.projectName}`));
            // Load CODEMIND.md instructions
            try {
                const instructionsSummary = await this.context.instructionService.getInstructionsSummary(userCwd);
                if (instructionsSummary.length > 1 || instructionsSummary[0] !== 'No CODEMIND.md instructions found') {
                    console.log(theme_1.Theme.colors.info(`📋 Loaded instructions:`));
                    instructionsSummary.forEach(summary => {
                        console.log(theme_1.Theme.colors.muted(`   ${summary}`));
                    });
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.log(theme_1.Theme.colors.warning(`⚠ Failed to load instructions: ${errorMessage}`));
            }
        }
        else {
            console.log(theme_1.Theme.colors.warning('\n⚠ No CodeMind project found in current directory'));
            console.log(theme_1.Theme.colors.muted('Run "/init" to initialize this directory as a CodeMind project'));
        }
        // Note: prompt is shown by caller after all initialization is complete
    }
    /**
     * Set project path programmatically (for command-line options)
     */
    setProjectPath(projectPath) {
        this.context.projectManager.setProjectPath(projectPath);
    }
    /**
     * Set transparent mode (skip interactive prompts, output context directly)
     */
    setTransparentMode(enabled) {
        this.transparentMode = enabled;
        this.commandProcessor.setTransparentMode(enabled);
    }
    /**
     * Set command mode (single command execution with -c flag)
     * This prevents premature exit during inquirer prompts
     */
    setCommandMode(enabled) {
        this.commandMode = enabled;
    }
    /**
     * Set REPL mode (interactive mode)
     * In REPL mode, the CLI only exits on explicit /exit or double Ctrl+C
     */
    setReplMode(enabled) {
        this.replMode = enabled;
    }
    /**
     * Request explicit exit (called by /exit command)
     */
    requestExit() {
        this.explicitExitRequested = true;
    }
    /**
     * Recreate readline interface after it's closed
     * This is used to recover from inquirer prompts or EOF signals
     */
    recreateReadlineInterface() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            prompt: theme_1.Theme.colors.prompt('codemind> '),
            historySize: CodeMindCLI.MAX_HISTORY_SIZE,
            history: this.commandHistory
        });
        // Re-register event handlers
        this.setupEventHandlers();
        // Re-pass readline interface to command processor
        this.commandProcessor.setReadlineInterface(this.rl);
    }
    /**
     * Setup Escape key handler for interrupting operations
     * Uses keypress events to detect Escape without conflicting with readline
     */
    setupEscapeKeyHandler() {
        // Enable keypress events on stdin
        if (process.stdin.isTTY) {
            readline.emitKeypressEvents(process.stdin);
            // Listen for keypress events
            process.stdin.on('keypress', (_str, key) => {
                // Escape key pressed (sequence is '\x1b' or '\u001b')
                if (key && (key.name === 'escape' || key.sequence === '\x1b')) {
                    this.handleEscapeKey();
                }
            });
        }
    }
    /**
     * Handle Escape key press - interrupt current operation
     */
    handleEscapeKey() {
        if (this.activeOperations.size > 0) {
            console.log(theme_1.Theme.colors.warning('\n\n⏸ Escape pressed - interrupting operation...'));
            // Abort the current operation
            if (this.currentAbortController) {
                this.currentAbortController.abort();
            }
            // Clear active operations
            this.activeOperations.clear();
            console.log(theme_1.Theme.colors.muted('Operation cancelled. Ready for new input.'));
            console.log(theme_1.Theme.colors.muted('💡 Tip: Use Ctrl+C twice to force exit, or /exit to quit gracefully.\n'));
            this.rl.prompt();
        }
        // If no active operations, Escape is ignored (normal editing behavior)
    }
    /**
     * Check database connections on startup
     */
    async checkDatabaseConnections() {
        console.log(theme_1.Theme.colors.muted('\n🔍 Checking database connections...'));
        try {
            const databaseManager = new database_manager_1.DatabaseManager();
            // Quick connection test with short timeout
            const connectionPromise = databaseManager.getDatabaseStatus();
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout (3s)')), 3000));
            const status = await Promise.race([connectionPromise, timeoutPromise]);
            // Check each database
            const postgresStatus = status.postgresql?.available ? '✅' : '❌';
            const redisStatus = status.redis?.available ? '✅' : '❌';
            const neo4jStatus = status.neo4j?.available ? '✅' : '❌';
            console.log(theme_1.Theme.colors.muted(`   • PostgreSQL: ${postgresStatus}`));
            console.log(theme_1.Theme.colors.muted(`   • Redis: ${redisStatus}`));
            console.log(theme_1.Theme.colors.muted(`   • Neo4j: ${neo4jStatus}`));
            // Show warnings for failed connections
            const failedDatabases = [];
            if (!status.postgresql?.available)
                failedDatabases.push('PostgreSQL');
            if (!status.redis?.available)
                failedDatabases.push('Redis');
            if (!status.neo4j?.available)
                failedDatabases.push('Neo4j');
            if (failedDatabases.length > 0) {
                console.log(theme_1.Theme.colors.warning(`\n⚠️  Warning: ${failedDatabases.join(', ')} ${failedDatabases.length === 1 ? 'is' : 'are'} not available`));
                console.log(theme_1.Theme.colors.muted('   Some features may be limited. Use /init to set up databases.'));
            }
            else {
                console.log(theme_1.Theme.colors.success('\n✅ All databases connected successfully'));
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log(theme_1.Theme.colors.warning(`\n⚠️  Database connection check failed: ${errorMessage}`));
            console.log(theme_1.Theme.colors.muted('   CodeMind will work with limited functionality. Use /init to set up databases.'));
        }
    }
    /**
     * Load command history from file
     */
    loadHistory() {
        try {
            if (fs.existsSync(this.historyFile)) {
                const content = fs.readFileSync(this.historyFile, 'utf-8');
                this.commandHistory = content
                    .split('\n')
                    .filter(line => line.trim())
                    .slice(-CodeMindCLI.MAX_HISTORY_SIZE);
            }
        }
        catch {
            // Silently ignore history load errors
            this.commandHistory = [];
        }
    }
    /**
     * Save command history to file
     */
    saveHistory() {
        try {
            const historyContent = this.commandHistory
                .slice(-CodeMindCLI.MAX_HISTORY_SIZE)
                .join('\n');
            fs.writeFileSync(this.historyFile, historyContent, 'utf-8');
        }
        catch {
            // Silently ignore history save errors
        }
    }
    /**
     * Add command to history (avoid duplicates of last command)
     */
    addToHistory(command) {
        const trimmed = command.trim();
        if (!trimmed)
            return;
        // Don't add if it's the same as the last command
        if (this.commandHistory.length > 0 &&
            this.commandHistory[this.commandHistory.length - 1] === trimmed) {
            return;
        }
        this.commandHistory.push(trimmed);
        // Trim to max size
        if (this.commandHistory.length > CodeMindCLI.MAX_HISTORY_SIZE) {
            this.commandHistory = this.commandHistory.slice(-CodeMindCLI.MAX_HISTORY_SIZE);
        }
        // Save after each command for persistence
        this.saveHistory();
    }
    /**
     * Clear command history
     */
    clearHistory() {
        this.commandHistory = [];
        this.saveHistory();
    }
    /**
     * Get current history file path
     */
    getHistoryFile() {
        return this.historyFile;
    }
    /**
     * Get command history array
     */
    getHistory() {
        return [...this.commandHistory];
    }
    /**
     * Ensure history directory exists
     */
    ensureHistoryDir() {
        try {
            if (!fs.existsSync(this.historyDir)) {
                fs.mkdirSync(this.historyDir, { recursive: true });
            }
        }
        catch {
            // Fall back to home directory if we can't create the history dir
        }
    }
    /**
     * Get project-specific history file path
     * Uses a hash of the project path to create unique history files per project
     */
    getProjectHistoryFile(projectPath) {
        try {
            // Normalize the path for consistent hashing
            const normalizedPath = path.resolve(projectPath).toLowerCase();
            // Create a short hash from the project path
            const hash = crypto.createHash('md5')
                .update(normalizedPath)
                .digest('hex')
                .substring(0, 12);
            // Get the last folder name for readability
            const projectName = path.basename(projectPath)
                .replace(/[^a-zA-Z0-9-_]/g, '_')
                .substring(0, 30);
            // Create a readable filename: projectname-hash.history
            const historyFileName = `${projectName}-${hash}.history`;
            return path.join(this.historyDir, historyFileName);
        }
        catch {
            // Fall back to global history file
            return path.join(os.homedir(), '.codemind_history');
        }
    }
    /**
     * Cleanup resources on exit
     */
    async cleanup() {
        console.log(theme_1.Theme.colors.muted('\n🧹 Cleaning up resources...'));
        try {
            // Cleanup with timeout protection
            const cleanupPromise = async () => {
                // Cleanup interrupt manager
                this.context.interruptManager.cleanup();
                // Cleanup Claude Code forwarder
                this.context.claudeForwarder.stopForwarding();
                // Cleanup database connections
                if (this.context.databaseManager) {
                    try {
                        await Promise.race([
                            this.context.databaseManager.cleanup?.(),
                            new Promise(resolve => setTimeout(resolve, 1000)) // 1 second timeout
                        ]);
                    }
                    catch (error) {
                        // Ignore database cleanup errors
                    }
                }
                // Close readline interface
                if (this.rl) {
                    this.rl.close();
                }
            };
            // Run cleanup with 2 second timeout
            await Promise.race([
                cleanupPromise(),
                new Promise(resolve => setTimeout(resolve, 2000))
            ]);
            console.log(theme_1.Theme.colors.muted('✅ Cleanup complete'));
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(theme_1.Theme.colors.error(`❌ Cleanup error: ${errorMessage}`));
        }
    }
}
exports.CodeMindCLI = CodeMindCLI;
/**
 * Main entry point - SOLID architecture
 */
async function main() {
    // Parse command-line arguments
    const args = process.argv.slice(2);
    const hasCommand = args.includes('-c') || args.includes('--command');
    const hasProject = args.includes('-p') || args.includes('--project');
    const hasTransparent = args.includes('-t') || args.includes('--transparent');
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
${theme_1.Theme.colors.primary('CodeMind Interactive CLI - Intelligent Code Assistant')}

${theme_1.Theme.colors.secondary('Usage:')}
  codemind [options] [command]

${theme_1.Theme.colors.secondary('Options:')}
  -V, --version         output the version number
  -p, --project <path>  Project path
  -c, --command <cmd>   Execute single command
  -t, --transparent     Skip interactive prompts, output context directly
  --no-color            Disable colored output
  -h, --help            display help for command

${theme_1.Theme.colors.secondary('Examples:')}
  codemind                    Start interactive mode in current directory
  codemind -p /path/to/proj   Start with specific project path
  codemind -c "analyze main"  Execute single command and exit
  codemind -t -c "query"      Execute in transparent mode (no prompts)
  codemind "what is this project about"  Execute direct command and exit
`);
        return;
    }
    if (args.includes('--version') || args.includes('-V')) {
        console.log('2.0.0');
        return;
    }
    const cli = new CodeMindCLI();
    // Auto-enable transparent mode when running inside Claude Code
    const isInsideClaudeCode = platform_utils_1.PlatformUtils.isRunningInClaudeCode();
    const useTransparentMode = hasTransparent || isInsideClaudeCode;
    if (isInsideClaudeCode && !hasTransparent) {
        // Silently enable transparent mode - don't spam output
    }
    // Handle project path option
    if (hasProject) {
        const projectIndex = args.findIndex(arg => arg === '-p' || arg === '--project');
        if (projectIndex !== -1 && args[projectIndex + 1]) {
            cli.setProjectPath(args[projectIndex + 1]);
        }
    }
    // Set transparent mode if needed
    if (useTransparentMode) {
        cli.setTransparentMode(true);
    }
    // Handle command option
    if (hasCommand) {
        const commandIndex = args.findIndex(arg => arg === '-c' || arg === '--command');
        if (commandIndex !== -1 && args[commandIndex + 1]) {
            // Execute single command and exit (streamlined for non-interactive mode)
            // Set command mode to prevent premature exit during inquirer prompts
            cli.setCommandMode(true);
            try {
                await cli.startSilent();
                await cli.processInput(args[commandIndex + 1]);
                console.log(theme_1.Theme.colors.success('✅ Command completed'));
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(theme_1.Theme.colors.error(`❌ Command failed: ${errorMessage}`));
                if (error instanceof Error && error.stack) {
                    console.error(error.stack);
                }
            }
            // Mark command mode as completed before exiting
            cli.commandModeCompleted = true;
            process.exit(0);
        }
    }
    // Handle direct command (positional argument that's not a flag)
    const commandStartIndex = args.findIndex(arg => !arg.startsWith('-') && !args[args.indexOf(arg) - 1]?.match(/^-[cp]|^--(?:command|project)$/));
    if (commandStartIndex !== -1 && !hasCommand && !hasProject) {
        // Execute direct command with all remaining arguments and exit
        // Set command mode to prevent premature exit during inquirer prompts
        cli.setCommandMode(true);
        const fullCommand = args.slice(commandStartIndex).join(' ');
        try {
            await cli.startSilent();
            await cli.processInput(fullCommand);
            console.log(theme_1.Theme.colors.success('✅ Command completed'));
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(theme_1.Theme.colors.error(`❌ Command failed: ${errorMessage}`));
            if (error instanceof Error && error.stack) {
                console.error(error.stack);
            }
        }
        // Mark command mode as completed before exiting
        cli.commandModeCompleted = true;
        process.exit(0);
    }
    // Start interactive mode (REPL)
    cli.setReplMode(true);
    await cli.start();
}
// Error handling
process.on('uncaughtException', (error) => {
    console.error(theme_1.Theme.colors.error(`\n❌ Fatal error: ${error.message}`));
    console.error('Stack trace:', error.stack);
    process.exit(1);
});
process.on('unhandledRejection', (error) => {
    console.error(theme_1.Theme.colors.error(`\n❌ Unhandled rejection: ${String(error)}`));
    console.error('This error should be handled properly in the application code.');
    console.error('CodeMind will continue running, but this issue should be fixed.');
    // Don't exit immediately - let the application handle it
    // process.exit(1);
});
// Start CLI if this is the main module
if (require.main === module) {
    main().catch((error) => {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(theme_1.Theme.colors.error(`\n❌ Failed to start CodeMind CLI: ${errorMessage}`));
        process.exit(1);
    });
}
exports.default = CodeMindCLI;
//# sourceMappingURL=codemind-cli.js.map