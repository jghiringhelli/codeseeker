/**
 * File Type Detector - Single Responsibility Principle
 * Detects file types and languages based on extensions and configuration
 */
import { IFileTypeDetector } from './file-scanner-interfaces';
export declare class FileTypeDetector implements IFileTypeDetector {
    private filter;
    private typeMapping;
    private languageMapping;
    constructor(configPath?: string);
    detectType(filePath: string, extension: string): string;
    detectLanguage(filePath: string, extension: string): string | undefined;
    private isConfigFile;
    private isDocumentationFile;
    updateConfig(configPath?: string): void;
}
//# sourceMappingURL=file-type-detector.d.ts.map