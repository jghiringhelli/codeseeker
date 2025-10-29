/**
 * Command Context
 * Single Responsibility: Provide shared context for all command handlers
 * Interface Segregation: Clean interfaces for command requirements
 */

import * as readline from 'readline';
import { ProjectManager } from '../managers/project-manager';
import { DatabaseManager } from '../managers/database-manager';
import { UserInterface } from '../managers/user-interface';
import { CodeMindInstructionService } from '../services/integration/codemind-instruction-service';
import { InterruptManager } from '../managers/interrupt-manager';
import { ClaudeCodeForwarder } from '../managers/claude-code-forwarder';

export interface CommandContext {
  projectManager: ProjectManager;
  claudeOrchestrator: any; // ClaudeCodeOrchestrator - excluded for core build
  databaseManager: DatabaseManager;
  userInterface: UserInterface;
  instructionService: CodeMindInstructionService;
  interruptManager: InterruptManager;
  claudeForwarder: ClaudeCodeForwarder;
  currentProject?: any;
}

export interface CommandResult {
  success: boolean;
  message?: string;
  data?: any;
}

export interface PathAnalysisOptions {
  path: string;
  recursive: boolean;
  resolvedPath: string;
}

export interface CommandHandlerDependencies {
  context: CommandContext;
  rl?: readline.Interface;
}