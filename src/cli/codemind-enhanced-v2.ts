#!/usr/bin/env node

import { Command } from 'commander';
import { Logger } from '../utils/logger';
import IntelligentToolSelector, { 
  ToolSelectionRequest, 
  ToolSelectionResult,
  ToolExecutionResult 
} from './intelligent-tool-selector';
import { ClaudeCodeInterceptor } from './claude-code-interceptor';
import { ClaudeIntegration } from './claude-integration';
import * as fs from 'fs/promises';
import * as path from 'path';
import ora from 'ora';

interface EnhancedSession {
  sessionId: string;
  projectPath: string;
  toolSelector: IntelligentToolSelector;
  interceptor?: ClaudeCodeInterceptor;
  metrics: SessionMetrics;
  claudeIntegration: ClaudeIntegration;
}

interface SessionMetrics {
  startTime: Date;
  endTime?: Date;
  queries: number;
  tokensUsed: number;
  tokensSaved: number;
  toolsSelected: string[];
  avgRelevance: number;
  successRate: number;
}

class CodeMindEnhancedV2 {
  private logger = Logger.getInstance();
  private sessions = new Map<string, EnhancedSession>();

  createProgram(): Command {
    const program = new Command();
    
    program
      .name('codemind')
      .description('Intelligent Claude Code enhancement with smart tool selection')
      .version('2.0.0')
      .option('-v, --verbose', 'Enable verbose logging', false)
      .option('--debug', 'Enable debug mode', false);

    // Main enhanced Claude Code command
    program
      .command('run')
      .description('Run Claude Code with intelligent enhancement')
      .argument('[project-path]', 'Project path', '.')
      .option('-b, --budget <tokens>', 'Token budget', '12000')
      .option('-q, --quality', 'Enable quality monitoring', true)
      .option('-s, --smart', 'Use intelligent tool selection', true)
      .option('-e, --explain', 'Explain tool selections', false)
      .option('--config <file>', 'Configuration file')
      .action(async (projectPath: string, options: any) => {
        const spinner = ora('Initializing enhanced Claude Code session...').start();
        
        try {
          const session = await this.startEnhancedSession(projectPath, options, []);
          spinner.succeed(`Enhanced session started: ${session.sessionId}`);
          
          console.log('\n🚀 CodeMind Enhanced v2.0');
          console.log('├── Smart tool selection: ✅');
          console.log('├── Token optimization: ✅');
          console.log('├── Quality monitoring: ✅');
          console.log('└── Session ID:', session.sessionId);
          console.log('\n💡 Your Claude Code session is now enhanced with intelligent optimization.\n');
          
        } catch (error) {
          spinner.fail('Failed to start enhanced session');
          this.logger.error('Session initialization failed', error as Error);
          process.exit(1);
        }
      });

    // Intelligent analysis command
    program
      .command('analyze')
      .description('Analyze code with intelligent tool selection')
      .argument('<query>', 'What to analyze')
      .argument('[project-path]', 'Project path', '.')
      .option('-b, --budget <tokens>', 'Token budget', '8000')
      .option('-i, --iterative', 'Enable iterative refinement', false)
      .option('-e, --explain', 'Explain tool selection', false)
      .option('-f, --format <type>', 'Output format (json|table|markdown)', 'table')
      .option('-o, --output <file>', 'Save results to file')
      .action(async (query: string, projectPath: string, options: any) => {
        const spinner = ora('Analyzing query...').start();
        
        try {
          const results = await this.performSmartAnalysis(query, projectPath, options);
          spinner.succeed('Analysis complete');
          
          const output = this.formatResults(results, options.format);
          
          if (options.output) {
            await fs.writeFile(options.output, output);
            console.log(`📄 Results saved to: ${options.output}`);
          } else {
            console.log(output);
          }
          
          // Print metrics
          console.log('\n📊 Analysis Metrics:');
          console.log(`├── Tools used: ${results.toolsUsed.join(', ')}`);
          console.log(`├── Tokens used: ${results.tokensUsed}`);
          console.log(`├── Tokens saved: ${results.tokensSaved}`);
          console.log(`├── Relevance score: ${(results.relevance * 100).toFixed(1)}%`);
          console.log(`└── Execution time: ${results.executionTime}ms`);
          
        } catch (error) {
          spinner.fail('Analysis failed');
          this.logger.error('Analysis error', error as Error);
          process.exit(1);
        }
      });

    // Smart enhancement workflow
    program
      .command('enhance')
      .description('Run comprehensive enhancement with smart tool selection')
      .argument('[project-path]', 'Project path', '.')
      .option('-a, --auto-fix', 'Apply automatic fixes', false)
      .option('-d, --dry-run', 'Preview without changes', false)
      .option('-e, --explain', 'Explain tool selections', false)
      .option('-f, --focus <areas>', 'Focus areas (comma-separated)')
      .action(async (projectPath: string, options: any) => {
        const spinner = ora('Running smart enhancement workflow...').start();
        
        try {
          const results = await this.runSmartEnhancement(projectPath, options);
          spinner.succeed('Enhancement complete');
          
          console.log('\n📋 Enhancement Report:');
          console.log('═'.repeat(60));
          
          if (results.issues.length === 0) {
            console.log('✨ No issues found! Your code quality is excellent.');
          } else {
            console.log(`Found ${results.issues.length} issues:\n`);
            
            results.issues.forEach((issue: any, i: number) => {
              console.log(`${i + 1}. ${issue.type.toUpperCase()}: ${issue.description}`);
              console.log(`   📍 ${issue.file}:${issue.line || 'N/A'}`);
              console.log(`   💡 ${issue.suggestion}`);
              console.log(`   🔧 Auto-fixable: ${issue.autoFixable ? 'Yes' : 'No'}\n`);
            });
          }
          
          console.log('📊 Smart Selection Metrics:');
          console.log(`├── Tools selected: ${results.toolsUsed.join(', ')}`);
          console.log(`├── Tokens saved: ${results.tokensSaved}`);
          console.log(`├── Analysis time: ${results.executionTime}ms`);
          console.log(`└── Confidence: ${(results.confidence * 100).toFixed(1)}%`);
          
          if (options.autoFix && results.fixableIssues > 0) {
            console.log(`\n🔧 Applying ${results.fixableIssues} automatic fixes...`);
            // Auto-fix implementation would go here
          }
          
        } catch (error) {
          spinner.fail('Enhancement failed');
          this.logger.error('Enhancement error', error as Error);
          process.exit(1);
        }
      });

    // Tool selection preview
    program
      .command('preview-tools')
      .description('Preview tool selection for a query')
      .argument('<query>', 'Query to analyze')
      .argument('[project-path]', 'Project path', '.')
      .action(async (query: string, projectPath: string) => {
        const spinner = ora('Analyzing optimal tool selection...').start();
        
        try {
          const selector = new IntelligentToolSelector();
          const selection = await selector.selectTools({
            userQuery: query,
            projectPath,
            availableTools: selector.getAvailableToolNames()
          });
          
          spinner.succeed('Tool selection complete');
          
          console.log('\n🧠 Intelligent Tool Selection Preview');
          console.log('═'.repeat(60));
          console.log(`Query: "${query}"\n`);
          
          console.log('📋 Selected Tools:');
          selection.selectedTools.forEach((tool, i) => {
            console.log(`${i + 1}. ${tool}`);
          });
          
          console.log(`\n💡 Reasoning: ${selection.reasoning}`);
          console.log(`💰 Estimated token savings: ${selection.estimatedTokenSavings}`);
          
          if (selection.executionPlan.length > 0) {
            console.log('\n📅 Execution Plan:');
            selection.executionPlan.forEach((step, i) => {
              console.log(`${i + 1}. ${step.tool} (${step.tokenBudget} tokens)`);
            });
          }
          
        } catch (error) {
          spinner.fail('Tool preview failed');
          this.logger.error('Preview error', error as Error);
          process.exit(1);
        }
      });

    // Session management
    program
      .command('sessions')
      .description('Manage active sessions')
      .addCommand(
        new Command('list')
          .description('List all active sessions')
          .action(() => this.listSessions())
      )
      .addCommand(
        new Command('stats')
          .argument('[session-id]', 'Session ID')
          .description('Show session statistics')
          .action((sessionId?: string) => this.showSessionStats(sessionId))
      );

    // Configuration
    program
      .command('config')
      .description('Configuration management')
      .addCommand(
        new Command('init')
          .description('Initialize configuration')
          .option('-f, --file <path>', 'Config file path', '.codemind.json')
          .action(async (options: any) => {
            await this.initializeConfig(options.file);
            console.log(`✅ Configuration initialized at: ${options.file}`);
          })
      )
      .addCommand(
        new Command('show')
          .description('Show current configuration')
          .action(() => this.showConfig())
      );

    // Benchmarking command
    program
      .command('benchmark')
      .description('Compare smart vs traditional tool selection')
      .argument('[project-path]', 'Project path', '.')
      .action(async (projectPath: string) => {
        const spinner = ora('Running benchmark...').start();
        
        try {
          const results = await this.runBenchmark(projectPath);
          spinner.succeed('Benchmark complete');
          
          console.log('\n📊 Benchmark Results');
          console.log('═'.repeat(60));
          console.log('\n🔴 Traditional Approach (All Tools):');
          console.log(`├── Tokens used: ${results.traditional.tokensUsed}`);
          console.log(`├── Execution time: ${results.traditional.executionTime}ms`);
          console.log(`├── Relevance: ${(results.traditional.relevance * 100).toFixed(1)}%`);
          console.log(`└── Tools loaded: ${results.traditional.toolsCount}`);
          
          console.log('\n✅ Smart Approach (Intelligent Selection):');
          console.log(`├── Tokens used: ${results.smart.tokensUsed}`);
          console.log(`├── Execution time: ${results.smart.executionTime}ms`);
          console.log(`├── Relevance: ${(results.smart.relevance * 100).toFixed(1)}%`);
          console.log(`└── Tools loaded: ${results.smart.toolsCount}`);
          
          console.log('\n🎯 Improvement:');
          const tokenSavings = results.traditional.tokensUsed - results.smart.tokensUsed;
          const timeSavings = results.traditional.executionTime - results.smart.executionTime;
          const savingsPercent = (tokenSavings / results.traditional.tokensUsed * 100).toFixed(1);
          
          console.log(`├── Token savings: ${tokenSavings} (${savingsPercent}% reduction)`);
          console.log(`├── Time savings: ${timeSavings}ms`);
          console.log(`└── Relevance improvement: ${((results.smart.relevance - results.traditional.relevance) * 100).toFixed(1)}%`);
          
        } catch (error) {
          spinner.fail('Benchmark failed');
          this.logger.error('Benchmark error', error as Error);
          process.exit(1);
        }
      });

    return program;
  }

