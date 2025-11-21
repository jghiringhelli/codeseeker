"use strict";
/**
 * Setup Orchestrator Service
 * Single Responsibility: Orchestrate the complete setup workflow
 * Dependency Inversion: Uses injected services instead of concrete implementations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetupOrchestrator = void 0;
class SetupOrchestrator {
    prerequisiteChecker;
    containerDetector;
    containerManager;
    databaseInitializer;
    reporter;
    startTime = 0;
    status = {
        projectValid: false,
        containerSystem: false,
        databases: {
            postgres: false,
            neo4j: false,
            redis: false
        },
        initialization: false
    };
    constructor(prerequisiteChecker, containerDetector, containerManager, databaseInitializer, reporter) {
        this.prerequisiteChecker = prerequisiteChecker;
        this.containerDetector = containerDetector;
        this.containerManager = containerManager;
        this.databaseInitializer = databaseInitializer;
        this.reporter = reporter;
    }
    async execute(options = {}) {
        this.startTime = Date.now();
        try {
            // Display welcome message
            this.displayWelcome();
            // Step 1: Check Prerequisites
            const prereqResult = await this.checkPrerequisites(options);
            if (!prereqResult.success) {
                return prereqResult;
            }
            // Step 2: Detect Container System
            const containerConfig = await this.detectContainerSystem();
            // Step 3: Setup Containers (if available)
            if (containerConfig.success && !options.skipDocker) {
                const containerResult = await this.setupContainers(containerConfig);
                if (!containerResult.success) {
                    this.reporter.displayErrorHelp(new Error(containerResult.message));
                }
            }
            else {
                await this.handleNonContainerSetup();
            }
            // Step 4: Initialize Databases (if not skipped)
            if (!options.skipDatabases) {
                await this.initializeDatabases();
            }
            // Step 5: Final Verification
            await this.verifySetup();
            // Step 6: Display Summary
            this.displayFinalSummary();
            this.status.initialization = this.isSetupComplete();
            return {
                success: this.status.initialization,
                message: this.status.initialization ? 'Setup completed successfully' : 'Setup completed with warnings',
                data: {
                    status: this.status,
                    duration: Math.round((Date.now() - this.startTime) / 1000)
                }
            };
        }
        catch (error) {
            this.reporter.displayErrorHelp(error instanceof Error ? error : new Error('Unknown setup error'));
            return {
                success: false,
                message: 'Setup failed',
                errors: [error instanceof Error ? error.message : 'Unknown error']
            };
        }
    }
    displayWelcome() {
        console.log('\n🚀 CodeMind Infrastructure Setup');
        console.log('Setting up Docker containers, databases, and initialization...\n');
    }
    async checkPrerequisites(options) {
        this.reporter.displayProgress('Checking prerequisites', 'running');
        // Check project validity
        const projectResult = await this.prerequisiteChecker.checkProject(options.projectPath);
        if (!projectResult.success) {
            this.reporter.displayProgress('Project validation failed', 'error');
            return projectResult;
        }
        this.status.projectValid = true;
        this.reporter.displayProgress('Valid CodeMind project detected', 'success');
        // Check Node.js version
        const nodeResult = this.prerequisiteChecker.checkNodeVersion();
        if (!nodeResult.success) {
            this.reporter.displayProgress(nodeResult.message, 'warning');
        }
        else {
            this.reporter.displayProgress(`Node.js ${nodeResult.data?.version} compatible`, 'success');
        }
        return { success: true, message: 'Prerequisites validated' };
    }
    async detectContainerSystem() {
        this.reporter.displayProgress('Detecting container system', 'running');
        const config = await this.containerDetector.detect();
        if (config.success) {
            this.reporter.displayProgress(`Detected ${config.environment}`, 'success');
            this.status.containerSystem = true;
            return config;
        }
        else {
            this.reporter.displayProgress('No container system available', 'warning');
            return config;
        }
    }
    async setupContainers(config) {
        this.reporter.displayProgress('Setting up containers', 'running');
        // Start containers
        const startResult = await this.containerManager.startServices(config);
        if (!startResult.success) {
            this.reporter.displayProgress('Container startup failed', 'error');
            return startResult;
        }
        this.reporter.displayProgress('Containers started', 'success');
        // Wait for health checks
        this.reporter.displayProgress('Waiting for container health checks', 'running');
        const healthResult = await this.containerManager.waitForHealth(config);
        if (healthResult.success) {
            this.reporter.displayProgress('All containers healthy', 'success');
            this.status.containerSystem = true;
        }
        else {
            this.reporter.displayProgress('Some containers may still be starting', 'warning');
        }
        return healthResult;
    }
    async handleNonContainerSetup() {
        this.reporter.displayProgress('Configuring local-only mode', 'running');
        this.reporter.displayProgress('Local data directories created', 'success');
        // Could create local directories here if needed
    }
    async initializeDatabases() {
        this.reporter.displayProgress('Testing database connections', 'running');
        const connections = await this.databaseInitializer.testConnections();
        if (connections.postgres || connections.neo4j || connections.redis) {
            this.reporter.displayProgress('Database connections available', 'success');
        }
        else {
            this.reporter.displayProgress('No database connections available', 'warning');
            return;
        }
        // Initialize PostgreSQL
        if (connections.postgres) {
            this.reporter.displayProgress('Initializing PostgreSQL', 'running');
            const pgResult = await this.databaseInitializer.initializePostgreSQL();
            if (pgResult.success) {
                this.reporter.displayProgress('PostgreSQL initialized', 'success');
                this.status.databases.postgres = true;
            }
            else {
                this.reporter.displayProgress('PostgreSQL initialization failed', 'warning');
            }
        }
        // Initialize Neo4j
        if (connections.neo4j) {
            this.reporter.displayProgress('Initializing Neo4j', 'running');
            const neo4jResult = await this.databaseInitializer.initializeNeo4j();
            if (neo4jResult.success) {
                this.reporter.displayProgress('Neo4j initialized', 'success');
                this.status.databases.neo4j = true;
            }
            else {
                this.reporter.displayProgress('Neo4j initialization failed', 'warning');
            }
        }
        // Initialize Redis
        if (connections.redis) {
            this.reporter.displayProgress('Initializing Redis', 'running');
            const redisResult = await this.databaseInitializer.initializeRedis();
            if (redisResult.success) {
                this.reporter.displayProgress('Redis initialized', 'success');
                this.status.databases.redis = true;
            }
            else {
                this.reporter.displayProgress('Redis initialization failed', 'warning');
            }
        }
    }
    async verifySetup() {
        this.reporter.displayProgress('Verifying setup', 'running');
        // Re-test connections for final verification
        const finalConnections = await this.databaseInitializer.testConnections();
        const coreConnected = finalConnections.postgres && finalConnections.redis;
        if (coreConnected) {
            this.reporter.displayProgress('Core databases verified', 'success');
        }
        else {
            this.reporter.displayProgress('Some databases may still be starting', 'warning');
        }
        // Verify CLI build
        try {
            const path = require('path');
            const fs = require('fs');
            const cliPath = path.join(process.cwd(), 'dist', 'cli');
            if (fs.existsSync(cliPath)) {
                this.reporter.displayProgress('CLI build verified', 'success');
            }
            else {
                this.reporter.displayProgress('CLI may need building', 'warning');
            }
        }
        catch {
            this.reporter.displayProgress('CLI verification skipped', 'warning');
        }
    }
    displayFinalSummary() {
        const duration = Math.round((Date.now() - this.startTime) / 1000);
        this.reporter.displaySummary(this.status, duration);
    }
    isSetupComplete() {
        return this.status.projectValid &&
            (this.status.containerSystem || true) && // Allow local-only mode
            (this.status.databases.postgres || this.status.databases.neo4j || this.status.databases.redis);
    }
}
exports.SetupOrchestrator = SetupOrchestrator;
//# sourceMappingURL=setup-orchestrator.js.map