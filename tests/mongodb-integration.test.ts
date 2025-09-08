/**
 * MongoDB Integration Tests
 * Tests for tool configuration, analysis results, and project intelligence
 */

import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect } from '@jest/jest';
import { MongoClient, Db } from 'mongodb';
import { mongoClient } from '../src/shared/mongodb-client';
import { toolConfigRepo, ToolConfigRepository } from '../src/shared/tool-config-repository';
import { analysisRepo, AnalysisRepository } from '../src/shared/analysis-repository';
import { projectIntelligence, ProjectIntelligence } from '../src/shared/project-intelligence';

// Test configuration
const TEST_MONGO_URI = process.env.TEST_MONGO_URI || 'mongodb://localhost:27017/codemind_test';
const TEST_PROJECT_ID = 'test-project-123';
const TEST_PROJECT_PATH = '/test/project/path';

describe('MongoDB Integration Tests', () => {
  let testClient: MongoClient;
  let testDb: Db;

  beforeAll(async () => {
    // Connect to test database
    testClient = new MongoClient(TEST_MONGO_URI);
    await testClient.connect();
    testDb = testClient.db();
    
    // Override the production MongoDB client for tests
    jest.spyOn(mongoClient, 'getDatabase').mockReturnValue(testDb);
    jest.spyOn(mongoClient, 'getCollection').mockImplementation((name) => testDb.collection(name));
    
    // Ensure test collections exist
    await testDb.createCollection('tool_configs');
    await testDb.createCollection('analysis_results');
    await testDb.createCollection('project_intelligence');
  });

  afterAll(async () => {
    if (testClient) {
      await testClient.close();
    }
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await testDb.collection('tool_configs').deleteMany({});
    await testDb.collection('analysis_results').deleteMany({});
    await testDb.collection('project_intelligence').deleteMany({});
  });

  describe('Tool Configuration Repository', () => {
    let configRepo: ToolConfigRepository;

    beforeEach(() => {
      configRepo = new ToolConfigRepository();
    });

    it('should save and retrieve tool configuration', async () => {
      const toolName = 'semantic-search';
      const config = {
        embeddingModel: 'text-embedding-ada-002',
        chunkSize: 4000,
        similarity: 'cosine'
      };

      await configRepo.saveToolConfig(TEST_PROJECT_ID, toolName, config);
      const retrieved = await configRepo.getToolConfig(TEST_PROJECT_ID, toolName);

      expect(retrieved).toEqual(config);
    });

    it('should fall back to default configuration', async () => {
      const toolName = 'test-tool';
      const defaultConfig = { default: true, value: 42 };

      // Save default configuration
      await configRepo.saveToolConfig('default', toolName, defaultConfig);

      // Try to get project-specific config (should fall back to default)
      const retrieved = await configRepo.getToolConfig(TEST_PROJECT_ID, toolName);

      expect(retrieved).toEqual(defaultConfig);
    });

    it('should initialize project configurations', async () => {
      // Create some default configurations
      await configRepo.saveToolConfig('default', 'tool1', { setting: 'value1' });
      await configRepo.saveToolConfig('default', 'tool2', { setting: 'value2' });

      // Initialize project configs
      await configRepo.initializeProjectConfigs(TEST_PROJECT_ID);

      // Verify project has both configs
      const configs = await configRepo.getProjectConfigs(TEST_PROJECT_ID);
      expect(configs).toHaveLength(2);
      expect(configs.map(c => c.toolName)).toContain('tool1');
      expect(configs.map(c => c.toolName)).toContain('tool2');
    });

    it('should find configurations by framework', async () => {
      const config1 = { frameworks: ['react', 'nodejs'] };
      const config2 = { frameworks: ['angular'] };
      const config3 = { frameworks: ['react', 'vue'] };

      await configRepo.saveToolConfig(TEST_PROJECT_ID, 'tool1', config1);
      await configRepo.saveToolConfig(TEST_PROJECT_ID, 'tool2', config2);
      await configRepo.saveToolConfig(TEST_PROJECT_ID, 'tool3', config3);

      const reactConfigs = await configRepo.getConfigsByFramework('react');
      expect(reactConfigs).toHaveLength(2);
      expect(reactConfigs.map(c => c.toolName)).toContain('tool1');
      expect(reactConfigs.map(c => c.toolName)).toContain('tool3');
    });

    it('should update specific configuration field', async () => {
      const initialConfig = { field1: 'value1', field2: 'value2' };
      await configRepo.saveToolConfig(TEST_PROJECT_ID, 'test-tool', initialConfig);

      await configRepo.updateConfigField(TEST_PROJECT_ID, 'test-tool', 'field1', 'updated-value');

      const updatedConfig = await configRepo.getToolConfig(TEST_PROJECT_ID, 'test-tool');
      expect(updatedConfig.field1).toBe('updated-value');
      expect(updatedConfig.field2).toBe('value2');
    });
  });

  describe('Analysis Repository', () => {
    let analysisRepository: AnalysisRepository;

    beforeEach(() => {
      analysisRepository = new AnalysisRepository();
    });

    it('should store and retrieve analysis results', async () => {
      const analysisData = {
        data: [{ file: 'test.js', issues: [] }],
        analysis: { summary: 'No issues found' },
        executionTime: 1500
      };

      const resultId = await analysisRepository.storeAnalysis(TEST_PROJECT_ID, 'test-tool', analysisData);
      expect(resultId).toBeDefined();

      const history = await analysisRepository.getAnalysisHistory(TEST_PROJECT_ID, 'test-tool');
      expect(history).toHaveLength(1);
      expect(history[0].analysis).toEqual(analysisData);
      expect(history[0].toolName).toBe('test-tool');
    });

    it('should get latest analyses for each tool', async () => {
      const tool1Data = { analysis: { summary: 'Tool 1 result' } };
      const tool2Data = { analysis: { summary: 'Tool 2 result' } };

      await analysisRepository.storeAnalysis(TEST_PROJECT_ID, 'tool1', tool1Data);
      await analysisRepository.storeAnalysis(TEST_PROJECT_ID, 'tool2', tool2Data);
      
      // Store another result for tool1 (should be the latest)
      const tool1Latest = { analysis: { summary: 'Tool 1 latest' } };
      await analysisRepository.storeAnalysis(TEST_PROJECT_ID, 'tool1', tool1Latest);

      const latestAnalyses = await analysisRepository.getLatestAnalyses(TEST_PROJECT_ID);
      expect(latestAnalyses).toHaveLength(2);
      
      const tool1Result = latestAnalyses.find(a => a.toolName === 'tool1');
      const tool2Result = latestAnalyses.find(a => a.toolName === 'tool2');
      
      expect(tool1Result?.analysis).toEqual(tool1Latest);
      expect(tool2Result?.analysis).toEqual(tool2Data);
    });

    it('should search analysis results', async () => {
      const searchableData = {
        analysis: { summary: 'React component analysis with TypeScript issues' }
      };

      await analysisRepository.storeAnalysis(TEST_PROJECT_ID, 'test-tool', searchableData);

      // Wait a moment for text indexing
      await new Promise(resolve => setTimeout(resolve, 100));

      const searchResults = await analysisRepository.searchAnalysis(TEST_PROJECT_ID, 'React TypeScript');
      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults[0].analysis).toEqual(searchableData);
    });

    it('should get project statistics', async () => {
      // Store multiple analysis results
      await analysisRepository.storeAnalysis(TEST_PROJECT_ID, 'tool1', {
        analysis: {},
        executionTime: 1000,
        filesProcessed: 10,
        issues: [{}, {}] // 2 issues
      });
      
      await analysisRepository.storeAnalysis(TEST_PROJECT_ID, 'tool2', {
        analysis: {},
        executionTime: 2000,
        filesProcessed: 20,
        issues: [{}] // 1 issue
      });

      const stats = await analysisRepository.getProjectStatistics(TEST_PROJECT_ID);
      
      expect(stats.overall.totalAnalyses).toBe(2);
      expect(stats.overall.uniqueTools).toEqual(['tool1', 'tool2']);
      expect(stats.byTool).toHaveLength(2);
      expect(stats.byTool[0].totalRuns).toBe(1);
    });

    it('should filter results by date range', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await analysisRepository.storeAnalysis(TEST_PROJECT_ID, 'test-tool', { analysis: { id: 1 } });
      
      // Get results from yesterday to tomorrow
      const results = await analysisRepository.getAnalysisHistory(TEST_PROJECT_ID, 'test-tool', {
        startDate: yesterday,
        endDate: tomorrow
      });

      expect(results).toHaveLength(1);

      // Get results from tomorrow onwards (should be empty)
      const futureResults = await analysisRepository.getAnalysisHistory(TEST_PROJECT_ID, 'test-tool', {
        startDate: tomorrow
      });

      expect(futureResults).toHaveLength(0);
    });
  });

  describe('Project Intelligence', () => {
    let intelligence: ProjectIntelligence;

    beforeEach(() => {
      intelligence = new ProjectIntelligence();
    });

    it('should store and retrieve project context', async () => {
      const context = {
        languages: ['typescript', 'javascript'],
        frameworks: ['react', 'nodejs'],
        projectType: 'web_application',
        fileStructure: {
          entryPoints: ['src/index.ts'],
          configFiles: ['package.json'],
          testDirectories: ['tests/']
        },
        patterns: {
          architectural: ['MVC'],
          design: ['Factory']
        },
        complexity: 'medium' as const,
        recommendedTools: ['semantic-search', 'solid-principles']
      };

      await intelligence.updateProjectContext(TEST_PROJECT_ID, context);
      const retrieved = await intelligence.getProjectContext(TEST_PROJECT_ID);

      expect(retrieved).toEqual(context);
    });

    it('should find similar projects', async () => {
      const reactProject = {
        languages: ['typescript'],
        frameworks: ['react'],
        projectType: 'web_application',
        fileStructure: { entryPoints: [], configFiles: [], testDirectories: [] },
        patterns: { architectural: [], design: [] },
        complexity: 'medium' as const,
        recommendedTools: []
      };

      const nodeProject = {
        languages: ['javascript'],
        frameworks: ['nodejs'],
        projectType: 'api_service',
        fileStructure: { entryPoints: [], configFiles: [], testDirectories: [] },
        patterns: { architectural: [], design: [] },
        complexity: 'low' as const,
        recommendedTools: []
      };

      await intelligence.updateProjectContext('react-project', reactProject);
      await intelligence.updateProjectContext('node-project', nodeProject);

      // Find projects similar to React project
      const similar = await intelligence.findSimilarProjects(reactProject, 2);
      
      expect(similar.length).toBeGreaterThan(0);
      // The first result should be the exact match (if we stored the same project)
      // or the most similar one
    });

    it('should get recommended tools based on context', async () => {
      const context = {
        languages: ['typescript', 'javascript'],
        frameworks: ['react'],
        projectType: 'web_application',
        fileStructure: { entryPoints: [], configFiles: [], testDirectories: [] },
        patterns: { architectural: [], design: [] },
        complexity: 'medium' as const,
        recommendedTools: ['semantic-search']
      };

      await intelligence.updateProjectContext(TEST_PROJECT_ID, context);
      const recommendations = await intelligence.getRecommendedTools(TEST_PROJECT_ID);

      expect(recommendations).toContain('semantic-search');
      expect(recommendations).toContain('compilation-verifier'); // TypeScript/JavaScript
      expect(recommendations).toContain('ui-navigation'); // React
    });

    it('should analyze project from file list', async () => {
      const fileList = [
        'src/index.ts',
        'src/components/App.tsx',
        'src/services/api.ts',
        'package.json',
        'tsconfig.json',
        'tests/app.test.tsx'
      ];

      const context = await intelligence.analyzeProject(TEST_PROJECT_ID, TEST_PROJECT_PATH, fileList);

      expect(context.languages).toContain('typescript');
      expect(context.frameworks).toContain('react');
      expect(context.frameworks).toContain('nodejs');
      expect(context.projectType).toBe('web_application');
      expect(context.fileStructure.entryPoints).toContain('src/index.ts');
      expect(context.fileStructure.configFiles).toContain('package.json');
      expect(context.recommendedTools.length).toBeGreaterThan(0);
    });

    it('should generate project insights', async () => {
      const complexContext = {
        languages: ['typescript'],
        frameworks: [],
        projectType: 'unknown',
        fileStructure: { entryPoints: [], configFiles: [], testDirectories: [] },
        patterns: { architectural: [], design: [] },
        complexity: 'high' as const,
        recommendedTools: []
      };

      await intelligence.updateProjectContext(TEST_PROJECT_ID, complexContext);
      const insights = await intelligence.getProjectInsights(TEST_PROJECT_ID);

      expect(insights).toContain('High complexity detected - consider refactoring or splitting into modules');
      expect(insights).toContain('No clear architectural pattern detected - consider adopting MVC, Clean Architecture, or similar');
      expect(insights).toContain('No test directories found - consider adding unit tests');
    });

    it('should learn from tool execution', async () => {
      const initialContext = {
        languages: ['typescript'],
        frameworks: ['react'],
        projectType: 'web_application',
        fileStructure: { entryPoints: [], configFiles: [], testDirectories: [] },
        patterns: { architectural: [], design: [] },
        complexity: 'medium' as const,
        recommendedTools: []
      };

      await intelligence.updateProjectContext(TEST_PROJECT_ID, initialContext);

      // Learn from successful tool execution
      await intelligence.learnFromToolExecution(TEST_PROJECT_ID, 'new-tool', true, 2000);

      const updatedContext = await intelligence.getProjectContext(TEST_PROJECT_ID);
      expect(updatedContext?.recommendedTools).toContain('new-tool');
    });
  });

  describe('Integration Tests', () => {
    it('should work together across all repositories', async () => {
      // 1. Analyze a project and create intelligence
      const fileList = ['src/index.ts', 'package.json', 'src/components/App.tsx'];
      const context = await projectIntelligence.analyzeProject(TEST_PROJECT_ID, TEST_PROJECT_PATH, fileList);

      expect(context.languages).toContain('typescript');

      // 2. Initialize tool configurations based on intelligence
      await toolConfigRepo.initializeProjectConfigs(TEST_PROJECT_ID);
      const configs = await toolConfigRepo.getProjectConfigs(TEST_PROJECT_ID);
      expect(configs.length).toBeGreaterThan(0);

      // 3. Store analysis results
      const analysisData = {
        analysis: { summary: 'Integration test analysis' },
        executionTime: 1234
      };
      
      await analysisRepo.storeAnalysis(TEST_PROJECT_ID, 'semantic-search', analysisData);

      // 4. Verify everything is connected
      const history = await analysisRepo.getAnalysisHistory(TEST_PROJECT_ID);
      expect(history).toHaveLength(1);

      const intelligence = await projectIntelligence.getProjectContext(TEST_PROJECT_ID);
      expect(intelligence?.languages).toContain('typescript');

      const toolConfig = await toolConfigRepo.getToolConfig(TEST_PROJECT_ID, 'semantic-search');
      expect(toolConfig).toBeDefined();
    });

    it('should handle large datasets efficiently', async () => {
      // Store many analysis results to test performance
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(
          analysisRepo.storeAnalysis(TEST_PROJECT_ID, `tool-${i % 5}`, {
            analysis: { summary: `Analysis ${i}` },
            executionTime: Math.random() * 5000
          })
        );
      }

      await Promise.all(promises);

      // Test retrieval performance
      const startTime = Date.now();
      const latestAnalyses = await analysisRepo.getLatestAnalyses(TEST_PROJECT_ID);
      const queryTime = Date.now() - startTime;

      expect(latestAnalyses).toHaveLength(5); // 5 unique tools
      expect(queryTime).toBeLessThan(1000); // Should be fast
    });
  });
});