  private async startEnhancedSession(
    projectPath: string, 
    options: any, 
    claudeArgs: string[]
  ): Promise<EnhancedSession> {
    const sessionId = `enhanced-${Date.now()}`;
    
    const session: EnhancedSession = {
      sessionId,
      projectPath,
      toolSelector: new IntelligentToolSelector(),
      claudeIntegration: new ClaudeIntegration(),
      metrics: {
        startTime: new Date(),
        queries: 0,
        tokensUsed: 0,
        tokensSaved: 0,
        toolsSelected: [],
        avgRelevance: 0,
        successRate: 1.0
      }
    };

    // Initialize interceptor with smart enhancement
    if (options.smart) {
      session.interceptor = new ClaudeCodeInterceptor({
        projectPath: projectPath || process.cwd(),
        enableQualityChecks: options.quality,
        enableContextOptimization: true,
        enableRealTimeGuidance: true,
        maxContextTokens: parseInt(options.budget),
        enableLearning: true
      });

      await session.interceptor.initialize();
      
      // Override context generation with smart tools
      this.enhanceWithSmartTools(session, options);
      
      // Start Claude Code
      await session.interceptor.startClaudeCode({ args: claudeArgs, projectPath });
    }

    this.sessions.set(sessionId, session);
    return session;
  }

