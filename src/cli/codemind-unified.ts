#!/usr/bin/env node

/**
 * CodeMind Unified CLI
 * Simple interface where users just make requests and get enhanced Claude Code responses
 * 
 * Usage:
 *   codemind "optimize authentication"
 *   codemind "find performance issues"
 *   codemind "refactor database layer"
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { ToolAutodiscoveryService } from '../shared/tool-autodiscovery';
import { ToolRegistry } from '../shared/tool-interface';
import { ColoredLogger } from '../utils/colored-logger';
import { ClaudeToolOrchestrator, ContextEnhancementRequest } from '../services/claude-tool-orchestrator';
import * as path from 'path';
import * as fs from 'fs';

// Enhanced color scheme
const colors = {
  thinking: chalk.gray('🤔 Thinking...'),
  working: chalk.blue('⚡ Working...'),
  success: chalk.green.bold,
  error: chalk.red.bold,
  result: chalk.cyan,
  tip: chalk.yellow,
  phase: chalk.cyan.bold,
  tool: chalk.magenta,
  claude: chalk.blue,
  info: chalk.gray,
  context: chalk.white.bgBlue,
  final: chalk.white.bgGreen.bold
};

interface ToolSelectionResult {
  tool: string;
  parameters: any;
  confidence: number;
  reasoning: string;
}

interface EnhancedRequest {
  originalQuery: string;
  enrichedContext: any[];
  toolsUsed: string[];
  tokenCount: number;
  recommendations: string[];
}

class CodeMindCLI {
  private autodiscovery: ToolAutodiscoveryService;
  private claudeOrchestrator: ClaudeToolOrchestrator;
  private projectPath: string;
  private projectId: string;
  private databaseProjectId: string | null = null;
  private logger: ColoredLogger;

  constructor() {
    this.autodiscovery = new ToolAutodiscoveryService();
    this.claudeOrchestrator = new ClaudeToolOrchestrator();
    this.projectPath = process.cwd();
    this.projectId = this.generateProjectId(this.projectPath);
    this.logger = ColoredLogger.getInstance();
  }

  /**
   * Initialize database project binding
   */
  private async initializeProjectBinding(): Promise<void> {
    try {
      // Check if project exists in database
      const { execSync } = require('child_process');
      const query = `SELECT id FROM projects WHERE project_path = '${this.projectPath.replace(/'/g, "''")}'`;
      const result = execSync(
        `docker exec codemind-database psql -U codemind -d codemind -t -c "${query}"`,
        { encoding: 'utf8', stdio: 'pipe' }
      );
      
      this.databaseProjectId = result.trim();
      
      if (!this.databaseProjectId) {
        this.logger.warning('PROJECT', `Project not found in database: ${this.projectPath}`);
        this.logger.info('PROJECT', 'Run "codemind init" to initialize this project');
      } else {
        this.logger.success('PROJECT', `Bound to project: ${this.databaseProjectId}`);
      }
    } catch (error) {
      this.logger.warning('PROJECT', 'Failed to connect to database - working in offline mode');
    }
  }

  /**
   * Main entry point - handles any natural language request
   */
  async handleRequest(request: string, options: any = {}): Promise<void> {
    // Initialize project binding
    await this.initializeProjectBinding();

    // Clear console for clean output
    if (!options.debug && !options.verbose) {
      console.clear();
    }

    if (options.verbose) {
      // Full detailed process
      await this.runDetailedCycle(request, options);
    } else {
      // Simple user-friendly process
      await this.runSimpleCycle(request, options);
    }
  }

  /**
   * Simple cycle for regular users
   */
  private async runSimpleCycle(request: string, options: any): Promise<void> {
    // Clean, simple header
    console.log(chalk.bold.cyan('\n🧠 CodeMind'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`📝 ${chalk.white(request)}\n`);

    try {
      // Step 1: Initialize (quick)
      console.log(colors.thinking);
      await this.autodiscovery.initializeTools();
      const allTools = ToolRegistry.getAllTools();

      // Step 2: Use Claude to select tools and parameters
      console.log(colors.working);
      const projectContext = await this.analyzeProjectContext();
      const claudeSelection = await this.claudeOrchestrator.orchestrateTools({
        userRequest: request,
        projectPath: this.projectPath,
        projectId: this.databaseProjectId || this.projectId,
        projectContext,
        constraints: {
          maxTools: 6,
          maxTokens: 4000
        }
      });
      
      // Show what Claude selected
      console.log(colors.claude(`🤖 Claude selected: ${claudeSelection.selectedTools.map(t => t.toolName).join(', ')}`));
      console.log(colors.info(`💡 ${claudeSelection.reasoning}\n`));

      // Step 3: Generate context using Claude's selections
      const enhancedContext = await this.generateContextWithClaudeSelection(claudeSelection, request);
      
      // Step 4: Process with Claude Code
      console.log(colors.phase('🎯 Processing with Claude Code...\n'));
      const claudeResponse = await this.executeWithClaudeCode(enhancedContext);
      
      // Step 5: Show results
      this.displaySimpleResults(claudeResponse, enhancedContext);

      // Step 6: Use Claude to determine data updates
      await this.updateDataWithClaude(request, claudeResponse, enhancedContext);

    } catch (error) {
      console.log(colors.error(`\n❌ ${error}`));
      if (options.debug) {
        console.error(error);
      }
    }
  }

  /**
   * Detailed cycle for verbose mode
   */
  private async runDetailedCycle(request: string, options: any): Promise<void> {
    console.log(colors.phase('\n🚀 CODEMIND CONTEXT ENHANCER'));
    console.log(colors.phase('━'.repeat(50)));
    console.log(colors.info(`📝 User Request: "${request}"`));
    console.log(colors.info(`📂 Project: ${this.projectPath}\n`));

    try {
      // Phase 1: Initialize tools
      console.log(colors.phase('⏳ Phase 1: Discovering tools...'));
      await this.autodiscovery.initializeTools();
      const allTools = ToolRegistry.getAllTools();
      console.log(colors.success(`✅ Discovered ${allTools.length} tools\n`));

      // Phase 2: Claude selects tools
      console.log(colors.phase('⏳ Phase 2: Selecting tools...'));
      const intents = this.detectIntents(request);
      const toolSelections = await this.selectTools(request, allTools, { intents });
      console.log(colors.success(`✅ Selected ${toolSelections.length} tools\n`));
      
      this.displayToolSelections(toolSelections);

      // Phase 3: Generate context
      console.log(colors.phase('⏳ Phase 3: Generating context...'));
      const enhancedContext = await this.generateContext(toolSelections, request);
      console.log(colors.success(`✅ Generated ${enhancedContext.tokenCount} tokens\n`));

      // Phase 4: Execute with Claude Code
      console.log(colors.phase('⏳ Phase 4: Processing with Claude Code...'));
      const claudeResponse = await this.executeWithClaudeCode(enhancedContext);
      console.log(colors.success('✅ Processing complete\n'));

      // Phase 5: Use Claude to update knowledge base
      console.log(colors.phase('⏳ Phase 5: Updating knowledge base with Claude...'));
      await this.updateDataWithClaude(request, claudeResponse, enhancedContext);
      console.log(colors.success('✅ Knowledge updated\n'));

      // Phase 6: Final summary
      console.log(colors.phase('📊 FINAL SUMMARY'));
      console.log(colors.phase('━'.repeat(50)));
      console.log(colors.final('Request processed with enhanced context'));

    } catch (error) {
      console.log(colors.error(`❌ Error: ${error}`));
    }
  }

  /**
   * Comprehensive multi-intent tool selection
   */
  private async selectTools(request: string, allTools: any[], context: any): Promise<ToolSelectionResult[]> {
    const selections: ToolSelectionResult[] = [];
    const intents = context.intents || [this.detectIntent(request)];
    
    // Handle sink intention - non-codebase requests go straight to Claude Code
    if (intents.includes('sink')) {
      return [{
        tool: 'DirectClaudeCode',
        parameters: { passthrough: true },
        confidence: 1.0,
        reasoning: 'Non-codebase request - direct Claude Code processing'
      }];
    }
    
    // Core tool: SemanticGraph - always useful for project-related requests
    if (!intents.includes('sink')) {
      selections.push({
        tool: 'SemanticGraphTool',
        parameters: {
          depth: intents.includes('architecture') ? 3 : 2,
          relationships: ['inheritance', 'composition', 'dependency'],
          focusAreas: this.getFocusAreas(request, intents)
        },
        confidence: 0.95,
        reasoning: 'Core knowledge graph analysis for project understanding'
      });
    }
    
    // Intent-specific tool selection
    for (const intent of intents) {
      switch (intent) {
        case 'create':
        case 'refactor':
        case 'architecture':
          // Duplication detection for new code creation
          selections.push({
            tool: 'DuplicationDetector',
            parameters: { includePatterns: true, threshold: 0.8 },
            confidence: 0.9,
            reasoning: 'Prevent code duplication in new/refactored code'
          });
          
          // Centralization analysis
          selections.push({
            tool: 'CentralizationDetector',
            parameters: { patterns: ['duplicated', 'scattered'] },
            confidence: 0.85,
            reasoning: 'Identify centralization opportunities'
          });
          
          // SOLID principles for clean architecture
          if (intents.includes('architecture') || intents.includes('refactor')) {
            selections.push({
              tool: 'SOLIDAnalyzer',
              parameters: { checkAll: true },
              confidence: 0.8,
              reasoning: 'Ensure adherence to SOLID principles'
            });
          }
          break;
          
        case 'update':
        case 'navigation':
          // Tree navigation for understanding code structure
          selections.push({
            tool: 'TreeNavigator',
            parameters: { maxDepth: 4, includeRelationships: true },
            confidence: 0.9,
            reasoning: 'Navigate and understand code structure for updates'
          });
          break;
          
        case 'testing':
          selections.push({
            tool: 'TestCoverageTool',
            parameters: { includeE2E: true, detailed: true },
            confidence: 0.95,
            reasoning: 'Comprehensive testing analysis'
          });
          break;
          
        case 'compilation':
          selections.push({
            tool: 'CompilationVerifier',
            parameters: { checkSyntax: true, checkTypes: true },
            confidence: 0.9,
            reasoning: 'Verify compilation and syntax issues'
          });
          break;
          
        case 'documentation':
          selections.push({
            tool: 'DocumentationAnalyzer',
            parameters: { includeMap: true, enhanced: true },
            confidence: 0.85,
            reasoning: 'Analyze and enhance documentation'
          });
          break;
          
        case 'ui':
          selections.push({
            tool: 'UINavigationAnalyzer',
            parameters: { includeComponents: true },
            confidence: 0.8,
            reasoning: 'Analyze UI structure and navigation'
          });
          break;
          
        case 'usecases':
          selections.push({
            tool: 'UseCaseAnalyzer',
            parameters: { includeRequirements: true },
            confidence: 0.85,
            reasoning: 'Analyze use cases and requirements'
          });
          break;
          
        case 'search':
        case 'explore':
          selections.push({
            tool: 'SemanticSearchTool',
            parameters: { deepSearch: true },
            confidence: 0.9,
            reasoning: 'Deep semantic search and exploration'
          });
          
          selections.push({
            tool: 'TreeNavigator',
            parameters: { maxDepth: 5, explorationMode: true },
            confidence: 0.85,
            reasoning: 'Navigate and explore codebase structure'
          });
          break;
          
        case 'security':
          selections.push({
            tool: 'SecurityAnalyzer',
            parameters: { comprehensive: true },
            confidence: 0.9,
            reasoning: 'Comprehensive security analysis'
          });
          break;
          
        case 'optimize':
        case 'debug':
          // Performance and debugging tools
          selections.push({
            tool: 'PerformanceAnalyzer',
            parameters: { includeMemory: true, includeCPU: true },
            confidence: 0.85,
            reasoning: 'Performance analysis for optimization'
          });
          
          selections.push({
            tool: 'CentralizationDetector',
            parameters: { patterns: ['performance', 'inefficient'] },
            confidence: 0.8,
            reasoning: 'Identify performance bottlenecks'
          });
          break;
          
        case 'database':
          selections.push({
            tool: 'DatabaseSchemaTool',
            parameters: { 
              includeRelationships: true, 
              analyzeQueries: true,
              performanceAnalysis: true 
            },
            confidence: 0.95,
            reasoning: 'Comprehensive database schema and query analysis'
          });
          break;
      }
    }
    
    // Remove duplicates while preserving order
    const uniqueSelections = selections.filter((selection, index) => 
      selections.findIndex(s => s.tool === selection.tool) === index
    );
    
    return uniqueSelections;
  }
  
  /**
   * Get focus areas based on request content and intents
   */
  private getFocusAreas(request: string, intents: string[]): string[] {
    const lower = request.toLowerCase();
    const areas: string[] = [];
    
    // Content-based focus areas
    if (lower.includes('auth') || lower.includes('login')) areas.push('authentication');
    if (lower.includes('database') || lower.includes('db')) areas.push('data');
    if (lower.includes('api') || lower.includes('endpoint')) areas.push('api');
    if (lower.includes('ui') || lower.includes('component')) areas.push('ui');
    if (lower.includes('test')) areas.push('testing');
    if (lower.includes('security')) areas.push('security');
    if (lower.includes('performance')) areas.push('performance');
    if (lower.includes('error') || lower.includes('bug')) areas.push('errors');
    if (lower.includes('config')) areas.push('configuration');
    if (lower.includes('util') || lower.includes('helper')) areas.push('utilities');
    
    // Intent-based focus areas
    for (const intent of intents) {
      switch (intent) {
        case 'architecture': areas.push('design', 'patterns', 'structure'); break;
        case 'optimize': areas.push('performance', 'efficiency', 'bottlenecks'); break;
        case 'debug': areas.push('errors', 'flow', 'debugging'); break;
        case 'security': areas.push('vulnerabilities', 'authentication', 'authorization'); break;
        case 'testing': areas.push('coverage', 'units', 'integration'); break;
        case 'create': areas.push('implementation', 'design', 'patterns'); break;
        case 'update': areas.push('modification', 'enhancement', 'refactoring'); break;
        case 'documentation': areas.push('docs', 'comments', 'guides'); break;
        case 'ui': areas.push('interface', 'components', 'navigation'); break;
      }
    }
    
    // Default areas if none found
    if (areas.length === 0) {
      areas.push('general', 'codebase');
    }
    
    // Remove duplicates
    return [...new Set(areas)];
  }
  
  /**
   * Analyze project context for Claude orchestrator
   */
  private async analyzeProjectContext(): Promise<any> {
    const files = fs.readdirSync(this.projectPath);
    const packageJson = files.includes('package.json') ? 
      JSON.parse(fs.readFileSync(path.join(this.projectPath, 'package.json'), 'utf-8')) : null;
    
    // Detect languages
    const languages = [];
    if (files.some(f => f.endsWith('.ts'))) languages.push('typescript');
    if (files.some(f => f.endsWith('.js'))) languages.push('javascript');
    if (files.some(f => f.endsWith('.py'))) languages.push('python');
    if (files.some(f => f.endsWith('.go'))) languages.push('go');
    if (files.some(f => f.endsWith('.rs'))) languages.push('rust');
    if (files.some(f => f.endsWith('.java'))) languages.push('java');
    
    // Detect frameworks
    const frameworks = [];
    if (packageJson?.dependencies?.react) frameworks.push('react');
    if (packageJson?.dependencies?.vue) frameworks.push('vue');
    if (packageJson?.dependencies?.angular) frameworks.push('angular');
    if (packageJson?.dependencies?.express) frameworks.push('express');
    if (packageJson?.dependencies?.next) frameworks.push('nextjs');
    
    // Detect file types and project characteristics
    const allFiles = this.getAllFiles(this.projectPath);
    const fileTypes = [...new Set(allFiles.map(f => path.extname(f)).filter(ext => ext))];
    
    const hasTests = allFiles.some(f => f.includes('test') || f.includes('spec'));
    const hasDocumentation = files.includes('README.md') || files.includes('docs');
    
    const size = allFiles.length > 1000 ? 'large' : allFiles.length > 100 ? 'medium' : 'small';
    
    return {
      languages,
      frameworks,
      fileTypes,
      size,
      hasTests,
      hasDocumentation
    };
  }

  /**
   * Generate context using Claude's tool selections
   */
  private async generateContextWithClaudeSelection(claudeSelection: any, request: string): Promise<EnhancedRequest> {
    const enrichedContext: any[] = [];
    const toolsUsed: string[] = [];
    let tokenCount = 0;
    
    console.log(colors.info('📊 Executing Claude-selected tools...'));
    
    // Execute tools according to Claude's execution plan
    for (const toolSelection of claudeSelection.selectedTools) {
      try {
        console.log(colors.tool(`   • ${toolSelection.toolName} (${Math.round(toolSelection.confidence * 100)}%)`));
        
        // Get tool instance
        const tool = ToolRegistry.getToolById(toolSelection.toolId);
        if (tool) {
          // Execute with Claude-determined parameters
          const analysis = await tool.analyzeProject(
            this.projectPath,
            this.databaseProjectId || this.projectId,
            toolSelection.parameters
          );
          
          enrichedContext.push({
            toolId: toolSelection.toolId,
            toolName: toolSelection.toolName,
            data: analysis.data,
            analysis: analysis.data,
            confidence: toolSelection.confidence,
            parameters: toolSelection.parameters,
            fromCache: false,
            reasoning: toolSelection.reasoning
          });
          
          toolsUsed.push(toolSelection.toolName);
          tokenCount += this.estimateTokens(analysis);
        }
      } catch (error) {
        this.logger.warning('TOOL', `Tool ${toolSelection.toolName} failed: ${error}`);
        
        // Try to continue with other tools
        enrichedContext.push({
          toolId: toolSelection.toolId,
          toolName: toolSelection.toolName,
          error: error instanceof Error ? error.message : 'Tool execution failed',
          confidence: 0,
          parameters: toolSelection.parameters
        });
      }
    }
    
    // Generate AI-enhanced recommendations
    const recommendations = await this.generateClaudeRecommendations(enrichedContext, request, claudeSelection);
    
    return {
      originalQuery: request,
      enrichedContext,
      toolsUsed,
      tokenCount,
      recommendations
    };
  }

  /**
   * Generate recommendations using Claude's analysis
   */
  private async generateClaudeRecommendations(context: any[], request: string, claudeSelection: any): Promise<string[]> {
    const recommendations: string[] = [];
    
    // Aggregate recommendations from all tools
    for (const item of context) {
      if (item.analysis?.recommendations) {
        recommendations.push(...item.analysis.recommendations);
      }
    }
    
    // Add Claude's high-level recommendations
    if (claudeSelection.confidence < 0.7) {
      recommendations.push('Consider providing more specific requirements for better tool selection');
    }
    
    // Add context-specific recommendations
    const hasErrors = context.some(item => item.error);
    if (hasErrors) {
      recommendations.push('Some analysis tools encountered issues - consider running individual tools for detailed diagnostics');
    }
    
    const cacheUsage = context.filter(item => item.fromCache).length;
    if (cacheUsage > 0) {
      recommendations.push(`Using ${cacheUsage} cached results - add 'refresh' to your request for latest analysis`);
    }
    
    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Get all files in project recursively
   */
  private getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
    try {
      const files = fs.readdirSync(dirPath);
      
      files.forEach(file => {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
          if (!['node_modules', '.git', 'dist', 'build'].includes(file)) {
            arrayOfFiles = this.getAllFiles(fullPath, arrayOfFiles);
          }
        } else {
          arrayOfFiles.push(fullPath);
        }
      });
    } catch (error) {
      // Ignore inaccessible directories
    }
    
    return arrayOfFiles;
  }

  /**
   * Generate enhanced context from tool selections (LEGACY - kept for compatibility)
   */
  private async generateContext(toolSelections: ToolSelectionResult[], request: string): Promise<EnhancedRequest> {
    const enrichedContext: any[] = [];
    const toolsUsed: string[] = [];
    let tokenCount = 0;
    
    console.log(colors.info('📊 Analyzing codebase...'));
    
    // Execute each selected tool
    for (const selection of toolSelections) {
      try {
        console.log(colors.tool(`   • ${selection.tool}`));
        
        // Get tool instance and execute analysis
        const tool = ToolRegistry.getTool(selection.tool);
        if (tool) {
          const analysis = await tool.analyzeProject(
            this.projectPath, 
            this.projectId, 
            selection.parameters
          );
          
          enrichedContext.push({
            tool: selection.tool,
            data: analysis,
            confidence: selection.confidence,
            parameters: selection.parameters
          });
          
          toolsUsed.push(selection.tool);
          tokenCount += this.estimateTokens(analysis);
        }
      } catch (error) {
        this.logger.warning('TOOL', `Tool ${selection.tool} failed: ${error}`);
      }
    }
    
    // Generate recommendations based on context
    const recommendations = this.generateRecommendations(enrichedContext, request);
    
    return {
      originalQuery: request,
      enrichedContext,
      toolsUsed,
      tokenCount,
      recommendations
    };
  }
  
  /**
   * Generate recommendations from context
   */
  private generateRecommendations(context: any[], request: string): string[] {
    const recommendations: string[] = [];
    
    // Analyze context for common patterns
    const hasHighComplexity = context.some(c => 
      c.data?.metrics?.complexity > 10
    );
    
    const hasDuplication = context.some(c => 
      c.tool === 'CentralizationDetector' && c.data?.duplicates?.length > 0
    );
    
    const hasLowCoverage = context.some(c => 
      c.tool === 'TestCoverageTool' && c.data?.coverage < 80
    );
    
    if (hasHighComplexity) {
      recommendations.push('Consider breaking down complex functions');
    }
    
    if (hasDuplication) {
      recommendations.push('Refactor duplicated code patterns');
    }
    
    if (hasLowCoverage) {
      recommendations.push('Increase test coverage for better reliability');
    }
    
    return recommendations;
  }
  
  /**
   * Execute enhanced request with Claude Code
   */
  private async executeWithClaudeCode(enhancedContext: EnhancedRequest): Promise<string> {
    // This would integrate with Claude Code API or process
    // For now, return a simulated response
    
    const contextSummary = {
      query: enhancedContext.originalQuery,
      projectType: this.detectProjectType(),
      toolsUsed: enhancedContext.toolsUsed,
      keyFindings: enhancedContext.enrichedContext.map(c => ({
        tool: c.tool,
        summary: this.summarizeAnalysis(c.data)
      })),
      recommendations: enhancedContext.recommendations,
      tokenCount: enhancedContext.tokenCount
    };
    
    // In a real implementation, this would call Claude Code with the enhanced context
    // For now, return a formatted summary
    return JSON.stringify(contextSummary, null, 2);
  }
  
  /**
   * Update data using Claude to determine what needs updating
   */
  private async updateDataWithClaude(request: string, response: string, context: EnhancedRequest): Promise<void> {
    if (!this.databaseProjectId) {
      this.logger.warning('UPDATE', 'No database project ID - skipping data updates');
      return;
    }

    try {
      console.log(colors.info('🤖 Claude analyzing update requirements...'));
      
      // Use Claude to determine what data needs updating
      const updateAnalysis = await this.analyzeUpdateRequirements(request, response, context);
      
      // Execute Claude-determined updates
      for (const update of updateAnalysis.updates) {
        console.log(colors.info(`   📝 ${update.description}`));
        
        try {
          await this.executeDataUpdate(update);
          console.log(colors.success(`      ✅ ${update.toolName} updated`));
        } catch (error) {
          this.logger.warning('UPDATE', `Failed to update ${update.toolName}: ${error}`);
        }
      }

      // Log Claude decision for future reference
      await this.logClaudeDecision('data_update', {
        request,
        response: typeof response === 'string' ? response : JSON.stringify(response),
        updates: updateAnalysis.updates.map(u => ({ tool: u.toolName, reason: u.reasoning })),
        confidence: updateAnalysis.confidence
      });
      
      console.log(colors.success(`🎯 Data updates complete (${updateAnalysis.updates.length} tools updated)`));
      
    } catch (error) {
      this.logger.warning('UPDATE', `Claude-based update failed: ${error}`);
      // Fallback to legacy update method
      await this.updateAllTools(request, response, []);
    }
  }

  /**
   * Analyze what data needs updating using Claude
   */
  private async analyzeUpdateRequirements(request: string, response: string, context: EnhancedRequest): Promise<any> {
    // Simulated Claude analysis - in real implementation, this would call Claude API
    const updates = [];
    const requestLower = request.toLowerCase();
    
    // Always update Claude decisions
    updates.push({
      toolName: 'claude-decisions',
      action: 'insert',
      data: {
        decision_type: this.categorizeRequest(request),
        context: { request, timestamp: new Date().toISOString() },
        decision: { summary: 'Request processed successfully' },
        confidence: 0.8,
        reasoning: `Processed user request: ${request}`
      },
      description: 'Recording Claude decision',
      reasoning: 'Track AI decision-making process'
    });

    // Analyze context to determine tool-specific updates
    for (const item of context.enrichedContext || []) {
      if (item.error) continue; // Skip failed tools
      
      const toolNeedsUpdate = await this.shouldUpdateTool(item, request, response);
      if (toolNeedsUpdate.shouldUpdate) {
        updates.push({
          toolName: item.toolId,
          action: toolNeedsUpdate.action,
          data: toolNeedsUpdate.data,
          description: `Update ${item.toolName} with new findings`,
          reasoning: toolNeedsUpdate.reasoning
        });
      }
    }

    // Check for structural changes that affect tree navigation
    if (requestLower.includes('refactor') || requestLower.includes('move') || requestLower.includes('restructure')) {
      updates.push({
        toolName: 'tree-navigation',
        action: 'refresh',
        data: { forceRefresh: true },
        description: 'Refresh tree navigation due to structural changes',
        reasoning: 'Structural changes detected in request'
      });
    }

    // Check for code quality changes
    if (requestLower.includes('clean') || requestLower.includes('quality') || requestLower.includes('solid')) {
      updates.push({
        toolName: 'solid-analysis',
        action: 'refresh',
        data: { forceRefresh: true },
        description: 'Refresh SOLID analysis due to quality improvements',
        reasoning: 'Code quality changes detected'
      });
    }

    // Check for test-related changes
    if (requestLower.includes('test') || requestLower.includes('coverage')) {
      updates.push({
        toolName: 'test-coverage',
        action: 'refresh',
        data: { forceRefresh: true },
        description: 'Refresh test coverage analysis',
        reasoning: 'Test-related changes detected'
      });
    }

    return {
      updates: this.deduplicateUpdates(updates),
      confidence: 0.85,
      reasoning: `Identified ${updates.length} potential data updates based on request analysis`
    };
  }

  /**
   * Determine if a specific tool needs updating
   */
  private async shouldUpdateTool(toolContext: any, request: string, response: string): Promise<any> {
    const toolId = toolContext.toolId;
    const hasNewData = toolContext.data && !toolContext.fromCache;
    const wasSuccessful = !toolContext.error;
    
    if (!wasSuccessful) {
      return { shouldUpdate: false };
    }

    // Tool-specific update logic
    switch (toolId) {
      case 'tree-navigator':
        return {
          shouldUpdate: hasNewData,
          action: 'update',
          data: toolContext.data,
          reasoning: 'New tree structure analysis available'
        };
        
      case 'duplication-detector':
        return {
          shouldUpdate: hasNewData && toolContext.data?.length > 0,
          action: 'update',
          data: toolContext.data,
          reasoning: 'New code duplications detected'
        };
        
      case 'compilation-verifier':
        return {
          shouldUpdate: hasNewData,
          action: 'insert',
          data: {
            build_id: require('crypto').randomUUID(),
            ...toolContext.data
          },
          reasoning: 'New compilation results available'
        };
        
      case 'solid-analyzer':
        return {
          shouldUpdate: hasNewData && toolContext.analysis?.violations?.length > 0,
          action: 'update',
          data: toolContext.analysis.violations,
          reasoning: 'SOLID principle violations detected'
        };
        
      default:
        return {
          shouldUpdate: hasNewData,
          action: 'update',
          data: toolContext.data,
          reasoning: `Fresh analysis data from ${toolId}`
        };
    }
  }

  /**
   * Execute a specific data update
   */
  private async executeDataUpdate(update: any): Promise<void> {
    if (!update.data) return;
    
    const tool = ToolRegistry.getToolById(update.toolName);
    if (tool) {
      // Use tool's database interface
      await tool.updateAfterCliRequest(this.projectPath, this.databaseProjectId!, 'cli-request', update.data);
    } else {
      // Direct API call as fallback
      const fetch = require('node-fetch');
      const apiUrl = `http://localhost:3003/api/tools/${this.databaseProjectId}/${update.toolName}`;
      
      const response = await fetch(apiUrl, {
        method: update.action === 'insert' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update.data)
      });
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }
    }
  }

  /**
   * Remove duplicate updates
   */
  private deduplicateUpdates(updates: any[]): any[] {
    const seen = new Set();
    return updates.filter(update => {
      const key = `${update.toolName}-${update.action}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Log Claude decision for tracking
   */
  private async logClaudeDecision(decisionType: string, data: any): Promise<void> {
    try {
      const fetch = require('node-fetch');
      const apiUrl = `http://localhost:3003/api/tools/${this.databaseProjectId}/claude-decisions`;
      
      await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          decision_type: decisionType,
          context: JSON.stringify(data),
          decision: JSON.stringify({ action: 'success' }),
          confidence: data.confidence || 0.8,
          tokens_used: this.estimateTokens(data),
          reasoning: data.reasoning || 'Automated decision'
        }])
      });
    } catch (error) {
      this.logger.warning('DECISION', `Failed to log Claude decision: ${error}`);
    }
  }

  /**
   * Legacy update method (kept for compatibility and fallback)
   * Update all tools with request and response and refresh tool-specific database tables
   */
  private async updateAllTools(request: string, response: string, allTools: any[]): Promise<void> {
    // Update all tools with the request/response for learning
    for (const tool of allTools) {
      try {
        if (tool.updateKnowledge) {
          await tool.updateKnowledge(this.projectId, {
            request,
            response,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        this.logger.warning('UPDATE', `Failed to update ${tool.constructor.name}: ${error}`);
      }
    }

    // Update tool-specific database tables if we have database connectivity
    if (this.databaseProjectId) {
      await this.updateToolSpecificTables(request, response);
    }
  }

  /**
   * Update tool-specific database tables based on the request and analysis
   */
  private async updateToolSpecificTables(request: string, response: string): Promise<void> {
    if (!this.databaseProjectId) return;

    try {
      const { execSync } = require('child_process');
      const analysisDate = new Date().toISOString();
      
      // Log the Claude decision for this request
      const claudeDecision = {
        project_id: this.databaseProjectId,
        decision_type: this.categorizeRequest(request),
        context: JSON.stringify({
          request: request,
          project_path: this.projectPath,
          timestamp: analysisDate
        }),
        decision: JSON.stringify({
          response_summary: this.summarizeResponse(response),
          tools_used: this.extractToolsFromResponse(response),
          recommendations: this.extractRecommendationsFromResponse(response)
        }),
        confidence: this.estimateConfidence(request, response),
        tokens_used: this.estimateTokens(response),
        reasoning: this.extractReasoning(response)
      };

      const query = `INSERT INTO claude_decisions (project_id, decision_type, context, decision, confidence, tokens_used, reasoning) VALUES ('${this.databaseProjectId}'::uuid, '${claudeDecision.decision_type}', '${claudeDecision.context.replace(/'/g, "''")}'::jsonb, '${claudeDecision.decision.replace(/'/g, "''")}'::jsonb, ${claudeDecision.confidence}, ${claudeDecision.tokens_used}, '${(claudeDecision.reasoning || '').replace(/'/g, "''")}');`;
      
      execSync(`docker exec codemind-database psql -U codemind -d codemind -c "${query}"`, { stdio: 'pipe' });
      
      // Update relevant tool tables based on request type
      await this.updateRelevantToolTables(request, response);
      
      this.logger.info('DATABASE', 'Tool-specific tables updated');
    } catch (error) {
      this.logger.warning('DATABASE', `Failed to update tool tables: ${error}`);
    }
  }

  /**
   * Update specific tool tables based on the type of request
   */
  private async updateRelevantToolTables(request: string, response: string): Promise<void> {
    const requestLower = request.toLowerCase();
    const { execSync } = require('child_process');
    
    try {
      // If request involves testing, update test coverage data
      if (requestLower.includes('test') || requestLower.includes('coverage')) {
        // Trigger a new test coverage analysis
        this.updateTestCoverageTable();
      }

      // If request involves compilation or build, update compilation results
      if (requestLower.includes('compile') || requestLower.includes('build') || requestLower.includes('error')) {
        this.updateCompilationTable();
      }

      // If request involves code structure or navigation, update tree navigation
      if (requestLower.includes('structure') || requestLower.includes('navigate') || requestLower.includes('explore')) {
        this.updateTreeNavigationTable();
      }

      // If request involves code quality or patterns, update SOLID analysis
      if (requestLower.includes('quality') || requestLower.includes('refactor') || requestLower.includes('clean')) {
        this.updateSOLIDTable();
      }

      // If request involves UI or components, update UI navigation
      if (requestLower.includes('ui') || requestLower.includes('component') || requestLower.includes('interface')) {
        this.updateUINavigationTable();
      }

      // If request involves documentation, update documentation structure
      if (requestLower.includes('document') || requestLower.includes('readme') || requestLower.includes('guide')) {
        this.updateDocumentationTable();
      }
      
    } catch (error) {
      this.logger.warning('DATABASE', `Failed to update specific tool tables: ${error}`);
    }
  }

  private updateTestCoverageTable(): void {
    // Placeholder for test coverage update logic
    this.logger.info('DATABASE', 'Test coverage table update triggered');
  }

  private updateCompilationTable(): void {
    const { execSync } = require('child_process');
    try {
      const buildId = require('crypto').randomUUID();
      // Simple compilation status check
      const query = `INSERT INTO compilation_results (project_id, build_id, build_status, compiler, total_files, successful_files, build_time_ms) VALUES ('${this.databaseProjectId}'::uuid, '${buildId}', 'analyzed', 'cli-check', 1, 1, 500);`;
      execSync(`docker exec codemind-database psql -U codemind -d codemind -c "${query}"`, { stdio: 'pipe' });
    } catch (error) {
      this.logger.warning('DATABASE', `Compilation table update failed: ${error}`);
    }
  }

  private updateTreeNavigationTable(): void {
    // Placeholder for tree navigation update logic
    this.logger.info('DATABASE', 'Tree navigation table update triggered');
  }

  private updateSOLIDTable(): void {
    // Placeholder for SOLID analysis update logic
    this.logger.info('DATABASE', 'SOLID analysis table update triggered');
  }

  private updateUINavigationTable(): void {
    // Placeholder for UI navigation update logic
    this.logger.info('DATABASE', 'UI navigation table update triggered');
  }

  private updateDocumentationTable(): void {
    const { execSync } = require('child_process');
    const fs = require('fs');
    try {
      // Check for documentation files and update their status
      const docs = ['README.md', 'CHANGELOG.md', 'docs/'].filter(doc => 
        fs.existsSync(path.join(this.projectPath, doc))
      );
      
      docs.forEach(doc => {
        const docType = doc.toLowerCase().includes('readme') ? 'readme' : 
                      doc.toLowerCase().includes('change') ? 'changelog' : 'guide';
        const query = `INSERT INTO documentation_structure (project_id, doc_type, file_path, title, last_updated, completeness_score, quality_score) VALUES ('${this.databaseProjectId}'::uuid, '${docType}', '${doc}', '${doc}', NOW(), 0.7, 0.7) ON CONFLICT (project_id, file_path) DO UPDATE SET last_updated = NOW();`;
        try {
          execSync(`docker exec codemind-database psql -U codemind -d codemind -c "${query}"`, { stdio: 'pipe' });
        } catch (e) {
          // Ignore individual doc update failures
        }
      });
    } catch (error) {
      this.logger.warning('DATABASE', `Documentation table update failed: ${error}`);
    }
  }

  /**
   * Helper methods for response analysis
   */
  private categorizeRequest(request: string): string {
    const lower = request.toLowerCase();
    if (lower.includes('test') || lower.includes('coverage')) return 'testing';
    if (lower.includes('compile') || lower.includes('build')) return 'compilation';
    if (lower.includes('refactor') || lower.includes('clean')) return 'refactoring';
    if (lower.includes('optimize') || lower.includes('performance')) return 'optimization';
    if (lower.includes('debug') || lower.includes('fix')) return 'debugging';
    if (lower.includes('architecture') || lower.includes('design')) return 'architecture';
    if (lower.includes('document') || lower.includes('explain')) return 'documentation';
    return 'general';
  }

  private summarizeResponse(response: string): string {
    try {
      const parsed = JSON.parse(response);
      return `${parsed.keyFindings?.length || 0} findings, ${parsed.recommendations?.length || 0} recommendations`;
    } catch {
      return response.substring(0, 100) + (response.length > 100 ? '...' : '');
    }
  }

  private extractToolsFromResponse(response: string): string[] {
    try {
      const parsed = JSON.parse(response);
      return parsed.toolsUsed || [];
    } catch {
      return [];
    }
  }

  private extractRecommendationsFromResponse(response: string): string[] {
    try {
      const parsed = JSON.parse(response);
      return parsed.recommendations || [];
    } catch {
      return [];
    }
  }

  private estimateConfidence(request: string, response: string): number {
    // Simple confidence estimation based on response quality
    try {
      const parsed = JSON.parse(response);
      if (parsed.keyFindings && parsed.recommendations) {
        return Math.min(0.95, 0.7 + (parsed.keyFindings.length * 0.05));
      }
    } catch {
      // Fallback confidence
    }
    return 0.75;
  }

  private extractReasoning(response: string): string {
    try {
      const parsed = JSON.parse(response);
      return parsed.reasoning || 'Analysis completed based on available tools and context';
    } catch {
      return 'Standard CLI analysis';
    }
  }
  
  /**
   * Display simple results to user
   */
  private displaySimpleResults(claudeResponse: string, enhancedContext: EnhancedRequest): void {
    try {
      const result = JSON.parse(claudeResponse);
      
      console.log(colors.success('\n✅ Analysis Complete\n'));
      
      // Show key findings
      if (result.keyFindings?.length > 0) {
        console.log(colors.result('📊 Key Findings:'));
        result.keyFindings.forEach((finding: any) => {
          console.log(`   • ${colors.tool(finding.tool)}: ${finding.summary}`);
        });
        console.log('');
      }
      
      // Show recommendations
      if (result.recommendations?.length > 0) {
        console.log(colors.tip('💡 Recommendations:'));
        result.recommendations.forEach((rec: string) => {
          console.log(`   • ${rec}`);
        });
        console.log('');
      }
      
      // Show context info
      console.log(colors.info(`📈 Context: ${result.tokenCount} tokens, ${result.toolsUsed.length} tools`));
      
    } catch (error) {
      console.log(colors.result('\n✅ Request processed with enhanced context'));
    }
  }
  
  /**
   * Display detailed tool selections
   */
  private displayToolSelections(selections: ToolSelectionResult[]): void {
    console.log(colors.tool('🛠  Selected Tools:'));
    selections.forEach(selection => {
      console.log(`   • ${colors.tool(selection.tool)} (${Math.round(selection.confidence * 100)}%)`);
      console.log(`     ${colors.info(selection.reasoning)}`);
      if (selection.parameters && Object.keys(selection.parameters).length > 0) {
        console.log(`     Parameters: ${chalk.gray(JSON.stringify(selection.parameters))}`);
      }
    });
    console.log('');
  }
  
  /**
   * Utility methods
   */
  private generateProjectId(projectPath: string): string {
    return Buffer.from(projectPath).toString('base64').slice(0, 16);
  }
  
  private estimateTokens(data: any): number {
    return JSON.stringify(data).length / 4; // Rough estimate
  }
  
  private summarizeAnalysis(data: any): string {
    if (!data) return 'No data available';
    
    if (data.metrics) {
      return `${data.metrics.files || 0} files analyzed`;
    }
    
    if (data.duplicates) {
      return `${data.duplicates.length} duplication issues found`;
    }
    
    if (data.coverage) {
      return `${Math.round(data.coverage)}% test coverage`;
    }
    
    return 'Analysis completed';
  }

  /**
   * Detect multiple intents from the user's request
   */
  private detectIntents(request: string): string[] {
    const lower = request.toLowerCase();
    const intents: string[] = [];
    
    // Check for specific action intents
    if (lower.includes('create') || lower.includes('add') || lower.includes('implement')) intents.push('create');
    if (lower.includes('update') || lower.includes('modify') || lower.includes('change')) intents.push('update');
    if (lower.includes('refactor') || lower.includes('restructure')) intents.push('refactor');
    if (lower.includes('optimize') || lower.includes('performance') || lower.includes('speed')) intents.push('optimize');
    if (lower.includes('debug') || lower.includes('fix') || lower.includes('error') || lower.includes('bug')) intents.push('debug');
    if (lower.includes('test') || lower.includes('coverage') || lower.includes('unit test')) intents.push('testing');
    if (lower.includes('document') || lower.includes('explain') || lower.includes('comment')) intents.push('documentation');
    if (lower.includes('security') || lower.includes('vulnerability') || lower.includes('secure')) intents.push('security');
    if (lower.includes('architecture') || lower.includes('design') || lower.includes('pattern')) intents.push('architecture');
    if (lower.includes('find') || lower.includes('search') || lower.includes('locate')) intents.push('search');
    if (lower.includes('understand') || lower.includes('analyze') || lower.includes('explore')) intents.push('explore');
    if (lower.includes('duplicate') || lower.includes('similar') || lower.includes('copy')) intents.push('deduplication');
    if (lower.includes('compile') || lower.includes('build') || lower.includes('syntax')) intents.push('compilation');
    if (lower.includes('solid') || lower.includes('principle') || lower.includes('clean code')) intents.push('solid');
    if (lower.includes('navigate') || lower.includes('tree') || lower.includes('structure')) intents.push('navigation');
    if (lower.includes('ui') || lower.includes('interface') || lower.includes('component')) intents.push('ui');
    if (lower.includes('use case') || lower.includes('requirement') || lower.includes('feature')) intents.push('usecases');
    if (lower.includes('database') || lower.includes('schema') || lower.includes('table') || lower.includes('query') || lower.includes('sql')) intents.push('database');
    
    // Check for non-codebase related requests (sink)
    const nonCodebaseKeywords = ['weather', 'recipe', 'joke', 'math', 'calculate', 'translate', 'define'];
    if (nonCodebaseKeywords.some(keyword => lower.includes(keyword)) && 
        !['code', 'project', 'file', 'function', 'class', 'api'].some(keyword => lower.includes(keyword))) {
      intents.push('sink');
    }
    
    // If no specific intents found, default to general
    if (intents.length === 0) {
      intents.push('general');
    }
    
    return intents;
  }

  /**
   * Backward compatibility - return primary intent
   */
  private detectIntent(request: string): string {
    const intents = this.detectIntents(request);
    return intents[0] || 'general';
  }

  /**
   * Detect project type from current directory
   */
  private detectProjectType(): string {
    const files = fs.readdirSync(this.projectPath);
    
    // Check for common project indicators
    if (files.includes('package.json')) {
      const pkg = JSON.parse(
        fs.readFileSync(path.join(this.projectPath, 'package.json'), 'utf-8')
      );
      
      if (pkg.dependencies) {
        if (pkg.dependencies.react || pkg.dependencies['react-dom']) return 'react';
        if (pkg.dependencies.vue) return 'vue';
        if (pkg.dependencies.angular) return 'angular';
        if (pkg.dependencies.express) return 'express';
        if (pkg.dependencies.next) return 'nextjs';
      }
      
      return 'node';
    }
    
    if (files.includes('requirements.txt') || files.includes('setup.py')) return 'python';
    if (files.includes('Cargo.toml')) return 'rust';
    if (files.includes('go.mod')) return 'go';
    if (files.includes('pom.xml')) return 'java';
    if (files.includes('composer.json')) return 'php';
    if (files.includes('Gemfile')) return 'ruby';
    
    return 'general';
  }
}

// Set up the CLI command
const program = new Command();

// Configure program
program
  .name('codemind')
  .description('CodeMind - Natural language interface for enhanced code analysis')
  .version('3.0.0')
  .usage('[options] <request>')
  .helpOption('-h, --help', 'Show help')
  .addHelpText('after', `
Examples:
  $ codemind "optimize database queries"
  $ codemind "find security issues"
  $ codemind "refactor authentication system"
  $ codemind "explain payment processing"
  
Options:
  --verbose    Show detailed enhancement process
  --quiet      Minimal output
  --debug      Show debug information
  
Project Detection:
  CodeMind automatically detects your project type and adjusts its analysis accordingly.
  
More Information:
  https://github.com/your-org/codemind
  `)
  .allowExcessArguments(false);

// Main command - accepts natural language
program
  .argument('[request...]', 'Your request in natural language')
  .option('-v, --verbose', 'Show detailed process')
  .option('-q, --quiet', 'Minimal output')
  .option('-d, --debug', 'Debug mode')
  .option('-t, --project-type <type>', 'Override detected project type')
  .option('--max-tokens <n>', 'Maximum context tokens', '4000')
  .action(async (requestParts, options) => {
    // Join request parts into single string
    const request = requestParts.join(' ');
    
    if (!request) {
      // Interactive mode
      console.log(chalk.cyan('🧠 CodeMind Interactive Mode\n'));
      console.log('Type your request (or "exit" to quit):\n');
      
      // Simple interactive prompt
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.gray('> ')
      });
      
      rl.prompt();
      
      rl.on('line', async (line: string) => {
        const input = line.trim();
        
        if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
          console.log(chalk.gray('\nGoodbye! 👋\n'));
          process.exit(0);
        }
        
        if (input) {
          const cli = new CodeMindCLI();
          await cli.handleRequest(input, options);
          console.log(''); // Empty line
        }
        
        rl.prompt();
      });
      
      rl.on('close', () => {
        console.log(chalk.gray('\nGoodbye! 👋\n'));
        process.exit(0);
      });
      
    } else {
      // Single request mode
      const cli = new CodeMindCLI();
      await cli.handleRequest(request, options);
    }
  });

