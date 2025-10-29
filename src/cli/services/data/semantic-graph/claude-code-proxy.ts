/**
 * Claude Code CLI Proxy - Dependency Inversion Principle
 * Uses Claude Code CLI as external semantic analysis service for unsupported languages
 * or when Tree-sitter parsing fails
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FileInfo } from '../../monitoring/file-scanning/file-scanner-interfaces';
import { CodeEntity, SemanticRelationship } from './tree-sitter-semantic-builder';
import { CommandProcessor } from '../../../managers/command-processor';

const execAsync = promisify(exec);

export interface ClaudeAnalysisResult {
  entities: CodeEntity[];
  relationships: SemanticRelationship[];
  summary: string;
  confidence: number;
  processingTime: number;
}

export class ClaudeCodeProxy {
  private readonly timeout = 30000; // 30 seconds
  private entityIdCounter = 0;
  private relationshipIdCounter = 0;

  constructor(
    private claudeCommand = 'claude-code',
    private maxRetries = 2
  ) {}

  /**
   * Analyze file using Claude Code CLI
   */
  async analyzeFile(file: FileInfo): Promise<ClaudeAnalysisResult> {
    const startTime = Date.now();

    try {
      // Create analysis prompt for Claude Code
      const analysisPrompt = this.createAnalysisPrompt(file);

      // Execute Claude Code CLI with the analysis prompt using centralized method
      const result = await this.executeClaudeCodeCentralized(analysisPrompt, file.path);

      // Parse Claude's response into structured data
      const analysis = this.parseClaudeResponse(result, file);

      return {
        ...analysis,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.warn(`Claude Code proxy failed for ${file.path}: ${error.message}`);

      // Return fallback analysis
      return this.createFallbackAnalysis(file, Date.now() - startTime);
    }
  }

  /**
   * Batch analyze multiple files using Claude Code
   */
  async analyzeFiles(files: FileInfo[]): Promise<Map<string, ClaudeAnalysisResult>> {
    const results = new Map<string, ClaudeAnalysisResult>();
    const batchSize = 5; // Process files in small batches to avoid overwhelming Claude

    console.log(`🤖 Analyzing ${files.length} files with Claude Code CLI...`);

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchPromises = batch.map(file =>
        this.analyzeFile(file).then(result => ({ file, result }))
      );

      try {
        const batchResults = await Promise.allSettled(batchPromises);

        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.set(result.value.file.path, result.value.result);
          }
        }

        // Rate limiting - avoid overwhelming Claude Code
        if (i + batchSize < files.length) {
          await this.delay(1000); // 1 second between batches
        }

      } catch (error) {
        console.warn(`Batch analysis failed: ${error.message}`);
      }
    }

    return results;
  }

  private createAnalysisPrompt(file: FileInfo): string {
    return `Analyze this ${file.language || 'source'} file for semantic relationships and code entities.

File: ${file.relativePath}
Language: ${file.language || 'unknown'}
Size: ${file.size} bytes

Please identify:
1. Classes, functions, methods, and variables defined in this file
2. Import statements and dependencies
3. Function calls and method invocations
4. Inheritance relationships (extends, implements)
5. Key semantic relationships between code elements

Respond in the following JSON format:
{
  "entities": [
    {
      "name": "EntityName",
      "type": "class|function|method|variable|interface",
      "startLine": 10,
      "endLine": 25,
      "signature": "function signature or declaration",
      "modifiers": ["public", "static"]
    }
  ],
  "relationships": [
    {
      "sourceEntity": "SourceName",
      "targetEntity": "TargetName",
      "relationshipType": "IMPORTS|EXTENDS|CALLS|DEFINES",
      "lineNumber": 15,
      "confidence": 0.9
    }
  ],
  "summary": "Brief analysis summary",
  "confidence": 0.85
}

Focus on accuracy and only include relationships you're confident about.`;
  }

  private async executeClaudeCodeCentralized(prompt: string, filePath: string): Promise<string> {
    try {
      // Use the centralized command processor
      const result = await CommandProcessor.executeClaudeCode(prompt, {
        maxTokens: 8000,
        outputFormat: 'text',
        timeout: this.timeout
      });

      if (!result.success) {
        throw new Error(result.error || 'Claude Code execution failed');
      }

      return result.data || '';
    } catch (error) {
      console.warn(`Claude Code analysis failed for ${filePath}: ${error.message}`);
      throw new Error(`Claude Code analysis failed: ${error.message}`);
    }
  }

  private parseClaudeResponse(response: string, file: FileInfo): Omit<ClaudeAnalysisResult, 'processingTime'> {
    try {
      // Try to extract JSON from Claude's response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and transform the response
      const entities = this.transformEntities(parsed.entities || [], file);
      const relationships = this.transformRelationships(parsed.relationships || [], file);

      return {
        entities,
        relationships,
        summary: parsed.summary || 'Analysis completed',
        confidence: Math.min(1.0, Math.max(0.0, parsed.confidence || 0.7))
      };

    } catch (error) {
      console.warn(`Failed to parse Claude response: ${error.message}`);

      // Try to extract useful information with regex as fallback
      return this.extractWithRegex(response, file);
    }
  }

  private transformEntities(rawEntities: any[], file: FileInfo): CodeEntity[] {
    return rawEntities.map(entity => ({
      id: this.generateEntityId(),
      name: entity.name || 'unknown',
      type: this.validateEntityType(entity.type),
      filePath: file.path,
      startLine: entity.startLine || 1,
      endLine: entity.endLine || entity.startLine || 1,
      signature: entity.signature,
      modifiers: Array.isArray(entity.modifiers) ? entity.modifiers : [],
      metadata: {
        processedBy: 'claude-proxy',
        language: file.language,
        confidence: entity.confidence || 0.7
      }
    }));
  }

  private transformRelationships(rawRelationships: any[], file: FileInfo): SemanticRelationship[] {
    return rawRelationships.map(rel => ({
      id: this.generateRelationshipId(),
      sourceFile: file.path,
      sourceEntity: rel.sourceEntity || 'unknown',
      targetEntity: rel.targetEntity || 'unknown',
      relationshipType: this.validateRelationshipType(rel.relationshipType),
      confidence: Math.min(1.0, Math.max(0.0, rel.confidence || 0.7)),
      lineNumber: rel.lineNumber || 1,
      metadata: {
        processedBy: 'claude-proxy',
        originalType: rel.relationshipType
      }
    }));
  }

  private extractWithRegex(response: string, file: FileInfo): Omit<ClaudeAnalysisResult, 'processingTime'> {
    // Fallback regex-based extraction when JSON parsing fails
    console.log('Falling back to regex extraction for Claude response');

    const entities: CodeEntity[] = [];
    const relationships: SemanticRelationship[] = [];

    // Try to extract mentioned functions, classes, etc.
    const classMatches = response.match(/class\s+(\w+)/gi) || [];
    const functionMatches = response.match(/function\s+(\w+)/gi) || [];

    classMatches.forEach((match, index) => {
      const className = match.split(' ')[1];
      if (className) {
        entities.push({
          id: this.generateEntityId(),
          name: className,
          type: 'class',
          filePath: file.path,
          startLine: 1,
          endLine: 1,
          modifiers: [],
          metadata: {
            processedBy: 'claude-proxy-regex',
            extractedFrom: 'text-analysis'
          }
        });
      }
    });

    return {
      entities,
      relationships,
      summary: 'Regex-based extraction from Claude response',
      confidence: 0.5
    };
  }

  private createFallbackAnalysis(file: FileInfo, processingTime: number): ClaudeAnalysisResult {
    return {
      entities: [{
        id: this.generateEntityId(),
        name: path.basename(file.path, path.extname(file.path)),
        type: 'module',
        filePath: file.path,
        startLine: 1,
        endLine: 1,
        modifiers: [],
        metadata: {
          processedBy: 'fallback',
          reason: 'claude-proxy-failed'
        }
      }],
      relationships: [],
      summary: 'Fallback analysis - Claude Code CLI unavailable',
      confidence: 0.3,
      processingTime
    };
  }

  private validateEntityType(type: string): CodeEntity['type'] {
    const validTypes: CodeEntity['type'][] = ['module', 'class', 'function', 'method', 'variable', 'interface', 'type'];
    return validTypes.includes(type as any) ? type as CodeEntity['type'] : 'module';
  }

  private validateRelationshipType(type: string): SemanticRelationship['relationshipType'] {
    const validTypes: SemanticRelationship['relationshipType'][] = ['IMPORTS', 'EXTENDS', 'IMPLEMENTS', 'CALLS', 'DEFINES', 'USES', 'CONTAINS'];
    return validTypes.includes(type as any) ? type as SemanticRelationship['relationshipType'] : 'USES';
  }

  private generateEntityId(): string {
    return `claude_entity_${++this.entityIdCounter}`;
  }

  private generateRelationshipId(): string {
    return `claude_rel_${++this.relationshipIdCounter}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}