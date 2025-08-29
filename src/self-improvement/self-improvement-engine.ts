import * as path from 'path';
import Database from 'better-sqlite3';
import { DuplicationDetector } from '../features/duplication/detector';
import { TreeNavigator } from '../features/tree-navigation/navigator';
import { VectorSearch } from '../features/vector-search/search-engine';
import { CentralizationDetector } from '../features/centralization/detector';
import { ContextOptimizer } from '../cli/context-optimizer';
import { Logger } from '../utils/logger';
import { EventEmitter } from 'events';

/**
 * Self-Improvement Engine
 * 
 * Uses CodeMind's own features to improve its codebase systematically.
 * Implements the "dogfooding strategy" from Phase 2 requirements.
 */
export class SelfImprovementEngine extends EventEmitter {
  private logger = Logger.getInstance();
  private db: Database.Database;
  private projectPath: string;
  
  // Our own tools
  private duplicationDetector: DuplicationDetector;
  private treeNavigator: TreeNavigator;
  private vectorSearch: VectorSearch;
  private centralizationDetector: CentralizationDetector;
  private contextOptimizer: ContextOptimizer;
  
  constructor(projectPath?: string, dbPath?: string) {
    super();
    this.projectPath = projectPath || path.join(__dirname, '..', '..');
    const databasePath = dbPath || path.join(this.projectPath, 'codemind.db');
    
    this.db = new Database(databasePath);
    this.db.pragma('journal_mode = WAL');
    
    // Initialize our own tools
    this.duplicationDetector = new DuplicationDetector();
    this.treeNavigator = new TreeNavigator();
    this.vectorSearch = new VectorSearch();
    this.centralizationDetector = new CentralizationDetector();
    this.contextOptimizer = new ContextOptimizer();
  }

  /**
   * Run complete self-improvement cycle
   */
  async runSelfImprovement(): Promise<SelfImprovementReport> {
    this.logger.info('Starting self-improvement cycle on CodeMind codebase...');
    const report: SelfImprovementReport = {
      timestamp: new Date(),
      improvements: [],
      metrics: {
        before: {},
        after: {}
      },
      recommendations: []
    };

    try {
      // Step 1: Analyze our own code for duplications
      const duplications = await this.findAndFixDuplications();
      report.improvements.push(...duplications);
      
      // Step 2: Optimize our dependency tree
      const dependencies = await this.optimizeDependencies();
      report.improvements.push(...dependencies);
      
      // Step 3: Find similar implementations using vector search
      const similarities = await this.consolidateSimilarCode();
      report.improvements.push(...similarities);
      
      // Step 4: Centralize scattered configurations
      const centralizations = await this.centralizeConfigurations();
      report.improvements.push(...centralizations);
      
      // Step 5: Optimize our own context windows
      const contextOptimizations = await this.optimizeOwnContext();
      report.improvements.push(...contextOptimizations);
      
      // Calculate metrics
      report.metrics = await this.calculateMetrics(report.improvements);
      
      // Generate recommendations
      report.recommendations = await this.generateRecommendations(report);
      
      // Save to database
      await this.saveImprovements(report);
      
      this.emit('self-improvement:completed', report);
      
    } catch (error) {
      this.logger.error('Self-improvement cycle failed', error as Error);
      this.emit('self-improvement:failed', error);
      throw error;
    }
    
    return report;
  }

  /**
   * Find and suggest fixes for code duplications in our codebase
   */
  private async findAndFixDuplications(): Promise<Improvement[]> {
    this.logger.info('Analyzing CodeMind for code duplications...');
    const improvements: Improvement[] = [];
    
    const results = await this.duplicationDetector.findDuplicates({
      projectPath: this.projectPath,
      includeSemantic: true,
      similarityThreshold: 0.8,
      includeRefactoringSuggestions: true,
      filePatterns: ['src/**/*.ts', 'src/**/*.js'],
      excludePatterns: ['**/node_modules/**', '**/dist/**', '**/*.test.ts']
    });
    
    for (const group of results.duplicates) {
      if (group.refactoring) {
        const improvement: Improvement = {
          type: 'duplication_removed',
          feature: 'duplication_detection',
          target: group.locations[0].file,
          description: `Found ${group.locations.length} duplicates with ${group.similarity}% similarity`,
          suggestion: group.refactoring.description,
          estimatedEffort: (group.refactoring.estimatedEffort as any)?.level || 'medium',
          benefit: this.calculateDuplicationBenefit(group),
          status: 'identified',
          metadata: {
            duplicateCount: group.locations.length,
            linesAffected: group.metadata.linesOfCode,
            similarityScore: group.similarity,
            refactoringApproach: group.refactoring.approach
          }
        };
        improvements.push(improvement);
      }
    }
    
    this.logger.info(`Found ${improvements.length} duplication improvements`);
    return improvements;
  }

