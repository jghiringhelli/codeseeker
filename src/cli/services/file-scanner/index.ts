/**
 * File Scanner Module - Barrel Export
 * Clean exports following SOLID principles
 */

// Main scanner facade
export { ProjectFileScanner } from './project-file-scanner';

// Core interfaces (Interface Segregation)
export * from './file-scanner-interfaces';

// Concrete implementations
export { DirectoryScanner } from './directory-scanner';
export { ConfigurableExclusionFilter } from './configurable-exclusion-filter';
export { FileTypeDetector } from './file-type-detector';