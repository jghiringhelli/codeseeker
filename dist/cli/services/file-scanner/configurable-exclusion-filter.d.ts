/**
 * Configurable Exclusion Filter - Open/Closed Principle
 * Externalized configuration allows users to modify rules without code changes
 */
import { IFileFilter } from './file-scanner-interfaces';
interface FilterConfig {
    scanning: {
        maxFileSize: number;
        maxFiles: number;
        followSymlinks: boolean;
    };
    exclusions: {
        directories: string[];
        extensions: string[];
        fileNames: string[];
    };
    inclusions: {
        sourceExtensions: string[];
        configExtensions: string[];
        documentationExtensions: string[];
        templateExtensions: string[];
        scriptExtensions: string[];
        schemaExtensions: string[];
        importantDotFiles: string[];
    };
    typeMapping: Record<string, string[]>;
    languageMapping: Record<string, string>;
}
export declare class ConfigurableExclusionFilter implements IFileFilter {
    private config;
    private excludedDirectories;
    private excludedExtensions;
    private excludedFileNames;
    private importantDotFiles;
    constructor(configPath?: string);
    private loadConfig;
    private initializeSets;
    private getDefaultConfig;
    shouldInclude(filePath: string, fileName: string, stats: any): boolean;
    private containsExcludedDirectory;
    private getFileExtension;
    private isImportantDotFile;
    getFilterName(): string;
    reloadConfig(configPath?: string): void;
    getConfig(): FilterConfig;
}
export {};
//# sourceMappingURL=configurable-exclusion-filter.d.ts.map