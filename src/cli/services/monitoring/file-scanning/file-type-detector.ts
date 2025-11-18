/**
 * File Type Detector - Single Responsibility Principle
 * Detects file types and languages based on extensions and configuration
 */

import * as path from 'path';
import { IFileTypeDetector } from './file-scanner-interfaces';
import { ConfigurableExclusionFilter } from './configurable-exclusion-filter';

export class FileTypeDetector implements IFileTypeDetector {
  private filter: ConfigurableExclusionFilter;
  private typeMapping: Record<string, string[]>;
  private languageMapping: Record<string, string>;

  constructor(configPath?: string) {
    this.filter = new ConfigurableExclusionFilter(configPath);
    const config = this.filter.getConfig();
    this.typeMapping = config.typeMapping;
    this.languageMapping = config.languageMapping;
  }

  detectType(filePath: string, extension: string): string {
    const cleanExt = extension.toLowerCase().replace('.', '');

    // Check each type mapping
    for (const [type, extensions] of Object.entries(this.typeMapping)) {
      if (extensions.includes(cleanExt)) {
        return type;
      }
    }

    // Special cases
    if (this.isConfigFile(filePath, cleanExt)) {
      return 'config';
    }

    if (this.isDocumentationFile(filePath, cleanExt)) {
      return 'documentation';
    }

    return 'other';
  }

  detectLanguage(filePath: string, extension: string): string | undefined {
    const cleanExt = extension.toLowerCase().replace('.', '');
    return this.languageMapping[cleanExt];
  }

  private isConfigFile(filePath: string, extension: string): boolean {
    const fileName = path.basename(filePath).toLowerCase();
    const configFiles = [
      'package.json', 'tsconfig.json', 'webpack.config.js',
      'babel.config.js', 'rollup.config.js', 'vite.config.ts',
      'jest.config.js', 'cypress.config.js',
      'docker-compose.yml', 'dockerfile'
    ];

    return configFiles.includes(fileName) ||
           fileName.includes('config') ||
           fileName.includes('settings') ||
           extension === 'ini' ||
           extension === 'cfg' ||
           extension === 'conf';
  }

  private isDocumentationFile(filePath: string, extension: string): boolean {
    const fileName = path.basename(filePath).toLowerCase();
    const docFiles = [
      'readme', 'license', 'changelog', 'contributing',
      'authors', 'contributors', 'history', 'news'
    ];

    return docFiles.some(docFile => fileName.startsWith(docFile)) ||
           extension === 'md' ||
           extension === 'txt' ||
           extension === 'rst';
  }

  // Allow runtime configuration updates
  updateConfig(configPath?: string): void {
    this.filter.reloadConfig(configPath);
    const config = this.filter.getConfig();
    this.typeMapping = config.typeMapping;
    this.languageMapping = config.languageMapping;
  }
}