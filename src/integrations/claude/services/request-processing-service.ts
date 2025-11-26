/**
 * Request Processing Service
 * SOLID Principles: Single Responsibility - Handle request processing and coordination only
 */

import { Logger } from '../../../utils/logger';
import {
  IRequestProcessingService,
  IClaudeExecutionService,
  IPromptProcessingService,
  IContextBuilderService,
  ISessionManagementService,
  ClaudeCodeOptions,
  ClaudeCodeResponse
} from '../interfaces/index';

export class RequestProcessingService implements IRequestProcessingService {
  private logger = Logger.getInstance();

  constructor(
    private executionService: IClaudeExecutionService,
    private promptService: IPromptProcessingService,
    private contextBuilder: IContextBuilderService,
    private sessionManager: ISessionManagementService
  ) {}

  async processRequest(
    userRequest: string,
    projectPath: string,
    options: ClaudeCodeOptions = {}
  ): Promise<ClaudeCodeResponse> {
    const startTime = Date.now();

    try {
      this.logger.info(`🔄 Processing user request for project: ${projectPath}`);

      // Validate request
      const validation = this.validateRequest(userRequest);
      if (!validation.valid) {
        return {
          success: false,
          error: `Invalid request: ${validation.error}`
        };
      }

      // Sanitize input
      const sanitizedRequest = this.sanitizeInput(userRequest);

      // Get or create session
      const sessionId = await this.sessionManager.getSessionForProject(projectPath);

      // Build context
      const context = await this.contextBuilder.buildRequestContext(sanitizedRequest, projectPath);

      // Process prompt (handle large prompts)
      const promptResult = await this.promptService.processLargePrompt(
        sanitizedRequest,
        projectPath,
        sanitizedRequest
      );

      if (!promptResult.success) {
        return {
          success: false,
          error: `Prompt processing failed: ${promptResult.error}`,
          tokensUsed: promptResult.tokensUsed
        };
      }

      // Execute with Claude Code
      const response = await this.executionService.executeClaudeCode(
        promptResult.finalPrompt,
        context,
        {
          ...options,
          projectPath,
          resumeToken: options.resumeToken
        }
      );

      // Calculate total tokens used
      const totalTokens = (response.tokensUsed || 0) + promptResult.tokensUsed;

      const processingTime = Date.now() - startTime;
      this.logger.info(`✅ Request processed in ${processingTime}ms, tokens: ${totalTokens}`);

      return {
        ...response,
        tokensUsed: totalTokens
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`❌ Request processing failed after ${processingTime}ms:`, error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Request processing failed'
      };
    }
  }

