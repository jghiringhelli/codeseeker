/**
 * SOLID Principles Analyzer Service
 * Analyzes code files for SOLID principles violations and provides refactoring suggestions
 */

import { Logger } from '../../utils/logger';
import { CodeRelationshipParser } from './code-relationship-parser';
import { Theme } from '../ui/theme';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface SOLIDViolation {
  principle: 'SRP' | 'OCP' | 'LSP' | 'ISP' | 'DIP';
  severity: 'critical' | 'major' | 'minor';
  description: string;
  location: {
    file: string;
    startLine: number;
    endLine: number;
    element: string;
  };
  suggestion: string;
  refactoring?: {
    type: string;
    effort: 'low' | 'medium' | 'high';
    automatable: boolean;
    steps: string[];
  };
}

export interface SOLIDFileResult {
  file: string;
  violations: SOLIDViolation[];
  score: number;
  refactoringSuggestions: string[];
}

export interface SOLIDProjectReport {
  projectId: string;
  totalFiles: number;
  analyzedFiles: number;
  overallScore: number;
  fileResults: SOLIDFileResult[];
  summary: {
    criticalViolations: number;
    majorViolations: number;
    minorViolations: number;
    topViolations: SOLIDViolation[];
  };
}

export class SOLIDAnalyzerService {
  private logger: Logger;
  private codeParser: CodeRelationshipParser;

  constructor() {
    this.logger = Logger.getInstance();
    this.codeParser = new CodeRelationshipParser();
  }

  /**
   * Analyze project file by file for SOLID principles
   */
  async analyzeProject(
    projectPath: string,
    progressCallback?: (progress: number, current: string) => void,
    recursive: boolean = true
  ): Promise<SOLIDProjectReport> {
    this.logger.info(`🏗️ Starting SOLID analysis for: ${projectPath} (recursive: ${recursive})`);

    const files = await this.getCodeFiles(projectPath, recursive);
    const fileResults: SOLIDFileResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      progressCallback?.(
        Math.round((i / files.length) * 100),
        `Analyzing ${path.basename(file)}`
      );

      try {
        const result = await this.analyzeFile(file);
        fileResults.push(result);
      } catch (error) {
        this.logger.error(`Failed to analyze ${file}:`, error);
      }
    }

    const overallScore = fileResults.length > 0
      ? Math.round(fileResults.reduce((sum, r) => sum + r.score, 0) / fileResults.length)
      : 0;

    const allViolations = fileResults.flatMap(r => r.violations);

