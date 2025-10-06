"use strict";
/**
 * DatabaseHealthService - Manages database health checks and automatic recovery
 * Single Responsibility: Database health monitoring and recovery
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
exports.DatabaseHealthService = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const path = __importStar(require("path"));
const theme_1 = require("../ui/theme");
const database_config_1 = require("../../config/database-config");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
// Import the existing Docker detector
const { DockerDetector } = require(path.join(__dirname, '../../../scripts/helpers/docker-detector'));
class DatabaseHealthService {
    connections;
    checkTimeouts = {
        postgresql: 5000,
        redis: 5000,
        neo4j: 5000
    };
    constructor() {
        this.connections = new database_config_1.DatabaseConnections();
    }
    /**
     * Check health of all databases with timeout protection
     */
    async checkDatabaseHealth(requirements = {}) {
        const status = {
            postgresql: { available: false },
            redis: { available: false },
            neo4j: { available: false }
        };
        // Default to checking all databases if no specific requirements
        const toCheck = {
            postgresql: requirements.postgresql !== false,
            redis: requirements.redis !== false,
            neo4j: requirements.neo4j !== false
        };
        // Check PostgreSQL
        if (toCheck.postgresql) {
            status.postgresql = await this.checkPostgreSQL();
        }
        // Check Redis
        if (toCheck.redis) {
            status.redis = await this.checkRedis();
        }
        // Check Neo4j
        if (toCheck.neo4j) {
            status.neo4j = await this.checkNeo4j();
        }
        return status;
    }
    /**
     * Check PostgreSQL health with timeout
     */
    async checkPostgreSQL() {
        try {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('PostgreSQL check timed out')), this.checkTimeouts.postgresql);
            });
            await Promise.race([
                (async () => {
                    const client = await this.connections.getPostgresConnection();
                    await client.query('SELECT 1');
                    return true;
                })(),
                timeoutPromise
            ]);
            return { available: true };
        }
        catch (error) {
            return {
                available: false,
                error: error.message || 'PostgreSQL connection failed'
            };
        }
    }
    /**
     * Check Redis health with timeout
     */
    async checkRedis() {
        let client = null;
        try {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Redis check timed out')), this.checkTimeouts.redis);
            });
            const result = await Promise.race([
                (async () => {
                    try {
                        client = await this.connections.getRedisConnection();
                        await client.ping();
                        return true;
                    }
                    catch (connError) {
                        // Clean connection error message
                        const errorMsg = connError.message || 'Redis connection failed';
                        if (errorMsg.includes('ECONNREFUSED')) {
                            throw new Error('Redis is not running');
                        }
                        else if (errorMsg.includes('connect ETIMEDOUT')) {
                            throw new Error('Redis connection timed out');
                        }
                        throw connError;
                    }
                })(),
                timeoutPromise
            ]);
            return { available: true };
        }
        catch (error) {
            // Clean up the client if it was created
            if (client) {
                try {
                    await client.quit();
                }
                catch {
                    // Ignore cleanup errors
                }
            }
            return {
                available: false,
                error: error.message || 'Redis connection failed'
            };
        }
    }
    /**
     * Check Neo4j health with timeout
     */
    async checkNeo4j() {
        try {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Neo4j check timed out')), this.checkTimeouts.neo4j);
            });
            await Promise.race([
                (async () => {
                    const driver = await this.connections.getNeo4jConnection();
                    const session = driver.session();
                    try {
                        await session.run('RETURN 1');
                    }
                    finally {
                        await session.close();
                    }
                    return true;
                })(),
                timeoutPromise
            ]);
            return { available: true };
        }
        catch (error) {
            return {
                available: false,
                error: error.message || 'Neo4j connection failed'
            };
        }
    }
    /**
     * Attempt to restart databases using Docker Compose
     */
    async restartDatabases(services = ['postgres', 'redis', 'neo4j']) {
        console.log(theme_1.Theme.colors.warning('🔄 Attempting to restart database services...'));
        try {
            // Use the Docker detector to find the right Docker environment
            const dockerDetector = new DockerDetector();
            const dockerConfig = await dockerDetector.detect();
            if (!dockerConfig.success) {
                console.log(theme_1.Theme.colors.error('❌ Docker not available'));
                console.log(theme_1.Theme.colors.warning('Please ensure Docker/Rancher Desktop is running and try again'));
                return false;
            }
            console.log(theme_1.Theme.colors.info(`🐳 Using ${dockerConfig.environment} with ${dockerConfig.composeCommand}`));
            // Find the docker-compose.yml file
            const projectRoot = process.cwd();
            const composeFile = path.join(projectRoot, 'docker-compose.yml');
            const fs = require('fs');
            if (!fs.existsSync(composeFile)) {
                console.log(theme_1.Theme.colors.error('❌ docker-compose.yml not found in project root'));
                console.log(theme_1.Theme.colors.info(`Expected location: ${composeFile}`));
                return false;
            }
            // Try to start services using the detected compose command
            console.log(theme_1.Theme.colors.info('Starting database containers...'));
            for (const service of services) {
                try {
                    // Map service names to docker-compose service names
                    const dockerServiceName = service === 'postgres' ? 'database' : service;
                    const command = `${dockerConfig.composeCommand} -f "${composeFile}" up -d ${dockerServiceName}`;
                    console.log(theme_1.Theme.colors.muted(`  Running: ${command}`));
                    const { stdout, stderr } = await execAsync(command, {
                        cwd: projectRoot,
                        timeout: 30000,
                        env: { ...process.env }
                    });
                    // Check if service was started or already running
                    if (stdout.includes('Started') || stdout.includes('Running') || stdout.includes('up-to-date')) {
                        console.log(theme_1.Theme.colors.success(`  ✓ ${service} is running`));
                    }
                    else if (stderr && !stderr.includes('WARNING')) {
                        console.log(theme_1.Theme.colors.warning(`  ⚠ ${service}: ${stderr}`));
                    }
                    else {
                        console.log(theme_1.Theme.colors.success(`  ✓ Started ${service}`));
                    }
                }
                catch (error) {
                    // Check if it's just already running
                    if (error.message.includes('already in use') || error.message.includes('already exists')) {
                        console.log(theme_1.Theme.colors.success(`  ✓ ${service} is already running`));
                    }
                    else if (error.message.includes('The system cannot find the file specified') ||
                        error.message.includes('dockerDesktopLinuxEngine')) {
                        console.log(theme_1.Theme.colors.error(`  ✗ Docker is not running - please start Docker/Rancher Desktop`));
                        // Exit early if Docker isn't running
                        return false;
                    }
                    else {
                        console.log(theme_1.Theme.colors.error(`  ✗ Failed to start ${service}: ${error.message}`));
                    }
                }
            }
            // Wait for services to be ready
            console.log(theme_1.Theme.colors.info('Waiting for services to be ready...'));
            await this.waitForDatabases(services, 30000);
            return true;
        }
        catch (error) {
            console.log(theme_1.Theme.colors.error(`Failed to restart databases: ${error.message}`));
            return false;
        }
    }
    /**
     * Wait for databases to become available
     */
    async waitForDatabases(services, maxWaitMs = 30000) {
        const startTime = Date.now();
        const checkInterval = 2000;
        let checkCount = 0;
        while (Date.now() - startTime < maxWaitMs) {
            checkCount++;
            // Show progress
            if (checkCount % 3 === 0) {
                const elapsed = Math.round((Date.now() - startTime) / 1000);
                console.log(theme_1.Theme.colors.muted(`  Checking... (${elapsed}s elapsed)`));
            }
            const status = await this.checkDatabaseHealth();
            let allReady = true;
            let notReady = [];
            for (const service of services) {
                const serviceKey = service === 'postgres' ? 'postgresql' : service;
                if (serviceKey in status && !status[serviceKey].available) {
                    allReady = false;
                    notReady.push(service);
                }
            }
            if (allReady) {
                console.log(theme_1.Theme.colors.success('✓ All database services are ready'));
                return true;
            }
            // If we've been waiting for more than 15 seconds, show what's still not ready
            if (Date.now() - startTime > 15000 && checkCount % 3 === 0) {
                console.log(theme_1.Theme.colors.warning(`  Still waiting for: ${notReady.join(', ')}`));
            }
            await new Promise(resolve => setTimeout(resolve, checkInterval));
        }
        console.log(theme_1.Theme.colors.warning('⚠ Timeout waiting for database services'));
        // Show final status
        const finalStatus = await this.checkDatabaseHealth();
        console.log(theme_1.Theme.colors.info('Final database status:'));
        this.displayDatabaseStatus(finalStatus);
        return false;
    }
    /**
     * Check if database tables are initialized
     */
    async checkDatabaseTables() {
        try {
            const client = await this.connections.getPostgresConnection();
            const requiredTables = [
                'projects',
                'semantic_search_embeddings',
                'analysis_results',
                'tool_configurations'
            ];
            const result = await client.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = ANY($1)
      `, [requiredTables]);
            const existingTables = result.rows.map((r) => r.table_name);
            const missingTables = requiredTables.filter(t => !existingTables.includes(t));
            return {
                initialized: missingTables.length === 0,
                missingTables
            };
        }
        catch (error) {
            return {
                initialized: false,
                missingTables: ['Unable to check - database connection failed']
            };
        }
    }
    /**
     * Initialize database tables
     */
    async initializeDatabaseTables() {
        try {
            console.log(theme_1.Theme.colors.info('📋 Initializing database tables...'));
            // Run the setup script
            const { stdout, stderr } = await execAsync('node scripts/setup-complete.js', {
                cwd: process.cwd(),
                timeout: 60000
            });
            if (stderr && !stderr.includes('warning')) {
                throw new Error(stderr);
            }
            console.log(theme_1.Theme.colors.success('✓ Database tables initialized'));
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                error: error.message || 'Failed to initialize database tables'
            };
        }
    }
    /**
     * Ensure databases are available and initialized
     */
    async ensureDatabasesReady(requirements = {}) {
        console.log(theme_1.Theme.colors.info('🔍 Checking database availability...'));
        // Step 1: Check current database health
        let status = await this.checkDatabaseHealth(requirements);
        // Step 2: Display status
        this.displayDatabaseStatus(status);
        // Step 3: If any required database is down, attempt restart
        const needsRestart = this.checkIfRestartNeeded(status, requirements);
        if (needsRestart.length > 0) {
            console.log(theme_1.Theme.colors.warning(`⚠ Some database services are not available: ${needsRestart.join(', ')}`));
            const restarted = await this.restartDatabases(needsRestart);
            if (restarted) {
                // Recheck status after restart
                status = await this.checkDatabaseHealth(requirements);
                this.displayDatabaseStatus(status);
            }
            else {
                console.log(theme_1.Theme.colors.error('❌ Failed to restart database services'));
                console.log(theme_1.Theme.colors.info('Please ensure Docker/Rancher Desktop is running and try again'));
                return false;
            }
        }
        // Step 4: Check if tables are initialized
        if (status.postgresql.available) {
            const tableCheck = await this.checkDatabaseTables();
            if (!tableCheck.initialized) {
                console.log(theme_1.Theme.colors.warning('⚠ Database tables not initialized'));
                console.log(theme_1.Theme.colors.muted(`  Missing tables: ${tableCheck.missingTables?.join(', ')}`));
                // Offer to initialize
                console.log(theme_1.Theme.colors.info('Run "/setup" to initialize database tables'));
                return false;
            }
        }
        return true;
    }
    /**
     * Display database status
     */
    displayDatabaseStatus(status) {
        console.log(theme_1.Theme.colors.primary('Database Status:'));
        Object.entries(status).forEach(([db, info]) => {
            const statusIcon = info.available ? '✓' : '✗';
            const statusColor = info.available ? theme_1.Theme.colors.success : theme_1.Theme.colors.error;
            const errorMsg = info.error ? ` - ${info.error}` : '';
            console.log(`  ${statusColor(statusIcon)} ${db}${errorMsg}`);
        });
    }
    /**
     * Check which databases need restart
     */
    checkIfRestartNeeded(status, requirements) {
        const needsRestart = [];
        if (requirements.postgresql !== false && !status.postgresql.available) {
            needsRestart.push('postgres');
        }
        if (requirements.redis !== false && !status.redis.available) {
            needsRestart.push('redis');
        }
        if (requirements.neo4j !== false && !status.neo4j.available) {
            needsRestart.push('neo4j');
        }
        return needsRestart;
    }
    /**
     * Clean up connections
     */
    async cleanup() {
        await this.connections.closeAll();
    }
}
exports.DatabaseHealthService = DatabaseHealthService;
exports.default = DatabaseHealthService;
//# sourceMappingURL=database-health-service.js.map