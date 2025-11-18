/**
 * Directory Scanner - Single Responsibility Principle + Dependency Inversion
 * Scans directories using configurable filters (depends on abstractions)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { IDirectoryScanner, IFileFilter, FileInfo, ScanResult } from './file-scanner-interfaces';
import { FileTypeDetector } from './file-type-detector';

export class DirectoryScanner implements IDirectoryScanner {
  private typeDetector: FileTypeDetector;

  constructor(configPath?: string) {
    this.typeDetector = new FileTypeDetector(configPath);
  }

  async scan(rootPath: string, filters: IFileFilter[]): Promise<ScanResult> {
    const startTime = Date.now();
    const files: FileInfo[] = [];
    const byType: Record<string, number> = {};
    const byLanguage: Record<string, number> = {};
    let totalSize = 0;

    try {
      await this.scanDirectory(rootPath, rootPath, files, filters, byType, byLanguage);

      // Calculate total size
      totalSize = files.reduce((sum, file) => sum + file.size, 0);

      return {
        files,
        totalFiles: files.length,
        totalSize,
        byType,
        byLanguage,
        scanDuration: Date.now() - startTime
      };
    } catch (error) {
      throw new Error(`Failed to scan directory ${rootPath}: ${error.message}`);
    }
  }

  private async scanDirectory(
    dirPath: string,
    rootPath: string,
    files: FileInfo[],
    filters: IFileFilter[],
    byType: Record<string, number>,
    byLanguage: Record<string, number>
  ): Promise<void> {
    let entries;

    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch (error) {
      // Skip directories we can't read (permission issues, etc.)
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(rootPath, fullPath);

      if (entry.isDirectory()) {
        // Check if directory should be excluded
        const shouldIncludeDir = filters.every(filter =>
          filter.shouldInclude(fullPath, entry.name, { isDirectory: true })
        );

        if (shouldIncludeDir) {
          await this.scanDirectory(fullPath, rootPath, files, filters, byType, byLanguage);
        }
      } else if (entry.isFile()) {
        try {
          const stats = await fs.stat(fullPath);

          // Apply all filters
          const shouldInclude = filters.every(filter =>
            filter.shouldInclude(fullPath, entry.name, stats)
          );

          if (shouldInclude) {
            const extension = path.extname(entry.name);
            const fileType = this.typeDetector.detectType(fullPath, extension);
            const language = this.typeDetector.detectLanguage(fullPath, extension);

            const fileInfo: FileInfo = {
              path: fullPath,
              relativePath,
              name: entry.name,
              extension,
              size: stats.size,
              type: fileType as any,
              language
            };

            files.push(fileInfo);

            // Update statistics
            byType[fileType] = (byType[fileType] || 0) + 1;
            if (language) {
              byLanguage[language] = (byLanguage[language] || 0) + 1;
            }
          }
        } catch (error) {
          // Skip files we can't stat (permission issues, etc.)
          continue;
        }
      }
    }
  }
}