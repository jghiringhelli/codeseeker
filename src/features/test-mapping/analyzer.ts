import { Logger } from '../../utils/logger';
import { cliLogger } from '../../utils/colored-logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

export interface TestFile {
  path: string;
  testFramework: 'jest' | 'mocha' | 'vitest' | 'cypress' | 'playwright' | 'unknown';
  testCount: number;
  testTypes: ('unit' | 'integration' | 'e2e')[];
  coveredFiles: TestFileMapping[];
  testMethods: TestMethod[];
}

export interface TestFileMapping {
  sourceFile: string;
  importPath: string;
  mappingType: 'direct' | 'dependency' | 'mock' | 'fixture';
  lastUpdated?: Date;
  sourceLastModified?: Date;
  needsUpdate: boolean;
  confidence: number; // 0-1, how confident we are about this mapping
}

export interface TestMethod {
  name: string;
  line: number;
  type: 'unit' | 'integration' | 'e2e';
  testedFunctions: string[];
  testedClasses: string[];
  mocks: string[];
  fixtures: string[];
  dependencies: string[];
}

export interface SourceFile {
  path: string;
  functions: SourceFunction[];
  classes: SourceClass[];
  exports: string[];
  lastModified: Date;
  testFiles: string[];
  untested: boolean;
}

export interface SourceFunction {
  name: string;
  line: number;
  complexity: number;
  isPublic: boolean;
  testMethods: string[];
  needsTestUpdate: boolean;
}

export interface SourceClass {
  name: string;
  line: number;
  methods: string[];
  testFiles: string[];
  needsTestUpdate: boolean;
}

export interface TestMaintenanceIssue {
  type: 'outdated_test' | 'missing_test' | 'orphaned_test' | 'broken_mapping' | 'mock_mismatch';
  severity: 'low' | 'medium' | 'high' | 'critical';
  sourceFile?: string;
  testFile?: string;
  description: string;
  suggestion: string;
  affectedFunctions?: string[];
  lastChecked: Date;
}

export interface TestMappingResult {
  testFiles: TestFile[];
  sourceFiles: SourceFile[];
  testMappings: Map<string, string[]>; // source file -> test files
  reverseTestMappings: Map<string, string[]>; // test file -> source files
  maintenanceIssues: TestMaintenanceIssue[];
  staleTests: string[];
  untestedFunctions: string[];
  recommendations: string[];
  syncActions: TestSyncAction[];
}

export interface TestSyncAction {
  action: 'update_test' | 'create_test' | 'remove_test' | 'fix_import' | 'update_mock';
  priority: 'low' | 'medium' | 'high' | 'critical';
  sourceFile?: string;
  testFile?: string;
  description: string;
  suggestedCode?: string;
  reason: string;
}

export class TestMappingAnalyzer {
  private logger = Logger.getInstance();

  async analyzeTestMapping(params: {
    projectPath: string;
    includeE2E?: boolean;
    excludePatterns?: string[];
    checkStaleTests?: boolean;
    autoSync?: boolean;
  }): Promise<TestMappingResult> {
    const startTime = Date.now();
    
    cliLogger.toolExecution('test-mapping-analyzer', 'started');
    
    try {
      // 1. Find all test files and analyze them
      const testFiles = await this.findAndAnalyzeTestFiles(params.projectPath, params.excludePatterns);
      
      // 2. Find all source files and analyze them
      const sourceFiles = await this.findAndAnalyzeSourceFiles(params.projectPath, params.excludePatterns);
      
      // 3. Build bidirectional test mappings
      const { testMappings, reverseTestMappings } = await this.buildTestMappings(testFiles, sourceFiles);
      
      // 4. Check for stale tests (tests that test deleted/modified code)
      const staleTests = params.checkStaleTests ? 
        await this.findStaleTests(testFiles, sourceFiles) : [];
      
      // 5. Find untested functions that need tests
      const untestedFunctions = await this.findUntestedFunctions(sourceFiles, testMappings);
      
      // 6. Identify maintenance issues
      const maintenanceIssues = await this.identifyMaintenanceIssues(
        testFiles, 
        sourceFiles, 
        testMappings
      );
      
      // 7. Generate sync actions
      const syncActions = await this.generateSyncActions(
        maintenanceIssues,
        staleTests,
        untestedFunctions,
        params.autoSync
      );
      
      // 8. Generate recommendations
      const recommendations = this.generateMappingRecommendations(
        maintenanceIssues,
        syncActions,
        testMappings
      );
      
      const result: TestMappingResult = {
        testFiles,
        sourceFiles,
        testMappings,
        reverseTestMappings,
        maintenanceIssues,
        staleTests,
        untestedFunctions,
        recommendations,
        syncActions
      };
      
      const duration = Date.now() - startTime;
      cliLogger.toolExecution('test-mapping-analyzer', 'completed', duration, {
        testFilesFound: testFiles.length,
        sourceFilesFound: sourceFiles.length,
        mappingsCreated: testMappings.size,
        maintenanceIssues: maintenanceIssues.length,
        staleTests: staleTests.length,
        untestedFunctions: untestedFunctions.length,
        syncActions: syncActions.length
      });
      
      return result;
      
    } catch (error) {
      cliLogger.toolExecution('test-mapping-analyzer', 'failed', Date.now() - startTime, error);
      throw error;
    }
  }