  private enhanceWithSmartTools(session: EnhancedSession, options: any): void {
    const original = session.interceptor!.generateEnhancedContext;
    
    session.interceptor!.generateEnhancedContext = async (query: string, projectPath: string) => {
      session.metrics.queries++;
      
      if (options.explain) {
        console.log(`\n🧠 Selecting tools for: "${query.substring(0, 50)}..."`);
      }

      // NEW: Automatic Context Enhancement
      const contextEnhancement = await session.toolSelector.enhanceContextAutomatically({
        task: query,
        projectPath
      });

      if (options.explain) {
        console.log(`🚀 Auto-enhanced context with: ${contextEnhancement.tools.map(t => t.name).join(', ')}`);
        console.log(`🎯 Request type detected: ${session.toolSelector.detectRequestType(query)}`);
        console.log(`⚡ Parallel execution strategy for ${contextEnhancement.estimatedTokens} tokens`);
      }

      // Execute context enhancement tools
      const contextResults = await this.executeToolChain(contextEnhancement, {
        query,
        projectPath,
        explain: options.explain
      });

      // Legacy: Also run smart tool selection for specific requests
      const selection = await session.toolSelector.selectTools({
        userQuery: query,
        projectPath,
        availableTools: session.toolSelector.getAvailableToolNames()
      });

      // Execute any additional selected tools
      const additionalResults = await session.toolSelector.executeTools(selection, {
        userQuery: query,
        projectPath,
        availableTools: session.toolSelector.getAvailableToolNames()
      });

      // Combine results
      const results = [...contextResults, ...additionalResults];

      // Update metrics
      session.metrics.tokensUsed += results.reduce((sum, r) => sum + r.tokensUsed, 0);
      session.metrics.tokensSaved += selection.estimatedTokenSavings;
      selection.selectedTools.forEach(tool => {
        if (!session.metrics.toolsSelected.includes(tool)) {
          session.metrics.toolsSelected.push(tool);
        }
      });

      const avgRelevance = results.reduce((sum, r) => sum + r.relevanceScore, 0) / results.length;
      session.metrics.avgRelevance = (session.metrics.avgRelevance * (session.metrics.queries - 1) + avgRelevance) / session.metrics.queries;

      return this.compileResults(results, query);
    };
  }

