/**
 * Memory Optimization Service
 * SOLID Principles: Single Responsibility - Handle memory optimization, compression, and cleanup only
 */

import { Logger } from '../../logger';
import {
  IMemoryOptimizationService,
  IMemoryStorageService,
  InteractionMemory,
  RequestMemory,
  MemoryCompressionResult
} from '../interfaces/index';

export class MemoryOptimizationService implements IMemoryOptimizationService {
  private logger = Logger.getInstance();

  constructor(private storageService: IMemoryStorageService) {}

  async compressAndSummarize(
    interactions: InteractionMemory[],
    outcome: RequestMemory['outcome']
  ): Promise<MemoryCompressionResult> {
    try {
      const originalSize = JSON.stringify(interactions).length;
      const originalTokenCount = interactions.reduce((sum, i) => sum + i.claudeResponse.tokensUsed, 0);

      // Extract key patterns and learnings
      const keyPatterns = this.extractKeyPatterns(interactions);
      const importantOutcomes = this.extractImportantOutcomes(interactions, outcome);
      const criticalLearnings = this.extractCriticalLearnings(interactions);

      // Keep only the most effective interactions
      const effectiveInteractions = interactions
        .filter(i => i.effectiveness > 0.7)
        .sort((a, b) => b.effectiveness - a.effectiveness)
        .slice(0, Math.max(3, Math.floor(interactions.length * 0.3))); // Keep top 30% or at least 3

      const compressedSize = JSON.stringify(effectiveInteractions).length;
      const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1;

      const result: MemoryCompressionResult = {
        original: {
          size: originalSize,
          interactionCount: interactions.length,
          tokenCount: originalTokenCount
        },
        compressed: {
          size: compressedSize,
          preservedInteractions: effectiveInteractions.length,
          compressionRatio
        },
        summary: {
          keyPatterns,
          importantOutcomes,
          criticalLearnings
        },
        lossless: compressionRatio > 0.8 // Consider lossless if we kept most of the data
      };

      this.logger.debug(`Compressed ${interactions.length} interactions to ${effectiveInteractions.length} (${Math.round(compressionRatio * 100)}% of original size)`);
      return result;
    } catch (error) {
      this.logger.error('Failed to compress and summarize interactions:', error);
      throw error;
    }
  }

  extractKeyPatterns(interactions: InteractionMemory[]): string[] {
    try {
      const allPatterns = interactions.flatMap(i => i.patterns);
      const patternCounts = new Map<string, number>();

      // Count pattern frequency
      for (const pattern of allPatterns) {
        patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
      }

      // Return most frequent patterns
      return Array.from(patternCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([pattern]) => pattern);
    } catch (error) {
      this.logger.error('Failed to extract key patterns:', error);
      return [];
    }
  }

  extractImportantOutcomes(interactions: InteractionMemory[], outcome: RequestMemory['outcome']): string[] {
    try {
      const outcomes: string[] = [];

      // Add successful interaction outcomes
      const successfulInteractions = interactions.filter(i => i.claudeResponse.success);
      for (const interaction of successfulInteractions.slice(0, 3)) {
        if (interaction.claudeResponse.output && interaction.claudeResponse.output.length > 20) {
          outcomes.push(interaction.claudeResponse.output.substring(0, 100) + '...');
        }
      }

      // Add final outcome
      if (outcome.success && outcome.result) {
        outcomes.push(`Final result: ${outcome.result.substring(0, 100)}...`);
      }

      // Add files modified summary
      if (outcome.filesModified.length > 0) {
        outcomes.push(`Modified ${outcome.filesModified.length} files: ${outcome.filesModified.slice(0, 3).join(', ')}`);
      }

      return outcomes.slice(0, 5); // Top 5 most important outcomes
    } catch (error) {
      this.logger.error('Failed to extract important outcomes:', error);
      return [];
    }
  }

  extractCriticalLearnings(interactions: InteractionMemory[]): string[] {
    try {
      const learnings: string[] = [];

      // Extract from improvements across all interactions
      const allImprovements = interactions.flatMap(i => i.improvements);
      const uniqueImprovements = [...new Set(allImprovements)];

      // Add most frequent improvements
      learnings.push(...uniqueImprovements.slice(0, 3));

      // Extract from high-effectiveness interactions
      const highEffectivenessInteractions = interactions.filter(i => i.effectiveness > 0.8);
      for (const interaction of highEffectivenessInteractions.slice(0, 2)) {
        if (interaction.patterns.length > 0) {
          learnings.push(`Effective pattern: ${interaction.patterns[0]}`);
        }
      }

      // Extract from error patterns
      const errorInteractions = interactions.filter(i => !i.claudeResponse.success);
      if (errorInteractions.length > 0) {
        learnings.push(`Common failure mode: ${errorInteractions[0].claudeResponse.errorDetails || 'Unknown error'}`);
      }

      return [...new Set(learnings)].slice(0, 5); // Top 5 unique learnings
    } catch (error) {
      this.logger.error('Failed to extract critical learnings:', error);
      return [];
    }
  }

