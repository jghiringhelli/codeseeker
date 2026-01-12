/**
 * Code Relationship Parser
 * SOLID Principles: Dependency Inversion - Coordinator depends on abstractions
 * Parses project files to extract relationships for the semantic graph
 */

import * as path from 'path';
import { Logger } from '../../../utils/logger';
import { SemanticGraphService } from './semantic-graph/semantic-graph';
import {
  ParsedFile,
  ProjectStructure,
  IFileParsingService,
  IProjectStructureService,
  IGraphPopulationService
} from './code-parsing/interfaces/index';
import { FileParsingService } from './code-parsing/services/file-parsing-service';
import { ProjectStructureService } from './code-parsing/services/project-structure-service';
import { GraphPopulationService } from './code-parsing/services/graph-population-service';

// Re-export interfaces for backward compatibility
export {
  ParsedFile,
  ProjectStructure
} from './code-parsing/interfaces/index';

export class CodeRelationshipParser {
  private logger = Logger.getInstance();
  private semanticGraph: SemanticGraphService;

  constructor(
    private fileParsingService?: IFileParsingService,
    private projectStructureService?: IProjectStructureService,
    private graphPopulationService?: IGraphPopulationService
  ) {
    this.semanticGraph = new SemanticGraphService();

    // Initialize services with dependency injection
    this.fileParsingService = this.fileParsingService || new FileParsingService();
    this.projectStructureService = this.projectStructureService || new ProjectStructureService(this.fileParsingService);
    this.graphPopulationService = this.graphPopulationService || new GraphPopulationService(this.semanticGraph);
  }

  async initialize(): Promise<void> {
    await this.semanticGraph.initialize();
    this.logger.info('🔍 Code relationship parser initialized');
  }

  /**
   * Parse individual file (public wrapper for parseCodeFile)
   */
  async parseFile(filePath: string): Promise<ParsedFile> {
    const relativePath = path.relative(process.cwd(), filePath);
    return await this.fileParsingService.parseCodeFile(filePath, relativePath);
  }

  /**
   * Parse entire project and populate semantic graph
   */
  async parseAndPopulateProject(projectPath: string, projectId: string): Promise<void> {
    this.logger.info(`🔄 Parsing project structure: ${projectPath}`);

    try {
      // Step 1: Parse all code files and analyze relationships
      const structure = await this.projectStructureService.parseProjectStructure(projectPath);

      // Step 2: Create nodes in Neo4j
      this.logger.info('📊 Creating graph nodes...');
      const nodeIdMap = await this.graphPopulationService.createGraphNodes(structure, projectId);

      // Step 3: Create relationships in Neo4j
      this.logger.info('🔗 Creating graph relationships...');
      await this.graphPopulationService.createGraphRelationships(structure, nodeIdMap, projectId);

      // Step 4: Extract business concepts
      this.logger.info('🧠 Extracting business concepts...');
      await this.graphPopulationService.extractBusinessConcepts(structure, projectId);

      // Step 5: Generate project summary
      this.generateProjectSummary(structure, projectId);

      this.logger.info('✅ Project parsing and graph population completed successfully');

    } catch (error) {
      this.logger.error('❌ Project parsing failed:', error);
      throw error;
    }
  }

  /**
   * Analyze project structure without populating the graph
   */
  async analyzeProjectStructure(projectPath: string): Promise<ProjectStructure> {
    this.logger.info(`📋 Analyzing project structure: ${projectPath}`);

    try {
      const structure = await this.projectStructureService.parseProjectStructure(projectPath);

      // Generate analysis report
      this.logger.info('📊 Project Analysis Summary:');
      this.logger.info(`📁 Files analyzed: ${structure.files.length}`);
      this.logger.info(`🔗 Relationships found: ${structure.relationships.length}`);

      const languageStats = this.calculateLanguageStatistics(structure);
      this.logger.info(`💻 Languages: ${Object.entries(languageStats).map(([lang, count]) => `${lang}(${count})`).join(', ')}`);

      const complexityStats = this.calculateComplexityStatistics(structure);
      this.logger.info(`🎯 Average complexity: ${complexityStats.average.toFixed(2)}`);

      return structure;
    } catch (error) {
      this.logger.error('❌ Project analysis failed:', error);
      throw error;
    }
  }

