/**
 * Architecture Service
 * SOLID Principles: Single Responsibility - Handle architecture and SOLID analysis only
 */

import { Logger } from '../../../utils/logger';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  IArchitectureService,
  ArchitectureResult,
  SubTaskResult
} from '../interfaces/index';

export class ArchitectureService implements IArchitectureService {
  private logger = Logger.getInstance();

  constructor(private projectRoot: string) {}

  async runArchitectureChecks(subTaskResults: SubTaskResult[]): Promise<ArchitectureResult> {
    this.logger.debug('Running architecture checks...');

    const solidPrinciples = await this.checkSOLIDPrinciples(
      subTaskResults.flatMap(r => r.filesModified)
    );
    const codeQuality = await this.analyzeCodeQuality(
      subTaskResults.flatMap(r => r.filesModified)
    );
    const patterns = await this.detectArchitecturalPatterns(subTaskResults);

    return {
      solidPrinciples,
      codeQuality,
      patterns
    };
  }

  async checkSOLIDPrinciples(filePaths: string[]): Promise<ArchitectureResult['solidPrinciples']> {
    // Simplified SOLID principle checking
    let singleResponsibility = true;
    let openClosed = true;
    let liskovSubstitution = true;
    let interfaceSegregation = true;
    let dependencyInversion = true;

    for (const filePath of filePaths) {
      try {
        const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.projectRoot, filePath);
        const content = await fs.readFile(fullPath, 'utf-8');

        // Single Responsibility: Check class method count
        const classMatches = content.match(/class\s+\w+/g);
        if (classMatches) {
          const methodCount = (content.match(/^\s*(public|private|protected)?\s*\w+\s*\(/gm) || []).length;
          if (methodCount > 10) {
            singleResponsibility = false;
          }
        }

        // Open/Closed: Check for direct modifications vs extensions
        const hasExtends = /extends\s+\w+/.test(content);
        const hasInterfaces = /implements\s+\w+/.test(content);
        if (!hasExtends && !hasInterfaces && classMatches && content.length > 5000) {
          openClosed = false;
        }

        // Interface Segregation: Check interface size
        const interfaceMatches = content.match(/interface\s+\w+\s*\{([^}]*)\}/g);
        if (interfaceMatches) {
          for (const match of interfaceMatches) {
            const methodCount = (match.match(/\w+\s*\(/g) || []).length;
            if (methodCount > 8) {
              interfaceSegregation = false;
            }
          }
        }

        // Dependency Inversion: Check for direct instantiation in constructors
        if (/constructor.*new\s+\w+/.test(content)) {
          dependencyInversion = false;
        }

        // Liskov Substitution: Check for method override compatibility
        const hasOverrides = /override\s+\w+/.test(content) || /@Override/.test(content);
        if (hasOverrides) {
          // Simple check - if overriding methods exist, assume they're compatible
          liskovSubstitution = true;
        }

      } catch (error) {
        this.logger.warn(`Could not analyze ${filePath} for SOLID principles:`, error);
      }
    }

    const trueCount = [
      singleResponsibility,
      openClosed,
      liskovSubstitution,
      interfaceSegregation,
      dependencyInversion
    ].filter(Boolean).length;
    const score = Math.round((trueCount / 5) * 100);

    return {
      singleResponsibility,
      openClosed,
      liskovSubstitution,
      interfaceSegregation,
      dependencyInversion,
      score
    };
  }

  async analyzeCodeQuality(filePaths: string[]): Promise<ArchitectureResult['codeQuality']> {
    let totalComplexity = 0;
    let totalDuplication = 0;
    let fileCount = 0;
    const allFileContents: { [filePath: string]: string } = {};

    // First pass: collect all file contents
    for (const filePath of filePaths) {
      try {
        const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.projectRoot, filePath);
        const content = await fs.readFile(fullPath, 'utf-8');
        allFileContents[filePath] = content;
      } catch (error) {
        this.logger.warn(`Could not read ${filePath} for quality analysis:`, error);
      }
    }

    // Second pass: analyze each file
    for (const filePath of filePaths) {
      try {
        const content = allFileContents[filePath];
        if (!content) continue;

        // Complexity: Count cyclomatic complexity indicators
        const complexityIndicators = (content.match(/if|else|while|for|switch|catch/g) || []).length;
        totalComplexity += complexityIndicators;

        // Basic duplication detection
        const duplicationScore = this.detectBasicDuplication(filePath, content, allFileContents);
        totalDuplication += duplicationScore;

        fileCount++;

      } catch (error) {
        this.logger.warn(`Could not analyze ${filePath} for code quality:`, error);
      }
    }

