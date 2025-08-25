import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { 
  DynamicKnowledgeGenerator, 
  RoleType, 
  Action, 
  Warning, 
  Pattern,
  QualityCheck
} from '../../../src/orchestration/dynamic-knowledge-generator';
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
  findSimilarNodes: jest.fn()
};

const mockKnowledgeRepo = {
  generateRAGContext: jest.fn(),
  searchKnowledge: jest.fn()
};

const mockProjectKB = {
  getStrategicContext: jest.fn()
};

describe('DynamicKnowledgeGenerator', () => {
  let generator: DynamicKnowledgeGenerator;
  
  const mockBaseContext = {
    roleType: RoleType.REQUIREMENT_ANALYST,
    nodeId: 'node-1',
    executionId: 'exec-1',
    step: 'analyze-requirements',
    inputs: { featureId: 'feature-1' },
    knowledgePacket: {
      triads: {
        relevant: [
          { id: '1', subject: 'User', predicate: 'HAS_DEPENDENCY', object: 'AuthService' }
        ],
        patterns: [
          { name: 'Repository', confidence: 0.9 }
        ],
        dependencies: [],
        similarities: []
      },
      ragContext: {
        query: 'test query',
        synthesizedKnowledge: 'Requirements should be specific and testable. Use acceptance criteria to define success. Consider edge cases and error scenarios.',
        confidence: 0.9,
        relevantDocuments: ['req-guide-1', 'req-guide-2'],
        sources: ['source1', 'source2']
      },
      historical: {
        previousOutcomes: [],
        learnings: [
          { 
            category: 'technical',
            lesson: 'Clear requirements reduce implementation time',
            confidence: 0.9,
            validation: 'empirical'
          }
        ],
        bestPractices: [
          'Use Given-When-Then format',
          'Include non-functional requirements'
        ],
        antiPatterns: [
          'Vague acceptance criteria'
        ]
      },
      project: {
        currentPhase: { name: 'Development', progress: 0.3 },
        objectives: ['Improve user experience'],
        constraints: [{ type: 'timeline', description: 'Q3 deadline' }],
        qualityGates: [],
        riskFactors: []
      },
      peers: {
        completedRoles: [],
        dependentRoles: ['TEST_DESIGNER'],
        parallelRoles: [],
        nextRoles: ['TEST_DESIGNER']
      },
      domain: {
        expertAdvice: ['Follow domain-driven design principles'],
        researchFindings: ['Modern requirements engineering practices'],
        industryStandards: ['IEEE 830 standard'],
        emergingTrends: ['Behavior-driven development']
      },
      classTraversal: {
        quickFinds: [],
        classInsights: [],
        conceptMappings: [],
        hierarchyPaths: [],
        focusArea: 'BUSINESS_LOGIC' as any,
        relevantClasses: [],
        architecturalPatterns: [],
        codeUnderstanding: {
          mainConcepts: [],
          keyRelationships: [],
          businessRelevantClasses: [],
          technicalHotspots: []
        }
      }
    },
    contextWindow: {
      maxTokens: 6000,
      compressionLevel: 1,
      essentialInfo: {},
      referenceLinks: [],
      confidence: 0.85
    },
    feedbackLoop: {
      inputMetrics: {},
      processMetrics: {},
      outputMetrics: {},
      qualityScores: {},
      improvementSuggestions: [],
      nextIterationHints: []
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new DynamicKnowledgeGenerator(
      mockLogger,
      mockKnowledgeGraph as any,
      mockKnowledgeRepo as any,
      mockProjectKB as any
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateDynamicContext', () => {
    const mockBaseContext_unused = {
      // Moved to class scope
    };

    it('should generate dynamic context for requirement analyst', async () => {
      const constraints = {
        maxTokens: 5000,
        minConfidence: 0.8,
        timeConstraint: 'normal' as const,
        compressionLevel: 1 as const
      };

      const context = await generator.generateDynamicContext(
        RoleType.REQUIREMENT_ANALYST,
        'analyze-requirements',
        mockBaseContext,
        constraints
      );

      expect(context).toBeDefined();
      expect(context.roleType).toBe(RoleType.REQUIREMENT_ANALYST);
      expect(context.step).toBe('analyze-requirements');
      expect(context.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(context.confidenceScore).toBeLessThanOrEqual(1);
      expect(context.compressionRatio).toBeGreaterThan(0);
      expect(context.tokenUsage).toBeGreaterThan(0);

      // Verify adapted content structure
      expect(context.adaptedContent).toBeDefined();
      expect(context.adaptedContent.essentials).toBeDefined();
      expect(context.adaptedContent.contextual).toBeDefined();
      expect(context.adaptedContent.actionable).toBeDefined();
      expect(context.adaptedContent.learning).toBeDefined();

      // Verify reasoning is provided
      expect(Array.isArray(context.reasoning)).toBe(true);
      expect(context.reasoning.length).toBeGreaterThan(0);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Generating dynamic context for REQUIREMENT_ANALYST in step: analyze-requirements'
      );
    });

    it('should generate context for test designer with different specialization', async () => {
      const testDesignerContext = {
        ...mockBaseContext,
        roleType: RoleType.TEST_DESIGNER,
        step: 'design-tests'
      };

      const constraints = {
        maxTokens: 4000,
        focusArea: 'testing'
      };

      const context = await generator.generateDynamicContext(
        RoleType.TEST_DESIGNER,
        'design-tests',
        testDesignerContext,
        constraints
      );

      expect(context.roleType).toBe(RoleType.TEST_DESIGNER);
      expect(context.step).toBe('design-tests');
      
      // Test designer should have different essential info focus
      expect(context.adaptedContent.essentials).toBeDefined();
      expect(context.tokenUsage).toBeLessThanOrEqual(4000 * 1.1); // Allow small buffer
    });

    it('should handle security auditor with security-specific content', async () => {
      const securityContext = {
        ...mockBaseContext,
        roleType: RoleType.SECURITY_AUDITOR,
        step: 'security-audit',
        knowledgePacket: {
          ...mockBaseContext.knowledgePacket,
          triads: {
            ...mockBaseContext.knowledgePacket.triads,
            patterns: [
              { name: 'Authentication', confidence: 0.95 },
              { name: 'Authorization', confidence: 0.88 }
            ]
          }
        }
      };

      const context = await generator.generateDynamicContext(
        RoleType.SECURITY_AUDITOR,
        'security-audit',
        securityContext,
        { maxTokens: 5000 }
      );

      expect(context.roleType).toBe(RoleType.SECURITY_AUDITOR);
      
      // Should have security-specific actionable items
      const actions = context.adaptedContent.actionable.recommendedActions;
      expect(actions).toBeDefined();
      expect(actions.length).toBeGreaterThan(0);
      
      const securityAction = actions.find(action => 
        action.description.toLowerCase().includes('security') ||
        action.description.toLowerCase().includes('validation')
      );
      expect(securityAction).toBeDefined();
      expect(securityAction?.priority).toBe('immediate');
    });

    it('should use cache for repeated requests', async () => {
      const constraints = { maxTokens: 5000 };
      
      // First call
      const context1 = await generator.generateDynamicContext(
        RoleType.IMPLEMENTATION_DEVELOPER,
        'implement-feature',
        mockBaseContext,
        constraints
      );

      // Second call with same parameters
      const context2 = await generator.generateDynamicContext(
        RoleType.IMPLEMENTATION_DEVELOPER,
        'implement-feature',
        mockBaseContext,
        constraints
      );

      expect(context1).toBe(context2); // Should return cached instance
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Using cached dynamic context')
      );
    });
  });

  describe('Content adaptation', () => {
    const baseKnowledgePacket = {
      triads: {
        relevant: [
          { id: '1', predicate: 'EXTENDS', confidence: 0.9 },
          { id: '2', predicate: 'IMPLEMENTS', confidence: 0.8 },
          { id: '3', predicate: 'USES', confidence: 0.7 }
        ],
        patterns: [
          { name: 'Factory', confidence: 0.9 },
          { name: 'Repository', confidence: 0.85 },
          { name: 'Observer', confidence: 0.75 }
        ],
        dependencies: [],
        similarities: []
      },
      ragContext: {
        synthesizedKnowledge: 'Implementation best practices include following SOLID principles, writing clean code, and ensuring proper error handling.',
        confidence: 0.9,
        sources: []
      },
      historical: {
        bestPractices: [
          'Use dependency injection',
          'Follow single responsibility principle',
          'Write comprehensive tests',
          'Document complex logic',
          'Handle errors gracefully'
        ],
        antiPatterns: [
          'God objects',
          'Tight coupling',
          'Missing error handling'
        ],
        previousOutcomes: [],
        learnings: []
      },
      project: {
        currentPhase: { name: 'Implementation' },
        objectives: [],
        constraints: [{ type: 'timeline', description: 'Tight deadline' }],
        qualityGates: [],
        riskFactors: []
      },
      peers: { completedRoles: [], dependentRoles: [], parallelRoles: [], nextRoles: [] },
      domain: {
        expertAdvice: ['Follow design patterns'],
        researchFindings: [],
        industryStandards: [],
        emergingTrends: []
      }
    };

    it('should extract role-specific essentials for implementation developer', async () => {
      const context = await generator.generateDynamicContext(
        RoleType.IMPLEMENTATION_DEVELOPER,
        'implement',
        { ...mockBaseContext, knowledgePacket: baseKnowledgePacket },
        { maxTriads: 2, maxPatterns: 2, maxInsights: 3 }
      );

      const essentials = context.adaptedContent.essentials;
      
      // Should filter triads to implementation-relevant ones
      expect(essentials.triads.length).toBeLessThanOrEqual(2);
      
      // Should include architectural patterns
      expect(essentials.patterns.length).toBeLessThanOrEqual(2);
      expect(essentials.patterns.some((p: any) => ['Factory', 'Repository'].includes(p.name))).toBe(true);

      // Should extract insights from RAG context
      expect(essentials.insights.length).toBeGreaterThan(0);
      expect(essentials.insights.some((insight: string) => 
        insight.includes('SOLID') || insight.includes('error handling')
      )).toBe(true);
    });

    it('should generate contextual information appropriately', async () => {
      const context = await generator.generateDynamicContext(
        RoleType.QUALITY_AUDITOR,
        'audit-quality',
        { ...mockBaseContext, knowledgePacket: baseKnowledgePacket },
        { maxLessons: 3, maxRisks: 2 }
      );

      const contextual = context.adaptedContent.contextual;
      
      expect(contextual.projectStatus).toBeDefined();
      expect(contextual.projectStatus.phase).toBeDefined();
      
      expect(contextual.historicalLessons.length).toBeLessThanOrEqual(3);
      expect(contextual.historicalLessons.every((lesson: string) => lesson.length > 10)).toBe(true);
    });

    it('should create actionable recommendations', async () => {
      const context = await generator.generateDynamicContext(
        RoleType.IMPLEMENTATION_DEVELOPER,
        'implement',
        { ...mockBaseContext, knowledgePacket: baseKnowledgePacket },
        {}
      );

      const actionable = context.adaptedContent.actionable;
      
      expect(actionable.recommendedActions).toBeDefined();
      expect(actionable.recommendedActions.length).toBeGreaterThan(0);
      
      const action = actionable.recommendedActions[0] as Action;
      expect(action.description).toBeDefined();
      expect(['immediate', 'high', 'medium', 'low']).toContain(action.priority);
      expect(['minimal', 'moderate', 'significant', 'major']).toContain(action.effort);
      expect(action.confidence).toBeGreaterThanOrEqual(0);
      expect(action.confidence).toBeLessThanOrEqual(1);
      expect(Array.isArray(action.dependencies)).toBe(true);
      expect(action.expectedOutcome).toBeDefined();

      expect(actionable.warningSignals).toBeDefined();
      expect(actionable.successPatterns).toBeDefined();
      expect(actionable.qualityChecks).toBeDefined();
    });

    it('should identify warning signals from historical data', async () => {
      const contextWithRisks = {
        ...mockBaseContext,
        knowledgePacket: {
          ...baseKnowledgePacket,
          historical: {
            ...baseKnowledgePacket.historical,
            antiPatterns: ['Tight coupling detected', 'Missing error handling']
          },
          project: {
            ...baseKnowledgePacket.project,
            constraints: [{ type: 'timeline', description: 'Very tight deadline' }]
          }
        }
      };

      const context = await generator.generateDynamicContext(
        RoleType.IMPLEMENTATION_DEVELOPER,
        'implement',
        contextWithRisks,
        {}
      );

      const warnings = context.adaptedContent.actionable.warningSignals;
      expect(warnings.length).toBeGreaterThan(0);

      const warning = warnings[0] as Warning;
      expect(['risk', 'quality', 'timeline', 'resource']).toContain(warning.type);
      expect(['critical', 'high', 'medium', 'low']).toContain(warning.severity);
      expect(Array.isArray(warning.indicators)).toBe(true);
      expect(Array.isArray(warning.mitigationActions)).toBe(true);
    });

    it('should generate role-specific quality checks', async () => {
      const testCases = [
        { role: RoleType.IMPLEMENTATION_DEVELOPER, expectedCheck: 'Code Quality Check' },
        { role: RoleType.SECURITY_AUDITOR, expectedCheck: 'Security Vulnerability Check' },
        { role: RoleType.TEST_DESIGNER, expectedCheck: 'General Quality Check' }
      ];

      for (const testCase of testCases) {
        const context = await generator.generateDynamicContext(
          testCase.role,
          'test-step',
          mockBaseContext,
          {}
        );

        const qualityChecks = context.adaptedContent.actionable.qualityChecks;
        expect(qualityChecks.length).toBeGreaterThan(0);

        const check = qualityChecks.find((c: QualityCheck) => 
          c.name === testCase.expectedCheck
        ) || qualityChecks[0];

        expect(check.name).toBeDefined();
        expect(check.description).toBeDefined();
        expect(Array.isArray(check.criteria)).toBe(true);
        expect(typeof check.automatable).toBe('boolean');
        expect(['continuous', 'step', 'milestone']).toContain(check.frequency);
      }
    });
  });

  describe('Compression and optimization', () => {
    it('should respect token limits through compression', async () => {
      const largeContext = {
        ...mockBaseContext,
        knowledgePacket: {
          ...mockBaseContext.knowledgePacket,
          ragContext: {
            synthesizedKnowledge: 'Very long knowledge content '.repeat(200),
            confidence: 0.9,
            sources: []
          },
          historical: {
            bestPractices: Array(50).fill('Practice').map((p, i) => `${p} ${i}`),
            antiPatterns: Array(30).fill('AntiPattern').map((p, i) => `${p} ${i}`),
            previousOutcomes: [],
            learnings: []
          }
        }
      };

      const context = await generator.generateDynamicContext(
        RoleType.PERFORMANCE_AUDITOR,
        'audit',
        largeContext,
        { maxTokens: 2000, compressionLevel: 2 }
      );

      expect(context.tokenUsage).toBeLessThanOrEqual(2000 * 1.1); // Small buffer
      expect(context.compressionRatio).toBeLessThan(1); // Should be compressed
      expect(context.reasoning).toContain(
        expect.stringContaining('Compressed content to fit 2000 token limit')
      );
    });

    it('should calculate confidence based on knowledge completeness', async () => {
      const highQualityContext = {
        ...mockBaseContext,
        knowledgePacket: {
          ...mockBaseContext.knowledgePacket,
          triads: {
            relevant: Array(15).fill(null).map((_, i) => ({ id: `triad-${i}` })),
            patterns: Array(8).fill(null).map((_, i) => ({ name: `Pattern-${i}` })),
            dependencies: [],
            similarities: []
          },
          ragContext: { ...mockBaseContext.knowledgePacket.ragContext, confidence: 0.95 },
          historical: {
            ...mockBaseContext.knowledgePacket.historical,
            previousOutcomes: Array(6).fill(null).map((_, i) => ({ id: `outcome-${i}` }))
          }
        }
      };

      const context = await generator.generateDynamicContext(
        RoleType.REQUIREMENT_ANALYST,
        'analyze',
        highQualityContext,
        {}
      );

      expect(context.confidenceScore).toBeGreaterThan(0.8);

      // Test with lower quality context
      const lowQualityContext = {
        ...mockBaseContext,
        knowledgePacket: {
          ...mockBaseContext.knowledgePacket,
          triads: { relevant: [], patterns: [], dependencies: [], similarities: [] },
          ragContext: { ...mockBaseContext.knowledgePacket.ragContext, confidence: 0.5 }
        }
      };

      const lowContext = await generator.generateDynamicContext(
        RoleType.REQUIREMENT_ANALYST,
        'analyze',
        lowQualityContext,
        {}
      );

      expect(lowContext.confidenceScore).toBeLessThan(context.confidenceScore);
    });
  });

  describe('Regeneration triggers', () => {
    it('should define appropriate regeneration triggers', async () => {
      const context = await generator.generateDynamicContext(
        RoleType.TEST_DESIGNER,
        'design',
        mockBaseContext,
        { maxTokens: 4000 }
      );

      expect(context.regenerationTriggers.length).toBeGreaterThan(0);
      
      const tokenTrigger = context.regenerationTriggers.find(t => 
        t.condition === 'token_limit_approaching'
      );
      expect(tokenTrigger).toBeDefined();
      expect(tokenTrigger?.threshold).toBe(4000 * 0.9);
      expect(tokenTrigger?.action).toBe('compress');

      const confidenceTrigger = context.regenerationTriggers.find(t => 
        t.condition === 'confidence_too_low'
      );
      expect(confidenceTrigger).toBeDefined();
      expect(confidenceTrigger?.threshold).toBe(0.7);
      expect(confidenceTrigger?.action).toBe('refresh');

      const staleTrigger = context.regenerationTriggers.find(t => 
        t.condition === 'context_stale'
      );
      expect(staleTrigger).toBeDefined();
      expect(staleTrigger?.action).toBe('refresh');
    });

    it('should provide clear adaptation reasoning', async () => {
      const context = await generator.generateDynamicContext(
        RoleType.SECURITY_AUDITOR,
        'audit',
        mockBaseContext,
        { maxTokens: 3000, compressionLevel: 1 }
      );

      expect(context.reasoning.length).toBeGreaterThan(0);
      expect(context.reasoning).toContain(
        expect.stringContaining('Adapted context for SECURITY_AUDITOR')
      );
      expect(context.reasoning).toContain(
        expect.stringContaining('Selected')
      );
      expect(context.reasoning).toContain(
        expect.stringContaining('Compressed content to fit 3000 token limit')
      );
    });
  });

  describe('Public API', () => {
    it('should provide context statistics', async () => {
      // Generate some contexts first
      await generator.generateDynamicContext(
        RoleType.REQUIREMENT_ANALYST,
        'analyze',
        mockBaseContext,
        {}
      );

      const stats = await generator.getContextStatistics();
      
      expect(stats).toBeDefined();
      expect(typeof stats.totalCachedContexts).toBe('number');
      expect(stats.totalCachedContexts).toBeGreaterThanOrEqual(1);
      expect(typeof stats.roleSpecializations).toBe('number');
      expect(stats.roleSpecializations).toBeGreaterThan(0);
      expect(typeof stats.adaptationRules).toBe('number');
      expect(stats.adaptationRules).toBeGreaterThanOrEqual(0);
    });

    it('should allow cache refresh', async () => {
      const cacheKey = 'REQUIREMENT_ANALYST-analyze-{}';
      
      // Generate context to populate cache
      await generator.generateDynamicContext(
        RoleType.REQUIREMENT_ANALYST,
        'analyze',
        mockBaseContext,
        {}
      );

      // Refresh cache
      await generator.refreshContext(cacheKey);
      
      // This should work without errors
      expect(true).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle missing role specializations gracefully', async () => {
      // Use a role that might not have full specialization
      const context = await generator.generateDynamicContext(
        'UNKNOWN_ROLE' as RoleType,
        'unknown-step',
        mockBaseContext,
        {}
      );

      expect(context).toBeDefined();
      expect(context.adaptedContent).toBeDefined();
      expect(context.confidenceScore).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty knowledge packets', async () => {
      const emptyContext = {
        ...mockBaseContext,
        knowledgePacket: {
          triads: { relevant: [], patterns: [], dependencies: [], similarities: [] },
          ragContext: { synthesizedKnowledge: '', confidence: 0, sources: [] },
          historical: { bestPractices: [], antiPatterns: [], previousOutcomes: [], learnings: [] },
          project: { currentPhase: null, objectives: [], constraints: [], qualityGates: [], riskFactors: [] },
          peers: { completedRoles: [], dependentRoles: [], parallelRoles: [], nextRoles: [] },
          domain: { expertAdvice: [], researchFindings: [], industryStandards: [], emergingTrends: [] }
        }
      };

      const context = await generator.generateDynamicContext(
        RoleType.IMPLEMENTATION_DEVELOPER,
        'implement',
        emptyContext,
        {}
      );

      expect(context).toBeDefined();
      expect(context.adaptedContent.essentials.triads).toEqual([]);
      expect(context.adaptedContent.essentials.patterns).toEqual([]);
    });

    it('should handle extreme compression requirements', async () => {
      const context = await generator.generateDynamicContext(
        RoleType.PERFORMANCE_AUDITOR,
        'audit',
        mockBaseContext,
        { maxTokens: 100, compressionLevel: 3 }
      );

      expect(context.tokenUsage).toBeLessThanOrEqual(150); // Very compressed
      expect(context.compressionRatio).toBeLessThan(0.1);
      expect(context.adaptedContent).toBeDefined();
    });
  });
});