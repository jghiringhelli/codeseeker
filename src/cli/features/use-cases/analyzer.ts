/**
 * Use Cases Analyzer - Simplified Business Logic Understanding
 * Maps business requirements to code implementation for Claude Code context enhancement
 */

import { Logger } from '../../../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'fast-glob';

export interface UseCasesAnalysisRequest {
  projectPath: string;
  businessDocsPath?: string;
  excludePatterns?: string[];
}

export interface UseCase {
  id: string;
  name: string;
  description: string;
  source: 'documentation' | 'code' | 'api';
  files: string[];
  endpoints?: string[];
  businessValue: 'high' | 'medium' | 'low';
  implementationStatus: 'complete' | 'partial' | 'missing';
}

export interface BusinessLogicFile {
  path: string;
  type: 'service' | 'controller' | 'model' | 'business' | 'other';
  useCases: string[];
  complexity: number;
  businessMethods: string[];
}

export interface UseCasesAnalysisResult {
  useCases: UseCase[];
  businessLogicFiles: BusinessLogicFile[];
  businessCoverage: number;
  separationScore: number;
  recommendations: string[];
  architectureHealth: {
    score: number;
    issues: string[];
    strengths: string[];
  };
}

export class UseCasesAnalyzer {
  private logger = Logger.getInstance();

  async analyzeUseCases(params: UseCasesAnalysisRequest): Promise<UseCasesAnalysisResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info('🎯 Starting use cases analysis...');

      // 1. Discover use cases from multiple sources
      const useCases = await this.discoverUseCases(params.projectPath, params.businessDocsPath);
      
      // 2. Analyze business logic in code
      const businessLogicFiles = await this.analyzeBusinessLogic(params.projectPath);
      
      // 3. Calculate coverage and health metrics
      const businessCoverage = this.calculateBusinessCoverage(useCases, businessLogicFiles);
      const separationScore = this.calculateSeparationScore(businessLogicFiles);
      const architectureHealth = this.assessArchitectureHealth(businessLogicFiles, useCases);
      
      // 4. Generate actionable recommendations
      const recommendations = this.generateRecommendations(useCases, businessLogicFiles, architectureHealth);

      const result: UseCasesAnalysisResult = {
        useCases,
        businessLogicFiles,
        businessCoverage,
        separationScore,
        recommendations,
        architectureHealth
      };

      const duration = Date.now() - startTime;
      this.logger.info(`✅ Use cases analysis completed in ${duration}ms`, {
        useCasesFound: useCases.length,
        businessFilesAnalyzed: businessLogicFiles.length,
        businessCoverage: Math.round(businessCoverage * 100),
        separationScore: Math.round(separationScore * 100)
      });

