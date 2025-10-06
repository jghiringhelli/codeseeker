/**
 * Deduplication Service
 * Identifies and manages duplicate code at method and class level
 * Uses granular embeddings for intelligent similarity detection
 */

import { Logger } from '../../utils/logger';
import { GranularEmbeddingService, SimilarityResult, MethodEmbedding, ClassEmbedding } from './granular-embedding-service';
import { CodeRelationshipParser } from './code-relationship-parser';
import { SemanticGraphService } from './semantic-graph';
import { Theme } from '../ui/theme';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface DuplicateGroup {
  type: 'method' | 'class';
  primary: DuplicateItem;
  duplicates: DuplicateItem[];
  similarityScore: number;
  confidence: 'high' | 'medium' | 'low';
  mergeStrategy: 'exact' | 'similar' | 'refactor';
}

export interface DuplicateItem {
  id: string;
  name: string;
  filePath: string;
  content: string;
  startLine: number;
  endLine: number;
  metadata: any;
}

export interface DeduplicationReport {
  projectId: string;
  totalMethods: number;
  totalClasses: number;
  duplicateGroups: DuplicateGroup[];
  potentialSavings: {
    linesOfCode: number;
    filesAffected: number;
    estimatedEffort: string;
  };
  summary: {
    exactDuplicates: number;
    similarDuplicates: number;
    refactorCandidates: number;
  };
}

export interface MergeAction {
  action: 'merge' | 'extract' | 'skip';
  sourceId: string;
  targetId: string;
  newName?: string;
  newLocation?: string;
}

export class DeduplicationService {
  private logger: Logger;
  private granularEmbedding: GranularEmbeddingService;
  private codeParser: CodeRelationshipParser;
  private semanticGraph: SemanticGraphService;

  constructor() {
    this.logger = Logger.getInstance();
    this.granularEmbedding = new GranularEmbeddingService();
    this.codeParser = new CodeRelationshipParser();
    this.semanticGraph = new SemanticGraphService();
  }

  /**
   * Generate comprehensive deduplication report
   */
  async generateDeduplicationReport(
    projectId: string,
    progressCallback?: (progress: number, status: string) => void
  ): Promise<DeduplicationReport> {
    this.logger.info(`🔍 Starting deduplication analysis for project: ${projectId}`);

    progressCallback?.(0, 'Initializing analysis...');

    const duplicateGroups: DuplicateGroup[] = [];
    let totalMethods = 0;
    let totalClasses = 0;

    try {
      // First, ensure we have granular embeddings
      progressCallback?.(10, 'Checking granular embeddings...');
      await this.ensureGranularEmbeddings(projectId);

      // Get all methods and classes from the project
      progressCallback?.(20, 'Retrieving methods and classes...');
      const { methods, classes } = await this.getAllMethodsAndClasses(projectId);
      totalMethods = methods.length;
      totalClasses = classes.length;

      this.logger.info(`Found ${totalMethods} methods and ${totalClasses} classes`);

      // Analyze method duplicates
      progressCallback?.(30, 'Analyzing method duplicates...');
      const methodDuplicates = await this.findMethodDuplicates(projectId, methods);
      duplicateGroups.push(...methodDuplicates);

      // Analyze class duplicates
      progressCallback?.(60, 'Analyzing class duplicates...');
      const classDuplicates = await this.findClassDuplicates(projectId, classes);
      duplicateGroups.push(...classDuplicates);

      // Calculate potential savings
      progressCallback?.(90, 'Calculating potential savings...');
      const potentialSavings = this.calculatePotentialSavings(duplicateGroups);

      progressCallback?.(100, 'Analysis complete');

      const report: DeduplicationReport = {
        projectId,
        totalMethods,
        totalClasses,
        duplicateGroups,
        potentialSavings,
        summary: {
          exactDuplicates: duplicateGroups.filter(g => g.confidence === 'high').length,
          similarDuplicates: duplicateGroups.filter(g => g.confidence === 'medium').length,
          refactorCandidates: duplicateGroups.filter(g => g.confidence === 'low').length
        }
      };

      this.logger.info(`✅ Deduplication analysis complete: found ${duplicateGroups.length} duplicate groups`);
      return report;

    } catch (error) {
      this.logger.error('❌ Deduplication analysis failed:', error);
      throw error;
    }
  }

