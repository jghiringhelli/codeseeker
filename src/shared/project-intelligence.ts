/**
 * Project Intelligence Repository
 * Stores and manages intelligent project context in MongoDB
 */

import { Collection } from 'mongodb';
import { mongoClient } from './mongodb-client';
import { Logger, LogLevel } from '../utils/logger';

export interface ProjectContext {
  languages: string[];
  frameworks: string[];
  projectType: string;
  fileStructure: {
    entryPoints: string[];
    configFiles: string[];
    testDirectories: string[];
  };
  patterns: {
    architectural: string[];
    design: string[];
  };
  complexity: 'low' | 'medium' | 'high';
  recommendedTools: string[];
  metrics?: {
    totalFiles: number;
    totalLines: number;
    testCoverage?: number;
    dependencies: number;
  };
  insights?: string[];
}

export interface ProjectIntelligenceDoc {
  _id?: string;
  projectId: string;
  context: ProjectContext;
  lastUpdated: Date;
  version: number;
  history?: ProjectContext[];
}

export class ProjectIntelligence {
  private collection?: Collection<ProjectIntelligenceDoc>;
  private logger: Logger;
  private cache: Map<string, ProjectIntelligenceDoc> = new Map();

  constructor() {
    this.logger = new Logger(LogLevel.INFO, 'ProjectIntelligence');
  }

  private async ensureConnection(): Promise<Collection<ProjectIntelligenceDoc>> {
    if (!this.collection) {
      if (!mongoClient.isReady()) {
        await mongoClient.connect();
      }
      this.collection = mongoClient.getCollection<ProjectIntelligenceDoc>('project_intelligence');
    }
    return this.collection;
  }

  /**
   * Update project context with version tracking
   */
  async updateProjectContext(projectId: string, context: ProjectContext): Promise<void> {
    try {
      const collection = await this.ensureConnection();
      
      // Get existing document for version tracking
      const existing = await collection.findOne({ projectId });
      
      const doc: ProjectIntelligenceDoc = {
        projectId,
        context,
        lastUpdated: new Date(),
        version: existing ? existing.version + 1 : 1,
        history: existing?.history ? [...existing.history.slice(-9), existing.context] : []
      };

      await collection.replaceOne(
        { projectId },
        doc,
        { upsert: true }
      );

      // Update cache
      this.cache.set(projectId, doc);

      this.logger.info(`Updated context for project ${projectId} (v${doc.version})`);
      
      // Trigger tool recommendation update
      await this.updateToolRecommendations(projectId, context);
      
    } catch (error) {
      this.logger.error(`Failed to update project context: ${error}`);
      throw error;
    }
  }

  /**
   * Get project context with caching
   */
  async getProjectContext(projectId: string): Promise<ProjectContext | null> {
    try {
      // Check cache first
      if (this.cache.has(projectId)) {
        return this.cache.get(projectId)!.context;
      }

      const doc = await this.collection.findOne({ projectId });
      
      if (doc) {
        this.cache.set(projectId, doc);
        return doc.context;
      }
      
      return null;
    } catch (error) {
      this.logger.error(`Failed to get project context: ${error}`);
      return null;
    }
  }

  /**
   * Find similar projects based on context
   */
  async findSimilarProjects(projectContext: ProjectContext, limit: number = 5): Promise<ProjectIntelligenceDoc[]> {
    try {
      const query = {
        $or: [
          { 'context.languages': { $in: projectContext.languages } },
          { 'context.frameworks': { $in: projectContext.frameworks } },
          { 'context.projectType': projectContext.projectType }
        ]
      };

      const results = await this.collection
        .find(query)
        .sort({ lastUpdated: -1 })
        .limit(limit)
        .toArray();

      // Calculate similarity scores
      const scoredResults = results.map(doc => {
        const score = this.calculateSimilarityScore(projectContext, doc.context);
        return { ...doc, similarityScore: score };
      });

      // Sort by similarity score
      return scoredResults.sort((a, b) => b.similarityScore - a.similarityScore);
      
    } catch (error) {
      this.logger.error(`Failed to find similar projects: ${error}`);
      return [];
    }
  }