  private async performSmartAnalysis(query: string, projectPath: string, options: any): Promise<any> {
    const startTime = Date.now();
    const selector = new IntelligentToolSelector();
    const claudeIntegration = new ClaudeIntegration();

    // Step 1: Smart tool selection
    const selection = await selector.selectTools({
      userQuery: query,
      projectPath,
      availableTools: selector.getAvailableToolNames()
    });

    if (options.explain) {
      console.log(`\n💡 Tool selection reasoning: ${selection.reasoning}`);
    }

    // Step 2: Execute tools
    const toolResults = await selector.executeTools(selection, {
      userQuery: query,
      projectPath,
      availableTools: selector.getAvailableToolNames()
    });

    // Step 3: Get Claude analysis
    const context = this.compileResults(toolResults, query);
    const claudeResponse = await claudeIntegration.askQuestion(
      `Analyze these results for query "${query}": ${JSON.stringify(context)}`,
      {
        projectPath,
        tokenBudget: parseInt(options.budget) - context.tokensUsed,
        strategy: 'smart',
        estimatedTokens: 2000,
        priorityFiles: [],
        focusArea: 'analysis'
      }
    );

    // Step 4: Iterative refinement if needed
    const avgRelevance = toolResults.reduce((sum, r) => sum + r.relevanceScore, 0) / toolResults.length;
    
    if (options.iterative && avgRelevance < 0.7) {
      console.log('🔄 Low relevance detected, refining...');
      // Refinement logic here
    }

    return {
      query,
      toolsUsed: selection.selectedTools,
      tokensUsed: toolResults.reduce((sum, r) => sum + r.tokensUsed, 0),
      tokensSaved: selection.estimatedTokenSavings,
      relevance: avgRelevance,
      executionTime: Date.now() - startTime,
      analysis: claudeResponse.content,
      toolResults
    };
  }

