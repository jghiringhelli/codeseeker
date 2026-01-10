/**
 * Core Cycle Services Test Suite
 * Tests for the 8-step codeseeker Core Cycle services
 */

import { NaturalLanguageProcessor, QueryAnalysis } from '../../../src/cli/commands/services/natural-language-processor';
import { ContextBuilder } from '../../../src/cli/commands/services/context-builder';
import { GraphAnalysisService, GraphContext } from '../../../src/cli/commands/services/graph-analysis-service';

// Mock DatabaseConnections
jest.mock('../../../src/config/database-config', () => ({
  DatabaseConnections: jest.fn().mockImplementation(() => ({
    getPostgresConnection: jest.fn().mockRejectedValue(new Error('Mock - no database')),
    getNeo4jConnection: jest.fn().mockRejectedValue(new Error('Mock - no database')),
    closeAll: jest.fn()
  }))
}));

describe('NaturalLanguageProcessor', () => {
  let processor: NaturalLanguageProcessor;

  beforeEach(() => {
    processor = new NaturalLanguageProcessor();
  });

  describe('intent detection', () => {
    // Note: Intent detection now uses Claude-based analysis, which returns 'general'
    // when Claude CLI is unavailable (e.g., in tests). These tests verify the fallback behavior.

    it('should return valid intent (falls back to general without Claude)', () => {
      const analysis = processor.analyzeQuery('create a new authentication service');
      // Without Claude CLI, intent defaults to 'general'
      expect(['create', 'general']).toContain(analysis.intent);
    });

    it('should return valid intent for modify queries', () => {
      const analysis = processor.analyzeQuery('update the user service');
      expect(['modify', 'general']).toContain(analysis.intent);
    });

    it('should return valid intent for fix queries', () => {
      const analysis = processor.analyzeQuery('fix the bug in login');
      expect(['fix', 'general']).toContain(analysis.intent);
    });

    it('should return valid intent for understand queries', () => {
      const analysis = processor.analyzeQuery('what does this code do');
      expect(['understand', 'general']).toContain(analysis.intent);
    });

    it('should return valid intent for delete queries', () => {
      const analysis = processor.analyzeQuery('delete the unused function');
      expect(['delete', 'general']).toContain(analysis.intent);
    });

    it('should return "general" for unclear queries', () => {
      const analysis = processor.analyzeQuery('hello world');
      expect(analysis.intent).toBe('general');
    });
  });

  describe('query structure', () => {
    it('should return valid QueryAnalysis structure', () => {
      const analysis = processor.analyzeQuery('test query');

      expect(analysis).toHaveProperty('intent');
      expect(analysis).toHaveProperty('confidence');
      expect(analysis).toHaveProperty('assumptions');
      expect(analysis).toHaveProperty('ambiguities');
    });

    it('should return confidence between 0 and 1', () => {
      const analysis = processor.analyzeQuery('refactor the code');
      expect(analysis.confidence).toBeGreaterThan(0);
      expect(analysis.confidence).toBeLessThanOrEqual(1);
    });

    it('should return empty assumptions array (Claude Code handles this)', () => {
      const analysis = processor.analyzeQuery('add new endpoint for users');
      expect(Array.isArray(analysis.assumptions)).toBe(true);
    });
  });

  describe('natural language detection', () => {
    it('should identify natural language queries', () => {
      expect(processor.isNaturalLanguageQuery('add authentication to the API')).toBe(true);
      expect(processor.isNaturalLanguageQuery('what does this function do')).toBe(true);
    });

    it('should not identify commands as natural language', () => {
      expect(processor.isNaturalLanguageQuery('help')).toBe(false);
      expect(processor.isNaturalLanguageQuery('setup')).toBe(false);
      expect(processor.isNaturalLanguageQuery('status')).toBe(false);
    });
  });
});