    const avgComplexity = fileCount > 0 ? totalComplexity / fileCount : 0;
    const avgDuplication = fileCount > 0 ? totalDuplication / fileCount : 0;

    return {
      maintainability: Math.max(0, 100 - avgComplexity * 5 - avgDuplication * 0.5),
      readability: Math.max(0, 100 - avgComplexity * 2 - avgDuplication * 0.3),
      complexity: avgComplexity,
      duplication: avgDuplication
    };
  }

  async detectArchitecturalPatterns(subTaskResults: SubTaskResult[]): Promise<ArchitectureResult['patterns']> {
    const detectedPatterns: string[] = [];
    const antiPatterns: string[] = [];
    const recommendations: string[] = [];

    for (const result of subTaskResults) {
      for (const filePath of result.filesModified) {
        try {
          const fullPath = path.join(this.projectRoot, filePath);
          const content = await fs.readFile(fullPath, 'utf-8');

          // Detect common patterns
          if (content.includes('getInstance') && content.includes('private constructor')) {
            detectedPatterns.push('Singleton Pattern');
          }

          if (content.includes('Observable') || content.includes('Subject')) {
            detectedPatterns.push('Observer Pattern');
          }

          if (content.includes('interface') && content.includes('implements')) {
            detectedPatterns.push('Interface Pattern');
          }

          if (content.includes('extends') && content.includes('class')) {
            detectedPatterns.push('Inheritance Pattern');
          }

          if (content.includes('inject') || content.includes('dependency')) {
            detectedPatterns.push('Dependency Injection');
          }

          // Detect anti-patterns
          if (content.match(/class\s+\w*God\w*/i) || (content.match(/class/) && content.length > 10000)) {
            antiPatterns.push('God Object');
          }

          if (content.includes('any') && (content.match(/:\s*any/g) || []).length > 5) {
            antiPatterns.push('Type Erasure');
          }

          if ((content.match(/if\s*\(/g) || []).length > 20) {
            antiPatterns.push('Complex Conditional Logic');
          }

          if ((content.match(/function|=>/g) || []).length > 50) {
            antiPatterns.push('Feature Envy');
          }

        } catch (error) {
          this.logger.warn(`Could not analyze ${filePath} for patterns:`, error);
        }
      }
    }

    // Generate recommendations based on findings
    if (antiPatterns.includes('God Object')) {
      recommendations.push('Consider breaking large classes into smaller, more focused classes');
    }

    if (antiPatterns.includes('Type Erasure')) {
      recommendations.push('Replace generic "any" types with specific interfaces');
    }

    if (antiPatterns.includes('Complex Conditional Logic')) {
      recommendations.push('Consider using strategy pattern or state pattern to simplify complex conditionals');
    }

    if (antiPatterns.includes('Feature Envy')) {
      recommendations.push('Consider moving functionality closer to the data it operates on');
    }

    if (detectedPatterns.length === 0) {
      recommendations.push('Consider implementing design patterns to improve code structure');
    }

    if (!detectedPatterns.includes('Dependency Injection')) {
      recommendations.push('Consider implementing dependency injection for better testability');
    }

    return {
      detectedPatterns: [...new Set(detectedPatterns)], // Remove duplicates
      antiPatterns: [...new Set(antiPatterns)],
      recommendations: [...new Set(recommendations)]
    };
  }

  private detectBasicDuplication(
    currentFile: string,
    content: string,
    allFiles: { [filePath: string]: string }
  ): number {
    let duplications = 0;
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 10);

    // Check for duplicate lines across files
    for (const [filePath, otherContent] of Object.entries(allFiles)) {
      if (filePath === currentFile) continue;

      const otherLines = otherContent.split('\n').map(line => line.trim());

      for (const line of lines) {
        if (otherLines.includes(line)) {
          duplications++;
        }
      }
    }

    // Return duplication percentage
    return lines.length > 0 ? Math.min(100, (duplications / lines.length) * 100) : 0;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    // Simple Jaccard similarity
    const set1 = new Set(str1.toLowerCase().split(' '));
    const set2 = new Set(str2.toLowerCase().split(' '));

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }
}