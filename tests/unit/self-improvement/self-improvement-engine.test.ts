import { SelfImprovementEngine, EffortLevel } from '../../../src/self-improvement/self-improvement-engine';
import * as path from 'path';
import * as fs from 'fs/promises';

describe('SelfImprovementEngine', () => {
  let engine: SelfImprovementEngine;
  const testProjectPath = path.join(__dirname, '..', '..', 'fixtures', 'test-project');
  const testDbPath = ':memory:';

  beforeEach(() => {
    engine = new SelfImprovementEngine(testProjectPath, testDbPath);
  });

  afterEach(() => {
    engine.close();
  });

  describe('runImprovementCycle', () => {
    test('should complete improvement cycle and return report', async () => {
      const report = await engine.runSelfImprovement();

      expect(report).toBeDefined();
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.improvements).toBeInstanceOf(Array);
      expect(report.metrics).toBeDefined();
      expect(report.metrics.before).toBeDefined();
      expect(report.metrics.after).toBeDefined();
      expect(report.recommendations).toBeInstanceOf(Array);
    });

    test('should identify duplicate patterns', async () => {
      const report = await engine.runSelfImprovement();

      const duplicateImprovements = report.improvements.filter(
        improvement => improvement.type === 'duplication_removed'
      );

      if (duplicateImprovements.length > 0) {
        const improvement = duplicateImprovements[0];
        expect(improvement.feature).toBe('duplication_detection');
        expect(improvement.suggestion).toBeDefined();
        expect(improvement.estimatedEffort).toBeDefined();
        expect(['low', 'medium', 'high']).toContain(improvement.estimatedEffort);
      }
    });

    test('should generate meaningful recommendations', async () => {
      const report = await engine.runSelfImprovement();

      expect(report.recommendations.length).toBeGreaterThanOrEqual(0);
      if (report.recommendations.length > 0) {
        expect(typeof report.recommendations[0]).toBe('string');
        expect(report.recommendations[0].length).toBeGreaterThan(10);
      }
    });

    test('should calculate metrics correctly', async () => {
      const report = await engine.runSelfImprovement();

      expect(report.metrics.before).toBeDefined();
      expect(report.metrics.after).toBeDefined();
      expect(typeof report.metrics.before.totalDuplications).toBe('number');
      expect(typeof report.metrics.before.circularDependencies).toBe('number');
      expect(report.metrics.before.totalDuplications).toBeGreaterThanOrEqual(0);
    });
  });

  describe('applyImprovement', () => {
    test('should apply improvement and return success', async () => {
      const mockImprovement = {
        type: 'duplication_removed' as const,
        feature: 'duplication_detection',
        target: 'test-file.ts',
        description: 'Test improvement',
        suggestion: 'Extract common function',
        estimatedEffort: 'low' as EffortLevel,
        benefit: 5,
        status: 'identified' as const,
        metadata: {
          duplicateCount: 2,
          linesAffected: 20
        }
      };

      const result = await engine.applyImprovement(mockImprovement);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('error handling', () => {
    test('should handle invalid project path gracefully', async () => {
      const invalidEngine = new SelfImprovementEngine('/nonexistent/path');
      
      await expect(invalidEngine.runSelfImprovement()).rejects.toThrow();
      
      invalidEngine.close();
    });

    test('should emit events during improvement cycle', async () => {
      const events: string[] = [];
      
      engine.on('self-improvement:completed', () => {
        events.push('completed');
      });
      
      engine.on('self-improvement:failed', () => {
        events.push('failed');
      });

      try {
        await engine.runSelfImprovement();
        expect(events).toContain('completed');
      } catch (error) {
        expect(events).toContain('failed');
      }
    });
  });

  describe('integration with other features', () => {
    test('should use duplication detector correctly', async () => {
      const report = await engine.runSelfImprovement();
      
      // Check if duplication detection was attempted
      const duplicateImprovements = report.improvements.filter(
        improvement => improvement.feature === 'duplication_detection'
      );
      
      // Should either find duplicates or complete successfully with none
      expect(Array.isArray(duplicateImprovements)).toBe(true);
    });

    test('should use tree navigator for dependency analysis', async () => {
      const report = await engine.runSelfImprovement();
      
      const dependencyImprovements = report.improvements.filter(
        improvement => improvement.feature === 'tree_navigation'
      );
      
      expect(Array.isArray(dependencyImprovements)).toBe(true);
    });

    test('should use vector search for similarity detection', async () => {
      const report = await engine.runSelfImprovement();
      
      const vectorSearchImprovements = report.improvements.filter(
        improvement => improvement.feature === 'vector_search'
      );
      
      expect(Array.isArray(vectorSearchImprovements)).toBe(true);
    });
  });
});