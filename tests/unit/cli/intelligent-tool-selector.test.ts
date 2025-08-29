import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { IntelligentToolSelector } from '../../../src/cli/intelligent-tool-selector';
import { testDb } from '../../setup-test-database';

describe('IntelligentToolSelector', () => {
  let toolSelector: IntelligentToolSelector;
  let db: any;

  beforeEach(async () => {
    db = await testDb.initialize();
    await testDb.insertTestData();
    toolSelector = new IntelligentToolSelector(db);
  });

  afterEach(async () => {
    await testDb.cleanup();
  });

  describe('selectOptimalTool', () => {
    it('should select appropriate tool based on context', async () => {
      const context = {
        projectType: 'typescript',
        taskType: 'debugging',
        fileExtension: '.ts',
        complexity: 'medium'
      };

      const result = await toolSelector.selectOptimalTool(context);

      expect(result).toHaveProperty('toolName');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('reasoning');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should return high confidence for well-known patterns', async () => {
      const context = {
        projectType: 'react',
        taskType: 'component-creation',
        fileExtension: '.jsx',
        complexity: 'low'
      };

      const result = await toolSelector.selectOptimalTool(context);

      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should handle unknown project types gracefully', async () => {
      const context = {
        projectType: 'unknown-framework',
        taskType: 'general-coding',
        fileExtension: '.unknown',
        complexity: 'high'
      };

      const result = await toolSelector.selectOptimalTool(context);

      expect(result).toHaveProperty('toolName');
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('optimizeTokenUsage', () => {
    it('should reduce token usage by at least 50%', async () => {
      const originalRequest = {
        context: 'Large context with many files and complex logic',
        files: Array(20).fill(0).map((_, i) => `file${i}.ts`),
        complexity: 'high'
      };

      const optimized = await toolSelector.optimizeTokenUsage(originalRequest);

      expect(optimized.tokenReduction).toBeGreaterThan(0.5);
      expect(optimized.optimizedContext.length).toBeLessThan(originalRequest.context.length);
    });

    it('should preserve essential information during optimization', async () => {
      const originalRequest = {
        context: 'This is critical information that must be preserved',
        files: ['important.ts', 'secondary.ts'],
        complexity: 'medium'
      };

      const optimized = await toolSelector.optimizeTokenUsage(originalRequest);

      expect(optimized.optimizedContext).toContain('critical information');
      expect(optimized.preservedFiles).toContain('important.ts');
    });
  });

  describe('learnFromUsage', () => {
    it('should update usage statistics', async () => {
      const usageData = {
        toolName: 'typescript-analyzer',
        context: { projectType: 'typescript', taskType: 'analysis' },
        success: true,
        tokensUsed: 150,
        executionTime: 500
      };

      await toolSelector.learnFromUsage(usageData);

      const stats = await toolSelector.getToolStatistics('typescript-analyzer');
      expect(stats.totalUsage).toBeGreaterThan(0);
      expect(stats.successRate).toBeGreaterThan(0);
    });

    it('should improve recommendations based on learning', async () => {
      // Add multiple successful usage patterns
      const usagePatterns = [
        { toolName: 'react-helper', context: { projectType: 'react' }, success: true },
        { toolName: 'react-helper', context: { projectType: 'react' }, success: true },
        { toolName: 'react-helper', context: { projectType: 'react' }, success: true }
      ];

      for (const pattern of usagePatterns) {
        await toolSelector.learnFromUsage({ ...pattern, tokensUsed: 100, executionTime: 300 });
      }

      const recommendation = await toolSelector.selectOptimalTool({ projectType: 'react' });
      expect(recommendation.toolName).toBe('react-helper');
      expect(recommendation.confidence).toBeGreaterThan(0.9);
    });
  });

  describe('getQualityMetrics', () => {
    it('should return comprehensive quality metrics', async () => {
      const metrics = await toolSelector.getQualityMetrics();

      expect(metrics).toHaveProperty('tokenEfficiency');
      expect(metrics).toHaveProperty('selectionAccuracy');
      expect(metrics).toHaveProperty('performanceMetrics');
      expect(metrics).toHaveProperty('usagePatterns');
    });

    it('should track token efficiency improvements', async () => {
      // Simulate usage that improves efficiency
      await toolSelector.learnFromUsage({
        toolName: 'efficient-tool',
        context: { projectType: 'test' },
        success: true,
        tokensUsed: 50,
        executionTime: 200
      });

      const metrics = await toolSelector.getQualityMetrics();
      expect(metrics.tokenEfficiency.averageReduction).toBeGreaterThan(0);
    });
  });
});