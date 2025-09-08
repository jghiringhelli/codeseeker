/**
 * SOLID Principles Analyzer - Simplified Architecture Quality Assessment
 * Analyzes code adherence to SOLID principles for Claude Code architectural guidance
 */

import { Logger } from '../../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'fast-glob';

export interface SOLIDAnalysisRequest {
  projectPath: string;
  excludePatterns?: string[];
  focusOnFiles?: string[];
}

export interface SOLIDViolation {
  principle: 'SRP' | 'OCP' | 'LSP' | 'ISP' | 'DIP';
  file: string;
  line?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  suggestion: string;
  codeSnippet?: string;
}

export interface ClassAnalysis {
  file: string;
  className: string;
  methods: number;
  responsibilities: string[];
  dependencies: string[];
  violations: SOLIDViolation[];
  complexity: number;
  maintainabilityScore: number;
}

export interface PrincipleScore {
  principle: string;
  score: number; // 0-1 scale
  violationCount: number;
  criticalViolations: number;
  description: string;
}

export interface RefactoringOpportunity {
  type: 'extract_class' | 'extract_interface' | 'dependency_injection' | 'strategy_pattern';
  description: string;
  files: string[];
  estimatedEffort: 'low' | 'medium' | 'high';
  benefits: string[];
}

export interface SOLIDAnalysisResult {
  overallScore: number;
  principleScores: PrincipleScore[];
  violations: SOLIDViolation[];
  classAnalyses: ClassAnalysis[];
  refactoringOpportunities: RefactoringOpportunity[];
  recommendations: string[];
}

export class SOLIDPrinciplesAnalyzer {
  private logger = Logger.getInstance();

  async analyzeSOLID(params: SOLIDAnalysisRequest): Promise<SOLIDAnalysisResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info('🏗️ Starting SOLID principles analysis...');

      // 1. Find all class files
      const classFiles = await this.findClassFiles(params.projectPath, params.excludePatterns);
      
      // 2. Analyze each class file
      const classAnalyses: ClassAnalysis[] = [];
      const allViolations: SOLIDViolation[] = [];
      
      for (const file of classFiles.slice(0, 30)) { // Reasonable limit
        const analysis = await this.analyzeClassFile(file);
        if (analysis) {
          classAnalyses.push(analysis);
          allViolations.push(...analysis.violations);
        }
      }
      
      // 3. Calculate principle scores
      const principleScores = this.calculatePrincipleScores(allViolations, classAnalyses.length);
      const overallScore = this.calculateOverallScore(principleScores);
      
      // 4. Identify refactoring opportunities
      const refactoringOpportunities = this.identifyRefactoringOpportunities(classAnalyses);
      
      // 5. Generate recommendations
      const recommendations = this.generateRecommendations(allViolations, principleScores, refactoringOpportunities);

      const result: SOLIDAnalysisResult = {
        overallScore,
        principleScores,
        violations: allViolations,
        classAnalyses,
        refactoringOpportunities,
        recommendations
      };

      const duration = Date.now() - startTime;
      this.logger.info(`✅ SOLID principles analysis completed in ${duration}ms`, {
        classesAnalyzed: classAnalyses.length,
        violationsFound: allViolations.length,
        overallScore: Math.round(overallScore * 100),
        criticalViolations: allViolations.filter(v => v.severity === 'critical').length
      });