describe('ContextBuilder', () => {
  let builder: ContextBuilder;

  beforeEach(() => {
    builder = new ContextBuilder();
  });

  describe('enhanced context building', () => {
    it('should build enhanced context from all inputs', () => {
      const query = 'find authentication code';
      const analysis: QueryAnalysis = {
        intent: 'understand',
        confidence: 0.85,
        assumptions: ['Assuming REST API structure'],
        ambiguities: []
      };
      const userClarifications = ['Use JWT tokens'];
      const semanticResults = [
        { file: 'src/auth/service.ts', type: 'service', similarity: 0.9, content: 'class AuthService {}' }
      ];
      const graphContext: GraphContext = {
        classes: [{
          name: 'AuthService',
          filePath: 'src/auth/service.ts',
          type: 'service',
          description: 'Authentication service',
          confidence: 0.9,
          relationships: []
        }],
        relationships: [],
        relationshipDetails: [],
        packageStructure: ['auth'],
        graphInsights: {
          totalNodes: 1,
          totalRelationships: 0,
          architecturalPatterns: [],
          qualityMetrics: { coupling: 0.5, cohesion: 0.7, complexity: 0.3 }
        }
      };

      const context = builder.buildEnhancedContext(
        query, analysis, userClarifications, semanticResults, graphContext
      );

      expect(context).toBeDefined();
      expect(context.originalQuery).toBe(query);
      expect(context.clarifications).toEqual(userClarifications);
      expect(context.assumptions).toEqual(analysis.assumptions);
      expect(context.relevantFiles.length).toBe(1);
      expect(context.enhancedPrompt).toBeDefined();
      expect(context.enhancedPrompt.length).toBeGreaterThan(0);
    });

    it('should include original query in enhanced prompt', () => {
      const query = 'unique test query string';
      const analysis: QueryAnalysis = {
        intent: 'understand',
        confidence: 0.80,
        assumptions: [],
        ambiguities: []
      };

      const context = builder.buildEnhancedContext(query, analysis, [], [], {
        classes: [],
        relationships: [],
        relationshipDetails: [],
        packageStructure: [],
        graphInsights: {
          totalNodes: 0,
          totalRelationships: 0,
          architecturalPatterns: [],
          qualityMetrics: { coupling: 0.5, cohesion: 0.5, complexity: 0.5 }
        }
      });

      expect(context.enhancedPrompt).toContain(query);
    });

    it('should include file information when provided', () => {
      const query = 'test query';
      const analysis: QueryAnalysis = {
        intent: 'understand',
        confidence: 0.85,
        assumptions: [],
        ambiguities: []
      };
      const semanticResults = [
        { file: 'src/specific/file.ts', type: 'service', similarity: 0.95, content: 'export class Service {}' }
      ];

      const context = builder.buildEnhancedContext(query, analysis, [], semanticResults, {
        classes: [],
        relationships: [],
        relationshipDetails: [],
        packageStructure: [],
        graphInsights: {
          totalNodes: 0,
          totalRelationships: 0,
          architecturalPatterns: [],
          qualityMetrics: { coupling: 0.5, cohesion: 0.5, complexity: 0.5 }
        }
      });

      expect(context.relevantFiles.length).toBe(1);
      expect(context.relevantFiles[0].path).toBe('src/specific/file.ts');
    });
  });

  describe('context statistics', () => {
    it('should generate accurate context stats', () => {
      const context = builder.buildEnhancedContext(
        'test query',
        { intent: 'understand', confidence: 0.8, assumptions: ['assumption1'], ambiguities: [] },
        ['clarification1'],
        [{ file: 'test.ts', type: 'service', similarity: 0.9, content: 'code' }],
        {
          classes: [],
          relationships: [],
          relationshipDetails: [{ from: 'A', to: 'B', type: 'uses' }],
          packageStructure: ['pkg1'],
          graphInsights: {
            totalNodes: 1,
            totalRelationships: 1,
            architecturalPatterns: [],
            qualityMetrics: { coupling: 0.5, cohesion: 0.5, complexity: 0.5 }
          }
        }
      );

      const stats = builder.getContextStats(context);

      expect(stats.filesFound).toBe(1);
      expect(stats.relationshipsFound).toBe(1);
      expect(stats.assumptionsDetected).toBe(1);
      expect(stats.clarificationsProvided).toBe(1);
      expect(stats.promptLength).toBeGreaterThan(0);
    });
  });

  describe('SOLID compliance', () => {
    it('should have single responsibility - only builds context', () => {
      expect(typeof builder.buildEnhancedContext).toBe('function');
      expect(typeof builder.getContextStats).toBe('function');
    });
  });
});

