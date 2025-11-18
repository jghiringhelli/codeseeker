/**
 * Command Context - SOLID Principles Compliant
 * Single Responsibility: Provide shared context for all command handlers
 * Interface Segregation: Clean interfaces for command requirements
 */
import * as readline from 'readline';
import { ProjectManager } from '../managers/project-manager';
import { IDatabaseManager, IUserInterface, IInterruptManager, IClaudeCodeForwarder, IInstructionService } from '../../core/interfaces/command-interfaces';
import { IRequestProcessor } from '../../core/interfaces/orchestrator-interfaces';
import { IErrorHandler } from '../../core/interfaces/error-interfaces';
export interface CommandContext {
    projectManager: ProjectManager;
    requestProcessor: IRequestProcessor;
    databaseManager: IDatabaseManager;
    userInterface: IUserInterface;
    instructionService: IInstructionService;
    interruptManager: IInterruptManager;
    claudeForwarder: IClaudeCodeForwarder;
    errorHandler: IErrorHandler;
    currentProject?: any;
}
export { CommandResult, PathAnalysisOptions } from '../../core/interfaces/command-interfaces';
export interface CommandHandlerDependencies {
    context: CommandContext;
    rl?: readline.Interface;
}
//# sourceMappingURL=command-context.d.ts.map