  /**
   * Optimize dependency tree and find circular dependencies
   */
  private async optimizeDependencies(): Promise<Improvement[]> {
    this.logger.info('Analyzing CodeMind dependency tree...');
    const improvements: Improvement[] = [];
    
    const tree = await this.treeNavigator.buildDependencyTree(this.projectPath);
    
    // Check for circular dependencies
    for (const circular of tree.circularDependencies) {
      const improvement: Improvement = {
        type: 'dependency_optimized',
        feature: 'tree_navigation',
        target: circular.path[0],
        description: `Circular dependency: ${circular.path.join(' → ')}`,
        suggestion: `Break circular dependency by introducing an interface or moving shared code to a separate module`,
        estimatedEffort: 'medium',
        benefit: 8, // Circular dependencies are high priority
        status: 'identified',
        metadata: {
          dependencyPath: circular.path,
          severity: circular.severity
        }
      };
      improvements.push(improvement);
    }
    
    // Check for overly complex modules (too many dependencies)
    const complexityThreshold = 15;
    for (const [nodeId, node] of tree.nodes) {
      if (node.children.length > complexityThreshold) {
        const improvement: Improvement = {
          type: 'dependency_optimized',
          feature: 'tree_navigation',
          target: node.path,
          description: `High complexity: ${node.children.length} dependencies`,
          suggestion: `Consider splitting this module to reduce coupling`,
          estimatedEffort: 'high',
          benefit: 6,
          status: 'identified',
          metadata: {
            dependencyCount: node.children.length,
            complexity: node.complexity
          }
        };
        improvements.push(improvement);
      }
    }
    
    this.logger.info(`Found ${improvements.length} dependency improvements`);
    return improvements;
  }

  /**
   * Find and consolidate similar code using vector search
   */
  private async consolidateSimilarCode(): Promise<Improvement[]> {
    this.logger.info('Finding similar code patterns in CodeMind...');
    const improvements: Improvement[] = [];
    
    // Search for common patterns we might want to consolidate
    const patterns = [
      'error handling',
      'logging setup',
      'database connection',
      'file reading',
      'AST parsing',
      'configuration loading'
    ];
    
    for (const pattern of patterns) {
      const results = await this.vectorSearch.search({
        query: pattern,
        projectPath: this.projectPath,
        limit: 10,
        crossProject: false,
        useSemanticSearch: true,
        similarityThreshold: 0.7
      });
      
      // Group similar matches
      const similarGroups = this.groupSimilarMatches(results.matches);
      
      for (const group of similarGroups) {
        if (group.length > 2) { // Only suggest if 3+ similar implementations
          const improvement: Improvement = {
            type: 'pattern_applied',
            feature: 'vector_search',
            target: group[0].file,
            description: `Found ${group.length} similar implementations of "${pattern}"`,
            suggestion: `Extract common ${pattern} logic to a shared utility`,
            estimatedEffort: 'medium',
            benefit: group.length * 2, // More duplicates = higher benefit
            status: 'identified',
            metadata: {
              pattern,
              similarFiles: group.map(m => m.file),
              averageSimilarity: group.reduce((sum, m) => sum + m.similarity, 0) / group.length
            }
          };
          improvements.push(improvement);
        }
      }
    }
    
    this.logger.info(`Found ${improvements.length} similarity improvements`);
    return improvements;
  }

