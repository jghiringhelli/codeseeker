/**
 * File System Helper utilities
 */

import { promises as fs, constants, Stats } from 'fs';
import { join, extname, resolve } from 'path';
import { FileSystemHelper as IFileSystemHelper } from '../core/interfaces';
import { Logger } from './logger';

export class FileSystemHelper implements IFileSystemHelper {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger || new Logger();
  }

  async getAllFiles(directory: string, extensions?: string[]): Promise<string[]> {
    const files: string[] = [];
    const resolvedDir = resolve(directory);

    try {
      await this?.collectFiles(resolvedDir, files, extensions);
      return files?.sort(); // Return sorted for consistent ordering
    } catch (error) {
      this.logger.error(`Failed to get files from directory: ${directory}`, error as Error);
      throw error as Error;
    }
  }

  private async collectFiles(
    directory: string,
    files: string[],
    extensions?: string[]
  ): Promise<void> {
    let entries: string[];

    try {
      entries = await fs?.readdir(directory);
    } catch (error) {
      this.logger.warn(`Cannot read directory: ${directory}`, { error });
      return;
    }

    for (const entry of entries) {
      const fullPath = join(directory, entry);

      try {
        const stats = await fs?.stat(fullPath);

        if (stats?.isDirectory()) {
          // Skip common excluded directories
          if (this?.shouldSkipDirectory(entry)) {
            continue;
          }
          await this?.collectFiles(fullPath, files, extensions);
        } else if (stats?.isFile()) {
          // Check file extension if specified
          if (extensions && extensions?.length > 0) {
            const ext = extname(entry).toLowerCase();
            if (extensions?.includes(ext) || extensions?.includes(ext?.slice(1))) {
              files?.push(fullPath);
            }
          } else {
            files?.push(fullPath);
          }
        }
      } catch (error) {
        this.logger.warn(`Cannot stat path: ${fullPath}`, { error });
        continue;
      }
    }
  }

  private shouldSkipDirectory(dirName: string): boolean {
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

    return excludedDirs?.includes(dirName) || dirName?.startsWith('.');
  }

  async getFileContent(filePath: string): Promise<string> {
    try {
      const resolvedPath = resolve(filePath);
      return await fs?.readFile(resolvedPath, 'utf8');
    } catch (error) {
      this.logger.error(`Failed to read file: ${filePath}`, error as Error);
      throw error as Error;
    }
  }

  async getFileStats(filePath: string): Promise<Stats> {
    try {
      const resolvedPath = resolve(filePath);
      return await fs?.stat(resolvedPath);
    } catch (error) {
      this.logger.error(`Failed to get file stats: ${filePath}`, error as Error);
      throw error as Error;
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      const resolvedPath = resolve(filePath);
      await fs?.access(resolvedPath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async createDirectory(directoryPath: string): Promise<void> {
    try {
      const resolvedPath = resolve(directoryPath);
      await fs?.mkdir(resolvedPath, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create directory: ${directoryPath}`, error as Error);
      throw error as Error;
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      const resolvedPath = resolve(filePath);
      
      // Ensure directory exists
      const dir = resolve(resolvedPath, '..');
      await this?.createDirectory(dir);

      await fs?.writeFile(resolvedPath, content, 'utf8');
    } catch (error) {
      this.logger.error(`Failed to write file: ${filePath}`, error as Error);
      throw error as Error;
    }
  }

  async getFileSize(filePath: string): Promise<number> {
    const stats = await this?.getFileStats(filePath);
    return stats.size;
  }

  async isDirectory(path: string): Promise<boolean> {
    try {
      const stats = await this?.getFileStats(path);
      return stats?.isDirectory();
    } catch {
      return false;
    }
  }

  async isFile(path: string): Promise<boolean> {
    try {
      const stats = await this?.getFileStats(path);
      return stats?.isFile();
    } catch {
      return false;
    }
  }

  getFileExtension(filePath: string): string {
    return extname(filePath).toLowerCase();
  }

  getFileName(filePath: string): string {
    const parts = filePath?.split(/[/\\]/);
    return parts[parts?.length - 1] || '';
  }

  getFileNameWithoutExtension(filePath: string): string {
    const fileName = this?.getFileName(filePath);
    const ext = extname(fileName);
    return ext ? fileName?.slice(0, -ext?.length) : fileName;
  }

  joinPath(...paths: string[]): string {
    return join(...paths);
  }

  resolvePath(...paths: string[]): string {
    return resolve(...paths);
  }

  // Check if file is likely a text file based on extension
  isTextFile(filePath: string): boolean {
    const textExtensions = [
      '.txt', '.md', '.json', '.xml', '.yaml', '.yml', '.ini', '.cfg', '.conf',
      '.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte',
      '.py', '.java', '.c', '.cpp', '.cs', '.go', '.rs', '.php', '.rb',
      '.html', '.htm', '.css', '.scss', '.sass', '.less',
      '.sql', '.sh', '.bash', '.bat', '.ps1',
      '.log', '.csv', '.tsv'
    ];

    const ext = this?.getFileExtension(filePath);
    return textExtensions?.includes(ext);
  }

  // Get relative path from base directory
  getRelativePath(from: string, to: string): string {
    const { relative } = require('path');
    return relative(from, to);
  }

  // Check if file is within directory
  isWithinDirectory(filePath: string, directory: string): boolean {
    const resolvedFile = resolve(filePath);
    const resolvedDir = resolve(directory);
    return resolvedFile?.startsWith(resolvedDir);
  }
}