  /**
   * Get parsing statistics for a project
   */
  getProjectStatistics(structure: ProjectStructure): {
    files: number;
    relationships: number;
    languages: { [language: string]: number };
    classes: number;
    functions: number;
    interfaces: number;
    complexity: { average: number; max: number; total: number };
    patterns: {
      patterns: string[];
      layered: boolean;
      modular: boolean;
      suggestions: string[];
    };
  } {
    const languageStats = this.calculateLanguageStatistics(structure);
    const complexityStats = this.calculateComplexityStatistics(structure);
    const architecturalPatterns = this.projectStructureService.analyzeArchitecturalPatterns(structure);

    const classCount = structure.files.reduce((sum, file) => sum + file.classes.length, 0);
    const functionCount = structure.files.reduce((sum, file) => sum + file.functions.length, 0);
    const interfaceCount = structure.files.reduce((sum, file) => sum + file.interfaces.length, 0);

    return {
      files: structure.files.length,
      relationships: structure.relationships.length,
      languages: languageStats,
      classes: classCount,
      functions: functionCount,
      interfaces: interfaceCount,
      complexity: complexityStats,
      patterns: architecturalPatterns
    };
  }

  private generateProjectSummary(structure: ProjectStructure, projectId: string): void {
    const stats = this.getProjectStatistics(structure);

    this.logger.info('📈 Project Analysis Complete:');
    this.logger.info(`  📁 Files: ${stats.files}`);
    this.logger.info(`  🏗️ Classes: ${stats.classes}`);
    this.logger.info(`  🔧 Functions: ${stats.functions}`);
    this.logger.info(`  📋 Interfaces: ${stats.interfaces}`);
    this.logger.info(`  🔗 Relationships: ${stats.relationships}`);
    this.logger.info(`  🎯 Avg Complexity: ${stats.complexity.average.toFixed(2)}`);
    this.logger.info(`  🏛️ Architecture: ${stats.patterns.layered ? 'Layered' : 'Flat'}, ${stats.patterns.modular ? 'Modular' : 'Monolithic'}`);

    if (stats.patterns.patterns.length > 0) {
      this.logger.info(`  🎨 Patterns: ${stats.patterns.patterns.join(', ')}`);
    }

    if (stats.patterns.suggestions.length > 0) {
      this.logger.info(`  💡 Suggestions:`);
      stats.patterns.suggestions.forEach(suggestion => {
        this.logger.info(`    • ${suggestion}`);
      });
    }
  }

  private calculateLanguageStatistics(structure: ProjectStructure): { [language: string]: number } {
    const languageStats: { [language: string]: number } = {};

    for (const file of structure.files) {
      languageStats[file.language] = (languageStats[file.language] || 0) + 1;
    }

    return languageStats;
  }

  private calculateComplexityStatistics(structure: ProjectStructure): {
    average: number;
    max: number;
    total: number;
  } {
    let totalComplexity = 0;
    let maxComplexity = 0;
    let functionCount = 0;

    for (const file of structure.files) {
      // Count standalone functions
      for (const func of file.functions) {
        totalComplexity += func.complexity;
        maxComplexity = Math.max(maxComplexity, func.complexity);
        functionCount++;
      }

      // Count class methods
      for (const cls of file.classes) {
        for (const method of cls.methods) {
          totalComplexity += method.complexity;
          maxComplexity = Math.max(maxComplexity, method.complexity);
          functionCount++;
        }
      }
    }

    return {
      average: functionCount > 0 ? totalComplexity / functionCount : 0,
      max: maxComplexity,
      total: totalComplexity
    };
  }

  async close(): Promise<void> {
    await this.semanticGraph.close();
    this.logger.info('📊 Code relationship parser closed');
  }
}

export default CodeRelationshipParser;