"use strict";
/**
 * Project File Scanner - Facade Pattern + Dependency Injection
 * Main entry point that orchestrates all scanning components
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectFileScanner = void 0;
const directory_scanner_1 = require("./directory-scanner");
const configurable_exclusion_filter_1 = require("./configurable-exclusion-filter");
class ProjectFileScanner {
    scanner;
    defaultFilters;
    constructor(configPath) {
        this.scanner = new directory_scanner_1.DirectoryScanner(configPath);
        this.defaultFilters = [
            new configurable_exclusion_filter_1.ConfigurableExclusionFilter(configPath)
        ];
    }
    /**
     * Scan a project directory with default filters
     */
    async scanProject(projectPath) {
        return this.scanner.scan(projectPath, this.defaultFilters);
    }
    /**
     * Scan with custom filters (Open/Closed Principle)
     */
    async scanWithCustomFilters(projectPath, additionalFilters) {
        const allFilters = [...this.defaultFilters, ...additionalFilters];
        return this.scanner.scan(projectPath, allFilters);
    }
    /**
     * Add a custom filter at runtime (Liskov Substitution Principle)
     */
    addFilter(filter) {
        this.defaultFilters.push(filter);
    }
    /**
     * Remove a filter by name
     */
    removeFilter(filterName) {
        this.defaultFilters = this.defaultFilters.filter(filter => filter.getFilterName() !== filterName);
    }
    /**
     * Get current filters
     */
    getFilters() {
        return [...this.defaultFilters];
    }
}
exports.ProjectFileScanner = ProjectFileScanner;
//# sourceMappingURL=project-file-scanner.js.map