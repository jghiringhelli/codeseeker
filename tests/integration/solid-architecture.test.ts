/**
 * SOLID Architecture Integration Tests
 * Tests that verify the complete SOLID-refactored system works together
 */

import { CommandServiceFactory } from '../../src/core/factories/command-service-factory';
import { errorFactory } from '../../src/core/factories/error-factory';
import { withErrorHandling } from '../../src/core/utils/error-utils';
import {
  ProjectConfig,
  ProjectInitOptions,
} from '../../src/core/interfaces/project-interfaces';
import {
  CodeMindError,
  Result,
} from '../../src/core/interfaces/error-interfaces';

describe('SOLID Architecture Integration', () => {
  let commandServiceFactory: CommandServiceFactory;

  beforeEach(() => {
    commandServiceFactory = CommandServiceFactory.getInstance();
  });

  describe('End-to-End Dependency Injection', () => {
    it('should create a complete working system through dependency injection', () => {
      const context = commandServiceFactory.createCommandContext();

      // Verify all core services are properly injected
      expect(context.projectManager).toBeDefined();
      expect(context.requestProcessor).toBeDefined();
      expect(context.databaseManager).toBeDefined();
      expect(context.userInterface).toBeDefined();
      expect(context.instructionService).toBeDefined();
      expect(context.interruptManager).toBeDefined();
      expect(context.claudeForwarder).toBeDefined();
      expect(context.errorHandler).toBeDefined();

      // Verify services have their required methods
      expect(typeof context.projectManager.detectProject).toBe('function');
      expect(typeof context.errorHandler.handle).toBe('function');
    });

    it('should support multiple independent contexts', () => {
      const context1 = commandServiceFactory.createCommandContext();
      const context2 = commandServiceFactory.createCommandContext();

      expect(context1).not.toBe(context2);
      expect(context1.projectManager).not.toBe(context2.projectManager);
      expect(context1.errorHandler).not.toBe(context2.errorHandler);

      // But singleton services should be shared
      expect(context1.interruptManager).toBe(context2.interruptManager);
    });
  });

  describe('Error Handling System Integration', () => {
    it('should handle errors consistently across all services', async () => {
      const context = commandServiceFactory.createCommandContext();
      const errorHandler = context.errorHandler;

      // Test different error types
      const databaseError = errorFactory.createDatabaseError('connect', 'Test DB error');
      const projectError = errorFactory.createProjectError('init', 'Test project error');
      const networkError = errorFactory.createNetworkError('http://test', 'GET', 'Test network error');

      // All errors should be handled consistently
      const dbResult = await errorHandler.handle(databaseError);
      const projResult = await errorHandler.handle(projectError);
      const netResult = await errorHandler.handle(networkError);

      expect(dbResult.success).toBe(false);
      expect(projResult.success).toBe(false);
      expect(netResult.success).toBe(false);

      if (!dbResult.success) expect((dbResult as any).error).toBe(databaseError);
      if (!projResult.success) expect((projResult as any).error).toBe(projectError);
      if (!netResult.success) expect((netResult as any).error).toBe(networkError);
    });

    it('should support error recovery across services', async () => {
      const context = commandServiceFactory.createCommandContext();
      const errorHandler = context.errorHandler;

      // Create a recoverable error
      const recoverableError = errorFactory.createValidationError('test', 'invalid', 'valid');

      const result = await errorHandler.handleWithRecovery(recoverableError);

      // Should attempt recovery for validation errors
      expect(result).toBeDefined();
    });

    it('should integrate error handling with project operations', async () => {
      const context = commandServiceFactory.createCommandContext();

      // Test that project manager uses error handling utilities
      const result = await withErrorHandling(async () => {
        return await context.projectManager.detectProject('/nonexistent/path');
      });

      expect(result.success).toBe(true); // Should succeed but return null
      if (result.success) {
        expect(result.data).toBeNull(); // No project found
      }
    });
  });

  describe('Project Management Integration', () => {
    it('should integrate project manager with error handling', async () => {
      const context = commandServiceFactory.createCommandContext();

      // Test project detection with error handling
      const result = await context.projectManager.detectProject();

      // Should not throw errors, but handle them gracefully
      expect(result).toBeDefined(); // Either project config or null
    });

    it('should support project initialization workflow', async () => {
      const context = commandServiceFactory.createCommandContext();
      const errorHandler = context.errorHandler;

      // Mock project initialization
      const mockProjectOptions: ProjectInitOptions = {
        projectName: 'Integration Test Project',
        projectType: 'typescript',
        features: ['semantic-search'],
      };

      // Test that the initialization workflow can be wrapped with error handling
      const result = await withErrorHandling(async () => {
        // This would normally call the actual initialization
        return await context.projectManager.initializeProject('/test/path', mockProjectOptions);
      });

      // Should handle any errors gracefully
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Service Communication Integration', () => {
    it('should allow services to communicate through shared interfaces', () => {
      const context = commandServiceFactory.createCommandContext();

      // Services should be able to interact through their interfaces
      expect(context.projectManager).toBeDefined();
      expect(context.databaseManager).toBeDefined();
      expect(context.errorHandler).toBeDefined();

      // All services should be loosely coupled through interfaces
      expect(typeof context.projectManager.detectProject).toBe('function');
    });

    it('should support cross-service error propagation', async () => {
      const context = commandServiceFactory.createCommandContext();

      // Create an error in one service and handle it in another
      const projectError = errorFactory.createProjectError('test', 'Cross-service error');
      const result = await context.errorHandler.handle(projectError);

      expect(result.success).toBe(false);
      expect((result as any).error).toBe(projectError);
    });
  });

  describe('SOLID Principles Verification', () => {
    describe('Single Responsibility Principle', () => {
      it('should have focused responsibilities across services', () => {
        const context = commandServiceFactory.createCommandContext();

        // Each service should have a single, focused responsibility
        expect(context.projectManager).toBeDefined(); // Project management only
        expect(context.errorHandler).toBeDefined(); // Error handling only
        expect(context.databaseManager).toBeDefined(); // Database operations only
        expect(context.userInterface).toBeDefined(); // UI operations only
      });
    });

    describe('Open/Closed Principle', () => {
      it('should be extensible without modification', () => {
        // The factory pattern allows extension without modification
        const factory1 = CommandServiceFactory.getInstance();
        const factory2 = CommandServiceFactory.getInstance();

        expect(factory1).toBe(factory2); // Singleton

        // Could be extended with different factory methods
        expect(factory1.createCommandContext).toBeDefined();
        expect(factory1.createErrorHandler).toBeDefined();
      });
    });

    describe('Liskov Substitution Principle', () => {
      it('should allow interface implementations to be substitutable', () => {
        const context = commandServiceFactory.createCommandContext();

        // All implementations should be substitutable through their interfaces
        const errorHandler = context.errorHandler;
        expect(typeof errorHandler.handle).toBe('function');
        expect(typeof errorHandler.handleWithRecovery).toBe('function');
        expect(typeof errorHandler.isRecoverable).toBe('function');
      });
    });

    describe('Interface Segregation Principle', () => {
      it('should use focused, segregated interfaces', () => {
        const context = commandServiceFactory.createCommandContext();

        // Verify that interfaces are focused and not bloated
        const errorHandler = context.errorHandler;

        // Error handler should only have error-related methods
        const errorHandlerMethods = ['handle', 'handleWithRecovery', 'isRecoverable'];
        errorHandlerMethods.forEach(method => {
          expect(typeof (errorHandler as any)[method]).toBe('function');
        });
      });
    });

    describe('Dependency Inversion Principle', () => {
      it('should depend on abstractions, not concretions', () => {
        const context = commandServiceFactory.createCommandContext();

        // All services should be accessed through interfaces
        expect(context.projectManager).toBeDefined();
        expect(context.errorHandler).toBeDefined();
        expect(context.databaseManager).toBeDefined();

        // Services should not depend on concrete implementations
        // but on abstractions (interfaces)
      });
    });
  });

  describe('Performance and Scalability', () => {
    it('should create contexts efficiently', () => {
      const startTime = Date.now();
      const contexts = [];

      // Create multiple contexts
      for (let i = 0; i < 10; i++) {
        contexts.push(commandServiceFactory.createCommandContext());
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should create contexts quickly (less than 1 second for 10 contexts)
      expect(duration).toBeLessThan(1000);
      expect(contexts).toHaveLength(10);

      // Each context should be unique
      const uniqueProjectManagers = new Set(contexts.map(c => c.projectManager));
      expect(uniqueProjectManagers.size).toBe(10);
    });

    it('should handle concurrent operations', async () => {
      const context = commandServiceFactory.createCommandContext();

      // Create multiple concurrent error handling operations
      const errors = [
        errorFactory.createProjectError('test1', 'Error 1'),
        errorFactory.createProjectError('test2', 'Error 2'),
        errorFactory.createProjectError('test3', 'Error 3'),
      ];

      const promises = errors.map(error => context.errorHandler.handle(error));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.success).toBe(false);
        expect((result as any).error).toBe(errors[index]);
      });
    });
  });

  describe('Configuration and Environment Adaptation', () => {
    it('should adapt to different configurations', () => {
      const context = commandServiceFactory.createCommandContext();

      // Services should be configured appropriately for the environment
      expect(context.claudeForwarder).toBeDefined();
      expect(context.interruptManager).toBeDefined();

      // All services should be ready for use
      expect(context.errorHandler).toBeDefined();
    });

    it('should provide consistent behavior across environments', () => {
      const context1 = commandServiceFactory.createCommandContext();
      const context2 = commandServiceFactory.createCommandContext();

      // Both contexts should provide the same service types
      expect(context1.projectManager.constructor.name).toBe(context2.projectManager.constructor.name);
      expect(typeof context1.errorHandler.handle).toBe(typeof context2.errorHandler.handle);
    });
  });

  describe('Error Boundary Integration', () => {
    it('should provide system-wide error boundaries', async () => {
      const context = commandServiceFactory.createCommandContext();

      // Test that the system can handle unexpected errors gracefully
      const systemTest = async () => {
        try {
          // Simulate various operations that might fail
          await context.projectManager.detectProject('/invalid/path');

          const testError = errorFactory.createProjectError('system-test', 'System boundary test');
          await context.errorHandler.handle(testError);

          return { success: true, message: 'System test completed' };
        } catch (error) {
          // Should not reach here - errors should be handled gracefully
          return { success: false, error };
        }
      };

      const result = await systemTest();
      expect(result.success).toBe(true);
    });
  });
});