      return result;
    } catch (error) {
      this.logger.error('❌ Use cases analysis failed:', error);
      throw error;
    }
  }

  private async discoverUseCases(projectPath: string, businessDocsPath?: string): Promise<UseCase[]> {
    const useCases: UseCase[] = [];

    // Discover from documentation
    if (businessDocsPath) {
      const docUseCases = await this.parseDocumentationUseCases(businessDocsPath);
      useCases.push(...docUseCases);
    }

    // Discover from API endpoints
    const apiUseCases = await this.inferUseCasesFromAPI(projectPath);
    useCases.push(...apiUseCases);

    // Discover from code patterns
    const codeUseCases = await this.inferUseCasesFromCode(projectPath);
    useCases.push(...codeUseCases);

    return this.deduplicateUseCases(useCases);
  }

  private async parseDocumentationUseCases(docsPath: string): Promise<UseCase[]> {
    const useCases: UseCase[] = [];
    
    try {
      const docFiles = await glob('**/*.{md,txt,rst}', { cwd: docsPath });
      
      for (const file of docFiles.slice(0, 10)) { // Limit to prevent overwhelming
        const content = await fs.readFile(path.join(docsPath, file), 'utf-8');
        const extractedUseCases = this.extractUseCasesFromText(content, file);
        useCases.push(...extractedUseCases);
      }
    } catch (error) {
      this.logger.warn('Could not parse documentation use cases:', error);
    }

    return useCases;
  }

  private async inferUseCasesFromAPI(projectPath: string): Promise<UseCase[]> {
    const useCases: UseCase[] = [];
    
    try {
      const apiFiles = await glob('**/*.{ts,js}', {
        cwd: projectPath,
        ignore: ['node_modules/**', 'dist/**', '**/*.test.*', '**/*.spec.*']
      });

      for (const file of apiFiles) {
        const content = await fs.readFile(path.join(projectPath, file), 'utf-8');
        
        // Look for API endpoints/routes
        const endpointMatches = content.match(/(get|post|put|delete|patch)\s*\(['"`]([^'"`]+)['"`]/gi);
        if (endpointMatches) {
          for (const match of endpointMatches) {
            const endpoint = match.match(/['"`]([^'"`]+)['"`]/)?.[1];
            if (endpoint) {
              useCases.push({
                id: `api_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`,
                name: this.endpointToUseCaseName(endpoint),
                description: `API endpoint: ${endpoint}`,
                source: 'api',
                files: [file],
                endpoints: [endpoint],
                businessValue: 'medium',
                implementationStatus: 'complete'
              });
            }
          }
        }
      }
    } catch (error) {
      this.logger.warn('Could not infer use cases from API:', error);
    }

    return useCases;
  }

  private async inferUseCasesFromCode(projectPath: string): Promise<UseCase[]> {
    const useCases: UseCase[] = [];
    
    try {
      const codeFiles = await glob('**/*.{ts,js}', {
        cwd: projectPath,
        ignore: ['node_modules/**', 'dist/**', '**/*.test.*', '**/*.spec.*']
      });

      for (const file of codeFiles.slice(0, 20)) { // Limit to prevent overwhelming
        const content = await fs.readFile(path.join(projectPath, file), 'utf-8');
        
        // Look for business logic patterns
        const businessMethods = this.extractBusinessMethods(content);
        if (businessMethods.length > 0) {
          for (const method of businessMethods.slice(0, 3)) { // Limit methods per file
            useCases.push({
              id: `code_${path.basename(file, path.extname(file))}_${method}`,
              name: this.methodToUseCaseName(method),
              description: `Business logic method in ${file}`,
              source: 'code',
              files: [file],
              businessValue: 'medium',
              implementationStatus: 'complete'
            });
          }
        }
      }
    } catch (error) {
      this.logger.warn('Could not infer use cases from code:', error);
    }

    return useCases;
  }

  private async analyzeBusinessLogic(projectPath: string): Promise<BusinessLogicFile[]> {
    const businessFiles: BusinessLogicFile[] = [];
    
    try {
      const codeFiles = await glob('**/*.{ts,js}', {
        cwd: projectPath,
        ignore: ['node_modules/**', 'dist/**', '**/*.test.*', '**/*.spec.*']
      });

      for (const file of codeFiles.slice(0, 30)) { // Reasonable limit
        const content = await fs.readFile(path.join(projectPath, file), 'utf-8');
        const businessMethods = this.extractBusinessMethods(content);
        
        if (businessMethods.length > 0) {
          businessFiles.push({
            path: file,
            type: this.determineFileType(file, content),
            useCases: businessMethods,
            complexity: this.calculateFileComplexity(content),
            businessMethods
          });
        }
      }
    } catch (error) {
      this.logger.warn('Could not analyze business logic:', error);
    }

    return businessFiles;
  }

  private extractUseCasesFromText(content: string, filename: string): UseCase[] {
    const useCases: UseCase[] = [];
    
    // Simple patterns for use case extraction
    const patterns = [
      /(?:use case|user story|scenario|requirement)[\s:]*([^\n.!?]+)/gi,
      /(?:as a|when|given|then)[\s]*([^\n.!?]+)/gi
    ];

    let id = 0;
    for (const pattern of patterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 10 && match[1].length < 100) {
          useCases.push({
            id: `doc_${filename}_${id++}`,
            name: match[1].trim(),
            description: `Use case from ${filename}`,
            source: 'documentation',
            files: [filename],
            businessValue: 'high',
            implementationStatus: 'partial'
          });
        }
      }
    }

    return useCases.slice(0, 5); // Limit per file
  }

  private extractBusinessMethods(content: string): string[] {
    const methods: string[] = [];
    
    // Look for method patterns that suggest business logic
    const patterns = [
      /(?:function|async function)\s+([a-zA-Z][a-zA-Z0-9]*(?:User|Order|Payment|Product|Invoice|Report|Process|Handle|Manage|Create|Update|Delete|Calculate|Validate)[a-zA-Z0-9]*)/g,
      /([a-zA-Z][a-zA-Z0-9]*(?:Service|Manager|Handler|Controller|Processor))/g
    ];

    for (const pattern of patterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && methods.indexOf(match[1]) === -1) {
          methods.push(match[1]);
        }
      }
    }

    return methods.slice(0, 5); // Limit per file
  }

  private deduplicateUseCases(useCases: UseCase[]): UseCase[] {
    const seen = new Set<string>();
    return useCases.filter(useCase => {
      const key = useCase.name.toLowerCase().replace(/\s+/g, ' ').trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private calculateBusinessCoverage(useCases: UseCase[], businessFiles: BusinessLogicFile[]): number {
    if (useCases.length === 0) return 0;
    const implementedCount = useCases.filter(uc => uc.implementationStatus === 'complete').length;
    return implementedCount / useCases.length;
  }

  private calculateSeparationScore(businessFiles: BusinessLogicFile[]): number {
    if (businessFiles.length === 0) return 1;
    
    const serviceFiles = businessFiles.filter(f => f.type === 'service' || f.type === 'business').length;
    return Math.min(serviceFiles / businessFiles.length, 1);
  }

  private assessArchitectureHealth(businessFiles: BusinessLogicFile[], useCases: UseCase[]) {
    const issues: string[] = [];
    const strengths: string[] = [];
    
    // Check for business logic concentration
    const avgMethodsPerFile = businessFiles.reduce((sum, f) => sum + f.businessMethods.length, 0) / businessFiles.length;
    if (avgMethodsPerFile > 10) {
      issues.push('High concentration of business methods per file');
    } else if (avgMethodsPerFile < 3) {
      strengths.push('Well-distributed business logic');
    }

    // Check use case coverage
    const coverageRatio = useCases.filter(uc => uc.implementationStatus === 'complete').length / useCases.length;
    if (coverageRatio < 0.7) {
      issues.push('Low use case implementation coverage');
    } else if (coverageRatio > 0.9) {
      strengths.push('High use case implementation coverage');
    }

    const score = Math.max(0, 1 - (issues.length * 0.2));
    
    return { score, issues, strengths };
  }

  private generateRecommendations(useCases: UseCase[], businessFiles: BusinessLogicFile[], health: any): string[] {
    const recommendations: string[] = [];
    
    if (health.score < 0.7) {
      recommendations.push('Consider refactoring business logic for better separation of concerns');
    }
    
    const incompleteUseCases = useCases.filter(uc => uc.implementationStatus !== 'complete');
    if (incompleteUseCases.length > 0) {
      recommendations.push(`${incompleteUseCases.length} use cases need implementation or completion`);
    }
    
    const complexFiles = businessFiles.filter(f => f.complexity > 15);
    if (complexFiles.length > 0) {
      recommendations.push(`${complexFiles.length} files have high complexity and may need refactoring`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Business logic architecture appears well-structured');
    }

    return recommendations;
  }

  // Helper methods
  private endpointToUseCaseName(endpoint: string): string {
    return endpoint
      .replace(/^\//, '')
      .replace(/\//g, ' ')
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') || 'API Endpoint';
  }

  private methodToUseCaseName(method: string): string {
    return method
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private determineFileType(filepath: string, content: string): 'service' | 'controller' | 'model' | 'business' | 'other' {
    const filename = path.basename(filepath).toLowerCase();
    
    if (filename.includes('service')) return 'service';
    if (filename.includes('controller')) return 'controller';
    if (filename.includes('model')) return 'model';
    if (content.includes('business') || content.includes('logic')) return 'business';
    
    return 'other';
  }

  private calculateFileComplexity(content: string): number {
    // Simple complexity calculation
    const lines = content.split('\n').length;
    const functions = (content.match(/function|=>/g) || []).length;
    const conditions = (content.match(/if|else|switch|case|\?/g) || []).length;
    
    return Math.round((lines / 10) + functions + (conditions * 1.5));
  }
}

export default UseCasesAnalyzer;