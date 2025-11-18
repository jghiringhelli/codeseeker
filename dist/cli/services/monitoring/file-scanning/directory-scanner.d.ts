/**
 * Directory Scanner - Single Responsibility Principle + Dependency Inversion
 * Scans directories using configurable filters (depends on abstractions)
 */
import { IDirectoryScanner, IFileFilter, ScanResult } from './file-scanner-interfaces';
export declare class DirectoryScanner implements IDirectoryScanner {
    private typeDetector;
    constructor(configPath?: string);
    scan(rootPath: string, filters: IFileFilter[]): Promise<ScanResult>;
    private scanDirectory;
}
//# sourceMappingURL=directory-scanner.d.ts.map