/**
 * Duplication Detector (SOLID Refactored)
 * SOLID Principles: Dependency Inversion - Coordinator depends on abstractions
 * Coordinates all duplication detection operations using service abstractions
 */
import { DuplicationScanRequest, DuplicationResult, DuplicationGroup, IFileAnalysisService, IDuplicationDetectionService, IRefactoringAdvisorService, IStatisticsService } from './interfaces/index';
export { DuplicationScanRequest, DuplicationResult, DuplicationGroup, ScanInfo, DuplicationType, RefactoringApproach, EffortEstimate, RefactoringAdvice, RefactoringImpact, CodeLocation, DuplicationStatistics } from './interfaces/index';
export declare class DuplicationDetector {
    private fileAnalysisService?;
    private detectionService?;
    private advisorService?;
    private statisticsService?;
    private logger;
    constructor(fileAnalysisService?: IFileAnalysisService, detectionService?: IDuplicationDetectionService, advisorService?: IRefactoringAdvisorService, statisticsService?: IStatisticsService);
    findDuplicates(request: DuplicationScanRequest): Promise<DuplicationResult>;
    quickScan(projectPath: string): Promise<DuplicationResult>;
    deepScan(projectPath: string): Promise<DuplicationResult>;
    generateReport(result: DuplicationResult): Promise<string>;
    getPriorityGroups(result: DuplicationResult, topN?: number): Promise<DuplicationGroup[]>;
    private findAllDuplicateTypes;
    private deduplicateAndPrioritize;
    private hasSignificantLocationOverlap;
    private locationsOverlap;
    private calculateGroupPriority;
    static createWithServices(fileAnalysisService: IFileAnalysisService, detectionService: IDuplicationDetectionService, advisorService: IRefactoringAdvisorService, statisticsService: IStatisticsService): DuplicationDetector;
    static createDefault(): DuplicationDetector;
}
//# sourceMappingURL=detector.d.ts.map