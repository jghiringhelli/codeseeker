import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CodeMindEnhanced } from '../../../src/cli/codemind-enhanced-v2';
import { testDb } from '../../setup-test-database';

// Mock the file system and external dependencies
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  resolve: jest.fn((path) => path),
  dirname: jest.fn(),
}));

describe('CodeMindEnhanced', () => {
  let codeMind: CodeMindEnhanced;
  let db: any;

  beforeEach(async () => {
    db = await testDb.initialize();
    await testDb.insertTestData();
    codeMind = new CodeMindEnhanced();
  });

  afterEach(async () => {
    await testDb.cleanup();
  });

  describe('analyzeProject', () => {
    it('should analyze project structure and return insights', async () => {
      const projectPath = '/test/project';
      
      const analysis = await codeMind.analyzeProject(projectPath);

      expect(analysis).toHaveProperty('projectType');
      expect(analysis).toHaveProperty('complexity');
      expect(analysis).toHaveProperty('technologies');
      expect(analysis).toHaveProperty('patterns');
      expect(analysis).toHaveProperty('recommendations');
    });

    it('should identify TypeScript projects correctly', async () => {
      const projectPath = '/test/typescript-project';
      
      // Mock file system to return TypeScript files
      const fs = require('fs');
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('{ "compilerOptions": {} }');

      const analysis = await codeMind.analyzeProject(projectPath);

      expect(analysis.projectType).toBe('typescript');
      expect(analysis.technologies).toContain('typescript');
    });

    it('should detect React projects', async () => {
      const projectPath = '/test/react-project';
      
      const fs = require('fs');
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('{ "dependencies": { "react": "^18.0.0" } }');

      const analysis = await codeMind.analyzeProject(projectPath);

      expect(analysis.technologies).toContain('react');
      expect(analysis.patterns).toContain('component-based');
    });
  });

  describe('optimizeContext', () => {
    it('should reduce context size while preserving important information', async () => {
      const largeContext = {
        files: Array(50).fill(0).map((_, i) => ({ 
          name: `file${i}.ts`, 
          content: 'export const test = () => {};'.repeat(100) 
        })),
        description: 'Large project with many files and complex interactions'
      };

      const optimized = await codeMind.optimizeContext(largeContext);

      expect(optimized.tokenReduction).toBeGreaterThan(0.5);
      expect(optimized.optimizedFiles.length).toBeLessThan(largeContext.files.length);
      expect(optimized.preservedInformation).toContain('important');
    });

    it('should prioritize recently modified files', async () => {
      const context = {
        files: [
          { name: 'old.ts', content: 'old code', lastModified: new Date('2023-01-01') },
          { name: 'new.ts', content: 'new code', lastModified: new Date() }
        ]
      };

      const optimized = await codeMind.optimizeContext(context);

      expect(optimized.optimizedFiles[0].name).toBe('new.ts');
    });
  });

  describe('generateRecommendations', () => {
    it('should provide contextual recommendations', async () => {
      const projectAnalysis = {
        projectType: 'typescript',
        complexity: 'medium',
        technologies: ['typescript', 'jest'],
        issues: ['missing-tests', 'outdated-dependencies']
      };

      const recommendations = await codeMind.generateRecommendations(projectAnalysis);

      expect(recommendations).toHaveLength(greaterThan(0));
      expect(recommendations.some(r => r.type === 'testing')).toBe(true);
      expect(recommendations.some(r => r.type === 'dependency-management')).toBe(true);
    });

    it('should prioritize security recommendations', async () => {
      const projectAnalysis = {
        projectType: 'node',
        technologies: ['express'],
        issues: ['security-vulnerability', 'performance-issue']
      };

      const recommendations = await codeMind.generateRecommendations(projectAnalysis);

      const securityRec = recommendations.find(r => r.type === 'security');
      expect(securityRec).toBeDefined();
      expect(securityRec?.priority).toBe('high');
    });
  });

  describe('trackQuality', () => {
    it('should monitor code quality metrics', async () => {
      const qualityData = {
        linesOfCode: 1000,
        complexity: 5.2,
        testCoverage: 0.85,
        duplicates: 3,
        issues: 2
      };

      await codeMind.trackQuality('test-project', qualityData);

      const metrics = await codeMind.getQualityHistory('test-project');
      expect(metrics).toHaveLength(greaterThan(0));
      expect(metrics[0].complexity).toBe(5.2);
      expect(metrics[0].testCoverage).toBe(0.85);
    });

    it('should detect quality trends', async () => {
      // Add multiple quality measurements
      const measurements = [
        { complexity: 5.0, testCoverage: 0.80, timestamp: new Date('2024-01-01') },
        { complexity: 4.5, testCoverage: 0.85, timestamp: new Date('2024-01-02') },
        { complexity: 4.0, testCoverage: 0.90, timestamp: new Date('2024-01-03') }
      ];

      for (const measurement of measurements) {
        await codeMind.trackQuality('test-project', measurement);
      }

      const trends = await codeMind.getQualityTrends('test-project');
      expect(trends.complexity.trend).toBe('improving');
      expect(trends.testCoverage.trend).toBe('improving');
    });
  });

  describe('selfImprove', () => {
    it('should analyze usage patterns and suggest improvements', async () => {
      // Add usage data
      const usageData = [
        { tool: 'typescript-analyzer', success: true, tokensUsed: 150 },
        { tool: 'react-helper', success: false, tokensUsed: 300 },
        { tool: 'general-assistant', success: true, tokensUsed: 200 }
      ];

      for (const usage of usageData) {
        await codeMind.recordUsage(usage);
      }

      const improvements = await codeMind.selfImprove();

      expect(improvements).toHaveLength(greaterThan(0));
      expect(improvements.some(i => i.category === 'tool-selection')).toBe(true);
      expect(improvements.some(i => i.category === 'token-optimization')).toBe(true);
    });

    it('should suggest configuration improvements', async () => {
      const currentConfig = {
        maxTokens: 4000,
        confidenceThreshold: 0.7,
        enableCaching: false
      };

      const improvements = await codeMind.suggestConfigImprovements(currentConfig);

      expect(improvements.some(i => i.setting === 'enableCaching')).toBe(true);
      expect(improvements.some(i => i.expectedImprovement > 0)).toBe(true);
    });
  });
});