  /**
   * Get recommended tools based on project context
   */
  async getRecommendedTools(projectId: string): Promise<string[]> {
    try {
      const context = await this.getProjectContext(projectId);
      if (!context) {
        return this.getDefaultTools();
      }

      // Start with explicitly recommended tools
      const tools = new Set(context.recommendedTools);

      // Add tools based on project type
      const typeTools = this.getToolsByProjectType(context.projectType);
      typeTools.forEach(tool => tools.add(tool));

      // Add tools based on languages
      const langTools = this.getToolsByLanguages(context.languages);
      langTools.forEach(tool => tools.add(tool));

      // Add tools based on frameworks
      const frameworkTools = this.getToolsByFrameworks(context.frameworks);
      frameworkTools.forEach(tool => tools.add(tool));

      // Add tools based on complexity
      const complexityTools = this.getToolsByComplexity(context.complexity);
      complexityTools.forEach(tool => tools.add(tool));

      return Array.from(tools);
      
    } catch (error) {
      this.logger.error(`Failed to get recommended tools: ${error}`);
      return this.getDefaultTools();
    }
  }

  /**
   * Learn from successful tool runs
   */
  async learnFromToolExecution(
    projectId: string, 
    toolName: string, 
    success: boolean,
    executionTime: number,
    context?: any
  ): Promise<void> {
    try {
      const projectContext = await this.getProjectContext(projectId);
      if (!projectContext) return;

      if (success) {
        // Add tool to recommendations if execution was successful and fast
        if (executionTime < 5000 && !projectContext.recommendedTools.includes(toolName)) {
          projectContext.recommendedTools.push(toolName);
          await this.updateProjectContext(projectId, projectContext);
        }
      } else {
        // Remove tool from recommendations if it consistently fails
        const failureKey = `${projectId}:${toolName}:failures`;
        // In production, track failures in Redis or another store
        // For now, just log
        this.logger.warn(`Tool ${toolName} failed for project ${projectId}`);
      }
      
    } catch (error) {
      this.logger.error(`Failed to learn from tool execution: ${error}`);
    }
  }

  /**
   * Analyze project and generate initial context
   */
  async analyzeProject(projectId: string, projectPath: string, fileList: string[]): Promise<ProjectContext> {
    try {
      const context: ProjectContext = {
        languages: this.detectLanguages(fileList),
        frameworks: this.detectFrameworks(fileList),
        projectType: this.detectProjectType(fileList),
        fileStructure: this.analyzeFileStructure(fileList),
        patterns: this.detectPatterns(fileList),
        complexity: this.calculateComplexity(fileList),
        recommendedTools: [],
        metrics: {
          totalFiles: fileList.length,
          totalLines: 0, // Would need to read files to calculate
          dependencies: this.countDependencies(fileList)
        }
      };

      // Get initial tool recommendations
      context.recommendedTools = await this.generateInitialRecommendations(context);

      // Save the context
      await this.updateProjectContext(projectId, context);

      return context;
      
    } catch (error) {
      this.logger.error(`Failed to analyze project: ${error}`);
      throw error;
    }
  }

  /**
   * Get intelligence insights for a project
   */
  async getProjectInsights(projectId: string): Promise<string[]> {
    try {
      const context = await this.getProjectContext(projectId);
      if (!context) return [];

      const insights: string[] = [];

      // Complexity insights
      if (context.complexity === 'high') {
        insights.push('High complexity detected - consider refactoring or splitting into modules');
      }

      // Pattern insights
      if (!context.patterns.architectural.length) {
        insights.push('No clear architectural pattern detected - consider adopting MVC, Clean Architecture, or similar');
      }

      // Testing insights
      if (!context.fileStructure.testDirectories.length) {
        insights.push('No test directories found - consider adding unit tests');
      }

      // Framework insights
      if (context.frameworks.length > 5) {
        insights.push('Multiple frameworks detected - consider consolidating to reduce complexity');
      }

      // Tool insights
      const similarProjects = await this.findSimilarProjects(context, 3);
      if (similarProjects.length > 0) {
        const commonTools = this.findCommonTools(similarProjects);
        if (commonTools.length > 0) {
          insights.push(`Similar projects use: ${commonTools.join(', ')}`);
        }
      }

      return insights;
      
    } catch (error) {
      this.logger.error(`Failed to get project insights: ${error}`);
      return [];
    }
  }

  /**
   * Compare two project contexts
   */
  async compareProjects(projectId1: string, projectId2: string): Promise<any> {
    try {
      const [context1, context2] = await Promise.all([
        this.getProjectContext(projectId1),
        this.getProjectContext(projectId2)
      ]);

      if (!context1 || !context2) {
        return null;
      }

      return {
        similarities: {
          languages: context1.languages.filter(l => context2.languages.includes(l)),
          frameworks: context1.frameworks.filter(f => context2.frameworks.includes(f)),
          patterns: context1.patterns.architectural.filter(p => context2.patterns.architectural.includes(p)),
          projectType: context1.projectType === context2.projectType
        },
        differences: {
          languages: {
            project1Only: context1.languages.filter(l => !context2.languages.includes(l)),
            project2Only: context2.languages.filter(l => !context1.languages.includes(l))
          },
          frameworks: {
            project1Only: context1.frameworks.filter(f => !context2.frameworks.includes(f)),
            project2Only: context2.frameworks.filter(f => !context1.frameworks.includes(f))
          },
          complexity: {
            project1: context1.complexity,
            project2: context2.complexity
          }
        },
        similarityScore: this.calculateSimilarityScore(context1, context2)
      };
      
    } catch (error) {
      this.logger.error(`Failed to compare projects: ${error}`);
      return null;
    }
  }

