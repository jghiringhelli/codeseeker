// Try to load real implementations, fallback to mocks
let EnhancedToolSelector, ToolBundleSystem;

try {
  // Try to load from compiled TypeScript
  const toolSelector = require('../../dist/cli/enhanced-tool-selector');
  const bundleSystem = require('../../dist/cli/tool-bundle-system');
  
  EnhancedToolSelector = toolSelector.EnhancedToolSelector || toolSelector.default;
  ToolBundleSystem = bundleSystem.ToolBundleSystem || bundleSystem.default;
  
  console.log('✅ Loaded real tool implementations');
} catch (e) {
  console.warn('⚠️ Using mock tool implementations:', e.message);
  
  // Mock implementations
  class MockEnhancedToolSelector {
    constructor() {}
    selectTools() { 
      return {
        selectedTools: [],
        selectedBundles: [],
        confidence: 0.5,
        reasoning: 'Mock implementation',
        estimatedTokens: 0,
        executionStrategy: 'sequential'
      };
    }
    getAvailableTools() { return []; }
    getAvailableBundles() { return this.mockBundles(); }
    mockBundles() {
      return [
        { id: 'architecture', name: 'Architecture Analysis', tools: ['semantic-graph', 'centralization'], category: 'architecture' },
        { id: 'quality', name: 'Code Quality', tools: ['duplication', 'test-coverage'], category: 'quality' },
        { id: 'performance', name: 'Performance', tools: ['performance-analyzer'], category: 'performance' }
      ];
    }
  }

  class MockToolBundleSystem {
    constructor() {}
    getBundles() { 
      return [
        { id: 'architecture', name: 'Architecture Analysis', tools: ['semantic-graph', 'centralization'], category: 'architecture' },
        { id: 'quality', name: 'Code Quality', tools: ['duplication', 'test-coverage'], category: 'quality' },
        { id: 'performance', name: 'Performance', tools: ['performance-analyzer'], category: 'performance' }
      ]; 
    }
    executeBundle() { return { success: false, message: 'Tool execution not available in dashboard' }; }
    createBundle() { return { success: false, message: 'Bundle creation not available' }; }
    selectBundles() { return this.getBundles().slice(0, 2); }
  }

  EnhancedToolSelector = MockEnhancedToolSelector;
  ToolBundleSystem = MockToolBundleSystem;
}

class ToolBundleAPI {
    constructor(database, performanceMonitor) {
        this.db = database;
        this.performanceMonitor = performanceMonitor;
        this.enhancedSelector = new EnhancedToolSelector(database, performanceMonitor);
        this.bundleSystem = null; // Will be initialized
    }

    async initialize() {
        // Enhanced selector is initialized in constructor
        this.bundleSystem = this.enhancedSelector.getBundleSystem ? await this.enhancedSelector.getBundleSystem() : null;
        console.log('✅ Tool Bundle API initialized');
    }

