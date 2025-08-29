import { describe, it, expect, beforeEach } from '@jest/globals';
import { WorkflowDefinitions, WorkflowTemplate } from '../../../src/orchestration/workflow-definitions';

describe('WorkflowDefinitions', () => {
  let workflowDefs: WorkflowDefinitions;

  beforeEach(() => {
    workflowDefs = new WorkflowDefinitions();
  });

  describe('getWorkflowTemplate', () => {
    it('should return development workflow template', () => {
      const template = workflowDefs.getWorkflowTemplate('development');

      expect(template).toBeDefined();
      expect(template.id).toBe('development');
      expect(template.name).toContain('Development');
      expect(template.roles).toContain('architect');
      expect(template.roles).toContain('security');
      expect(template.roles).toContain('quality');
      expect(template.roles).toContain('performance');
      expect(template.roles).toContain('coordinator');
    });

    it('should return security audit workflow template', () => {
      const template = workflowDefs.getWorkflowTemplate('security-audit');

      expect(template).toBeDefined();
      expect(template.id).toBe('security-audit');
      expect(template.roles).toContain('security');
      expect(template.roles).toContain('architect');
      expect(template.priority).toBe('high');
    });

    it('should return performance optimization workflow template', () => {
      const template = workflowDefs.getWorkflowTemplate('performance-optimization');

      expect(template).toBeDefined();
      expect(template.id).toBe('performance-optimization');
      expect(template.roles).toContain('performance');
      expect(template.roles).toContain('architect');
    });

    it('should return quality assurance workflow template', () => {
      const template = workflowDefs.getWorkflowTemplate('quality-assurance');

      expect(template).toBeDefined();
      expect(template.id).toBe('quality-assurance');
      expect(template.roles).toContain('quality');
      expect(template.roles).toContain('architect');
    });

    it('should throw error for unknown workflow template', () => {
      expect(() => {
        workflowDefs.getWorkflowTemplate('unknown-workflow');
      }).toThrow('Unknown workflow template: unknown-workflow');
    });
  });

  describe('getAllWorkflowTemplates', () => {
    it('should return all available workflow templates', () => {
      const templates = workflowDefs.getAllWorkflowTemplates();

      expect(templates).toHaveLength(greaterThan(0));
      expect(templates.some(t => t.id === 'development')).toBe(true);
      expect(templates.some(t => t.id === 'security-audit')).toBe(true);
      expect(templates.some(t => t.id === 'performance-optimization')).toBe(true);
      expect(templates.some(t => t.id === 'quality-assurance')).toBe(true);
    });

    it('should return templates with required properties', () => {
      const templates = workflowDefs.getAllWorkflowTemplates();

      templates.forEach(template => {
        expect(template).toHaveProperty('id');
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('description');
        expect(template).toHaveProperty('roles');
        expect(template).toHaveProperty('maxIterations');
        expect(template).toHaveProperty('convergenceThreshold');
        expect(Array.isArray(template.roles)).toBe(true);
        expect(template.roles.length).toBeGreaterThan(0);
      });
    });
  });

  describe('createCustomWorkflow', () => {
    it('should create a custom workflow template', () => {
      const customWorkflow: WorkflowTemplate = {
        id: 'custom-test',
        name: 'Custom Test Workflow',
        description: 'A custom workflow for testing',
        roles: ['architect', 'quality'],
        maxIterations: 2,
        convergenceThreshold: 0.85,
        priority: 'medium',
        estimatedDuration: 30,
        requiredCapabilities: ['analysis', 'testing']
      };

      workflowDefs.addWorkflowTemplate(customWorkflow);

      const retrieved = workflowDefs.getWorkflowTemplate('custom-test');
      expect(retrieved).toEqual(customWorkflow);
    });

    it('should validate custom workflow structure', () => {
      const invalidWorkflow = {
        id: 'invalid',
        name: 'Invalid Workflow'
        // Missing required properties
      } as WorkflowTemplate;

      expect(() => {
        workflowDefs.addWorkflowTemplate(invalidWorkflow);
      }).toThrow('Invalid workflow template');
    });

    it('should prevent duplicate workflow IDs', () => {
      const workflow1: WorkflowTemplate = {
        id: 'duplicate-test',
        name: 'First Workflow',
        description: 'First workflow',
        roles: ['architect'],
        maxIterations: 1,
        convergenceThreshold: 0.8
      };

      const workflow2: WorkflowTemplate = {
        id: 'duplicate-test', // Same ID
        name: 'Second Workflow',
        description: 'Second workflow',
        roles: ['quality'],
        maxIterations: 2,
        convergenceThreshold: 0.9
      };

      workflowDefs.addWorkflowTemplate(workflow1);

      expect(() => {
        workflowDefs.addWorkflowTemplate(workflow2);
      }).toThrow('Workflow template with ID duplicate-test already exists');
    });
  });

  describe('workflow template validation', () => {
    it('should validate role names', () => {
      const workflowWithInvalidRole: WorkflowTemplate = {
        id: 'invalid-role-test',
        name: 'Invalid Role Test',
        description: 'Test with invalid role',
        roles: ['architect', 'invalid-role'],
        maxIterations: 1,
        convergenceThreshold: 0.8
      };

      expect(() => {
        workflowDefs.addWorkflowTemplate(workflowWithInvalidRole);
      }).toThrow('Invalid role name: invalid-role');
    });

    it('should validate convergence threshold range', () => {
      const workflowWithInvalidThreshold: WorkflowTemplate = {
        id: 'invalid-threshold-test',
        name: 'Invalid Threshold Test',
        description: 'Test with invalid threshold',
        roles: ['architect'],
        maxIterations: 1,
        convergenceThreshold: 1.5 // Invalid: > 1.0
      };

      expect(() => {
        workflowDefs.addWorkflowTemplate(workflowWithInvalidThreshold);
      }).toThrow('Convergence threshold must be between 0 and 1');
    });

    it('should validate maximum iterations', () => {
      const workflowWithInvalidIterations: WorkflowTemplate = {
        id: 'invalid-iterations-test',
        name: 'Invalid Iterations Test',
        description: 'Test with invalid iterations',
        roles: ['architect'],
        maxIterations: 0, // Invalid: must be > 0
        convergenceThreshold: 0.8
      };

      expect(() => {
        workflowDefs.addWorkflowTemplate(workflowWithInvalidIterations);
      }).toThrow('Max iterations must be greater than 0');
    });
  });

  describe('workflow template filtering', () => {
    it('should filter templates by priority', () => {
      const highPriorityTemplates = workflowDefs.getWorkflowTemplatesByPriority('high');

      highPriorityTemplates.forEach(template => {
        expect(template.priority).toBe('high');
      });
    });

    it('should filter templates by role capability', () => {
      const securityTemplates = workflowDefs.getWorkflowTemplatesByRole('security');

      securityTemplates.forEach(template => {
        expect(template.roles).toContain('security');
      });
    });

    it('should filter templates by estimated duration', () => {
      const shortTemplates = workflowDefs.getWorkflowTemplatesByDuration(0, 30);

      shortTemplates.forEach(template => {
        expect(template.estimatedDuration).toBeLessThanOrEqual(30);
      });
    });
  });

  describe('workflow template optimization', () => {
    it('should suggest optimal workflow for given requirements', () => {
      const requirements = {
        projectType: 'web-application',
        securityLevel: 'high',
        performanceRequirements: 'standard',
        timeConstraints: 'tight'
      };

      const suggestion = workflowDefs.suggestOptimalWorkflow(requirements);

      expect(suggestion).toBeDefined();
      expect(suggestion.template).toBeDefined();
      expect(suggestion.confidence).toBeGreaterThan(0);
      expect(suggestion.confidence).toBeLessThanOrEqual(1);
      expect(suggestion.reasoning).toBeDefined();
    });

    it('should consider time constraints in workflow suggestions', () => {
      const tightTimeRequirements = {
        projectType: 'api',
        timeConstraints: 'very-tight'
      };

      const relaxedTimeRequirements = {
        projectType: 'api',
        timeConstraints: 'relaxed'
      };

      const tightSuggestion = workflowDefs.suggestOptimalWorkflow(tightTimeRequirements);
      const relaxedSuggestion = workflowDefs.suggestOptimalWorkflow(relaxedTimeRequirements);

      expect(tightSuggestion.template.estimatedDuration)
        .toBeLessThan(relaxedSuggestion.template.estimatedDuration);
    });

    it('should adapt workflow based on project complexity', () => {
      const simpleProject = {
        projectType: 'script',
        complexity: 'low'
      };

      const complexProject = {
        projectType: 'enterprise-application',
        complexity: 'high'
      };

      const simpleSuggestion = workflowDefs.suggestOptimalWorkflow(simpleProject);
      const complexSuggestion = workflowDefs.suggestOptimalWorkflow(complexProject);

      expect(complexSuggestion.template.roles.length)
        .toBeGreaterThan(simpleSuggestion.template.roles.length);
      expect(complexSuggestion.template.maxIterations)
        .toBeGreaterThan(simpleSuggestion.template.maxIterations);
    });
  });
});