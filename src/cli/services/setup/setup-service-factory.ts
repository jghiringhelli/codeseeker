/**
 * Setup Service Factory
 * Dependency Inversion: Creates and wires setup services with proper dependencies
 */

import { SetupOrchestrator } from './setup-orchestrator';
import { PrerequisiteChecker } from './prerequisite-checker';
import { ContainerDetector } from './container-detector';
import { ContainerManager } from './container-manager';
import { DatabaseInitializer } from './database-initializer';
import { SetupReporter } from './setup-reporter';
import { ISetupOrchestrator } from './interfaces/setup-interfaces';

export class SetupServiceFactory {
  static createSetupOrchestrator(): ISetupOrchestrator {
    // Create all service instances
    const prerequisiteChecker = new PrerequisiteChecker();
    const containerDetector = new ContainerDetector();
    const containerManager = new ContainerManager();
    const databaseInitializer = new DatabaseInitializer();
    const reporter = new SetupReporter();

    // Wire dependencies through constructor injection
    return new SetupOrchestrator(
      prerequisiteChecker,
      containerDetector,
      containerManager,
      databaseInitializer,
      reporter
    );
  }

  // Factory methods for individual services (for testing or standalone use)
  static createPrerequisiteChecker() {
    return new PrerequisiteChecker();
  }

  static createContainerDetector() {
    return new ContainerDetector();
  }

  static createContainerManager() {
    return new ContainerManager();
  }

  static createDatabaseInitializer() {
    return new DatabaseInitializer();
  }

  static createReporter() {
    return new SetupReporter();
  }
}