import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RoleKnowledgeIntegrator, RoleType } from '../../../src/orchestration/role-knowledge-integrator';
import { Logger } from '../../../src/utils/logger';

// Mock dependencies
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setLevel: jest.fn(),
  child: jest.fn().mockReturnThis()
} as any;

const mockKnowledgeGraph = {
  findRelationships: jest.fn(),
  findPatterns: jest.fn(),
  getNodeDependencies: jest.fn(),
  findSimilarNodes: jest.fn(),
  getTestDependencies: jest.fn(),
  findSimilarTestPatterns: jest.fn(),
  detectArchitecturalPatterns: jest.fn(),
  analyzeDependencyGraph: jest.fn(),
  findSimilarImplementations: jest.fn(),
  findSecurityRelationships: jest.fn(),
  getSecurityDependencies: jest.fn(),
  findSimilarSecurityIssues: jest.fn(),
  findPerformanceRelationships: jest.fn(),
  getPerformanceDependencies: jest.fn(),
  findSimilarPerformanceIssues: jest.fn(),
  findQualityRelationships: jest.fn(),
  getQualityDependencies: jest.fn(),
  findSimilarQualityIssues: jest.fn()
} as any;

const mockKnowledgeRepo = {
  generateRAGContext: jest.fn(),
  searchKnowledge: jest.fn()
} as any;

const mockProjectKB = {
  getStrategicContext: jest.fn(),
  recordAccomplishment: jest.fn()
} as any;

