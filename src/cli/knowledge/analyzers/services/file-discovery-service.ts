/**
 * File Discovery Service
 * SOLID Principles: Single Responsibility - Handle file discovery and loading
 */

import * as fs from 'fs/promises';
import { glob } from 'fast-glob';
import { Logger } from '../../../../utils/logger';
import { IFileDiscoveryService, SemanticAnalysisConfig } from '../interfaces';

export class FileDiscoveryService implements IFileDiscoveryService {
  private logger = Logger.getInstance();

  constructor(private config: SemanticAnalysisConfig) {}

  async discoverFiles(): Promise<string[]> {
    const patterns = this.config.includeTests
      ? this.config.filePatterns
      : this.config.filePatterns?.filter(p => !p?.includes('test') && !p?.includes('spec'));

    const files = await glob(patterns, {
      cwd: this.config.projectPath,
      absolute: true,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**']
    });

    this.logger.info(`Discovered ${files.length} files for semantic analysis`);
    return files;
  }

  async loadFileContents(files: string[]): Promise<Map<string, string>> {
    const fileContents = new Map<string, string>();

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        fileContents.set(filePath, content);
      } catch (error) {
        this.logger.warn(`Failed to load file: ${filePath}`, error);
      }
    }

    this.logger.info(`Loaded content for ${fileContents.size}/${files.length} files`);
    return fileContents;
  }

  getFilesByLanguage(files: string[]): Map<string, string[]> {
    const filesByLanguage = new Map<string, string[]>();

    for (const file of files) {
      const language = this.getLanguageFromPath(file);
      if (!filesByLanguage.has(language)) {
        filesByLanguage.set(language, []);
      }
      filesByLanguage.get(language)!.push(file);
    }

    return filesByLanguage;
  }

  private getLanguageFromPath(filePath: string): string {
    const ext = filePath.toLowerCase().split('.').pop() || '';

    switch (ext) {
      case 'ts': case 'tsx': return 'typescript';
      case 'js': case 'jsx': return 'javascript';
      case 'py': return 'python';
      case 'java': return 'java';
      case 'cpp': case 'cc': case 'cxx': return 'cpp';
      case 'c': return 'c';
      case 'cs': return 'csharp';
      case 'go': return 'go';
      case 'rs': return 'rust';
      case 'php': return 'php';
      case 'rb': return 'ruby';
      default: return 'unknown';
    }
  }
}