  validateRequest(request: string): { valid: boolean; error?: string } {
    try {
      // Check if request is empty
      if (!request || request.trim().length === 0) {
        return { valid: false, error: 'Request cannot be empty' };
      }

      // Check minimum length
      if (request.trim().length < 3) {
        return { valid: false, error: 'Request too short (minimum 3 characters)' };
      }

      // Check maximum length
      if (request.length > 50000) {
        return { valid: false, error: 'Request too long (maximum 50,000 characters)' };
      }

      // Check for potentially malicious content
      const maliciousPatterns = [
        /rm\s+-rf\s+\//,
        /sudo\s+rm/,
        />\s*\/dev\/null/,
        /\|\s*sh/,
        /eval\s*\(/,
        /exec\s*\(/
      ];

      for (const pattern of maliciousPatterns) {
        if (pattern.test(request)) {
          return { valid: false, error: 'Request contains potentially unsafe content' };
        }
      }

      // Check for excessive special characters
      const specialCharCount = (request.match(/[^\w\s.,;:!?()-]/g) || []).length;
      if (specialCharCount > request.length * 0.3) {
        return { valid: false, error: 'Request contains too many special characters' };
      }

      return { valid: true };
    } catch (error) {
      this.logger.error('Failed to validate request:', error);
      return { valid: false, error: 'Request validation failed' };
    }
  }

  sanitizeInput(input: string): string {
    try {
      // Remove potentially harmful sequences
      let sanitized = input;

      // Remove null bytes
      sanitized = sanitized.replace(/\0/g, '');

      // Normalize whitespace
      sanitized = sanitized.replace(/\s+/g, ' ').trim();

      // Remove control characters (except newlines and tabs)
      sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

      // Limit consecutive newlines
      sanitized = sanitized.replace(/\n{3,}/g, '\n\n');

      // Remove excessive repetition
      sanitized = this.removeExcessiveRepetition(sanitized);

      return sanitized;
    } catch (error) {
      this.logger.error('Failed to sanitize input:', error);
      return input; // Return original if sanitization fails
    }
  }

  // Advanced request processing methods
  async processStreamingRequest(
    userRequest: string,
    projectPath: string,
    options: ClaudeCodeOptions = {},
    onProgress?: (chunk: string) => void
  ): Promise<ClaudeCodeResponse> {
    // This would implement streaming for long-running requests
    // For now, delegate to regular processing
    return this.processRequest(userRequest, projectPath, options);
  }

  async processBatchRequests(
    requests: Array<{ request: string; projectPath: string; options?: ClaudeCodeOptions }>,
    maxConcurrent: number = 3
  ): Promise<ClaudeCodeResponse[]> {
    try {
      this.logger.info(`📦 Processing batch of ${requests.length} requests`);

      const results: ClaudeCodeResponse[] = [];

      // Process in batches to avoid overwhelming the system
      for (let i = 0; i < requests.length; i += maxConcurrent) {
        const batch = requests.slice(i, i + maxConcurrent);

        const batchPromises = batch.map(({ request, projectPath, options }) =>
          this.processRequest(request, projectPath, options)
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        this.logger.debug(`Completed batch ${Math.floor(i / maxConcurrent) + 1}/${Math.ceil(requests.length / maxConcurrent)}`);
      }

      return results;
    } catch (error) {
      this.logger.error('Failed to process batch requests:', error);
      throw error;
    }
  }

  // Request analytics
  analyzeRequestComplexity(request: string): {
    complexity: 'low' | 'medium' | 'high' | 'very_high';
    factors: string[];
    estimatedProcessingTime: number;
  } {
    try {
      const factors: string[] = [];
      let complexityScore = 0;

      // Length factor
      if (request.length > 1000) {
        complexityScore += 1;
        factors.push('Long request');
      }

      // Technical terms
      const technicalTerms = [
        'architecture', 'design pattern', 'algorithm', 'optimization',
        'refactor', 'analysis', 'performance', 'security'
      ];

      const techTermCount = technicalTerms.filter(term =>
        request.toLowerCase().includes(term)
      ).length;

      if (techTermCount > 2) {
        complexityScore += 2;
        factors.push('Multiple technical concepts');
      }

      // Code analysis requests
      if (request.toLowerCase().includes('analyze') ||
          request.toLowerCase().includes('review') ||
          request.toLowerCase().includes('audit')) {
        complexityScore += 2;
        factors.push('Analysis request');
      }

      // Multiple files/components
      if (request.includes('all files') ||
          request.includes('entire project') ||
          request.includes('codebase')) {
        complexityScore += 3;
        factors.push('Project-wide scope');
      }

      // Determine complexity level
      let complexity: 'low' | 'medium' | 'high' | 'very_high';
      if (complexityScore <= 1) complexity = 'low';
      else if (complexityScore <= 3) complexity = 'medium';
      else if (complexityScore <= 5) complexity = 'high';
      else complexity = 'very_high';

      // Estimate processing time (in seconds)
      const baseTime = 10; // Base 10 seconds
      const estimatedProcessingTime = baseTime * (1 + complexityScore * 0.5);

      return {
        complexity,
        factors,
        estimatedProcessingTime
      };
    } catch (error) {
      this.logger.error('Failed to analyze request complexity:', error);
      return {
        complexity: 'medium',
        factors: ['Analysis failed'],
        estimatedProcessingTime: 30
      };
    }
  }

  private removeExcessiveRepetition(text: string): string {
    // Remove patterns that repeat more than 3 times
    return text.replace(/(.{3,}?)\1{3,}/g, '$1$1$1');
  }

  // Request formatting helpers
  formatCodeRequest(request: string, codeContext?: string): string {
    if (!codeContext) return request;

    return `
**User Request:**
${request}

**Code Context:**
\`\`\`
${codeContext}
\`\`\`

Please analyze the code context and respond to the user's request.
`;
  }

  formatAnalysisRequest(request: string, projectPath: string): string {
    return `
**Analysis Request:**
${request}

**Project Path:**
${projectPath}

**Instructions:**
Provide a comprehensive analysis based on the request. Include specific examples from the codebase where relevant.
`;
  }
}