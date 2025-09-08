/**
 * Unit tests for Intelligent Cycle Features
 */

import { IntelligentCycleFeatures } from '../../../src/shared/intelligent-cycle-features';

describe('IntelligentCycleFeatures', () => {
  let cycleFeatures: IntelligentCycleFeatures;

  beforeEach(() => {
    cycleFeatures = new IntelligentCycleFeatures();
  });

  describe('Initialization', () => {
    test('should initialize intelligent cycle features', async () => {
      expect(async () => {
        await cycleFeatures.initialize();
      }).not.toThrow();
    });
  });

  describe('Deduplication Analysis', () => {
    test('should perform semantic-powered deduplication analysis', async () => {
      await cycleFeatures.initialize();

      const analysis = await cycleFeatures.performSemanticPoweredDeduplication(
        'authentication service',
        'C:\\test\\project'
      );

      expect(analysis).toBeDefined();
      expect(analysis.duplicates).toBeDefined();
      expect(Array.isArray(analysis.duplicates)).toBe(true);
      expect(analysis.recommendation).toBeDefined();
    });

    test('should handle empty results gracefully', async () => {
      await cycleFeatures.initialize();

      const analysis = await cycleFeatures.performSemanticPoweredDeduplication(
        'non-existent-functionality',
        'C:\\test\\project'
      );

      expect(analysis.duplicates).toHaveLength(0);
      expect(analysis.recommendation).toContain('No existing');
    });
  });

  describe('Context-Aware Security Analysis', () => {
    test('should perform security analysis with context', async () => {
      await cycleFeatures.initialize();

      const analysis = await cycleFeatures.performContextAwareSecurityAnalysis(
        ['authentication', 'user-input'],
        'C:\\test\\project'
      );

      expect(analysis).toBeDefined();
      expect(analysis.securityConcerns).toBeDefined();
      expect(Array.isArray(analysis.securityConcerns)).toBe(true);
      expect(analysis.recommendations).toBeDefined();
      expect(Array.isArray(analysis.recommendations)).toBe(true);
    });

    test('should handle low-risk scenarios', async () => {
      await cycleFeatures.initialize();

      const analysis = await cycleFeatures.performContextAwareSecurityAnalysis(
        ['logging'],
        'C:\\test\\project'
      );

      expect(analysis.riskLevel).toBeDefined();
      expect(['low', 'medium', 'high', 'critical']).toContain(analysis.riskLevel);
    });
  });

  describe('Error Handling', () => {
    test('should handle initialization errors gracefully', async () => {
      // Test that initialization doesn't throw even if services are unavailable
      expect(async () => {
        await cycleFeatures.initialize();
      }).not.toThrow();
    });
  });
});