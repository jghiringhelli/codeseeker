/**
 * Comprehensive Impact Analyzer
 * 
 * Uses Neo4j tree traversal to find ALL affected files across the entire project
 * including classes, methods, documents, configs, deployments, tests, etc.
 */

import { Logger } from './logger';
import SemanticGraphService from '../cli/services/data/semantic-graph/semantic-graph';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'fast-glob';

export interface AffectedFile {
  filePath: string;
  fileType: 'code' | 'config' | 'documentation' | 'test' | 'deployment' | 'static';
  changeType: 'update' | 'create' | 'delete' | 'rename';
  specificTask: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  dependencies: string[];
  estimatedComplexity: number; // 1-10 scale
}

export interface ImpactAnalysisResult {
  primaryFiles: AffectedFile[]; // Direct changes
  cascadingFiles: AffectedFile[]; // Indirect effects
  configurationFiles: AffectedFile[]; // Config updates needed
  documentationFiles: AffectedFile[]; // Docs to update
  testFiles: AffectedFile[]; // Tests to create/update
  deploymentFiles: AffectedFile[]; // Infrastructure changes
  totalFiles: number;
  estimatedTime: string; // Human-readable time estimate
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export class ComprehensiveImpactAnalyzer {
  private logger: Logger;
  private semanticGraph: SemanticGraphService;
  
  constructor() {
    this.logger = Logger.getInstance();
    this.semanticGraph = new SemanticGraphService();
  }

  async initialize(): Promise<void> {
    await this.semanticGraph.initialize();
    this.logger.info('🎯 Comprehensive Impact Analyzer initialized');
  }

  /**
   * Analyze complete impact of a change request across ALL project files
   */
  async analyzeCompleteImpact(
    projectPath: string,
    userRequest: string,
    changedFiles: string[] = []
  ): Promise<ImpactAnalysisResult> {
    await this.initialize();

    const result: ImpactAnalysisResult = {
      primaryFiles: [],
      cascadingFiles: [],
      configurationFiles: [],
      documentationFiles: [],
      testFiles: [],
      deploymentFiles: [],
      totalFiles: 0,
      estimatedTime: '0 minutes',
      riskLevel: 'low'
    };

    try {
      this.logger.info(`🔍 Analyzing complete impact for: "${userRequest}"`);

      // 1. Analyze primary impact (direct changes)
      result.primaryFiles = await this.analyzePrimaryImpact(projectPath, userRequest, changedFiles);

      // 2. Use Neo4j tree traversal for cascading effects
      result.cascadingFiles = await this.analyzeCascadingImpact(projectPath, result.primaryFiles);

      // 3. Detect configuration file impacts
      result.configurationFiles = await this.analyzeConfigurationImpact(projectPath, userRequest, result.primaryFiles);

      // 4. Identify documentation updates needed
      result.documentationFiles = await this.analyzeDocumentationImpact(projectPath, userRequest, result.primaryFiles);

      // 5. Determine test file requirements
      result.testFiles = await this.analyzeTestImpact(projectPath, userRequest, result.primaryFiles);

      // 6. Check deployment/infrastructure changes
      result.deploymentFiles = await this.analyzeDeploymentImpact(projectPath, userRequest, result.primaryFiles);

      // 7. Calculate totals and estimates
      result.totalFiles = this.calculateTotalFiles(result);
      result.estimatedTime = this.estimateCompletionTime(result);
      result.riskLevel = this.calculateRiskLevel(result);

      this.logger.info(`📊 Impact analysis complete: ${result.totalFiles} files affected`);

    } catch (error: any) {
      this.logger.error('Impact analysis failed:', error.message);
    }

    return result;
  }

  /**
   * Analyze primary impact - files directly mentioned or inferred from request
   */
  private async analyzePrimaryImpact(
    projectPath: string,
    userRequest: string,
    changedFiles: string[]
  ): Promise<AffectedFile[]> {
    const primaryFiles: AffectedFile[] = [];

    // Process explicitly changed files
    for (const file of changedFiles) {
      const fileType = this.determineFileType(file);
      const task = this.generateSpecificTask(userRequest, file, fileType);
      
      primaryFiles.push({
        filePath: file,
        fileType,
        changeType: 'update',
        specificTask: task,
        priority: 'critical',
        dependencies: [],
        estimatedComplexity: this.estimateComplexity(userRequest, fileType)
      });
    }

    // Infer additional primary files from request intent
    const inferredFiles = await this.inferPrimaryFilesFromIntent(projectPath, userRequest);
    primaryFiles.push(...inferredFiles);

    return primaryFiles;
  }

  /**
   * Use Neo4j tree traversal to find ALL cascading effects
   */
  private async analyzeCascadingImpact(
    projectPath: string,
    primaryFiles: AffectedFile[]
  ): Promise<AffectedFile[]> {
    const cascadingFiles: AffectedFile[] = [];

    for (const primaryFile of primaryFiles) {
      if (primaryFile.fileType === 'code') {
        try {
          // Use Neo4j to find all related files by searching first, then finding related nodes
          const fileName = path.basename(primaryFile.filePath);
          const searchResults = await this.semanticGraph.semanticSearch(fileName, {
            includeTypes: ['Code']
          });
          
          let dependentFiles: any[] = [];
          if (searchResults.length > 0) {
            const nodeId = searchResults[0].node.id;
            const relatedNodes = await this.semanticGraph.findRelated(
              nodeId,
              5, // maxDepth
              ['IMPORTS', 'DEPENDS_ON', 'USES', 'IMPLEMENTS'] // RelationshipType[]
            );
            dependentFiles = relatedNodes;
          }

          for (const depFile of dependentFiles) {
            const fileType = this.determineFileType(depFile.filePath);
            const task = this.generateCascadingTask(primaryFile, depFile);

            cascadingFiles.push({
              filePath: depFile.filePath,
              fileType,
              changeType: 'update',
              specificTask: task,
              priority: this.calculateCascadingPriority(depFile.relationshipType, depFile.depth),
              dependencies: [primaryFile.filePath],
              estimatedComplexity: Math.max(1, primaryFile.estimatedComplexity - depFile.depth)
            });
          }
        } catch (error) {
          this.logger.warn(`Failed to analyze cascading impact for ${primaryFile.filePath}:`, error);
        }
      }
    }

    return this.deduplicateCascadingFiles(cascadingFiles);
  }

  /**
   * Analyze configuration file impacts
   */
  private async analyzeConfigurationImpact(
    projectPath: string,
    userRequest: string,
    primaryFiles: AffectedFile[]
  ): Promise<AffectedFile[]> {
    const configFiles: AffectedFile[] = [];
    const lowerRequest = userRequest.toLowerCase();

    // Common configuration patterns
    const configPatterns = [
      { pattern: 'package.json', triggers: ['dependency', 'script', 'package'], task: 'Update dependencies and scripts' },
      { pattern: 'tsconfig.json', triggers: ['typescript', 'compile', 'type'], task: 'Update TypeScript configuration' },
      { pattern: '.env*', triggers: ['environment', 'config', 'secret'], task: 'Update environment variables' },
      { pattern: 'vite.config.*', triggers: ['build', 'bundler', 'vite'], task: 'Update build configuration' },
      { pattern: 'tailwind.config.*', triggers: ['style', 'css', 'theme'], task: 'Update styling configuration' },
      { pattern: 'eslint*', triggers: ['lint', 'code quality'], task: 'Update linting rules' },
      { pattern: 'jest.config.*', triggers: ['test', 'testing'], task: 'Update test configuration' }
    ];

    // Check if request suggests config changes
    for (const config of configPatterns) {
      if (config.triggers.some(trigger => lowerRequest.includes(trigger))) {
        const files = await glob(config.pattern, { cwd: projectPath });
        
        for (const file of files) {
          configFiles.push({
            filePath: file,
            fileType: 'config',
            changeType: 'update',
            specificTask: config.task,
            priority: 'high',
            dependencies: primaryFiles.map(f => f.filePath),
            estimatedComplexity: 3
          });
        }
      }
    }

    // Check for new dependencies based on primary file changes
    const newDependencies = this.detectNewDependencies(primaryFiles, userRequest);
    if (newDependencies.length > 0) {
      configFiles.push({
        filePath: 'package.json',
        fileType: 'config',
        changeType: 'update',
        specificTask: `Add dependencies: ${newDependencies.join(', ')}`,
        priority: 'critical',
        dependencies: [],
        estimatedComplexity: 2
      });
    }

    return configFiles;
  }

  /**
   * Analyze documentation impacts
   */
  private async analyzeDocumentationImpact(
    projectPath: string,
    userRequest: string,
    primaryFiles: AffectedFile[]
  ): Promise<AffectedFile[]> {
    const docFiles: AffectedFile[] = [];

    // Find existing documentation files
    const docPatterns = ['**/*.md', '**/README*', '**/docs/**/*', '**/*.mdx'];
    const existingDocs = await glob(docPatterns, { 
      cwd: projectPath,
      ignore: ['node_modules/**', 'dist/**', '.git/**']
    });

    // Determine which docs need updating
    for (const docFile of existingDocs) {
      const shouldUpdate = await this.shouldUpdateDocumentation(
        path.join(projectPath, docFile),
        userRequest,
        primaryFiles
      );

      if (shouldUpdate.update) {
        docFiles.push({
          filePath: docFile,
          fileType: 'documentation',
          changeType: 'update',
          specificTask: shouldUpdate.task,
          priority: 'medium',
          dependencies: primaryFiles.map(f => f.filePath),
          estimatedComplexity: 2
        });
      }
    }

    // Check if new documentation is needed
    const newDocsNeeded = this.detectNewDocumentationNeeds(userRequest, primaryFiles);
    docFiles.push(...newDocsNeeded);

    return docFiles;
  }

  /**
   * Analyze test file impacts
   */
  private async analyzeTestImpact(
    projectPath: string,
    userRequest: string,
    primaryFiles: AffectedFile[]
  ): Promise<AffectedFile[]> {
    const testFiles: AffectedFile[] = [];

    for (const primaryFile of primaryFiles) {
      if (primaryFile.fileType === 'code') {
        // Find existing test files
        const existingTests = await this.findExistingTestFiles(projectPath, primaryFile.filePath);
        
        for (const testFile of existingTests) {
          testFiles.push({
            filePath: testFile,
            fileType: 'test',
            changeType: 'update',
            specificTask: `Update tests for changes in ${primaryFile.filePath}`,
            priority: 'high',
            dependencies: [primaryFile.filePath],
            estimatedComplexity: 4
          });
        }

        // Determine if new tests are needed
        if (existingTests.length === 0 && this.needsNewTests(primaryFile, userRequest)) {
          const newTestPath = this.generateTestFilePath(primaryFile.filePath);
          testFiles.push({
            filePath: newTestPath,
            fileType: 'test',
            changeType: 'create',
            specificTask: `Create comprehensive tests for ${primaryFile.filePath}`,
            priority: 'high',
            dependencies: [primaryFile.filePath],
            estimatedComplexity: 6
          });
        }
      }
    }

    return testFiles;
  }

  /**
   * Analyze deployment/infrastructure impacts
   */
  private async analyzeDeploymentImpact(
    projectPath: string,
    userRequest: string,
    primaryFiles: AffectedFile[]
  ): Promise<AffectedFile[]> {
    const deploymentFiles: AffectedFile[] = [];
    const lowerRequest = userRequest.toLowerCase();

    // Deployment file patterns and triggers
    const deploymentPatterns = [
      { pattern: 'Dockerfile*', triggers: ['docker', 'container', 'deployment'], task: 'Update container configuration' },
      { pattern: 'docker-compose*', triggers: ['docker', 'services', 'infrastructure'], task: 'Update service orchestration' },
      { pattern: '.github/workflows/*', triggers: ['ci/cd', 'github', 'pipeline'], task: 'Update GitHub Actions workflow' },
      { pattern: 'vercel.json', triggers: ['vercel', 'deployment'], task: 'Update Vercel configuration' },
      { pattern: 'netlify.toml', triggers: ['netlify', 'deployment'], task: 'Update Netlify configuration' },
      { pattern: 'k8s/**/*', triggers: ['kubernetes', 'k8s'], task: 'Update Kubernetes manifests' }
    ];

    // Check for deployment impacts
    for (const deployment of deploymentPatterns) {
      if (deployment.triggers.some(trigger => lowerRequest.includes(trigger))) {
        const files = await glob(deployment.pattern, { cwd: projectPath });
        
        for (const file of files) {
          deploymentFiles.push({
            filePath: file,
            fileType: 'deployment',
            changeType: 'update',
            specificTask: deployment.task,
            priority: 'medium',
            dependencies: primaryFiles.map(f => f.filePath),
            estimatedComplexity: 3
          });
        }
      }
    }

    // Check if changes affect deployment
    const affectsDeployment = this.checkDeploymentImpact(primaryFiles, userRequest);
    if (affectsDeployment.affects) {
      // Find relevant deployment files
      const relevantFiles = await glob(['Dockerfile*', 'docker-compose*', '.github/workflows/*'], { cwd: projectPath });
      
      for (const file of relevantFiles) {
        if (!deploymentFiles.some(df => df.filePath === file)) {
          deploymentFiles.push({
            filePath: file,
            fileType: 'deployment',
            changeType: 'update',
            specificTask: affectsDeployment.task,
            priority: 'high',
            dependencies: primaryFiles.map(f => f.filePath),
            estimatedComplexity: 4
          });
        }
      }
    }

    return deploymentFiles;
  }

  /**
   * Generate specific task description for a file
   */
  private generateSpecificTask(userRequest: string, filePath: string, fileType: string): string {
    const fileName = path.basename(filePath);
    const lowerRequest = userRequest.toLowerCase();

    // Task templates based on file type and request intent
    if (fileType === 'code') {
      if (lowerRequest.includes('add') || lowerRequest.includes('create')) {
        return `Add new functionality to ${fileName} based on request: "${userRequest}"`;
      } else if (lowerRequest.includes('fix') || lowerRequest.includes('bug')) {
        return `Fix issues in ${fileName} related to: "${userRequest}"`;
      } else if (lowerRequest.includes('refactor') || lowerRequest.includes('improve')) {
        return `Refactor ${fileName} to: "${userRequest}"`;
      } else {
        return `Update ${fileName} according to: "${userRequest}"`;
      }
    } else if (fileType === 'config') {
      return `Update ${fileName} configuration to support: "${userRequest}"`;
    } else if (fileType === 'documentation') {
      return `Update ${fileName} to document changes from: "${userRequest}"`;
    } else if (fileType === 'test') {
      return `Update ${fileName} tests to cover: "${userRequest}"`;
    }

    return `Modify ${fileName} according to: "${userRequest}"`;
  }

  /**
   * Determine file type from path
   */
  private determineFileType(filePath: string): AffectedFile['fileType'] {
    const ext = path.extname(filePath).toLowerCase();
    const name = path.basename(filePath).toLowerCase();

    // Code files
    if (['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go', '.rs'].includes(ext)) {
      return 'code';
    }

    // Test files
    if (filePath.includes('/test/') || filePath.includes('/__tests__/') || 
        name.includes('.test.') || name.includes('.spec.')) {
      return 'test';
    }

    // Config files
    if (['.json', '.yaml', '.yml', '.toml', '.ini', '.env'].includes(ext) ||
        ['package.json', 'tsconfig.json', 'webpack.config.js'].includes(name)) {
      return 'config';
    }

    // Documentation
    if (['.md', '.mdx', '.txt', '.rst'].includes(ext) || name.includes('readme')) {
      return 'documentation';
    }

    // Deployment files
    if (name.includes('dockerfile') || name.includes('docker-compose') || 
        filePath.includes('/.github/') || filePath.includes('/k8s/')) {
      return 'deployment';
    }

    return 'static';
  }

  /**
   * Calculate total files across all categories
   */
  private calculateTotalFiles(result: ImpactAnalysisResult): number {
    return result.primaryFiles.length + result.cascadingFiles.length + 
           result.configurationFiles.length + result.documentationFiles.length +
           result.testFiles.length + result.deploymentFiles.length;
  }

  /**
   * Estimate completion time based on file complexity
   */
  private estimateCompletionTime(result: ImpactAnalysisResult): string {
    let totalComplexity = 0;
    
    const allFiles = [
      ...result.primaryFiles,
      ...result.cascadingFiles,
      ...result.configurationFiles,
      ...result.documentationFiles,
      ...result.testFiles,
      ...result.deploymentFiles
    ];

    totalComplexity = allFiles.reduce((sum, file) => sum + file.estimatedComplexity, 0);

    // Rough time estimation: 5 minutes per complexity point
    const minutes = totalComplexity * 5;
    
    if (minutes < 60) {
      return `${minutes} minutes`;
    } else if (minutes < 1440) {
      return `${Math.round(minutes / 60)} hours`;
    } else {
      return `${Math.round(minutes / 1440)} days`;
    }
  }

  /**
   * Calculate risk level based on number and type of affected files
   */
  private calculateRiskLevel(result: ImpactAnalysisResult): 'low' | 'medium' | 'high' | 'critical' {
    const totalFiles = result.totalFiles;
    const hasCriticalFiles = result.primaryFiles.some(f => f.priority === 'critical');
    const hasDeploymentChanges = result.deploymentFiles.length > 0;
    const hasConfigChanges = result.configurationFiles.length > 0;

    if (totalFiles > 20 || (hasDeploymentChanges && hasConfigChanges)) {
      return 'critical';
    } else if (totalFiles > 10 || hasDeploymentChanges || hasCriticalFiles) {
      return 'high';
    } else if (totalFiles > 5 || hasConfigChanges) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  // Helper methods (implementations would be added based on specific patterns)
  private async inferPrimaryFilesFromIntent(projectPath: string, userRequest: string): Promise<AffectedFile[]> {
    // Implementation would analyze the request and suggest files that might need changes
    return [];
  }

  private generateCascadingTask(primaryFile: AffectedFile, dependentFile: any): string {
    return `Update ${dependentFile.filePath} to handle changes from ${primaryFile.filePath}`;
  }

  private calculateCascadingPriority(relationshipType: string, depth: number): 'critical' | 'high' | 'medium' | 'low' {
    if (relationshipType === 'IMPORTS' && depth <= 1) return 'critical';
    if (relationshipType === 'DEPENDS_ON' && depth <= 2) return 'high';
    if (depth <= 3) return 'medium';
    return 'low';
  }

  private deduplicateCascadingFiles(files: AffectedFile[]): AffectedFile[] {
    const seen = new Set<string>();
    return files.filter(file => {
      if (seen.has(file.filePath)) return false;
      seen.add(file.filePath);
      return true;
    });
  }

  private estimateComplexity(userRequest: string, fileType: string): number {
    // Basic complexity estimation logic
    const baseComplexity = fileType === 'code' ? 5 : 2;
    const requestComplexity = userRequest.length > 100 ? 2 : 1;
    return Math.min(10, baseComplexity + requestComplexity);
  }

  private detectNewDependencies(primaryFiles: AffectedFile[], userRequest: string): string[] {
    // Would analyze the request and primary files to suggest new dependencies
    return [];
  }

  private async shouldUpdateDocumentation(docPath: string, userRequest: string, primaryFiles: AffectedFile[]): Promise<{ update: boolean; task: string }> {
    // Would analyze if the documentation is relevant to the changes
    return { update: false, task: '' };
  }

  private detectNewDocumentationNeeds(userRequest: string, primaryFiles: AffectedFile[]): AffectedFile[] {
    // Would determine if new documentation files are needed
    return [];
  }

  private async findExistingTestFiles(projectPath: string, filePath: string): Promise<string[]> {
    // Find test files related to the given file
    const baseName = path.basename(filePath, path.extname(filePath));
    const testPatterns = [
      `**/${baseName}.test.*`,
      `**/${baseName}.spec.*`,
      `**/test/**/*${baseName}*`,
      `**/__tests__/**/*${baseName}*`
    ];
    
    return await glob(testPatterns, { cwd: projectPath });
  }

  private needsNewTests(primaryFile: AffectedFile, userRequest: string): boolean {
    // Determine if new tests are needed based on the change
    return primaryFile.changeType === 'create' || userRequest.toLowerCase().includes('test');
  }

  private generateTestFilePath(filePath: string): string {
    const dir = path.dirname(filePath);
    const baseName = path.basename(filePath, path.extname(filePath));
    return path.join(dir, `${baseName}.test.ts`);
  }

  private checkDeploymentImpact(primaryFiles: AffectedFile[], userRequest: string): { affects: boolean; task: string } {
    const hasServerChanges = primaryFiles.some(f => 
      f.filePath.includes('/server/') || f.filePath.includes('/api/')
    );
    
    const lowerRequest = userRequest.toLowerCase();
    const deploymentKeywords = ['deploy', 'build', 'environment', 'docker', 'production'];
    
    const hasDeploymentKeywords = deploymentKeywords.some(keyword => lowerRequest.includes(keyword));
    
    if (hasServerChanges || hasDeploymentKeywords) {
      return {
        affects: true,
        task: 'Update deployment configuration to support changes'
      };
    }
    
    return { affects: false, task: '' };
  }
}

export default ComprehensiveImpactAnalyzer;