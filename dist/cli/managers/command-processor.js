"use strict";
/**
 * CommandProcessor - Handles command parsing, routing, and help system
 * Single Responsibility: Command processing and routing
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
exports.CommandProcessor = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const theme_1 = require("../ui/theme");
const sync_manager_service_1 = require("../services/sync-manager-service");
const file_watcher_service_1 = require("../services/file-watcher-service");
const assumption_detector_1 = require("../services/assumption-detector");
const user_clarification_service_1 = require("../services/user-clarification-service");
const documentation_rag_service_1 = require("../../shared/documentation-rag-service");
const database_health_service_1 = require("../services/database-health-service");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class CommandProcessor {
    context;
    syncManager;
    fileWatcher;
    assumptionDetector;
    databaseHealthService;
    rl; // Will be set from CLI
    constructor(context) {
        this.context = context;
        this.syncManager = new sync_manager_service_1.SyncManagerService();
        this.fileWatcher = new file_watcher_service_1.FileWatcherService(this.syncManager, {
            enabled: true,
            autoSync: true,
            debounceMs: 2000,
            syncDelayMs: 5000
        });
        this.assumptionDetector = new assumption_detector_1.AssumptionDetector();
        this.databaseHealthService = new database_health_service_1.DatabaseHealthService();
    }
    /**
     * Set the readline interface for user interaction
     */
    setReadlineInterface(rl) {
        this.rl = rl;
    }
    /**
     * Parse path and flags from command arguments
     */
    parsePathAndFlags(args) {
        const parts = args.trim().split(/\s+/);
        let targetPath = parts[0] || '/'; // Default to root if no path
        let recursive = true; // Default to recursive
        // Check for --no-recursive flag
        if (parts.includes('--no-recursive') || parts.includes('--nr')) {
            recursive = false;
        }
        // Resolve path relative to project or current directory
        const projectPath = this.context.currentProject?.projectPath || process.env.CODEMIND_USER_CWD || process.cwd();
        let resolvedPath;
        if (targetPath === '/' || targetPath === '.') {
            resolvedPath = projectPath;
        }
        else if (path.isAbsolute(targetPath)) {
            resolvedPath = targetPath;
        }
        else {
            resolvedPath = path.resolve(projectPath, targetPath);
        }
        return {
            path: targetPath,
            recursive,
            resolvedPath
        };
    }
    /**
     * Process any input - either command or natural language
     */
    async processInput(input) {
        const trimmedInput = input.trim();
        if (trimmedInput.startsWith('/')) {
            return this.processCommand(trimmedInput.substring(1));
        }
        else {
            return this.processNaturalLanguage(trimmedInput);
        }
    }
    /**
     * Process slash commands
     */
    async processCommand(commandInput) {
        const parts = commandInput.split(' ');
        const command = parts[0].toLowerCase();
        const args = parts.slice(1).join(' ');
        switch (command) {
            case 'setup':
                return this.handleSetup(args);
            case 'init':
                return this.handleInit(args);
            case 'status':
                return this.handleStatus();
            case 'project':
                return this.handleProject(args);
            case 'search':
                return this.handleSearch(args);
            case 'analyze':
                return this.handleAnalyze(args);
            case 'dedup':
                return this.handleDedup(args);
            case 'solid':
                return this.handleSolid(args);
            case 'docs':
                return this.handleDocs(args);
            case 'sync':
                return this.handleSync(args);
            case 'instructions':
            case 'inst':
                return this.handleInstructions(args);
            case 'help':
                return this.handleHelp(args);
            case 'exit':
            case 'quit':
                return this.handleExit();
            default:
                return {
                    success: false,
                    message: `Unknown command: ${command}. Type "/help" for available commands.`
                };
        }
    }
    /**
     * Process natural language queries through Claude Code
     */
    async processNaturalLanguage(query) {
        if (!this.context.currentProject) {
            return {
                success: false,
                message: 'No project loaded. Run "/init" first to set up your project.'
            };
        }
        // Step 1: Detect assumptions and ambiguities
        console.log(theme_1.Theme.colors.info('🔍 Analyzing request for assumptions...'));
        const analysis = this.assumptionDetector.analyzeRequest(query, this.context.currentProject);
        let finalQuery = query;
        // Step 2: If ambiguities detected, request clarification from user
        if (analysis.hasAmbiguities && this.rl) {
            const clarificationService = new user_clarification_service_1.UserClarificationService(this.rl);
            const clarification = await clarificationService.requestClarification(query, analysis);
            if (!clarification.shouldProceed) {
                return {
                    success: false,
                    message: 'Request cancelled by user. Please refine your request.'
                };
            }
            finalQuery = clarification.clarifiedPrompt;
            console.log(theme_1.Theme.colors.success('✅ Request clarified with user input'));
        }
        else if (analysis.hasAmbiguities) {
            // No readline interface available, show assumptions but proceed
            console.log(theme_1.Theme.colors.warning('⚠️  Detected assumptions (proceeding without clarification):'));
            analysis.assumptions.forEach((assumption, index) => {
                console.log(theme_1.Theme.colors.muted(`${index + 1}. [${assumption.category}] ${assumption.assumption}`));
            });
        }
        // Step 3: Process through Claude Code with enhanced prompt
        console.log(theme_1.Theme.colors.claudeCode('🤖 Sending to Claude Code...'));
        console.log(theme_1.Theme.colors.claudeCodeMuted(`   Enhanced query length: ${finalQuery.length} characters`));
        try {
            // Add prompt enhancement for assumption awareness
            const enhancedQuery = this.enhanceQueryForClaudeCode(finalQuery, analysis);
            // Wrap Claude Code processing with interrupt support
            const result = await this.context.interruptManager.wrapInterruptible('claude-code-processing', `Claude Code processing with assumptions: "${query}"`, async (updateCallback) => {
                updateCallback?.({ status: 'Sending enhanced prompt to Claude Code...' });
                const result = await this.context.claudeOrchestrator.processRequest(enhancedQuery, this.context.currentProject.projectPath);
                updateCallback?.({ status: 'Processing complete', result });
                return result;
            });
            // Handle interruption
            if (result === null) {
                console.log(theme_1.Theme.colors.claudeCode('🤖 ⏸️  Claude Code processing was interrupted'));
                return {
                    success: false,
                    message: 'Claude Code processing was interrupted by user',
                    data: { interrupted: true }
                };
            }
            if (result.success) {
                // Check if Claude Code response includes assumptions field
                this.checkClaudeCodeAssumptions(result.data);
                this.context.userInterface.displayProcessingResults(result.data);
                return {
                    success: true,
                    message: 'Request processed successfully with assumption detection',
                    data: result.data
                };
            }
            else {
                return {
                    success: false,
                    message: result.error || 'Processing failed'
                };
            }
        }
        catch (error) {
            return {
                success: false,
                message: `Processing error: ${error.message}`
            };
        }
    }
    // Command Handlers
    async handleSetup(args) {
        console.log(theme_1.Theme.colors.info('🔧 Starting CodeMind setup check...'));
        try {
            // Step 1: Check current database status (without causing errors)
            console.log(theme_1.Theme.colors.info('🔍 Checking database status...'));
            const currentStatus = await this.databaseHealthService.checkDatabaseHealth();
            // Display current status
            console.log(theme_1.Theme.colors.primary('\nDatabase Status:'));
            console.log(`  PostgreSQL: ${currentStatus.postgresql.available ? theme_1.Theme.colors.success('✓ Running') : theme_1.Theme.colors.error('✗ Not running')}`);
            console.log(`  Redis:      ${currentStatus.redis.available ? theme_1.Theme.colors.success('✓ Running') : theme_1.Theme.colors.error('✗ Not running')}`);
            console.log(`  Neo4j:      ${currentStatus.neo4j.available ? theme_1.Theme.colors.success('✓ Running') : theme_1.Theme.colors.error('✗ Not running')}`);
            // Step 2: Determine what needs to be started
            const needsStart = [];
            if (!currentStatus.postgresql.available)
                needsStart.push('postgres');
            if (!currentStatus.redis.available)
                needsStart.push('redis');
            if (!currentStatus.neo4j.available)
                needsStart.push('neo4j');
            // Step 3: Start missing databases if needed
            if (needsStart.length > 0) {
                console.log(theme_1.Theme.colors.warning(`\n⚠ Need to start: ${needsStart.join(', ')}`));
                const started = await this.databaseHealthService.restartDatabases(needsStart);
                if (!started) {
                    return {
                        success: false,
                        message: 'Failed to start database services. Please ensure Docker/Rancher Desktop is running.'
                    };
                }
                // Re-check status after starting
                const newStatus = await this.databaseHealthService.checkDatabaseHealth();
                const stillMissing = [];
                if (!newStatus.postgresql.available)
                    stillMissing.push('PostgreSQL');
                if (!newStatus.redis.available)
                    stillMissing.push('Redis');
                if (!newStatus.neo4j.available)
                    stillMissing.push('Neo4j');
                if (stillMissing.length > 0) {
                    return {
                        success: false,
                        message: `Failed to start: ${stillMissing.join(', ')}. Check Docker logs for details.`
                    };
                }
                console.log(theme_1.Theme.colors.success('✓ All database services started successfully'));
            }
            else {
                console.log(theme_1.Theme.colors.success('\n✓ All database services are already running'));
            }
            // Step 4: Check and initialize database tables/collections
            console.log(theme_1.Theme.colors.info('\n📋 Checking database schemas...'));
            // Check PostgreSQL tables
            if (currentStatus.postgresql.available || needsStart.includes('postgres')) {
                const tableCheck = await this.databaseHealthService.checkDatabaseTables();
                if (!tableCheck.initialized) {
                    console.log(theme_1.Theme.colors.warning(`⚠ Missing tables: ${tableCheck.missingTables?.join(', ')}`));
                    console.log(theme_1.Theme.colors.info('Creating database tables...'));
                    const initResult = await this.databaseHealthService.initializeDatabaseTables();
                    if (!initResult.success) {
                        return {
                            success: false,
                            message: `Failed to initialize tables: ${initResult.error}`
                        };
                    }
                    console.log(theme_1.Theme.colors.success('✓ Database tables created'));
                }
                else {
                    console.log(theme_1.Theme.colors.success('✓ All required tables exist'));
                }
            }
            // Note: Redis doesn't need schema initialization (key-value store)
            // Note: Neo4j constraints/indexes would be initialized here if needed
            // Step 5: Final verification
            console.log(theme_1.Theme.colors.info('\n🔍 Final verification...'));
            const finalStatus = await this.databaseHealthService.checkDatabaseHealth();
            const finalTableCheck = await this.databaseHealthService.checkDatabaseTables();
            const allReady = finalStatus.postgresql.available &&
                finalStatus.redis.available &&
                finalStatus.neo4j.available &&
                finalTableCheck.initialized;
            if (allReady) {
                return {
                    success: true,
                    message: theme_1.Theme.colors.success('\n✅ Setup complete! All databases are running with proper schemas.\nYou can now run "/init" to populate project data.')
                };
            }
            else {
                const issues = [];
                if (!finalStatus.postgresql.available)
                    issues.push('PostgreSQL not running');
                if (!finalStatus.redis.available)
                    issues.push('Redis not running');
                if (!finalStatus.neo4j.available)
                    issues.push('Neo4j not running');
                if (!finalTableCheck.initialized)
                    issues.push('Database tables not initialized');
                return {
                    success: false,
                    message: `Setup incomplete. Issues: ${issues.join(', ')}`
                };
            }
        }
        catch (error) {
            return {
                success: false,
                message: `Setup failed: ${error.message || error}`
            };
        }
    }
    async handleInit(args) {
        console.log(theme_1.Theme.colors.info('📝 Starting project initialization...'));
        try {
            // First ensure databases are ready
            const dbReady = await this.databaseHealthService.ensureDatabasesReady({
                postgresql: true,
                redis: true,
                neo4j: true // Neo4j is required for init
            });
            if (!dbReady) {
                return {
                    success: false,
                    message: 'Database services are not available. Please run "/setup" first or ensure Docker is running.'
                };
            }
            const resetFlag = args.includes('--reset') || args.includes('-r');
            const userCwd = process.env.CODEMIND_USER_CWD || process.cwd();
            // Check if project is already initialized
            const existingProject = this.context.projectManager.detectProject(userCwd);
            if (existingProject && !resetFlag) {
                // Check for command-line flags to control behavior
                const reinitializeFlag = args.includes('--reinitialize') || args.includes('--reinit');
                const skipFlag = args.includes('--skip');
                const syncFlag = args.includes('--sync') || (!reinitializeFlag && !skipFlag); // Default to sync
                if (skipFlag) {
                    this.context.currentProject = existingProject;
                    return {
                        success: true,
                        message: `Project "${existingProject.projectName}" is already initialized. No changes made.`,
                        data: existingProject
                    };
                }
                if (reinitializeFlag) {
                    console.log(theme_1.Theme.colors.warning('🔄 Reinitializing project - clearing existing data...'));
                    await this.clearProjectData(existingProject.projectId);
                    // Continue with full initialization
                }
                else if (syncFlag) {
                    // Smart initialization behavior for already initialized projects
                    const action = await this.context.userInterface.getInitializationAction(existingProject.projectName);
                    if (action === 'sync') {
                        console.log(theme_1.Theme.colors.info('🔄 Analyzing project changes for intelligent sync...'));
                        return await this.intelligentSyncProject(existingProject, userCwd);
                    }
                    else if (action === 'skip') {
                        this.context.currentProject = existingProject;
                        return {
                            success: true,
                            message: `Project "${existingProject.projectName}" is already initialized. No changes made.`,
                            data: existingProject
                        };
                    }
                    // If action is 'reinitialize', continue with full initialization below
                }
            }
            // If reset flag is provided, offer to reset database
            if (resetFlag) {
                const confirmReset = await this.context.userInterface.confirm('This will delete all existing project data from the database. Continue?');
                if (!confirmReset) {
                    return {
                        success: false,
                        message: 'Initialization cancelled by user'
                    };
                }
                console.log(theme_1.Theme.colors.warning('🗑️  Resetting database tables...'));
                await this.resetDatabase();
                console.log(theme_1.Theme.colors.success('✅ Database reset complete'));
            }
            // Get project information through UI (skip if reinitializing with existing config)
            const projectOptions = existingProject && args.includes('reinitialize')
                ? { projectName: existingProject.projectName, projectType: existingProject.projectType || 'other', features: [] }
                : await this.context.userInterface.getProjectInitOptions();
            // Initialize project
            const result = await this.context.projectManager.initializeProject(userCwd, projectOptions);
            if (result.success) {
                this.context.currentProject = result.config;
                // Auto-ingest documentation after successful initialization
                console.log(theme_1.Theme.colors.info('📚 Scanning for documentation to ingest...'));
                await this.autoIngestDocumentation(userCwd);
                return {
                    success: true,
                    message: 'Project initialized successfully with documentation RAG!',
                    data: result.config
                };
            }
            else {
                return {
                    success: false,
                    message: result.error || 'Project initialization failed'
                };
            }
        }
        catch (error) {
            return {
                success: false,
                message: `Initialization error: ${error.message}`
            };
        }
    }
    async handleStatus() {
        console.log(theme_1.Theme.colors.primary('📊 CodeMind Status'));
        console.log(theme_1.Theme.colors.border('═'.repeat(60)));
        // System status
        console.log(theme_1.Theme.colors.primary('\nSystem:'));
        const healthStatus = await this.context.databaseManager.checkSystemHealth();
        Object.entries(healthStatus).forEach(([service, status]) => {
            const statusColor = status ? theme_1.Theme.colors.success : theme_1.Theme.colors.error;
            const statusText = status ? 'Connected' : 'Disconnected';
            console.log(theme_1.Theme.colors.result(`  • ${service}: ${statusColor(statusText)}`));
        });
        // Project status
        if (this.context.currentProject) {
            console.log(theme_1.Theme.colors.primary('\nProject:'));
            console.log(theme_1.Theme.colors.result(`  • Name: ${this.context.currentProject.projectName}`));
            console.log(theme_1.Theme.colors.result(`  • Type: ${this.context.currentProject.projectType}`));
            console.log(theme_1.Theme.colors.result(`  • Path: ${this.context.currentProject.projectPath}`));
            // Get additional project info
            const projectInfo = await this.context.projectManager.getProjectInfo(this.context.currentProject.projectId);
            if (projectInfo) {
                console.log(theme_1.Theme.colors.result(`  • Files: ${projectInfo.total_files || 0}`));
                console.log(theme_1.Theme.colors.result(`  • Embeddings: ${projectInfo.statistics?.embeddings || 0}`));
            }
        }
        else {
            console.log(theme_1.Theme.colors.warning('\nNo project loaded'));
        }
        return { success: true };
    }
    async handleProject(args) {
        const subCommand = args.split(' ')[0];
        switch (subCommand) {
            case 'switch':
                const userCwd = process.env.CODEMIND_USER_CWD || process.cwd();
                const targetPath = args.split(' ')[1] || userCwd;
                const config = await this.context.projectManager.switchProject(targetPath);
                if (config) {
                    this.context.currentProject = config;
                    return {
                        success: true,
                        message: `Switched to project: ${config.projectName}`
                    };
                }
                else {
                    return {
                        success: false,
                        message: 'No CodeMind project found in target directory'
                    };
                }
            case 'info':
                if (!this.context.currentProject) {
                    return {
                        success: false,
                        message: 'No project loaded'
                    };
                }
                const info = await this.context.projectManager.getProjectInfo(this.context.currentProject.projectId);
                this.context.userInterface.displayProjectInfo(info);
                return { success: true };
            default:
                return {
                    success: false,
                    message: 'Usage: /project [switch <path>|info]'
                };
        }
    }
    async handleSearch(args) {
        if (!this.context.currentProject) {
            return {
                success: false,
                message: 'No project loaded. Run "/init" first.'
            };
        }
        if (!args.trim()) {
            return {
                success: false,
                message: 'Usage: /search <query>'
            };
        }
        try {
            const results = await this.context.claudeOrchestrator.performSemanticSearch(args, this.context.currentProject.projectPath);
            this.context.userInterface.displaySearchResults(results);
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                message: `Search failed: ${error.message}`
            };
        }
    }
    async handleAnalyze(args) {
        if (!this.context.currentProject) {
            return {
                success: false,
                message: 'No project loaded. Run "/init" first.'
            };
        }
        console.log(theme_1.Theme.colors.info('🔍 Starting project analysis...'));
        try {
            const analysis = await this.context.claudeOrchestrator.analyzeProject(this.context.currentProject.projectPath);
            this.context.userInterface.displayAnalysisResults(analysis);
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                message: `Analysis failed: ${error.message}`
            };
        }
    }
    async handleDedup(args) {
        if (!this.context.currentProject) {
            return {
                success: false,
                message: 'No project loaded. Run "/init" first.'
            };
        }
        const subCommand = args.split(' ')[0] || 'analyze';
        try {
            const { DeduplicationService } = await Promise.resolve().then(() => __importStar(require('../services/deduplication-service')));
            const dedupService = new DeduplicationService();
            switch (subCommand) {
                case 'analyze':
                case 'report':
                    return await this.handleDedupAnalyze(dedupService);
                case 'merge':
                case 'interactive':
                    return await this.handleDedupMerge(dedupService);
                default:
                    return {
                        success: false,
                        message: `Unknown dedup command: ${subCommand}. Use "analyze" or "merge".`
                    };
            }
        }
        catch (error) {
            return {
                success: false,
                message: `Deduplication failed: ${error.message}`
            };
        }
    }
    /**
     * Handle dedup analyze command
     */
    async handleDedupAnalyze(dedupService) {
        console.log(theme_1.Theme.colors.primary('🔍 GRANULAR DUPLICATE CODE ANALYSIS'));
        console.log(theme_1.Theme.colors.info('Analyzing methods and classes for duplicates using semantic embeddings...'));
        try {
            const report = await dedupService.generateDeduplicationReport(this.context.currentProject.projectId, (progress, status) => {
                console.log(theme_1.Theme.colors.muted(`   ${progress}% - ${status}`));
            });
            // Display the comprehensive report
            dedupService.printDeduplicationReport(report);
            return {
                success: true,
                message: `Analysis complete! Found ${report.duplicateGroups.length} duplicate groups.`,
                data: { report }
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Analysis failed: ${error.message}`
            };
        }
    }
    /**
     * Handle dedup merge command
     */
    async handleDedupMerge(dedupService) {
        console.log(theme_1.Theme.colors.primary('🔧 INTERACTIVE DUPLICATE MERGING'));
        console.log(theme_1.Theme.colors.info('Starting interactive merge process with quality cycle...'));
        try {
            // First generate the report
            const report = await dedupService.generateDeduplicationReport(this.context.currentProject.projectId, (progress, status) => {
                console.log(theme_1.Theme.colors.muted(`   ${progress}% - ${status}`));
            });
            if (report.duplicateGroups.length === 0) {
                return {
                    success: true,
                    message: 'No duplicates found to merge. Your code is well-organized!'
                };
            }
            // Start interactive merge process
            await dedupService.interactiveMerge(report, this.context.userInterface, this.context.claudeOrchestrator);
            return {
                success: true,
                message: 'Interactive merging process completed.',
                data: { report }
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Interactive merge failed: ${error.message}`
            };
        }
    }
    /**
     * Parse deduplication options from command arguments
     */
    parseDeduplicationOptions(args) {
        const options = {};
        if (args.includes('--exact-threshold')) {
            const match = args.match(/--exact-threshold[=\s]+([0-9.]+)/);
            if (match)
                options.exactSimilarityThreshold = parseFloat(match[1]);
        }
        if (args.includes('--semantic-threshold')) {
            const match = args.match(/--semantic-threshold[=\s]+([0-9.]+)/);
            if (match)
                options.semanticSimilarityThreshold = parseFloat(match[1]);
        }
        if (args.includes('--structural-threshold')) {
            const match = args.match(/--structural-threshold[=\s]+([0-9.]+)/);
            if (match)
                options.structuralSimilarityThreshold = parseFloat(match[1]);
        }
        if (args.includes('--min-size')) {
            const match = args.match(/--min-size[=\s]+(\d+)/);
            if (match)
                options.minimumChunkSize = parseInt(match[1]);
        }
        if (args.includes('--functions-only')) {
            options.includeTypes = ['function', 'method'];
        }
        if (args.includes('--classes-only')) {
            options.includeTypes = ['class'];
        }
        return options;
    }
    handleHelp(args) {
        this.context.userInterface.displayHelp();
        return { success: true };
    }
    handleExit() {
        console.log(theme_1.Theme.colors.primary('\n👋 Goodbye! Thank you for using CodeMind.'));
        process.exit(0);
    }
    /**
     * Sync project data with current state (incremental update)
     */
    async syncProject(existingProject, projectPath) {
        try {
            // Import the InitializationStatusTracker
            const { InitializationStatusTracker } = await Promise.resolve().then(() => __importStar(require('../services/initialization/initialization-status-tracker')));
            const statusTracker = new InitializationStatusTracker();
            // Check current initialization status
            const status = await statusTracker.getProjectStatus(existingProject.projectId);
            if (status && status.initializationComplete) {
                console.log(theme_1.Theme.colors.info('🔄 Performing incremental sync...'));
                // Re-run project analysis to detect changes
                const result = await this.context.projectManager.initializeProject(projectPath, {
                    projectName: existingProject.projectName,
                    projectType: existingProject.projectType || 'other',
                    features: []
                }, true // Set sync mode flag
                );
                if (result.success) {
                    this.context.currentProject = result.config;
                    console.log(theme_1.Theme.colors.success('🏁 Sync completed - preparing response...'));
                    const response = {
                        success: true,
                        message: `Project "${existingProject.projectName}" synchronized successfully!`,
                        data: result.config
                    };
                    console.log(theme_1.Theme.colors.success('🏁 Response prepared - returning to CLI...'));
                    return response;
                }
                else {
                    console.log(theme_1.Theme.colors.error('❌ Sync failed - returning error...'));
                    return {
                        success: false,
                        message: result.error || 'Project synchronization failed'
                    };
                }
            }
            else {
                // Incomplete initialization - resume from where it left off
                console.log(theme_1.Theme.colors.warning('🔄 Resuming incomplete initialization...'));
                await statusTracker.displayProgress(existingProject.projectId);
                const result = await this.context.projectManager.initializeProject(projectPath, {
                    projectName: existingProject.projectName,
                    projectType: existingProject.projectType || 'other',
                    features: []
                });
                if (result.success) {
                    this.context.currentProject = result.config;
                    console.log(theme_1.Theme.colors.success('🏁 Initialization completed - preparing response...'));
                    const response = {
                        success: true,
                        message: `Project "${existingProject.projectName}" initialization completed!`,
                        data: result.config
                    };
                    console.log(theme_1.Theme.colors.success('🏁 Response prepared - returning to CLI...'));
                    return response;
                }
                else {
                    console.log(theme_1.Theme.colors.error('❌ Initialization failed - returning error...'));
                    return {
                        success: false,
                        message: result.error || 'Project initialization failed'
                    };
                }
            }
        }
        catch (error) {
            return {
                success: false,
                message: `Sync error: ${error.message}`
            };
        }
    }
    /**
     * Intelligent sync with Redis-based change detection
     */
    async intelligentSyncProject(existingProject, projectPath) {
        try {
            console.log(theme_1.Theme.colors.info('🧠 Initializing Redis file hash tracker...'));
            const { FileHashTracker } = await Promise.resolve().then(() => __importStar(require('../../shared/file-hash-tracker')));
            const hashTracker = new FileHashTracker();
            // Get list of current project files
            console.log(theme_1.Theme.colors.info('📂 Scanning project files...'));
            const projectFiles = await this.scanProjectFiles(projectPath);
            console.log(theme_1.Theme.colors.muted(`   Found ${projectFiles.length} source files to analyze`));
            // Get sync recommendation
            const recommendation = await hashTracker.analyzeSyncNeeds(existingProject.projectId, projectFiles, {
                mode: 'incremental',
                sessionStart: true,
                timeThreshold: 24, // 24 hours
                includeEmbeddings: true,
                includeGraph: true,
                includeAnalysis: true
            });
            console.log(theme_1.Theme.colors.info(`📊 Sync Analysis: ${recommendation.stats.totalFiles} files`));
            console.log(theme_1.Theme.colors.muted(`   • ${recommendation.stats.unchangedFiles} unchanged`));
            console.log(theme_1.Theme.colors.muted(`   • ${recommendation.stats.newFiles} new`));
            console.log(theme_1.Theme.colors.muted(`   • ${recommendation.stats.changedFiles} modified`));
            console.log(theme_1.Theme.colors.muted(`   • ${recommendation.stats.deletedFiles} deleted`));
            console.log(theme_1.Theme.colors.info(`🔍 Sync reason: ${recommendation.reason}`));
            console.log(theme_1.Theme.colors.info(`🎯 Should sync: ${recommendation.shouldSync}`));
            if (!recommendation.shouldSync) {
                console.log(theme_1.Theme.colors.success(`✅ Project is up to date - no sync needed (${recommendation.reason})`));
                // Update sync metadata even if no sync needed
                await hashTracker.updateSyncMetadata(existingProject.projectId, {
                    lastSyncTime: Date.now(),
                    syncStrategy: 'skipped_unchanged',
                    filesProcessed: recommendation.stats.totalFiles
                });
                return {
                    success: true,
                    message: `Project "${existingProject.projectName}" is already synchronized!`,
                    data: existingProject
                };
            }
            console.log(theme_1.Theme.colors.warning(`🔄 Sync needed: ${recommendation.reason}`));
            // Handle deleted files first
            if (recommendation.deletedFiles.length > 0) {
                console.log(theme_1.Theme.colors.info(`🗑️  Removing embeddings for ${recommendation.deletedFiles.length} deleted files...`));
                await this.removeDeletedFileEmbeddings(existingProject.projectId, recommendation.deletedFiles);
            }
            if (recommendation.changedFiles.length > 0 || recommendation.deletedFiles.length > 0) {
                console.log(theme_1.Theme.colors.info(`📝 Processing ${recommendation.changedFiles.length} changed files...`));
                // For first-time sync or when there are many new files, use full sync
                if (recommendation.stats.newFiles > 10 || recommendation.reason === 'session_start') {
                    console.log(theme_1.Theme.colors.warning(`🔄 Many new files detected, using full sync for first-time setup...`));
                    const result = await this.syncProject(existingProject, projectPath);
                    // After full sync, mark all files as tracked
                    if (result.success) {
                        for (const filePath of projectFiles) {
                            await hashTracker.markFileSynced(existingProject.projectId, filePath, {
                                embedding: true,
                                graph: true,
                                analysis: true
                            });
                        }
                        await hashTracker.updateSyncMetadata(existingProject.projectId, {
                            lastSyncTime: Date.now(),
                            syncStrategy: 'full_initial',
                            filesProcessed: projectFiles.length
                        });
                    }
                    return result;
                }
                else {
                    // Process only changed files for incremental sync
                    const result = await this.syncChangedFiles(existingProject, projectPath, recommendation.changedFiles, recommendation.deletedFiles, hashTracker);
                    return result;
                }
            }
            else {
                // No changes detected, just update metadata
                console.log(theme_1.Theme.colors.success(`✅ No files to sync - project is up to date`));
                await hashTracker.updateSyncMetadata(existingProject.projectId, {
                    lastSyncTime: Date.now(),
                    syncStrategy: 'no_changes',
                    filesProcessed: 0
                });
                return {
                    success: true,
                    message: `Project "${existingProject.projectName}" is already up to date!`,
                    data: existingProject
                };
            }
        }
        catch (error) {
            console.error(theme_1.Theme.colors.error(`❌ Intelligent sync failed: ${error.message}`));
            // Fallback to regular sync
            return await this.syncProject(existingProject, projectPath);
        }
    }
    /**
     * Sync only changed files for performance
     */
    async syncChangedFiles(existingProject, projectPath, changedFiles, deletedFiles, hashTracker) {
        const startTime = Date.now();
        try {
            console.log(theme_1.Theme.colors.info('🔄 Processing changed files incrementally...'));
            // Instead of re-initializing the whole project, process only changed files
            const { EmbeddingService } = await Promise.resolve().then(() => __importStar(require('../services/embedding-service')));
            const embeddingService = new EmbeddingService();
            let processedCount = 0;
            let errorCount = 0;
            // Process each changed file individually
            for (const filePath of changedFiles) {
                try {
                    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(projectPath, filePath);
                    // Check if file still exists (might have been deleted after detection)
                    if (!fs.existsSync(absolutePath)) {
                        console.log(theme_1.Theme.colors.warning(`  ⚠ File no longer exists: ${path.basename(filePath)}`));
                        continue;
                    }
                    console.log(theme_1.Theme.colors.muted(`  Processing: ${path.basename(filePath)}`));
                    // Process the file to generate and store embedding
                    // Use generateProjectEmbeddings for a single file
                    const result = await embeddingService.generateProjectEmbeddings(existingProject.projectId, [absolutePath], (progress, current) => {
                        // Progress callback for single file
                    });
                    if (result.errors > 0) {
                        throw new Error(`Failed to process file`);
                    }
                    processedCount++;
                    // Update hash tracker
                    await hashTracker.markFileSynced(existingProject.projectId, filePath, {
                        embedding: true,
                        graph: true,
                        analysis: true
                    });
                }
                catch (fileError) {
                    console.error(theme_1.Theme.colors.error(`  ✗ Failed to process ${path.basename(filePath)}: ${fileError.message}`));
                    errorCount++;
                }
            }
            console.log(theme_1.Theme.colors.info(`✅ Processed ${processedCount} files, ${errorCount} errors`));
            // Update sync metadata
            const duration = Date.now() - startTime;
            await hashTracker.updateSyncMetadata(existingProject.projectId, {
                lastSyncTime: Date.now(),
                syncStrategy: 'incremental',
                filesProcessed: processedCount,
                syncDuration: duration
            });
            const result = {
                success: errorCount === 0,
                config: existingProject
            };
            if (result.success) {
                this.context.currentProject = result.config;
                console.log(theme_1.Theme.colors.success('🏁 Incremental sync completed - preparing response...'));
                const response = {
                    success: true,
                    message: `Project "${existingProject.projectName}" synchronized ${processedCount} files successfully!`,
                    data: result.config
                };
                console.log(theme_1.Theme.colors.success('🏁 Response prepared - returning to CLI...'));
                return response;
            }
            else {
                console.log(theme_1.Theme.colors.error('❌ Incremental sync failed - returning error...'));
                return {
                    success: false,
                    message: `Incremental sync failed: ${errorCount} files could not be processed`
                };
            }
        }
        catch (error) {
            console.error(theme_1.Theme.colors.error(`❌ Incremental sync error: ${error.message}`));
            return {
                success: false,
                message: `Incremental sync error: ${error.message}`
            };
        }
    }
    /**
     * Scan project files for sync analysis
     */
    async scanProjectFiles(projectPath) {
        const glob = await Promise.resolve().then(() => __importStar(require('glob')));
        const path = await Promise.resolve().then(() => __importStar(require('path')));
        const patterns = [
            '**/*.js',
            '**/*.ts',
            '**/*.jsx',
            '**/*.tsx',
            '**/*.py',
            '**/*.java',
            '**/*.cpp',
            '**/*.c',
            '**/*.h',
            '**/*.cs',
            '**/*.go',
            '**/*.rs',
            '**/*.php'
        ];
        const allFiles = [];
        for (const pattern of patterns) {
            const files = glob.sync(pattern, {
                cwd: projectPath,
                ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**', '**/target/**']
            });
            allFiles.push(...files.map(f => path.resolve(projectPath, f)));
        }
        return [...new Set(allFiles)]; // Remove duplicates
    }
    /**
     * Remove embeddings for deleted files
     */
    async removeDeletedFileEmbeddings(projectId, deletedFiles) {
        try {
            const pgClient = await this.context.databaseManager.getPostgresConnection();
            for (const filePath of deletedFiles) {
                // Remove from PostgreSQL embeddings
                await pgClient.query('DELETE FROM semantic_search_embeddings WHERE project_id = $1 AND file_path = $2', [projectId, filePath]);
                console.log(theme_1.Theme.colors.muted(`  ✓ Removed embeddings for: ${path.basename(filePath)}`));
            }
            // Also remove from Neo4j if available
            try {
                const { DatabaseConnections } = await Promise.resolve().then(() => __importStar(require('../../config/database-config')));
                const dbConnections = new DatabaseConnections();
                const neo4jDriver = await dbConnections.getNeo4jConnection();
                const session = neo4jDriver.session();
                for (const filePath of deletedFiles) {
                    await session.run('MATCH (n:CodeEntity {projectId: $projectId, filePath: $filePath}) DETACH DELETE n', { projectId, filePath });
                }
                await session.close();
                console.log(theme_1.Theme.colors.muted(`  ✓ Removed ${deletedFiles.length} files from semantic graph`));
            }
            catch (neo4jError) {
                // Neo4j might not be available, continue without it
                console.log(theme_1.Theme.colors.muted('  ⚠ Neo4j not available, skipping graph cleanup'));
            }
        }
        catch (error) {
            console.error(theme_1.Theme.colors.error(`Failed to remove deleted file embeddings: ${error.message}`));
        }
    }
    /**
     * Clear all project data from databases
     */
    async clearProjectData(projectId) {
        try {
            console.log(theme_1.Theme.colors.info('🗑️  Clearing project data from databases...'));
            // Clear PostgreSQL data
            const pgClient = await this.context.databaseManager.getPostgresConnection();
            await pgClient.query('DELETE FROM semantic_search_embeddings WHERE project_id = $1', [projectId]);
            console.log(theme_1.Theme.colors.muted('  ✓ Cleared PostgreSQL embeddings'));
            await pgClient.query('DELETE FROM initialization_status WHERE project_id = $1', [projectId]);
            console.log(theme_1.Theme.colors.muted('  ✓ Cleared initialization status'));
            await pgClient.query('DELETE FROM projects WHERE id = $1', [projectId]);
            console.log(theme_1.Theme.colors.muted('  ✓ Cleared project metadata'));
            // Clear Neo4j data
            try {
                const { DatabaseConnections } = await Promise.resolve().then(() => __importStar(require('../../config/database-config')));
                const dbConnections = new DatabaseConnections();
                const neo4jDriver = await dbConnections.getNeo4jConnection();
                const neo4jClient = neo4jDriver.session();
                // Delete project and all related nodes/relationships
                await neo4jClient.run(`
          MATCH (p:PROJECT {projectId: $projectId})
          OPTIONAL MATCH (p)-[*]-(n)
          DETACH DELETE p, n
        `, { projectId });
                await neo4jClient.close();
                console.log(theme_1.Theme.colors.muted('  ✓ Cleared Neo4j graph data'));
            }
            catch (error) {
                console.log(theme_1.Theme.colors.warning(`  ⚠ Neo4j cleanup failed: ${error.message}`));
            }
            // Clear Redis cache (optional - cache will naturally expire)
            try {
                // Redis cleanup would go here if needed
                console.log(theme_1.Theme.colors.muted('  ✓ Cache will be refreshed'));
            }
            catch (error) {
                console.log(theme_1.Theme.colors.warning(`  ⚠ Redis cleanup failed: ${error.message}`));
            }
        }
        catch (error) {
            console.error(theme_1.Theme.colors.error(`Failed to clear project data: ${error.message}`));
            throw error;
        }
    }
    /**
     * Reset database tables for clean initialization
     */
    async resetDatabase() {
        try {
            const pgClient = await this.context.databaseManager.getPostgresConnection();
            // List of tables to truncate in dependency order
            const tables = [
                'semantic_search_embeddings',
                'initialization_status',
                'analysis_results',
                'projects',
                'session_store',
                'workflow_state',
                'resume_states',
                'system_configuration',
                'authentication_sessions'
            ];
            // Disable foreign key constraints temporarily
            await pgClient.query('SET session_replication_role = replica;');
            // Truncate tables
            for (const table of tables) {
                try {
                    await pgClient.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE;`);
                    console.log(theme_1.Theme.colors.muted(`  ✓ Cleared ${table}`));
                }
                catch (error) {
                    // Table might not exist, continue
                    console.log(theme_1.Theme.colors.muted(`  ⚠ Skipped ${table} (not found)`));
                }
            }
            // Re-enable foreign key constraints
            await pgClient.query('SET session_replication_role = DEFAULT;');
        }
        catch (error) {
            console.error(theme_1.Theme.colors.error(`Failed to reset database: ${error.message}`));
            throw error;
        }
    }
    /**
     * Handle SOLID principles analysis and refactoring
     */
    async handleSolid(args) {
        if (!this.context.currentProject) {
            return {
                success: false,
                message: 'No project loaded. Run "/init" first.'
            };
        }
        const options = this.parsePathAndFlags(args);
        try {
            const { SOLIDAnalyzerService } = await Promise.resolve().then(() => __importStar(require('../services/solid-analyzer-service')));
            const solidService = new SOLIDAnalyzerService();
            return await this.handleSolidAnalyze(solidService, options);
        }
        catch (error) {
            return {
                success: false,
                message: `SOLID analysis failed: ${error.message}`
            };
        }
    }
    /**
     * Handle SOLID analyze command
     */
    async handleSolidAnalyze(solidService, options) {
        console.log(theme_1.Theme.colors.primary('🏗️ SOLID PRINCIPLES ANALYSIS'));
        console.log(theme_1.Theme.colors.info(`Analyzing: ${options.path} ${options.recursive ? '(recursive)' : '(non-recursive)'}`));
        try {
            // Wrap the operation in interruptible wrapper
            const report = await this.context.interruptManager.wrapInterruptible('solid-analysis', `SOLID analysis of ${options.path}`, async (updateCallback) => {
                return await solidService.analyzeProject(options.resolvedPath, (progress, current) => {
                    console.log(theme_1.Theme.colors.muted(`   ${progress}% - ${current}`));
                    // Update interrupt manager with progress
                    updateCallback?.({ progress, current });
                }, options.recursive);
            });
            // Handle interruption case
            if (report === null) {
                return {
                    success: false,
                    message: 'SOLID analysis was interrupted by user',
                    data: { interrupted: true }
                };
            }
            // Display the comprehensive report
            solidService.printSOLIDReport(report);
            return {
                success: true,
                message: `SOLID analysis complete! Overall score: ${report.overallScore}/100`,
                data: { report }
            };
        }
        catch (error) {
            return {
                success: false,
                message: `SOLID analysis failed: ${error.message}`
            };
        }
    }
    /**
     * Handle SOLID refactor command
     */
    async handleSolidRefactor(solidService) {
        console.log(theme_1.Theme.colors.primary('🔧 SOLID REFACTORING'));
        console.log(theme_1.Theme.colors.info('Applying SOLID principles refactorings...'));
        try {
            // First generate the report to find violations
            const report = await solidService.analyzeProject(this.context.currentProject.projectPath, (progress, current) => {
                console.log(theme_1.Theme.colors.muted(`   ${progress}% - ${current}`));
            });
            if (report.summary.criticalViolations === 0 && report.summary.majorViolations === 0) {
                return {
                    success: true,
                    message: 'No critical or major SOLID violations found. Code already follows SOLID principles!'
                };
            }
            // Start interactive refactoring process
            await solidService.interactiveRefactor(report, this.context.claudeOrchestrator);
            return {
                success: true,
                message: 'SOLID refactoring process completed.',
                data: { report }
            };
        }
        catch (error) {
            return {
                success: false,
                message: `SOLID refactoring failed: ${error.message}`
            };
        }
    }
    /**
     * Handle documentation generation
     */
    async handleDocs(args) {
        if (!this.context.currentProject) {
            return {
                success: false,
                message: 'No project loaded. Run "/init" first.'
            };
        }
        const subCommand = args.split(' ')[0] || 'generate';
        try {
            const { DocumentationService } = await Promise.resolve().then(() => __importStar(require('../services/documentation-service')));
            const docsService = new DocumentationService();
            switch (subCommand) {
                case 'generate':
                case 'create':
                    return await this.handleDocsGenerate(docsService);
                case 'ingest':
                    return await this.handleDocsIngest(args);
                case 'search':
                    return await this.handleDocsSearch(args);
                case 'fetch':
                    return await this.handleDocsFetch(args);
                default:
                    return {
                        success: false,
                        message: `Unknown docs command: ${subCommand}. Available: generate, ingest, search, fetch.`
                    };
            }
        }
        catch (error) {
            return {
                success: false,
                message: `Documentation generation failed: ${error.message}`
            };
        }
    }
    /**
     * Handle docs generate command
     */
    async handleDocsGenerate(docsService) {
        console.log(theme_1.Theme.colors.primary('📚 DOCUMENTATION GENERATION'));
        console.log(theme_1.Theme.colors.info('Generating package-by-package documentation and ADRs...'));
        try {
            const result = await docsService.generateProjectDocumentation(this.context.currentProject.projectPath, (progress, current) => {
                console.log(theme_1.Theme.colors.muted(`   ${progress}% - ${current}`));
            });
            // Display the comprehensive report
            docsService.printDocumentationReport(result.packages, result.adrsGenerated);
            return {
                success: true,
                message: `Documentation generated! ${result.packages.length} packages documented, ${result.adrsGenerated} ADRs created.`,
                data: result
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Documentation generation failed: ${error.message}`
            };
        }
    }
    /**
     * Auto-ingest documentation during project initialization
     */
    async autoIngestDocumentation(projectPath) {
        try {
            const ragService = new documentation_rag_service_1.DocumentationRAGService(this.context.currentProject?.projectId || 'default');
            await ragService.initialize();
            // Common documentation paths to scan
            const commonDocPaths = [
                path.join(projectPath, 'README.md'),
                path.join(projectPath, 'docs'),
                path.join(projectPath, 'documentation'),
                path.join(projectPath, 'CHANGELOG.md'),
                path.join(projectPath, 'API.md'),
                path.join(projectPath, 'CONTRIBUTING.md')
            ];
            const result = await ragService.ingestDocumentationPaths(commonDocPaths);
            if (result.processed > 0) {
                console.log(theme_1.Theme.colors.success(`   ✅ Ingested ${result.processed} documentation files (${result.chunksCreated} chunks)`));
            }
            else {
                console.log(theme_1.Theme.colors.muted('   📝 No documentation files found to ingest'));
            }
            if (result.errors.length > 0) {
                console.log(theme_1.Theme.colors.warning(`   ⚠️  ${result.errors.length} ingestion errors (run "docs ingest --verbose" for details)`));
            }
        }
        catch (error) {
            console.log(theme_1.Theme.colors.warning(`   ⚠️  Documentation ingestion failed: ${error.message}`));
        }
    }
    /**
     * Handle docs ingest command
     */
    async handleDocsIngest(args) {
        if (!this.context.currentProject) {
            return {
                success: false,
                message: 'No project loaded. Run "/init" first.'
            };
        }
        const argParts = args.split(' ').slice(1); // Remove 'ingest'
        const isVerbose = argParts.includes('--verbose') || argParts.includes('-v');
        const internetFlag = argParts.includes('--internet') || argParts.includes('-i');
        const techStackFlag = argParts.find(arg => arg.startsWith('--tech='));
        // Extract paths (everything that's not a flag)
        const paths = argParts.filter(arg => !arg.startsWith('--') && !arg.startsWith('-'));
        console.log(theme_1.Theme.colors.primary('📚 DOCUMENTATION INGESTION'));
        console.log(theme_1.Theme.colors.info('Ingesting documentation into RAG system...'));
        try {
            const ragService = new documentation_rag_service_1.DocumentationRAGService(this.context.currentProject.projectId);
            await ragService.initialize();
            let result = { processed: 0, chunksCreated: 0, errors: [] };
            if (paths.length > 0) {
                // Ingest specified paths
                console.log(theme_1.Theme.colors.info(`🎯 Ingesting from ${paths.length} specified path(s):`));
                paths.forEach(p => console.log(`   • ${p}`));
                result = await ragService.ingestDocumentationPaths(paths);
            }
            else {
                // Auto-discover and ingest common documentation
                const projectPath = this.context.currentProject.projectPath;
                console.log(theme_1.Theme.colors.info('🔍 Auto-discovering documentation files...'));
                await this.autoIngestDocumentation(projectPath);
                return { success: true, message: 'Auto-ingestion completed' };
            }
            // Handle internet documentation fetching
            if (internetFlag) {
                console.log(theme_1.Theme.colors.info('🌐 Fetching documentation from internet sources...'));
                let techStack = [];
                if (techStackFlag) {
                    techStack = techStackFlag.split('=')[1].split(',');
                }
                else {
                    // Auto-detect tech stack from project
                    // TODO: Implement tech stack detection
                    techStack = ['node.js', 'typescript'];
                }
                const internetResult = await ragService.fetchInternetDocumentation(techStack, {
                    includeOfficialDocs: true,
                    includeGuides: true,
                    maxDocumentsPerTech: 5
                });
                console.log(theme_1.Theme.colors.muted(`   Fetched: ${internetResult.fetched}, Ingested: ${internetResult.ingested}`));
                if (internetResult.errors.length > 0 && isVerbose) {
                    internetResult.errors.forEach(error => console.log(theme_1.Theme.colors.error(`   Error: ${error}`)));
                }
            }
            // Display results
            console.log(theme_1.Theme.colors.success(`\n✅ Documentation ingestion completed!`));
            console.log(theme_1.Theme.colors.result(`   📄 Processed: ${result.processed} files`));
            console.log(theme_1.Theme.colors.result(`   🧩 Created: ${result.chunksCreated} chunks`));
            if (result.errors.length > 0) {
                console.log(theme_1.Theme.colors.warning(`   ⚠️  Errors: ${result.errors.length}`));
                if (isVerbose) {
                    result.errors.forEach(error => console.log(theme_1.Theme.colors.error(`   • ${error}`)));
                }
            }
            return {
                success: true,
                message: `Documentation ingested: ${result.processed} files, ${result.chunksCreated} chunks`,
                data: result
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Documentation ingestion failed: ${error.message}`
            };
        }
    }
    /**
     * Handle docs search command
     */
    async handleDocsSearch(args) {
        if (!this.context.currentProject) {
            return {
                success: false,
                message: 'No project loaded. Run "/init" first.'
            };
        }
        const argParts = args.split(' ').slice(1); // Remove 'search'
        const query = argParts.join(' ').replace(/--[\w-]+(=\w+)?/g, '').trim();
        if (!query) {
            return {
                success: false,
                message: 'Please provide a search query. Usage: docs search <query>'
            };
        }
        console.log(theme_1.Theme.colors.primary('🔍 DOCUMENTATION SEARCH'));
        console.log(theme_1.Theme.colors.info(`Searching for: "${query}"`));
        try {
            const ragService = new documentation_rag_service_1.DocumentationRAGService(this.context.currentProject.projectId);
            await ragService.initialize();
            const results = await ragService.searchDocumentation(query, {
                maxResults: 5,
                includeRelated: true
            });
            if (results.length === 0) {
                console.log(theme_1.Theme.colors.warning('📭 No documentation found matching your query'));
                console.log(theme_1.Theme.colors.muted('   Try running "docs ingest" to add documentation to the RAG system'));
                return { success: true, message: 'No results found' };
            }
            console.log(theme_1.Theme.colors.success(`\n📚 Found ${results.length} relevant documentation sections:\n`));
            results.forEach((result, index) => {
                const chunk = result.chunk;
                const score = (result.relevanceScore * 100).toFixed(1);
                console.log(theme_1.Theme.colors.primary(`${index + 1}. ${chunk.title}`));
                console.log(theme_1.Theme.colors.muted(`   📄 ${chunk.filePath} (${chunk.documentType})`));
                console.log(theme_1.Theme.colors.result(`   🎯 Relevance: ${score}% - ${result.matchReason}`));
                console.log(theme_1.Theme.colors.muted(`   📝 ${result.contextSnippet}`));
                if (chunk.metadata.techStack.length > 0) {
                    console.log(theme_1.Theme.colors.muted(`   🔧 Tech: ${chunk.metadata.techStack.join(', ')}`));
                }
                console.log('');
            });
            return {
                success: true,
                message: `Found ${results.length} documentation matches`,
                data: results
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Documentation search failed: ${error.message}`
            };
        }
    }
    /**
     * Handle docs fetch command (internet documentation fetching)
     */
    async handleDocsFetch(args) {
        if (!this.context.currentProject) {
            return {
                success: false,
                message: 'No project loaded. Run "/init" first.'
            };
        }
        const argParts = args.split(' ').slice(1); // Remove 'fetch'
        const techStackArg = argParts.find(arg => arg.startsWith('--tech='));
        if (!techStackArg) {
            return {
                success: false,
                message: 'Please specify tech stack. Usage: docs fetch --tech=nodejs,typescript,react'
            };
        }
        const techStack = techStackArg.split('=')[1].split(',');
        console.log(theme_1.Theme.colors.primary('🌐 INTERNET DOCUMENTATION FETCH'));
        console.log(theme_1.Theme.colors.info(`Fetching documentation for: ${techStack.join(', ')}`));
        try {
            const ragService = new documentation_rag_service_1.DocumentationRAGService(this.context.currentProject.projectId);
            await ragService.initialize();
            const result = await ragService.fetchInternetDocumentation(techStack, {
                includeOfficialDocs: true,
                includeGuides: true,
                maxDocumentsPerTech: 10
            });
            console.log(theme_1.Theme.colors.success(`\n🌐 Internet documentation fetch completed!`));
            console.log(theme_1.Theme.colors.result(`   📥 Fetched: ${result.fetched} documents`));
            console.log(theme_1.Theme.colors.result(`   📚 Ingested: ${result.ingested} documents`));
            if (result.errors.length > 0) {
                console.log(theme_1.Theme.colors.warning(`   ⚠️  Errors: ${result.errors.length}`));
                result.errors.forEach(error => console.log(theme_1.Theme.colors.error(`   • ${error}`)));
            }
            return {
                success: true,
                message: `Fetched ${result.fetched} documents, ingested ${result.ingested}`,
                data: result
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Documentation fetch failed: ${error.message}`
            };
        }
    }
    /**
     * Handle instructions command - mirrors Claude Code's CLAUDE.md functionality
     */
    async handleInstructions(args) {
        const subCommand = args.split(' ')[0] || 'show';
        const projectPath = process.env.CODEMIND_USER_CWD || process.cwd();
        try {
            switch (subCommand) {
                case 'show':
                case 'view':
                    return await this.handleInstructionsShow(projectPath);
                case 'create':
                case 'init':
                    return await this.handleInstructionsCreate(projectPath);
                case 'edit':
                    return await this.handleInstructionsEdit(projectPath);
                case 'reload':
                case 'refresh':
                    return await this.handleInstructionsReload(projectPath);
                default:
                    return {
                        success: false,
                        message: `Unknown instructions command: ${subCommand}. Use "show", "create", "edit", or "reload".`
                    };
            }
        }
        catch (error) {
            return {
                success: false,
                message: `Instructions command failed: ${error.message}`
            };
        }
    }
    /**
     * Show current project instructions
     */
    async handleInstructionsShow(projectPath) {
        console.log(theme_1.Theme.colors.primary('📋 PROJECT INSTRUCTIONS'));
        console.log(theme_1.Theme.colors.secondary('═'.repeat(60)));
        try {
            const instructions = await this.context.instructionService.loadProjectInstructions(projectPath);
            if (!instructions.hasInstructions) {
                console.log(theme_1.Theme.colors.warning('\n⚠ No CODEMIND.md instructions found'));
                console.log(theme_1.Theme.colors.muted('Run "/instructions create" to generate a sample CODEMIND.md file'));
                return {
                    success: true,
                    message: 'No instructions found'
                };
            }
            console.log(theme_1.Theme.colors.info(`\n📋 Found ${instructions.instructions.length} instruction sources:`));
            instructions.instructions.forEach(inst => {
                const emoji = inst.source === 'global' ? '🌐' :
                    inst.source === 'project' ? '📁' :
                        inst.source === 'directory' ? '📂' : '⚙️';
                console.log(`   ${emoji} ${inst.source}: ${inst.path}`);
            });
            console.log(theme_1.Theme.colors.info('\n📄 COMBINED INSTRUCTIONS:'));
            console.log(theme_1.Theme.colors.secondary('-'.repeat(60)));
            console.log(instructions.combinedContent);
            return {
                success: true,
                message: `Loaded ${instructions.instructions.length} instruction files`,
                data: instructions
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to load instructions: ${error.message}`
            };
        }
    }
    /**
     * Create sample CODEMIND.md file
     */
    async handleInstructionsCreate(projectPath) {
        console.log(theme_1.Theme.colors.primary('📋 CREATE CODEMIND.MD'));
        console.log(theme_1.Theme.colors.info('Creating sample CODEMIND.md file...'));
        try {
            await this.context.instructionService.createSampleInstructions(projectPath);
            console.log(theme_1.Theme.colors.success('\n✅ Sample CODEMIND.md created!'));
            console.log(theme_1.Theme.colors.muted('Edit the file to customize instructions for your project'));
            return {
                success: true,
                message: 'Sample CODEMIND.md created successfully'
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to create instructions: ${error.message}`
            };
        }
    }
    /**
     * Edit instructions file (opens in default editor)
     */
    async handleInstructionsEdit(projectPath) {
        const instructionsPath = path.join(projectPath, 'CODEMIND.md');
        try {
            // Check if file exists
            try {
                await require('fs/promises').access(instructionsPath);
            }
            catch {
                console.log(theme_1.Theme.colors.warning('⚠ CODEMIND.md not found. Creating sample file...'));
                await this.context.instructionService.createSampleInstructions(projectPath);
            }
            // Open in default editor
            const command = process.platform === 'win32' ? 'start' :
                process.platform === 'darwin' ? 'open' : 'xdg-open';
            await execAsync(`${command} "${instructionsPath}"`);
            console.log(theme_1.Theme.colors.success(`✅ Opened CODEMIND.md in default editor`));
            console.log(theme_1.Theme.colors.muted(`File: ${instructionsPath}`));
            return {
                success: true,
                message: 'CODEMIND.md opened in editor'
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to edit instructions: ${error.message}`
            };
        }
    }
    /**
     * Reload instructions cache
     */
    async handleInstructionsReload(projectPath) {
        console.log(theme_1.Theme.colors.primary('🔄 RELOAD INSTRUCTIONS'));
        console.log(theme_1.Theme.colors.info('Clearing cache and reloading instructions...'));
        try {
            this.context.instructionService.clearCache();
            const instructions = await this.context.instructionService.loadProjectInstructions(projectPath);
            console.log(theme_1.Theme.colors.success(`\n✅ Instructions reloaded!`));
            if (instructions.hasInstructions) {
                console.log(theme_1.Theme.colors.muted(`   Found ${instructions.instructions.length} instruction sources`));
            }
            else {
                console.log(theme_1.Theme.colors.muted('   No instructions found'));
            }
            return {
                success: true,
                message: 'Instructions cache reloaded',
                data: instructions
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to reload instructions: ${error.message}`
            };
        }
    }
    /**
     * Handle sync command for semantic search and graph consistency
     */
    async handleSync(args) {
        if (!this.context.currentProject) {
            return {
                success: false,
                message: 'No project loaded. Run "/init" first.'
            };
        }
        const parts = args.trim().split(/\s+/);
        const subCommand = parts[0] || 'run';
        try {
            switch (subCommand) {
                case 'run':
                case 'start':
                    return await this.handleSyncRun(args.replace(subCommand, '').trim());
                case 'check':
                    return await this.handleSyncCheck();
                case 'force':
                    return await this.handleSyncForce();
                case 'status':
                    return await this.handleSyncStatus();
                case 'watch':
                case 'watcher':
                    return await this.handleSyncWatcher(args.replace(subCommand, '').trim());
                default:
                    return {
                        success: false,
                        message: `Unknown sync command: ${subCommand}. Available: run, check, force, status, watch`
                    };
            }
        }
        catch (error) {
            return {
                success: false,
                message: `Sync failed: ${error.message}`
            };
        }
    }
    /**
     * Run intelligent sync with options
     */
    async handleSyncRun(args) {
        const projectPath = this.context.currentProject?.projectPath || process.cwd();
        // Parse sync options
        const forceFullSync = args.includes('--force') || args.includes('-f');
        const skipEmbeddings = args.includes('--no-embeddings');
        const skipGraph = args.includes('--no-graph');
        const useIntelligent = !args.includes('--no-intelligent');
        console.log(theme_1.Theme.colors.primary('🔄 Starting intelligent sync...'));
        try {
            // Use intelligent sync if enabled and not forcing full sync
            if (useIntelligent && !forceFullSync) {
                console.log(theme_1.Theme.colors.info('🧠 Using Redis-based intelligent sync detection...'));
                return await this.intelligentSyncProject(this.context.currentProject, projectPath);
            }
            // Fallback to traditional sync
            console.log(theme_1.Theme.colors.info('📊 Running traditional full sync...'));
            const progressCallback = (progress, current) => {
                console.log(theme_1.Theme.colors.muted(`   [${Math.round(progress)}%] ${current}`));
            };
            // Wrap in interruptible operation
            const result = await this.context.interruptManager.wrapInterruptible('sync-run', 'Syncing semantic search and graph data', async () => {
                return await this.syncManager.syncProject(projectPath, {
                    forceFullSync,
                    updateEmbeddings: !skipEmbeddings,
                    updateGraph: !skipGraph,
                    maxConcurrency: 5
                });
            });
            if (result) {
                const duration = Math.round(result.duration / 1000 * 100) / 100;
                console.log(theme_1.Theme.colors.success(`✅ Sync completed in ${duration}s:`));
                console.log(theme_1.Theme.colors.muted(`   • ${result.totalFiles} total files`));
                console.log(theme_1.Theme.colors.muted(`   • ${result.newFiles} new files`));
                console.log(theme_1.Theme.colors.muted(`   • ${result.changedFiles} modified files`));
                console.log(theme_1.Theme.colors.muted(`   • ${result.deletedFiles} deleted files`));
                console.log(theme_1.Theme.colors.muted(`   • ${result.updatedEmbeddings} embeddings updated`));
                console.log(theme_1.Theme.colors.muted(`   • ${result.updatedGraphNodes} graph nodes updated`));
                console.log(theme_1.Theme.colors.muted(`   • Strategy: ${result.strategy}`));
                return {
                    success: true,
                    message: `Sync completed successfully`,
                    data: result
                };
            }
            else {
                return {
                    success: false,
                    message: 'Sync was interrupted'
                };
            }
        }
        catch (error) {
            return {
                success: false,
                message: `Sync failed: ${error.message}`
            };
        }
    }
    /**
     * Quick sync check
     */
    async handleSyncCheck() {
        const projectPath = this.context.currentProject?.projectPath || process.cwd();
        console.log(theme_1.Theme.colors.info('🔍 Performing quick sync check...'));
        try {
            const isInSync = await this.syncManager.quickSyncCheck(projectPath);
            if (isInSync) {
                return {
                    success: true,
                    message: 'Semantic data is up to date'
                };
            }
            else {
                return {
                    success: true,
                    message: 'Changes detected - consider running "/sync run"'
                };
            }
        }
        catch (error) {
            return {
                success: false,
                message: `Sync check failed: ${error.message}`
            };
        }
    }
    /**
     * Force full sync
     */
    async handleSyncForce() {
        return await this.handleSyncRun('--force');
    }
    /**
     * Show sync status
     */
    async handleSyncStatus() {
        if (!this.context.currentProject) {
            return {
                success: false,
                message: 'No project loaded. Run "/init" first.'
            };
        }
        try {
            const { FileHashTracker } = await Promise.resolve().then(() => __importStar(require('../../shared/file-hash-tracker')));
            const hashTracker = new FileHashTracker();
            // Get Redis-based sync statistics
            const syncStats = await hashTracker.getSyncStats(this.context.currentProject.projectId);
            const metadata = await hashTracker.getSyncMetadata(this.context.currentProject.projectId);
            // Show sync status
            console.log(theme_1.Theme.colors.info('📊 Intelligent Sync Status:'));
            console.log(theme_1.Theme.colors.muted(`   Tracked files: ${syncStats.totalTrackedFiles}`));
            console.log(theme_1.Theme.colors.muted(`   With embeddings: ${syncStats.componentStats.withEmbeddings}`));
            console.log(theme_1.Theme.colors.muted(`   With graph data: ${syncStats.componentStats.withGraph}`));
            console.log(theme_1.Theme.colors.muted(`   With analysis: ${syncStats.componentStats.withAnalysis}`));
            if (syncStats.lastSyncTime) {
                const lastSync = new Date(syncStats.lastSyncTime);
                const timeSince = Math.round((Date.now() - syncStats.lastSyncTime) / (1000 * 60));
                console.log(theme_1.Theme.colors.muted(`   Last sync: ${lastSync.toLocaleString()} (${timeSince} minutes ago)`));
            }
            else {
                console.log(theme_1.Theme.colors.muted('   Last sync: Never'));
            }
            if (syncStats.syncStrategy) {
                console.log(theme_1.Theme.colors.muted(`   Last strategy: ${syncStats.syncStrategy}`));
            }
            // Show quick recommendation
            const projectFiles = await this.scanProjectFiles(this.context.currentProject.projectPath);
            const recommendation = await hashTracker.analyzeSyncNeeds(this.context.currentProject.projectId, projectFiles, { mode: 'incremental', timeThreshold: 24 });
            console.log(theme_1.Theme.colors.info('\n🔍 Sync Recommendation:'));
            if (recommendation.shouldSync) {
                console.log(theme_1.Theme.colors.warning(`   ⚠️  Sync recommended: ${recommendation.reason}`));
                console.log(theme_1.Theme.colors.muted(`   Changed files: ${recommendation.stats.changedFiles}`));
                console.log(theme_1.Theme.colors.muted(`   New files: ${recommendation.stats.newFiles}`));
                console.log(theme_1.Theme.colors.muted(`   Run "/sync run" to synchronize`));
            }
            else {
                console.log(theme_1.Theme.colors.success(`   ✅ Project is up to date`));
            }
            // Show file watcher status
            const watcherStatus = this.fileWatcher.getStatus();
            console.log(theme_1.Theme.colors.info('\n👁️  File Watcher Status:'));
            console.log(theme_1.Theme.colors.muted(`   Active: ${watcherStatus.isWatching ? 'Yes' : 'No'}`));
            console.log(theme_1.Theme.colors.muted(`   Watched paths: ${watcherStatus.watchedPaths.length}`));
            console.log(theme_1.Theme.colors.muted(`   Pending changes: ${watcherStatus.pendingChanges}`));
            console.log(theme_1.Theme.colors.muted(`   Auto-sync: ${watcherStatus.options.autoSync ? 'enabled' : 'disabled'}`));
            return {
                success: true,
                message: 'Sync status displayed'
            };
        }
        catch (error) {
            console.error(theme_1.Theme.colors.error(`❌ Failed to get sync status: ${error.message}`));
            return {
                success: false,
                message: `Failed to get sync status: ${error.message}`
            };
        }
    }
    /**
     * Handle file watcher commands
     */
    async handleSyncWatcher(args) {
        const parts = args.trim().split(/\s+/);
        const subCommand = parts[0] || 'status';
        try {
            switch (subCommand) {
                case 'start':
                case 'enable':
                    return await this.handleWatcherStart();
                case 'stop':
                case 'disable':
                    return await this.handleWatcherStop();
                case 'status':
                    return await this.handleWatcherStatus();
                case 'restart':
                    await this.handleWatcherStop();
                    return await this.handleWatcherStart();
                default:
                    return {
                        success: false,
                        message: `Unknown watcher command: ${subCommand}. Available: start, stop, status, restart`
                    };
            }
        }
        catch (error) {
            return {
                success: false,
                message: `Watcher command failed: ${error.message}`
            };
        }
    }
    /**
     * Start file watcher
     */
    async handleWatcherStart() {
        const projectPath = this.context.currentProject?.projectPath || process.cwd();
        try {
            await this.fileWatcher.startWatching(projectPath);
            return {
                success: true,
                message: 'File watcher started'
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to start watcher: ${error.message}`
            };
        }
    }
    /**
     * Stop file watcher
     */
    async handleWatcherStop() {
        try {
            await this.fileWatcher.stopWatching();
            return {
                success: true,
                message: 'File watcher stopped'
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to stop watcher: ${error.message}`
            };
        }
    }
    /**
     * Show file watcher status
     */
    async handleWatcherStatus() {
        const status = this.fileWatcher.getStatus();
        console.log(theme_1.Theme.colors.info('👁️  File Watcher Status:'));
        console.log(theme_1.Theme.colors.muted(`   Active: ${status.isWatching ? 'Yes' : 'No'}`));
        if (status.watchedPaths.length > 0) {
            console.log(theme_1.Theme.colors.muted('   Watched paths:'));
            status.watchedPaths.forEach(path => {
                console.log(theme_1.Theme.colors.muted(`     • ${path}`));
            });
        }
        console.log(theme_1.Theme.colors.muted(`   Pending changes: ${status.pendingChanges}`));
        console.log(theme_1.Theme.colors.muted(`   Auto-sync: ${status.options.autoSync ? 'enabled' : 'disabled'}`));
        console.log(theme_1.Theme.colors.muted(`   Debounce: ${status.options.debounceMs}ms`));
        console.log(theme_1.Theme.colors.muted(`   Sync delay: ${status.options.syncDelayMs}ms`));
        return {
            success: true,
            message: 'Watcher status displayed'
        };
    }
    /**
     * Enhance query with assumption detection information for Claude Code
     */
    enhanceQueryForClaudeCode(originalQuery, analysis) {
        if (!analysis.hasAmbiguities) {
            return originalQuery + '\n\nNote: No significant assumptions detected in this request.';
        }
        return this.assumptionDetector.generatePromptEnhancement(analysis) + originalQuery;
    }
    /**
     * Check if Claude Code response includes assumptions and display them
     */
    checkClaudeCodeAssumptions(responseData) {
        try {
            // Try to parse response data for assumptions field
            let assumptions = [];
            if (responseData && typeof responseData === 'object') {
                if (responseData.assumptions && Array.isArray(responseData.assumptions)) {
                    assumptions = responseData.assumptions;
                }
                else if (typeof responseData === 'string') {
                    // Try to parse JSON from string response
                    try {
                        const parsed = JSON.parse(responseData);
                        if (parsed.assumptions && Array.isArray(parsed.assumptions)) {
                            assumptions = parsed.assumptions;
                        }
                    }
                    catch {
                        // Not JSON, check for assumption markers in text
                        if (responseData.toLowerCase().includes('assumption')) {
                            console.log(theme_1.Theme.colors.info('\n💭 Claude Code made assumptions - check the response for details'));
                            return;
                        }
                    }
                }
            }
            if (assumptions.length > 0) {
                console.log(theme_1.Theme.colors.info('\n💭 Claude Code reported these assumptions:'));
                assumptions.forEach((assumption, index) => {
                    console.log(theme_1.Theme.colors.muted(`${index + 1}. ${assumption}`));
                });
            }
        }
        catch (error) {
            // Silently fail - this is just helpful feedback
        }
    }
}
exports.CommandProcessor = CommandProcessor;
//# sourceMappingURL=command-processor.js.map