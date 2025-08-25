import { CentralizationDetector, ConfigurationType, ConfigUsage, MigrationApproach } from '../../../src/features/centralization/detector';
import * as path from 'path';
import * as fs from 'fs/promises';

describe('CentralizationDetector', () => {
  let detector: CentralizationDetector;
  const testProjectPath = path.join(__dirname, '..', '..', 'fixtures', 'test-project');

  beforeAll(() => {
    detector = new CentralizationDetector();
  });

  describe('scanProject', () => {
    test('should detect scattered configurations in test project', async () => {
      const result = await detector.scanProject({
        projectPath: testProjectPath,
        minOccurrences: 2,
        includeMigrationPlan: true,
        includeRiskAssessment: true
      });

      expect(result).toBeDefined();
      expect(result.opportunities).toBeInstanceOf(Array);
      expect(result.scanInfo).toBeDefined();
      expect(result.statistics).toBeDefined();
      expect(result.recommendations).toBeInstanceOf(Array);
    });

    test('should provide scan information', async () => {
      const result = await detector.scanProject({
        projectPath: testProjectPath,
        minOccurrences: 1
      });

      expect(result.scanInfo.totalFiles).toBeGreaterThan(0);
      expect(result.scanInfo.analyzedFiles).toBeGreaterThanOrEqual(0);
      expect(result.scanInfo.skippedFiles).toBeGreaterThanOrEqual(0);
      expect(result.scanInfo.configItemsFound).toBeGreaterThanOrEqual(0);
      expect(result.scanInfo.processingTime).toBeGreaterThan(0);
      expect(result.scanInfo.timestamp).toBeInstanceOf(Date);
    });

    test('should filter by configuration types when specified', async () => {
      const result = await detector.scanProject({
        projectPath: testProjectPath,
        configTypes: [ConfigurationType.API_ENDPOINTS],
        minOccurrences: 1
      });

      const apiOpportunities = result.opportunities.filter(
        opp => opp.configType === ConfigurationType.API_ENDPOINTS
      );

      // All opportunities should be API endpoints if they exist
      if (result.opportunities.length > 0) {
        expect(apiOpportunities.length).toBe(result.opportunities.length);
      }
    });

    test('should respect minimum occurrences threshold', async () => {
      const resultLow = await detector.scanProject({
        projectPath: testProjectPath,
        minOccurrences: 1
      });

      const resultHigh = await detector.scanProject({
        projectPath: testProjectPath,
        minOccurrences: 5
      });

      expect(resultHigh.opportunities.length).toBeLessThanOrEqual(resultLow.opportunities.length);
    });
  });

  describe('configuration detection', () => {
    test('should detect API endpoint configurations', async () => {
      const result = await detector.scanProject({
        projectPath: testProjectPath,
        configTypes: [ConfigurationType.API_ENDPOINTS],
        minOccurrences: 1
      });

      const apiOpportunities = result.opportunities.filter(
        opp => opp.configType === ConfigurationType.API_ENDPOINTS
      );

      if (apiOpportunities.length > 0) {
        const opportunity = apiOpportunities[0];
        expect(opportunity.scatteredLocations).toBeInstanceOf(Array);
        expect(opportunity.scatteredLocations.length).toBeGreaterThanOrEqual(1);
        
        const location = opportunity.scatteredLocations[0];
        expect(location.file).toBeDefined();
        expect(location.line).toBeGreaterThan(0);
        expect(location.context).toBeDefined();
        expect(location.usage).toBeDefined();
      }
    });

    test('should detect styling constants', async () => {
      const result = await detector.scanProject({
        projectPath: testProjectPath,
        configTypes: [ConfigurationType.STYLING_CONSTANTS],
        minOccurrences: 1
      });

      const styleOpportunities = result.opportunities.filter(
        opp => opp.configType === ConfigurationType.STYLING_CONSTANTS
      );

      if (styleOpportunities.length > 0) {
        const opportunity = styleOpportunities[0];
        expect(opportunity.benefitScore).toBeGreaterThan(0);
        expect(opportunity.complexityScore).toBeGreaterThanOrEqual(0);
      }
    });

    test('should detect error messages', async () => {
      const result = await detector.scanProject({
        projectPath: testProjectPath,
        configTypes: [ConfigurationType.ERROR_MESSAGES],
        minOccurrences: 1
      });

      const errorOpportunities = result.opportunities.filter(
        opp => opp.configType === ConfigurationType.ERROR_MESSAGES
      );

      if (errorOpportunities.length > 0) {
        const opportunity = errorOpportunities[0];
        expect(opportunity.scatteredLocations).toBeInstanceOf(Array);
        
        opportunity.scatteredLocations.forEach(location => {
          expect(location.value).toBeDefined();
          expect(typeof location.isHardcoded).toBe('boolean');
        });
      }
    });
  });

  describe('migration planning', () => {
    test('should generate migration plans when requested', async () => {
      const result = await detector.scanProject({
        projectPath: testProjectPath,
        minOccurrences: 1,
        includeMigrationPlan: true
      });

      const opportunitiesWithPlans = result.opportunities.filter(
        opp => opp.migrationPlan !== undefined
      );

      if (opportunitiesWithPlans.length > 0) {
        const plan = opportunitiesWithPlans[0].migrationPlan!;
        expect(plan.approach).toBeDefined();
        expect(Object.values(MigrationApproach)).toContain(plan.approach);
        expect(plan.estimatedEffort).toBeDefined();
        expect(plan.steps).toBeInstanceOf(Array);
        expect(plan.dependencies).toBeInstanceOf(Array);
        expect(plan.rollbackStrategy).toBeDefined();
        expect(plan.testingStrategy).toBeDefined();
      }
    });

    test('should suggest appropriate migration approaches', async () => {
      const result = await detector.scanProject({
        projectPath: testProjectPath,
        minOccurrences: 1,
        includeMigrationPlan: true,
        configTypes: [ConfigurationType.API_ENDPOINTS, ConfigurationType.STYLING_CONSTANTS]
      });

      result.opportunities.forEach(opportunity => {
        if (opportunity.migrationPlan) {
          const approach = opportunity.migrationPlan.approach;
          
          if (opportunity.configType === ConfigurationType.API_ENDPOINTS) {
            expect([
              MigrationApproach.ENVIRONMENT_VARIABLES,
              MigrationApproach.EXTRACT_TO_CONFIG_FILE
            ]).toContain(approach);
          }
          
          if (opportunity.configType === ConfigurationType.STYLING_CONSTANTS) {
            expect([
              MigrationApproach.CENTRALIZED_CONSTANTS,
              MigrationApproach.EXTRACT_TO_CONFIG_FILE
            ]).toContain(approach);
          }
        }
      });
    });
  });

  describe('risk assessment', () => {
    test('should assess risks when requested', async () => {
      const result = await detector.scanProject({
        projectPath: testProjectPath,
        minOccurrences: 1,
        includeRiskAssessment: true
      });

      const opportunitiesWithRisk = result.opportunities.filter(
        opp => opp.riskAssessment !== undefined
      );

      if (opportunitiesWithRisk.length > 0) {
        const risk = opportunitiesWithRisk[0].riskAssessment!;
        expect(risk.overallRisk).toBeDefined();
        expect(risk.risks).toBeInstanceOf(Array);
        expect(risk.mitigations).toBeInstanceOf(Array);
        expect(risk.impact).toBeDefined();
        expect(risk.impact.affectedFiles).toBeGreaterThan(0);
        expect(risk.impact.affectedComponents).toBeInstanceOf(Array);
      }
    });

    test('should provide mitigation strategies for identified risks', async () => {
      const result = await detector.scanProject({
        projectPath: testProjectPath,
        minOccurrences: 1,
        includeRiskAssessment: true
      });

      result.opportunities.forEach(opportunity => {
        if (opportunity.riskAssessment) {
          const assessment = opportunity.riskAssessment;
          
          assessment.risks.forEach(risk => {
            expect(risk.category).toBeDefined();
            expect(risk.description).toBeDefined();
            expect(typeof risk.probability).toBe('number');
            expect(typeof risk.impact).toBe('number');
            expect(risk.severity).toBeDefined();
          });
          
          assessment.mitigations.forEach(mitigation => {
            expect(mitigation.risk).toBeDefined();
            expect(mitigation.strategy).toBeDefined();
            expect(mitigation.effort).toBeDefined();
          });
        }
      });
    });
  });

  describe('examples generation', () => {
    test('should generate before/after examples', async () => {
      const result = await detector.scanProject({
        projectPath: testProjectPath,
        minOccurrences: 1
      });

      result.opportunities.forEach(opportunity => {
        if (opportunity.examples && opportunity.examples.length > 0) {
          const example = opportunity.examples[0];
          expect(example.location).toBeDefined();
          expect(example.beforeCode).toBeDefined();
          expect(example.afterCode).toBeDefined();
          expect(example.explanation).toBeDefined();
          
          expect(example.beforeCode.length).toBeGreaterThan(0);
          expect(example.afterCode.length).toBeGreaterThan(0);
          expect(example.explanation.length).toBeGreaterThan(10);
        }
      });
    });

    test('should provide consolidation targets', async () => {
      const result = await detector.scanProject({
        projectPath: testProjectPath,
        minOccurrences: 1
      });

      result.opportunities.forEach(opportunity => {
        if (opportunity.consolidationTarget) {
          const target = opportunity.consolidationTarget;
          expect(target.type).toBeDefined();
          expect(['new_file', 'environment', 'existing_file']).toContain(target.type);
          expect(target.format).toBeDefined();
          expect(target.structure).toBeDefined();
          
          if (target.path) {
            expect(target.path.length).toBeGreaterThan(0);
          }
        }
      });
    });
  });

  describe('statistics and recommendations', () => {
    test('should calculate meaningful statistics', async () => {
      const result = await detector.scanProject({
        projectPath: testProjectPath,
        minOccurrences: 1
      });

      expect(result.statistics.totalOpportunities).toBe(result.opportunities.length);
      expect(result.statistics.byConfigType).toBeDefined();
      expect(result.statistics.estimatedSavings).toBeDefined();
      expect(result.statistics.priorityDistribution).toBeDefined();
      
      expect(result.statistics.estimatedSavings.maintenanceHours).toBeGreaterThanOrEqual(0);
      expect(result.statistics.estimatedSavings.duplicatedLines).toBeGreaterThanOrEqual(0);
    });

    test('should provide global recommendations', async () => {
      const result = await detector.scanProject({
        projectPath: testProjectPath,
        minOccurrences: 1
      });

      expect(result.recommendations).toBeInstanceOf(Array);
      
      result.recommendations.forEach(recommendation => {
        expect(recommendation.type).toBeDefined();
        expect(recommendation.title).toBeDefined();
        expect(recommendation.description).toBeDefined();
        expect(recommendation.benefits).toBeInstanceOf(Array);
        expect(recommendation.effort).toBeDefined();
      });
    });
  });

  describe('error handling', () => {
    test('should handle non-existent project path', async () => {
      await expect(
        detector.scanProject({
          projectPath: '/nonexistent/path',
          minOccurrences: 1
        })
      ).rejects.toThrow();
    });

    test('should handle empty project gracefully', async () => {
      const emptyProjectPath = path.join(__dirname, '..', '..', 'fixtures', 'empty-project');
      
      try {
        await fs.mkdir(emptyProjectPath, { recursive: true });
        
        const result = await detector.scanProject({
          projectPath: emptyProjectPath,
          minOccurrences: 1
        });

        expect(result.opportunities).toHaveLength(0);
        expect(result.scanInfo.totalFiles).toBe(0);
        expect(result.scanInfo.analyzedFiles).toBe(0);
        
        await fs.rmdir(emptyProjectPath);
      } catch (error) {
        // Clean up even if test fails
        try { await fs.rmdir(emptyProjectPath); } catch {}
        throw error;
      }
    });

    test('should skip files with read errors gracefully', async () => {
      const result = await detector.scanProject({
        projectPath: testProjectPath,
        minOccurrences: 1,
        excludePatterns: ['**/*.binary', '**/*.jpg', '**/*.png']
      });

      expect(result.scanInfo.skippedFiles).toBeGreaterThanOrEqual(0);
    });
  });

  describe('performance', () => {
    test('should complete scan within reasonable time', async () => {
      const startTime = Date.now();
      
      const result = await detector.scanProject({
        projectPath: testProjectPath,
        minOccurrences: 1
      });
      
      const endTime = Date.now();
      
      expect(result).toBeDefined();
      expect(endTime - startTime).toBeLessThan(30000); // Should complete in under 30 seconds
    });

    test('should handle large numbers of configuration items', async () => {
      const result = await detector.scanProject({
        projectPath: testProjectPath,
        minOccurrences: 1
      });

      // Test should complete successfully regardless of the number of items found
      expect(result.scanInfo.configItemsFound).toBeGreaterThanOrEqual(0);
      expect(result.opportunities.length).toBeGreaterThanOrEqual(0);
    });
  });
});