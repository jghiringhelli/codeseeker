/**
 * Coding Patterns Analyzer - SOLID Principles Implementation
 * Single Responsibility: Detect and rank coding patterns from indexed code
 * Dependency Inversion: Depends on storage abstractions, not concrete implementations
 */

import { IVectorStore } from '../../../storage/interfaces';

export interface CodingPattern {
  pattern: string;
  category: 'validation' | 'error-handling' | 'logging' | 'testing';
  usage_count: number;
  files: string[]; // file:line format
  confidence: 'high' | 'medium' | 'low';
  rationale: string;
  code_example?: string;
  import_statement?: string;
  alternatives?: Array<{
    pattern: string;
    usage_count: number;
    recommendation: string;
  }>;
}

interface PatternInfo {
  count: number;
  files: Set<string>;
  examples: string[];
}

export class CodingPatternsAnalyzer {
  constructor(private vectorStore: IVectorStore) {}

  /**
   * Analyze all coding patterns in the project
   */
  async analyzePatterns(projectId: string): Promise<Map<string, CodingPattern[]>> {
    const patterns = new Map<string, CodingPattern[]>();

    try {
      // Analyze each category
      patterns.set('validation', await this.detectValidationPatterns(projectId));
      patterns.set('error-handling', await this.detectErrorHandlingPatterns(projectId));
      patterns.set('logging', await this.detectLoggingPatterns(projectId));
      patterns.set('testing', await this.detectTestingPatterns(projectId));
    } catch (error) {
      console.warn('Pattern analysis warning:', error instanceof Error ? error.message : 'Unknown error');
      // Return partial results if some categories fail
    }

    return patterns;
  }