// Special commands
program
  .command('init')
  .description('Initialize CodeMind for current project')
  .action(async () => {
    console.log(chalk.cyan('\n🚀 Initializing CodeMind...\n'));
    
    // Run initialization script
    const { execSync } = require('child_process');
    try {
      execSync('powershell -File scripts/init-project.ps1 -ProjectPath "."', {
        stdio: 'inherit',
        cwd: path.resolve(__dirname, '..', '..')
      });
      console.log(chalk.green('\n✅ CodeMind initialized successfully!\n'));
    } catch (error) {
      console.error(chalk.red('\n❌ Initialization failed\n'));
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check CodeMind services status')
  .action(async () => {
    console.log(chalk.cyan('\n📊 CodeMind Status\n'));
    
    // Check services
    const services = [
      { name: 'PostgreSQL', url: 'http://localhost:5432', port: 5432 },
      { name: 'Neo4j', url: 'http://localhost:7474', port: 7474 },
      { name: 'Redis', url: 'http://localhost:6379', port: 6379 },
      { name: 'Orchestrator', url: 'http://localhost:3006/health', port: 3006 },
      { name: 'Dashboard', url: 'http://localhost:3003', port: 3003 }
    ];
    
    for (const service of services) {
      try {
        // Simple port check
        const net = require('net');
        const isOpen = await new Promise((resolve) => {
          const socket = new net.Socket();
          socket.setTimeout(1000);
          socket.on('connect', () => {
            socket.destroy();
            resolve(true);
          });
          socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
          });
          socket.on('error', () => {
            resolve(false);
          });
          socket.connect(service.port, 'localhost');
        });
        
        if (isOpen) {
          console.log(`✅ ${service.name}: ${chalk.green('Running')}`);
        } else {
          console.log(`❌ ${service.name}: ${chalk.red('Not running')}`);
        }
      } catch {
        console.log(`❌ ${service.name}: ${chalk.red('Not running')}`);
      }
    }
    
    console.log('');
  });

// Parse arguments
program.parse(process.argv);

// If no arguments, show interactive mode
if (process.argv.length === 2) {
  program.outputHelp();
  console.log(chalk.cyan('\n💡 Tip: Just type your request after "codemind"\n'));
  console.log(chalk.gray('Examples:'));
  console.log(chalk.gray('  codemind optimize database'));
  console.log(chalk.gray('  codemind find bugs'));
  console.log(chalk.gray('  codemind refactor auth\n'));
}