  /**
   * Find method duplicates using similarity analysis
   */
  private async findMethodDuplicates(
    projectId: string,
    methods: any[]
  ): Promise<DuplicateGroup[]> {
    const duplicateGroups: DuplicateGroup[] = [];
    const processedMethods = new Set<string>();

    for (const method of methods) {
      if (processedMethods.has(method.method_id)) continue;

      // Find similar methods
      const similarMethods = await this.granularEmbedding.findSimilarMethods(
        projectId,
        method.method_id,
        0.7, // Lower threshold to catch more potential duplicates
        10
      );

      if (similarMethods.length > 0) {
        const group = await this.createDuplicateGroup('method', method, similarMethods);
        if (group) {
          duplicateGroups.push(group);

          // Mark all methods in this group as processed
          processedMethods.add(method.method_id);
          group.duplicates.forEach(dup => processedMethods.add(dup.id));
        }
      }
    }

    return duplicateGroups;
  }

  /**
   * Find class duplicates using similarity analysis
   */
  private async findClassDuplicates(
    projectId: string,
    classes: any[]
  ): Promise<DuplicateGroup[]> {
    const duplicateGroups: DuplicateGroup[] = [];
    const processedClasses = new Set<string>();

    for (const classItem of classes) {
      if (processedClasses.has(classItem.class_id)) continue;

      // Find similar classes
      const similarClasses = await this.granularEmbedding.findSimilarClasses(
        projectId,
        classItem.class_id,
        0.7, // Lower threshold to catch more potential duplicates
        10
      );

      if (similarClasses.length > 0) {
        const group = await this.createDuplicateGroup('class', classItem, similarClasses);
        if (group) {
          duplicateGroups.push(group);

          // Mark all classes in this group as processed
          processedClasses.add(classItem.class_id);
          group.duplicates.forEach(dup => processedClasses.add(dup.id));
        }
      }
    }

    return duplicateGroups;
  }

  /**
   * Create a duplicate group from similar items
   */
  private async createDuplicateGroup(
    type: 'method' | 'class',
    primary: any,
    similarItems: SimilarityResult[]
  ): Promise<DuplicateGroup | null> {
    try {
      // Filter out low-similarity items
      const highSimilarity = similarItems.filter(item => item.similarity >= 0.9);
      const mediumSimilarity = similarItems.filter(item => item.similarity >= 0.8 && item.similarity < 0.9);
      const lowSimilarity = similarItems.filter(item => item.similarity >= 0.7 && item.similarity < 0.8);

      let duplicates: DuplicateItem[] = [];
      let confidence: 'high' | 'medium' | 'low';
      let mergeStrategy: 'exact' | 'similar' | 'refactor';
      let avgSimilarity: number;

      if (highSimilarity.length > 0) {
        duplicates = await this.convertToeDuplicateItems(highSimilarity);
        confidence = 'high';
        mergeStrategy = 'exact';
        avgSimilarity = highSimilarity.reduce((sum, item) => sum + item.similarity, 0) / highSimilarity.length;
      } else if (mediumSimilarity.length > 0) {
        duplicates = await this.convertToeDuplicateItems(mediumSimilarity);
        confidence = 'medium';
        mergeStrategy = 'similar';
        avgSimilarity = mediumSimilarity.reduce((sum, item) => sum + item.similarity, 0) / mediumSimilarity.length;
      } else if (lowSimilarity.length > 0) {
        duplicates = await this.convertToeDuplicateItems(lowSimilarity);
        confidence = 'low';
        mergeStrategy = 'refactor';
        avgSimilarity = lowSimilarity.reduce((sum, item) => sum + item.similarity, 0) / lowSimilarity.length;
      } else {
        return null; // No significant duplicates found
      }

      const primaryItem: DuplicateItem = {
        id: type === 'method' ? primary.method_id : primary.class_id,
        name: type === 'method' ? primary.method_name : primary.class_name,
        filePath: primary.file_path,
        content: primary.content,
        startLine: JSON.parse(primary.metadata).startLine || 1,
        endLine: JSON.parse(primary.metadata).endLine || 1,
        metadata: JSON.parse(primary.metadata)
      };

      return {
        type,
        primary: primaryItem,
        duplicates,
        similarityScore: avgSimilarity,
        confidence,
        mergeStrategy
      };

    } catch (error) {
      this.logger.error('Failed to create duplicate group:', error);
      return null;
    }
  }

  /**
   * Convert similarity results to duplicate items
   */
  private async convertToeDuplicateItems(similarItems: SimilarityResult[]): Promise<DuplicateItem[]> {
    return similarItems.map(item => {
      const target = item.target as any;
      return {
        id: item.targetId,
        name: target.methodName || target.className,
        filePath: target.filePath,
        content: target.content,
        startLine: target.metadata?.startLine || 1,
        endLine: target.metadata?.endLine || 1,
        metadata: target.metadata
      };
    });
  }

