"use strict";
/**
 * File System Helper utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileSystemHelper = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const logger_1 = require("./logger");
class FileSystemHelper {
    logger;
    constructor(logger) {
        this.logger = logger || new logger_1.Logger();
    }
    async getAllFiles(directory, extensions) {
        const files = [];
        const resolvedDir = (0, path_1.resolve)(directory);
        try {
            await this.collectFiles(resolvedDir, files, extensions);
            return files.sort(); // Return sorted for consistent ordering
        }
        catch (error) {
            this.logger.error(`Failed to get files from directory: ${directory}`, error);
            throw error;
        }
    }
    async collectFiles(directory, files, extensions) {
        let entries;
        try {
            entries = await fs_1.promises.readdir(directory);
        }
        catch (error) {
            this.logger.warn(`Cannot read directory: ${directory}`, { error });
            return;
        }
        for (const entry of entries) {
            const fullPath = (0, path_1.join)(directory, entry);
            try {
                const stats = await fs_1.promises.stat(fullPath);
                if (stats.isDirectory()) {
                    // Skip common excluded directories
                    if (this.shouldSkipDirectory(entry)) {
                        continue;
                    }
                    await this.collectFiles(fullPath, files, extensions);
                }
                else if (stats.isFile()) {
                    // Check file extension if specified
                    if (extensions && extensions.length > 0) {
                        const ext = (0, path_1.extname)(entry).toLowerCase();
                        if (extensions.includes(ext) || extensions.includes(ext.slice(1))) {
                            files.push(fullPath);
                        }
                    }
                    else {
                        files.push(fullPath);
                    }
                }
            }
            catch (error) {
                this.logger.warn(`Cannot stat path: ${fullPath}`, { error });
                continue;
            }
        }
    }
    shouldSkipDirectory(dirName) {
        const excludedDirs = [
            'node_modules',
            '.git',
            '.svn',
            '.hg',
            'dist',
            'build',
            'out',
            '.next',
            '.cache',
            'coverage',
            '.nyc_output',
            '__pycache__',
            '.pytest_cache',
            'vendor',
            'target',
            'bin',
            'obj'
        ];
        return excludedDirs.includes(dirName) || dirName.startsWith('.');
    }
    async getFileContent(filePath) {
        try {
            const resolvedPath = (0, path_1.resolve)(filePath);
            return await fs_1.promises.readFile(resolvedPath, 'utf8');
        }
        catch (error) {
            this.logger.error(`Failed to read file: ${filePath}`, error);
            throw error;
        }
    }
    async getFileStats(filePath) {
        try {
            const resolvedPath = (0, path_1.resolve)(filePath);
            return await fs_1.promises.stat(resolvedPath);
        }
        catch (error) {
            this.logger.error(`Failed to get file stats: ${filePath}`, error);
            throw error;
        }
    }
    async fileExists(filePath) {
        try {
            const resolvedPath = (0, path_1.resolve)(filePath);
            await fs_1.promises.access(resolvedPath, fs_1.constants.F_OK);
            return true;
        }
        catch {
            return false;
        }
    }
    async createDirectory(directoryPath) {
        try {
            const resolvedPath = (0, path_1.resolve)(directoryPath);
            await fs_1.promises.mkdir(resolvedPath, { recursive: true });
        }
        catch (error) {
            this.logger.error(`Failed to create directory: ${directoryPath}`, error);
            throw error;
        }
    }
    async writeFile(filePath, content) {
        try {
            const resolvedPath = (0, path_1.resolve)(filePath);
            // Ensure directory exists
            const dir = (0, path_1.resolve)(resolvedPath, '..');
            await this.createDirectory(dir);
            await fs_1.promises.writeFile(resolvedPath, content, 'utf8');
        }
        catch (error) {
            this.logger.error(`Failed to write file: ${filePath}`, error);
            throw error;
        }
    }
    async getFileSize(filePath) {
        const stats = await this.getFileStats(filePath);
        return stats.size;
    }
    async isDirectory(path) {
        try {
            const stats = await this.getFileStats(path);
            return stats.isDirectory();
        }
        catch {
            return false;
        }
    }
    async isFile(path) {
        try {
            const stats = await this.getFileStats(path);
            return stats.isFile();
        }
        catch {
            return false;
        }
    }
    getFileExtension(filePath) {
        return (0, path_1.extname)(filePath).toLowerCase();
    }
    getFileName(filePath) {
        const parts = filePath.split(/[/\\]/);
        return parts[parts.length - 1] || '';
    }
    getFileNameWithoutExtension(filePath) {
        const fileName = this.getFileName(filePath);
        const ext = (0, path_1.extname)(fileName);
        return ext ? fileName.slice(0, -ext.length) : fileName;
    }
    joinPath(...paths) {
        return (0, path_1.join)(...paths);
    }
    resolvePath(...paths) {
        return (0, path_1.resolve)(...paths);
    }
    // Check if file is likely a text file based on extension
    isTextFile(filePath) {
        const textExtensions = [
            '.txt', '.md', '.json', '.xml', '.yaml', '.yml', '.ini', '.cfg', '.conf',
            '.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte',
            '.py', '.java', '.c', '.cpp', '.cs', '.go', '.rs', '.php', '.rb',
            '.html', '.htm', '.css', '.scss', '.sass', '.less',
            '.sql', '.sh', '.bash', '.bat', '.ps1',
            '.log', '.csv', '.tsv'
        ];
        const ext = this.getFileExtension(filePath);
        return textExtensions.includes(ext);
    }
    // Get relative path from base directory
    getRelativePath(from, to) {
        const { relative } = require('path');
        return relative(from, to);
    }
    // Check if file is within directory
    isWithinDirectory(filePath, directory) {
        const resolvedFile = (0, path_1.resolve)(filePath);
        const resolvedDir = (0, path_1.resolve)(directory);
        return resolvedFile.startsWith(resolvedDir);
    }
}
exports.FileSystemHelper = FileSystemHelper;
//# sourceMappingURL=file-system.js.map