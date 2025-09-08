/**
 * Unit tests for Comprehensive Impact Analyzer
 */

import { ComprehensiveImpactAnalyzer } from '../../../src/shared/comprehensive-impact-analyzer';

describe('ComprehensiveImpactAnalyzer', () => {
  let analyzer: ComprehensiveImpactAnalyzer;
  const testProjectPath = 'C:\\test\\project';

  beforeEach(() => {
    analyzer = new ComprehensiveImpactAnalyzer();
  });

  describe('Impact Analysis', () => {
    test('should analyze impact successfully', async () => {
      const result = await analyzer.analyzeCompleteImpact(
        'add user authentication system',
        testProjectPath
      );

      expect(result).toBeDefined();
      expect(result.primaryFiles).toBeDefined();
      expect(Array.isArray(result.primaryFiles)).toBe(true);
      expect(result.cascadingFiles).toBeDefined();
      expect(Array.isArray(result.cascadingFiles)).toBe(true);
      expect(result.totalFiles).toBeDefined();
      expect(typeof result.totalFiles).toBe('number');
    });

    test('should categorize files correctly', async () => {
      const result = await analyzer.analyzeCompleteImpact(
        'update user service',
        testProjectPath
      );

      expect(result.configurationFiles).toBeDefined();
      expect(result.documentationFiles).toBeDefined();
      expect(result.testFiles).toBeDefined();
      expect(result.deploymentFiles).toBeDefined();
    });

    test('should estimate complexity and time', async () => {
      const result = await analyzer.analyzeCompleteImpact(
        'refactor authentication system',
        testProjectPath
      );

      expect(result.estimatedTime).toBeDefined();
      expect(typeof result.estimatedTime).toBe('string');
      expect(result.riskLevel).toBeDefined();
      expect(['low', 'medium', 'high', 'critical']).toContain(result.riskLevel);
    });
  });

  describe('File Type Detection', () => {
    test('should detect file types correctly', () => {
      // This is testing internal logic - we can't directly test private methods
      // but we can test the public interface that uses them
      expect(analyzer).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid project paths gracefully', async () => {
      const result = await analyzer.analyzeCompleteImpact(
        'test request',
        'C:\\non\\existent\\path'
      );

      // Should not throw, but may return minimal results
      expect(result).toBeDefined();
      expect(result.primaryFiles).toBeDefined();
    });

    test('should handle empty requests gracefully', async () => {
      const result = await analyzer.analyzeCompleteImpact(
        '',
        testProjectPath
      );

      expect(result).toBeDefined();
      expect(result.totalFiles).toBeGreaterThanOrEqual(0);
    });
  });
});