      return result;
    } catch (error) {
      this.logger.error('❌ SOLID principles analysis failed:', error);
      throw error;
    }
  }

  private async findClassFiles(projectPath: string, excludePatterns?: string[]): Promise<string[]> {
    const patterns = [
      'src/**/*.{ts,js,tsx,jsx}',
      'lib/**/*.{ts,js}',
      '!**/*.test.{ts,js}',
      '!**/*.spec.{ts,js}',
      '!**/node_modules/**',
      '!**/dist/**',
      '!**/build/**'
    ];

    if (excludePatterns) {
      patterns.push(...excludePatterns.map(p => `!${p}`));
    }

    return await glob(patterns, { cwd: projectPath, absolute: true });
  }

  private async analyzeClassFile(filePath: string): Promise<ClassAnalysis | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Simple class detection
      const classMatch = content.match(/class\s+([A-Z][a-zA-Z0-9]*)/);
      if (!classMatch) {
        return null; // Not a class file
      }

      const className = classMatch[1];
      const methods = this.extractMethods(content);
      const responsibilities = this.identifyResponsibilities(content, className);
      const dependencies = this.extractDependencies(content);
      const violations = this.findViolations(content, filePath, className);
      const complexity = this.calculateClassComplexity(content);
      const maintainabilityScore = this.calculateMaintainabilityScore(complexity, violations.length, dependencies.length);

      return {
        file: filePath,
        className,
        methods: methods.length,
        responsibilities,
        dependencies,
        violations,
        complexity,
        maintainabilityScore
      };
    } catch (error) {
      this.logger.warn(`Could not analyze class file ${filePath}:`, error);
      return null;
    }
  }

  private extractMethods(content: string): string[] {
    const methods = new Set<string>();
    
    // Extract method patterns
    const methodPatterns = [
      /(?:public|private|protected)?\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g,
      /([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*\([^)]*\)\s*=>/g,
      /([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*function/g
    ];

    methodPatterns.forEach(pattern => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && !['constructor', 'if', 'for', 'while'].includes(match[1])) {
          methods.add(match[1]);
        }
      }
    });

    return Array.from(methods).slice(0, 20); // Reasonable limit
  }

  private identifyResponsibilities(content: string, className: string): string[] {
    const responsibilities = new Set<string>();
    
    // Identify responsibilities based on patterns
    const contentLower = content.toLowerCase();
    
    // Data responsibilities
    if (contentLower.includes('save') || contentLower.includes('persist') || contentLower.includes('store')) {
      responsibilities.add('Data Persistence');
    }
    
    if (contentLower.includes('validate') || contentLower.includes('check')) {
      responsibilities.add('Data Validation');
    }
    
    if (contentLower.includes('format') || contentLower.includes('transform')) {
      responsibilities.add('Data Formatting');
    }
    
    // Business responsibilities
    if (contentLower.includes('calculate') || contentLower.includes('compute')) {
      responsibilities.add('Business Logic');
    }
    
    if (contentLower.includes('send') || contentLower.includes('email') || contentLower.includes('notify')) {
      responsibilities.add('Communication');
    }
    
    if (contentLower.includes('log') || contentLower.includes('audit')) {
      responsibilities.add('Logging/Auditing');
    }
    
    // UI responsibilities
    if (contentLower.includes('render') || contentLower.includes('display') || contentLower.includes('view')) {
      responsibilities.add('User Interface');
    }
    
    // Default based on class name
    if (className.includes('Service')) responsibilities.add('Service Logic');
    if (className.includes('Controller')) responsibilities.add('Request Handling');
    if (className.includes('Repository')) responsibilities.add('Data Access');
    if (className.includes('Manager')) responsibilities.add('Resource Management');
    
    return Array.from(responsibilities);
  }

  private extractDependencies(content: string): string[] {
    const dependencies = new Set<string>();
    
    // Extract import statements
    const importMatches = content.matchAll(/import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g);
    for (const match of importMatches) {
      if (match[1] && !match[1].startsWith('.')) {
        dependencies.add(match[1]);
      }
    }
    
    // Extract constructor dependencies
    const constructorMatch = content.match(/constructor\s*\([^)]+\)/);
    if (constructorMatch) {
      const constructorParams = constructorMatch[0];
      const paramMatches = constructorParams.matchAll(/(\w+)\s*:/g);
      for (const match of paramMatches) {
        if (match[1]) {
          dependencies.add(match[1]);
        }
      }
    }
    
    return Array.from(dependencies).slice(0, 15);
  }

  private findViolations(content: string, filePath: string, className: string): SOLIDViolation[] {
    const violations: SOLIDViolation[] = [];
    
    // Single Responsibility Principle (SRP) violations
    violations.push(...this.checkSRPViolations(content, filePath, className));
    
    // Open/Closed Principle (OCP) violations
    violations.push(...this.checkOCPViolations(content, filePath, className));
    
    // Liskov Substitution Principle (LSP) violations
    violations.push(...this.checkLSPViolations(content, filePath, className));
    
    // Interface Segregation Principle (ISP) violations
    violations.push(...this.checkISPViolations(content, filePath, className));
    
    // Dependency Inversion Principle (DIP) violations
    violations.push(...this.checkDIPViolations(content, filePath, className));
    
    return violations;
  }

  private checkSRPViolations(content: string, filePath: string, className: string): SOLIDViolation[] {
    const violations: SOLIDViolation[] = [];
    const responsibilities = this.identifyResponsibilities(content, className);
    
    if (responsibilities.length > 3) {
      violations.push({
        principle: 'SRP',
        file: filePath,
        severity: responsibilities.length > 5 ? 'critical' : 'high',
        description: `Class ${className} has ${responsibilities.length} responsibilities: ${responsibilities.join(', ')}`,
        suggestion: 'Consider splitting this class into smaller, focused classes with single responsibilities'
      });
    }
    
    // Check for mixed concerns
    const hasDatabaseAndUI = responsibilities.includes('Data Persistence') && responsibilities.includes('User Interface');
    if (hasDatabaseAndUI) {
      violations.push({
        principle: 'SRP',
        file: filePath,
        severity: 'high',
        description: `Class ${className} mixes data persistence and UI concerns`,
        suggestion: 'Separate data access logic from UI presentation logic'
      });
    }
    
    return violations;
  }

  private checkOCPViolations(content: string, filePath: string, className: string): SOLIDViolation[] {
    const violations: SOLIDViolation[] = [];
    
    // Look for switch/if-else chains that might violate OCP
    const switchCount = (content.match(/switch\s*\(/g) || []).length;
    const longIfChains = content.split('else if').length - 1;
    
    if (switchCount > 2 || longIfChains > 4) {
      violations.push({
        principle: 'OCP',
        file: filePath,
        severity: 'medium',
        description: `Class ${className} has complex conditional logic that may violate Open/Closed Principle`,
        suggestion: 'Consider using polymorphism, strategy pattern, or factory pattern to eliminate conditional logic'
      });
    }
    
    return violations;
  }

  private checkLSPViolations(content: string, filePath: string, className: string): SOLIDViolation[] {
    const violations: SOLIDViolation[] = [];
    
    // Look for potential LSP violations in inheritance
    if (content.includes('extends') && content.includes('throw new Error')) {
      violations.push({
        principle: 'LSP',
        file: filePath,
        severity: 'medium',
        description: `Class ${className} may violate LSP by throwing errors in inherited methods`,
        suggestion: 'Ensure subclasses can be substituted for their base classes without breaking functionality'
      });
    }
    
    return violations;
  }

  private checkISPViolations(content: string, filePath: string, className: string): SOLIDViolation[] {
    const violations: SOLIDViolation[] = [];
    
    // Look for large interfaces (simple heuristic)
    const interfaceMatches = content.matchAll(/interface\s+\w+\s*\{([^}]+)\}/g);
    for (const match of interfaceMatches) {
      const interfaceBody = match[1];
      const methods = interfaceBody.split(';').filter(line => line.trim().includes('(')).length;
      
      if (methods > 8) {
        violations.push({
          principle: 'ISP',
          file: filePath,
          severity: 'medium',
          description: `Interface with ${methods} methods may violate Interface Segregation Principle`,
          suggestion: 'Consider breaking large interfaces into smaller, more focused ones'
        });
      }
    }
    
    return violations;
  }

  private checkDIPViolations(content: string, filePath: string, className: string): SOLIDViolation[] {
    const violations: SOLIDViolation[] = [];
    
    // Look for direct instantiation of concrete classes
    const newInstanceCount = (content.match(/new\s+[A-Z][a-zA-Z0-9]*\(/g) || []).length;
    if (newInstanceCount > 3) {
      violations.push({
        principle: 'DIP',
        file: filePath,
        severity: 'medium',
        description: `Class ${className} directly instantiates ${newInstanceCount} concrete classes`,
        suggestion: 'Use dependency injection and depend on abstractions rather than concrete implementations'
      });
    }
    
    return violations;
  }

  private calculateClassComplexity(content: string): number {
    const lines = content.split('\n').length;
    const methods = (content.match(/function|=>/g) || []).length;
    const conditions = (content.match(/if|else|switch|case|\?/g) || []).length;
    const loops = (content.match(/for|while/g) || []).length;
    
    return Math.round((lines / 20) + methods + (conditions * 1.5) + (loops * 1.2));
  }

  private calculateMaintainabilityScore(complexity: number, violations: number, dependencies: number): number {
    // Simple maintainability score (0-1 scale)
    let score = 1.0;
    
    score -= Math.min(complexity / 50, 0.4); // Complexity penalty
    score -= Math.min(violations / 10, 0.3); // Violations penalty
    score -= Math.min(dependencies / 20, 0.2); // Dependencies penalty
    
    return Math.max(score, 0);
  }

  private calculatePrincipleScores(violations: SOLIDViolation[], totalClasses: number): PrincipleScore[] {
    const principles = ['SRP', 'OCP', 'LSP', 'ISP', 'DIP'];
    const scores: PrincipleScore[] = [];
    
    for (const principle of principles) {
      const principleViolations = violations.filter(v => v.principle === principle);
      const criticalCount = principleViolations.filter(v => v.severity === 'critical').length;
      
      let score = 1.0;
      if (totalClasses > 0) {
        score = Math.max(0, 1 - (principleViolations.length / totalClasses));
      }
      
      scores.push({
        principle: this.getPrincipleName(principle),
        score,
        violationCount: principleViolations.length,
        criticalViolations: criticalCount,
        description: this.getPrincipleDescription(principle)
      });
    }
    
    return scores;
  }

  private calculateOverallScore(principleScores: PrincipleScore[]): number {
    if (principleScores.length === 0) return 1.0;
    
    const totalScore = principleScores.reduce((sum, score) => sum + score.score, 0);
    return totalScore / principleScores.length;
  }

  private identifyRefactoringOpportunities(classAnalyses: ClassAnalysis[]): RefactoringOpportunity[] {
    const opportunities: RefactoringOpportunity[] = [];
    
    // Extract class opportunities
    const complexClasses = classAnalyses.filter(c => c.responsibilities.length > 3);
    if (complexClasses.length > 0) {
      opportunities.push({
        type: 'extract_class',
        description: `${complexClasses.length} classes have multiple responsibilities and could be split`,
        files: complexClasses.map(c => c.file),
        estimatedEffort: 'medium',
        benefits: ['Improved maintainability', 'Better testability', 'Clearer responsibilities']
      });
    }
    
    // Dependency injection opportunities
    const highDependencyClasses = classAnalyses.filter(c => c.dependencies.length > 8);
    if (highDependencyClasses.length > 0) {
      opportunities.push({
        type: 'dependency_injection',
        description: `${highDependencyClasses.length} classes have many dependencies and could benefit from DI`,
        files: highDependencyClasses.map(c => c.file),
        estimatedEffort: 'medium',
        benefits: ['Improved testability', 'Better decoupling', 'Easier mocking']
      });
    }
    
    return opportunities;
  }

  private generateRecommendations(violations: SOLIDViolation[], scores: PrincipleScore[], opportunities: RefactoringOpportunity[]): string[] {
    const recommendations: string[] = [];
    
    // Critical violations
    const criticalViolations = violations.filter(v => v.severity === 'critical');
    if (criticalViolations.length > 0) {
      recommendations.push(`Address ${criticalViolations.length} critical SOLID principle violations immediately`);
    }
    
    // Low principle scores
    const lowScores = scores.filter(s => s.score < 0.7);
    if (lowScores.length > 0) {
      recommendations.push(`Focus on improving ${lowScores.map(s => s.principle).join(', ')} adherence`);
    }
    
    // Refactoring opportunities
    if (opportunities.length > 0) {
      recommendations.push(`Consider ${opportunities.length} refactoring opportunities to improve architecture`);
    }
    
    if (recommendations.length === 0) {
      recommendations.push('SOLID principles adherence appears good - continue maintaining quality standards');
    }
    
    return recommendations;
  }

  // Helper methods
  private getPrincipleName(principle: string): string {
    const names: Record<string, string> = {
      'SRP': 'Single Responsibility Principle',
      'OCP': 'Open/Closed Principle',
      'LSP': 'Liskov Substitution Principle',
      'ISP': 'Interface Segregation Principle',
      'DIP': 'Dependency Inversion Principle'
    };
    return names[principle] || principle;
  }

  private getPrincipleDescription(principle: string): string {
    const descriptions: Record<string, string> = {
      'SRP': 'A class should have only one reason to change',
      'OCP': 'Software entities should be open for extension, closed for modification',
      'LSP': 'Objects should be replaceable with instances of their subtypes',
      'ISP': 'Clients should not depend on interfaces they do not use',
      'DIP': 'Depend on abstractions, not concretions'
    };
    return descriptions[principle] || principle;
  }
}

export default SOLIDPrinciplesAnalyzer;