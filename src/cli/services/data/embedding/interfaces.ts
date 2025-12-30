/**
 * Embedding Service Interfaces
 * SOLID Principles: Interface Segregation
 */

import { DatabaseConnections } from '../../../../config/database-config';

export interface EmbeddingConfig {
  provider?: 'xenova' | 'openai' | 'local' | 'hybrid';
  openaiApiKey?: string;
  model?: 'Xenova/all-MiniLM-L6-v2' | 'text-embedding-ada-002' | 'text-embedding-3-small' | 'text-embedding-3-large' | 'local';
  chunkSize?: number;
  maxTokens?: number;
  batchSize?: number;
  granularMode?: boolean; // Enable method/class level embeddings
}

export interface FileEmbedding {
  filePath: string;
  content: string;
  hash: string;
  embedding: number[];
  metadata: {
    language: string;
    size: number;
    lines: number;
    functions: string[];
    classes: string[];
    imports: string[];
    exports: string[];
  };
}

export interface MethodEmbedding {
  methodId: string; // Unique identifier: file:class:method
  className?: string;
  methodName: string;
  filePath: string;
  content: string; // The actual method code
  signature: string; // Method signature
  parameters: Array<{ name: string; type?: string; }>;
  returnType?: string;
  embedding: number[];
  hash: string; // Content hash for change detection
  metadata: {
    language: string;
    complexity?: number;
    linesOfCode: number;
    visibility: 'public' | 'private' | 'protected';
    isStatic?: boolean;
    isAsync?: boolean;
  };
}

export interface ClassEmbedding {
  classId: string; // Unique identifier: file:class
  className: string;
  filePath: string;
  content: string; // The entire class code
  methods: string[]; // Array of method names
  properties: string[]; // Array of property names
  extends?: string; // Parent class
  implements?: string[]; // Implemented interfaces
  embedding: number[];
  hash: string;
  metadata: {
    language: string;
    complexity?: number;
    linesOfCode: number;
    visibility: 'public' | 'private' | 'protected';
    isAbstract?: boolean;
    isInterface?: boolean;
  };
}

export interface EmbeddingResult {
  embeddings: number;
  errors: number;
  methodEmbeddings?: number;
  classEmbeddings?: number;
}

// Service Interfaces (SOLID: Interface Segregation)
export interface IEmbeddingProvider {
  initialize(): Promise<void>;
  generateEmbedding(text: string, context?: string): Promise<number[]>;
  canHandle(model: string): boolean;
  cleanup?: () => Promise<void>;
}

export interface IFileProcessor {
  processFiles(projectPath: string, files: string[]): Promise<FileEmbedding[]>;
  generateFileEmbedding(filePath: string, projectPath: string): Promise<FileEmbedding>;
}

export interface IGranularProcessor {
  generateGranularEmbeddings(projectPath: string, files: string[]): Promise<{
    classEmbeddings: ClassEmbedding[];
    methodEmbeddings: MethodEmbedding[];
  }>;
  generateClassEmbedding(parsedFile: any, classInfo: any): Promise<ClassEmbedding>;
  generateMethodEmbedding(parsedFile: any, classInfo: any, methodInfo: any): Promise<MethodEmbedding>;
}

export interface IEmbeddingDatabase {
  initializeDatabase(dbConnections: DatabaseConnections): Promise<void>;
  saveFileEmbeddings(embeddings: FileEmbedding[]): Promise<void>;
  saveClassEmbeddings(embeddings: ClassEmbedding[]): Promise<void>;
  saveMethodEmbeddings(embeddings: MethodEmbedding[]): Promise<void>;
  findExistingEmbeddings(hashes: string[]): Promise<string[]>;
}

// Interfaces are already exported above