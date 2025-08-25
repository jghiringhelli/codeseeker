import { describe, it, expect, beforeEach } from '@jest/globals';
import { KnowledgeFlowMapper, RoleType } from '../../../src/orchestration/knowledge-flow-mapper';

describe('KnowledgeFlowMapper', () => {
  describe('getCompleteWorkflowKnowledgeFlow', () => {
    it('should return a complete workflow knowledge flow map', () => {
      const flowMap = KnowledgeFlowMapper.getCompleteWorkflowKnowledgeFlow();

      expect(flowMap).toBeInstanceOf(Map);
      expect(flowMap.size).toBeGreaterThan(0);

      // Verify all role types are mapped
      const expectedRoles = [
        RoleType.WORK_CLASSIFIER,
        RoleType.REQUIREMENT_ANALYST,
        RoleType.TEST_DESIGNER,
        RoleType.IMPLEMENTATION_DEVELOPER,
        RoleType.CODE_REVIEWER,
        RoleType.COMPILER_BUILDER,
        RoleType.SECURITY_AUDITOR,
        RoleType.PERFORMANCE_AUDITOR,
        RoleType.QUALITY_AUDITOR,
        RoleType.DEVOPS_ENGINEER,
        RoleType.DEPLOYER,
        RoleType.UNIT_TEST_EXECUTOR,
        RoleType.INTEGRATION_TEST_ENGINEER,
        RoleType.E2E_TEST_ENGINEER,
        RoleType.TECHNICAL_DOCUMENTER,
        RoleType.USER_DOCUMENTER,
        RoleType.RELEASE_MANAGER,
        RoleType.COMMITTER,
        RoleType.ORCHESTRATOR
      ];

      expectedRoles.forEach(role => {
        expect(flowMap.has(role)).toBe(true);
      });
    });

    it('should have consistent flow step structure', () => {
      const flowMap = KnowledgeFlowMapper.getCompleteWorkflowKnowledgeFlow();
      
      flowMap.forEach((step, roleType) => {
        // Verify required properties
        expect(step.stepId).toBeDefined();
        expect(typeof step.stepId).toBe('string');
        expect(step.stepId.length).toBeGreaterThan(0);

        expect(step.roleType).toBe(roleType);

        expect(step.stepName).toBeDefined();
        expect(typeof step.stepName).toBe('string');

        expect(Array.isArray(step.knowledgeInputs)).toBe(true);
        expect(Array.isArray(step.knowledgeProcessing)).toBe(true);
        expect(Array.isArray(step.knowledgeOutputs)).toBe(true);
        expect(Array.isArray(step.feedbackLoops)).toBe(true);
        expect(Array.isArray(step.qualityGates)).toBe(true);
      });
    });
  });

  describe('Individual role knowledge flows', () => {
    let flowMap: Map<RoleType, any>;

    beforeEach(() => {
      flowMap = KnowledgeFlowMapper.getCompleteWorkflowKnowledgeFlow();
    });

    describe('Work Classifier Flow', () => {
      it('should have proper work classifier configuration', () => {
        const flow = flowMap.get(RoleType.WORK_CLASSIFIER);

        expect(flow.stepId).toBe('work-classification');
        expect(flow.stepName).toBe('Work Item Classification and Prioritization');

        // Verify knowledge inputs
        const inputs = flow.knowledgeInputs;
        expect(inputs).toHaveLength(3);
        
        const historicalInput = inputs.find((i: any) => i.type === 'historical');
        expect(historicalInput).toBeDefined();
        expect(historicalInput.priority).toBe('high');
        expect(historicalInput.usage).toContain('Pattern matching');

        const projectInput = inputs.find((i: any) => i.type === 'project');
        expect(projectInput).toBeDefined();
        expect(projectInput.priority).toBe('critical');

        const domainInput = inputs.find((i: any) => i.type === 'domain');
        expect(domainInput).toBeDefined();
        expect(domainInput.priority).toBe('medium');

        // Verify processing steps
        expect(flow.knowledgeProcessing).toHaveLength(3);
        const patternRecognition = flow.knowledgeProcessing.find((p: any) => 
          p.process === 'Pattern Recognition'
        );
        expect(patternRecognition).toBeDefined();
        expect(patternRecognition.qualityCheck).toContain('Confidence > 0.8');

        // Verify quality gates
        expect(flow.qualityGates).toHaveLength(1);
        expect(flow.qualityGates[0].name).toBe('Classification Confidence');
        expect(flow.qualityGates[0].threshold).toBe(0.8);
        expect(flow.qualityGates[0].action).toBe('block');
      });
    });

    describe('Requirement Analyst Flow', () => {
      it('should have comprehensive requirement analysis configuration', () => {
        const flow = flowMap.get(RoleType.REQUIREMENT_ANALYST);

        expect(flow.stepId).toBe('requirement-analysis');
        expect(flow.stepName).toBe('Requirements Analysis and Specification');

        // Verify knowledge inputs include triads and RAG
        const inputs = flow.knowledgeInputs;
        expect(inputs.length).toBeGreaterThanOrEqual(4);

        const triadsInput = inputs.find((i: any) => i.type === 'triads');
        expect(triadsInput).toBeDefined();
        expect(triadsInput.priority).toBe('critical');
        expect(triadsInput.usage).toContain('architecture and dependencies');

        const ragInput = inputs.find((i: any) => i.type === 'rag');
        expect(ragInput).toBeDefined();
        expect(ragInput.priority).toBe('high');

        // Verify processing includes dependency analysis
        const processing = flow.knowledgeProcessing;
        expect(processing.length).toBe(3);
        
        const depAnalysis = processing.find((p: any) => 
          p.process === 'Dependency Analysis'
        );
        expect(depAnalysis).toBeDefined();
        expect(depAnalysis.knowledgeSources).toContain('Code triads');

        // Verify outputs benefit other roles
        const outputs = flow.knowledgeOutputs;
        const outcomeOutput = outputs.find((o: any) => o.type === 'outcome');
        expect(outcomeOutput.beneficiaries).toContain(RoleType.TEST_DESIGNER);
        expect(outcomeOutput.beneficiaries).toContain(RoleType.IMPLEMENTATION_DEVELOPER);

        // Verify feedback loops
        expect(flow.feedbackLoops).toHaveLength(2);
        const implFeedback = flow.feedbackLoops.find((f: any) => 
          f.from === 'Implementation feedback'
        );
        expect(implFeedback).toBeDefined();
        expect(implFeedback.updateFrequency).toBe('phase');
      });
    });

    describe('Test Designer Flow', () => {
      it('should have TDD-focused test design configuration', () => {
        const flow = flowMap.get(RoleType.TEST_DESIGNER);

        expect(flow.stepId).toBe('test-design');
        expect(flow.stepName).toBe('Test Suite Design and TDD Implementation');

        // Verify test-specific inputs
        const inputs = flow.knowledgeInputs;
        const triadsInput = inputs.find((i: any) => i.type === 'triads');
        expect(triadsInput.usage).toContain('test patterns');
        expect(triadsInput.examples).toContain('Test coverage relationships');

        const ragInput = inputs.find((i: any) => i.type === 'rag');
        expect(ragInput.usage).toContain('proven testing strategies');

        const peersInput = inputs.find((i: any) => i.type === 'peers');
        expect(peersInput.source).toContain('Requirements specification');

        // Verify TDD-specific processing
        const processing = flow.knowledgeProcessing;
        expect(processing.length).toBe(3);

        const testGeneration = processing.find((p: any) => 
          p.process === 'Test Case Generation'
        );
        expect(testGeneration).toBeDefined();
        expect(testGeneration.description).toContain('TDD principles');

        // Verify quality gates for test coverage
        const qualityGates = flow.qualityGates;
        expect(qualityGates).toHaveLength(2);
        
        const coverageGate = qualityGates.find((g: any) => 
          g.name === 'Test Coverage Threshold'
        );
        expect(coverageGate).toBeDefined();
        expect(coverageGate.threshold).toBe(0.9);
        expect(coverageGate.action).toBe('block');
      });
    });

    describe('Implementation Developer Flow', () => {
      it('should have architecture-aligned implementation configuration', () => {
        const flow = flowMap.get(RoleType.IMPLEMENTATION_DEVELOPER);

        expect(flow.stepId).toBe('implementation');
        expect(flow.stepName).toBe('Feature Implementation Following TDD');

        // Verify architecture-focused inputs
        const inputs = flow.knowledgeInputs;
        const triadsInput = inputs.find((i: any) => i.type === 'triads');
        expect(triadsInput.usage).toContain('architectural consistency');
        expect(triadsInput.examples).toContain('Design patterns in use');

        // Verify TDD implementation process
        const processing = flow.knowledgeProcessing;
        const tddCycle = processing.find((p: any) => 
          p.process === 'TDD Implementation Cycle'
        );
        expect(tddCycle).toBeDefined();
        expect(tddCycle.description).toContain('red-green-refactor');

        // Verify quality gates
        const qualityGates = flow.qualityGates;
        expect(qualityGates).toHaveLength(3);
        
        const testGate = qualityGates.find((g: any) => 
          g.name === 'Test Success Rate'
        );
        expect(testGate.threshold).toBe(1.0); // 100% test success

        const archGate = qualityGates.find((g: any) => 
          g.name === 'Architecture Compliance'
        );
        expect(archGate.threshold).toBe(0.9);
        expect(archGate.action).toBe('block');
      });
    });

    describe('Security Auditor Flow', () => {
      it('should have comprehensive security assessment configuration', () => {
        const flow = flowMap.get(RoleType.SECURITY_AUDITOR);

        expect(flow.stepId).toBe('security-audit');
        expect(flow.stepName).toBe('Comprehensive Security Assessment');

        // Verify security-focused inputs
        const inputs = flow.knowledgeInputs;
        expect(inputs).toHaveLength(4);

        const triadsInput = inputs.find((i: any) => i.type === 'triads');
        expect(triadsInput.usage).toContain('attack vectors');
        expect(triadsInput.examples).toContain('Authentication flows');

        const ragInput = inputs.find((i: any) => i.type === 'rag');
        expect(ragInput.priority).toBe('critical');
        expect(ragInput.examples).toContain('OWASP Top 10');

        const domainInput = inputs.find((i: any) => i.type === 'domain');
        expect(domainInput.examples).toContain('PCI DSS');
        expect(domainInput.examples).toContain('GDPR');

        // Verify security processing steps
        const processing = flow.knowledgeProcessing;
        expect(processing).toHaveLength(3);

        const threatModeling = processing.find((p: any) => 
          p.process === 'Threat Modeling'
        );
        expect(threatModeling).toBeDefined();
        expect(threatModeling.qualityCheck).toContain('critical attack vectors');

        // Verify strict security quality gates
        const qualityGates = flow.qualityGates;
        expect(qualityGates).toHaveLength(2);

        const vulnGate = qualityGates.find((g: any) => 
          g.name === 'Critical Vulnerability Count'
        );
        expect(vulnGate.threshold).toBe(0); // Zero critical vulnerabilities
        expect(vulnGate.action).toBe('block');

        const securityGate = qualityGates.find((g: any) => 
          g.name === 'Security Score Threshold'
        );
        expect(securityGate.threshold).toBe(0.9);
      });
    });

    describe('Orchestrator Flow', () => {
      it('should have strategic orchestration configuration', () => {
        const flow = flowMap.get(RoleType.ORCHESTRATOR);

        expect(flow.stepId).toBe('orchestration');
        expect(flow.stepName).toBe('Workflow Orchestration and Strategic Decision Making');

        // Verify comprehensive inputs
        const inputs = flow.knowledgeInputs;
        expect(inputs).toHaveLength(4);

        const projectInput = inputs.find((i: any) => i.type === 'project');
        expect(projectInput.priority).toBe('critical');
        expect(projectInput.usage).toContain('workflow direction');

        const peersInput = inputs.find((i: any) => i.type === 'peers');
        expect(peersInput.priority).toBe('critical');
        expect(peersInput.source).toContain('All role outcomes');

        // Verify strategic processing
        const processing = flow.knowledgeProcessing;
        expect(processing).toHaveLength(3);

        const strategicDecision = processing.find((p: any) => 
          p.process === 'Strategic Decision Making'
        );
        expect(strategicDecision).toBeDefined();
        expect(strategicDecision.qualityCheck).toContain('project objectives');

        // Verify strategic quality gates
        const qualityGates = flow.qualityGates;
        expect(qualityGates).toHaveLength(2);

        const decisionGate = qualityGates.find((g: any) => 
          g.name === 'Decision Confidence'
        );
        expect(decisionGate.threshold).toBe(0.8);
        expect(decisionGate.action).toBe('warn');
      });
    });
  });

  describe('Knowledge flow coherence', () => {
    it('should have consistent input/output types across roles', () => {
      const flowMap = KnowledgeFlowMapper.getCompleteWorkflowKnowledgeFlow();
      const allInputTypes = new Set<string>();
      const allOutputTypes = new Set<string>();

      flowMap.forEach(step => {
        step.knowledgeInputs.forEach((input: any) => allInputTypes.add(input.type));
        step.knowledgeOutputs.forEach((output: any) => allOutputTypes.add(output.type));
      });

      // Verify standard knowledge types are used
      expect(allInputTypes.has('triads')).toBe(true);
      expect(allInputTypes.has('rag')).toBe(true);
      expect(allInputTypes.has('historical')).toBe(true);
      expect(allInputTypes.has('project')).toBe(true);
      expect(allInputTypes.has('peers')).toBe(true);
      expect(allInputTypes.has('domain')).toBe(true);

      expect(allOutputTypes.has('outcome')).toBe(true);
      expect(allOutputTypes.has('insight')).toBe(true);
      expect(allOutputTypes.has('metric')).toBe(true);
      expect(allOutputTypes.has('learning')).toBe(true);
    });

    it('should have proper beneficiary relationships', () => {
      const flowMap = KnowledgeFlowMapper.getCompleteWorkflowKnowledgeFlow();
      
      // Requirement Analyst should benefit Test Designer and Implementation Developer
      const reqAnalyst = flowMap.get(RoleType.REQUIREMENT_ANALYST)!;
      const reqOutcome = reqAnalyst.knowledgeOutputs.find((o: any) => o.type === 'outcome');
      expect(reqOutcome!.beneficiaries).toContain(RoleType.TEST_DESIGNER);
      expect(reqOutcome!.beneficiaries).toContain(RoleType.IMPLEMENTATION_DEVELOPER);

      // Test Designer should benefit Unit Test Executor
      const testDesigner = flowMap.get(RoleType.TEST_DESIGNER)!;
      const testOutcome = testDesigner.knowledgeOutputs.find((o: any) => o.type === 'outcome');
      expect(testOutcome!.beneficiaries).toContain(RoleType.UNIT_TEST_EXECUTOR);

      // Implementation Developer should benefit auditors
      const implDev = flowMap.get(RoleType.IMPLEMENTATION_DEVELOPER)!;
      const implOutcome = implDev.knowledgeOutputs.find((o: any) => o.type === 'outcome');
      expect(implOutcome!.beneficiaries).toContain(RoleType.SECURITY_AUDITOR);
      expect(implOutcome!.beneficiaries).toContain(RoleType.PERFORMANCE_AUDITOR);
    });

    it('should have appropriate feedback loop frequencies', () => {
      const flowMap = KnowledgeFlowMapper.getCompleteWorkflowKnowledgeFlow();
      
      flowMap.forEach((step, roleType) => {
        step.feedbackLoops.forEach((loop: any) => {
          expect(['realtime', 'step', 'phase', 'milestone']).toContain(loop.updateFrequency);
        });
      });
    });
  });

  describe('Flow analysis utilities', () => {
    it('should analyze knowledge flow correctly', () => {
      const flowMap = KnowledgeFlowMapper.getCompleteWorkflowKnowledgeFlow();
      const analysis = KnowledgeFlowMapper.analyzeKnowledgeFlow(flowMap);

      expect(analysis).toBeDefined();
      expect(analysis.totalRoles).toBe(flowMap.size);
      expect(analysis.totalRoles).toBeGreaterThan(15);

      expect(analysis.knowledgeInputTypes).toBeInstanceOf(Set);
      expect(analysis.knowledgeInputTypes.has('triads')).toBe(true);
      expect(analysis.knowledgeInputTypes.has('rag')).toBe(true);

      expect(analysis.outputTypes).toBeInstanceOf(Set);
      expect(analysis.outputTypes.has('outcome')).toBe(true);
      expect(analysis.outputTypes.has('learning')).toBe(true);

      expect(typeof analysis.feedbackLoops).toBe('number');
      expect(analysis.feedbackLoops).toBeGreaterThan(0);

      expect(typeof analysis.qualityGates).toBe('number');
      expect(analysis.qualityGates).toBeGreaterThan(0);
    });

    it('should generate flow diagram', () => {
      const flowMap = KnowledgeFlowMapper.getCompleteWorkflowKnowledgeFlow();
      const diagram = KnowledgeFlowMapper.generateFlowDiagram(flowMap);

      expect(typeof diagram).toBe('string');
      expect(diagram.length).toBeGreaterThan(0);
      expect(diagram).toContain('Knowledge Flow Diagram:');
      expect(diagram).toContain('REQUIREMENT_ANALYST:');
      expect(diagram).toContain('Inputs:');
      expect(diagram).toContain('Outputs:');
      expect(diagram).toContain('Quality Gates:');
    });
  });

  describe('Edge cases and validation', () => {
    it('should handle empty flow map in analysis', () => {
      const emptyMap = new Map();
      const analysis = KnowledgeFlowMapper.analyzeKnowledgeFlow(emptyMap);

      expect(analysis.totalRoles).toBe(0);
      expect(analysis.knowledgeInputTypes.size).toBe(0);
      expect(analysis.feedbackLoops).toBe(0);
      expect(analysis.qualityGates).toBe(0);
    });

    it('should validate quality gate thresholds are reasonable', () => {
      const flowMap = KnowledgeFlowMapper.getCompleteWorkflowKnowledgeFlow();
      
      flowMap.forEach((step, roleType) => {
        step.qualityGates.forEach((gate: any) => {
          expect(typeof gate.threshold).toBe('number');
          expect(gate.threshold).toBeGreaterThanOrEqual(0);
          expect(gate.threshold).toBeLessThanOrEqual(1);
          expect(['warn', 'block', 'enhance']).toContain(gate.action);
        });
      });
    });

    it('should validate knowledge input priorities are valid', () => {
      const flowMap = KnowledgeFlowMapper.getCompleteWorkflowKnowledgeFlow();
      const validPriorities = ['critical', 'high', 'medium', 'low'];
      
      flowMap.forEach((step, roleType) => {
        step.knowledgeInputs.forEach((input: any) => {
          expect(validPriorities).toContain(input.priority);
          expect(input.usage).toBeDefined();
          expect(input.usage.length).toBeGreaterThan(0);
          expect(Array.isArray(input.examples)).toBe(true);
        });
      });
    });

    it('should validate persistence levels are consistent', () => {
      const flowMap = KnowledgeFlowMapper.getCompleteWorkflowKnowledgeFlow();
      const validLevels = ['temporary', 'execution', 'project', 'permanent'];
      
      flowMap.forEach((step, roleType) => {
        step.knowledgeOutputs.forEach((output: any) => {
          expect(validLevels).toContain(output.persistenceLevel);
          expect(Array.isArray(output.beneficiaries)).toBe(true);
        });
      });
    });
  });
});