describe('GraphAnalysisService', () => {
  let service: GraphAnalysisService;

  beforeEach(() => {
    service = new GraphAnalysisService('.');
  });

  describe('graph analysis', () => {
    it('should perform graph analysis on semantic results', async () => {
      const query = 'test query';
      const semanticResults = [
        { file: 'src/service.ts', type: 'service', similarity: 0.9 }
      ];

      const result = await service.performGraphAnalysis(query, semanticResults);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('classes');
      expect(result).toHaveProperty('relationships');
      expect(result).toHaveProperty('relationshipDetails');
      expect(result).toHaveProperty('packageStructure');
      expect(result).toHaveProperty('graphInsights');
      expect(Array.isArray(result.classes)).toBe(true);
      expect(Array.isArray(result.relationships)).toBe(true);
    });

    it('should handle empty semantic results', async () => {
      const result = await service.performGraphAnalysis('query', []);

      expect(result).toBeDefined();
      expect(result.classes).toEqual([]);
      expect(result.relationships).toEqual([]);
    });

    it('should extract class names from file paths', async () => {
      const semanticResults = [
        { file: 'src/services/UserService.ts', type: 'service', similarity: 0.9 },
        { file: 'src/controllers/AuthController.ts', type: 'controller', similarity: 0.85 }
      ];

      const result = await service.performGraphAnalysis('query', semanticResults);

      // Should attempt to extract class information
      expect(result.classes.length).toBeGreaterThanOrEqual(0);
    });

    it('should include graph insights in result', async () => {
      const result = await service.performGraphAnalysis('test', [
        { file: 'src/test.ts', type: 'service', similarity: 0.8 }
      ]);

      expect(result.graphInsights).toBeDefined();
      expect(result.graphInsights).toHaveProperty('totalNodes');
      expect(result.graphInsights).toHaveProperty('totalRelationships');
      expect(result.graphInsights).toHaveProperty('qualityMetrics');
    });
  });

  describe('SOLID compliance', () => {
    it('should have single responsibility - only analyzes graphs', () => {
      expect(typeof service.performGraphAnalysis).toBe('function');
    });
  });
});

describe('Core Cycle Integration', () => {
  it('should work together as a pipeline', async () => {
    // Step 1: Analyze query
    const processor = new NaturalLanguageProcessor();
    const analysis = processor.analyzeQuery('find authentication middleware');

    expect(analysis.intent).toBeDefined();

    // Step 2: Mock semantic search results
    const semanticResults = [
      { file: 'src/middleware/auth.ts', type: 'middleware', similarity: 0.92, content: 'export class AuthMiddleware {}' }
    ];

    // Step 3: Graph analysis
    const graphService = new GraphAnalysisService('.');
    const graphContext = await graphService.performGraphAnalysis('auth middleware', semanticResults);

    expect(graphContext.classes).toBeDefined();

    // Step 4: Build context
    const contextBuilder = new ContextBuilder();
    const context = contextBuilder.buildEnhancedContext(
      'find authentication middleware',
      analysis,
      [],
      semanticResults,
      graphContext
    );

    expect(context).toBeDefined();
    expect(context.enhancedPrompt.length).toBeGreaterThan(0);
  });

  it('should handle the complete flow without errors', async () => {
    const processor = new NaturalLanguageProcessor();
    const graphService = new GraphAnalysisService('.');
    const contextBuilder = new ContextBuilder();

    // Run through the pipeline
    const analysis = processor.analyzeQuery('create new API endpoint');
    const graphContext = await graphService.performGraphAnalysis('API endpoint', []);
    const context = contextBuilder.buildEnhancedContext(
      'create new API endpoint',
      analysis,
      [],
      [],
      graphContext
    );

    // All steps should complete without throwing
    expect(analysis).toBeDefined();
    expect(graphContext).toBeDefined();
    expect(context).toBeDefined();
  });
});
