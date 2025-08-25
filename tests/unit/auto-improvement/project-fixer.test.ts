import { ProjectFixer, ProjectFixerOptions, AutoFixType } from '../../../src/auto-improvement/project-fixer';
import * as path from 'path';
import * as fs from 'fs/promises';

describe('ProjectFixer', () => {
  let fixer: ProjectFixer;
  const testProjectPath = path.join(__dirname, '..', '..', 'fixtures', 'test-project');
  const tempOutputPath = path.join(__dirname, '..', '..', 'fixtures', 'temp-output');

  beforeAll(() => {
    fixer = new ProjectFixer();
  });

  beforeEach(async () => {
    // Ensure temp output directory exists
    try {
      await fs.mkdir(tempOutputPath, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore
    }
  });

  afterEach(async () => {
    // Clean up temp output directory
    try {
      await fs.rmdir(tempOutputPath, { recursive: true });
    } catch (error) {
      // Directory might not exist, ignore
    }
  });

  describe('analyzeAndFix', () => {
    test('should analyze project and return comprehensive report', async () => {
      const options: ProjectFixerOptions = {
        projectPath: testProjectPath,
        outputPath: tempOutputPath,
        dryRun: true,
        fixTypes: [AutoFixType.ALL],
        aggressiveness: 'moderate',
        backupOriginal: false,
        generateReport: true
      };

      const report = await fixer.analyzeAndFix(options);

      expect(report).toBeDefined();
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.projectPath).toBe(testProjectPath);
      expect(report.summary).toBeDefined();
      expect(report.fixes).toBeInstanceOf(Array);
      expect(report.recommendations).toBeInstanceOf(Array);
      expect(report.nextSteps).toBeInstanceOf(Array);
      expect(report.metrics).toBeDefined();
      expect(report.metrics.before).toBeDefined();
      expect(report.metrics.after).toBeDefined();
      expect(report.metrics.improvement).toBeDefined();
    });

    test('should handle dry run mode correctly', async () => {
      const options: ProjectFixerOptions = {
        projectPath: testProjectPath,
        dryRun: true,
        fixTypes: [AutoFixType.DUPLICATES],
        generateReport: false
      };

      const report = await fixer.analyzeAndFix(options);

      // In dry run mode, no actual changes should be made
      expect(report.summary.filesModified).toBe(0);
      expect(report.summary.linesChanged).toBe(0);
      
      // But analysis should still occur
      expect(report.summary.filesAnalyzed).toBeGreaterThan(0);
      expect(report.summary.totalIssuesFound).toBeGreaterThanOrEqual(0);
    });

    test('should apply specific fix types when requested', async () => {
      const options: ProjectFixerOptions = {
        projectPath: testProjectPath,
        dryRun: true,
        fixTypes: [AutoFixType.DUPLICATES, AutoFixType.CENTRALIZATION],
        generateReport: false
      };

      const report = await fixer.analyzeAndFix(options);

      // Should only have fixes for requested types
      const fixTypes = [...new Set(report.fixes.map(f => f.fixType))];
      expect(fixTypes.every(type => 
        type === AutoFixType.DUPLICATES || type === AutoFixType.CENTRALIZATION
      )).toBe(true);
    });

    test('should calculate quality metrics correctly', async () => {
      const options: ProjectFixerOptions = {
        projectPath: testProjectPath,
        dryRun: true,
        generateReport: false
      };

      const report = await fixer.analyzeAndFix(options);

      expect(report.metrics.before.qualityScore).toBeGreaterThanOrEqual(0);
      expect(report.metrics.before.qualityScore).toBeLessThanOrEqual(100);
      expect(report.metrics.after.qualityScore).toBeGreaterThanOrEqual(0);
      expect(report.metrics.after.qualityScore).toBeLessThanOrEqual(100);
      
      expect(typeof report.metrics.before.duplicateLines).toBe('number');
      expect(typeof report.metrics.before.scatteredConfigs).toBe('number');
      expect(typeof report.metrics.before.circularDependencies).toBe('number');
    });

    test('should handle different aggressiveness levels', async () => {
      const conservativeOptions: ProjectFixerOptions = {
        projectPath: testProjectPath,
        dryRun: true,
        aggressiveness: 'conservative',
        generateReport: false
      };

      const aggressiveOptions: ProjectFixerOptions = {
        projectPath: testProjectPath,
        dryRun: true,
        aggressiveness: 'aggressive',
        generateReport: false
      };

      const conservativeReport = await fixer.analyzeAndFix(conservativeOptions);
      const aggressiveReport = await fixer.analyzeAndFix(aggressiveOptions);

      // Both should complete successfully
      expect(conservativeReport).toBeDefined();
      expect(aggressiveReport).toBeDefined();
      
      // Aggressive mode might potentially find or attempt more fixes
      // But in dry run mode, this mainly affects the suggestions/recommendations
      expect(conservativeReport.recommendations).toBeInstanceOf(Array);
      expect(aggressiveReport.recommendations).toBeInstanceOf(Array);
    });
  });

  describe('project validation', () => {
    test('should reject non-existent project path', async () => {
      const options: ProjectFixerOptions = {
        projectPath: '/nonexistent/path',
        dryRun: true,
        generateReport: false
      };

      await expect(fixer.analyzeAndFix(options)).rejects.toThrow();
    });

    test('should reject non-directory path', async () => {
      // Create a temporary file
      const tempFile = path.join(tempOutputPath, 'not-a-directory.txt');
      await fs.writeFile(tempFile, 'test content');

      const options: ProjectFixerOptions = {
        projectPath: tempFile,
        dryRun: true,
        generateReport: false
      };

      await expect(fixer.analyzeAndFix(options)).rejects.toThrow();
    });
  });

  describe('fix categorization', () => {
    test('should categorize duplicate fixes correctly', async () => {
      const options: ProjectFixerOptions = {
        projectPath: testProjectPath,
        dryRun: true,
        fixTypes: [AutoFixType.DUPLICATES],
        generateReport: false
      };

      const report = await fixer.analyzeAndFix(options);
      const duplicateFixes = report.fixes.filter(f => f.fixType === AutoFixType.DUPLICATES);
      
      duplicateFixes.forEach(fix => {
        expect(fix.fixType).toBe(AutoFixType.DUPLICATES);
        expect(fix.description).toContain('duplicate');
        expect(['low', 'medium', 'high']).toContain(fix.effort);
        expect(fix.benefitScore).toBeGreaterThanOrEqual(0);
      });
    });

    test('should categorize centralization fixes correctly', async () => {
      const options: ProjectFixerOptions = {
        projectPath: testProjectPath,
        dryRun: true,
        fixTypes: [AutoFixType.CENTRALIZATION],
        generateReport: false
      };

      const report = await fixer.analyzeAndFix(options);
      const centralizationFixes = report.fixes.filter(f => f.fixType === AutoFixType.CENTRALIZATION);
      
      centralizationFixes.forEach(fix => {
        expect(fix.fixType).toBe(AutoFixType.CENTRALIZATION);
        expect(fix.description).toMatch(/centralized?/i);
        expect(['low', 'medium', 'high']).toContain(fix.effort);
        expect(fix.benefitScore).toBeGreaterThanOrEqual(0);
      });
    });

    test('should categorize dependency fixes correctly', async () => {
      const options: ProjectFixerOptions = {
        projectPath: testProjectPath,
        dryRun: true,
        fixTypes: [AutoFixType.DEPENDENCIES],
        generateReport: false
      };

      const report = await fixer.analyzeAndFix(options);
      const dependencyFixes = report.fixes.filter(f => f.fixType === AutoFixType.DEPENDENCIES);
      
      dependencyFixes.forEach(fix => {
        expect(fix.fixType).toBe(AutoFixType.DEPENDENCIES);
        expect(fix.description).toMatch(/dependency|dependencies/i);
        expect(['low', 'medium', 'high']).toContain(fix.effort);
        expect(fix.benefitScore).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('report generation', () => {
    test('should generate reports when requested', async () => {
      const options: ProjectFixerOptions = {
        projectPath: testProjectPath,
        outputPath: tempOutputPath,
        dryRun: true,
        generateReport: true
      };

      await fixer.analyzeAndFix(options);

      // Check if report files were created
      const jsonReportPath = path.join(tempOutputPath, 'codemind-improvement-report.json');
      const markdownReportPath = path.join(tempOutputPath, 'codemind-improvement-report.md');

      const jsonExists = await fs.access(jsonReportPath).then(() => true).catch(() => false);
      const markdownExists = await fs.access(markdownReportPath).then(() => true).catch(() => false);

      expect(jsonExists).toBe(true);
      expect(markdownExists).toBe(true);
    });

    test('should skip report generation when disabled', async () => {
      const options: ProjectFixerOptions = {
        projectPath: testProjectPath,
        outputPath: tempOutputPath,
        dryRun: true,
        generateReport: false
      };

      await fixer.analyzeAndFix(options);

      // Check that report files were NOT created
      const jsonReportPath = path.join(tempOutputPath, 'codemind-improvement-report.json');
      const markdownReportPath = path.join(tempOutputPath, 'codemind-improvement-report.md');

      const jsonExists = await fs.access(jsonReportPath).then(() => true).catch(() => false);
      const markdownExists = await fs.access(markdownReportPath).then(() => true).catch(() => false);

      expect(jsonExists).toBe(false);
      expect(markdownExists).toBe(false);
    });
  });

  describe('metrics calculation', () => {
    test('should calculate improvement metrics correctly', async () => {
      const options: ProjectFixerOptions = {
        projectPath: testProjectPath,
        dryRun: true,
        generateReport: false
      };

      const report = await fixer.analyzeAndFix(options);

      // Improvement metrics should be difference between after and before
      expect(report.metrics.improvement.qualityScore).toBe(
        report.metrics.after.qualityScore - report.metrics.before.qualityScore
      );
      
      expect(report.metrics.improvement.duplicateLines).toBe(
        report.metrics.before.duplicateLines - report.metrics.after.duplicateLines
      );
      
      expect(report.metrics.improvement.scatteredConfigs).toBe(
        report.metrics.before.scatteredConfigs - report.metrics.after.scatteredConfigs
      );
      
      expect(report.metrics.improvement.circularDependencies).toBe(
        report.metrics.before.circularDependencies - report.metrics.after.circularDependencies
      );
    });

    test('should provide meaningful recommendations', async () => {
      const options: ProjectFixerOptions = {
        projectPath: testProjectPath,
        dryRun: true,
        generateReport: false
      };

      const report = await fixer.analyzeAndFix(options);

      expect(report.recommendations).toBeInstanceOf(Array);
      expect(report.nextSteps).toBeInstanceOf(Array);
      
      // Should provide at least some recommendations
      expect(report.recommendations.length + report.nextSteps.length).toBeGreaterThan(0);
      
      // Each recommendation should be a meaningful string
      report.recommendations.forEach(rec => {
        expect(typeof rec).toBe('string');
        expect(rec.length).toBeGreaterThan(10);
      });
      
      report.nextSteps.forEach(step => {
        expect(typeof step).toBe('string');
        expect(step.length).toBeGreaterThan(10);
      });
    });
  });

  describe('error handling', () => {
    test('should handle analysis errors gracefully', async () => {
      // Test with a directory that exists but has permission issues or malformed files
      const options: ProjectFixerOptions = {
        projectPath: tempOutputPath, // Empty directory
        dryRun: true,
        generateReport: false
      };

      const report = await fixer.analyzeAndFix(options);

      // Should complete without throwing, even with no analyzable files
      expect(report).toBeDefined();
      expect(report.summary.filesAnalyzed).toBe(0);
      expect(report.summary.totalIssuesFound).toBe(0);
    });

    test('should handle fix application errors in dry run', async () => {
      const options: ProjectFixerOptions = {
        projectPath: testProjectPath,
        dryRun: true,
        fixTypes: [AutoFixType.ALL],
        generateReport: false
      };

      // Should not throw even if fixes would fail in live mode
      const report = await fixer.analyzeAndFix(options);
      expect(report).toBeDefined();
    });
  });

  describe('performance', () => {
    test('should complete analysis within reasonable time', async () => {
      const options: ProjectFixerOptions = {
        projectPath: testProjectPath,
        dryRun: true,
        generateReport: false
      };

      const startTime = Date.now();
      const report = await fixer.analyzeAndFix(options);
      const endTime = Date.now();

      expect(report).toBeDefined();
      expect(endTime - startTime).toBeLessThan(30000); // Should complete in under 30 seconds
    });
  });
});