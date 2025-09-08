"use strict";
/**
 * Reconciliation CLI Command
 *
 * Provides command-line interface for database reconciliation operations
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReconcileCommand = createReconcileCommand;
const commander_1 = require("commander");
const reconciliation_system_1 = require("../../shared/reconciliation-system");
const logger_1 = require("../../utils/logger");
const path_1 = __importDefault(require("path"));
const logger = new logger_1.Logger(logger_1.LogLevel.INFO, 'ReconcileCLI');
function createReconcileCommand() {
    const reconcileCmd = new commander_1.Command('reconcile');
    reconcileCmd
        .description('Reconcile database with current codebase state')
        .argument('[project-path]', 'Path to project (defaults to current directory)', process.cwd())
        .option('-p, --project-id <id>', 'Project ID (will attempt to auto-detect if not provided)')
        .option('-s, --scope <scope>', 'Reconciliation scope: full, incremental, selective', 'incremental')
        .option('-t, --tools <tools>', 'Comma-separated list of specific tools (for selective scope)')
        .option('-h, --hours <hours>', 'Hours to look back for incremental reconciliation', '24')
        .option('-d, --dry-run', 'Preview changes without applying them', false)
        .option('-v, --verbose', 'Verbose output', false)
        .action(async (projectPath, options) => {
        try {
            if (options.verbose) {
                logger.setLevel('debug');
            }
            const resolvedProjectPath = path_1.default.resolve(projectPath);
            logger.info(`Starting reconciliation for project at: ${resolvedProjectPath}`);
            // Auto-detect or validate project ID
            const projectId = await getProjectId(resolvedProjectPath, options.projectId);
            if (!projectId) {
                console.error('❌ Could not determine project ID. Use --project-id or ensure project is initialized.');
                process.exit(1);
            }
            logger.info(`Using project ID: ${projectId}`);
            // Validate scope
            const validScopes = ['full', 'incremental', 'selective'];
            if (!validScopes.includes(options.scope)) {
                console.error(`❌ Invalid scope: ${options.scope}. Must be one of: ${validScopes.join(', ')}`);
                process.exit(1);
            }
            // Parse tools for selective reconciliation
            const targetTools = options.tools ?
                options.tools.split(',').map((t) => t.trim()) :
                undefined;
            if (options.scope === 'selective' && !targetTools) {
                console.error('❌ Selective reconciliation requires --tools parameter');
                process.exit(1);
            }
            // Start reconciliation
            console.log(`🔄 Starting ${options.scope} reconciliation...`);
            if (options.dryRun) {
                console.log('🔍 DRY RUN MODE - No changes will be applied');
            }
            let result;
            const reconciler = new reconciliation_system_1.ReconciliationSystem();
            switch (options.scope) {
                case 'full':
                    result = await reconciliation_system_1.ReconciliationHelpers.fullReconciliation(resolvedProjectPath, projectId, options.dryRun);
                    break;
                case 'incremental':
                    const hours = parseInt(options.hours);
                    if (isNaN(hours) || hours <= 0) {
                        console.error('❌ Invalid hours value. Must be a positive number.');
                        process.exit(1);
                    }
                    result = await reconciliation_system_1.ReconciliationHelpers.incrementalReconciliation(resolvedProjectPath, projectId, hours, options.dryRun);
                    break;
                case 'selective':
                    result = await reconciliation_system_1.ReconciliationHelpers.selectiveReconciliation(resolvedProjectPath, projectId, targetTools, options.dryRun);
                    break;
                default:
                    result = await reconciler.reconcile({
                        projectPath: resolvedProjectPath,
                        projectId,
                        scope: options.scope,
                        targetTools,
                        dryRun: options.dryRun
                    });
            }
            // Display results
            displayReconciliationResults(result, options.verbose);
        }
        catch (error) {
            logger.error(`Reconciliation failed: ${error}`);
            console.error(`❌ Reconciliation failed: ${error instanceof Error ? error.message : error}`);
            process.exit(1);
        }
    });
    return reconcileCmd;
}
/**
 * Attempt to get project ID from various sources
 */
async function getProjectId(projectPath, providedId) {
    if (providedId) {
        return providedId;
    }
    // Try to get from database by path
    try {
        const { toolDB } = await Promise.resolve().then(() => __importStar(require('../../orchestration/tool-database-api')));
        const projects = await toolDB.query('SELECT id FROM projects WHERE project_path = $1 LIMIT 1', [projectPath]);
        if (projects.rows.length > 0) {
            return projects.rows[0].id;
        }
    }
    catch (error) {
        logger.warn(`Could not query database for project ID: ${error}`);
    }
    // Try to generate from path (simple hash-based approach)
    const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
    const pathHash = crypto.createHash('md5').update(projectPath).digest('hex');
    logger.info(`Generated project ID from path: ${pathHash.substring(0, 8)}`);
    return null; // For now, require explicit project ID
}
/**
 * Display reconciliation results in a formatted way
 */
function displayReconciliationResults(result, verbose = false) {
    console.log('\n📊 Reconciliation Results:');
    console.log(`   Project ID: ${result.projectId}`);
    console.log(`   Scope: ${result.scope}`);
    console.log(`   Duration: ${result.endTime.getTime() - result.startTime.getTime()}ms`);
    console.log(`   Dry Run: ${result.dryRun ? 'Yes' : 'No'}`);
    console.log('\n📈 Summary:');
    console.log(`   Files Scanned: ${result.summary.filesScanned}`);
    console.log(`   Tools Processed: ${result.summary.toolsProcessed}`);
    console.log(`   Discrepancies Found: ${result.summary.discrepancies}`);
    console.log(`   Updates Applied: ${result.summary.updatesApplied}`);
    console.log(`   Errors Encountered: ${result.summary.errorsEncountered}`);
    if (result.summary.errorsEncountered > 0) {
        console.log('\n⚠️  Errors occurred during reconciliation:');
        result.details
            .filter((d) => d.action === 'error')
            .forEach((error) => {
            console.log(`   ${error.toolName}: ${error.reason}`);
        });
    }
    if (verbose && result.details.length > 0) {
        console.log('\n🔍 Detailed Actions:');
        result.details.forEach((detail) => {
            const icon = {
                created: '✅',
                updated: '🔄',
                deleted: '🗑️',
                skipped: '⏭️',
                error: '❌'
            }[detail.action] || '❓';
            console.log(`   ${icon} ${detail.toolName}: ${detail.reason}`);
            if (detail.fileName) {
                console.log(`      File: ${detail.fileName}`);
            }
            if (detail.recordsAffected > 0) {
                console.log(`      Records: ${detail.recordsAffected}`);
            }
        });
    }
    // Success/completion message
    if (result.summary.errorsEncountered === 0) {
        if (result.dryRun) {
            console.log('\n🔍 Dry run completed successfully. No changes were applied.');
            if (result.summary.discrepancies > 0) {
                console.log(`   Run without --dry-run to apply ${result.summary.discrepancies} changes.`);
            }
        }
        else {
            console.log(`\n✅ Reconciliation completed successfully!`);
            if (result.summary.updatesApplied > 0) {
                console.log(`   Applied ${result.summary.updatesApplied} updates to synchronize database with codebase.`);
            }
            else {
                console.log(`   Database is already in sync with codebase.`);
            }
        }
    }
    else {
        console.log(`\n⚠️  Reconciliation completed with ${result.summary.errorsEncountered} errors.`);
        console.log(`   ${result.summary.updatesApplied} updates were still applied successfully.`);
    }
}
//# sourceMappingURL=reconcile.js.map