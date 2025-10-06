/**
 * Project File Scanner - Facade Pattern + Dependency Injection
 * Main entry point that orchestrates all scanning components
 */
import { IFileFilter, ScanResult } from './file-scanner-interfaces';
export declare class ProjectFileScanner {
    private scanner;
    private defaultFilters;
    constructor(configPath?: string);
    /**
     * Scan a project directory with default filters
     */
    scanProject(projectPath: string): Promise<ScanResult>;
    /**
     * Scan with custom filters (Open/Closed Principle)
     */
    scanWithCustomFilters(projectPath: string, additionalFilters: IFileFilter[]): Promise<ScanResult>;
    /**
     * Add a custom filter at runtime (Liskov Substitution Principle)
     */
    addFilter(filter: IFileFilter): void;
    /**
     * Remove a filter by name
     */
    removeFilter(filterName: string): void;
    /**
     * Get current filters
     */
    getFilters(): IFileFilter[];
}
//# sourceMappingURL=project-file-scanner.d.ts.map