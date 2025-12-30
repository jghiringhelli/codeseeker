/**
 * Coding Standards Generator - SOLID Principles Implementation
 * Single Responsibility: Generate and update .codemind/coding-standards.json
 * Open/Closed: Extensible for new pattern categories
 * Dependency Inversion: Depends on storage abstractions
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { CodingPatternsAnalyzer, CodingPattern } from './coding-patterns-analyzer';
import { IVectorStore } from '../../../storage/interfaces';

export interface CodingStandards {
  generated_at: string;
  project_id: string;
  project_path: string;
  standards: {
    [category: string]: CategoryStandards;
  };
}

export interface CategoryStandards {
  [subcategory: string]: PatternStandard;
}

export interface PatternStandard {
  preferred: string;
  import?: string;
  usage_count: number;
  files: string[];
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
  example?: string;
  alternatives?: Array<{
    pattern: string;
    usage_count: number;
    recommendation: string;
  }>;
}

export class CodingStandardsGenerator {
  private standardsCache = new Map<string, CodingStandards>();

  constructor(private vectorStore: IVectorStore) {}

  /**
   * Generate coding standards file at project init
   */
  async generateStandards(projectId: string, projectPath: string): Promise<void> {
    console.log('⏳ Analyzing coding patterns...');

    const analyzer = new CodingPatternsAnalyzer(this.vectorStore);
    const patterns = await analyzer.analyzePatterns(projectId);

    const standards: CodingStandards = {
      generated_at: new Date().toISOString(),
      project_id: projectId,
      project_path: projectPath,
      standards: {}
    };

    // Convert patterns to standards format
    let totalPatterns = 0;
    for (const [category, categoryPatterns] of patterns) {
      if (categoryPatterns.length > 0) {
        standards.standards[category] = this.formatCategoryStandards(categoryPatterns);
        totalPatterns += categoryPatterns.length;
      }
    }

    // Ensure .codemind directory exists
    const codemindDir = path.join(projectPath, '.codemind');
    await fs.mkdir(codemindDir, { recursive: true });

    // Write to .codemind/coding-standards.json
    const standardsPath = path.join(codemindDir, 'coding-standards.json');
    await fs.writeFile(standardsPath, JSON.stringify(standards, null, 2), 'utf-8');

    console.log(`✓ Detected ${totalPatterns} coding patterns across ${patterns.size} categories`);

    // Cache for quick access
    this.standardsCache.set(projectId, standards);
  }

  /**
   * Update standards incrementally when files change
   */
  async updateStandards(projectId: string, projectPath: string, changedFiles: string[]): Promise<void> {
    // Detect which categories are affected by the changes
    const affectedCategories = this.detectAffectedCategories(changedFiles);

    if (affectedCategories.length === 0) {
      return; // No pattern-related files changed
    }

    console.log(`⏳ Updating coding standards (${affectedCategories.join(', ')})...`);

    // Load existing standards
    const standardsPath = path.join(projectPath, '.codemind', 'coding-standards.json');
    let existing: CodingStandards;

    try {
      const content = await fs.readFile(standardsPath, 'utf-8');
      existing = JSON.parse(content);
    } catch (error) {
      // Standards file doesn't exist yet, generate from scratch
      await this.generateStandards(projectId, projectPath);
      return;
    }

    // Re-analyze only affected categories
    const analyzer = new CodingPatternsAnalyzer(this.vectorStore);

    for (const category of affectedCategories) {
      const patterns = await this.analyzeCategory(analyzer, projectId, category);
      if (patterns.length > 0) {
        existing.standards[category] = this.formatCategoryStandards(patterns);
      }
    }

    existing.generated_at = new Date().toISOString();
    await fs.writeFile(standardsPath, JSON.stringify(existing, null, 2), 'utf-8');

    console.log(`✓ Updated ${affectedCategories.length} standard categories`);

    // Update cache
    this.standardsCache.set(projectId, existing);
  }

  /**
   * Get cached standards or load from file
   */
  async getStandards(projectId: string, projectPath: string): Promise<CodingStandards | null> {
    // Check cache first
    if (this.standardsCache.has(projectId)) {
      return this.standardsCache.get(projectId)!;
    }

    // Load from file
    const standardsPath = path.join(projectPath, '.codemind', 'coding-standards.json');
    try {
      const content = await fs.readFile(standardsPath, 'utf-8');
      const standards = JSON.parse(content) as CodingStandards;
      this.standardsCache.set(projectId, standards);
      return standards;
    } catch (error) {
      return null; // Not generated yet
    }
  }

  /**
   * Detect which pattern categories are affected by file changes
   */
  private detectAffectedCategories(changedFiles: string[]): string[] {
    const categories = new Set<string>();

    for (const file of changedFiles) {
      const lower = file.toLowerCase();

      // Validation-related files
      if (lower.includes('validat') || lower.includes('validator')) {
        categories.add('validation');
      }

      // Error handling-related files
      if (lower.includes('error') || lower.includes('exception') || lower.includes('handler')) {
        categories.add('error-handling');
      }

      // Logging-related files
      if (lower.includes('log') || lower.includes('logger')) {
        categories.add('logging');
      }

      // Testing-related files
      if (lower.includes('test') || lower.includes('.spec.') || lower.includes('.test.')) {
        categories.add('testing');
      }
    }

    return Array.from(categories);
  }

  /**
   * Analyze a single category
   */
  private async analyzeCategory(
    analyzer: CodingPatternsAnalyzer,
    projectId: string,
    category: string
  ): Promise<CodingPattern[]> {
    const allPatterns = await analyzer.analyzePatterns(projectId);
    return allPatterns.get(category) || [];
  }

  /**
   * Format category patterns into standards format
   */
  private formatCategoryStandards(patterns: CodingPattern[]): CategoryStandards {
    const standards: CategoryStandards = {};

    for (const pattern of patterns) {
      // Use pattern name as subcategory key (simplified)
      const key = this.createSubcategoryKey(pattern.pattern);

      standards[key] = {
        preferred: pattern.pattern,
        import: pattern.import_statement,
        usage_count: pattern.usage_count,
        files: pattern.files.slice(0, 5), // Limit to 5 example files
        confidence: pattern.confidence,
        rationale: pattern.rationale,
        example: pattern.code_example,
        alternatives: pattern.alternatives
      };
    }

    return standards;
  }

  /**
   * Create a subcategory key from pattern name
   */
  private createSubcategoryKey(pattern: string): string {
    // Extract meaningful key from pattern
    if (pattern.includes('email')) return 'email';
    if (pattern.includes('phone') || pattern.includes('Mobile')) return 'phone';
    if (pattern.includes('URL')) return 'url';
    if (pattern.includes('Error')) return 'error-response';
    if (pattern.includes('console')) return 'console-logging';
    if (pattern.includes('logger')) return 'structured-logging';
    if (pattern.includes('beforeEach')) return 'test-setup';
    if (pattern.includes('expect')) return 'assertions';

    // Default: simplified pattern name
    return pattern
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 30);
  }
}
