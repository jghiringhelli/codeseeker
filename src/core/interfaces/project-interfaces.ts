/**
 * Core project interfaces following Interface Segregation Principle
 * Each interface has a single, focused responsibility
 */

export interface IProjectDetector {
  detectProjectType?(projectPath: string): Promise<string>;
  detectProject?(projectPath: string): Promise<ProjectConfig | null>;
  getProjectConfig?(projectPath: string): Promise<ProjectConfig | null>;
  [key: string]: any; // Allow additional methods
}

export interface InitializationResult {
  success: boolean;
  config?: ProjectConfig;
  error?: string;
}

export interface IProjectInitializer {
  initializeProject(projectPath: string, options: ProjectInitOptions, syncMode?: boolean): Promise<InitializationResult>;
  createProjectStructure(config: ProjectConfig): Promise<void>;
}

export interface ILanguageDetector {
  detectLanguages(projectPath: string): Promise<string[]>;
  setupLanguageSupport(languages: string[]): Promise<LanguageSetupResult>;
}

export interface IProjectRegistry {
  registerProject(config: ProjectConfig): Promise<void>;
  updateProject(projectId: string, updates: Partial<ProjectConfig>): Promise<void>;
  getProject(projectId: string): Promise<ProjectConfig | null>;
}

export interface ProjectConfig {
  projectId: string;
  projectName: string;
  projectPath: string;
  projectType?: string;
  languages: string[];
  primaryLanguage?: string;
  installedParsers?: string[];
  frameworks?: string[];
  features?: string[];
  createdAt: string;
  lastUpdated?: string;
  total_files?: number;
  statistics?: any;
  [key: string]: any; // Allow additional properties
}

export interface ProjectInitOptions {
  projectName: string;
  projectType: string;
  features: string[];
  resumeToken?: string;
}

export interface LanguageSetupResult {
  detectedLanguages: string[];
  selectedLanguages: string[];
  installedPackages: string[];
  errors: string[];
}