import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'fast-glob';
import { ASTAnalyzer, Symbol, ASTAnalysisResult } from '../../../shared/ast/analyzer';
import { Logger } from '../../../utils/logger';
import { createHash } from 'crypto';

export interface DuplicationScanRequest {
  projectPath: string;
  includeSemantic: boolean;
  similarityThreshold: number;
  includeRefactoringSuggestions: boolean;
  filePatterns?: string[];
  excludePatterns?: string[];
}

export interface DuplicationResult {
  duplicates: DuplicationGroup[];
  scanInfo: ScanInfo;
  statistics: DuplicationStatistics;
}

export interface DuplicationGroup {
  id: string;
  type: DuplicationType;
  similarity: number;
  locations: CodeLocation[];
  refactoring?: RefactoringAdvice;
  metadata: {
    linesOfCode: number;
    tokenCount: number;
    complexity: number;
  };
}

export interface CodeLocation {
  file: string;
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
  codeSnippet: string;
  hash: string;
}

export interface RefactoringAdvice {
  approach: RefactoringApproach;
  description: string;
  estimatedEffort: EffortEstimate;
  steps: string[];
  example?: string;
  impact: RefactoringImpact;
}

export interface ScanInfo {
  totalFiles: number;
  analyzedFiles: number;
  skippedFiles: number;
  processingTime: number;
  timestamp: Date;
}

export interface DuplicationStatistics {
  totalDuplicates: number;
  byType: Record<DuplicationType, number>;
  bySeverity: Record<'low' | 'medium' | 'high' | 'critical', number>;
  estimatedTechnicalDebt: {
    linesOfCode: number;
    maintenanceHours: number;
    riskScore: number;
  };
}

export enum DuplicationType {
  EXACT = 'exact',
  STRUCTURAL = 'structural', 
  SEMANTIC = 'semantic',
  RENAMED = 'renamed'
}

export enum RefactoringApproach {
  EXTRACT_FUNCTION = 'extract_function',
  EXTRACT_CLASS = 'extract_class',
  EXTRACT_UTILITY = 'extract_utility',
  USE_INHERITANCE = 'use_inheritance',
  APPLY_STRATEGY_PATTERN = 'apply_strategy_pattern',
  CONSOLIDATE_CONFIGURATION = 'consolidate_configuration'
}

export enum EffortEstimate {
  LOW = 'low',        // < 30 minutes
  MEDIUM = 'medium',  // 30 minutes - 2 hours
  HIGH = 'high',      // 2-8 hours
  VERY_HIGH = 'very_high' // > 8 hours
}

export interface RefactoringImpact {
  maintainability: number;  // 0-100
  testability: number;     // 0-100
  reusability: number;     // 0-100
  riskLevel: number;       // 0-100
}

interface CodeBlock {
  content: string;
  hash: string;
  location: CodeLocation;
  astInfo?: ASTAnalysisResult;
  tokens: string[];
  structure: StructuralFingerprint;
}

interface StructuralFingerprint {
  functionCount: number;
  classCount: number;
  variableCount: number;
  controlFlowHash: string;
  dependencyHash: string;
}

export class DuplicationDetector {
  private logger = Logger.getInstance();
  private astAnalyzer = new ASTAnalyzer();

  async findDuplicates(request: DuplicationScanRequest): Promise<DuplicationResult> {
    const startTime = Date.now();
    this.logger.info(`Starting duplication detection in ${request.projectPath}`);

    const scanInfo: ScanInfo = {
      totalFiles: 0,
      analyzedFiles: 0,
      skippedFiles: 0,
      processingTime: 0,
      timestamp: new Date()
    };

    try {
      // Get all files to analyze
      const files = await this.getProjectFiles(request.projectPath, request.filePatterns, request.excludePatterns);
      scanInfo.totalFiles = files.length;

      // Extract code blocks from all files
      const codeBlocks: CodeBlock[] = [];
      
      for (const file of files) {
        try {
          const blocks = await this.extractCodeBlocks(path.join(request.projectPath, file));
          codeBlocks.push(...blocks);
          scanInfo.analyzedFiles++;
        } catch (error) {
          this.logger.warn(`Failed to analyze file ${file}`, error);
          scanInfo.skippedFiles++;
        }
      }

      // Find duplications
      const duplicateGroups = await this.findDuplicateGroups(
        codeBlocks, 
        request.similarityThreshold,
        request.includeSemantic
      );

      // Generate refactoring advice if requested
      if (request.includeRefactoringSuggestions) {
        for (const group of duplicateGroups) {
          group.refactoring = await this.generateRefactoringAdvice(group);
        }
      }

      scanInfo.processingTime = Date.now() - startTime;

      const statistics = this.calculateStatistics(duplicateGroups);

      this.logger.info(`Duplication detection completed: found ${duplicateGroups.length} duplicate groups in ${scanInfo.processingTime}ms`);

      return {
        duplicates: duplicateGroups,
        scanInfo,
        statistics
      };

    } catch (error) {
      this.logger.error('Duplication detection failed', error);
      throw error;
    }
  }