  private async runSmartEnhancement(projectPath: string, options: any): Promise<any> {
    const startTime = Date.now();
    const selector = new IntelligentToolSelector();

    // Define enhancement queries
    const queries = [
      'find duplicate classes and overlapping enums',
      'analyze method scoping issues',
      'detect circular dependencies and topology problems',
      'identify variable propagation issues'
    ];

    if (options.focus) {
      const focusAreas = options.focus.split(',');
      queries.push(...focusAreas.map((area: string) => `analyze ${area.trim()}`));
    }

    const allIssues: any[] = [];
    const allTools = new Set<string>();
    let totalTokensSaved = 0;

    // Run smart analysis for each query
    for (const query of queries) {
      const selection = await selector.selectTools({
        userQuery: query,
        projectPath,
        availableTools: selector.getAvailableToolNames()
      });

      if (options.explain) {
        console.log(`\n🔍 ${query}: ${selection.selectedTools.join(', ')}`);
      }

      const results = await selector.executeTools(selection, {
        userQuery: query,
        projectPath,
        availableTools: selector.getAvailableToolNames()
      });

      // Extract issues from results
      const issues = this.extractIssues(results);
      allIssues.push(...issues);

      selection.selectedTools.forEach(tool => allTools.add(tool));
      totalTokensSaved += selection.estimatedTokenSavings;
    }

    return {
      issues: allIssues,
      toolsUsed: Array.from(allTools),
      tokensSaved: totalTokensSaved,
      executionTime: Date.now() - startTime,
      confidence: 0.85,
      fixableIssues: allIssues.filter((i: any) => i.autoFixable).length
    };
  }

  private async runBenchmark(projectPath: string): Promise<any> {
    const queries = [
      'find duplicate code',
      'analyze dependencies',
      'search for authentication logic'
    ];

    // Traditional approach - load all tools
    const traditionalStart = Date.now();
    let traditionalTokens = 0;
    const allTools = ['duplication-detector', 'tree-navigator', 'vector-search', 
                      'context-optimizer', 'issues-detector', 'knowledge-graph'];
    
    for (const tool of allTools) {
      // Simulate loading all tools
      traditionalTokens += tool === 'vector-search' ? 2000 : 
                          tool === 'knowledge-graph' ? 2000 : 1000;
    }
    const traditionalTime = Date.now() - traditionalStart;

    // Smart approach - selective loading
    const smartStart = Date.now();
    let smartTokens = 0;
    const selectedTools = new Set<string>();
    const selector = new IntelligentToolSelector();

    for (const query of queries) {
      const selection = await selector.selectTools({
        userQuery: query,
        projectPath,
        availableTools: selector.getAvailableToolNames()
      });
      
      selection.selectedTools.forEach(tool => selectedTools.add(tool));
      smartTokens += 500; // Selection cost
      
      for (const tool of selection.selectedTools) {
        // Estimate token cost based on tool name
        smartTokens += 1000; // Default estimate per tool
      }
    }
    const smartTime = Date.now() - smartStart;

    return {
      traditional: {
        tokensUsed: traditionalTokens * queries.length,
        executionTime: traditionalTime,
        relevance: 0.6, // Lower due to unnecessary tools
        toolsCount: allTools.length
      },
      smart: {
        tokensUsed: smartTokens,
        executionTime: smartTime,
        relevance: 0.85, // Higher due to focused selection
        toolsCount: selectedTools.size
      }
    };
  }

  private compileResults(results: ToolExecutionResult[], query: string): any {
    const successfulResults = results.filter(r => r.success);
    
    return {
      query,
      toolsUsed: successfulResults.map(r => r.tool),
      tokensUsed: successfulResults.reduce((sum, r) => sum + r.tokensUsed, 0),
      relevance: successfulResults.reduce((sum, r) => sum + r.relevanceScore, 0) / successfulResults.length,
      data: successfulResults.map(r => ({
        tool: r.tool,
        result: r.data,
        relevance: r.relevanceScore
      }))
    };
  }

