import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { MarketplaceManager } from '../../../src/cli/marketplace';
import { testDb } from '../../setup-test-database';

describe('MarketplaceManager', () => {
  let marketplace: MarketplaceManager;
  let db: any;

  beforeEach(async () => {
    db = await testDb.initialize();
    await testDb.insertTestData();
    marketplace = new MarketplaceManager(db);
  });

  afterEach(async () => {
    await testDb.cleanup();
  });

  describe('discoverTools', () => {
    it('should discover available tools in the marketplace', async () => {
      const tools = await marketplace.discoverTools();

      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      // Check tool structure
      if (tools.length > 0) {
        const tool = tools[0];
        expect(tool).toHaveProperty('id');
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('version');
        expect(tool).toHaveProperty('category');
        expect(tool).toHaveProperty('rating');
      }
    });

    it('should filter tools by category', async () => {
      const category = 'productivity';
      const tools = await marketplace.discoverTools({ category });

      tools.forEach(tool => {
        expect(tool.category).toBe(category);
      });
    });

    it('should filter tools by rating threshold', async () => {
      const minRating = 4.0;
      const tools = await marketplace.discoverTools({ minRating });

      tools.forEach(tool => {
        expect(tool.rating).toBeGreaterThanOrEqual(minRating);
      });
    });
  });

  describe('installTool', () => {
    it('should install a tool successfully', async () => {
      const toolId = 'test-productivity-tool';
      
      const result = await marketplace.installTool(toolId);

      expect(result.success).toBe(true);
      expect(result.toolId).toBe(toolId);
      
      // Verify tool is installed
      const installedTools = await marketplace.getInstalledTools();
      expect(installedTools.some(t => t.id === toolId)).toBe(true);
    });

    it('should handle installation failures gracefully', async () => {
      const invalidToolId = 'non-existent-tool';
      
      const result = await marketplace.installTool(invalidToolId);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should prevent duplicate installations', async () => {
      const toolId = 'test-tool';
      
      // Install once
      await marketplace.installTool(toolId);
      
      // Try to install again
      const result = await marketplace.installTool(toolId);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('already installed');
    });
  });

  describe('uninstallTool', () => {
    it('should uninstall a tool successfully', async () => {
      const toolId = 'test-tool-to-uninstall';
      
      // Install first
      await marketplace.installTool(toolId);
      
      // Then uninstall
      const result = await marketplace.uninstallTool(toolId);

      expect(result.success).toBe(true);
      
      // Verify tool is no longer installed
      const installedTools = await marketplace.getInstalledTools();
      expect(installedTools.some(t => t.id === toolId)).toBe(false);
    });

    it('should handle uninstalling non-existent tools', async () => {
      const nonExistentToolId = 'never-installed-tool';
      
      const result = await marketplace.uninstallTool(nonExistentToolId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not installed');
    });
  });

  describe('updateTool', () => {
    it('should update a tool to latest version', async () => {
      const toolId = 'test-updateable-tool';
      
      // Install initial version
      await marketplace.installTool(toolId);
      
      const result = await marketplace.updateTool(toolId);

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('oldVersion');
      expect(result).toHaveProperty('newVersion');
    });

    it('should handle cases where no update is available', async () => {
      const toolId = 'up-to-date-tool';
      
      await marketplace.installTool(toolId);
      
      const result = await marketplace.updateTool(toolId);

      if (!result.success) {
        expect(result.error).toContain('up to date');
      }
    });
  });

  describe('searchTools', () => {
    it('should search tools by keyword', async () => {
      const keyword = 'productivity';
      
      const results = await marketplace.searchTools(keyword);

      results.forEach(tool => {
        const searchText = `${tool.name} ${tool.description} ${tool.tags?.join(' ') || ''}`.toLowerCase();
        expect(searchText).toContain(keyword.toLowerCase());
      });
    });

    it('should return empty array for no matches', async () => {
      const keyword = 'very-specific-non-existent-keyword-xyz';
      
      const results = await marketplace.searchTools(keyword);

      expect(results).toEqual([]);
    });
  });

  describe('getToolRecommendations', () => {
    it('should recommend tools based on project context', async () => {
      const projectContext = {
        projectType: 'typescript',
        technologies: ['react', 'jest'],
        challenges: ['testing', 'performance']
      };
      
      const recommendations = await marketplace.getToolRecommendations(projectContext);

      expect(Array.isArray(recommendations)).toBe(true);
      
      if (recommendations.length > 0) {
        const recommendation = recommendations[0];
        expect(recommendation).toHaveProperty('tool');
        expect(recommendation).toHaveProperty('relevanceScore');
        expect(recommendation).toHaveProperty('reason');
        expect(recommendation.relevanceScore).toBeGreaterThan(0);
        expect(recommendation.relevanceScore).toBeLessThanOrEqual(1);
      }
    });

    it('should prioritize highly relevant tools', async () => {
      const projectContext = {
        projectType: 'react',
        technologies: ['react', 'typescript'],
        challenges: ['component-testing']
      };
      
      const recommendations = await marketplace.getToolRecommendations(projectContext);

      if (recommendations.length > 1) {
        // Should be sorted by relevance score descending
        for (let i = 0; i < recommendations.length - 1; i++) {
          expect(recommendations[i].relevanceScore)
            .toBeGreaterThanOrEqual(recommendations[i + 1].relevanceScore);
        }
      }
    });
  });

  describe('trackToolUsage', () => {
    it('should track tool usage statistics', async () => {
      const toolId = 'tracked-tool';
      const usageData = {
        toolId,
        sessionDuration: 1200,
        tasksCompleted: 3,
        success: true,
        tokensUsed: 250
      };

      await marketplace.trackToolUsage(usageData);

      const stats = await marketplace.getToolUsageStats(toolId);
      expect(stats.totalSessions).toBeGreaterThan(0);
      expect(stats.averageSessionDuration).toBeGreaterThan(0);
      expect(stats.successRate).toBeGreaterThan(0);
    });

    it('should calculate accurate success rates', async () => {
      const toolId = 'success-rate-tool';
      
      // Track multiple sessions with different outcomes
      await marketplace.trackToolUsage({ toolId, success: true, tokensUsed: 100 });
      await marketplace.trackToolUsage({ toolId, success: true, tokensUsed: 150 });
      await marketplace.trackToolUsage({ toolId, success: false, tokensUsed: 200 });

      const stats = await marketplace.getToolUsageStats(toolId);
      expect(stats.successRate).toBeCloseTo(0.67, 2); // 2 out of 3 successful
    });
  });
});