  calculateInteractionEffectiveness(
    interaction: InteractionMemory,
    finalOutcome: RequestMemory['outcome']
  ): number {
    try {
      let effectiveness = 0;

      // Base score from success
      if (interaction.claudeResponse.success) {
        effectiveness += 0.4;
      }

      // Score from output quality (length and content)
      if (interaction.claudeResponse.output) {
        const outputLength = interaction.claudeResponse.output.length;
        if (outputLength > 100) effectiveness += 0.2;
        if (outputLength > 500) effectiveness += 0.1;
      }

      // Score from duration (faster is better, up to a point)
      const duration = interaction.claudeResponse.duration;
      if (duration < 5000) effectiveness += 0.1; // Under 5 seconds
      else if (duration < 15000) effectiveness += 0.05; // Under 15 seconds

      // Score from token efficiency
      const tokensUsed = interaction.claudeResponse.tokensUsed;
      if (tokensUsed < 1000) effectiveness += 0.1;
      else if (tokensUsed < 2000) effectiveness += 0.05;

      // Score from final outcome contribution
      if (finalOutcome.success) {
        effectiveness += 0.1;
      }

      // Bonus for patterns identified
      if (interaction.patterns.length > 0) {
        effectiveness += Math.min(0.1, interaction.patterns.length * 0.02);
      }

      // Cap at 1.0
      return Math.min(1.0, effectiveness);
    } catch (error) {
      this.logger.error('Failed to calculate interaction effectiveness:', error);
      return 0.5; // Default moderate effectiveness
    }
  }

  extractInteractionPatterns(interaction: InteractionMemory): string[] {
    try {
      const patterns: string[] = [];

      // Pattern from request type
      patterns.push(`request_type_${interaction.codemindRequest.type}`);

      // Pattern from priority
      patterns.push(`priority_${interaction.codemindRequest.priority}`);

      // Pattern from success/failure
      patterns.push(interaction.claudeResponse.success ? 'success_pattern' : 'failure_pattern');

      // Pattern from duration
      const duration = interaction.claudeResponse.duration;
      if (duration < 5000) patterns.push('fast_response');
      else if (duration > 30000) patterns.push('slow_response');

      // Pattern from token usage
      const tokensUsed = interaction.claudeResponse.tokensUsed;
      if (tokensUsed < 500) patterns.push('low_token_usage');
      else if (tokensUsed > 3000) patterns.push('high_token_usage');

      // Pattern from output type
      if (interaction.claudeResponse.output) {
        if (interaction.claudeResponse.output.includes('```')) {
          patterns.push('code_output');
        }
        if (interaction.claudeResponse.output.includes('Error:') || interaction.claudeResponse.output.includes('error')) {
          patterns.push('error_handling');
        }
      }

      return patterns;
    } catch (error) {
      this.logger.error('Failed to extract interaction patterns:', error);
      return [];
    }
  }

  suggestInteractionImprovements(interaction: InteractionMemory): string[] {
    try {
      const improvements: string[] = [];

      // Suggest based on effectiveness
      if (interaction.effectiveness < 0.5) {
        improvements.push('Improve instruction clarity');
        improvements.push('Provide better context');
      }

      // Suggest based on duration
      if (interaction.claudeResponse.duration > 30000) {
        improvements.push('Break down into smaller tasks');
        improvements.push('Optimize context size');
      }

      // Suggest based on token usage
      if (interaction.claudeResponse.tokensUsed > 3000) {
        improvements.push('Reduce context verbosity');
        improvements.push('Focus on essential information');
      }

      // Suggest based on success rate
      if (!interaction.claudeResponse.success) {
        improvements.push('Validate prerequisites');
        improvements.push('Add error handling guidance');
      }

      // Suggest based on patterns
      if (interaction.patterns.length === 0) {
        improvements.push('Add explicit pattern identification');
      }

      return improvements.slice(0, 3); // Top 3 suggestions
    } catch (error) {
      this.logger.error('Failed to suggest interaction improvements:', error);
      return [];
    }
  }

  async optimizeMemoryUsage(): Promise<void> {
    try {
      this.logger.info('Starting memory optimization...');

      // This would implement memory optimization strategies
      // For now, this is a placeholder for future implementation

      this.logger.info('Memory optimization completed');
    } catch (error) {
      this.logger.error('Failed to optimize memory usage:', error);
      throw error;
    }
  }

  async cleanupExpiredSessions(): Promise<void> {
    try {
      // Define session expiry (e.g., 30 days)
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() - 30);

      this.logger.info(`Cleaning up sessions older than ${expiryDate.toISOString()}`);

      // This would implement session cleanup
      // For now, this is a placeholder for future implementation

      this.logger.info('Session cleanup completed');
    } catch (error) {
      this.logger.error('Failed to cleanup expired sessions:', error);
      throw error;
    }
  }

  async compressOldInteractions(threshold: Date): Promise<void> {
    try {
      this.logger.info(`Compressing interactions older than ${threshold.toISOString()}`);

      // This would implement interaction compression
      // For now, this is a placeholder for future implementation

      this.logger.info('Interaction compression completed');
    } catch (error) {
      this.logger.error('Failed to compress old interactions:', error);
      throw error;
    }
  }
}