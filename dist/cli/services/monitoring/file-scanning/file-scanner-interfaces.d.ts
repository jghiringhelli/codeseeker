/**
 * File Scanner Interfaces - SOLID Interface Segregation Principle
 * Focused interfaces for different scanning concerns
 */
export interface FileInfo {
    path: string;
    relativePath: string;
    name: string;
    extension: string;
    size: number;
    type: 'source' | 'config' | 'documentation' | 'template' | 'script' | 'schema' | 'other';
    language?: string;
}
export interface ScanResult {
    files: FileInfo[];
    totalFiles: number;
    totalSize: number;
    byType: Record<string, number>;
    byLanguage: Record<string, number>;
    scanDuration: number;
}
export interface IFileFilter {
    shouldInclude(filePath: string, fileName: string, stats: any): boolean;
    getFilterName(): string;
}
export interface IFileTypeDetector {
    detectType(filePath: string, extension: string): string;
    detectLanguage(filePath: string, extension: string): string | undefined;
}
export interface IDirectoryScanner {
    scan(rootPath: string, filters: IFileFilter[]): Promise<ScanResult>;
}
//# sourceMappingURL=file-scanner-interfaces.d.ts.map