  // Helper methods

  private calculateSimilarityScore(context1: ProjectContext, context2: ProjectContext): number {
    let score = 0;
    
    // Language similarity (weight: 30%)
    const langIntersection = context1.languages.filter(l => context2.languages.includes(l));
    score += (langIntersection.length / Math.max(context1.languages.length, context2.languages.length)) * 0.3;
    
    // Framework similarity (weight: 25%)
    const fwIntersection = context1.frameworks.filter(f => context2.frameworks.includes(f));
    score += (fwIntersection.length / Math.max(context1.frameworks.length, context2.frameworks.length, 1)) * 0.25;
    
    // Project type similarity (weight: 20%)
    if (context1.projectType === context2.projectType) {
      score += 0.2;
    }
    
    // Complexity similarity (weight: 15%)
    if (context1.complexity === context2.complexity) {
      score += 0.15;
    }
    
    // Pattern similarity (weight: 10%)
    const patternIntersection = context1.patterns.architectural.filter(p => 
      context2.patterns.architectural.includes(p)
    );
    score += (patternIntersection.length / Math.max(context1.patterns.architectural.length, context2.patterns.architectural.length, 1)) * 0.1;
    
    return Math.round(score * 100) / 100;
  }

  private async updateToolRecommendations(projectId: string, context: ProjectContext): Promise<void> {
    const recommendations = await this.generateInitialRecommendations(context);
    if (recommendations.length > 0 && JSON.stringify(recommendations) !== JSON.stringify(context.recommendedTools)) {
      context.recommendedTools = recommendations;
      // Note: This would be updated in the next context save
    }
  }

  private detectLanguages(fileList: string[]): string[] {
    const languages = new Set<string>();
    
    fileList.forEach(file => {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) languages.add('typescript');
      if (file.endsWith('.js') || file.endsWith('.jsx')) languages.add('javascript');
      if (file.endsWith('.py')) languages.add('python');
      if (file.endsWith('.java')) languages.add('java');
      if (file.endsWith('.cs')) languages.add('csharp');
      if (file.endsWith('.go')) languages.add('go');
      if (file.endsWith('.rs')) languages.add('rust');
      if (file.endsWith('.cpp') || file.endsWith('.cc')) languages.add('cpp');
    });
    