  /**
   * Print detailed deduplication report
   */
  printDeduplicationReport(report: DeduplicationReport): void {
    console.log(Theme.colors.primary('\n🔍 CODE DEDUPLICATION ANALYSIS REPORT'));
    console.log(Theme.colors.secondary('═'.repeat(60)));

    // Summary statistics
    console.log(Theme.colors.info(`\n📊 PROJECT SUMMARY:`));
    console.log(`   Project ID: ${report.projectId}`);
    console.log(`   Total Methods: ${Theme.colors.accent(report.totalMethods.toString())}`);
    console.log(`   Total Classes: ${Theme.colors.accent(report.totalClasses.toString())}`);

    // Duplicate summary
    console.log(Theme.colors.info(`\n🎯 DUPLICATE SUMMARY:`));
    console.log(`   Exact Duplicates: ${Theme.colors.success(report.summary.exactDuplicates.toString())}`);
    console.log(`   Similar Duplicates: ${Theme.colors.warning(report.summary.similarDuplicates.toString())}`);
    console.log(`   Refactor Candidates: ${Theme.colors.muted(report.summary.refactorCandidates.toString())}`);
    console.log(`   Total Groups: ${Theme.colors.accent(report.duplicateGroups.length.toString())}`);

    // Potential savings
    console.log(Theme.colors.info(`\n💰 POTENTIAL SAVINGS:`));
    console.log(`   Lines of Code: ${Theme.colors.success(report.potentialSavings.linesOfCode.toString())}`);
    console.log(`   Files Affected: ${Theme.colors.accent(report.potentialSavings.filesAffected.toString())}`);
    console.log(`   Estimated Effort: ${Theme.colors.muted(report.potentialSavings.estimatedEffort)}`);

    // Detailed duplicate groups
    if (report.duplicateGroups.length > 0) {
      console.log(Theme.colors.info(`\n📋 DETAILED DUPLICATE GROUPS:`));
      console.log(Theme.colors.secondary('─'.repeat(60)));

      report.duplicateGroups.forEach((group, index) => {
        const confidenceColor = group.confidence === 'high' ? Theme.colors.success :
                               group.confidence === 'medium' ? Theme.colors.warning :
                               Theme.colors.muted;

        console.log(`\n${index + 1}. ${Theme.colors.accent(group.type.toUpperCase())} DUPLICATE GROUP`);
        console.log(`   Confidence: ${confidenceColor(group.confidence)} (${(group.similarityScore * 100).toFixed(1)}%)`);
        console.log(`   Strategy: ${Theme.colors.muted(group.mergeStrategy)}`);

        // Primary item
        console.log(`   📍 Primary: ${Theme.colors.primary(group.primary.name)}`);
        console.log(`      File: ${group.primary.filePath}:${group.primary.startLine}-${group.primary.endLine}`);

        // Duplicates
        group.duplicates.forEach((dup, dupIndex) => {
          console.log(`   📄 Duplicate ${dupIndex + 1}: ${Theme.colors.accent(dup.name)}`);
          console.log(`      File: ${dup.filePath}:${dup.startLine}-${dup.endLine}`);
        });
      });
    }

    console.log(Theme.colors.secondary('\n═'.repeat(60)));
    console.log(Theme.colors.info('Use "/dedup merge" to start interactive merging process'));
  }

  /**
   * Interactive merge process for duplicate groups
   */
  async interactiveMerge(
    report: DeduplicationReport,
    userInterface: any,
    workflowOrchestrator: any
  ): Promise<void> {
    console.log(Theme.colors.primary('\n🔧 INTERACTIVE DUPLICATE MERGING'));
    console.log(Theme.colors.secondary('═'.repeat(60)));

    for (let i = 0; i < report.duplicateGroups.length; i++) {
      const group = report.duplicateGroups[i];

      console.log(`\n${Theme.colors.info(`Processing Group ${i + 1}/${report.duplicateGroups.length}:`)}`);
      console.log(`${group.type}: ${Theme.colors.accent(group.primary.name)} (${group.confidence} confidence)`);

      // Show code comparison
      await this.showCodeComparison(group);

      // Get user decision
      const action = await this.getUserMergeDecision(group, userInterface);

      if (action.action !== 'skip') {
        console.log(Theme.colors.info('\n🔄 Executing merge through quality cycle...'));

        // Execute merge through workflow orchestrator (quality cycle)
        await this.executeMergeWithQualityCycle(group, action, workflowOrchestrator);
      }
    }

    console.log(Theme.colors.success('\n✅ Interactive merging complete!'));
  }

