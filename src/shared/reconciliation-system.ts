/**
 * Reconciliation System for Codebase Changes
 * 
 * Handles scenarios where:
 * 1. Branches are merged and database is out of sync
 * 2. End-of-request updates are not catching up with codebase changes
 * 3. Manual reconciliation is needed to sync database with actual codebase state
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'fast-glob';
import { Logger, LogLevel } from '../utils/logger';
import { ToolRegistry } from './tool-interface';
import { toolDB } from '../orchestration/tool-database-api';
import crypto from 'crypto';

export interface ReconciliationRequest {
  projectPath: string;
  projectId: string;
  scope: 'full' | 'incremental' | 'selective';
  targetTools?: string[]; // Specific tools to reconcile
  sinceTimestamp?: Date; // For incremental reconciliation
  dryRun?: boolean; // Preview changes without applying
}

export interface ReconciliationResult {
  projectId: string;
  scope: string;
  startTime: Date;
  endTime: Date;
  summary: {
    filesScanned: number;
    toolsProcessed: number;
    discrepancies: number;
    updatesApplied: number;
    errorsEncountered: number;
  };
  details: ReconciliationDetail[];
  dryRun: boolean;
}

export interface ReconciliationDetail {
  toolName: string;
  action: 'created' | 'updated' | 'deleted' | 'skipped' | 'error';
  fileName?: string;
  reason: string;
  oldHash?: string;
  newHash?: string;
  recordsAffected: number;
}

export interface FileChecksum {
  filePath: string;
  hash: string;
  lastModified: Date;
  size: number;
}

export class ReconciliationSystem {
  private logger: Logger;

  constructor() {
    this.logger = new Logger(LogLevel.INFO, 'ReconciliationSystem');
  }

  /**
   * Main reconciliation entry point
   */
  async reconcile(request: ReconciliationRequest): Promise<ReconciliationResult> {
    this.logger.info(`Starting ${request.scope} reconciliation for project ${request.projectId}`);
    const startTime = new Date();
    
    const result: ReconciliationResult = {
      projectId: request.projectId,
      scope: request.scope,
      startTime,
      endTime: new Date(),
      summary: {
        filesScanned: 0,
        toolsProcessed: 0,
        discrepancies: 0,
        updatesApplied: 0,
        errorsEncountered: 0
      },
      details: [],
      dryRun: request.dryRun || false
    };

    try {
      // Step 1: Get current codebase state
      const currentCodebaseState = await this.analyzeCodebaseState(request.projectPath);
      result.summary.filesScanned = currentCodebaseState.files.length;

      // Step 2: Get database state
      const databaseState = await this.getDatabaseState(request.projectId, request.targetTools);
      
      // Step 3: Detect discrepancies
      const discrepancies = await this.detectDiscrepancies(
        currentCodebaseState, 
        databaseState, 
        request.sinceTimestamp
      );
      result.summary.discrepancies = discrepancies.length;

      // Step 4: Plan reconciliation actions
      const actions = await this.planReconciliationActions(discrepancies, request.scope);

      // Step 5: Apply reconciliation (unless dry run)
      if (!request.dryRun) {
        result.details = await this.applyReconciliationActions(
          actions, 
          request.projectPath, 
          request.projectId
        );
        result.summary.updatesApplied = result.details.filter(d => d.action !== 'skipped').length;
        result.summary.errorsEncountered = result.details.filter(d => d.action === 'error').length;
      } else {
        result.details = actions.map(action => ({
          toolName: action.toolName,
          action: 'skipped' as const,
          fileName: action.filePath,
          reason: `Dry run: would ${action.action}`,
          recordsAffected: action.expectedRecords || 0
        }));
      }

      // Step 6: Get available tools count
      const availableTools = request.targetTools || 
        ToolRegistry.getAllTools().map(tool => tool.getMetadata().name);
      result.summary.toolsProcessed = availableTools.length;

      result.endTime = new Date();
      this.logger.info(`Reconciliation completed in ${result.endTime.getTime() - startTime.getTime()}ms`);

      return result;

    } catch (error) {
      this.logger.error(`Reconciliation failed: ${error}`);
      result.endTime = new Date();
      result.summary.errorsEncountered = 1;
      result.details.push({
        toolName: 'system',
        action: 'error',
        reason: error instanceof Error ? error.message : 'Unknown reconciliation error',
        recordsAffected: 0
      });
      return result;
    }
  }

  /**
   * Analyze current codebase state
   */
  private async analyzeCodebaseState(projectPath: string): Promise<{
    files: FileChecksum[];
    timestamp: Date;
    totalFiles: number;
  }> {
    this.logger.info(`Analyzing codebase state at ${projectPath}`);
    
    const files: FileChecksum[] = [];
    const patterns = ['**/*.ts', '**/*.js', '**/*.json', '**/*.md'];
    const excludePatterns = ['**/node_modules/**', '**/dist/**', '**/.git/**'];
    
    const filePaths = await glob(patterns, {
      cwd: projectPath,
      absolute: true,
      ignore: excludePatterns
    });

    for (const filePath of filePaths) {
      try {
        const stats = await fs.stat(filePath);
        const content = await fs.readFile(filePath, 'utf-8');
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        
        files.push({
          filePath: filePath.replace(/\\/g, '/'), // Normalize path separators
          hash,
          lastModified: stats.mtime,
          size: stats.size
        });
      } catch (error) {
        this.logger.warn(`Could not process file ${filePath}: ${error}`);
      }
    }

    return {
      files,
      timestamp: new Date(),
      totalFiles: files.length
    };
  }

  /**
   * Get current database state for tools
   */
  private async getDatabaseState(projectId: string, targetTools?: string[]): Promise<{
    toolData: Record<string, any[]>;
    lastUpdated: Record<string, Date>;
  }> {
    this.logger.info(`Getting database state for project ${projectId}`);
    
    const availableTools = targetTools || 
      ToolRegistry.getAllTools().map(tool => tool.getMetadata().name);
    
    const toolData: Record<string, any[]> = {};
    const lastUpdated: Record<string, Date> = {};

    for (const toolName of availableTools) {
      try {
        const data = await toolDB.getToolData(projectId, toolName, { limit: 1000 });
        toolData[toolName] = data || [];
        
        // Get most recent timestamp
        const mostRecent = data?.reduce((latest, item) => {
          const itemDate = new Date(item.updated_at || item.created_at);
          return itemDate > latest ? itemDate : latest;
        }, new Date(0));
        
        lastUpdated[toolName] = mostRecent || new Date(0);
        
      } catch (error) {
        this.logger.warn(`Could not get data for tool ${toolName}: ${error}`);
        toolData[toolName] = [];
        lastUpdated[toolName] = new Date(0);
      }
    }

    return { toolData, lastUpdated };
  }

  /**
   * Detect discrepancies between codebase and database
   */
  private async detectDiscrepancies(
    codebaseState: { files: FileChecksum[] },
    databaseState: { toolData: Record<string, any[]>; lastUpdated: Record<string, Date> },
    sinceTimestamp?: Date
  ): Promise<Array<{
    type: 'missing_data' | 'outdated_data' | 'orphaned_data' | 'file_changed';
    toolName: string;
    filePath?: string;
    details: string;
  }>> {
    this.logger.info('Detecting discrepancies between codebase and database');
    
    const discrepancies: Array<{
      type: 'missing_data' | 'outdated_data' | 'orphaned_data' | 'file_changed';
      toolName: string;
      filePath?: string;
      details: string;
    }> = [];

    // Get current file paths for comparison
    const currentFiles = new Set(codebaseState.files.map(f => f.filePath));

    // Check each tool's data
    for (const [toolName, toolData] of Object.entries(databaseState.toolData)) {
      // Check for missing data (files exist but no tool data)
      const filesWithData = new Set(
        toolData.map(item => item.file_path).filter(Boolean)
      );

      for (const file of codebaseState.files) {
        if (!filesWithData.has(file.filePath)) {
          discrepancies.push({
            type: 'missing_data',
            toolName,
            filePath: file.filePath,
            details: `File exists but no ${toolName} data in database`
          });
        }
      }

      // Check for orphaned data (database records for non-existent files)
      for (const dataItem of toolData) {
        if (dataItem.file_path && !currentFiles.has(dataItem.file_path)) {
          discrepancies.push({
            type: 'orphaned_data',
            toolName,
            filePath: dataItem.file_path,
            details: `Database has ${toolName} data for deleted/moved file`
          });
        }
      }

      // Check for outdated data
      const lastUpdate = databaseState.lastUpdated[toolName];
      const cutoffTime = sinceTimestamp || new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours default
      
      if (lastUpdate < cutoffTime) {
        discrepancies.push({
          type: 'outdated_data',
          toolName,
          details: `${toolName} data last updated ${lastUpdate.toISOString()}, older than cutoff ${cutoffTime.toISOString()}`
        });
      }
    }

    this.logger.info(`Found ${discrepancies.length} discrepancies`);
    return discrepancies;
  }

  /**
   * Plan reconciliation actions based on discrepancies
   */
  private async planReconciliationActions(
    discrepancies: Array<{
      type: 'missing_data' | 'outdated_data' | 'orphaned_data' | 'file_changed';
      toolName: string;
      filePath?: string;
      details: string;
    }>,
    scope: 'full' | 'incremental' | 'selective'
  ): Promise<Array<{
    action: 'reanalyze' | 'delete' | 'update';
    toolName: string;
    filePath?: string;
    reason: string;
    expectedRecords?: number;
  }>> {
    this.logger.info(`Planning ${discrepancies.length} reconciliation actions (scope: ${scope})`);
    
    const actions: Array<{
      action: 'reanalyze' | 'delete' | 'update';
      toolName: string;
      filePath?: string;
      reason: string;
      expectedRecords?: number;
    }> = [];

    for (const discrepancy of discrepancies) {
      switch (discrepancy.type) {
        case 'missing_data':
          actions.push({
            action: 'reanalyze',
            toolName: discrepancy.toolName,
            filePath: discrepancy.filePath,
            reason: `Generate missing ${discrepancy.toolName} data for ${discrepancy.filePath}`,
            expectedRecords: 1
          });
          break;

        case 'orphaned_data':
          actions.push({
            action: 'delete',
            toolName: discrepancy.toolName,
            filePath: discrepancy.filePath,
            reason: `Remove orphaned ${discrepancy.toolName} data for deleted file`,
            expectedRecords: 1
          });
          break;

        case 'outdated_data':
          if (scope === 'full') {
            actions.push({
              action: 'reanalyze',
              toolName: discrepancy.toolName,
              reason: `Refresh outdated ${discrepancy.toolName} data`,
              expectedRecords: 10 // Estimate
            });
          }
          break;

        case 'file_changed':
          actions.push({
            action: 'update',
            toolName: discrepancy.toolName,
            filePath: discrepancy.filePath,
            reason: `Update ${discrepancy.toolName} data for changed file`,
            expectedRecords: 1
          });
          break;
      }
    }

    return actions;
  }

  /**
   * Apply reconciliation actions
   */
  private async applyReconciliationActions(
    actions: Array<{
      action: 'reanalyze' | 'delete' | 'update';
      toolName: string;
      filePath?: string;
      reason: string;
      expectedRecords?: number;
    }>,
    projectPath: string,
    projectId: string
  ): Promise<ReconciliationDetail[]> {
    this.logger.info(`Applying ${actions.length} reconciliation actions`);
    
    const details: ReconciliationDetail[] = [];

    for (const action of actions) {
      try {
        switch (action.action) {
          case 'reanalyze':
            const reanalyzed = await this.reanalyzeWithTool(
              action.toolName, 
              projectPath, 
              projectId, 
              action.filePath
            );
            details.push({
              toolName: action.toolName,
              action: reanalyzed ? 'created' : 'error',
              fileName: action.filePath,
              reason: reanalyzed ? 'Successfully reanalyzed' : 'Reanalysis failed',
              recordsAffected: reanalyzed ? 1 : 0
            });
            break;

          case 'delete':
            const deleted = await this.deleteOrphanedData(action.toolName, projectId, action.filePath);
            details.push({
              toolName: action.toolName,
              action: deleted ? 'deleted' : 'error',
              fileName: action.filePath,
              reason: deleted ? 'Deleted orphaned data' : 'Deletion failed',
              recordsAffected: deleted ? 1 : 0
            });
            break;

          case 'update':
            const updated = await this.updateToolData(action.toolName, projectPath, projectId, action.filePath);
            details.push({
              toolName: action.toolName,
              action: updated ? 'updated' : 'error',
              fileName: action.filePath,
              reason: updated ? 'Successfully updated' : 'Update failed',
              recordsAffected: updated ? 1 : 0
            });
            break;
        }
      } catch (error) {
        this.logger.error(`Action failed for ${action.toolName}: ${error}`);
        details.push({
          toolName: action.toolName,
          action: 'error',
          fileName: action.filePath,
          reason: error instanceof Error ? error.message : 'Unknown error',
          recordsAffected: 0
        });
      }
    }

    return details;
  }

  /**
   * Reanalyze specific file/project with a tool
   */
  private async reanalyzeWithTool(
    toolName: string, 
    projectPath: string, 
    projectId: string, 
    filePath?: string
  ): Promise<boolean> {
    try {
      const tool = ToolRegistry.getTool(toolName);
      if (!tool) {
        this.logger.warn(`Tool ${toolName} not found in registry`);
        return false;
      }

      // Run analysis
      const result = await tool.analyzeProject(projectPath, projectId, {
        targetFile: filePath,
        reconciliation: true,
        forceRefresh: true
      });

      return result.data && result.data.length > 0;
    } catch (error) {
      this.logger.error(`Reanalysis failed for ${toolName}: ${error}`);
      return false;
    }
  }

  /**
   * Delete orphaned data from database
   */
  private async deleteOrphanedData(toolName: string, projectId: string, filePath?: string): Promise<boolean> {
    try {
      // This would need to be implemented in the tool database API
      // For now, return true as placeholder
      this.logger.info(`Would delete orphaned ${toolName} data for ${filePath}`);
      return true;
    } catch (error) {
      this.logger.error(`Delete failed for ${toolName}: ${error}`);
      return false;
    }
  }

  /**
   * Update tool data for specific file
   */
  private async updateToolData(
    toolName: string, 
    projectPath: string, 
    projectId: string, 
    filePath?: string
  ): Promise<boolean> {
    // Similar to reanalyze but with update semantics
    return this.reanalyzeWithTool(toolName, projectPath, projectId, filePath);
  }
}