    return Array.from(languages);
  }

  private detectFrameworks(fileList: string[]): string[] {
    const frameworks = new Set<string>();
    
    // React
    if (fileList.some(f => f.includes('react') || f.endsWith('.jsx') || f.endsWith('.tsx'))) {
      frameworks.add('react');
    }
    
    // Node.js
    if (fileList.includes('package.json')) {
      frameworks.add('nodejs');
    }
    
    // Express
    if (fileList.some(f => f.includes('app.js') || f.includes('server.js'))) {
      frameworks.add('express');
    }
    
    // Angular
    if (fileList.includes('angular.json')) {
      frameworks.add('angular');
    }
    
    // Vue
    if (fileList.some(f => f.endsWith('.vue'))) {
      frameworks.add('vue');
    }
    
    // Django
    if (fileList.includes('manage.py')) {
      frameworks.add('django');
    }
    
    // Flask
    if (fileList.some(f => f.includes('flask'))) {
      frameworks.add('flask');
    }
    
    return Array.from(frameworks);
  }

  private detectProjectType(fileList: string[]): string {
    if (fileList.includes('package.json')) {
      if (fileList.some(f => f.includes('server') || f.includes('api'))) {
        return 'api_service';
      }
      if (fileList.some(f => f.endsWith('.tsx') || f.endsWith('.jsx'))) {
        return 'web_application';
      }
      if (fileList.some(f => f.includes('cli') || f.includes('bin'))) {
        return 'cli_tool';
      }
      return 'library';
    }
    
    if (fileList.includes('requirements.txt') || fileList.includes('setup.py')) {
      return 'python_application';
    }
    
    if (fileList.includes('pom.xml') || fileList.includes('build.gradle')) {
      return 'java_application';
    }
    
    return 'unknown';
  }

  private analyzeFileStructure(fileList: string[]): ProjectContext['fileStructure'] {
    return {
      entryPoints: fileList.filter(f => 
        f.includes('index') || f.includes('main') || f.includes('app') || f.includes('server')
      ),
      configFiles: fileList.filter(f => 
        f.includes('config') || f.endsWith('.json') || f.endsWith('.yml') || f.endsWith('.yaml')
      ),
      testDirectories: fileList.filter(f => 
        f.includes('test') || f.includes('spec') || f.includes('__tests__')
      )
    };
  }

  private detectPatterns(fileList: string[]): ProjectContext['patterns'] {
    const architectural: string[] = [];
    const design: string[] = [];
    
    // MVC
    if (fileList.some(f => f.includes('controller')) && 
        fileList.some(f => f.includes('model')) && 
        fileList.some(f => f.includes('view'))) {
      architectural.push('MVC');
    }
    
    // Repository Pattern
    if (fileList.some(f => f.includes('repository'))) {
      design.push('Repository');
    }
    
    // Factory Pattern
    if (fileList.some(f => f.includes('factory'))) {
      design.push('Factory');
    }
    
    // Clean Architecture
    if (fileList.some(f => f.includes('domain')) && 
        fileList.some(f => f.includes('infrastructure')) && 
        fileList.some(f => f.includes('application'))) {
      architectural.push('Clean Architecture');
    }
    
    return { architectural, design };
  }

  private calculateComplexity(fileList: string[]): 'low' | 'medium' | 'high' {
    if (fileList.length < 50) return 'low';
    if (fileList.length < 200) return 'medium';
    return 'high';
  }

  private countDependencies(fileList: string[]): number {
    // Simplified - in reality would parse package.json, requirements.txt, etc.
    return fileList.filter(f => 
      f === 'package.json' || f === 'requirements.txt' || f === 'pom.xml'
    ).length * 10; // Rough estimate
  }

  private async generateInitialRecommendations(context: ProjectContext): Promise<string[]> {
    const tools = new Set<string>();
    
    // Always recommend these core tools
    tools.add('semantic-search');
    tools.add('solid-principles');
    
    // Language-specific tools
    if (context.languages.includes('typescript') || context.languages.includes('javascript')) {
      tools.add('compilation-verifier');
      tools.add('tree-navigation');
    }
    
    // Framework-specific tools
    if (context.frameworks.includes('react')) {
      tools.add('ui-navigation');
    }
    
    // Project type specific
    if (context.projectType === 'api_service') {
      tools.add('use-cases');
    }
    
    // Complexity-based
    if (context.complexity === 'high') {
      tools.add('centralization-detector');
    }
    
    return Array.from(tools);
  }

  private getDefaultTools(): string[] {
    return ['semantic-search', 'solid-principles', 'compilation-verifier'];
  }

  private getToolsByProjectType(projectType: string): string[] {
    const typeTools: Record<string, string[]> = {
      'web_application': ['ui-navigation', 'tree-navigation'],
      'api_service': ['use-cases', 'solid-principles'],
      'cli_tool': ['solid-principles', 'compilation-verifier'],
      'library': ['solid-principles', 'tree-navigation']
    };
    return typeTools[projectType] || [];
  }

  private getToolsByLanguages(languages: string[]): string[] {
    const tools = new Set<string>();
    
    if (languages.includes('typescript') || languages.includes('javascript')) {
      tools.add('compilation-verifier');
    }
    
    return Array.from(tools);
  }

  private getToolsByFrameworks(frameworks: string[]): string[] {
    const tools = new Set<string>();
    
    if (frameworks.includes('react') || frameworks.includes('angular') || frameworks.includes('vue')) {
      tools.add('ui-navigation');
    }
    
    return Array.from(tools);
  }

  private getToolsByComplexity(complexity: string): string[] {
    if (complexity === 'high') {
      return ['centralization-detector', 'solid-principles'];
    }
    return [];
  }

  private findCommonTools(projects: ProjectIntelligenceDoc[]): string[] {
    if (projects.length === 0) return [];
    
    const toolCounts = new Map<string, number>();
    
    projects.forEach(project => {
      project.context.recommendedTools.forEach(tool => {
        toolCounts.set(tool, (toolCounts.get(tool) || 0) + 1);
      });
    });
    
    // Return tools used by at least half of the projects
    const threshold = Math.ceil(projects.length / 2);
    return Array.from(toolCounts.entries())
      .filter(([_, count]) => count >= threshold)
      .map(([tool, _]) => tool);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.info('Project intelligence cache cleared');
  }
}

// Export singleton instance
export const projectIntelligence = new ProjectIntelligence();