  /**
   * Show side-by-side code comparison
   */
  private async showCodeComparison(group: DuplicateGroup): Promise<void> {
    console.log(Theme.colors.info('\n📊 CODE COMPARISON:'));

    // Primary code
    console.log(Theme.colors.primary(`\n🎯 Primary (${group.primary.name}):`));
    console.log(Theme.colors.muted(`   File: ${group.primary.filePath}:${group.primary.startLine}-${group.primary.endLine}`));
    console.log(this.formatCodePreview(group.primary.content));

    // Duplicates
    group.duplicates.forEach((dup, index) => {
      console.log(Theme.colors.accent(`\n📄 Duplicate ${index + 1} (${dup.name}):`));
      console.log(Theme.colors.muted(`   File: ${dup.filePath}:${dup.startLine}-${dup.endLine}`));
      console.log(this.formatCodePreview(dup.content));
    });
  }

  /**
   * Get user decision for merge action
   */
  private async getUserMergeDecision(
    group: DuplicateGroup,
    userInterface: any
  ): Promise<MergeAction> {
    console.log(Theme.colors.info('\n🤔 What would you like to do?'));
    console.log('1. Merge duplicates into primary');
    console.log('2. Extract to common utility');
    console.log('3. Skip this group');

    // This would be implemented with actual user input in the CLI
    // For now, return a default action based on confidence
    if (group.confidence === 'high') {
      return {
        action: 'merge',
        sourceId: group.primary.id,
        targetId: group.duplicates[0].id
      };
    } else {
      return {
        action: 'skip',
        sourceId: group.primary.id,
        targetId: group.duplicates[0].id
      };
    }
  }

  /**
   * Execute merge through workflow orchestrator (quality cycle)
   */
  private async executeMergeWithQualityCycle(
    group: DuplicateGroup,
    action: MergeAction,
    workflowOrchestrator: any
  ): Promise<void> {
    const mergeRequest = this.buildMergeRequest(group, action);

    try {
      // Execute through workflow orchestrator for quality checks
      const result = await workflowOrchestrator.processRequest(
        mergeRequest,
        process.cwd()
      );

      if (result.success) {
        console.log(Theme.colors.success(`✅ Merge completed successfully`));
      } else {
        console.log(Theme.colors.error(`❌ Merge failed: ${result.error}`));
      }
    } catch (error) {
      console.log(Theme.colors.error(`❌ Merge execution failed: ${error.message}`));
    }
  }

  /**
   * Build merge request for workflow orchestrator
   */
  private buildMergeRequest(group: DuplicateGroup, action: MergeAction): string {
    const files = [group.primary.filePath, ...group.duplicates.map(d => d.filePath)];
    const uniqueFiles = [...new Set(files)];

    return `Merge duplicate ${group.type} "${group.primary.name}" with strategy "${group.mergeStrategy}".
            Files involved: ${uniqueFiles.join(', ')}.
            Action: ${action.action}.
            Ensure all tests pass and code quality is maintained.`;
  }

  // Helper methods

  private async ensureGranularEmbeddings(projectId: string): Promise<void> {
    // This would check if granular embeddings exist and generate them if needed
    await this.granularEmbedding.initializeDatabase(projectId);
  }

  private async getAllMethodsAndClasses(projectId: string): Promise<{ methods: any[], classes: any[] }> {
    // This would query the database for all methods and classes
    // Placeholder implementation
    return { methods: [], classes: [] };
  }

  private calculatePotentialSavings(groups: DuplicateGroup[]): DeduplicationReport['potentialSavings'] {
    let totalLines = 0;
    const affectedFiles = new Set<string>();

    groups.forEach(group => {
      group.duplicates.forEach(dup => {
        totalLines += (dup.endLine - dup.startLine + 1);
        affectedFiles.add(dup.filePath);
      });
    });

    const estimatedEffort = totalLines < 100 ? '1-2 hours' :
                           totalLines < 500 ? '2-5 hours' :
                           totalLines < 1000 ? '1-2 days' : '2-5 days';

    return {
      linesOfCode: totalLines,
      filesAffected: affectedFiles.size,
      estimatedEffort
    };
  }

  private formatCodePreview(content: string): string {
    const lines = content.split('\n');
    const preview = lines.slice(0, 10); // Show first 10 lines
    const formatted = preview.map((line, index) =>
      Theme.colors.muted(`   ${(index + 1).toString().padStart(2)}: ${line}`)
    ).join('\n');

    if (lines.length > 10) {
      return formatted + Theme.colors.muted('\n   ... (truncated)');
    }
    return formatted;
  }
}

export default DeduplicationService;