  /**
   * Detect validation patterns (email, phone, URL, etc.)
   */
  private async detectValidationPatterns(projectId: string): Promise<CodingPattern[]> {
    const results = await this.vectorStore.searchByText(
      'validation validate email phone url number input check',
      projectId,
      100 // Get many results to analyze patterns thoroughly
    );

    const patternCounts = new Map<string, PatternInfo>();

    for (const result of results) {
      const content = result.document.content || '';
      const filePath = result.document.filePath || 'unknown';

      // Pattern: validator.isEmail()
      if (content.match(/validator\.isEmail\s*\(/)) {
        this.trackPattern(patternCounts, 'validator.isEmail()', filePath, content, 'const validator = require(\'validator\');');
      }

      // Pattern: validator.isMobilePhone()
      if (content.match(/validator\.isMobilePhone\s*\(/)) {
        this.trackPattern(patternCounts, 'validator.isMobilePhone()', filePath, content, 'const validator = require(\'validator\');');
      }

      // Pattern: validator.isURL()
      if (content.match(/validator\.isURL\s*\(/)) {
        this.trackPattern(patternCounts, 'validator.isURL()', filePath, content, 'const validator = require(\'validator\');');
      }

      // Pattern: Email regex
      if (content.match(/\/\^[^\s@]+@[^\s@]+\.[^\s@]+\$\//)) {
        this.trackPattern(patternCounts, 'email-regex: /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/', filePath, content);
      }

      // Pattern: Simple includes('@')
      if (content.match(/\.includes\s*\(\s*['"]@['"]\s*\)/)) {
        this.trackPattern(patternCounts, 'email.includes(\'@\')', filePath, content);
      }

      // Pattern: Joi validation
      if (content.match(/Joi\.string\(\)\.email\(\)/)) {
        this.trackPattern(patternCounts, 'Joi.string().email()', filePath, content, 'const Joi = require(\'joi\');');
      }
    }

    return this.rankPatterns(patternCounts, 'validation');
  }

  /**
   * Detect error handling patterns
   */
  private async detectErrorHandlingPatterns(projectId: string): Promise<CodingPattern[]> {
    const results = await this.vectorStore.searchByText(
      'error exception throw catch try finally handling',
      projectId,
      100
    );

    const patternCounts = new Map<string, PatternInfo>();

    for (const result of results) {
      const content = result.document.content || '';
      const filePath = result.document.filePath || 'unknown';

      // Pattern: res.status().json({ error })
      if (content.match(/res\.status\s*\(\s*\d+\s*\)\.json\s*\(\s*\{\s*error/)) {
        this.trackPattern(patternCounts, 'res.status(code).json({ error })', filePath, content);
      }

      // Pattern: try-catch with logging
      if (content.match(/try\s*\{[\s\S]*?\}\s*catch[\s\S]*?console\.(log|error)/)) {
        this.trackPattern(patternCounts, 'try-catch with console logging', filePath, content);
      }

      // Pattern: Custom error classes
      if (content.match(/class\s+\w+Error\s+extends\s+Error/)) {
        this.trackPattern(patternCounts, 'Custom Error class extends Error', filePath, content);
      }
    }

    return this.rankPatterns(patternCounts, 'error-handling');
  }

  /**
   * Detect logging patterns
   */
  private async detectLoggingPatterns(projectId: string): Promise<CodingPattern[]> {
    const results = await this.vectorStore.searchByText(
      'log logging logger console debug info warn error',
      projectId,
      100
    );

    const patternCounts = new Map<string, PatternInfo>();

    for (const result of results) {
      const content = result.document.content || '';
      const filePath = result.document.filePath || 'unknown';

      // Pattern: console.log/error/warn
      if (content.match(/console\.(log|error|warn|info|debug)/)) {
        this.trackPattern(patternCounts, 'console.log/error/warn', filePath, content);
      }

      // Pattern: Winston logger
      if (content.match(/logger\.(info|error|warn|debug)/)) {
        this.trackPattern(patternCounts, 'logger.info/error/warn (Winston/Bunyan)', filePath, content);
      }
    }

    return this.rankPatterns(patternCounts, 'logging');
  }

  /**
   * Detect testing patterns
   */
  private async detectTestingPatterns(projectId: string): Promise<CodingPattern[]> {
    const results = await this.vectorStore.searchByText(
      'test spec describe it expect jest mocha beforeEach',
      projectId,
      100
    );

    const patternCounts = new Map<string, PatternInfo>();

    for (const result of results) {
      const content = result.document.content || '';
      const filePath = result.document.filePath || 'unknown';

      // Pattern: Jest with beforeEach
      if (content.match(/describe\s*\([\s\S]*?beforeEach/)) {
        this.trackPattern(patternCounts, 'Jest/Mocha with beforeEach setup', filePath, content);
      }

      // Pattern: expect() assertions
      if (content.match(/expect\s*\([^)]*\)\.(toBe|toEqual|toContain|toMatch)/)) {
        this.trackPattern(patternCounts, 'expect().toBe/toEqual assertions', filePath, content);
      }
    }

    return this.rankPatterns(patternCounts, 'testing');
  }

  /**
   * Track pattern occurrence
   */
  private trackPattern(
    patternCounts: Map<string, PatternInfo>,
    pattern: string,
    filePath: string,
    content: string,
    importStatement?: string
  ): void {
    if (!patternCounts.has(pattern)) {
      patternCounts.set(pattern, { count: 0, files: new Set(), examples: [] });
    }
    const info = patternCounts.get(pattern)!;
    info.count++;
    info.files.add(filePath);

    // Store first 3 examples
    if (info.examples.length < 3) {
      // Extract relevant lines (up to 3 lines of context)
      const lines = content.split('\n').slice(0, 3);
      const example = lines.join('\n').trim();
      if (example && !info.examples.includes(example)) {
        info.examples.push(example);
      }
    }
  }

  /**
   * Rank patterns by frequency and generate final pattern objects
   */
  private rankPatterns(
    patternCounts: Map<string, PatternInfo>,
    category: 'validation' | 'error-handling' | 'logging' | 'testing'
  ): CodingPattern[] {
    const ranked = [...patternCounts.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .map(([pattern, info]): CodingPattern => ({
        pattern,
        category,
        usage_count: info.count,
        files: Array.from(info.files),
        confidence: this.calculateConfidence(info.count),
        rationale: this.generateRationale(pattern, info.count, category),
        code_example: info.examples[0],
        import_statement: this.detectImportStatement(pattern),
        alternatives: []  // Will be populated below for top patterns
      }));

    // Add alternatives to top pattern
    if (ranked.length > 1) {
      ranked[0].alternatives = ranked.slice(1, 4).map(p => ({
        pattern: p.pattern,
        usage_count: p.usage_count,
        recommendation: p.usage_count < ranked[0].usage_count
          ? `Consider using "${ranked[0].pattern}" instead (${ranked[0].usage_count} vs ${p.usage_count} occurrences)`
          : 'Alternative pattern with similar usage'
      }));
    }

    return ranked;
  }

  /**
   * Calculate confidence based on usage count
   */
  private calculateConfidence(count: number): 'high' | 'medium' | 'low' {
    if (count >= 3) return 'high';
    if (count >= 2) return 'medium';
    return 'low';
  }

  /**
   * Generate rationale for pattern
   */
  private generateRationale(pattern: string, count: number, category: string): string {
    if (pattern.includes('validator.')) {
      return `Project standard - uses validator library in ${count} files. Battle-tested validation with comprehensive edge case handling.`;
    }
    if (pattern.includes('Joi.')) {
      return `Project uses Joi schema validation in ${count} files. Declarative validation with detailed error messages.`;
    }
    if (pattern.includes('regex')) {
      return `Custom regex validation found in ${count} files. Consider using a validation library for better maintainability.`;
    }
    if (pattern.includes('includes(')) {
      return `Simple string check found in ${count} files. Consider more robust validation for production use.`;
    }
    if (category === 'error-handling' && pattern.includes('res.status')) {
      return `Standard Express.js error response pattern used in ${count} files.`;
    }
    if (category === 'logging' && pattern.includes('logger.')) {
      return `Structured logging with dedicated logger found in ${count} files. Preferred over console.log.`;
    }
    if (category === 'testing' && pattern.includes('beforeEach')) {
      return `Test setup pattern found in ${count} files. Ensures clean state for each test.`;
    }

    return `Pattern found in ${count} files across the project.`;
  }

  /**
   * Detect import statement for pattern
   */
  private detectImportStatement(pattern: string): string | undefined {
    if (pattern.includes('validator.')) {
      return "const validator = require('validator');";
    }
    if (pattern.includes('Joi.')) {
      return "const Joi = require('joi');";
    }
    return undefined;
  }
}