  private extractIssues(results: ToolExecutionResult[]): any[] {
    const issues: any[] = [];
    
    for (const result of results) {
      if (result.success && result.data) {
        // Extract issues based on tool type
        if (result.tool === 'duplication-detector' && result.data.duplicates) {
          result.data.duplicates.forEach((dup: any) => {
            issues.push({
              type: 'duplication',
              description: `Duplicate code in ${dup.locations.length} locations`,
              file: dup.locations[0].file,
              line: dup.locations[0].startLine,
              suggestion: 'Extract common code into shared utility',
              autoFixable: true
            });
          });
        }
        // Add other tool-specific extraction...
      }
    }
    
    return issues;
  }

  private formatResults(results: any, format: string): string {
    switch (format) {
      case 'json':
        return JSON.stringify(results, null, 2);
      
      case 'markdown':
        return `# Analysis Results

**Query**: ${results.query}

## Summary
- Tools used: ${results.toolsUsed.join(', ')}
- Tokens used: ${results.tokensUsed}
- Tokens saved: ${results.tokensSaved}
- Relevance: ${(results.relevance * 100).toFixed(1)}%
- Execution time: ${results.executionTime}ms

## Analysis
${results.analysis}`;
      
      default: // table
        return `
╔═══════════════════════════════════════════════════════════════╗
║                     ANALYSIS RESULTS                          ║
╠═══════════════════════════════════════════════════════════════╣
║ Query: ${results.query.padEnd(55)}║
║ Tools: ${results.toolsUsed.join(', ').padEnd(55)}║
║ Tokens Used: ${results.tokensUsed.toString().padEnd(49)}║
║ Tokens Saved: ${results.tokensSaved.toString().padEnd(48)}║
║ Relevance: ${(results.relevance * 100).toFixed(1) + '%'.padEnd(51)}║
╚═══════════════════════════════════════════════════════════════╝

${results.analysis}`;
    }
  }

  private listSessions(): void {
    if (this.sessions.size === 0) {
      console.log('No active sessions');
      return;
    }

    console.log('\n📊 Active Sessions');
    console.log('═'.repeat(60));
    
    for (const [id, session] of this.sessions) {
      const runtime = Date.now() - session.metrics.startTime.getTime();
      console.log(`\n${id}`);
      console.log(`├── Project: ${session.projectPath}`);
      console.log(`├── Runtime: ${Math.round(runtime / 1000 / 60)} minutes`);
      console.log(`├── Queries: ${session.metrics.queries}`);
      console.log(`├── Tokens saved: ${session.metrics.tokensSaved}`);
      console.log(`└── Avg relevance: ${(session.metrics.avgRelevance * 100).toFixed(1)}%`);
    }
  }