    return {
      projectId: path.basename(projectPath),
      totalFiles: files.length,
      analyzedFiles: fileResults.length,
      overallScore,
      fileResults,
      summary: {
        criticalViolations: allViolations.filter(v => v.severity === 'critical').length,
        majorViolations: allViolations.filter(v => v.severity === 'major').length,
        minorViolations: allViolations.filter(v => v.severity === 'minor').length,
        topViolations: allViolations.sort((a, b) => {
          const severityOrder = { critical: 3, major: 2, minor: 1 };
          return severityOrder[b.severity] - severityOrder[a.severity];
        }).slice(0, 10)
      }
    };
  }

  /**
   * Analyze single file for SOLID violations
   */
  async analyzeFile(filePath: string): Promise<SOLIDFileResult> {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsedFile = await this.codeParser.parseFile(filePath);

    const violations: SOLIDViolation[] = [];

    // Analyze each SOLID principle
    violations.push(...this.analyzeSRP(parsedFile, content));
    violations.push(...this.analyzeOCP(parsedFile, content));
    violations.push(...this.analyzeLSP(parsedFile, content));
    violations.push(...this.analyzeISP(parsedFile, content));
    violations.push(...this.analyzeDIP(parsedFile, content));

    // Calculate score (100 - penalties)
    const score = Math.max(0, 100 - violations.reduce((penalty, v) => {
      return penalty + (v.severity === 'critical' ? 20 : v.severity === 'major' ? 10 : 5);
    }, 0));

    const refactoringSuggestions = this.generateRefactoringSuggestions(violations);

    return {
      file: filePath,
      violations,
      score,
      refactoringSuggestions
    };
  }

  /**
   * Single Responsibility Principle Analysis
   */
  private analyzeSRP(parsedFile: any, content: string): SOLIDViolation[] {
    const violations: SOLIDViolation[] = [];

    for (const classInfo of parsedFile.classes) {
      // Check for classes with too many methods (indicating multiple responsibilities)
      if (classInfo.methods.length > 15) {
        violations.push({
          principle: 'SRP',
          severity: classInfo.methods.length > 25 ? 'critical' : 'major',
          description: `Class '${classInfo.name}' has too many methods (${classInfo.methods.length})`,
          location: {
            file: parsedFile.filePath,
            startLine: classInfo.startLine,
            endLine: classInfo.endLine,
            element: classInfo.name
          },
          suggestion: 'Consider splitting into multiple classes with focused responsibilities',
          refactoring: {
            type: 'extract_class',
            effort: 'medium',
            automatable: false,
            steps: [
              'Identify groups of related methods',
              'Extract each group into a new class',
              'Update dependencies and composition'
            ]
          }
        });
      }

      // Check for high complexity methods
      for (const method of classInfo.methods) {
        if (method.complexity > 10) {
          violations.push({
            principle: 'SRP',
            severity: method.complexity > 20 ? 'major' : 'minor',
            description: `Method '${method.name}' is too complex (complexity: ${method.complexity})`,
            location: {
              file: parsedFile.filePath,
              startLine: method.startLine,
              endLine: method.endLine,
              element: `${classInfo.name}.${method.name}`
            },
            suggestion: 'Break method into smaller, focused functions',
            refactoring: {
              type: 'extract_method',
              effort: 'low',
              automatable: true,
              steps: [
                'Identify logical chunks within the method',
                'Extract each chunk to a private method',
                'Replace original code with method calls'
              ]
            }
          });
        }
      }
    }

    return violations;
  }

  /**
   * Open/Closed Principle Analysis
   */
  private analyzeOCP(parsedFile: any, content: string): SOLIDViolation[] {
    const violations: SOLIDViolation[] = [];

    // Look for switch statements or if-else chains that should be polymorphic
    const switchPattern = /switch\s*\([^)]+\)|if\s*\([^)]*typeof|if\s*\([^)]*instanceof/g;
    const matches = content.matchAll(switchPattern);

    for (const match of matches) {
      const lineNumber = content.substring(0, match.index).split('\n').length;

      violations.push({
        principle: 'OCP',
        severity: 'major',
        description: 'Switch statement or type checking detected - not extensible',
        location: {
          file: parsedFile.filePath,
          startLine: lineNumber,
          endLine: lineNumber,
          element: 'conditional_logic'
        },
        suggestion: 'Replace with polymorphism using Strategy or Factory pattern',
        refactoring: {
          type: 'polymorphism',
          effort: 'high',
          automatable: false,
          steps: [
            'Create interface for the varying behavior',
            'Implement concrete classes for each case',
            'Use factory or dependency injection to select implementation'
          ]
        }
      });
    }

    return violations;
  }

  /**
   * Liskov Substitution Principle Analysis
   */
  private analyzeLSP(parsedFile: any, content: string): SOLIDViolation[] {
    const violations: SOLIDViolation[] = [];

    // Check for NotImplemented exceptions or similar
    const notImplementedPattern = /throw\s+new\s+.*NotImplemented|throw\s+.*not.*implement/gi;
    const matches = content.matchAll(notImplementedPattern);

    for (const match of matches) {
      const lineNumber = content.substring(0, match.index).split('\n').length;

      violations.push({
        principle: 'LSP',
        severity: 'critical',
        description: 'Method throws NotImplementedException - violates substitutability',
        location: {
          file: parsedFile.filePath,
          startLine: lineNumber,
          endLine: lineNumber,
          element: 'method_implementation'
        },
        suggestion: 'Implement proper behavior or redesign inheritance hierarchy'
      });
    }

    return violations;
  }

  /**
   * Interface Segregation Principle Analysis
   */
  private analyzeISP(parsedFile: any, content: string): SOLIDViolation[] {
    const violations: SOLIDViolation[] = [];

    for (const interfaceInfo of parsedFile.interfaces || []) {
      if (interfaceInfo.methods && interfaceInfo.methods.length > 10) {
        violations.push({
          principle: 'ISP',
          severity: 'major',
          description: `Interface '${interfaceInfo.name}' is too large (${interfaceInfo.methods.length} methods)`,
          location: {
            file: parsedFile.filePath,
            startLine: interfaceInfo.startLine,
            endLine: interfaceInfo.endLine,
            element: interfaceInfo.name
          },
          suggestion: 'Split into smaller, more focused interfaces',
          refactoring: {
            type: 'extract_interface',
            effort: 'medium',
            automatable: false,
            steps: [
              'Group related methods by responsibility',
              'Create separate interfaces for each group',
              'Update implementing classes to use specific interfaces'
            ]
          }
        });
      }
    }

    return violations;
  }

  /**
   * Dependency Inversion Principle Analysis
   */
  private analyzeDIP(parsedFile: any, content: string): SOLIDViolation[] {
    const violations: SOLIDViolation[] = [];

    // Look for direct instantiation with 'new'
    const newPattern = /new\s+[A-Z][a-zA-Z0-9_]*\s*\(/g;
    const matches = content.matchAll(newPattern);

    let newCount = 0;
    for (const match of matches) {
      newCount++;
      if (newCount > 3) { // Allow some direct instantiation
        const lineNumber = content.substring(0, match.index).split('\n').length;

        violations.push({
          principle: 'DIP',
          severity: 'minor',
          description: 'Direct instantiation detected - consider dependency injection',
          location: {
            file: parsedFile.filePath,
            startLine: lineNumber,
            endLine: lineNumber,
            element: 'instantiation'
          },
          suggestion: 'Use dependency injection instead of direct instantiation',
          refactoring: {
            type: 'dependency_injection',
            effort: 'medium',
            automatable: false,
            steps: [
              'Extract dependency to constructor parameter',
              'Create interface for the dependency',
              'Configure dependency injection container'
            ]
          }
        });
      }
    }

    return violations;
  }

  /**
   * Print SOLID analysis report
   */
  printSOLIDReport(report: SOLIDProjectReport): void {
    console.log(Theme.colors.primary('\n🏗️ SOLID PRINCIPLES ANALYSIS'));
    console.log(Theme.colors.secondary('═'.repeat(60)));

    console.log(Theme.colors.info(`\n📊 PROJECT: ${report.projectId}`));
    console.log(`   Files Analyzed: ${report.analyzedFiles}/${report.totalFiles}`);
    console.log(`   Overall Score: ${this.colorizeScore(report.overallScore)}/100`);

    console.log(Theme.colors.info(`\n⚠️ VIOLATIONS:`));
    console.log(`   Critical: ${Theme.colors.error(report.summary.criticalViolations.toString())}`);
    console.log(`   Major: ${Theme.colors.warning(report.summary.majorViolations.toString())}`);
    console.log(`   Minor: ${Theme.colors.muted(report.summary.minorViolations.toString())}`);

    if (report.summary.topViolations.length > 0) {
      console.log(Theme.colors.info(`\n🎯 TOP VIOLATIONS:`));
      report.summary.topViolations.slice(0, 5).forEach((violation, index) => {
        console.log(`\n${index + 1}. ${Theme.colors.accent(violation.principle)} - ${violation.description}`);
        console.log(`   📁 ${violation.location.file}:${violation.location.startLine}`);
        console.log(`   🎯 ${violation.location.element}`);
        console.log(`   💡 ${Theme.colors.muted(violation.suggestion)}`);
      });
    }

    console.log(Theme.colors.secondary('\n═'.repeat(60)));
    console.log(Theme.colors.info('Use "/solid refactor" to apply suggested refactorings'));
  }

  /**
   * Interactive refactoring for SOLID violations
   */
  async interactiveRefactor(
    report: SOLIDProjectReport,
    workflowOrchestrator: any
  ): Promise<void> {
    console.log(Theme.colors.primary('\n🔧 INTERACTIVE SOLID REFACTORING'));
    console.log(Theme.colors.secondary('═'.repeat(60)));

    const automatableViolations = report.fileResults
      .flatMap(f => f.violations)
      .filter(v => v.refactoring?.automatable);

    if (automatableViolations.length === 0) {
      console.log(Theme.colors.warning('No automatable refactorings found.'));
      return;
    }

    console.log(`Found ${automatableViolations.length} automatable refactorings:`);

    for (const violation of automatableViolations.slice(0, 5)) {
      console.log(`\n🔧 ${violation.refactoring?.type}: ${violation.description}`);
      console.log(`   File: ${violation.location.file}:${violation.location.startLine}`);
      console.log(`   Effort: ${violation.refactoring?.effort}`);

      // Execute refactoring through workflow orchestrator
      const refactorRequest = `Refactor ${violation.location.element} in ${violation.location.file} to fix ${violation.principle} violation: ${violation.suggestion}`;

      console.log(Theme.colors.info('\n🔄 Applying refactoring through quality cycle...'));

      try {
        const result = await workflowOrchestrator.processRequest(refactorRequest, process.cwd());

        if (result.success) {
          console.log(Theme.colors.success('✅ Refactoring applied successfully'));
        } else {
          console.log(Theme.colors.error(`❌ Refactoring failed: ${result.error}`));
        }
      } catch (error) {
        console.log(Theme.colors.error(`❌ Refactoring execution failed: ${error.message}`));
      }
    }
  }

  // Helper methods
  private async getCodeFiles(projectPath: string, recursive: boolean = true): Promise<string[]> {
    const files: string[] = [];
    const extensions = ['.ts', '.js', '.py', '.java', '.cs', '.cpp'];

    // Check if path is a single file
    try {
      const stat = await fs.stat(projectPath);
      if (stat.isFile()) {
        if (extensions.some(ext => projectPath.endsWith(ext))) {
          return [projectPath];
        }
        return [];
      }
    } catch (error) {
      return [];
    }

    async function scanDirectory(dir: string, shouldRecurse: boolean) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory() && shouldRecurse && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await scanDirectory(fullPath, true);
          } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    }

    await scanDirectory(projectPath, recursive);
    return files;
  }

  private generateRefactoringSuggestions(violations: SOLIDViolation[]): string[] {
    const suggestions = new Set<string>();

    for (const violation of violations) {
      if (violation.refactoring) {
        suggestions.add(`${violation.refactoring.type}: ${violation.suggestion}`);
      }
    }

    return Array.from(suggestions);
  }

  private colorizeScore(score: number): string {
    if (score >= 80) return Theme.colors.success(score.toString());
    if (score >= 60) return Theme.colors.warning(score.toString());
    return Theme.colors.error(score.toString());
  }
}

export default SOLIDAnalyzerService;