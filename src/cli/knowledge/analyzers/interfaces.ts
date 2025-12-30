/**
 * Semantic Analyzer Interfaces
 * SOLID Principles: Interface Segregation
 */

import { KnowledgeNode, KnowledgeTriad } from '../graph/types';

export interface SemanticAnalysisConfig {
  projectPath: string;
  filePatterns: string[];
  includeTests: boolean;
  minConfidence: number;
  enableSemanticSimilarity: boolean;
  enablePatternDetection: boolean;
}

export interface AnalysisResult {
  nodesExtracted: number;
  triadsCreated: number;
  patterns: SemanticPattern[];
  insights: string[];
}

export interface SemanticPattern {
  name: string;
  type: string;
  confidence: number;
  nodes: string[];
  description: string;
}

// Service Interfaces (SOLID: Interface Segregation)
export interface IFileDiscoveryService {
  discoverFiles(): Promise<string[]>;
  loadFileContents(files: string[]): Promise<Map<string, string>>;
}

export interface IASTAnalysisService {
  analyzeFile(filePath: string, content: string): Promise<{ nodes: KnowledgeNode[]; metadata: any }>;
  getLanguageFromPath(filePath: string): string;
}

export interface INodeCreationService {
  createNodesFromAnalysis(analysis: any, filePath: string): Promise<KnowledgeNode[]>;
  extractNamespace(filePath: string): string;
  extractTags(entity: any): string[];
}

export interface ITriadCreationService {
  createMethodCallTriads(callerId: string, calls: string[], filePath: string): Promise<KnowledgeTriad[]>;
  createImportExportTriads(imports: any[], exports: any[], filePath: string): Promise<KnowledgeTriad[]>;
  createInheritanceTriads(parentId: string, childId: string, relationType: string): Promise<KnowledgeTriad[]>;
}

export interface IPatternDetectionService {
  detectSemanticSimilarities(nodes: KnowledgeNode[]): Promise<KnowledgeTriad[]>;
  detectSemanticPatterns(nodes: KnowledgeNode[], triads: KnowledgeTriad[]): Promise<SemanticPattern[]>;
}

export interface IAbstractionService {
  createAbstractions(nodes: KnowledgeNode[], triads: KnowledgeTriad[]): Promise<KnowledgeNode[]>;
}

// SemanticAnalysisConfig is already exported above