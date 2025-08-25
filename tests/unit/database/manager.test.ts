/**
 * Unit tests for DatabaseManager
 */

import { DatabaseManager } from '../../../src/database/manager';
import {
  InitializationProgress,
  DetectedPattern,
  QuestionnaireResponse,
  AnalysisResult,
  InitPhase,
  PatternType,
  QuestionCategory,
  AnalysisType,
  EvidenceType
} from '../../../src/core/types';

describe('DatabaseManager', () => {
  let dbManager: DatabaseManager;

  beforeEach(async () => {
    // Use in-memory database for tests
    dbManager = new DatabaseManager(':memory:');
    await dbManager.initialize();
  });

  afterEach(async () => {
    await dbManager.close();
  });

  describe('Initialization Progress', () => {
    const sampleProgress: InitializationProgress = {
      projectPath: '/test/project',
      phase: InitPhase.PROJECT_DISCOVERY,
      resumeToken: 'test-token-123',
      progressData: {
        totalFiles: 100,
        processedFiles: 25,
        skippedFiles: 0,
        errorFiles: 0,
        batchSize: 10,
        processingStartTime: new Date()
      }
    };

    it('should save and retrieve initialization progress', async () => {
      // Save progress
      const saved = await dbManager.saveInitializationProgress(sampleProgress);
      expect(saved.id).toBeDefined();
      expect(saved.createdAt).toBeDefined();

      // Retrieve progress
      const retrieved = await dbManager.getInitializationProgress('/test/project');
      expect(retrieved).toBeTruthy();
      expect(retrieved!.projectPath).toBe('/test/project');
      expect(retrieved!.phase).toBe(InitPhase.PROJECT_DISCOVERY);
      expect(retrieved!.resumeToken).toBe('test-token-123');
      expect(retrieved!.progressData.totalFiles).toBe(100);
    });

    it('should update initialization progress', async () => {
      // Save initial progress
      await dbManager.saveInitializationProgress(sampleProgress);

      // Update progress
      const updatedProgress = {
        ...sampleProgress,
        phase: InitPhase.PATTERN_ANALYSIS,
        progressData: {
          ...sampleProgress.progressData,
          processedFiles: 50
        }
      };

      await dbManager.updateInitializationProgress(updatedProgress);

      // Verify update
      const retrieved = await dbManager.getInitializationProgress('/test/project');
      expect(retrieved!.phase).toBe(InitPhase.PATTERN_ANALYSIS);
      expect(retrieved!.progressData.processedFiles).toBe(50);
    });

    it('should delete initialization progress', async () => {
      // Save progress
      await dbManager.saveInitializationProgress(sampleProgress);

      // Verify it exists
      let retrieved = await dbManager.getInitializationProgress('/test/project');
      expect(retrieved).toBeTruthy();

      // Delete progress
      await dbManager.deleteInitializationProgress('/test/project');

      // Verify it's gone
      retrieved = await dbManager.getInitializationProgress('/test/project');
      expect(retrieved).toBeNull();
    });

    it('should return null for non-existent project', async () => {
      const progress = await dbManager.getInitializationProgress('/non/existent');
      expect(progress).toBeNull();
    });
  });

  describe('Detected Patterns', () => {
    const samplePattern: DetectedPattern = {
      projectPath: '/test/project',
      patternType: PatternType.ARCHITECTURE,
      patternName: 'Clean Architecture',
      confidence: 0.85,
      evidence: [
        {
          type: EvidenceType.FILE_STRUCTURE,
          location: {
            file: 'src/domain/entities/User.ts',
            startLine: 1,
            endLine: 10
          },
          description: 'Domain entity structure',
          confidence: 0.9
        }
      ]
    };

    it('should save and retrieve detected patterns', async () => {
      // Save pattern
      const saved = await dbManager.saveDetectedPattern(samplePattern);
      expect(saved.id).toBeDefined();
      expect(saved.createdAt).toBeDefined();

      // Retrieve patterns
      const patterns = await dbManager.getDetectedPatterns('/test/project');
      expect(patterns).toHaveLength(1);
      expect(patterns[0]!.patternName).toBe('Clean Architecture');
      expect(patterns[0]!.confidence).toBe(0.85);
      expect(patterns[0]!.evidence).toHaveLength(1);
    });

    it('should retrieve patterns ordered by confidence', async () => {
      // Save multiple patterns with different confidence scores
      const pattern1 = { ...samplePattern, patternName: 'Pattern A', confidence: 0.7 };
      const pattern2 = { ...samplePattern, patternName: 'Pattern B', confidence: 0.9 };
      const pattern3 = { ...samplePattern, patternName: 'Pattern C', confidence: 0.8 };

      await dbManager.saveDetectedPattern(pattern1);
      await dbManager.saveDetectedPattern(pattern2);
      await dbManager.saveDetectedPattern(pattern3);

      const patterns = await dbManager.getDetectedPatterns('/test/project');
      expect(patterns).toHaveLength(3);
      expect(patterns[0]!.patternName).toBe('Pattern B'); // Highest confidence
      expect(patterns[1]!.patternName).toBe('Pattern C'); // Second highest
      expect(patterns[2]!.patternName).toBe('Pattern A'); // Lowest
    });

    it('should delete all patterns for a project', async () => {
      await dbManager.saveDetectedPattern(samplePattern);
      await dbManager.saveDetectedPattern({
        ...samplePattern,
        patternName: 'Another Pattern'
      });

      let patterns = await dbManager.getDetectedPatterns('/test/project');
      expect(patterns).toHaveLength(2);

      await dbManager.deleteDetectedPatterns('/test/project');

      patterns = await dbManager.getDetectedPatterns('/test/project');
      expect(patterns).toHaveLength(0);
    });
  });

  describe('Questionnaire Responses', () => {
    const sampleResponse: QuestionnaireResponse = {
      projectPath: '/test/project',
      category: QuestionCategory.ARCHITECTURE,
      questionId: 'arch-pattern-001',
      response: 'Clean Architecture',
      metadata: { confidence: 0.8 }
    };

    it('should save and retrieve questionnaire responses', async () => {
      // Save response
      const saved = await dbManager.saveQuestionnaireResponse(sampleResponse);
      expect(saved.id).toBeDefined();
      expect(saved.createdAt).toBeDefined();

      // Retrieve responses
      const responses = await dbManager.getQuestionnaireResponses('/test/project');
      expect(responses).toHaveLength(1);
      expect(responses[0]!.questionId).toBe('arch-pattern-001');
      expect(responses[0]!.response).toBe('Clean Architecture');
      expect(responses[0]!.metadata).toEqual({ confidence: 0.8 });
    });

    it('should retrieve responses ordered by category and creation time', async () => {
      const response1 = {
        ...sampleResponse,
        category: QuestionCategory.STANDARDS,
        questionId: 'std-001'
      };
      const response2 = {
        ...sampleResponse,
        category: QuestionCategory.ARCHITECTURE,
        questionId: 'arch-002'
      };
      const response3 = {
        ...sampleResponse,
        category: QuestionCategory.ARCHITECTURE,
        questionId: 'arch-001'
      };

      await dbManager.saveQuestionnaireResponse(response1);
      await dbManager.saveQuestionnaireResponse(response2);
      await dbManager.saveQuestionnaireResponse(response3);

      const responses = await dbManager.getQuestionnaireResponses('/test/project');
      expect(responses).toHaveLength(3);
      // Should be ordered by category first, then by creation time
      expect(responses[0]!.category).toBe(QuestionCategory.ARCHITECTURE);
      expect(responses[1]!.category).toBe(QuestionCategory.ARCHITECTURE);
      expect(responses[2]!.category).toBe(QuestionCategory.STANDARDS);
    });
  });

  describe('Analysis Results', () => {
    const sampleResult: AnalysisResult = {
      projectPath: '/test/project',
      filePath: 'src/components/Button.tsx',
      fileHash: 'abc123def456',
      analysisType: AnalysisType.QUALITY,
      result: {
        complexity: 5,
        maintainabilityIndex: 80,
        issues: []
      },
      confidenceScore: 0.95
    };

    it('should save and retrieve analysis results', async () => {
      // Save result
      const saved = await dbManager.saveAnalysisResult(sampleResult);
      expect(saved.id).toBeDefined();
      expect(saved.createdAt).toBeDefined();

      // Retrieve all results
      const results = await dbManager.getAnalysisResults('/test/project');
      expect(results).toHaveLength(1);
      expect(results[0]!.filePath).toBe('src/components/Button.tsx');
      expect(results[0]!.analysisType).toBe(AnalysisType.QUALITY);
      expect(results[0]!.result.complexity).toBe(5);
    });

    it('should filter results by analysis type', async () => {
      const qualityResult = { ...sampleResult, analysisType: AnalysisType.QUALITY };
      const patternResult = {
        ...sampleResult,
        filePath: 'src/services/UserService.ts',
        analysisType: AnalysisType.PATTERN,
        result: { patterns: ['Repository'] }
      };

      await dbManager.saveAnalysisResult(qualityResult);
      await dbManager.saveAnalysisResult(patternResult);

      // Get all results
      const allResults = await dbManager.getAnalysisResults('/test/project');
      expect(allResults).toHaveLength(2);

      // Get only quality results
      const qualityResults = await dbManager.getAnalysisResults('/test/project', AnalysisType.QUALITY);
      expect(qualityResults).toHaveLength(1);
      expect(qualityResults[0]!.analysisType).toBe(AnalysisType.QUALITY);

      // Get only pattern results
      const patternResults = await dbManager.getAnalysisResults('/test/project', AnalysisType.PATTERN);
      expect(patternResults).toHaveLength(1);
      expect(patternResults[0]!.analysisType).toBe(AnalysisType.PATTERN);
    });
  });

  describe('Database Statistics', () => {
    it('should provide accurate database statistics', async () => {
      // Add some test data
      await dbManager.saveInitializationProgress({
        projectPath: '/test/project1',
        phase: InitPhase.PROJECT_DISCOVERY,
        resumeToken: 'token1',
        progressData: {
          totalFiles: 50,
          processedFiles: 10,
          skippedFiles: 0,
          errorFiles: 0,
          batchSize: 5,
          processingStartTime: new Date()
        }
      });

      await dbManager.saveDetectedPattern({
        projectPath: '/test/project1',
        patternType: PatternType.ARCHITECTURE,
        patternName: 'MVC',
        confidence: 0.8,
        evidence: []
      });

      const stats = await dbManager.getDatabaseStats();
      expect(stats.initialization_progress).toBe(1);
      expect(stats.detected_patterns).toBe(1);
      expect(stats.questionnaire_responses).toBe(0);
      expect(stats.analysis_results).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Close database to cause errors
      await dbManager.close();

      await expect(
        dbManager.getInitializationProgress('/test/project')
      ).rejects.toThrow('Database not initialized');
    });

    it('should validate database connection before operations', async () => {
      await dbManager.close();
      
      await expect(
        dbManager.saveInitializationProgress({
          projectPath: '/test/project',
          phase: InitPhase.PROJECT_DISCOVERY,
          resumeToken: 'token',
          progressData: {
            totalFiles: 10,
            processedFiles: 5,
            skippedFiles: 0,
            errorFiles: 0,
            batchSize: 5,
            processingStartTime: new Date()
          }
        })
      ).rejects.toThrow('Database not initialized');
    });
  });
});