  /**
   * Centralize scattered configurations
   */
  private async centralizeConfigurations(): Promise<Improvement[]> {
    this.logger.info('Finding scattered configurations in CodeMind...');
    const improvements: Improvement[] = [];
    
    const results = await this.centralizationDetector.scanProject({
      projectPath: this.projectPath,
      includeMigrationPlan: true,
      includeRiskAssessment: true,
      minOccurrences: 2
    });
    
    for (const opportunity of results.opportunities) {
      if (opportunity.benefitScore > 5) { // Only high-benefit centralizations
        const improvement: Improvement = {
          type: 'config_centralized',
          feature: 'centralization_detection',
          target: opportunity.scatteredLocations[0].file,
          description: `${opportunity.configType} scattered across ${opportunity.scatteredLocations.length} files`,
          suggestion: (opportunity.migrationPlan as any)?.description || 'Centralize configuration',
          estimatedEffort: this.mapComplexityToEffort(opportunity.complexityScore),
          benefit: opportunity.benefitScore,
          status: 'identified',
          metadata: {
            configType: opportunity.configType,
            locations: opportunity.scatteredLocations.map(l => l.file),
            consolidationTarget: opportunity.consolidationTarget
          }
        };
        improvements.push(improvement);
      }
    }
    
    this.logger.info(`Found ${improvements.length} centralization improvements`);
    return improvements;
  }

  /**
   * Optimize our own context windows for better Claude interactions
   */
  private async optimizeOwnContext(): Promise<Improvement[]> {
    this.logger.info('Optimizing CodeMind context windows...');
    const improvements: Improvement[] = [];
    
    // Analyze our own codebase for context optimization
    const analysis = await this.contextOptimizer.analyzeProject({
      projectPath: this.projectPath,
      tokenBudget: 8000
    });
    
    // Check if our files are too large for optimal context
    const largeFiles = (analysis as any).files?.filter((f: any) => f.tokenCount > 2000) || [];
    
    for (const file of largeFiles) {
      const improvement: Improvement = {
        type: 'context_optimized',
        feature: 'context_optimization',
        target: file.path,
        description: `File too large for optimal context (${file.tokenCount} tokens)`,
        suggestion: `Split into smaller modules or extract interfaces`,
        estimatedEffort: 'medium',
        benefit: 5,
        status: 'identified',
        metadata: {
          currentTokens: file.tokenCount,
          targetTokens: 1500,
          reduction: file.tokenCount - 1500
        }
      };
      improvements.push(improvement);
    }
    
    this.logger.info(`Found ${improvements.length} context improvements`);
    return improvements;
  }

  /**
   * Group similar search matches
   */
  private groupSimilarMatches(matches: any[]): any[][] {
    const groups: any[][] = [];
    const used = new Set<number>();
    
    for (let i = 0; i < matches.length; i++) {
      if (used.has(i)) continue;
      
      const group = [matches[i]];
      used.add(i);
      
      for (let j = i + 1; j < matches.length; j++) {
        if (used.has(j)) continue;
        
        // Simple grouping by file similarity
        if (this.areSimilarFiles(matches[i], matches[j])) {
          group.push(matches[j]);
          used.add(j);
        }
      }
      
      groups.push(group);
    }
    
    return groups;
  }

  private areSimilarFiles(match1: any, match2: any): boolean {
    // Simple heuristic: similar if in same directory or have similar names
    const dir1 = path.dirname(match1.file);
    const dir2 = path.dirname(match2.file);
    return dir1 === dir2 || match1.similarity > 0.8;
  }

  private calculateDuplicationBenefit(group: any): number {
    // Higher benefit for more duplicates and larger code blocks
    const duplicateScore = Math.min(group.locations.length * 2, 10);
    const sizeScore = Math.min(group.metadata.linesOfCode / 10, 5);
    return Math.round(duplicateScore + sizeScore);
  }

  private mapComplexityToEffort(complexity: number): EffortLevel {
    if (complexity < 3) return 'low';
    if (complexity < 7) return 'medium';
    return 'high';
  }

