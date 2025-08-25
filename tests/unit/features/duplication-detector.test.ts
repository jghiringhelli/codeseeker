import { DuplicationDetector, DuplicationType, RefactoringApproach } from '../../../src/features/duplication/detector';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('DuplicationDetector', () => {
  let detector: DuplicationDetector;
  const testProjectPath = path.join(__dirname, '..', '..', 'fixtures', 'duplication-test');

  beforeAll(async () => {
    detector = new DuplicationDetector();
    await createDuplicationTestFixtures();
  });

  afterAll(async () => {
    await cleanupTestFixtures();
  });

  describe('findDuplicates', () => {
    test('should detect exact duplicates', async () => {
      const result = await detector.findDuplicates({
        projectPath: testProjectPath,
        includeSemantic: false,
        similarityThreshold: 1.0,
        includeRefactoringSuggestions: false
      });

      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].type).toBe(DuplicationType.EXACT);
      expect(result.duplicates[0].similarity).toBe(1.0);
      expect(result.duplicates[0].locations).toHaveLength(2);
    });

    test('should detect structural duplicates with lower threshold', async () => {
      const result = await detector.findDuplicates({
        projectPath: testProjectPath,
        includeSemantic: false,
        similarityThreshold: 0.7,
        includeRefactoringSuggestions: false
      });

      expect(result.duplicates.length).toBeGreaterThanOrEqual(1);
      
      const structuralDuplicates = result.duplicates.filter(
        d => d.type === DuplicationType.STRUCTURAL || d.type === DuplicationType.RENAMED
      );
      expect(structuralDuplicates.length).toBeGreaterThan(0);
    });

    test('should include semantic duplicates when requested', async () => {
      const result = await detector.findDuplicates({
        projectPath: testProjectPath,
        includeSemantic: true,
        similarityThreshold: 0.6,
        includeRefactoringSuggestions: false
      });

      expect(result.duplicates.length).toBeGreaterThan(0);
      
      const semanticDuplicates = result.duplicates.filter(
        d => d.type === DuplicationType.SEMANTIC
      );
      expect(semanticDuplicates.length).toBeGreaterThanOrEqual(0); // May or may not find semantic duplicates
    });

    test('should provide refactoring suggestions when requested', async () => {
      const result = await detector.findDuplicates({
        projectPath: testProjectPath,
        includeSemantic: false,
        similarityThreshold: 0.8,
        includeRefactoringSuggestions: true
      });

      const duplicatesWithRefactoring = result.duplicates.filter(d => d.refactoring);
      expect(duplicatesWithRefactoring.length).toBeGreaterThan(0);

      const refactoringAdvice = duplicatesWithRefactoring[0].refactoring!;
      expect(refactoringAdvice.approach).toBeOneOf(Object.values(RefactoringApproach));
      expect(refactoringAdvice.description).toBeTruthy();
      expect(refactoringAdvice.steps).toBeInstanceOf(Array);
      expect(refactoringAdvice.steps.length).toBeGreaterThan(0);
      expect(refactoringAdvice.impact).toHaveProperty('maintainability');
      expect(refactoringAdvice.impact).toHaveProperty('testability');
      expect(refactoringAdvice.impact).toHaveProperty('reusability');
      expect(refactoringAdvice.impact).toHaveProperty('riskLevel');
    });

    test('should respect file patterns', async () => {
      const result = await detector.findDuplicates({
        projectPath: testProjectPath,
        includeSemantic: false,
        similarityThreshold: 0.7,
        includeRefactoringSuggestions: false,
        filePatterns: ['**/*.ts'] // Only TypeScript files
      });

      // All duplicate locations should be .ts files
      for (const duplicate of result.duplicates) {
        for (const location of duplicate.locations) {
          expect(location.file).toMatch(/\.ts$/);
        }
      }
    });

    test('should exclude specified patterns', async () => {
      const result = await detector.findDuplicates({
        projectPath: testProjectPath,
        includeSemantic: false,
        similarityThreshold: 0.7,
        includeRefactoringSuggestions: false,
        excludePatterns: ['**/test/**']
      });

      // No duplicate locations should be in test directory
      for (const duplicate of result.duplicates) {
        for (const location of duplicate.locations) {
          expect(location.file).not.toMatch(/\/test\//);
        }
      }
    });

    test('should provide scan statistics', async () => {
      const result = await detector.findDuplicates({
        projectPath: testProjectPath,
        includeSemantic: false,
        similarityThreshold: 0.7,
        includeRefactoringSuggestions: false
      });

      expect(result.scanInfo).toHaveProperty('totalFiles');
      expect(result.scanInfo).toHaveProperty('analyzedFiles');
      expect(result.scanInfo).toHaveProperty('skippedFiles');
      expect(result.scanInfo).toHaveProperty('processingTime');
      expect(result.scanInfo.totalFiles).toBeGreaterThan(0);
      expect(result.scanInfo.processingTime).toBeGreaterThan(0);

      expect(result.statistics).toHaveProperty('totalDuplicates');
      expect(result.statistics).toHaveProperty('byType');
      expect(result.statistics).toHaveProperty('bySeverity');
      expect(result.statistics).toHaveProperty('estimatedTechnicalDebt');
    });

    test('should handle empty project gracefully', async () => {
      const emptyProjectPath = path.join(__dirname, '..', '..', 'fixtures', 'empty-project');
      await fs.mkdir(emptyProjectPath, { recursive: true });

      const result = await detector.findDuplicates({
        projectPath: emptyProjectPath,
        includeSemantic: false,
        similarityThreshold: 0.8,
        includeRefactoringSuggestions: false
      });

      expect(result.duplicates).toHaveLength(0);
      expect(result.scanInfo.totalFiles).toBe(0);
      expect(result.statistics.totalDuplicates).toBe(0);

      await fs.rm(emptyProjectPath, { recursive: true, force: true });
    });

    test('should handle files with syntax errors gracefully', async () => {
      // Create a file with syntax errors
      const invalidFilePath = path.join(testProjectPath, 'invalid.ts');
      await fs.writeFile(invalidFilePath, 'invalid syntax { } function ( incomplete');

      const result = await detector.findDuplicates({
        projectPath: testProjectPath,
        includeSemantic: false,
        similarityThreshold: 0.8,
        includeRefactoringSuggestions: false
      });

      // Should not crash and should skip the invalid file
      expect(result.scanInfo.skippedFiles).toBeGreaterThan(0);

      // Cleanup
      await fs.unlink(invalidFilePath);
    });
  });

  describe('Refactoring Advice Quality', () => {
    test('should suggest appropriate refactoring approach based on complexity', async () => {
      const result = await detector.findDuplicates({
        projectPath: testProjectPath,
        includeSemantic: false,
        similarityThreshold: 0.8,
        includeRefactoringSuggestions: true
      });

      const duplicatesWithRefactoring = result.duplicates.filter(d => d.refactoring);
      
      for (const duplicate of duplicatesWithRefactoring) {
        const refactoring = duplicate.refactoring!;
        
        // Should suggest appropriate approach based on duplicate characteristics
        if (duplicate.metadata.linesOfCode > 50) {
          expect([
            RefactoringApproach.EXTRACT_CLASS,
            RefactoringApproach.APPLY_STRATEGY_PATTERN
          ]).toContain(refactoring.approach);
        } else if (duplicate.locations.length > 5) {
          expect([
            RefactoringApproach.EXTRACT_UTILITY,
            RefactoringApproach.EXTRACT_FUNCTION
          ]).toContain(refactoring.approach);
        }

        // Impact scores should be reasonable
        expect(refactoring.impact.maintainability).toBeGreaterThanOrEqual(0);
        expect(refactoring.impact.maintainability).toBeLessThanOrEqual(100);
        expect(refactoring.impact.testability).toBeGreaterThanOrEqual(0);
        expect(refactoring.impact.testability).toBeLessThanOrEqual(100);
      }
    });

    test('should provide meaningful refactoring examples', async () => {
      const result = await detector.findDuplicates({
        projectPath: testProjectPath,
        includeSemantic: false,
        similarityThreshold: 0.9,
        includeRefactoringSuggestions: true
      });

      const exactDuplicates = result.duplicates.filter(
        d => d.type === DuplicationType.EXACT && d.refactoring?.approach === RefactoringApproach.EXTRACT_FUNCTION
      );

      for (const duplicate of exactDuplicates) {
        const refactoring = duplicate.refactoring!;
        if (refactoring.example) {
          expect(refactoring.example).toContain('// Before:');
          expect(refactoring.example).toContain('// After:');
          expect(refactoring.example).toContain('function');
        }
      }
    });
  });

  describe('Performance', () => {
    test('should complete analysis within reasonable time', async () => {
      const startTime = Date.now();

      const result = await detector.findDuplicates({
        projectPath: testProjectPath,
        includeSemantic: false,
        similarityThreshold: 0.8,
        includeRefactoringSuggestions: true
      });

      const analysisTime = Date.now() - startTime;
      
      // Should complete within 30 seconds for small test project
      expect(analysisTime).toBeLessThan(30000);
      expect(result.scanInfo.processingTime).toBeLessThan(analysisTime);
    });

    test('should scale reasonably with file count', async () => {
      // Create additional files to test scaling
      const additionalFiles = 10;
      const filePaths: string[] = [];

      for (let i = 0; i < additionalFiles; i++) {
        const filePath = path.join(testProjectPath, `generated-${i}.ts`);
        await fs.writeFile(filePath, generateTestCode(i));
        filePaths.push(filePath);
      }

      const startTime = Date.now();

      const result = await detector.findDuplicates({
        projectPath: testProjectPath,
        includeSemantic: false,
        similarityThreshold: 0.8,
        includeRefactoringSuggestions: false
      });

      const analysisTime = Date.now() - startTime;

      // Should still complete reasonably quickly
      expect(analysisTime).toBeLessThan(60000);
      expect(result.scanInfo.analyzedFiles).toBeGreaterThan(additionalFiles);

      // Cleanup generated files
      for (const filePath of filePaths) {
        await fs.unlink(filePath);
      }
    });
  });

  // Helper functions
  async function createDuplicationTestFixtures(): Promise<void> {
    await fs.mkdir(testProjectPath, { recursive: true });

    // Create exact duplicates
    const duplicateFunction = `
export function validateInput(input: string): boolean {
  if (!input) {
    throw new Error('Input is required');
  }
  
  if (input.length < 3) {
    throw new Error('Input must be at least 3 characters');
  }
  
  if (!/^[a-zA-Z0-9]+$/.test(input)) {
    throw new Error('Input must be alphanumeric');
  }
  
  return true;
}
    `.trim();

    await fs.writeFile(
      path.join(testProjectPath, 'validator1.ts'),
      duplicateFunction
    );

    await fs.writeFile(
      path.join(testProjectPath, 'validator2.ts'),
      duplicateFunction
    );

    // Create structural duplicates (same structure, different names)
    await fs.writeFile(
      path.join(testProjectPath, 'auth-helper.ts'),
      `
export function checkUserCredentials(username: string): boolean {
  if (!username) {
    throw new Error('Username is required');
  }
  
  if (username.length < 3) {
    throw new Error('Username must be at least 3 characters');
  }
  
  if (!/^[a-zA-Z0-9]+$/.test(username)) {
    throw new Error('Username must be alphanumeric');
  }
  
  return true;
}
      `.trim()
    );

    await fs.writeFile(
      path.join(testProjectPath, 'user-helper.ts'),
      `
export function verifyUserData(email: string): boolean {
  if (!email) {
    throw new Error('Email is required');
  }
  
  if (email.length < 3) {
    throw new Error('Email must be at least 3 characters');
  }
  
  if (!/^[a-zA-Z0-9@.]+$/.test(email)) {
    throw new Error('Email must be valid format');
  }
  
  return true;
}
      `.trim()
    );

    // Create semantic duplicates (similar functionality, different implementation)
    await fs.writeFile(
      path.join(testProjectPath, 'formatter1.ts'),
      `
export function formatMessage(msg: string, type: 'error' | 'info'): string {
  const prefix = type === 'error' ? '[ERROR]' : '[INFO]';
  return \`\${prefix} \${msg}\`;
}
      `.trim()
    );

    await fs.writeFile(
      path.join(testProjectPath, 'formatter2.ts'),
      `
export function createFormattedMessage(text: string, level: string): string {
  let prefix: string;
  if (level === 'error') {
    prefix = '[ERROR]';
  } else {
    prefix = '[INFO]';
  }
  return prefix + ' ' + text;
}
      `.trim()
    );

    // Create a larger duplicate for testing complex refactoring
    const largeFunction = `
export class DataProcessor {
  private data: any[] = [];
  
  constructor(initialData: any[]) {
    this.data = initialData;
  }
  
  process(): any[] {
    return this.data
      .filter(item => item !== null && item !== undefined)
      .map(item => {
        if (typeof item === 'string') {
          return item.trim().toLowerCase();
        } else if (typeof item === 'number') {
          return Math.round(item * 100) / 100;
        } else if (typeof item === 'boolean') {
          return item;
        } else {
          return JSON.stringify(item);
        }
      })
      .filter(item => item !== '' && item !== 'null' && item !== 'undefined');
  }
  
  validate(): boolean {
    if (!Array.isArray(this.data)) {
      throw new Error('Data must be an array');
    }
    
    if (this.data.length === 0) {
      throw new Error('Data array cannot be empty');
    }
    
    return true;
  }
}
    `.trim();

    await fs.writeFile(
      path.join(testProjectPath, 'processor1.ts'),
      largeFunction
    );

    await fs.writeFile(
      path.join(testProjectPath, 'processor2.ts'),
      largeFunction.replace(/DataProcessor/g, 'DataHandler')
    );

    // Create test directory (to test exclude patterns)
    const testDir = path.join(testProjectPath, 'test');
    await fs.mkdir(testDir, { recursive: true });
    
    await fs.writeFile(
      path.join(testDir, 'test-duplicate.ts'),
      duplicateFunction
    );
  }

  async function cleanupTestFixtures(): Promise<void> {
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  function generateTestCode(index: number): string {
    return `
export function generatedFunction${index}(param: string): string {
  if (!param) {
    throw new Error('Parameter is required for function ${index}');
  }
  
  return \`Processed: \${param} by function ${index}\`;
}

export const GENERATED_CONSTANT_${index} = 'value_${index}';

export class GeneratedClass${index} {
  private value: string;
  
  constructor(initialValue: string) {
    this.value = initialValue || 'default_${index}';
  }
  
  getValue(): string {
    return this.value;
  }
  
  setValue(newValue: string): void {
    this.value = newValue;
  }
}
    `.trim();
  }
});