/**
 * Setup Orchestrator Service
 * Single Responsibility: Orchestrate the complete setup workflow
 * Dependency Inversion: Uses injected services instead of concrete implementations
 */
import { ISetupOrchestrator, IPrerequisiteChecker, IContainerDetector, IContainerManager, IDatabaseInitializer, ISetupReporter, SetupOptions, SetupResult } from './interfaces/setup-interfaces';
export declare class SetupOrchestrator implements ISetupOrchestrator {
    private prerequisiteChecker;
    private containerDetector;
    private containerManager;
    private databaseInitializer;
    private reporter;
    private startTime;
    private status;
    constructor(prerequisiteChecker: IPrerequisiteChecker, containerDetector: IContainerDetector, containerManager: IContainerManager, databaseInitializer: IDatabaseInitializer, reporter: ISetupReporter);
    execute(options?: SetupOptions): Promise<SetupResult>;
    private displayWelcome;
    private checkPrerequisites;
    private detectContainerSystem;
    private setupContainers;
    private handleNonContainerSetup;
    private initializeDatabases;
    private verifySetup;
    private displayFinalSummary;
    private isSetupComplete;
}
//# sourceMappingURL=setup-orchestrator.d.ts.map