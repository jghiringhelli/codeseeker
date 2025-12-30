/**
 * Semantic Deduplication Service
 * SOLID Principles: Single Responsibility - Handle semantic duplication detection only
 */

import { Logger } from '../../logger';
import {
  ISemanticDeduplicationService,
  IIntentAnalysisService,
  ISimilarityMatchingService,
  SemanticDeduplicationResult,
  ExistingImplementation,
  IntentAnalysisResult
} from '../interfaces';

export class SemanticDeduplicationService implements ISemanticDeduplicationService {
  private logger = Logger.getInstance();

  constructor(
    private intentAnalysisService: IIntentAnalysisService,
    private similarityMatchingService: ISimilarityMatchingService
  ) {}

  async checkSemanticDuplication(
    functionality: string,
    userIntent: string,
    projectPath: string,
    cacheKey?: string
  ): Promise<SemanticDeduplicationResult> {
    const result: SemanticDeduplicationResult = {
      hasDuplicates: false,
      existingImplementations: [],
      semanticSimilarity: 0,
      recommendations: [],
      shouldProceed: true
    };

    try {
      // 1. Analyze user intent to understand what they want to build
      const intentAnalysis = await this.intentAnalysisService.analyzeUserIntent(userIntent);

      // 2. Use semantic search to find similar existing code
      try {
        const semanticMatches = await this.similarityMatchingService.findSemanticMatches(
          intentAnalysis.intendedFunctionality,
          projectPath
        );

        result.existingImplementations = semanticMatches;
        result.semanticSimilarity = semanticMatches.length > 0 ?
          Math.max(...semanticMatches.map(m => m.similarity)) : 0;
      } catch (error) {
        this.logger.warn('Semantic search failed, using fallback');
      }

      // 3. Fallback: Vector similarity and relationship matching
      const vectorMatches = await this.similarityMatchingService.findVectorSimilarityMatches(
        intentAnalysis.intendedFunctionality
      );
      result.existingImplementations.push(...vectorMatches);

      const relationshipMatches = await this.similarityMatchingService.findRelationshipMatches(
        intentAnalysis.intendedFunctionality
      );
      result.existingImplementations.push(...relationshipMatches);

      // 4. Remove duplicates and sort by similarity
      result.existingImplementations = this.deduplicateImplementations(result.existingImplementations);

      // 5. Determine if duplicates exist
      result.hasDuplicates = result.existingImplementations.length > 0;

      // 6. Generate intelligent recommendations
      if (result.hasDuplicates) {
        result.recommendations = this.generateDuplicationRecommendations(
          result.existingImplementations,
          intentAnalysis
        );

        // Suggest proceeding only if similarity is low
        result.shouldProceed = result.semanticSimilarity < 0.7;
      } else {
        result.recommendations = [
          `No existing implementation found for "${intentAnalysis.intendedFunctionality}"`,
          ...intentAnalysis.bestPractices
        ];
      }

    } catch (error: any) {
      this.logger.warn('Semantic deduplication error:', error.message);
      // Return empty result but allow proceeding
      result.shouldProceed = true;
      result.recommendations = ['Unable to perform semantic analysis, proceeding with caution'];
    }

    return result;
  }

  private deduplicateImplementations(implementations: ExistingImplementation[]): ExistingImplementation[] {
    const seen = new Map<string, ExistingImplementation>();

    for (const impl of implementations) {
      const key = `${impl.file}:${impl.function || impl.class}`;
      const existing = seen.get(key);

      if (!existing || impl.similarity > existing.similarity) {
        seen.set(key, impl);
      }
    }

    return Array.from(seen.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10); // Limit to top 10 matches
  }

  private generateDuplicationRecommendations(
    implementations: ExistingImplementation[],
    intentAnalysis: IntentAnalysisResult
  ): string[] {
    const recommendations: string[] = [];

    if (implementations.length === 0) {
      return recommendations;
    }

    const highSimilarityMatches = implementations.filter(impl => impl.similarity > 0.8);
    const mediumSimilarityMatches = implementations.filter(impl => impl.similarity > 0.6 && impl.similarity <= 0.8);

    if (highSimilarityMatches.length > 0) {
      recommendations.push(
        `🔴 High similarity detected! Found ${highSimilarityMatches.length} very similar implementations.`
      );
      recommendations.push(
        `Consider extending or refactoring: ${highSimilarityMatches[0].file}:${highSimilarityMatches[0].function || highSimilarityMatches[0].class}`
      );
      recommendations.push(
        'Recommendation: Review existing code before creating new implementation'
      );
    } else if (mediumSimilarityMatches.length > 0) {
      recommendations.push(
        `🟡 Medium similarity detected! Found ${mediumSimilarityMatches.length} somewhat similar implementations.`
      );
      recommendations.push(
        'Consider if these existing implementations can be extended or if they inspire your design'
      );
    } else {
      recommendations.push(
        `🟢 Low similarity. Your implementation appears sufficiently unique.`
      );
    }

    // Add architectural concerns
    if (intentAnalysis.architecturalConcerns.length > 0) {
      recommendations.push('');
      recommendations.push('🏗️ Architectural considerations:');
      recommendations.push(...intentAnalysis.architecturalConcerns);
    }

    // Add suggested names
    if (intentAnalysis.suggestedNames.length > 0) {
      recommendations.push('');
      recommendations.push('📝 Suggested names:');
      recommendations.push(...intentAnalysis.suggestedNames.slice(0, 3).map(name => `  - ${name}`));
    }

    return recommendations;
  }
}