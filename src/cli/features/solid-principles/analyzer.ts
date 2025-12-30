/**
 * Minimal SOLID Principles Analyzer - MVP Implementation
 * Provides basic SOLID principles analysis for validation cycle
 */

import { Logger } from '../../../utils/logger';

export interface SOLIDAnalysisRequest {
  projectPath: string;
  files?: string[];
}

export interface SOLIDAnalysisResult {
  overallScore: number;
  principleScores: {
    singleResponsibility: number;
    openClosed: number;
    liskovSubstitution: number;
    interfaceSegregation: number;
    dependencyInversion: number;
  };
  violations: SOLIDViolation[];
  suggestions: string[];
}

export interface SOLIDViolation {
  principle: string;
  file: string;
  line?: number;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export class SOLIDPrinciplesAnalyzer {
  private logger = Logger.getInstance().child('SOLIDAnalyzer');

  /**
   * Perform basic SOLID analysis using simple heuristics
   */
  async analyzeSOLID(request: SOLIDAnalysisRequest): Promise<SOLIDAnalysisResult> {
    try {
      const { glob } = await import('fast-glob');

      // Find all TypeScript/JavaScript files
      const files = await glob([
        '**/*.ts',
        '**/*.js'
      ], {
        cwd: request.projectPath,
        ignore: ['node_modules/**', 'dist/**', '**/*.test.*', '**/*.spec.*']
      });

      const violations: SOLIDViolation[] = [];
      const principleScores = {
        singleResponsibility: 0.8, // Default good score
        openClosed: 0.7,
        liskovSubstitution: 0.9,
        interfaceSegregation: 0.8,
        dependencyInversion: 0.7
      };

      // Basic analysis for each file
      for (const file of files.slice(0, 10)) { // Limit to avoid performance issues
        try {
          const fs = await import('fs/promises');
          const filePath = require('path').join(request.projectPath, file);
          const content = await fs.readFile(filePath, 'utf-8');

          // Single Responsibility Principle check
          const classCount = (content.match(/class\s+\w+/g) || []).length;
          const methodCount = (content.match(/(?:function|method)\s+\w+/g) || []).length;

          if (classCount > 1 && methodCount > 10) {
            violations.push({
              principle: 'Single Responsibility',
              file,
              description: 'File contains multiple classes and many methods, suggesting multiple responsibilities',
              severity: 'medium'
            });
            principleScores.singleResponsibility -= 0.1;
          }

          // Open/Closed Principle check
          const privateMethodCount = (content.match(/private\s+\w+/g) || []).length;
          const publicMethodCount = (content.match(/public\s+\w+/g) || []).length;

          if (privateMethodCount < publicMethodCount) {
            violations.push({
              principle: 'Open/Closed',
              file,
              description: 'Class has more public than private methods, may not be well-encapsulated',
              severity: 'low'
            });
            principleScores.openClosed -= 0.05;
          }

          // Dependency Inversion Principle check
          const newKeywordCount = (content.match(/new\s+\w+\(/g) || []).length;
          const constructorParams = (content.match(/constructor\([^)]*\)/g) || []).length;

          if (newKeywordCount > 3 && constructorParams === 0) {
            violations.push({
              principle: 'Dependency Inversion',
              file,
              description: 'Class creates many dependencies directly instead of using dependency injection',
              severity: 'medium'
            });
            principleScores.dependencyInversion -= 0.1;
          }

        } catch (error) {
          // Ignore file analysis errors
          continue;
        }
      }

      const overallScore = Object.values(principleScores).reduce((sum, score) => sum + score, 0) / 5;

      return {
        overallScore: Math.max(0, Math.min(1, overallScore)),
        principleScores,
        violations,
        suggestions: this.generateSuggestions(violations)
      };

    } catch (error) {
      this.logger.error('SOLID analysis failed', error as Error);

      return {
        overallScore: 0.5,
        principleScores: {
          singleResponsibility: 0.5,
          openClosed: 0.5,
          liskovSubstitution: 0.5,
          interfaceSegregation: 0.5,
          dependencyInversion: 0.5
        },
        violations: [],
        suggestions: ['Unable to analyze SOLID principles - basic analysis failed']
      };
    }
  }

  /**
   * Generate improvement suggestions based on violations
   */
  private generateSuggestions(violations: SOLIDViolation[]): string[] {
    const suggestions: string[] = [];

    if (violations.some(v => v.principle === 'Single Responsibility')) {
      suggestions.push('Consider breaking large classes into smaller, focused classes');
    }

    if (violations.some(v => v.principle === 'Open/Closed')) {
      suggestions.push('Use interfaces and abstract classes for better extensibility');
    }

    if (violations.some(v => v.principle === 'Dependency Inversion')) {
      suggestions.push('Implement dependency injection to reduce coupling');
    }

    if (suggestions.length === 0) {
      suggestions.push('SOLID principles look good overall');
    }

    return suggestions;
  }

  // Additional method for validation cycle compatibility
  async analyzeProject(projectPath: string): Promise<SOLIDAnalysisResult> {
    return this.analyzeSOLID({ projectPath });
  }
}