describe('RoleKnowledgeIntegrator', () => {
  let integrator: RoleKnowledgeIntegrator;

  beforeEach(() => {
    jest.clearAllMocks();
    integrator = new RoleKnowledgeIntegrator(
      mockLogger,
      mockKnowledgeGraph as any,
      mockKnowledgeRepo as any,
      mockProjectKB as any
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('prepareRoleKnowledge', () => {
    it('should prepare knowledge context for requirement analyst', async () => {
      // Setup
      const roleType = RoleType.REQUIREMENT_ANALYST;
      const nodeId = 'node-1';
      const executionId = 'exec-1';
      const step = 'analyze-requirements';
      const inputs = { featureId: 'feature-1', description: 'User authentication' };

      // Mock responses
      mockKnowledgeGraph.findRelationships.mockResolvedValue([
        { id: '1', subject: 'User', predicate: 'HAS_DEPENDENCY', object: 'AuthService' }
      ]);
      mockKnowledgeGraph.findPatterns.mockResolvedValue([
        { name: 'Repository', confidence: 0.9 }
      ]);
      mockKnowledgeGraph.getNodeDependencies.mockResolvedValue([
        { id: 'dep-1', name: 'AuthService' }
      ]);
      mockKnowledgeGraph.findSimilarNodes.mockResolvedValue([
        { id: 'similar-1', similarity: 0.85 }
      ]);

      mockKnowledgeRepo.generateRAGContext.mockResolvedValue({
        synthesizedKnowledge: 'Requirements should be specific and testable',
        confidence: 0.9,
        relevantDocuments: ['doc1', 'doc2'],
        sources: ['source1', 'source2']
      });

      mockKnowledgeRepo.searchKnowledge.mockResolvedValue([
        { document: { type: 'PROFESSIONAL_ADVICE', title: 'Requirements Best Practices' } },
        { document: { type: 'RESEARCH_PAPER', title: 'Modern Requirements Engineering' } }
      ]);

      mockProjectKB.getStrategicContext.mockResolvedValue({
        currentPhase: { name: 'Development', progress: 0.3 },
        activeObjectives: ['Improve user experience'],
        constraints: [{ type: 'timeline', description: 'Must complete by Q3' }],
        qualityGates: [{ name: 'Requirements Review', threshold: 0.9 }],
        highRisks: [{ description: 'Complex authentication requirements' }]
      });

      // Execute
      const context = await integrator.prepareRoleKnowledge(roleType, nodeId, executionId, step, inputs);

      // Verify
      expect(context).toBeDefined();
      expect(context.roleType).toBe(roleType);
      expect(context.nodeId).toBe(nodeId);
      expect(context.executionId).toBe(executionId);
      expect(context.step).toBe(step);
      expect(context.inputs).toBe(inputs);

      // Verify knowledge packet structure
      expect(context.knowledgePacket).toBeDefined();
      expect(context.knowledgePacket.triads).toBeDefined();
      expect(context.knowledgePacket.ragContext).toBeDefined();
      expect(context.knowledgePacket.historical).toBeDefined();
      expect(context.knowledgePacket.project).toBeDefined();
      expect(context.knowledgePacket.peers).toBeDefined();
      expect(context.knowledgePacket.domain).toBeDefined();

      // Verify context window
      expect(context.contextWindow).toBeDefined();
      expect(context.contextWindow.maxTokens).toBeGreaterThan(0);
      expect(context.contextWindow.confidence).toBeGreaterThanOrEqual(0);
      expect(context.contextWindow.confidence).toBeLessThanOrEqual(1);

      // Verify feedback loop initialization
      expect(context.feedbackLoop).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith('Preparing knowledge context for REQUIREMENT_ANALYST in step: analyze-requirements');
    });

    it('should prepare knowledge context for test designer', async () => {
      // Setup
      const roleType = RoleType.TEST_DESIGNER;
      const nodeId = 'node-2';
      const executionId = 'exec-1';
      const step = 'design-tests';
      const inputs = { targetCode: 'AuthService', requirements: 'User login validation' };

      // Mock test-specific responses
      mockKnowledgeGraph.findRelationships.mockResolvedValue([
        { id: '2', subject: 'AuthService', predicate: 'TESTED_BY', object: 'AuthServiceTest' }
      ]);
      mockKnowledgeGraph.findPatterns.mockResolvedValue([
        { name: 'Factory', confidence: 0.8 },
        { name: 'Mock', confidence: 0.9 }
      ]);
      mockKnowledgeGraph.getTestDependencies.mockResolvedValue([
        { id: 'test-dep-1', name: 'TestFramework' }
      ]);
      mockKnowledgeGraph.findSimilarTestPatterns.mockResolvedValue([
        { pattern: 'Given-When-Then', similarity: 0.9 }
      ]);

      mockKnowledgeRepo.generateRAGContext.mockResolvedValue({
        synthesizedKnowledge: 'Test design should follow TDD principles',
        confidence: 0.85,
        relevantDocuments: ['test-doc1'],
        sources: ['test-source1']
      });

      // Execute
      const context = await integrator.prepareRoleKnowledge(roleType, nodeId, executionId, step, inputs);

      // Verify
      expect(context.roleType).toBe(roleType);
      expect(context.knowledgePacket.triads.patterns).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Factory' }),
          expect.objectContaining({ name: 'Mock' })
        ])
      );
      
      expect(mockKnowledgeGraph.findRelationships).toHaveBeenCalledWith('METHOD', 'TESTED_BY');
      expect(mockKnowledgeGraph.findPatterns).toHaveBeenCalledWith(['Factory', 'Builder', 'Mock']);
    });

    it('should handle security auditor role requirements', async () => {
      const roleType = RoleType.SECURITY_AUDITOR;
      const inputs = { 
        codeFiles: ['auth.ts', 'user.ts'], 
        vulnerabilityReports: ['report1.json'],
        dependencies: ['jwt', 'bcrypt']
      };

      mockKnowledgeGraph.findSecurityRelationships.mockResolvedValue([
        { id: 'sec-1', type: 'vulnerability', severity: 'high' }
      ]);
      mockKnowledgeGraph.findPatterns.mockResolvedValue([
        { name: 'Authentication', confidence: 0.95 }
      ]);

      mockKnowledgeRepo.generateRAGContext.mockResolvedValue({
        synthesizedKnowledge: 'Security audit should check for OWASP Top 10',
        confidence: 0.9,
        relevantDocuments: ['owasp-guide'],
        sources: ['security-source']
      });

      const context = await integrator.prepareRoleKnowledge(roleType, 'node-3', 'exec-1', 'security-audit', inputs);

      expect(context.roleType).toBe(roleType);
      expect(mockKnowledgeGraph.findSecurityRelationships).toHaveBeenCalledWith(inputs.codeFiles);
      expect(mockKnowledgeRepo.generateRAGContext).toHaveBeenCalledWith(
        expect.stringContaining('security audit'),
        roleType
      );
    });
  });

  describe('recordRoleOutcome', () => {
    it('should record successful role outcome with learning', async () => {
      // Setup
      const roleType = RoleType.IMPLEMENTATION_DEVELOPER;
      const nodeId = 'node-1';
      const executionId = 'exec-1';
      const inputs = { requirements: 'Implement user login' };
      const outputs = { 
        implementedFeatures: 3, 
        requiredFeatures: 3, 
        errors: [],
        testCoverage: 0.95 
      };
      const duration = 3600000; // 1 hour
      const success = true;

      // Prepare context first
      await integrator.prepareRoleKnowledge(roleType, nodeId, executionId, 'implement', inputs);

      // Execute
      await integrator.recordRoleOutcome(roleType, nodeId, executionId, inputs, outputs, duration, success);

      // Verify project KB was updated
      expect(mockProjectKB.recordAccomplishment).toHaveBeenCalledWith(
        expect.objectContaining({
          workItemId: executionId,
          type: 'task',
          title: 'IMPLEMENTATION_DEVELOPER execution'
        })
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Recorded outcome for IMPLEMENTATION_DEVELOPER')
      );
    });

    it('should handle failed role outcome', async () => {
      const roleType = RoleType.UNIT_TEST_EXECUTOR;
      const outputs = { 
        testResults: { passed: 5, failed: 3 }, 
        errors: ['Test timeout', 'Assertion failed'] 
      };
      const success = false;

      // Prepare context first
      await integrator.prepareRoleKnowledge(roleType, 'node-2', 'exec-1', 'execute-tests', {});

      await integrator.recordRoleOutcome(roleType, 'node-2', 'exec-1', {}, outputs, 1800000, success);

      // Should still record the outcome even for failures
      expect(mockProjectKB.recordAccomplishment).toHaveBeenCalled();
    });
  });

  describe('Role-specific knowledge extraction', () => {
    it('should extract relevant triads for different roles', async () => {
      const inputs = { codebase: 'src/', modules: ['auth', 'user'] };
      
      // Test Implementation Developer
      await integrator.prepareRoleKnowledge(
        RoleType.IMPLEMENTATION_DEVELOPER, 
        'node-impl', 
        'exec-1', 
        'implement', 
        inputs
      );

      expect(mockKnowledgeGraph.findRelationships).toHaveBeenCalledWith(
        'CLASS', 
        ['EXTENDS', 'IMPLEMENTS', 'USES']
      );
      expect(mockKnowledgeGraph.detectArchitecturalPatterns).toHaveBeenCalledWith(inputs.codebase);

      // Test Performance Auditor
      jest.clearAllMocks();
      await integrator.prepareRoleKnowledge(
        RoleType.PERFORMANCE_AUDITOR,
        'node-perf',
        'exec-1',
        'audit-performance',
        { architecture: 'microservices', metrics: ['cpu', 'memory'] }
      );

      expect(mockKnowledgeGraph.findPerformanceRelationships).toHaveBeenCalled();
      expect(mockKnowledgeGraph.findPatterns).toHaveBeenCalledWith(
        ['Caching', 'Lazy Loading', 'Connection Pool']
      );
    });
  });

  describe('Context window optimization', () => {
    it('should create appropriate context windows for different roles', async () => {
      const testCases = [
        { role: RoleType.ORCHESTRATOR, expectedMaxTokens: 8000, expectedCompression: 0 },
        { role: RoleType.IMPLEMENTATION_DEVELOPER, expectedMaxTokens: 7000, expectedCompression: 0 },
        { role: RoleType.PERFORMANCE_AUDITOR, expectedMaxTokens: 4000, expectedCompression: 2 }
      ];

      for (const testCase of testCases) {
        const context = await integrator.prepareRoleKnowledge(
          testCase.role, 
          `node-${testCase.role}`, 
          'exec-1', 
          'test-step', 
          {}
        );

        expect(context.contextWindow.maxTokens).toBe(testCase.expectedMaxTokens);
        expect(context.contextWindow.compressionLevel).toBe(testCase.expectedCompression);
      }
    });
  });

  describe('Learning and feedback mechanisms', () => {
    it('should generate appropriate learnings from successful outcomes', async () => {
      const roleType = RoleType.QUALITY_AUDITOR;
      
      // Setup successful context with patterns
      await integrator.prepareRoleKnowledge(roleType, 'node-1', 'exec-1', 'audit', {});
      
      const outputs = { 
        qualityScore: 0.92, 
        qualityIssues: ['Minor code smell'],
        decisions: [{
          description: 'Use automated refactoring',
          options: ['manual', 'automated'],
          chosen: 'automated',
          rationale: 'More consistent results',
          confidence: 0.9
        }]
      };

      await integrator.recordRoleOutcome(roleType, 'node-1', 'exec-1', {}, outputs, 1800000, true);

      // Should have recorded learnings
      const learnings = await integrator.getRoleLearnings(roleType);
      expect(learnings).toBeDefined();
      expect(Array.isArray(learnings)).toBe(true);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle missing knowledge graph responses gracefully', async () => {
      mockKnowledgeGraph.findRelationships.mockRejectedValue(new Error('Graph unavailable'));
      
      // Should not throw but should log error
      await expect(integrator.prepareRoleKnowledge(
        RoleType.TEST_DESIGNER, 
        'node-1', 
        'exec-1', 
        'design', 
        {}
      )).resolves.toBeDefined();
    });

    it('should handle invalid role types', async () => {
      const context = await integrator.prepareRoleKnowledge(
        'INVALID_ROLE' as RoleType,
        'node-1',
        'exec-1', 
        'step',
        {}
      );

      // Should return context with empty triads
      expect(context.knowledgePacket.triads.relevant).toEqual([]);
      expect(context.knowledgePacket.triads.patterns).toEqual([]);
    });

    it('should handle missing context during outcome recording', async () => {
      // Try to record outcome without preparing context first
      await integrator.recordRoleOutcome(
        RoleType.COMPILER_BUILDER,
        'missing-node',
        'exec-1',
        {},
        {},
        1000,
        true
      );

      // Should return early without throwing
      expect(mockProjectKB.recordAccomplishment).not.toHaveBeenCalled();
    });
  });

  describe('Public API methods', () => {
    it('should retrieve role context', async () => {
      const nodeId = 'node-1';
      await integrator.prepareRoleKnowledge(RoleType.TEST_DESIGNER, nodeId, 'exec-1', 'design', {});
      
      const context = await integrator.getRoleContext(nodeId);
      expect(context).toBeDefined();
      expect(context?.nodeId).toBe(nodeId);
    });

    it('should retrieve role outcomes by execution', async () => {
      const executionId = 'exec-1';
      
      // Record some outcomes
      await integrator.prepareRoleKnowledge(RoleType.TEST_DESIGNER, 'node-1', executionId, 'design', {});
      await integrator.recordRoleOutcome(RoleType.TEST_DESIGNER, 'node-1', executionId, {}, {}, 1000, true);

      const outcomes = await integrator.getRoleOutcomes(executionId);
      expect(outcomes).toBeDefined();
      expect(Array.isArray(outcomes)).toBe(true);
    });

    it('should generate execution summary', async () => {
      const executionId = 'exec-summary-test';
      
      // Create multiple role outcomes
      const roles = [RoleType.REQUIREMENT_ANALYST, RoleType.TEST_DESIGNER, RoleType.IMPLEMENTATION_DEVELOPER];
      
      for (const role of roles) {
        await integrator.prepareRoleKnowledge(role, `node-${role}`, executionId, 'step', {});
        await integrator.recordRoleOutcome(role, `node-${role}`, executionId, {}, {}, 1000, true);
      }

      const summary = await integrator.generateExecutionSummary(executionId);
      
      expect(summary).toBeDefined();
      expect(summary.totalRoles).toBe(roles.length);
      expect(summary.successRate).toBe(1.0);
      expect(summary.averageQuality).toBeGreaterThanOrEqual(0);
      expect(summary.businessValue).toBeGreaterThanOrEqual(0);
    });
  });
});