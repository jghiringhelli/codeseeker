/**
 * Code Parsing Service Interfaces
 * SOLID Principles: Interface Segregation - Specific interfaces for each parsing concern
 */

import { RelationshipType } from '../../semantic-graph/semantic-graph';

export interface ParsedMethod {
  name: string;
  visibility: 'public' | 'private' | 'protected';
  isStatic: boolean;
  isAsync: boolean;
  parameters: Array<{ name: string; type?: string; }>;
  returnType?: string;
  startLine: number;
  endLine: number;
  complexity: number;
  callsTo: string[];
}

export interface ParsedClass {
  name: string;
  extends?: string;
  implements: string[];
  methods: ParsedMethod[];
  properties: Array<{ name: string; type?: string; visibility: string; }>;
  startLine: number;
  endLine: number;
}

export interface ParsedFunction {
  name: string;
  isAsync: boolean;
  parameters: Array<{ name: string; type?: string; }>;
  returnType?: string;
  startLine: number;
  endLine: number;
  complexity: number;
  callsTo: string[];
}

export interface ParsedFile {
  filePath: string;
  language: string;
  exports: string[];
  imports: Array<{ name: string; from: string; }>;
  classes: ParsedClass[];
  functions: ParsedFunction[];
  interfaces: string[];
  dependencies: string[];
  constants: Array<{ name: string; type?: string; }>;
  enums: Array<{ name: string; values: string[]; }>;
}

export interface ProjectStructure {
  files: ParsedFile[];
  relationships: Array<{
    fromFile: string;
    toFile: string;
    type: RelationshipType;
    metadata: any;
  }>;
}

// Service Interfaces (SOLID: Interface Segregation)
export interface IFileParsingService {
  parseCodeFile(filePath: string, relativePath: string): Promise<ParsedFile>;
  parseJavaScriptFile(content: string, filePath: string, language: string): ParsedFile;
  parseTypeScriptFile(content: string, filePath: string): ParsedFile;
}

export interface IProjectStructureService {
  parseProjectStructure(projectPath: string): Promise<ProjectStructure>;
  analyzeRelationships(files: ParsedFile[]): Array<{
    fromFile: string;
    toFile: string;
    type: RelationshipType;
    metadata: any;
  }>;
  analyzeArchitecturalPatterns(structure: ProjectStructure): {
    patterns: string[];
    layered: boolean;
    modular: boolean;
    suggestions: string[];
  };
}

export interface IGraphPopulationService {
  createGraphNodes(structure: ProjectStructure, projectId: string): Promise<Map<string, string>>;
  createGraphRelationships(
    structure: ProjectStructure,
    nodeIdMap: Map<string, string>,
    projectId: string
  ): Promise<void>;
  extractBusinessConcepts(structure: ProjectStructure, projectId: string): Promise<void>;
}