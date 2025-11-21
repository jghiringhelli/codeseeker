/**
 * Setup Service Factory
 * Dependency Inversion: Creates and wires setup services with proper dependencies
 */
import { PrerequisiteChecker } from './prerequisite-checker';
import { ContainerDetector } from './container-detector';
import { ContainerManager } from './container-manager';
import { DatabaseInitializer } from './database-initializer';
import { SetupReporter } from './setup-reporter';
import { ISetupOrchestrator } from './interfaces/setup-interfaces';
export declare class SetupServiceFactory {
    static createSetupOrchestrator(): ISetupOrchestrator;
    static createPrerequisiteChecker(): PrerequisiteChecker;
    static createContainerDetector(): ContainerDetector;
    static createContainerManager(): ContainerManager;
    static createDatabaseInitializer(): DatabaseInitializer;
    static createReporter(): SetupReporter;
}
//# sourceMappingURL=setup-service-factory.d.ts.map