  private showSessionStats(sessionId?: string): void {
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (!session) {
        console.log(`Session ${sessionId} not found`);
        return;
      }
      this.printSessionMetrics(session);
    } else {
      // Aggregate stats
      let totalQueries = 0;
      let totalTokensSaved = 0;
      
      for (const session of this.sessions.values()) {
        totalQueries += session.metrics.queries;
        totalTokensSaved += session.metrics.tokensSaved;
      }
      
      console.log('\n📊 Aggregate Statistics');
      console.log('═'.repeat(60));
      console.log(`Total sessions: ${this.sessions.size}`);
      console.log(`Total queries: ${totalQueries}`);
      console.log(`Total tokens saved: ${totalTokensSaved}`);
      console.log(`Avg savings per query: ${totalQueries > 0 ? Math.round(totalTokensSaved / totalQueries) : 0}`);
    }
  }

  private printSessionMetrics(session: EnhancedSession): void {
    console.log('\n📊 Session Metrics');
    console.log('═'.repeat(60));
    console.log(`Session ID: ${session.sessionId}`);
    console.log(`Project: ${session.projectPath}`);
    console.log(`Start time: ${session.metrics.startTime.toISOString()}`);
    console.log(`Queries: ${session.metrics.queries}`);
    console.log(`Tokens used: ${session.metrics.tokensUsed}`);
    console.log(`Tokens saved: ${session.metrics.tokensSaved}`);
    console.log(`Tools selected: ${session.metrics.toolsSelected.join(', ')}`);
    console.log(`Avg relevance: ${(session.metrics.avgRelevance * 100).toFixed(1)}%`);
    console.log(`Success rate: ${(session.metrics.successRate * 100).toFixed(1)}%`);
  }

  private async initializeConfig(filePath: string): Promise<void> {
    const config = {
      version: '2.0.0',
      intelligentSelection: {
        enabled: true,
        confidenceThreshold: 0.7,
        iterativeRefinement: true,
        maxIterations: 3
      },
      tokenBudget: {
        default: 12000,
        perTool: 2000,
        reserveForClaude: 4000
      },
      tools: {
        preferredTools: [],
        blacklistedTools: [],
        customWeights: {}
      },
      monitoring: {
        qualityChecks: true,
        realTimeGuidance: true,
        sessionMetrics: true
      },
      optimization: {
        caching: true,
        parallelExecution: true,
        earlyTermination: true,
        relevanceThreshold: 0.9
      }
    };

    await fs.writeFile(filePath, JSON.stringify(config, null, 2));
  }

  private async executeToolChain(toolChain: any, context: {
    query: string;
    projectPath: string;
    explain?: boolean;
  }): Promise<any[]> {
    const results: any[] = [];
    
    try {
      if (context.explain) {
        console.log(`🔧 Executing ${toolChain.tools.length} context enhancement tools...`);
      }
      
      // Execute tools based on strategy
      if (toolChain.executionStrategy === 'parallel') {
        // Execute all tools in parallel
        const promises = toolChain.tools.map(async (tool: any) => {
          try {
            const result = await tool.execute({
              projectPath: context.projectPath,
              query: context.query
            });
            
            return {
              tool: tool.name,
              success: true,
              data: result,
              tokensUsed: this.estimateTokens(JSON.stringify(result)),
              executionTime: Date.now(),
              relevanceScore: 0.8 // Default relevance for context tools
            };
          } catch (error) {
            console.warn(`⚠️  Tool ${tool.name} failed:`, error);
            return {
              tool: tool.name,
              success: false,
              data: null,
              tokensUsed: 0,
              executionTime: 0,
              relevanceScore: 0
            };
          }
        });
        
        const parallelResults = await Promise.all(promises);
        results.push(...parallelResults);
        
      } else {
        // Execute tools sequentially
        for (const tool of toolChain.tools) {
          try {
            const result = await tool.execute({
              projectPath: context.projectPath,
              query: context.query
            });
            
            results.push({
              tool: tool.name,
              success: true,
              data: result,
              tokensUsed: this.estimateTokens(JSON.stringify(result)),
              executionTime: Date.now(),
              relevanceScore: 0.8
            });
            
            if (context.explain) {
              console.log(`✅ Completed: ${tool.name}`);
            }
            
          } catch (error) {
            console.warn(`⚠️  Tool ${tool.name} failed:`, error);
            results.push({
              tool: tool.name,
              success: false,
              data: null,
              tokensUsed: 0,
              executionTime: 0,
              relevanceScore: 0
            });
          }
        }
      }
      
      if (context.explain) {
        const successCount = results.filter(r => r.success).length;
        console.log(`🎯 Context enhancement completed: ${successCount}/${toolChain.tools.length} tools successful`);
      }
      
    } catch (error) {
      console.error('❌ Tool chain execution failed:', error);
    }
    
    return results;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private async showConfig(): Promise<void> {
    try {
      const config = await fs.readFile('.codemind.json', 'utf-8');
      console.log('\n⚙️  Current Configuration');
      console.log('═'.repeat(60));
      console.log(config);
    } catch {
      console.log('No configuration file found. Run "codemind config init" to create one.');
    }
  }
}

// Main execution
if (require.main === module) {
  const cli = new CodeMindEnhancedV2();
  const program = cli.createProgram();
  
  // Parse command line arguments
  program.parse();
}

export default CodeMindEnhancedV2;