/**
 * File System Helper utilities
 */
import { Stats } from 'fs';
import { FileSystemHelper as IFileSystemHelper } from '../core/interfaces';
import { Logger } from './logger';
export declare class FileSystemHelper implements IFileSystemHelper {
    private logger;
    constructor(logger?: Logger);
    getAllFiles(directory: string, extensions?: string[]): Promise<string[]>;
    private collectFiles;
    private shouldSkipDirectory;
    getFileContent(filePath: string): Promise<string>;
    getFileStats(filePath: string): Promise<Stats>;
    fileExists(filePath: string): Promise<boolean>;
    createDirectory(directoryPath: string): Promise<void>;
    writeFile(filePath: string, content: string): Promise<void>;
    getFileSize(filePath: string): Promise<number>;
    isDirectory(path: string): Promise<boolean>;
    isFile(path: string): Promise<boolean>;
    getFileExtension(filePath: string): string;
    getFileName(filePath: string): string;
    getFileNameWithoutExtension(filePath: string): string;
    joinPath(...paths: string[]): string;
    resolvePath(...paths: string[]): string;
    isTextFile(filePath: string): boolean;
    getRelativePath(from: string, to: string): string;
    isWithinDirectory(filePath: string, directory: string): boolean;
}
//# sourceMappingURL=file-system.d.ts.map