/**
 * Configurable Exclusion Filter - Open/Closed Principle
 * Externalized configuration allows users to modify rules without code changes
 */

import * as fs from 'fs';
import * as path from 'path';
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

export class ConfigurableExclusionFilter implements IFileFilter {
  private config: FilterConfig;
  private excludedDirectories: Set<string>;
  private excludedExtensions: Set<string>;
  private excludedFileNames: Set<string>;
  private importantDotFiles: Set<string>;

  constructor(configPath?: string) {
    this.loadConfig(configPath);
    this.initializeSets();
  }

  private loadConfig(configPath?: string): void {
    const defaultConfigPath = path.join(__dirname, 'file-scanner-config.json');
    const finalConfigPath = configPath || defaultConfigPath;

    try {
      const configContent = fs.readFileSync(finalConfigPath, 'utf8');
      this.config = JSON.parse(configContent);
    } catch (error) {
      console.warn(`Warning: Could not load scanner config from ${finalConfigPath}, using defaults`);
      this.config = this.getDefaultConfig();
    }
  }

  private initializeSets(): void {
    this.excludedDirectories = new Set(this.config.exclusions.directories);
    this.excludedExtensions = new Set(this.config.exclusions.extensions);
    this.excludedFileNames = new Set(this.config.exclusions.fileNames);
    this.importantDotFiles = new Set(this.config.inclusions.importantDotFiles);
  }

  private getDefaultConfig(): FilterConfig {
    return {
      scanning: {
        maxFileSize: 10485760, // 10MB
        maxFiles: 10000,
        followSymlinks: false
      },
      exclusions: {
        directories: ['node_modules', 'vendor', '.git', 'dist', 'build'],
        extensions: ['.exe', '.dll', '.jpg', '.png', '.zip'],
        fileNames: ['package-lock.json', 'yarn.lock']
      },
      inclusions: {
        sourceExtensions: ['.ts', '.js', '.py', '.java'],
        configExtensions: ['.json', '.yaml', '.yml'],
        documentationExtensions: ['.md', '.txt'],
        templateExtensions: ['.html', '.css'],
        scriptExtensions: ['.sh', '.bat'],
        schemaExtensions: ['.sql'],
        importantDotFiles: ['.env', '.gitignore', '.editorconfig']
      },
      typeMapping: {
        source: ['ts', 'js', 'py', 'java'],
        config: ['json', 'yaml', 'yml'],
        documentation: ['md', 'txt'],
        template: ['html', 'css'],
        script: ['sh', 'bat'],
        schema: ['sql']
      },
      languageMapping: {
        ts: 'TypeScript',
        js: 'JavaScript',
        py: 'Python',
        java: 'Java'
      }
    };
  }

  shouldInclude(filePath: string, fileName: string, stats: any): boolean {
    // Check file size limit
    if (stats.size > this.config.scanning.maxFileSize) {
      return false;
    }

    // Skip directories that are excluded
    if (this.containsExcludedDirectory(filePath)) {
      return false;
    }

    // Skip excluded file names
    if (this.excludedFileNames.has(fileName)) {
      return false;
    }

    // Skip excluded extensions
    const extension = this.getFileExtension(fileName);
    if (this.excludedExtensions.has(extension)) {
      return false;
    }

    // Handle dot files - only include important ones
    if (fileName.startsWith('.') && !this.isImportantDotFile(fileName)) {
      return false;
    }

    return true;
  }

  private containsExcludedDirectory(filePath: string): boolean {
    const pathParts = filePath.split(/[/\\]/);
    return pathParts.some(part => this.excludedDirectories.has(part));
  }

  private getFileExtension(fileName: string): string {
    const lastDot = fileName.lastIndexOf('.');
    return lastDot === -1 ? '' : fileName.substring(lastDot).toLowerCase();
  }

  private isImportantDotFile(fileName: string): boolean {
    return Array.from(this.importantDotFiles).some(pattern =>
      fileName === pattern || fileName.startsWith(pattern + '.')
    );
  }

  getFilterName(): string {
    return 'ConfigurableExclusionFilter';
  }

  // Public method to reload configuration at runtime
  reloadConfig(configPath?: string): void {
    this.loadConfig(configPath);
    this.initializeSets();
  }

  // Public method to get current configuration
  getConfig(): FilterConfig {
    return { ...this.config };
  }
}