  private async findAndAnalyzeTestFiles(projectPath: string, excludePatterns?: string[]): Promise<TestFile[]> {
    const testPatterns = [
      '**/*.test.{js,ts,tsx,jsx}',
      '**/*.spec.{js,ts,tsx,jsx}',
      '**/test/**/*.{js,ts,tsx,jsx}',
      '**/tests/**/*.{js,ts,tsx,jsx}',
      '**/__tests__/**/*.{js,ts,tsx,jsx}',
      '!**/node_modules/**'
    ];

    if (excludePatterns) {
      testPatterns.push(...excludePatterns.map(p => `!${p}`));
    }

    const testFiles: TestFile[] = [];
    const files = await glob(testPatterns, { cwd: projectPath });

    for (const file of files) {
      const fullPath = path.join(projectPath, file);
      const testFile = await this.analyzeTestFile(fullPath);
      if (testFile) {
        testFiles.push(testFile);
      }
    }

    return testFiles;
  }

  private async findAndAnalyzeSourceFiles(projectPath: string, excludePatterns?: string[]): Promise<SourceFile[]> {
    const sourcePatterns = [
      'src/**/*.{js,ts,tsx,jsx}',
      'lib/**/*.{js,ts,tsx,jsx}',
      '!**/*.test.{js,ts,tsx,jsx}',
      '!**/*.spec.{js,ts,tsx,jsx}',
      '!**/node_modules/**'
    ];

    if (excludePatterns) {
      sourcePatterns.push(...excludePatterns.map(p => `!${p}`));
    }

    const sourceFiles: SourceFile[] = [];
    const files = await glob(sourcePatterns, { cwd: projectPath });

    for (const file of files) {
      const fullPath = path.join(projectPath, file);
      const sourceFile = await this.analyzeSourceFile(fullPath);
      if (sourceFile) {
        sourceFiles.push(sourceFile);
      }
    }

    return sourceFiles;
  }

