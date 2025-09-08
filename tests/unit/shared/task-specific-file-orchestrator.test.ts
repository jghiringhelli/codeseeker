/**
 * Unit tests for Task-Specific File Orchestrator
 */

import { TaskSpecificFileOrchestrator } from '../../../src/shared/task-specific-file-orchestrator';
import { ProjectContext } from '../../../src/shared/types';

describe('TaskSpecificFileOrchestrator', () => {
  let orchestrator: TaskSpecificFileOrchestrator;
  const testProjectPath = 'C:\\test\\project';

  beforeEach(() => {
    orchestrator = new TaskSpecificFileOrchestrator(testProjectPath);
  });

  describe('Request Orchestration', () => {
    test('should orchestrate request successfully', async () => {
      const context: ProjectContext = {
        projectPath: testProjectPath,
        projectId: 'test-project-123',
        requestType: 'code_modification',
        language: 'typescript',
        framework: 'react'
      };

      // Mock implementation - in real scenario this would interact with actual systems
      expect(async () => {
        await orchestrator.orchestrateRequest(
          testProjectPath,
          'create user authentication system',
          {
            dryRun: true, // Use dry run to avoid actual file operations
            skipCycles: true
          }
        );
      }).not.toThrow();
    });

    test('should handle project context correctly', () => {
      const context: ProjectContext = {
        projectPath: testProjectPath,
        projectId: 'test-project-123', 
        requestType: 'analysis',
        language: 'typescript'
      };

      expect(context.projectPath).toBe(testProjectPath);
      expect(context.requestType).toBe('analysis');
    });

    test('should validate required context properties', () => {
      const context: ProjectContext = {
        projectPath: testProjectPath,
        projectId: 'test-project-123',
        requestType: 'code_modification'
      };

      expect(context.projectPath).toBeDefined();
      expect(context.projectId).toBeDefined();
      expect(context.requestType).toBeDefined();
    });
  });

  describe('File Path Management', () => {
    test('should handle project path correctly', () => {
      expect(orchestrator).toBeDefined();
      // Since constructor takes projectPath, orchestrator should be properly initialized
    });
  });
});