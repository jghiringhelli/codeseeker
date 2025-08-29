import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { WorkflowOrchestrator } from '../../../src/orchestration/workflow-orchestrator';
import { testDb } from '../../setup-test-database';

// Mock Redis client
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    publish: jest.fn(),
    subscribe: jest.fn(),
    on: jest.fn(),
    quit: jest.fn(),
  }));
});

describe('WorkflowOrchestrator', () => {
  let orchestrator: WorkflowOrchestrator;
  let db: any;
  let mockRedis: any;

  beforeEach(async () => {
    db = await testDb.initialize();
    await testDb.insertTestData();
    
    const Redis = require('ioredis');
    mockRedis = new Redis();
    
    orchestrator = new WorkflowOrchestrator(db, mockRedis);
  });

  afterEach(async () => {
    await testDb.cleanup();
  });

  describe('executeWorkflow', () => {
    it('should execute a complete workflow with all roles', async () => {
      const workflowDefinition = {
        id: 'test-workflow',
        name: 'Test Development Workflow',
        roles: ['architect', 'security', 'quality', 'performance', 'coordinator'],
        maxIterations: 3,
        convergenceThreshold: 0.9
      };

      const context = {
        projectPath: '/test/project',
        requirements: 'Build a user authentication system',
        constraints: ['use TypeScript', 'include tests']
      };

      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      const result = await orchestrator.executeWorkflow(workflowDefinition, context);

      expect(result.success).toBe(true);
      expect(result.workflowId).toBe(workflowDefinition.id);
      expect(result.executionSteps).toHaveLength(greaterThan(0));
      expect(result.finalOutput).toBeDefined();
    });

    it('should handle workflow failures gracefully', async () => {
      const workflowDefinition = {
        id: 'failing-workflow',
        name: 'Failing Workflow',
        roles: ['architect'],
        maxIterations: 1
      };

      const context = {
        projectPath: '/invalid/path',
        requirements: 'Invalid requirements'
      };

      // Mock a failure
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      const result = await orchestrator.executeWorkflow(workflowDefinition, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Redis connection failed');
    });

    it('should respect maximum iteration limits', async () => {
      const workflowDefinition = {
        id: 'limited-workflow',
        name: 'Limited Iterations Workflow',
        roles: ['architect', 'quality'],
        maxIterations: 2,
        convergenceThreshold: 0.95 // High threshold to prevent early convergence
      };

      const context = {
        projectPath: '/test/project',
        requirements: 'Complex system requiring multiple iterations'
      };

      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      const result = await orchestrator.executeWorkflow(workflowDefinition, context);

      expect(result.iterationsCompleted).toBeLessThanOrEqual(2);
    });
  });

  describe('role coordination', () => {
    it('should coordinate roles in correct sequence', async () => {
      const roles = ['architect', 'security', 'quality'];
      const context = { requirements: 'Test coordination' };

      mockRedis.get.mockResolvedValue(JSON.stringify({ currentRole: 0, context }));
      mockRedis.set.mockResolvedValue('OK');

      const coordination = await orchestrator.coordinateRoles(roles, context);

      expect(coordination.executionOrder).toEqual(roles);
      expect(coordination.roleOutputs).toHaveProperty('architect');
      expect(coordination.roleOutputs).toHaveProperty('security');
      expect(coordination.roleOutputs).toHaveProperty('quality');
    });

    it('should handle role failures and continue with remaining roles', async () => {
      const roles = ['architect', 'failing-role', 'quality'];
      const context = { requirements: 'Test failure handling' };

      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue('OK');

      const coordination = await orchestrator.coordinateRoles(roles, context);

      expect(coordination.failedRoles).toContain('failing-role');
      expect(coordination.successfulRoles).toContain('architect');
      expect(coordination.successfulRoles).toContain('quality');
    });

    it('should detect convergence between role iterations', async () => {
      const roles = ['architect', 'quality'];
      const context = { requirements: 'Stable requirements' };

      // Mock identical outputs to trigger convergence
      const stableOutput = JSON.stringify({ design: 'stable design', quality: 'high' });
      mockRedis.get.mockResolvedValue(stableOutput);
      mockRedis.set.mockResolvedValue('OK');

      const result = await orchestrator.checkConvergence(roles, context, 2);

      expect(result.converged).toBe(true);
      expect(result.convergenceScore).toBeGreaterThan(0.9);
    });
  });

  describe('state management', () => {
    it('should persist workflow state to Redis', async () => {
      const workflowId = 'test-workflow';
      const state = {
        currentStep: 2,
        roleOutputs: { architect: 'design complete' },
        context: { requirements: 'test' }
      };

      await orchestrator.saveWorkflowState(workflowId, state);

      expect(mockRedis.set).toHaveBeenCalledWith(
        `workflow:${workflowId}:state`,
        JSON.stringify(state),
        'EX',
        3600
      );
    });

    it('should restore workflow state from Redis', async () => {
      const workflowId = 'test-workflow';
      const savedState = {
        currentStep: 1,
        roleOutputs: { architect: 'initial design' },
        context: { requirements: 'restored test' }
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(savedState));

      const restoredState = await orchestrator.loadWorkflowState(workflowId);

      expect(restoredState).toEqual(savedState);
      expect(mockRedis.get).toHaveBeenCalledWith(`workflow:${workflowId}:state`);
    });

    it('should handle missing workflow state gracefully', async () => {
      const workflowId = 'nonexistent-workflow';
      
      mockRedis.get.mockResolvedValue(null);

      const state = await orchestrator.loadWorkflowState(workflowId);

      expect(state).toBeNull();
    });
  });

  describe('monitoring and metrics', () => {
    it('should track workflow execution metrics', async () => {
      const workflowId = 'metrics-workflow';
      const startTime = Date.now();

      await orchestrator.startMetricsTracking(workflowId);
      
      // Simulate workflow execution time
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await orchestrator.endMetricsTracking(workflowId, true);

      const metrics = await orchestrator.getWorkflowMetrics(workflowId);

      expect(metrics.executionTime).toBeGreaterThan(0);
      expect(metrics.success).toBe(true);
      expect(metrics.startTime).toBeGreaterThan(startTime);
    });

    it('should calculate role performance statistics', async () => {
      const roleStats = {
        architect: { executionTime: 500, success: true, outputQuality: 0.9 },
        quality: { executionTime: 300, success: true, outputQuality: 0.85 },
        security: { executionTime: 400, success: false, outputQuality: 0.6 }
      };

      await orchestrator.updateRoleStatistics('test-workflow', roleStats);

      const stats = await orchestrator.getRolePerformanceStats();

      expect(stats).toHaveProperty('architect');
      expect(stats).toHaveProperty('quality');
      expect(stats).toHaveProperty('security');
      
      expect(stats.architect.averageExecutionTime).toBe(500);
      expect(stats.architect.successRate).toBe(1.0);
      expect(stats.security.successRate).toBeLessThan(1.0);
    });

    it('should identify performance bottlenecks', async () => {
      const workflowMetrics = {
        'workflow-1': { roles: { architect: 1000, quality: 200, security: 300 } },
        'workflow-2': { roles: { architect: 1200, quality: 180, security: 280 } },
        'workflow-3': { roles: { architect: 900, quality: 220, security: 320 } }
      };

      const bottlenecks = await orchestrator.identifyBottlenecks(workflowMetrics);

      expect(bottlenecks).toContain('architect'); // Consistently slow role
      expect(bottlenecks).not.toContain('quality'); // Consistently fast role
    });
  });

  describe('error handling and recovery', () => {
    it('should implement retry logic for transient failures', async () => {
      const workflowDefinition = { id: 'retry-test', roles: ['architect'], maxIterations: 1 };
      const context = { requirements: 'test retry' };

      // Mock first call to fail, second to succeed
      mockRedis.get
        .mockRejectedValueOnce(new Error('Transient error'))
        .mockResolvedValueOnce(null);

      const result = await orchestrator.executeWithRetry(workflowDefinition, context);

      expect(result.success).toBe(true);
      expect(result.retryAttempts).toBe(1);
    });

    it('should fail after maximum retry attempts', async () => {
      const workflowDefinition = { id: 'max-retry-test', roles: ['architect'], maxIterations: 1 };
      const context = { requirements: 'test max retry' };

      // Mock all retry attempts to fail
      mockRedis.get.mockRejectedValue(new Error('Persistent error'));

      const result = await orchestrator.executeWithRetry(workflowDefinition, context, { maxRetries: 2 });

      expect(result.success).toBe(false);
      expect(result.retryAttempts).toBe(2);
      expect(result.error).toContain('Persistent error');
    });

    it('should recover from partial workflow failures', async () => {
      const workflowDefinition = {
        id: 'recovery-test',
        roles: ['architect', 'security', 'quality'],
        maxIterations: 1
      };
      
      const partialState = {
        currentStep: 1,
        roleOutputs: { architect: 'completed' },
        context: { requirements: 'test recovery' }
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(partialState));

      const result = await orchestrator.recoverWorkflow('recovery-test');

      expect(result.success).toBe(true);
      expect(result.resumedFromStep).toBe(1);
      expect(result.roleOutputs).toHaveProperty('architect', 'completed');
    });
  });
});