  private async getProjectFiles(
    projectPath: string,
    includePatterns?: string[],
    excludePatterns?: string[]
  ): Promise<string[]> {
    const defaultPatterns = [
      '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.py'
    ];

    const defaultExcludes = [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/*.min.js',
      '**/*.test.*',
      '**/*.spec.*',
      '**/__tests__/**',
      '**/coverage/**'
    ];

    return await glob(includePatterns || defaultPatterns, {
      cwd: projectPath,
      ignore: [...defaultExcludes, ...(excludePatterns || [])],
      onlyFiles: true
    });
  }

  private async extractCodeBlocks(filePath: string): Promise<CodeBlock[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const blocks: CodeBlock[] = [];

    // Extract function-level blocks
    const astResult = await this.astAnalyzer.analyzeFile(filePath);
    
    for (const symbol of astResult.symbols) {
      if (symbol.type === 'function' || symbol.type === 'method' || symbol.type === 'class') {
        const blockContent = this.extractBlockContent(
          lines,
          symbol.location.line - 1,
          symbol.location.endLine ? symbol.location.endLine - 1 : symbol.location.line + 10
        );

        if (blockContent.trim().length > 50) { // Only consider substantial blocks
          const block: CodeBlock = {
            content: blockContent,
            hash: this.calculateHash(blockContent),
            location: {
              file: filePath,
              startLine: symbol.location.line,
              endLine: symbol.location.endLine || symbol.location.line + 10,
              startColumn: symbol.location.column,
              endColumn: symbol.location.endColumn,
              codeSnippet: blockContent.substring(0, 200) + (blockContent.length > 200 ? '...' : ''),
              hash: this.calculateHash(blockContent)
            },
            astInfo: astResult,
            tokens: this.tokenizeCode(blockContent),
            structure: this.calculateStructuralFingerprint(blockContent, astResult)
          };

          blocks.push(block);
        }
      }
    }

    // Also extract larger code blocks (50+ lines)
    for (let i = 0; i < lines.length - 50; i += 25) {
      const blockContent = this.extractBlockContent(lines, i, i + 50);
      if (this.isSignificantBlock(blockContent)) {
        const block: CodeBlock = {
          content: blockContent,
          hash: this.calculateHash(blockContent),
          location: {
            file: filePath,
            startLine: i + 1,
            endLine: i + 51,
            codeSnippet: blockContent.substring(0, 200) + (blockContent.length > 200 ? '...' : ''),
            hash: this.calculateHash(blockContent)
          },
          tokens: this.tokenizeCode(blockContent),
          structure: this.calculateStructuralFingerprint(blockContent, astResult)
        };

        blocks.push(block);
      }
    }

    return blocks;
  }

  private extractBlockContent(lines: string[], startIndex: number, endIndex: number): string {
    return lines.slice(startIndex, Math.min(endIndex, lines.length)).join('\n');
  }

