/**
 * ProjectManager - SOLID Principles Compliant
 * Uses dependency injection and single responsibility services
 * Now includes proper error handling following SOLID principles
 */

import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import {
  ProjectConfig,
  ProjectInitOptions,
  IProjectDetector,
  ILanguageDetector,
  IProjectRegistry
} from '../../core/interfaces/project-interfaces';
import { Theme } from '../ui/theme';
import { withErrorHandling } from '../../core/utils/error-utils';

export class ProjectManager {
  private currentProjectPath: string;

  constructor(
    private projectDetector: IProjectDetector,
    private languageManager: ILanguageDetector,
    private projectRegistry: IProjectRegistry
  ) {
    this.currentProjectPath = process.env.CODEMIND_USER_CWD || process.cwd();
  }

  /**
   * Initialize a new project using dependency-injected services
   */
  async initializeProject(
    projectPath: string,
    options: ProjectInitOptions,
_syncMode?: boolean
  ): Promise<{ success: boolean; config?: ProjectConfig; error?: string }> {
    try {

    console.log(Theme.colors.info(`🔄 Initializing project: ${options.projectName}`));

    // Use injected detector service
    const detectedType = await this.projectDetector.detectProjectType(projectPath);
    const projectType = options.projectType || detectedType;

    // Use injected language manager
    const detectedLanguages = await this.languageManager.detectLanguages(projectPath);
    const languageSetup = await this.languageManager.setupLanguageSupport(detectedLanguages);

    // Create project configuration
    const config: ProjectConfig = {
      projectId: uuidv4(),
      projectName: options.projectName,
      projectPath,
      projectType,
      languages: languageSetup.detectedLanguages,
      primaryLanguage: this.determinePrimaryLanguage(languageSetup.detectedLanguages),
      frameworks: this.detectFrameworks(projectPath),
      features: options.features,
      createdAt: new Date().toISOString()
    };

    // Use injected registry service
    await this.projectRegistry.registerProject(config);

    // Create local configuration
    await this.createLocalConfig(config);

    console.log(Theme.colors.success(`✅ Project initialized: ${config.projectId}`));

    return { success: true, config };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.log(Theme.colors.error(`❌ Project initialization failed: ${errorMessage}`));
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Switch to a different project
   */
  async switchProject(targetPath: string): Promise<ProjectConfig | null> {
    // Use injected detector service
    const existingConfig = await this.projectDetector.getProjectConfig(targetPath);

    if (existingConfig) {
      this.currentProjectPath = targetPath;
      console.log(Theme.colors.info(`🔄 Switched to project: ${existingConfig.projectName}`));
      return existingConfig;
    }

    console.log(Theme.colors.warning(`⚠️ No project found at: ${targetPath}`));
    return null;
  }

  /**
   * Get project information from registry
   */
  async getProjectInfo(projectId: string): Promise<ProjectConfig | null> {
    return await this.projectRegistry.getProject(projectId);
  }

  /**
   * Scan project files using detector service
   */
  async scanProjectFiles(projectPath: string): Promise<ProjectConfig | null> {
    return await this.projectDetector.getProjectConfig(projectPath);
  }

  /**
   * Compatibility methods for existing code
   */

  // Detect project type and configuration (compatibility)
  async detectProject(projectPath?: string): Promise<ProjectConfig | null> {
    const targetPath = projectPath || this.currentProjectPath;

    const result = await withErrorHandling(
      () => this.projectDetector.getProjectConfig(targetPath),
      { projectPath: targetPath, operation: 'detectProject' }
    );

    if (result.success) {
      return result.data;
    } else {
      // Log error but return null for compatibility
      console.warn(`Project detection failed: ${String((result as { error?: unknown }).error)}`);
      return null;
    }
  }

  // Set current project path (compatibility)
  setProjectPath(projectPath: string): void {
    this.currentProjectPath = projectPath;
  }

  // Get current project path
  getCurrentProjectPath(): string {
    return this.currentProjectPath;
  }

  // Private helper methods (single responsibility)

  private createLocalConfig(config: ProjectConfig): void {
    const configDir = path.join(config.projectPath, '.codemind');
    const configPath = path.join(configDir, 'project.json');

    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  private determinePrimaryLanguage(languages: string[]): string | undefined {
    const priorityOrder = ['typescript', 'javascript', 'python', 'java', 'rust', 'go'];

    for (const priority of priorityOrder) {
      if (languages.includes(priority)) {
        return priority;
      }
    }

    return languages[0];
  }

  private detectFrameworks(projectPath: string): string[] {
    const frameworks: string[] = [];
    const packageJsonPath = path.join(projectPath, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

        if (dependencies.express) frameworks.push('express');
        if (dependencies.react) frameworks.push('react');
        if (dependencies.vue) frameworks.push('vue');
        if (dependencies.angular) frameworks.push('angular');
        if (dependencies.nest) frameworks.push('nestjs');
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`Failed to read package.json: ${errorMessage}`);
      }
    }

    return frameworks;
  }
}

// Export types for compatibility
export { ProjectInitOptions } from '../../core/interfaces/project-interfaces';