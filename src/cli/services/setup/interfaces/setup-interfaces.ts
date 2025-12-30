/**
 * Setup Service Interfaces - SOLID Compliant
 * Interface Segregation: Specific interfaces for each responsibility
 */

export interface SetupResult {
  success: boolean;
  message: string;
  data?: any;
  errors?: string[];
}

export interface SetupStatus {
  projectValid: boolean;
  containerSystem: boolean;
  databases: {
    postgres: boolean;
    neo4j: boolean;
    redis: boolean;
  };
  initialization: boolean;
}

export interface ContainerConfig {
  success: boolean;
  environment: string;
  dockerCommand: string;
  composeCommand: string;
  context?: string;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database?: string;
  user?: string;
  password?: string;
}

// Interface Segregation: Separate interfaces for each service type
export interface IPrerequisiteChecker {
  checkProject(projectPath?: string): Promise<SetupResult>;
  checkNodeVersion(): SetupResult;
}

export interface IContainerDetector {
  detect(): Promise<ContainerConfig>;
  testConnection(): Promise<boolean>;
}

export interface IContainerManager {
  startServices(config: ContainerConfig): Promise<SetupResult>;
  waitForHealth(config: ContainerConfig): Promise<SetupResult>;
  getContainerStatus(config: ContainerConfig): Promise<any>;
}

export interface IDatabaseInitializer {
  testConnections(): Promise<{ postgres: boolean; neo4j: boolean; redis: boolean }>;
  initializePostgreSQL(): Promise<SetupResult>;
  initializeNeo4j(): Promise<SetupResult>;
  initializeRedis(): Promise<SetupResult>;
}

export interface ISetupReporter {
  displayProgress(step: string, status: 'running' | 'success' | 'error' | 'warning'): void;
  displaySummary(status: SetupStatus, duration: number): void;
  displayErrorHelp(error: Error): void;
}

export interface ISetupOrchestrator {
  execute(options: SetupOptions): Promise<SetupResult>;
}

export interface SetupOptions {
  projectPath?: string;
  force?: boolean;
  skipDocker?: boolean;
  skipDatabases?: boolean;
}