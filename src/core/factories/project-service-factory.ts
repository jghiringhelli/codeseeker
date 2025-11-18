/**
 * Project Service Factory - Dependency Injection
 * Creates and wires up project services following Dependency Inversion Principle
 */

import { DatabaseConnections } from '../../config/database-config';
import { ProjectDetector } from '../../cli/services/project/project-detector';
import { LanguageManager } from '../../cli/services/project/language-manager';
import { ProjectRegistry } from '../../cli/services/project/project-registry';
import { ProjectManager } from '../../cli/managers/project-manager';
import {
  IProjectDetector,
  ILanguageDetector,
  IProjectRegistry
} from '../interfaces/project-interfaces';

export class ProjectServiceFactory {
  private static instance: ProjectServiceFactory;
  private dbConnections: DatabaseConnections;

  private constructor() {
    this.dbConnections = new DatabaseConnections();
  }

  static getInstance(): ProjectServiceFactory {
    if (!ProjectServiceFactory.instance) {
      ProjectServiceFactory.instance = new ProjectServiceFactory();
    }
    return ProjectServiceFactory.instance;
  }

  /**
   * Create project detector service
   */
  createProjectDetector(): IProjectDetector {
    return new ProjectDetector();
  }

  /**
   * Create language manager service
   */
  createLanguageManager(): ILanguageDetector {
    return new LanguageManager();
  }

  /**
   * Create project registry service
   */
  createProjectRegistry(): IProjectRegistry {
    return new ProjectRegistry(this.dbConnections);
  }

  /**
   * Create fully configured project manager with all dependencies injected
   */
  createProjectManager(): ProjectManager {
    const detector = this.createProjectDetector();
    const languageManager = this.createLanguageManager();
    const registry = this.createProjectRegistry();

    return new ProjectManager(detector, languageManager, registry);
  }

  /**
   * Create project manager with custom dependencies (for testing)
   */
  createProjectManagerWithDependencies(
    detector: IProjectDetector,
    languageManager: ILanguageDetector,
    registry: IProjectRegistry
  ): ProjectManager {
    return new ProjectManager(detector, languageManager, registry);
  }

  /**
   * Get database connections instance
   */
  getDatabaseConnections(): DatabaseConnections {
    return this.dbConnections;
  }
}