/**
 * Intelligent Cycle Features
 * SOLID Principles: Dependency Inversion - Coordinator depends on abstractions
 * Enhanced cycle validation features that use semantic search and AI-powered analysis
 * to provide intelligent, proactive feedback during development.
 */

import { Logger } from './logger';
import SemanticGraphService from '../cli/services/data/semantic-graph/semantic-graph';
import {
  SemanticDeduplicationResult,
  ExistingImplementation,
  IntentAnalysisResult,
  SmartSecurityResult,
  SecurityVulnerability,
  SecurityPattern,
  ISemanticDeduplicationService,
  IIntentAnalysisService,
  ISimilarityMatchingService,
  ISecurityScanningService,
  ICodeExtractionService
} from './intelligent-cycle/interfaces';
import { SemanticDeduplicationService } from './intelligent-cycle/services/semantic-deduplication-service';
import { IntentAnalysisService } from './intelligent-cycle/services/intent-analysis-service';
import { SimilarityMatchingService } from './intelligent-cycle/services/similarity-matching-service';
import { SecurityScanningService } from './intelligent-cycle/services/security-scanning-service';
import { CodeExtractionService } from './intelligent-cycle/services/code-extraction-service';

// Re-export interfaces for backward compatibility
export {
  SemanticDeduplicationResult,
  ExistingImplementation,
  IntentAnalysisResult,
  SmartSecurityResult,
  SecurityVulnerability,
  SecurityPattern
};

export class IntelligentCycleFeatures {
  private logger: Logger;
  private semanticGraph: SemanticGraphService;
  private initialized = false;

  constructor(
    private semanticDeduplicationService?: ISemanticDeduplicationService,
    private intentAnalysisService?: IIntentAnalysisService,
    private similarityMatchingService?: ISimilarityMatchingService,
    private securityScanningService?: ISecurityScanningService,
    private codeExtractionService?: ICodeExtractionService
  ) {
    this.logger = Logger.getInstance();
    this.semanticGraph = new SemanticGraphService();

    // Initialize services with dependency injection
    this.similarityMatchingService = this.similarityMatchingService || new SimilarityMatchingService();
    this.intentAnalysisService = this.intentAnalysisService || new IntentAnalysisService();
    this.semanticDeduplicationService = this.semanticDeduplicationService || new SemanticDeduplicationService(
      this.intentAnalysisService,
      this.similarityMatchingService
    );
    this.securityScanningService = this.securityScanningService || new SecurityScanningService();
    this.codeExtractionService = this.codeExtractionService || new CodeExtractionService();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.semanticGraph.initialize();
      this.initialized = true;
      this.logger.info('🧠 Intelligent cycle features initialized');
    } catch (error) {
      this.logger.warn('⚠️ Semantic features unavailable, using fallback methods');
      // Continue without semantic features
      this.initialized = true;
    }
  }

  /**
   * Semantic-Powered Deduplication
   * Uses semantic search to find existing implementations before creating new code
   */
  async checkSemanticDuplication(
    projectPath: string,
    userIntent: string,
    changedFiles?: string[]
  ): Promise<SemanticDeduplicationResult> {
    await this.initialize();

    // Delegate to semantic deduplication service
    return this.semanticDeduplicationService!.checkSemanticDuplication(
      userIntent, // functionality parameter
      userIntent, // userIntent parameter
      projectPath,
      changedFiles ? changedFiles.join(',') : undefined // cacheKey
    );
  }

  /**
   * Analyze user intent from their request
   */
  async analyzeUserIntent(userIntent: string): Promise<IntentAnalysisResult> {
    // Delegate to intent analysis service
    return this.intentAnalysisService!.analyzeUserIntent(userIntent);
  }

  /**
   * Smart Security Analysis
   * Enhanced security checking with context-aware vulnerability detection
   */
  async performSmartSecurity(
    projectPath: string,
    changedFiles: string[],
    userIntent: string
  ): Promise<SmartSecurityResult> {
    // Delegate to security scanning service
    return this.securityScanningService!.performSmartSecurity(
      userIntent, // functionality parameter
      userIntent,
      projectPath
    );
  }

  /**
   * Extract code snippet from file (backward compatibility method)
   */
  private async extractCodeSnippet(
    file: string,
    startLine: number,
    endLine: number
  ): Promise<string> {
    // Delegate to code extraction service
    return this.codeExtractionService!.extractCodeSnippet(
      file,
      undefined, // functionName
      undefined, // className
      { start: startLine, end: endLine }
    );
  }

  // Additional method for validation cycle compatibility
  async performSemanticDeduplication(
    userIntent: string,
    projectPath: string,
    language?: string
  ): Promise<SemanticDeduplicationResult> {
    return this.checkSemanticDuplication(projectPath, userIntent, language ? [language] : undefined);
  }
}

export default IntelligentCycleFeatures;