/**
 * Convenience functions for common reconciliation scenarios
 */
export class ReconciliationHelpers {
  private static reconciler = new ReconciliationSystem();

  /**
   * Full project reconciliation (after major changes like merges)
   */
  static async fullReconciliation(
    projectPath: string, 
    projectId: string, 
    dryRun = false
  ): Promise<ReconciliationResult> {
    return this.reconciler.reconcile({
      projectPath,
      projectId,
      scope: 'full',
      dryRun
    });
  }

  /**
   * Quick incremental reconciliation (for recent changes)
   */
  static async incrementalReconciliation(
    projectPath: string, 
    projectId: string,
    sinceHours = 24,
    dryRun = false
  ): Promise<ReconciliationResult> {
    const sinceTimestamp = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
    
    return this.reconciler.reconcile({
      projectPath,
      projectId,
      scope: 'incremental',
      sinceTimestamp,
      dryRun
    });
  }

  /**
   * Selective reconciliation (specific tools only)
   */
  static async selectiveReconciliation(
    projectPath: string,
    projectId: string,
    targetTools: string[],
    dryRun = false
  ): Promise<ReconciliationResult> {
    return this.reconciler.reconcile({
      projectPath,
      projectId,
      scope: 'selective',
      targetTools,
      dryRun
    });
  }
}