/**
 * Project File Scanner - Facade Pattern + Dependency Injection
 * Main entry point that orchestrates all scanning components
 */

import { IDirectoryScanner, IFileFilter, ScanResult } from './file-scanner-interfaces';
import { DirectoryScanner } from './directory-scanner';
import { ConfigurableExclusionFilter } from './configurable-exclusion-filter';

export class ProjectFileScanner {
  private scanner: IDirectoryScanner;
  private defaultFilters: IFileFilter[];

  constructor(configPath?: string) {
    this.scanner = new DirectoryScanner(configPath);
    this.defaultFilters = [
      new ConfigurableExclusionFilter(configPath)
    ];
  }

  /**
   * Scan a project directory with default filters
   */
  async scanProject(projectPath: string): Promise<ScanResult> {
    return this.scanner.scan(projectPath, this.defaultFilters);
  }

  /**
   * Scan with custom filters (Open/Closed Principle)
   */
  async scanWithCustomFilters(projectPath: string, additionalFilters: IFileFilter[]): Promise<ScanResult> {
    const allFilters = [...this.defaultFilters, ...additionalFilters];
    return this.scanner.scan(projectPath, allFilters);
  }

  /**
   * Add a custom filter at runtime (Liskov Substitution Principle)
   */
  addFilter(filter: IFileFilter): void {
    this.defaultFilters.push(filter);
  }

  /**
   * Remove a filter by name
   */
  removeFilter(filterName: string): void {
    this.defaultFilters = this.defaultFilters.filter(
      filter => filter.getFilterName() !== filterName
    );
  }

  /**
   * Get current filters
   */
  getFilters(): IFileFilter[] {
    return [...this.defaultFilters];
  }
}