    // Bundle Management Endpoints
    async getAllBundles(req, res) {
        try {
            const bundles = this.bundleSystem.getAllBundles();
            const stats = await this.enhancedSelector.getSelectionStats();
            
            res.json({
                success: true,
                bundles,
                stats,
                total: bundles.length
            });
        } catch (error) {
            console.error('❌ Error getting all bundles:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }

    async getBundle(req, res) {
        try {
            const { id } = req.params;
            const bundle = this.bundleSystem.getBundle(id);
            
            if (!bundle) {
                return res.status(404).json({
                    success: false,
                    error: 'Bundle not found'
                });
            }

            // Get usage statistics for this bundle
            const usageStats = await this.getBundleUsageStats(id);
            
            res.json({
                success: true,
                bundle,
                usageStats
            });
        } catch (error) {
            console.error('❌ Error getting bundle:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }

    async createBundle(req, res) {
        try {
            const bundleData = req.body;
            
            // Validate required fields
            const requiredFields = ['name', 'description', 'category', 'tools'];
            for (const field of requiredFields) {
                if (!bundleData[field]) {
                    return res.status(400).json({
                        success: false,
                        error: `Missing required field: ${field}`
                    });
                }
            }

            // Set defaults
            const bundle = {
                ...bundleData,
                dependencies: bundleData.dependencies || [],
                conditions: bundleData.conditions || [],
                executionOrder: bundleData.executionOrder || 'dependency-based',
                priority: bundleData.priority || 0,
                tokenCost: bundleData.tokenCost || 'medium',
                estimatedTime: bundleData.estimatedTime || 'medium',
                scenarios: bundleData.scenarios || [],
                autoTrigger: bundleData.autoTrigger || [],
                version: bundleData.version || '1.0.0',
                isDefault: false,
                isActive: bundleData.isActive !== false
            };

            const bundleId = await this.bundleSystem.createBundle(bundle);
            
            res.json({
                success: true,
                bundleId,
                message: 'Bundle created successfully',
                bundle: this.bundleSystem.getBundle(bundleId)
            });
        } catch (error) {
            console.error('❌ Error creating bundle:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }

    async updateBundle(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;
            
            await this.bundleSystem.updateBundle(id, updates);
            
            res.json({
                success: true,
                message: 'Bundle updated successfully',
                bundle: this.bundleSystem.getBundle(id)
            });
        } catch (error) {
            console.error('❌ Error updating bundle:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }

    async deleteBundle(req, res) {
        try {
            const { id } = req.params;
            
            await this.bundleSystem.deleteBundle(id);
            
            res.json({
                success: true,
                message: 'Bundle deleted successfully'
            });
        } catch (error) {
            console.error('❌ Error deleting bundle:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }

    async toggleBundleStatus(req, res) {
        try {
            const { id } = req.params;
            const bundle = this.bundleSystem.getBundle(id);
            
            if (!bundle) {
                return res.status(404).json({
                    success: false,
                    error: 'Bundle not found'
                });
            }

            await this.bundleSystem.updateBundle(id, { isActive: !bundle.isActive });
            
            res.json({
                success: true,
                message: `Bundle ${bundle.isActive ? 'deactivated' : 'activated'}`,
                bundle: this.bundleSystem.getBundle(id)
            });
        } catch (error) {
            console.error('❌ Error toggling bundle status:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }

    // Description Management Endpoints
    async getAllDescriptions(req, res) {
        try {
            const descriptions = this.bundleSystem.getAllDescriptions();
            const bundles = this.bundleSystem.getAllBundles();
            
            // Add bundle descriptions to the list
            const allDescriptions = [
                ...descriptions,
                ...bundles.map(bundle => ({
                    id: bundle.id,
                    type: 'bundle',
                    name: bundle.name,
                    description: bundle.description,
                    defaultDescription: bundle.description,
                    lastModified: bundle.lastModified,
                    modifiedBy: 'system',
                    isCustom: !bundle.isDefault
                }))
            ];
            
            res.json({
                success: true,
                descriptions: allDescriptions,
                total: allDescriptions.length
            });
        } catch (error) {
            console.error('❌ Error getting descriptions:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }

    async updateDescription(req, res) {
        try {
            const { id } = req.params;
            const { type, description } = req.body;
            const modifiedBy = req.user?.username || 'user';
            
            if (!description) {
                return res.status(400).json({
                    success: false,
                    error: 'Description is required'
                });
            }

            if (type === 'bundle') {
                await this.bundleSystem.updateBundleDescription(id, description, modifiedBy);
            } else if (type === 'tool') {
                await this.bundleSystem.updateToolDescription(id, description, modifiedBy);
            } else {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid type. Must be "bundle" or "tool"'
                });
            }
            
            res.json({
                success: true,
                message: 'Description updated successfully'
            });
        } catch (error) {
            console.error('❌ Error updating description:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }

    async resetDescriptionToDefault(req, res) {
        try {
            const { id } = req.params;
            
            await this.bundleSystem.resetToDefault(id);
            
            res.json({
                success: true,
                message: 'Description reset to default'
            });
        } catch (error) {
            console.error('❌ Error resetting description:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }

    // Selection Testing Endpoints
    async previewSelection(req, res) {
        try {
            const { task, projectPath, codebaseContext, optimization = 'balanced' } = req.body;
            
            if (!task) {
                return res.status(400).json({
                    success: false,
                    error: 'Task description is required'
                });
            }

            const context = {
                task,
                projectPath: projectPath || process.cwd(),
                codebaseContext,
                optimization
            };

            const result = await this.enhancedSelector.selectOptimalApproach(context);
            
            res.json({
                success: true,
                selection: result,
                preview: true
            });
        } catch (error) {
            console.error('❌ Error previewing selection:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }

    async getSelectionHistory(req, res) {
        try {
            const { limit = 50, offset = 0 } = req.query;
            
            // This would query the bundle_selection_history table
            const mockHistory = [
                {
                    id: 1,
                    taskDescription: 'Analyze code quality and suggest improvements',
                    selectedBundles: ['code-analysis-bundle'],
                    selectedTools: ['quality-metrics', 'complexity-analyzer'],
                    reasoning: 'Selected comprehensive analysis bundle for quality assessment',
                    selectionTimestamp: new Date(Date.now() - 3600000),
                    success: true,
                    userSatisfaction: 4
                },
                {
                    id: 2,
                    taskDescription: 'Generate documentation for the project',
                    selectedBundles: ['documentation-bundle'],
                    selectedTools: ['readme-generator', 'api-doc-generator'],
                    reasoning: 'Auto-triggered documentation bundle based on task keywords',
                    selectionTimestamp: new Date(Date.now() - 7200000),
                    success: true,
                    userSatisfaction: 5
                }
            ];
            
            res.json({
                success: true,
                history: mockHistory.slice(offset, offset + limit),
                total: mockHistory.length
            });
        } catch (error) {
            console.error('❌ Error getting selection history:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }

    // Analytics Endpoints
    async getBundleAnalytics(req, res) {
        try {
            const { timeframe = '7d' } = req.query;
            
            // Mock analytics data
            const analytics = {
                timeframe,
                totalSelections: 156,
                bundleUsage: [
                    { bundleId: 'code-analysis-bundle', name: 'Code Analysis Bundle', count: 45, successRate: 0.89 },
                    { bundleId: 'documentation-bundle', name: 'Documentation Bundle', count: 38, successRate: 0.94 },
                    { bundleId: 'testing-bundle', name: 'Testing Bundle', count: 23, successRate: 0.87 }
                ],
                selectionStrategies: [
                    { strategy: 'bundle-first', count: 62, percentage: 39.7 },
                    { strategy: 'hybrid', count: 54, percentage: 34.6 },
                    { strategy: 'tool-first', count: 28, percentage: 17.9 },
                    { strategy: 'claude-direct', count: 12, percentage: 7.7 }
                ],
                averageSelectionTime: 2.3, // seconds
                tokenSavings: 23456,
                userSatisfactionAvg: 4.2
            };
            
            res.json({
                success: true,
                analytics
            });
        } catch (error) {
            console.error('❌ Error getting bundle analytics:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }

    // Cache Management
    async clearSelectionCache(req, res) {
        try {
            this.enhancedSelector.clearCache();
            
            res.json({
                success: true,
                message: 'Selection cache cleared successfully'
            });
        } catch (error) {
            console.error('❌ Error clearing cache:', error);
            res.status(500).json({ 
                success: false, 
                error: error.message 
            });
        }
    }

    // Helper Methods
    async getBundleUsageStats(bundleId) {
        // This would query the bundle_usage_stats table
        // For now, return mock data
        return {
            totalUsages: Math.floor(Math.random() * 50) + 10,
            successRate: 0.85 + Math.random() * 0.15,
            averageExecutionTime: 15 + Math.random() * 30,
            lastUsed: new Date(Date.now() - Math.random() * 86400000 * 7), // Within last week
            userFeedbackAvg: 3.5 + Math.random() * 1.5
        };
    }
}

module.exports = { ToolBundleAPI };