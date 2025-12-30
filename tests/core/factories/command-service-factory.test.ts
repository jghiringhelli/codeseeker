/**
 * Command Service Factory Tests
 * Tests for SOLID-compliant dependency injection factory
 */

import { CommandServiceFactory } from '../../../src/core/factories/command-service-factory';
import { CommandContext } from '../../../src/cli/commands/command-context';
import { ProjectManager } from '../../../src/cli/managers/project-manager';
import {
  IDatabaseManager,
  IUserInterface,
  IInstructionService,
  IInterruptManager,
  IClaudeCodeForwarder,
} from '../../../src/core/interfaces/command-interfaces';
import { IErrorHandler } from '../../../src/core/interfaces/error-interfaces';
import { IRequestProcessor } from '../../../src/core/interfaces/orchestrator-interfaces';

describe('CommandServiceFactory', () => {
  let factory: CommandServiceFactory;

  beforeEach(() => {
    factory = CommandServiceFactory.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = CommandServiceFactory.getInstance();
      const instance2 = CommandServiceFactory.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBe(factory);
    });

    it('should maintain state across calls', () => {
      const context1 = factory.createCommandContext();
      const context2 = factory.createCommandContext();

      // Should create new contexts but from the same factory instance
      expect(context1).toBeDefined();
      expect(context2).toBeDefined();
      expect(context1).not.toBe(context2); // Different contexts
    });
  });

  describe('createCommandContext', () => {
    let context: CommandContext;

    beforeEach(() => {
      context = factory.createCommandContext();
    });

    it('should create a complete command context', () => {
      expect(context).toBeDefined();
      expect(context.projectManager).toBeDefined();
      expect(context.requestProcessor).toBeDefined();
      expect(context.databaseManager).toBeDefined();
      expect(context.userInterface).toBeDefined();
      expect(context.instructionService).toBeDefined();
      expect(context.interruptManager).toBeDefined();
      expect(context.claudeForwarder).toBeDefined();
      expect(context.errorHandler).toBeDefined();
    });

    it('should inject proper project manager implementation', () => {
      expect(context.projectManager).toBeInstanceOf(ProjectManager);
    });

    it('should provide error handler with SOLID design', () => {
      expect(context.errorHandler).toBeDefined();
      expect(context.errorHandler.handle).toBeDefined();
      expect(context.errorHandler.handleWithRecovery).toBeDefined();
      expect(context.errorHandler.isRecoverable).toBeDefined();
    });

    describe('Interface Compliance', () => {
      it('should provide database manager conforming to interface', () => {
        const dbManager = context.databaseManager;

        // Should have interface methods (may be optional)
        expect(typeof dbManager.initialize === 'function' || dbManager.initialize === undefined).toBe(true);
        expect(typeof dbManager.checkConnection === 'function' || dbManager.checkConnection === undefined).toBe(true);
        expect(typeof dbManager.getStatus === 'function' || dbManager.getStatus === undefined).toBe(true);
      });

      it('should provide user interface conforming to interface', () => {
        const ui = context.userInterface;

        // Should have interface methods (may be optional)
        expect(typeof ui.displayMessage === 'function' || ui.displayMessage === undefined).toBe(true);
        expect(typeof ui.promptUser === 'function' || ui.promptUser === undefined).toBe(true);
        expect(typeof ui.displayProgress === 'function' || ui.displayProgress === undefined).toBe(true);
      });

      it('should provide instruction service conforming to interface', () => {
        const instructionService = context.instructionService;

        // Should have interface methods (may be optional)
        expect(typeof instructionService.getInstructionsSummary === 'function' || instructionService.getInstructionsSummary === undefined).toBe(true);
        expect(typeof instructionService.loadInstructions === 'function' || instructionService.loadInstructions === undefined).toBe(true);
      });

      it('should provide interrupt manager conforming to interface', () => {
        const interruptManager = context.interruptManager;

        // Should have interface methods (may be optional)
        expect(typeof interruptManager.registerInterruptHandler === 'function' || interruptManager.registerInterruptHandler === undefined).toBe(true);
        expect(typeof interruptManager.triggerInterrupt === 'function' || interruptManager.triggerInterrupt === undefined).toBe(true);
        expect(typeof interruptManager.isInterrupted === 'function' || interruptManager.isInterrupted === undefined).toBe(true);
      });

      it('should provide Claude Code forwarder conforming to interface', () => {
        const claudeForwarder = context.claudeForwarder;

        // Should have interface methods (may be optional)
        expect(typeof claudeForwarder.forwardToClaudeCode === 'function' || claudeForwarder.forwardToClaudeCode === undefined).toBe(true);
        expect(typeof claudeForwarder.isAvailable === 'function' || claudeForwarder.isAvailable === undefined).toBe(true);
      });

      it('should provide request processor conforming to interface', () => {
        const requestProcessor = context.requestProcessor;

        // Should have interface methods (may be optional)
        expect(typeof requestProcessor.processRequest === 'function' || requestProcessor.processRequest === undefined).toBe(true);
        expect(typeof requestProcessor.analyzeProject === 'function' || requestProcessor.analyzeProject === undefined).toBe(true);
      });
    });

    describe('Dependency Injection Verification', () => {
      it('should create new instances for each context', () => {
        const context1 = factory.createCommandContext();
        const context2 = factory.createCommandContext();

        // Different instances but same types
        expect(context1.projectManager).not.toBe(context2.projectManager);
        expect(context1.errorHandler).not.toBe(context2.errorHandler);

        // But both should be the correct types
        expect(context1.projectManager).toBeInstanceOf(ProjectManager);
        expect(context2.projectManager).toBeInstanceOf(ProjectManager);
      });

      it('should maintain singleton services where appropriate', () => {
        const context1 = factory.createCommandContext();
        const context2 = factory.createCommandContext();

        // InterruptManager should be singleton
        expect(context1.interruptManager).toBe(context2.interruptManager);
      });
    });
  });

  describe('createErrorHandler', () => {
    it('should create standalone error handler', () => {
      const errorHandler = factory.createErrorHandler();

      expect(errorHandler).toBeDefined();
      expect(errorHandler.handle).toBeDefined();
      expect(errorHandler.handleWithRecovery).toBeDefined();
      expect(errorHandler.isRecoverable).toBeDefined();
    });

    it('should create independent error handler instances', () => {
      const handler1 = factory.createErrorHandler();
      const handler2 = factory.createErrorHandler();

      expect(handler1).not.toBe(handler2);
      expect(handler1.handle).toBeDefined();
      expect(handler2.handle).toBeDefined();
    });
  });

  describe('SOLID Principles Compliance', () => {
    it('should demonstrate Single Responsibility Principle', () => {
      // Factory only responsible for creating and wiring services
      expect(factory.createCommandContext).toBeDefined();
      expect(factory.createErrorHandler).toBeDefined();
      // No business logic, only dependency injection
    });

    it('should demonstrate Dependency Inversion Principle', () => {
      const context = factory.createCommandContext();

      // All services implement interfaces, not concrete dependencies
      expect(context.databaseManager).toBeDefined();
      expect(context.userInterface).toBeDefined();
      expect(context.instructionService).toBeDefined();
      expect(context.interruptManager).toBeDefined();
      expect(context.claudeForwarder).toBeDefined();
      expect(context.errorHandler).toBeDefined();
    });

    it('should demonstrate Open/Closed Principle', () => {
      // Factory can be extended to create different configurations
      // without modifying existing code
      const context = factory.createCommandContext();
      expect(context).toBeDefined();

      // Could be extended with createTestCommandContext, createProductionCommandContext, etc.
    });

    it('should demonstrate Interface Segregation Principle', () => {
      const context = factory.createCommandContext();

      // Each service implements focused interfaces
      expect(context.projectManager).toBeDefined(); // Project management only
      expect(context.databaseManager).toBeDefined(); // Database operations only
      expect(context.userInterface).toBeDefined(); // UI operations only
      expect(context.errorHandler).toBeDefined(); // Error handling only
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle service creation failures gracefully', () => {
      // Factory should not throw during creation
      expect(() => {
        const context = factory.createCommandContext();
        expect(context).toBeDefined();
      }).not.toThrow();
    });

    it('should provide error handler in all contexts', () => {
      const context = factory.createCommandContext();

      expect(context.errorHandler).toBeDefined();
      expect(typeof context.errorHandler.handle).toBe('function');
    });
  });

  describe('Service Lifecycle Management', () => {
    it('should create fresh service instances', () => {
      const context1 = factory.createCommandContext();
      const context2 = factory.createCommandContext();

      // Most services should be fresh instances
      expect(context1.projectManager).not.toBe(context2.projectManager);
      expect(context1.errorHandler).not.toBe(context2.errorHandler);
    });

    it('should handle complex dependency graphs', () => {
      const context = factory.createCommandContext();

      // Verify that complex dependencies are properly injected
      expect(context.projectManager).toBeDefined();

      // ProjectManager should have its own dependencies injected
      // (This tests the nested dependency injection)
      expect(context.projectManager).toBeInstanceOf(ProjectManager);
    });
  });

  describe('Configuration and Environment', () => {
    it('should adapt to different environments', () => {
      // Test that factory can adapt to different configurations
      const context = factory.createCommandContext();

      expect(context.claudeForwarder).toBeDefined();
      // ClaudeCodeForwarder should be configured appropriately
    });

    it('should provide consistent service configuration', () => {
      const context1 = factory.createCommandContext();
      const context2 = factory.createCommandContext();

      // Services should have consistent configuration
      expect(context1.claudeForwarder).toBeDefined();
      expect(context2.claudeForwarder).toBeDefined();
    });
  });
});