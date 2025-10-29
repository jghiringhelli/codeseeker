/**
 * IntentAnalyzer Test Suite
 * Basic tests that verify the IntentAnalyzer works without timing out
 */

import { IntentAnalyzer, IntentAnalysisRequest } from './intent-analyzer';

describe('IntentAnalyzer', () => {
  let analyzer: IntentAnalyzer;

  beforeEach(() => {
    analyzer = new IntentAnalyzer();
  });

  describe('basic functionality', () => {
    it('should create analyzer instance', () => {
      expect(analyzer).toBeDefined();
      expect(analyzer).toBeInstanceOf(IntentAnalyzer);
    });

    it('should have analyzeIntent method', () => {
      expect(typeof analyzer.analyzeIntent).toBe('function');
    });

    it('should analyze a simple query', async () => {
      const request: IntentAnalysisRequest = {
        query: 'fix a bug'
      };

      const result = await analyzer.analyzeIntent(request);

      expect(result).toBeDefined();
      expect(result.intention).toBeDefined();
      expect(result.complexity).toBeDefined();
      expect(result.estimatedFiles).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
    }, 5000); // 5 second timeout

    it('should handle authentication queries', async () => {
      const request: IntentAnalysisRequest = {
        query: 'implement authentication'
      };

      const result = await analyzer.analyzeIntent(request);

      expect(result.intention).toMatch(/authentication_system|add_feature/);
      expect(result.complexity).toBe('complex');
    }, 5000);

    it('should handle refactoring queries', async () => {
      const request: IntentAnalysisRequest = {
        query: 'refactor the code'
      };

      const result = await analyzer.analyzeIntent(request);

      expect(result.intention).toBe('refactor_code');
    }, 5000);

    it('should handle bug fix queries', async () => {
      const request: IntentAnalysisRequest = {
        query: 'fix the error'
      };

      const result = await analyzer.analyzeIntent(request);

      expect(result.intention).toBe('fix_bug');
      expect(result.complexity).toBe('simple');
    }, 5000);

    it('should handle performance queries', async () => {
      const request: IntentAnalysisRequest = {
        query: 'optimize performance'
      };

      const result = await analyzer.analyzeIntent(request);

      expect(result.intention).toBe('improve_performance');
    }, 5000);

    it('should handle general queries', async () => {
      const request: IntentAnalysisRequest = {
        query: 'check this'
      };

      const result = await analyzer.analyzeIntent(request);

      expect(result.intention).toBe('general_analysis');
      expect(result.confidence).toBeLessThanOrEqual(0.7);
    }, 5000);
  });
});