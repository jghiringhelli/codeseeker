/**
 * Claude Code Integration Service
 * Provides direct integration with Claude Code for AI-powered analysis
 */

import { exec, execFile, ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { PlatformUtils } from '../shared/platform-utils';
import { PromptChunkingSystem } from '../shared/prompt-chunking-system';
import { DatabaseConnections } from '../config/database-config';
import { ClaudeConversationManager } from './claude-conversation-manager';

const execAsync = promisify(exec);

export interface ClaudeCodeOptions {
  projectPath: string;
  maxTokens?: number;
  temperature?: number;
  resumeToken?: string;
}

export interface AnalysisResult {
  architecture: {
    type: string;
    patterns: string[];
    frameworks: string[];
    designPrinciples: string[];
  };
  dependencies: {
    files: Array<{
      file: string;
      dependencies: string[];
      type: 'import' | 'require' | 'reference';
    }>;
    relationships: Array<{
      from: string;
      to: string;
      type: string;
      strength: number;
    }>;
  };
  useCases: Array<{
    name: string;
    description: string;
    actors: string[];
    preconditions: string[];
    steps: string[];
    postconditions: string[];
    businessValue: string;
  }>;
  codeQuality: {
    score: number;
    issues: string[];
    recommendations: string[];
  };
  resumeToken: string;
}

export interface ClaudeCodeResponse {
  success: boolean;
  data?: any;
  error?: string;
  tokensUsed?: number;
  resumeToken?: string;
}

export class ClaudeCodeIntegration {
  private dbConnections: DatabaseConnections;
  private conversationManager: ClaudeConversationManager;
  private activeSessions: Map<string, string> = new Map(); // projectPath -> sessionId

  constructor() {
    this.dbConnections = new DatabaseConnections();
    this.conversationManager = new ClaudeConversationManager();
  }

  /**
   * Execute Claude Code with a specific prompt and context using conversation management
   */
  async executeClaudeCode(
    prompt: string,
    context: string,
    options: ClaudeCodeOptions = { projectPath: '.' }
  ): Promise<ClaudeCodeResponse> {
    try {
      console.log(`🤖 Executing Claude Code with conversation management...`);

      // Get or create session for this project
      const sessionId = await this.getSessionForProject(options.projectPath);

      // Combine prompt and context for the conversation
      const fullPrompt = context ? `${context}\n\n${prompt}` : prompt;

      // Use PromptChunkingSystem to handle large prompts (25K+ character limit)
      console.log(`📏 Checking prompt size: ${fullPrompt.length} characters`);
      const chunkResult = await PromptChunkingSystem.processLargePrompt(
        fullPrompt,
        options.projectPath,
        prompt // Original request for compression context
      );

      if (!chunkResult.success) {
        console.error(`❌ Prompt chunking failed: ${chunkResult.error}`);
        throw new Error(`Prompt too large and compression failed: ${chunkResult.error}`);
      }

      const processedPrompt = chunkResult.finalPrompt;
      console.log(`✅ Using processed prompt: ${processedPrompt.length} characters (${chunkResult.chunksProcessed} chunks processed)`);

      // Send message through conversation manager
      const result = await this.conversationManager.sendMessage(
        sessionId,
        processedPrompt,
        context
      );

      return {
        success: true,
        data: result.response,
        tokensUsed: result.tokensUsed + chunkResult.tokensUsed,
        resumeToken: sessionId
      };
    } catch (error) {
      console.error(`❌ Claude Code execution failed: ${error instanceof Error ? error.message : error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get or create a conversation session for a project
   */
  private async getSessionForProject(projectPath: string): Promise<string> {
    let sessionId = this.activeSessions.get(projectPath);
    if (!sessionId) {
      sessionId = await this.conversationManager.startSession(projectPath);
      this.activeSessions.set(projectPath, sessionId);
    }
    return sessionId;
  }

  /**
   * Perform comprehensive project analysis using Claude Code
   */
  async analyzeProject(projectPath: string, resumeToken?: string): Promise<AnalysisResult> {
    console.log('🔍 Starting AI-powered project analysis...');
    
    // Build comprehensive context for Claude Code
    const context = await this.buildProjectContext(projectPath);
    
    const analysisPrompt = `
You are an expert software architect analyzing a codebase. Provide a comprehensive analysis including:

1. **Architecture Analysis**:
   - Identify the architectural pattern (MVC, microservices, layered, etc.)
   - List design patterns used
   - Identify frameworks and technologies
   - Assess adherence to SOLID principles

2. **Dependency Analysis**:
   - Map file-to-file dependencies
   - Identify circular dependencies
   - Rate relationship strength (1-10)
   - Categorize dependency types

3. **Use Case Inference**:
   - Infer business use cases from code structure
   - Identify key user journeys
   - Map actors and their interactions
   - Assess business value of each use case

4. **Code Quality Assessment**:
   - Overall quality score (1-10)
   - Identify technical debt
   - Security concerns
   - Performance bottlenecks
   - Recommendations for improvement

Return your analysis as structured JSON with the exact schema provided.
`;

    const response = await this.executeClaudeCode(
      analysisPrompt, 
      context, 
      { 
        projectPath, 
        maxTokens: 8000,
        resumeToken 
      }
    );

    if (!response.success) {
      throw new Error(`Analysis failed: ${response.error}`);
    }

    // Parse and validate the response
    const analysisData = this.parseAnalysisResponse(response.data);
    
    // Store results in databases
    await this.storeAnalysisResults(projectPath, analysisData);
    
    return analysisData;
  }

  /**
   * Process user requests through the complete AI pipeline
   */
  async processRequest(
    userRequest: string,
    projectPath: string,
    options: { maxTokens?: number; projectId?: string } = {}
  ): Promise<ClaudeCodeResponse> {
    console.log('🎯 Processing request through AI pipeline...');
    
    try {
      // Step 1: Intent Detection
      const intent = await this.detectUserIntent(userRequest);
      console.log(`📋 Detected intent: ${intent.category} (confidence: ${intent.confidence})`);
      
      // Step 2: Semantic Search for relevant context
      const relevantFiles = await this.performSemanticSearch(userRequest, projectPath);
      console.log(`📁 Found ${relevantFiles.length} relevant files`);
      
      // Step 3: Build Enhanced Context
      const fileNames = relevantFiles.map(f => typeof f === 'string' ? f : f.file);
      const enhancedContext = await this.buildEnhancedContext(
        userRequest,
        projectPath,
        fileNames,
        intent
      );
      
      // Step 4: Task Decomposition
      const tasks = await this.decomposeIntoTasks(userRequest, intent);
      console.log(`🔄 Decomposed into ${tasks.length} tasks`);
      
      // Step 5: Execute tasks with Claude Code
      const results = [];
      for (const task of tasks) {
        console.log(`⚡ Executing: ${task.description}`);
        const result = await this.executeTask(task, enhancedContext);
        results.push(result);

        // Quality check after each task
        const qualityCheck = await this.performQualityCheck(result);
        if (!qualityCheck.passed) {
          console.log(`⚠️  Quality check failed: ${qualityCheck.suggestions.join(', ')}`);
          // Retry with improvements
          const improved = await this.improveTaskResult(result, qualityCheck);
          results[results.length - 1] = improved;
        }
      }
      
      // Step 6: Final integration and validation
      const finalResult = await this.integrateResults(results);

      // Step 7: Update knowledge base
      await this.updateKnowledgeBase({
        ...finalResult,
        projectPath,
        projectId: options?.projectId || 'unknown',
        userRequest
      });
      
      return {
        success: true,
        data: finalResult,
        tokensUsed: results.reduce((sum, r) => sum + (r.tokensUsed || 0), 0)
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Request processing failed'
      };
    }
  }

  /**
   * Build comprehensive project context for Claude Code
   */
  private async buildProjectContext(projectPath: string): Promise<string> {
    console.log('📋 Building project context...');
    
    const context = [];
    
    // Get project structure
    const structure = await this.getProjectStructure(projectPath);
    context.push(`PROJECT STRUCTURE:\n${structure}\n`);
    
    // Get key configuration files
    const configs = await this.getKeyConfigurations(projectPath);
    context.push(`CONFIGURATIONS:\n${configs}\n`);
    
    // Get recent changes (if git available)
    const changes = await this.getRecentChanges(projectPath);
    if (changes) {
      context.push(`RECENT CHANGES:\n${changes}\n`);
    }
    
    // Get existing documentation
    const docs = await this.getProjectDocumentation(projectPath);
    if (docs) {
      context.push(`DOCUMENTATION:\n${docs}\n`);
    }
    
    return context.join('\n---\n');
  }

  /**
   * Detect user intent using AI
   */
  async detectUserIntent(userRequest: string): Promise<{
    category: string;
    confidence: number;
    params: Record<string, any>;
  }> {
    const intentPrompt = `
COMPREHENSIVE REQUEST ANALYSIS:

Analyze this user request and provide complete workflow planning: "${userRequest}"

TASK: Determine intent category AND break down into logical task groups.

INTENT CATEGORIES:
- report: Informational queries (no code changes needed)
- feature_request: Adding new functionality
- bug_fix: Fixing existing issues
- refactoring: Improving code structure
- documentation: Adding/updating docs
- testing: Adding/improving tests
- optimization: Performance improvements

INSTRUCTIONS:
1. Identify the primary intent category
2. Break request into logical task groups (related tasks that should be processed together)
3. For each task group, specify if it requires code modifications or is informational
4. Estimate complexity and risk level for each group

CRITICAL: You MUST return COMPLETE valid JSON with ALL task groups. DO NOT truncate or abbreviate.

REQUIRED JSON FORMAT (respond with ONLY this JSON, no explanations, no markdown):
{
  "intent": {
    "category": "report|feature_request|bug_fix|refactoring|documentation|testing|optimization",
    "confidence": 0.95,
    "requiresModifications": false
  },
  "taskGroups": [
    {
      "groupId": "group_1",
      "description": "Brief description of what this group accomplishes",
      "tasks": ["task 1", "task 2", "task 3"],
      "requiresModifications": false,
      "complexity": "simple|medium|complex",
      "riskLevel": "low|medium|high",
      "estimatedMinutes": 15,
      "primaryDomains": ["domain1", "domain2"]
    },
    {
      "groupId": "group_2",
      "description": "Second group if needed",
      "tasks": ["task 4", "task 5"],
      "requiresModifications": true,
      "complexity": "medium",
      "riskLevel": "medium",
      "estimatedMinutes": 30,
      "primaryDomains": ["domain3"]
    }
  ],
  "workflow": "reporting|development",
  "reasoning": "Brief explanation of the analysis"
}

IMPORTANT: Return the COMPLETE JSON object with all closing braces and brackets.

Response:`;

    const response = await this.executeClaudeCode(
      intentPrompt,
      `User Request: ${userRequest}`,
      { projectPath: '.' }
    );

    if (response.success) {
      try {
        console.log(`🔍 Raw Claude Code response (${response.data.length} chars): ${response.data.substring(0, 200)}...`);

        // First, try to clean the response and extract just JSON
        let cleanedResponse = response.data.trim();

        // Remove any markdown code blocks
        cleanedResponse = cleanedResponse.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1');

        // Enhanced JSON extraction with multiple patterns for comprehensive response
        const patterns = [
          // Complete multiline JSON with proper brace matching (most comprehensive)
          /\{[\s\S]*?"intent"[\s\S]*?"taskGroups"[\s\S]*?\}(?:\s*\])?(?:\s*\})?/,
          // Legacy category format (fallback)
          /\{[^{}]*"category"[^{}]*\}/,
          // Shorter comprehensive format
          /\{[^{}]*"intent"[^{}]*"taskGroups"[^{}]*\}/s,
          // JSON in any format (more permissive)
          /\{.*?"intent".*?\}/s,
          // Legacy confidence field format
          /\{[^}]*"category"[^}]*"confidence"[^}]*\}/
        ];

        for (let i = 0; i < patterns.length; i++) {
          const jsonMatch = cleanedResponse.match(patterns[i]);
          if (jsonMatch) {
            try {
              console.log(`✅ Found JSON pattern ${i + 1}: ${jsonMatch[0]}`);
              const parsed = JSON.parse(jsonMatch[0]);

              // Handle new comprehensive format
              if (parsed.intent && parsed.taskGroups) {
                console.log(`✅ Parsed comprehensive workflow response`);
                return this.transformComprehensiveResponse(parsed);
              }

              // Handle legacy category format
              if (parsed.category) {
                console.log(`✅ Parsed legacy category response`);
                return parsed;
              }
            } catch (parseError) {
              console.log(`❌ Pattern ${i + 1} failed to parse: ${parseError.message}`);
              continue;
            }
          }
        }

        // Advanced brace matching for complex nested JSON
        const jsonStart = cleanedResponse.indexOf('{');
        if (jsonStart >= 0) {
          let braceCount = 0;
          let inString = false;
          let escapeNext = false;
          let jsonEnd = jsonStart;

          for (let i = jsonStart; i < cleanedResponse.length; i++) {
            const char = cleanedResponse[i];

            if (escapeNext) {
              escapeNext = false;
              continue;
            }

            if (char === '\\') {
              escapeNext = true;
              continue;
            }

            if (char === '"' && !escapeNext) {
              inString = !inString;
              continue;
            }

            if (!inString) {
              if (char === '{') braceCount++;
              if (char === '}') {
                braceCount--;
                if (braceCount === 0) {
                  jsonEnd = i + 1;
                  break;
                }
              }
            }
          }

          if (jsonEnd > jsonStart) {
            const jsonStr = cleanedResponse.substring(jsonStart, jsonEnd);
            console.log(`✅ Found JSON via advanced brace matching (${jsonStr.length} chars)`);
            try {
              const parsed = JSON.parse(jsonStr);

              // Handle comprehensive format first
              if (parsed.intent && parsed.taskGroups) {
                console.log(`✅ Parsed comprehensive workflow response via brace matching`);
                return this.transformComprehensiveResponse(parsed);
              }

              // Handle legacy format
              if (parsed.category) {
                console.log(`✅ Parsed legacy category response via brace matching`);
                return parsed;
              }
            } catch (parseError) {
              console.log(`❌ Advanced brace matching failed to parse: ${parseError.message}`);
            }
          }
        }

        // Try parsing the entire response as JSON
        return JSON.parse(cleanedResponse);
      } catch (error) {
        console.log(`⚠️ JSON parsing failed: ${error.message}`);
        console.log(`🔍 Raw Claude Code response: ${response.data}`);

        // Enhanced text analysis for intent detection
        const responseText = response.data.toLowerCase();

        // Look for specific intent indicators in the response
        if (responseText.includes('report') ||
            responseText.includes('what is') ||
            responseText.includes('describe') ||
            responseText.includes('about') ||
            responseText.includes('explain')) {
          console.log('📋 Detected report intent from text analysis');
          return { category: 'report', confidence: 0.8, params: {} };
        }

        if (responseText.includes('feature') || responseText.includes('add') || responseText.includes('implement')) {
          console.log('🔨 Detected feature_request intent from text analysis');
          return { category: 'feature_request', confidence: 0.7, params: {} };
        }

        if (responseText.includes('fix') || responseText.includes('bug') || responseText.includes('error')) {
          console.log('🐛 Detected bug_fix intent from text analysis');
          return { category: 'bug_fix', confidence: 0.7, params: {} };
        }

        // Fallback to default intent
        console.log('❌ Using fallback intent: analysis');
      }
    }

    return { category: 'analysis', confidence: 0.5, params: {} };
  }

  /**
   * Transform comprehensive workflow response to legacy format for backwards compatibility
   */
  private transformComprehensiveResponse(parsed: any): any {
    return {
      category: parsed.intent.category,
      confidence: parsed.intent.confidence,
      params: {
        taskGroups: parsed.taskGroups,
        workflow: parsed.workflow,
        reasoning: parsed.reasoning,
        requiresModifications: parsed.intent.requiresModifications
      }
    };
  }

  /**
   * Analyze user request with comprehensive task breakdown (new optimized approach)
   */
  async analyzeRequestWithTaskBreakdown(userRequest: string): Promise<{
    intent: {
      category: string;
      confidence: number;
      requiresModifications: boolean;
    };
    taskGroups: Array<{
      groupId: string;
      description: string;
      tasks: string[];
      requiresModifications: boolean;
      complexity: 'simple' | 'medium' | 'complex';
      riskLevel: 'low' | 'medium' | 'high';
      estimatedMinutes: number;
      primaryDomains: string[];
    }>;
    workflow: 'reporting' | 'development';
    reasoning: string;
  }> {
    const result = await this.detectUserIntent(userRequest);

    // If we got comprehensive format, extract it
    if (result.params && result.params.taskGroups) {
      return {
        intent: {
          category: result.category,
          confidence: result.confidence,
          requiresModifications: result.params.requiresModifications || false
        },
        taskGroups: result.params.taskGroups,
        workflow: result.params.workflow || 'development',
        reasoning: result.params.reasoning || 'Analysis based on request content'
      };
    }

    // Fallback: Create single task group from legacy format
    const isModification = !['report', 'analysis'].includes(result.category);

    return {
      intent: {
        category: result.category,
        confidence: result.confidence,
        requiresModifications: isModification
      },
      taskGroups: [{
        groupId: 'main_group',
        description: `${result.category} task`,
        tasks: [userRequest],
        requiresModifications: isModification,
        complexity: result.confidence > 0.8 ? 'simple' : 'medium',
        riskLevel: isModification ? 'medium' : 'low',
        estimatedMinutes: isModification ? 30 : 10,
        primaryDomains: [result.category]
      }],
      workflow: isModification ? 'development' : 'reporting',
      reasoning: 'Fallback analysis from legacy format'
    };
  }

  /**
   * Perform semantic search to find relevant files
   */
  private async performSemanticSearch(
    query: string,
    projectPath: string
  ): Promise<Array<{ file: string; relevance: number; summary: string }>> {
    try {
      const pgClient = await this.dbConnections.getPostgresConnection();

      // Use PostgreSQL's full-text search with embeddings
      const searchQuery = `
        SELECT
          file_path,
          content_summary,
          ts_rank(search_vector, plainto_tsquery($1)) as relevance
        FROM semantic_search_embeddings
        WHERE project_path = $2
          AND search_vector @@ plainto_tsquery($1)
        ORDER BY relevance DESC
        LIMIT 10;
      `;

      const result = await pgClient.query(searchQuery, [query, projectPath]);

      const searchResults = result.rows.map(row => ({
        file: row.file_path,
        relevance: parseFloat(row.relevance),
        summary: row.content_summary
      }));

      // If no semantic search results, use fallback file discovery
      if (searchResults.length === 0) {
        console.log('📋 No semantic search results, using fallback file discovery...');
        return await this.fallbackFileDiscovery(query, projectPath);
      }

      return searchResults;
    } catch (error) {
      console.warn('Semantic search failed, using fallback');
      return await this.fallbackFileDiscovery(query, projectPath);
    }
  }

  /**
   * Fallback file discovery when semantic search fails or returns no results
   */
  private async fallbackFileDiscovery(
    query: string,
    projectPath: string
  ): Promise<Array<{ file: string; relevance: number; summary: string }>> {
    const { glob } = await import('glob');
    const path = await import('path');
    const fs = await import('fs/promises');

    const results: Array<{ file: string; relevance: number; summary: string }> = [];

    // For project overview queries OR file creation requests, prioritize key project files
    if (query.toLowerCase().includes('project') || query.toLowerCase().includes('about') ||
        query.toLowerCase().includes('what') || query.toLowerCase().includes('describe') ||
        query.toLowerCase().includes('create') || query.toLowerCase().includes('generate') ||
        query.toLowerCase().includes('add') || query.toLowerCase().includes('build')) {

      const keyFiles = [
        'README.md', 'README.txt', 'readme.md',
        'package.json', 'package-lock.json',
        'tsconfig.json', 'jsconfig.json',
        'src/index.ts', 'src/index.js', 'index.ts', 'index.js',
        'src/main.ts', 'src/main.js', 'main.ts', 'main.js',
        'src/app.ts', 'src/app.js', 'app.ts', 'app.js',
        'client/src/index.tsx', 'client/src/App.tsx', 'client/src/App.js',
        'server/index.js', 'server/app.js', 'server/server.js',
        'client/package.json', 'server/package.json',
        '.codemind/codemind.md', '.codemind/project.json'
      ];

      for (const fileName of keyFiles) {
        const filePath = path.join(projectPath, fileName);
        try {
          const stats = await fs.stat(filePath);
          if (stats.isFile()) {
            results.push({
              file: fileName,
              relevance: 0.9,
              summary: `Key project file: ${fileName}`
            });
          }
        } catch {
          // File doesn't exist, continue
        }
      }

      // Also find main TypeScript/JavaScript files
      try {
        const sourceFiles = await glob('src/**/*.{ts,js}', { cwd: projectPath });
        sourceFiles.slice(0, 5).forEach((file, index) => {
          results.push({
            file,
            relevance: 0.7 - (index * 0.1),
            summary: `Source file: ${file}`
          });
        });
      } catch (error) {
        console.warn('Failed to discover source files:', error.message);
      }
    }

    return results.slice(0, 10); // Limit to 10 results
  }

  // ... Additional helper methods would be implemented here
  
  private buildClaudeCodeCommand(prompt: string, context: string, options: ClaudeCodeOptions): string {
    // Build actual Claude Code CLI command
    // Create a combined prompt that includes context
    const fullPrompt = `${prompt}\n\nContext:\n${context}`;

    // Return just the prompt text - we'll handle piping in executeWithTokenManagement
    return fullPrompt;
  }

  /**
   * Extract the original user request from a complex prompt for compression context
   */
  private extractOriginalRequest(prompt: string): string {
    // Look for common patterns that indicate the original request
    const patterns = [
      /user request[:\s]*["']([^"']+)["']/i,
      /analyze this user request[:\s]*["']([^"']+)["']/i,
      /request[:\s]*["']([^"']+)["']/i,
      /query[:\s]*["']([^"']+)["']/i,
      /"([^"]+)"/g // Last resort: find quoted strings
    ];

    for (const pattern of patterns) {
      const match = prompt.match(pattern);
      if (match && match[1] && match[1].length > 10) {
        return match[1];
      }
    }

    // Fallback: use first line or first 200 characters
    const lines = prompt.split('\n');
    for (const line of lines) {
      if (line.trim().length > 10 && !line.includes('Analyze') && !line.includes('Generate')) {
        return line.trim().substring(0, 200);
      }
    }

    return prompt.substring(0, 200) + '...';
  }


  private parseAnalysisResponse(rawResponse: string): AnalysisResult {
    // Parse and validate Claude Code response
    try {
      return JSON.parse(rawResponse);
    } catch {
      // Fallback parsing or error handling
      throw new Error('Failed to parse analysis response');
    }
  }

  private async storeAnalysisResults(projectPath: string, analysis: AnalysisResult): Promise<void> {
    // Store results in PostgreSQL, Neo4j, Redis
    console.log('💾 Storing analysis results in databases...');
    // Implementation would store in all relevant databases
  }

  // SOLID: Delegate to specialized classes with single responsibilities

  private async buildEnhancedContext(
    userRequest: string,
    projectPath: string,
    relevantFiles: string[],
    intent: any
  ): Promise<string> {
    const { ContextBuilder } = await import('./integration/context-builder');
    const contextBuilder = new ContextBuilder();
    return await contextBuilder.build(userRequest, projectPath, relevantFiles, intent);
  }

  private async decomposeIntoTasks(userRequest: string, intent: any): Promise<any[]> {
    const { TaskDecomposer } = await import('./integration/task-decomposer');
    const taskDecomposer = new TaskDecomposer();
    return await taskDecomposer.decompose(userRequest, intent);
  }

  private async executeTask(task: any, context: string): Promise<any> {
    const { TaskExecutor } = await import('./integration/task-executor');
    const taskExecutor = new TaskExecutor();
    return await taskExecutor.execute(task, context);
  }

  private async performQualityCheck(result: any): Promise<any> {
    const { QualityChecker } = await import('./quality-checker');
    const qualityChecker = new QualityChecker();
    return await qualityChecker.check(result);
  }

  private async improveTaskResult(result: any, qualityCheck: any): Promise<any> {
    const { ResultImprover } = await import('./integration/result-improver');
    const resultImprover = new ResultImprover();
    return await resultImprover.improve(result, qualityCheck);
  }

  private async integrateResults(results: any[]): Promise<any> {
    const { ResultIntegrator } = await import('./integration/result-integrator');
    const resultIntegrator = new ResultIntegrator();
    return await resultIntegrator.integrate(results);
  }

  private async updateKnowledgeBase(analysis: any): Promise<void> {
    const { KnowledgeBaseUpdater } = await import('./integration/knowledge-base-updater');
    const knowledgeBaseUpdater = new KnowledgeBaseUpdater();
    await knowledgeBaseUpdater.update(analysis);
  }

  private async getProjectStructure(projectPath: string): Promise<string> {
    const { ProjectStructureAnalyzer } = await import('./analyzers/project-structure-analyzer');
    const structureAnalyzer = new ProjectStructureAnalyzer();
    return await structureAnalyzer.analyze(projectPath);
  }

  private async getKeyConfigurations(projectPath: string): Promise<string> {
    const { ConfigurationAnalyzer } = await import('./analyzers/configuration-analyzer');
    const configAnalyzer = new ConfigurationAnalyzer();
    return await configAnalyzer.analyze(projectPath);
  }

  private async getRecentChanges(projectPath: string): Promise<string | null> {
    const { ChangeAnalyzer } = await import('./analyzers/change-analyzer');
    const changeAnalyzer = new ChangeAnalyzer();
    return await changeAnalyzer.getRecentChanges(projectPath);
  }

  private async getProjectDocumentation(projectPath: string): Promise<string | null> {
    const { DocumentationAnalyzer } = await import('./analyzers/documentation-analyzer');
    const docAnalyzer = new DocumentationAnalyzer();
    return await docAnalyzer.analyze(projectPath);
  }
}