  private async analyzeTestFile(filePath: string): Promise<TestFile | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);
      
      // Detect test framework
      const testFramework = this.detectTestFramework(content);
      
      // Count tests and analyze methods
      const testMethods = this.extractTestMethods(content);
      const testCount = testMethods.length;
      
      // Determine test types
      const testTypes = this.determineTestTypes(filePath, content);
      
      // Find covered files through imports and mocks
      const coveredFiles = await this.mapTestToSourceFiles(content, filePath);
      
      return {
        path: filePath,
        testFramework,
        testCount,
        testTypes,
        coveredFiles,
        testMethods
      };
    } catch (error) {
      this.logger.warn(`Failed to analyze test file ${filePath}:`, error);
      return null;
    }
  }

  private async analyzeSourceFile(filePath: string): Promise<SourceFile | null> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);
      
      // Extract functions and classes
      const functions = this.extractFunctions(content);
      const classes = this.extractClasses(content);
      const exports = this.extractExports(content);
      
      return {
        path: filePath,
        functions,
        classes,
        exports,
        lastModified: stats.mtime,
        testFiles: [], // Will be populated during mapping
        untested: true // Will be updated during mapping
      };
    } catch (error) {
      this.logger.warn(`Failed to analyze source file ${filePath}:`, error);
      return null;
    }
  }

  private async buildTestMappings(testFiles: TestFile[], sourceFiles: SourceFile[]): Promise<{
    testMappings: Map<string, string[]>;
    reverseTestMappings: Map<string, string[]>;
  }> {
    const testMappings = new Map<string, string[]>();
    const reverseTestMappings = new Map<string, string[]>();
    
    // Build source file -> test files mapping
    for (const testFile of testFiles) {
      reverseTestMappings.set(testFile.path, []);
      
      for (const mapping of testFile.coveredFiles) {
        const sourceFile = mapping.sourceFile;
        
        // Add to source -> test mapping
        if (!testMappings.has(sourceFile)) {
          testMappings.set(sourceFile, []);
        }
        testMappings.get(sourceFile)!.push(testFile.path);
        
        // Add to test -> source mapping
        reverseTestMappings.get(testFile.path)!.push(sourceFile);
      }
    }
    
    // Update source files with their test mappings
    for (const sourceFile of sourceFiles) {
      sourceFile.testFiles = testMappings.get(sourceFile.path) || [];
      sourceFile.untested = sourceFile.testFiles.length === 0;
    }
    
    return { testMappings, reverseTestMappings };
  }

  private detectTestFramework(content: string): TestFile['testFramework'] {
    if (content.includes('describe') && content.includes('it')) {
      if (content.includes('@jest') || content.includes('jest.')) return 'jest';
      if (content.includes('mocha')) return 'mocha';
      if (content.includes('vitest') || content.includes('vi.')) return 'vitest';
      return 'jest'; // Default for describe/it pattern
    }
    
    if (content.includes('cy.') || content.includes('cypress')) return 'cypress';
    if (content.includes('page.') && content.includes('test(')) return 'playwright';
    
    return 'unknown';
  }

  private extractTestMethods(content: string): TestMethod[] {
    const methods: TestMethod[] = [];
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Match test method patterns
      const testPatterns = [
        /\bit\s*\(\s*['"`]([^'"`]+)['"`]/,
        /\btest\s*\(\s*['"`]([^'"`]+)['"`]/,
        /\bshould\s*\(\s*['"`]([^'"`]+)['"`]/
      ];
      
      for (const pattern of testPatterns) {
        const match = pattern.exec(line);
        if (match) {
          const testName = match[1];
          const testedFunctions = this.extractTestedFunctions(line, lines, index);
          const mocks = this.extractMocks(line, lines, index);
          
          methods.push({
            name: testName,
            line: index + 1,
            type: this.inferTestType(testName, line),
            testedFunctions,
            testedClasses: [],
            mocks,
            fixtures: [],
            dependencies: []
          });
          break;
        }
      }
    });
    
    return methods;
  }

  private extractTestedFunctions(line: string, lines: string[], startIndex: number): string[] {
    const functions: string[] = [];
    
    // Look for function calls in test method and surrounding context
    const testBlock = lines.slice(startIndex, Math.min(startIndex + 20, lines.length)).join(' ');
    
    // Extract function call patterns
    const functionCallPatterns = [
      /(\w+)\s*\(/g,
      /\.(\w+)\s*\(/g,
      /expect\s*\(\s*(\w+)/g
    ];
    
    for (const pattern of functionCallPatterns) {
      let match;
      while ((match = pattern.exec(testBlock)) !== null) {
        const funcName = match[1];
        if (funcName && funcName.length > 2 && !this.isTestKeyword(funcName)) {
          functions.push(funcName);
        }
      }
    }
    
    return [...new Set(functions)];
  }

  private extractMocks(line: string, lines: string[], startIndex: number): string[] {
    const mocks: string[] = [];
    
    const testBlock = lines.slice(Math.max(0, startIndex - 5), startIndex + 15).join(' ');
    
    const mockPatterns = [
      /mock\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /jest\.mock\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /vi\.mock\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /mockImplementation/g,
      /spyOn\s*\(\s*(\w+)/g
    ];
    
    for (const pattern of mockPatterns) {
      let match;
      while ((match = pattern.exec(testBlock)) !== null) {
        if (match[1]) {
          mocks.push(match[1]);
        }
      }
    }
    
    return [...new Set(mocks)];
  }

  private isTestKeyword(word: string): boolean {
    const testKeywords = [
      'describe', 'it', 'test', 'expect', 'should', 'beforeEach', 'afterEach', 
      'beforeAll', 'afterAll', 'jest', 'mock', 'spy', 'vi', 'cy'
    ];
    return testKeywords.includes(word);
  }

  private inferTestType(testName: string, line: string): TestMethod['type'] {
    const testNameLower = testName.toLowerCase();
    const lineLower = line.toLowerCase();
    
    if (testNameLower.includes('integration') || lineLower.includes('integration')) {
      return 'integration';
    }
    
    if (testNameLower.includes('e2e') || lineLower.includes('cypress') || lineLower.includes('playwright')) {
      return 'e2e';
    }
    
    return 'unit';
  }

  private determineTestTypes(filePath: string, content: string): TestFile['testTypes'] {
    const types: TestFile['testTypes'] = [];
    const pathLower = filePath.toLowerCase();
    
    if (pathLower.includes('e2e') || content.includes('cy.') || content.includes('page.')) {
      types.push('e2e');
    }
    
    if (pathLower.includes('integration') || content.includes('supertest')) {
      types.push('integration');
    }
    
    if (types.length === 0) {
      types.push('unit');
    }
    
    return types;
  }

  private async mapTestToSourceFiles(content: string, testFilePath: string): Promise<TestFileMapping[]> {
    const mappings: TestFileMapping[] = [];
    
    // Extract import statements
    const importRegex = /import.*from\s+['"`]([^'"`]+)['"`]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      
      if (importPath.startsWith('.') || importPath.startsWith('/')) {
        // Local file import
        const resolvedPath = path.resolve(path.dirname(testFilePath), importPath);
        
        try {
          const sourceFile = await this.resolveSourceFile(resolvedPath);
          if (sourceFile) {
            mappings.push({
              sourceFile,
              importPath,
              mappingType: 'direct',
              needsUpdate: false,
              confidence: 0.9
            });
          }
        } catch (error) {
          // File might not exist or be accessible
        }
      }
    }
    
    // Look for mocked modules
    const mockRegex = /mock\s*\(\s*['"`]([^'"`]+)['"`]/g;
    while ((match = mockRegex.exec(content)) !== null) {
      const mockPath = match[1];
      
      try {
        const sourceFile = await this.resolveSourceFile(mockPath);
        if (sourceFile) {
          mappings.push({
            sourceFile,
            importPath: mockPath,
            mappingType: 'mock',
            needsUpdate: false,
            confidence: 0.8
          });
        }
      } catch (error) {
        // Mock might be external or non-existent
      }
    }
    
    return mappings;
  }

  private async resolveSourceFile(importPath: string): Promise<string | null> {
    const possibleExtensions = ['.js', '.ts', '.jsx', '.tsx', '.json'];
    
    for (const ext of possibleExtensions) {
      const fullPath = importPath + ext;
      try {
        await fs.access(fullPath);
        return fullPath;
      } catch {
        continue;
      }
    }
    
    // Try index files
    for (const ext of possibleExtensions) {
      const indexPath = path.join(importPath, `index${ext}`);
      try {
        await fs.access(indexPath);
        return indexPath;
      } catch {
        continue;
      }
    }
    
    return null;
  }

  private extractFunctions(content: string): SourceFunction[] {
    const functions: SourceFunction[] = [];
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      const functionPatterns = [
        /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/,
        /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(/,
        /(\w+)\s*:\s*(?:async\s*)?\([^)]*\)\s*=>/,
        /(?:public|private|protected)?\s*(\w+)\s*\([^)]*\)\s*[:{]/
      ];
      
      for (const pattern of functionPatterns) {
        const match = pattern.exec(line);
        if (match) {
          const functionName = match[1];
          if (functionName !== 'constructor') {
            functions.push({
              name: functionName,
              line: index + 1,
              complexity: this.calculateComplexity(line),
              isPublic: !line.includes('private') && !line.includes('protected'),
              testMethods: [],
              needsTestUpdate: false
            });
          }
          break;
        }
      }
    });
    
    return functions;
  }

  private extractClasses(content: string): SourceClass[] {
    const classes: SourceClass[] = [];
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      const classPattern = /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/;
      const match = classPattern.exec(line);
      
      if (match) {
        const className = match[1];
        const methods = this.extractClassMethods(content, index, className);
        
        classes.push({
          name: className,
          line: index + 1,
          methods,
          testFiles: [],
          needsTestUpdate: false
        });
      }
    });
    
    return classes;
  }

  private extractClassMethods(content: string, classStartLine: number, className: string): string[] {
    const methods: string[] = [];
    const lines = content.split('\n');
    
    // Find class end (simplified - assumes proper indentation)
    let braceCount = 0;
    let inClass = false;
    
    for (let i = classStartLine; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('{')) {
        braceCount += (line.match(/\{/g) || []).length;
        inClass = true;
      }
      
      if (line.includes('}')) {
        braceCount -= (line.match(/\}/g) || []).length;
        if (braceCount <= 0 && inClass) break;
      }
      
      if (inClass && braceCount > 0) {
        const methodPattern = /(\w+)\s*\([^)]*\)\s*[:{]/;
        const match = methodPattern.exec(line.trim());
        
        if (match && !line.includes('class') && !line.includes('interface')) {
          const methodName = match[1];
          if (methodName !== className && !methods.includes(methodName)) {
            methods.push(methodName);
          }
        }
      }
    }
    
    return methods;
  }

  private extractExports(content: string): string[] {
    const exports: string[] = [];
    
    const exportPatterns = [
      /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g,
      /export\s*\{\s*([^}]+)\s*\}/g,
      /module\.exports\s*=\s*(\w+)/g
    ];
    
    for (const pattern of exportPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (pattern.source.includes('{')) {
          // Handle export { a, b, c }
          const exportList = match[1].split(',').map(e => e.trim().split(' as ')[0]);
          exports.push(...exportList);
        } else {
          exports.push(match[1]);
        }
      }
    }
    
    return [...new Set(exports)];
  }

  private calculateComplexity(line: string): number {
    // Simple complexity based on keywords
    const complexityKeywords = ['if', 'else', 'while', 'for', 'switch', 'case', 'try', 'catch'];
    return complexityKeywords.reduce((count, keyword) => 
      count + (line.includes(keyword) ? 1 : 0), 1
    );
  }

  private async findStaleTests(testFiles: TestFile[], sourceFiles: SourceFile[]): Promise<string[]> {
    const staleTests: string[] = [];
    
    for (const testFile of testFiles) {
      for (const mapping of testFile.coveredFiles) {
        const sourceFile = sourceFiles.find(sf => sf.path === mapping.sourceFile);
        
        if (!sourceFile) {
          // Source file no longer exists
          staleTests.push(`${testFile.path} tests non-existent ${mapping.sourceFile}`);
          continue;
        }
        
        if (mapping.sourceLastModified && sourceFile.lastModified > mapping.sourceLastModified) {
          // Source file modified after test
          staleTests.push(`${testFile.path} may be stale for ${mapping.sourceFile}`);
        }
      }
    }
    
    return staleTests;
  }

  private async findUntestedFunctions(sourceFiles: SourceFile[], testMappings: Map<string, string[]>): Promise<string[]> {
    const untestedFunctions: string[] = [];
    
    for (const sourceFile of sourceFiles) {
      const testFiles = testMappings.get(sourceFile.path) || [];
      
      for (const func of sourceFile.functions) {
        if (func.isPublic && func.testMethods.length === 0) {
          untestedFunctions.push(`${sourceFile.path}:${func.name} (line ${func.line})`);
        }
      }
      
      if (testFiles.length === 0 && sourceFile.functions.length > 0) {
        untestedFunctions.push(`${sourceFile.path} (entire file untested)`);
      }
    }
    
    return untestedFunctions;
  }

  private async identifyMaintenanceIssues(
    testFiles: TestFile[],
    sourceFiles: SourceFile[],
    testMappings: Map<string, string[]>
  ): Promise<TestMaintenanceIssue[]> {
    const issues: TestMaintenanceIssue[] = [];
    
    // Check for broken mappings
    for (const testFile of testFiles) {
      for (const mapping of testFile.coveredFiles) {
        const sourceExists = sourceFiles.some(sf => sf.path === mapping.sourceFile);
        
        if (!sourceExists) {
          issues.push({
            type: 'broken_mapping',
            severity: 'high',
            testFile: testFile.path,
            sourceFile: mapping.sourceFile,
            description: `Test references non-existent source file`,
            suggestion: `Update import or remove test for deleted source file`,
            lastChecked: new Date()
          });
        }
      }
    }
    
    // Check for missing tests
    for (const sourceFile of sourceFiles) {
      const hasTests = testMappings.has(sourceFile.path);
      
      if (!hasTests && sourceFile.functions.length > 0) {
        const publicFunctions = sourceFile.functions.filter(f => f.isPublic);
        
        if (publicFunctions.length > 0) {
          issues.push({
            type: 'missing_test',
            severity: publicFunctions.length > 3 ? 'high' : 'medium',
            sourceFile: sourceFile.path,
            description: `Source file has ${publicFunctions.length} public functions but no tests`,
            suggestion: `Create test file for this source file`,
            affectedFunctions: publicFunctions.map(f => f.name),
            lastChecked: new Date()
          });
        }
      }
    }
    
    return issues;
  }

  private async generateSyncActions(
    maintenanceIssues: TestMaintenanceIssue[],
    staleTests: string[],
    untestedFunctions: string[],
    autoSync?: boolean
  ): Promise<TestSyncAction[]> {
    const actions: TestSyncAction[] = [];
    
    // Actions for maintenance issues
    for (const issue of maintenanceIssues) {
      if (issue.type === 'missing_test' && issue.sourceFile) {
        actions.push({
          action: 'create_test',
          priority: issue.severity,
          sourceFile: issue.sourceFile,
          description: `Create test file for ${path.basename(issue.sourceFile)}`,
          reason: issue.description
        });
      }
      
      if (issue.type === 'broken_mapping' && issue.testFile) {
        actions.push({
          action: 'fix_import',
          priority: issue.severity,
          testFile: issue.testFile,
          description: `Fix broken import in ${path.basename(issue.testFile)}`,
          reason: issue.description
        });
      }
    }
    
    // Actions for stale tests
    for (const staleTest of staleTests) {
      actions.push({
        action: 'update_test',
        priority: 'medium',
        testFile: staleTest.split(' ')[0],
        description: `Update stale test`,
        reason: staleTest
      });
    }
    
    return actions;
  }

  private generateMappingRecommendations(
    maintenanceIssues: TestMaintenanceIssue[],
    syncActions: TestSyncAction[],
    testMappings: Map<string, string[]>
  ): string[] {
    const recommendations: string[] = [];
    
    const criticalIssues = maintenanceIssues.filter(i => i.severity === 'critical');
    const highPriorityActions = syncActions.filter(a => a.priority === 'high' || a.priority === 'critical');
    
    if (criticalIssues.length > 0) {
      recommendations.push(`Address ${criticalIssues.length} critical test mapping issues immediately`);
    }
    
    if (highPriorityActions.length > 0) {
      recommendations.push(`Execute ${highPriorityActions.length} high-priority sync actions`);
    }
    
    const missingTests = maintenanceIssues.filter(i => i.type === 'missing_test');
    if (missingTests.length > 0) {
      recommendations.push(`Create tests for ${missingTests.length} untested source files`);
    }
    
    const mappingCoverage = testMappings.size;
    recommendations.push(`Current test mapping coverage: ${mappingCoverage} source files have associated tests`);
    
    return recommendations;
  }
}

export default TestMappingAnalyzer;