/**
 * Command Service Factory - Dependency Injection
 * Creates command services that implement proper interfaces
 * Now includes error handling for SOLID compliance
 */

import { ProjectManager } from '../../cli/managers/project-manager';
import { DatabaseManager } from '../../cli/managers/database-manager';
import { UserInterface } from '../../cli/managers/user-interface';
import { CodeSeekerInstructionService } from '../../cli/services/integration/codeseeker-instruction-service';
import { InterruptManager } from '../../cli/managers/interrupt-manager';
import { ClaudeCodeForwarder } from '../../cli/managers/claude-code-forwarder';
import { WorkflowOrchestrationAdapter } from '../../cli/managers/workflow-orchestration-adapter';
import { CommandContext } from '../../cli/commands/command-context';
import { ProjectServiceFactory } from './project-service-factory';
import { errorHandlingFactory } from './error-handling-factory';
import { IErrorHandler } from '../interfaces/error-interfaces';

export class CommandServiceFactory {
  private static instance: CommandServiceFactory;

  private constructor() {}

  static getInstance(): CommandServiceFactory {
    if (!CommandServiceFactory.instance) {
      CommandServiceFactory.instance = new CommandServiceFactory();
    }
    return CommandServiceFactory.instance;
  }

  /**
   * Create a complete command context with all services properly injected
   * Now includes error handling for SOLID compliance
   */
  createCommandContext(): CommandContext {
    // Use project service factory for proper dependency injection
    const projectServiceFactory = ProjectServiceFactory.getInstance();
    const projectManager = projectServiceFactory.createProjectManager();

    // Create error handler
    const errorHandler = errorHandlingFactory.createErrorHandler();

    // Create other services
    const databaseManager = new DatabaseManager();
    const userInterface = new UserInterface();
    const instructionService = new CodeSeekerInstructionService();
    const interruptManager = InterruptManager.getInstance();
    const claudeForwarder = new ClaudeCodeForwarder({
      showTimestamps: false,
      prefixLines: true
    });
    const requestProcessor = new WorkflowOrchestrationAdapter();

    return {
      projectManager,
      requestProcessor,
      databaseManager,
      userInterface,
      instructionService,
      interruptManager,
      claudeForwarder,
      errorHandler
    };
  }

  /**
   * Create error handler service
   */
  createErrorHandler(): IErrorHandler {
    return errorHandlingFactory.createErrorHandler();
  }

  /**
   * Create command context with custom implementations (for testing)
   */
  createCommandContextWithCustomServices(services: Partial<CommandContext>): CommandContext {
    const defaultContext = this.createCommandContext();
    return { ...defaultContext, ...services };
  }
}