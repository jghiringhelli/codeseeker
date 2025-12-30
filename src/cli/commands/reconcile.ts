/**
 * Reconciliation CLI Command
 * 
 * Provides command-line interface for database reconciliation operations
 */

import { Command } from 'commander';
import { ReconciliationSystem, ReconciliationHelpers } from '../../shared/reconciliation-system';
import { Logger, LogLevel } from '../../utils/logger';
import path from 'path';

const logger = new Logger(LogLevel.INFO, 'ReconcileCLI');

export function createReconcileCommand(): Command {
  const reconcileCmd = new Command('reconcile');
  
  reconcileCmd
    .description('Reconcile database with current codebase state')
    .argument('[project-path]', 'Path to project (defaults to current directory)', process.cwd())
    .option('-p, --project-id <id>', 'Project ID (will attempt to auto-detect if not provided)')
    .option('-s, --scope <scope>', 'Reconciliation scope: full, incremental, selective', 'incremental')
    .option('-t, --tools <tools>', 'Comma-separated list of specific tools (for selective scope)')
    .option('-h, --hours <hours>', 'Hours to look back for incremental reconciliation', '24')
    .option('-d, --dry-run', 'Preview changes without applying them', false)
    .option('-v, --verbose', 'Verbose output', false)
    .action(async (projectPath: string, options) => {
      try {
        if (options.verbose) {
          logger.setLevel('debug');
        }

        const resolvedProjectPath = path.resolve(projectPath);
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
          options.tools.split(',').map((t: string) => t.trim()) : 
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
        const reconciler = new ReconciliationSystem();

        switch (options.scope) {
          case 'full':
            result = await ReconciliationHelpers.fullReconciliation(
              resolvedProjectPath, 
              projectId, 
              options.dryRun
            );
            break;

          case 'incremental':
            const hours = parseInt(options.hours);
            if (isNaN(hours) || hours <= 0) {
              console.error('❌ Invalid hours value. Must be a positive number.');
              process.exit(1);
            }
            result = await ReconciliationHelpers.incrementalReconciliation(
              resolvedProjectPath,
              projectId,
              hours,
              options.dryRun
            );
            break;

          case 'selective':
            result = await ReconciliationHelpers.selectiveReconciliation(
              resolvedProjectPath,
              projectId,
              targetTools!,
              options.dryRun
            );
            break;

          default:
            result = await reconciler.reconcile({
              projectPath: resolvedProjectPath,
              projectId,
              scope: options.scope as any,
              targetTools,
              dryRun: options.dryRun
            });
        }

        // Display results
        displayReconciliationResults(result, options.verbose);

      } catch (error) {
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
async function getProjectId(projectPath: string, providedId?: string): Promise<string | null> {
  if (providedId) {
    return providedId;
  }

  // Try to get from database by path
  try {
    const { toolDB } = await import('../../orchestrator/tool-database-api');
    const projects = await toolDB.query(
      'SELECT id FROM projects WHERE project_path = $1 LIMIT 1',
      [projectPath]
    );
    
    if (projects.rows.length > 0) {
      return projects.rows[0].id;
    }
  } catch (error) {
    logger.warn(`Could not query database for project ID: ${error}`);
  }

  // Try to generate from path (simple hash-based approach)
  const crypto = await import('crypto');
  const pathHash = crypto.createHash('md5').update(projectPath).digest('hex');
  logger.info(`Generated project ID from path: ${pathHash.substring(0, 8)}`);
  
  return null; // For now, require explicit project ID
}

/**
 * Display reconciliation results in a formatted way
 */
function displayReconciliationResults(result: any, verbose: boolean = false): void {
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
      .filter((d: any) => d.action === 'error')
      .forEach((error: any) => {
        console.log(`   ${error.toolName}: ${error.reason}`);
      });
  }

  if (verbose && result.details.length > 0) {
    console.log('\n🔍 Detailed Actions:');
    result.details.forEach((detail: any) => {
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
    } else {
      console.log(`\n✅ Reconciliation completed successfully!`);
      if (result.summary.updatesApplied > 0) {
        console.log(`   Applied ${result.summary.updatesApplied} updates to synchronize database with codebase.`);
      } else {
        console.log(`   Database is already in sync with codebase.`);
      }
    }
  } else {
    console.log(`\n⚠️  Reconciliation completed with ${result.summary.errorsEncountered} errors.`);
    console.log(`   ${result.summary.updatesApplied} updates were still applied successfully.`);
  }
}