  private isSignificantBlock(content: string): boolean {
    const lines = content.split('\n');
    const meaningfulLines = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 && 
             !trimmed.startsWith('//') && 
             !trimmed.startsWith('/*') &&
             !trimmed.startsWith('*') &&
             trimmed !== '{' &&
             trimmed !== '}';
    });

    return meaningfulLines.length >= 10;
  }

  private calculateHash(content: string): string {
    // Normalize content for better duplicate detection
    const normalized = content
      .replace(/\s+/g, ' ')           // Normalize whitespace
      .replace(/\/\/.*$/gm, '')       // Remove single-line comments
      .replace(/\/\*.*?\*\//gs, '')   // Remove multi-line comments
      .trim();
    
    return createHash('md5').update(normalized).digest('hex');
  }

  private tokenizeCode(content: string): string[] {
    // Simple tokenization - in a full implementation, use proper language-aware tokenizers
    return content
      .replace(/[^\w\s]/g, ' ')       // Replace punctuation with spaces
      .split(/\s+/)
      .filter(token => token.length > 2)
      .map(token => token.toLowerCase());
  }

  private calculateStructuralFingerprint(content: string, astResult: ASTAnalysisResult): StructuralFingerprint {
    const functionCount = astResult.symbols.filter(s => s.type === 'function').length;
    const classCount = astResult.symbols.filter(s => s.type === 'class').length;
    const variableCount = astResult.symbols.filter(s => s.type === 'variable').length;
    
    // Simple control flow fingerprint
    const controlFlowElements = [
      (content.match(/if\s*\(/g) || []).length,
      (content.match(/for\s*\(/g) || []).length,
      (content.match(/while\s*\(/g) || []).length,
      (content.match(/switch\s*\(/g) || []).length
    ];

    const controlFlowHash = createHash('md5')
      .update(controlFlowElements.join(','))
      .digest('hex')
      .substring(0, 8);

    const dependencyHash = createHash('md5')
      .update(astResult.dependencies.map(d => d.target).sort().join(','))
      .digest('hex')
      .substring(0, 8);

    return {
      functionCount,
      classCount,
      variableCount,
      controlFlowHash,
      dependencyHash
    };
  }

  private async findDuplicateGroups(
    blocks: CodeBlock[],
    threshold: number,
    includeSemantic: boolean
  ): Promise<DuplicationGroup[]> {
    const groups: DuplicationGroup[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < blocks.length; i++) {
      if (processed.has(blocks[i].hash)) continue;

      const duplicates: CodeBlock[] = [];
      
      for (let j = i + 1; j < blocks.length; j++) {
        if (processed.has(blocks[j].hash)) continue;

        const similarity = await this.calculateSimilarity(
          blocks[i], 
          blocks[j], 
          includeSemantic
        );

        if (similarity >= threshold) {
          duplicates.push(blocks[j]);
          processed.add(blocks[j].hash);
        }
      }

      if (duplicates.length > 0) {
        duplicates.unshift(blocks[i]); // Add the original block
        processed.add(blocks[i].hash);

        const group: DuplicationGroup = {
          id: `dup_${groups.length + 1}`,
          type: this.determineDuplicationType(duplicates),
          similarity: this.calculateGroupSimilarity(duplicates),
          locations: duplicates.map(block => block.location),
          metadata: {
            linesOfCode: duplicates[0].content.split('\n').length,
            tokenCount: duplicates[0].tokens.length,
            complexity: duplicates[0].astInfo?.complexity || 1
          }
        };

        groups.push(group);
      }
    }

    return groups;
  }

  private async calculateSimilarity(
    block1: CodeBlock,
    block2: CodeBlock,
    includeSemantic: boolean
  ): Promise<number> {
    // Exact match
    if (block1.hash === block2.hash) {
      return 1.0;
    }

    // Structural similarity
    const structuralSimilarity = this.calculateStructuralSimilarity(block1, block2);

    // Token-based similarity (Jaccard similarity)
    const tokenSimilarity = this.calculateTokenSimilarity(block1.tokens, block2.tokens);

    let semanticSimilarity = 0;
    if (includeSemantic) {
      semanticSimilarity = await this.calculateSemanticSimilarity(block1, block2);
    }

    // Weighted combination
    const weights = {
      structural: 0.4,
      token: 0.4,
      semantic: 0.2
    };

    return (
      structuralSimilarity * weights.structural +
      tokenSimilarity * weights.token +
      semanticSimilarity * weights.semantic
    );
  }

  private calculateStructuralSimilarity(block1: CodeBlock, block2: CodeBlock): number {
    const s1 = block1.structure;
    const s2 = block2.structure;

    let similarity = 0;
    let factors = 0;

    // Function count similarity
    if (s1.functionCount > 0 || s2.functionCount > 0) {
      similarity += 1 - Math.abs(s1.functionCount - s2.functionCount) / Math.max(s1.functionCount, s2.functionCount, 1);
      factors++;
    }

    // Class count similarity
    if (s1.classCount > 0 || s2.classCount > 0) {
      similarity += 1 - Math.abs(s1.classCount - s2.classCount) / Math.max(s1.classCount, s2.classCount, 1);
      factors++;
    }

    // Control flow similarity
    similarity += s1.controlFlowHash === s2.controlFlowHash ? 1 : 0;
    factors++;

    // Dependency similarity
    similarity += s1.dependencyHash === s2.dependencyHash ? 1 : 0;
    factors++;

    return factors > 0 ? similarity / factors : 0;
  }

  private calculateTokenSimilarity(tokens1: string[], tokens2: string[]): number {
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private async calculateSemanticSimilarity(block1: CodeBlock, block2: CodeBlock): Promise<number> {
    // Placeholder for semantic similarity calculation
    // In a full implementation, this would use embeddings/ML models
    
    // Simple heuristic: check for similar variable names and function calls
    const vars1 = this.extractVariableNames(block1.content);
    const vars2 = this.extractVariableNames(block2.content);
    
    const calls1 = this.extractFunctionCalls(block1.content);
    const calls2 = this.extractFunctionCalls(block2.content);
    
    const varSimilarity = this.calculateTokenSimilarity(vars1, vars2);
    const callSimilarity = this.calculateTokenSimilarity(calls1, calls2);
    
    return (varSimilarity + callSimilarity) / 2;
  }

  private extractVariableNames(content: string): string[] {
    const patterns = [
      /\b(?:let|const|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
      /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g
    ];
    
    const variables: string[] = [];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        variables.push(match[1].toLowerCase());
      }
    }
    
    return [...new Set(variables)];
  }

  private extractFunctionCalls(content: string): string[] {
    const pattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
    const calls: string[] = [];
    
    let match;
    while ((match = pattern.exec(content)) !== null) {
      calls.push(match[1].toLowerCase());
    }
    
    return [...new Set(calls)];
  }

  private determineDuplicationType(blocks: CodeBlock[]): DuplicationType {
    // Check if all blocks have identical hashes
    const hashes = blocks.map(b => b.hash);
    if (new Set(hashes).size === 1) {
      return DuplicationType.EXACT;
    }

    // Check structural similarity
    const firstStructure = blocks[0].structure;
    const structurallyIdentical = blocks.every(block => 
      block.structure.controlFlowHash === firstStructure.controlFlowHash &&
      block.structure.dependencyHash === firstStructure.dependencyHash
    );

    if (structurallyIdentical) {
      return DuplicationType.STRUCTURAL;
    }

    // Check for renamed variables (high token similarity)
    const avgTokenSimilarity = this.calculateAverageTokenSimilarity(blocks);
    if (avgTokenSimilarity > 0.8) {
      return DuplicationType.RENAMED;
    }

    return DuplicationType.SEMANTIC;
  }

  private calculateAverageTokenSimilarity(blocks: CodeBlock[]): number {
    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        totalSimilarity += this.calculateTokenSimilarity(blocks[i].tokens, blocks[j].tokens);
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  private calculateGroupSimilarity(blocks: CodeBlock[]): number {
    if (blocks.length < 2) return 1.0;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        totalSimilarity += this.calculateTokenSimilarity(blocks[i].tokens, blocks[j].tokens);
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  private async generateRefactoringAdvice(group: DuplicationGroup): Promise<RefactoringAdvice> {
    const linesOfCode = group.metadata.linesOfCode;
    const complexity = group.metadata.complexity;
    const duplicateCount = group.locations.length;

    // Determine refactoring approach based on duplication characteristics
    let approach = RefactoringApproach.EXTRACT_FUNCTION;
    let effort = EffortEstimate.LOW;

    if (linesOfCode > 100) {
      approach = RefactoringApproach.EXTRACT_CLASS;
      effort = EffortEstimate.HIGH;
    } else if (complexity > 10) {
      approach = RefactoringApproach.APPLY_STRATEGY_PATTERN;
      effort = EffortEstimate.MEDIUM;
    } else if (duplicateCount > 5) {
      approach = RefactoringApproach.EXTRACT_UTILITY;
      effort = EffortEstimate.MEDIUM;
    }

    const advice: RefactoringAdvice = {
      approach,
      description: this.getRefactoringDescription(approach, group),
      estimatedEffort: effort,
      steps: this.getRefactoringSteps(approach, group),
      impact: {
        maintainability: this.calculateMaintainabilityImpact(approach, group),
        testability: this.calculateTestabilityImpact(approach, group),
        reusability: this.calculateReusabilityImpact(approach, group),
        riskLevel: this.calculateRiskLevel(approach, group)
      }
    };

    // Add example if beneficial
    if (approach === RefactoringApproach.EXTRACT_FUNCTION) {
      advice.example = this.generateExtractionExample(group);
    }

    return advice;
  }

  private getRefactoringDescription(approach: RefactoringApproach, group: DuplicationGroup): string {
    const locations = group.locations.length;
    const lines = group.metadata.linesOfCode;

    const descriptions = {
      [RefactoringApproach.EXTRACT_FUNCTION]: 
        `Extract the duplicated ${lines}-line code block into a reusable function. This will eliminate ${locations} duplicates and improve maintainability.`,
      
      [RefactoringApproach.EXTRACT_CLASS]: 
        `The large duplicated block (${lines} lines) should be extracted into a separate class. This will improve code organization and reduce coupling.`,
      
      [RefactoringApproach.EXTRACT_UTILITY]: 
        `Create a utility module for this commonly duplicated functionality (found in ${locations} locations). This will centralize the logic and make it reusable.`,
      
      [RefactoringApproach.USE_INHERITANCE]: 
        `Consider using inheritance or composition to eliminate this duplication. The similar structure suggests a common base class could be beneficial.`,
      
      [RefactoringApproach.APPLY_STRATEGY_PATTERN]: 
        `The complex duplicated logic (complexity: ${group.metadata.complexity}) could benefit from the Strategy pattern to reduce duplication while maintaining flexibility.`,
      
      [RefactoringApproach.CONSOLIDATE_CONFIGURATION]: 
        `This appears to be configuration or constant duplication. Consider centralizing these values in a configuration file or constants module.`
    };

    return descriptions[approach] || 'Consider refactoring to eliminate duplication.';
  }

  private getRefactoringSteps(approach: RefactoringApproach, group: DuplicationGroup): string[] {
    const baseSteps = [
      'Identify all locations of the duplicated code',
      'Ensure all duplicates have the same behavior',
      'Create comprehensive tests for the existing functionality'
    ];

    const specificSteps = {
      [RefactoringApproach.EXTRACT_FUNCTION]: [
        'Extract the common code into a new function',
        'Replace all duplicates with calls to the new function',
        'Update function parameters to handle variations',
        'Test all affected areas'
      ],
      
      [RefactoringApproach.EXTRACT_CLASS]: [
        'Design a new class to encapsulate the duplicated logic',
        'Move shared state and behavior to the new class',
        'Update all usage sites to use the new class',
        'Refactor tests to cover the new class'
      ],
      
      [RefactoringApproach.EXTRACT_UTILITY]: [
        'Create a new utility module',
        'Move the common functionality to the utility',
        'Add proper error handling and validation',
        'Update imports in all affected files'
      ]
    };

    return [
      ...baseSteps,
      ...(specificSteps[approach] || ['Apply appropriate refactoring technique'])
    ];
  }

  private calculateMaintainabilityImpact(approach: RefactoringApproach, group: DuplicationGroup): number {
    const baseImpact = Math.min(90, 30 + (group.locations.length * 10));
    
    const approachMultipliers = {
      [RefactoringApproach.EXTRACT_FUNCTION]: 1.0,
      [RefactoringApproach.EXTRACT_CLASS]: 1.2,
      [RefactoringApproach.EXTRACT_UTILITY]: 1.1,
      [RefactoringApproach.USE_INHERITANCE]: 0.9,
      [RefactoringApproach.APPLY_STRATEGY_PATTERN]: 1.3,
      [RefactoringApproach.CONSOLIDATE_CONFIGURATION]: 1.1
    };

    return Math.min(100, baseImpact * (approachMultipliers[approach] || 1.0));
  }

  private calculateTestabilityImpact(approach: RefactoringApproach, group: DuplicationGroup): number {
    // Extracting code generally improves testability
    return Math.min(100, 40 + (group.metadata.complexity * 5));
  }

  private calculateReusabilityImpact(approach: RefactoringApproach, group: DuplicationGroup): number {
    const base = Math.min(90, 50 + (group.locations.length * 8));
    
    if (approach === RefactoringApproach.EXTRACT_UTILITY || 
        approach === RefactoringApproach.EXTRACT_FUNCTION) {
      return Math.min(100, base * 1.2);
    }
    
    return base;
  }

  private calculateRiskLevel(approach: RefactoringApproach, group: DuplicationGroup): number {
    let risk = 20; // Base risk
    
    // Higher complexity increases risk
    risk += group.metadata.complexity * 2;
    
    // More locations increase risk
    risk += group.locations.length * 3;
    
    // Large code blocks increase risk
    if (group.metadata.linesOfCode > 50) {
      risk += 15;
    }
    
    // Some approaches are riskier than others
    const approachRisk = {
      [RefactoringApproach.EXTRACT_FUNCTION]: 0,
      [RefactoringApproach.EXTRACT_UTILITY]: 5,
      [RefactoringApproach.EXTRACT_CLASS]: 10,
      [RefactoringApproach.USE_INHERITANCE]: 15,
      [RefactoringApproach.APPLY_STRATEGY_PATTERN]: 20,
      [RefactoringApproach.CONSOLIDATE_CONFIGURATION]: 5
    };
    
    risk += approachRisk[approach] || 10;
    
    return Math.min(100, risk);
  }

  private generateExtractionExample(group: DuplicationGroup): string {
    const firstLocation = group.locations[0];
    const functionName = this.suggestFunctionName(firstLocation.codeSnippet);
    
    return `
// Before: Duplicated code in multiple files
${firstLocation.codeSnippet.substring(0, 100)}...

// After: Extracted function
function ${functionName}(params) {
  // Extracted common logic
  ${firstLocation.codeSnippet.substring(0, 50)}...
  return result;
}

// Usage:
const result = ${functionName}(arguments);
    `.trim();
  }

  private suggestFunctionName(codeSnippet: string): string {
    // Simple name suggestion based on code content
    if (codeSnippet.includes('validate')) return 'validateInput';
    if (codeSnippet.includes('format')) return 'formatData';
    if (codeSnippet.includes('calculate')) return 'calculateValue';
    if (codeSnippet.includes('transform')) return 'transformData';
    if (codeSnippet.includes('process')) return 'processData';
    
    return 'extractedFunction';
  }

  private calculateStatistics(groups: DuplicationGroup[]): DuplicationStatistics {
    const byType: Record<DuplicationType, number> = {
      [DuplicationType.EXACT]: 0,
      [DuplicationType.STRUCTURAL]: 0,
      [DuplicationType.SEMANTIC]: 0,
      [DuplicationType.RENAMED]: 0
    };

    const bySeverity: Record<'low' | 'medium' | 'high' | 'critical', number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    let totalLines = 0;
    let totalComplexity = 0;

    for (const group of groups) {
      byType[group.type]++;
      
      const severity = this.getSeverity(group);
      bySeverity[severity]++;
      
      totalLines += group.metadata.linesOfCode * (group.locations.length - 1);
      totalComplexity += group.metadata.complexity;
    }

    const maintenanceHours = Math.ceil(totalLines / 100) + Math.ceil(totalComplexity / 5);
    const riskScore = Math.min(100, (groups.length * 10) + (totalComplexity * 2));

    return {
      totalDuplicates: groups.length,
      byType,
      bySeverity,
      estimatedTechnicalDebt: {
        linesOfCode: totalLines,
        maintenanceHours,
        riskScore
      }
    };
  }

  private getSeverity(group: DuplicationGroup): 'low' | 'medium' | 'high' | 'critical' {
    const lines = group.metadata.linesOfCode;
    const locations = group.locations.length;
    const complexity = group.metadata.complexity;

    if (lines > 100 || locations > 10 || complexity > 15) {
      return 'critical';
    } else if (lines > 50 || locations > 5 || complexity > 10) {
      return 'high';
    } else if (lines > 20 || locations > 3 || complexity > 5) {
      return 'medium';
    } else {
      return 'low';
    }
  }
}

export default DuplicationDetector;