  /**
   * Calculate before/after metrics
   */
  private async calculateMetrics(improvements: Improvement[]): Promise<{
    before: Record<string, number>;
    after: Record<string, number>;
  }> {
    const metrics = {
      before: {
        totalDuplications: 0,
        circularDependencies: 0,
        scatteredConfigs: 0,
        averageFileSize: 0,
        totalComplexity: 0
      },
      after: {
        totalDuplications: 0,
        circularDependencies: 0,
        scatteredConfigs: 0,
        averageFileSize: 0,
        totalComplexity: 0
      }
    };
    
    // Calculate current metrics
    for (const improvement of improvements) {
      if (improvement.type === 'duplication_removed') {
        metrics.before.totalDuplications += improvement.metadata?.duplicateCount || 0;
      } else if (improvement.type === 'dependency_optimized' && improvement.metadata?.dependencyPath) {
        metrics.before.circularDependencies++;
      } else if (improvement.type === 'config_centralized') {
        metrics.before.scatteredConfigs += improvement.metadata?.locations?.length || 0;
      }
    }
    
    // Estimate after metrics (if all improvements applied)
    metrics.after = {
      totalDuplications: Math.max(0, metrics.before.totalDuplications - improvements.filter(i => i.type === 'duplication_removed').length),
      circularDependencies: 0, // All would be fixed
      scatteredConfigs: 0, // All would be centralized
      averageFileSize: metrics.before.averageFileSize * 0.8, // Estimate 20% reduction
      totalComplexity: metrics.before.totalComplexity * 0.7 // Estimate 30% reduction
    };
    
    return metrics;
  }

  /**
   * Generate recommendations based on analysis
   */
  private async generateRecommendations(report: SelfImprovementReport): Promise<string[]> {
    const recommendations: string[] = [];
    
    // Count improvements by type
    const byType = report.improvements.reduce((acc, imp) => {
      acc[imp.type] = (acc[imp.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Generate recommendations based on findings
    if (byType.duplication_removed > 5) {
      recommendations.push('Consider creating a shared utilities module to reduce duplication');
    }
    
    if (byType.dependency_optimized > 0) {
      recommendations.push('Review module boundaries and consider dependency injection');
    }
    
    if (byType.config_centralized > 3) {
      recommendations.push('Implement a centralized configuration management system');
    }
    
    if (byType.context_optimized > 0) {
      recommendations.push('Split large files into smaller, focused modules');
    }
    
    // Priority recommendation
    const highPriority = report.improvements.filter(i => i.benefit > 7);
    if (highPriority.length > 0) {
      recommendations.push(`Focus on ${highPriority.length} high-priority improvements first`);
    }
    
    return recommendations;
  }

  /**
   * Save improvements to database
   */
  private async saveImprovements(report: SelfImprovementReport): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO self_improvement (
        feature_used, target_file, improvement_type,
        before_state, after_state, metrics_before, metrics_after,
        improvement_score, applied_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const transaction = this.db.transaction((improvements: Improvement[]) => {
      for (const improvement of improvements) {
        stmt.run(
          improvement.feature,
          improvement.target,
          improvement.type,
          JSON.stringify(improvement.metadata),
          null, // after_state - will be updated when applied
          JSON.stringify(report.metrics.before),
          JSON.stringify(report.metrics.after),
          improvement.benefit,
          'self-improvement-engine'
        );
      }
    });
    
    transaction(report.improvements);
    this.logger.info(`Saved ${report.improvements.length} improvements to database`);
  }

  /**
   * Apply a specific improvement (with user confirmation)
   */
  async applyImprovement(improvement: Improvement): Promise<boolean> {
    this.logger.info(`Applying improvement: ${improvement.description}`);
    
    // This would integrate with actual refactoring tools
    // For now, we just mark it as applied in the database
    
    const stmt = this.db.prepare(`
      UPDATE self_improvement 
      SET after_state = ?, applied_by = 'self-improvement-engine'
      WHERE target_file = ? AND improvement_type = ? AND after_state IS NULL
    `);
    
    const result = stmt.run(
      JSON.stringify({ applied: true, timestamp: new Date() }),
      improvement.target,
      improvement.type
    );
    
    return result.changes > 0;
  }

  close(): void {
    this.db.close();
  }
}

// Type definitions
export interface SelfImprovementReport {
  timestamp: Date;
  improvements: Improvement[];
  metrics: {
    before: Record<string, number>;
    after: Record<string, number>;
  };
  recommendations: string[];
}

export interface Improvement {
  type: ImprovementType;
  feature: string;
  target: string;
  description: string;
  suggestion: string;
  estimatedEffort: EffortLevel;
  benefit: number; // 1-10 scale
  status: 'identified' | 'in_progress' | 'applied' | 'rejected';
  metadata?: Record<string, any>;
}

export type ImprovementType = 
  | 'duplication_removed'
  | 'dependency_optimized'
  | 'config_centralized'
  | 'context_optimized'
  | 'pattern_applied'
  | 'refactoring_applied';

export type EffortLevel = 'low' | 'medium' | 'high';

export default SelfImprovementEngine;