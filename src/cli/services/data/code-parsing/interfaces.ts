/**
 * Code Parsing Interfaces
 * Shared types for code analysis and relationship parsing
 */

import { RelationshipType } from '../semantic-graph/semantic-graph';

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
  implementsInterfaces: string[];
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