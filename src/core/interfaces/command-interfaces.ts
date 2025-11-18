/**
 * Command interfaces following Interface Segregation Principle
 * Each interface has a single, focused responsibility
 */

export interface CommandResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: string;
}

export interface PathAnalysisOptions {
  path: string;
  recursive: boolean;
  resolvedPath: string;
}

// Single Responsibility: Command Execution
export interface ICommandHandler {
  handle(args: string[], options?: any): Promise<CommandResult>;
  getDescription(): string;
  getUsage(): string;
}

// Single Responsibility: Command Routing
export interface ICommandRouter {
  registerCommand(name: string, handler: ICommandHandler): void;
  executeCommand(commandLine: string): Promise<CommandResult>;
  listCommands(): string[];
  getCommandHelp(commandName: string): string;
}

// Single Responsibility: User Interface Operations
export interface IUserInterface {
  displayMessage?(message: string, type?: 'info' | 'success' | 'warning' | 'error'): void;
  promptUser?(question: string): Promise<string>;
  displayProgress?(current: number, total: number, message?: string): void;
  clearScreen?(): void;
  displayProcessingResults?(results: any): void;
  getInitializationAction?(projectPath: string, projectType: string): Promise<string>;
  confirm?(message: string): Promise<boolean>;
  getProjectInitOptions?(): Promise<any>;
  displayProjectInfo?(project: any): void;
  displaySearchResults?(results: any): void;
  displayAnalysisResults?(results: any): void;
  displayHelp?(): void;
  showError?(message: string): void;
  showSuccess?(message: string): void;
  [key: string]: any; // Allow additional methods
}

// Single Responsibility: Database Operations
export interface IDatabaseManager {
  initialize?(): Promise<void>;
  checkConnection?(): Promise<boolean>;
  getStatus?(): Promise<{
    postgres: boolean;
    redis: boolean;
    neo4j: boolean;
  }>;
  getProjectStats?(projectId: string): Promise<any>;
  checkSystemHealth?(): Promise<any>;
  getPostgresConnection?(): any;
  cleanup?(): Promise<void>;
  [key: string]: any; // Allow additional methods
}

// Single Responsibility: Interrupt Handling
export interface IInterruptManager {
  registerInterruptHandler?(callback: () => Promise<void>): void;
  triggerInterrupt?(reason: string): Promise<void>;
  isInterrupted?(operationId?: string): boolean;
  wrapInterruptible?<T>(operationId: string, description: string, operation: (updateCallback?: (partialResults: any) => void) => Promise<T>): Promise<T>;
  cleanup?(): void;
  [key: string]: any; // Allow additional methods
}

// Single Responsibility: Claude Code Integration
export interface IClaudeCodeForwarder {
  forwardToClaudeCode?(prompt: string, options?: any): Promise<string>;
  isAvailable?(): boolean;
  getConfiguration?(): any;
  stopForwarding?(): void;
  [key: string]: any; // Allow additional methods
}

// Single Responsibility: Instruction Management
export interface IInstructionService {
  getInstructionsSummary?(projectPath: string): Promise<string[]>;
  loadInstructions?(projectPath: string): Promise<any>;
  loadProjectInstructions?(projectPath: string): Promise<any>;
  updateInstructions?(projectPath: string, instructions: any): Promise<void>;
  createSampleInstructions?(projectPath: string): Promise<void>;
  clearCache?(): void;
  [key: string]: any; // Allow additional methods
}