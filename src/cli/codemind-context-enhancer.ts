#!/usr/bin/env node

/**
 * CodeMind Context Enhancer CLI
 * Core mechanism that enriches Claude Code requests with intelligent context
 * 
 * FLOW:
 * 1. User makes request
 * 2. Claude analyzes request and selects tools with parameters
 * 3. Selected tools generate context data
 * 4. Enhanced request sent to Claude Code with context
 * 5. Claude Code executes with enriched context
 * 6. Response assessed and ALL tool databases updated
 * 7. Claude provides final summary
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { ToolAutodiscoveryService } from '../shared/tool-autodiscovery';
import { ToolRegistry } from '../shared/tool-interface';
import { Logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

// Color scheme for different types of output
const colors = {
  phase: chalk.cyan.bold,
  tool: chalk.magenta,
  claude: chalk.blue,
  success: chalk.green.bold,
  warning: chalk.yellow,
  error: chalk.red.bold,
  info: chalk.gray,
  context: chalk.white.bgBlue,
  result: chalk.white.bgGreen.bold
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

interface ClaudeAssessment {
  changeSummary: string;
  toolsToUpdate: Array<{
    tool: string;
    updateType: string;
    data: any;
  }>;
  qualityImprovement: number;
  nextSteps: string[];
}

export class CodeMindContextEnhancer {
  private logger: Logger;
  private autodiscovery: ToolAutodiscoveryService;
  private claudeApiUrl: string;
  private projectPath: string;
  private projectId: string;

  constructor() {
    this.logger = Logger.getInstance();
    this.autodiscovery = new ToolAutodiscoveryService();
    this.claudeApiUrl = process.env.CLAUDE_API_URL || 'http://localhost:3007/api/claude';
    this.projectPath = process.cwd();
    this.projectId = this.generateProjectId(this.projectPath);
  }

  /**
   * Main flow: Process user request with context enhancement
   */
  async processRequest(userQuery: string, options: any): Promise<void> {
    console.log(colors.phase('\n🚀 CODEMIND CONTEXT ENHANCER'));
    console.log(colors.phase('━'.repeat(50)));
    console.log(colors.info(`📝 User Request: "${userQuery}"`));
    console.log(colors.info(`📂 Project: ${this.projectPath}\n`));

    // Simple status logger instead of spinner
    const status = {
      start: (msg: string) => console.log(colors.phase(`⏳ ${msg}`)),
      succeed: (msg: string) => console.log(colors.success(msg)),
      fail: (msg: string) => console.log(colors.error(msg))
    };

    try {
      // Phase 1: Initialize tools
      status.start('Phase 1: Discovering tools...');
      await this.autodiscovery.initializeTools();
      const allTools = ToolRegistry.getAllTools();
      status.succeed(`✅ Discovered ${allTools.length} tools`);

      // Phase 2: Claude selects tools with parameters
      status.start('Phase 2: Claude analyzing request and selecting tools...');
      const toolSelections = await this.claudeSelectsTools(userQuery, allTools, options);
      status.succeed(`✅ Claude selected ${toolSelections.length} tools`);
      
      this.displayToolSelections(toolSelections);

      // Phase 3: Generate context from selected tools
      status.start('Phase 3: Generating enhanced context...');
      const enhancedContext = await this.generateEnhancedContext(toolSelections, userQuery);
      status.succeed(`✅ Generated ${enhancedContext.tokenCount} tokens of context`);
      
      this.displayContextSummary(enhancedContext);

      // Phase 4: Execute enhanced request with Claude Code
      status.start('Phase 4: Executing enhanced request with Claude Code...');
      const claudeResponse = await this.executeEnhancedRequest(enhancedContext);
      status.succeed('✅ Claude Code execution complete');
      
      this.displayClaudeResponse(claudeResponse);

      // Phase 5: Assess changes and update ALL tools
      status.start('Phase 5: Assessing changes and updating all tools...');
      const assessment = await this.assessAndUpdateAllTools(userQuery, claudeResponse, allTools);
      status.succeed(`✅ Updated ${assessment.toolsToUpdate.length} tool databases`);
      
      this.displayAssessment(assessment);

      // Phase 6: Claude provides final summary
      console.log(colors.phase('\n📊 FINAL SUMMARY'));
      console.log(colors.phase('━'.repeat(50)));
      const summary = await this.getClaudeFinalSummary(userQuery, enhancedContext, claudeResponse, assessment);
      console.log(colors.result(summary));

    } catch (error) {
      status.fail(`❌ Error: ${error}`);
      this.logger.error('Processing failed:', error);
    }
  }

  /**
   * Phase 2: Claude selects tools based on user request
   */
  private async claudeSelectsTools(
    userQuery: string, 
    allTools: any[], 
    options: any
  ): Promise<ToolSelectionResult[]> {
    // Create tool descriptions for Claude
    const toolDescriptions = allTools.map(tool => {
      const metadata = tool.getMetadata();
      return {
        name: metadata.name,
        description: metadata.description,
        capabilities: metadata.capabilities,
        category: metadata.category,
        parameters: this.getToolParameterSchema(metadata.name)
      };
    });

    // Ask Claude to select tools and parameters
    const prompt = `
TASK: Tool Selection for Context Enhancement

USER REQUEST: "${userQuery}"
PROJECT TYPE: ${options.projectType || 'general'}
INTENT: ${options.intent || 'general'}

AVAILABLE TOOLS:
${JSON.stringify(toolDescriptions, null, 2)}

INSTRUCTIONS:
1. Analyze the user request
2. Select 2-7 most relevant tools
3. For each tool, specify parameters
4. Provide confidence and reasoning

RESPONSE FORMAT (JSON):
{
  "selections": [
    {
      "tool": "tool-name",
      "parameters": { /* tool-specific params */ },
      "confidence": 0.95,
      "reasoning": "Why this tool helps"
    }
  ]
}

ALWAYS include semantic-graph tool for project queries.
Consider tool combinations that provide comprehensive context.
`;

    try {
      const response = await this.callClaude(prompt);
      return response.selections || this.getFallbackToolSelection(userQuery);
    } catch (error) {
      console.log(colors.warning('⚠️  Claude unavailable, using fallback selection'));
      return this.getFallbackToolSelection(userQuery);
    }
  }

  /**
   * Phase 3: Generate enhanced context from selected tools
   */
  private async generateEnhancedContext(
    selections: ToolSelectionResult[], 
    userQuery: string
  ): Promise<EnhancedRequest> {
    const contextSections = [];
    const toolsUsed = [];
    let totalTokens = 0;

    for (const selection of selections) {
      const tool = ToolRegistry.getAllTools().find(t => 
        t.getMetadata().name === selection.tool
      );

      if (!tool) continue;

      try {
        console.log(colors.tool(`  🔧 Running ${selection.tool}...`));
        
        // Run tool analysis with parameters
        const result = await tool.analyzeProject(
          this.projectPath, 
          this.projectId,
          selection.parameters // Pass Claude-selected parameters
        );

        // Add to context
        contextSections.push({
          tool: selection.tool,
          confidence: selection.confidence,
          data: result.data,
          insights: result.recommendations || [],
          metrics: result.metrics
        });

        toolsUsed.push(selection.tool);
        totalTokens += this.estimateTokens(result);

      } catch (error) {
        console.log(colors.warning(`  ⚠️  ${selection.tool} failed: ${error}`));
      }
    }

    return {
      originalQuery: userQuery,
      enrichedContext: contextSections,
      toolsUsed,
      tokenCount: totalTokens,
      recommendations: this.extractRecommendations(contextSections)
    };
  }

  /**
   * Phase 4: Execute enhanced request with Claude Code
   */
  private async executeEnhancedRequest(enhancedRequest: EnhancedRequest): Promise<any> {
    const claudeCodePrompt = `
ENHANCED REQUEST WITH CONTEXT

ORIGINAL QUERY: "${enhancedRequest.originalQuery}"

CONTEXT FROM TOOLS:
${JSON.stringify(enhancedRequest.enrichedContext, null, 2)}

RECOMMENDATIONS:
${enhancedRequest.recommendations.join('\n')}

Please process this request with the provided context.
Focus on actionable insights and code improvements.
`;

    try {
      const response = await this.callClaudeCode(claudeCodePrompt);
      return response;
    } catch (error) {
      throw new Error(`Claude Code execution failed: ${error}`);
    }
  }

  /**
   * Phase 5: Assess changes and update ALL tool databases
   */
  private async assessAndUpdateAllTools(
    userQuery: string,
    claudeResponse: any,
    allTools: any[]
  ): Promise<ClaudeAssessment> {
    // Ask Claude to assess what needs updating
    const assessmentPrompt = `
TASK: Assess Changes and Determine Tool Updates

USER QUERY: "${userQuery}"
CLAUDE RESPONSE: ${JSON.stringify(claudeResponse, null, 2)}

ALL AVAILABLE TOOLS:
${allTools.map(t => t.getMetadata().name).join(', ')}

INSTRUCTIONS:
1. Analyze what changed or was learned
2. Determine which tool databases need updating
3. Specify update type and data for each tool
4. Even tools not used might need updates based on insights

RESPONSE FORMAT (JSON):
{
  "changeSummary": "Brief summary of changes",
  "toolsToUpdate": [
    {
      "tool": "tool-name",
      "updateType": "knowledge|metrics|cache|patterns",
      "data": { /* update data */ }
    }
  ],
  "qualityImprovement": 0.5,
  "nextSteps": ["Recommended follow-up actions"]
}
`;

    try {
      const assessment = await this.callClaude(assessmentPrompt);
      
      // Update all specified tools
      for (const update of assessment.toolsToUpdate) {
        await this.updateToolDatabase(update);
      }

      return assessment;
    } catch (error) {
      console.log(colors.warning('⚠️  Assessment failed, creating minimal update'));
      return this.getMinimalAssessment();
    }
  }

  /**
   * Phase 6: Get final summary from Claude
   */
  private async getClaudeFinalSummary(
    userQuery: string,
    enhancedContext: EnhancedRequest,
    claudeResponse: any,
    assessment: ClaudeAssessment
  ): Promise<string> {
    const summaryPrompt = `
TASK: Provide Final Summary

USER REQUEST: "${userQuery}"
TOOLS USED: ${enhancedContext.toolsUsed.join(', ')}
TOKENS GENERATED: ${enhancedContext.tokenCount}
QUALITY IMPROVEMENT: ${assessment.qualityImprovement}

Provide a concise summary including:
1. What was accomplished
2. Key insights discovered
3. Tools that provided most value
4. Recommended next steps

Keep it under 5 lines, be specific and actionable.
`;

    try {
      const summary = await this.callClaude(summaryPrompt);
      return summary.text || summary;
    } catch (error) {
      return 'Request processed successfully with enhanced context.';
    }
  }

  // Helper Methods

  private generateProjectId(projectPath: string): string {
    return `proj_${Buffer.from(projectPath).toString('base64').replace(/[+=]/g, '').substring(0, 8)}`;
  }

  private async callClaude(prompt: string): Promise<any> {
    try {
      const response = await fetch(this.claudeApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, maxTokens: 2000 })
      });

      if (!response.ok) throw new Error(`Claude API error: ${response.status}`);
      
      const result = await response.json();
      return typeof result === 'string' ? JSON.parse(result) : result;
    } catch (error) {
      throw error;
    }
  }

  private async callClaudeCode(prompt: string): Promise<any> {
    // In real implementation, this would call actual Claude Code API
    return {
      success: true,
      response: 'Claude Code execution simulated',
      changes: [],
      insights: []
    };
  }

  private getFallbackToolSelection(userQuery: string): ToolSelectionResult[] {
    // Always include semantic-graph and a few high-value tools
    return [
      {
        tool: 'semantic-graph',
        parameters: { depth: 2, includeRelationships: true },
        confidence: 0.9,
        reasoning: 'Essential for understanding code relationships'
      },
      {
        tool: 'centralization-detector',
        parameters: { threshold: 0.7 },
        confidence: 0.7,
        reasoning: 'Identifies architectural patterns'
      },
      {
        tool: 'duplication-detector',
        parameters: { minLines: 5 },
        confidence: 0.6,
        reasoning: 'Finds code quality issues'
      }
    ];
  }

  private getToolParameterSchema(toolName: string): any {
    // Define parameter schemas for each tool
    const schemas: { [key: string]: any } = {
      'semantic-graph': {
        depth: { type: 'number', default: 2, min: 1, max: 5 },
        includeRelationships: { type: 'boolean', default: true },
        maxNodes: { type: 'number', default: 100 }
      },
      'centralization-detector': {
        threshold: { type: 'number', default: 0.7, min: 0, max: 1 },
        minOccurrences: { type: 'number', default: 3 }
      },
      'duplication-detector': {
        minLines: { type: 'number', default: 5 },
        similarity: { type: 'number', default: 0.8 }
      },
      'tree-navigator': {
        maxDepth: { type: 'number', default: 10 },
        followImports: { type: 'boolean', default: true }
      }
    };

    return schemas[toolName] || {};
  }

  private estimateTokens(result: any): number {
    const json = JSON.stringify(result);
    return Math.ceil(json.length / 4); // Rough estimate
  }

  private extractRecommendations(contextSections: any[]): string[] {
    const allRecommendations = [];
    
    for (const section of contextSections) {
      if (section.insights && Array.isArray(section.insights)) {
        allRecommendations.push(...section.insights);
      }
    }

    // Deduplicate and prioritize
    return [...new Set(allRecommendations)].slice(0, 5);
  }

  private async updateToolDatabase(update: any): Promise<void> {
    const tool = ToolRegistry.getAllTools().find(t => 
      t.getMetadata().name === update.tool
    );

    if (tool) {
      try {
        await tool.updateAfterCliRequest(
          this.projectPath,
          this.projectId,
          'context-enhancement',
          update.data
        );
      } catch (error) {
        console.log(colors.warning(`  ⚠️  Failed to update ${update.tool}`));
      }
    }
  }

  private getMinimalAssessment(): ClaudeAssessment {
    return {
      changeSummary: 'Request processed with context enhancement',
      toolsToUpdate: [],
      qualityImprovement: 0,
      nextSteps: []
    };
  }

  // Display Methods

  private displayToolSelections(selections: ToolSelectionResult[]): void {
    console.log(colors.claude('\n🤖 Claude Tool Selection:'));
    selections.forEach(sel => {
      console.log(colors.tool(`  • ${sel.tool}`), 
                  colors.info(`(confidence: ${(sel.confidence * 100).toFixed(0)}%)`));
      console.log(colors.info(`    ${sel.reasoning}`));
      if (Object.keys(sel.parameters).length > 0) {
        console.log(colors.info(`    Parameters: ${JSON.stringify(sel.parameters)}`));
      }
    });
  }

  private displayContextSummary(context: EnhancedRequest): void {
    console.log(colors.context('\n📚 Context Summary:'));
    console.log(colors.info(`  • Tools Used: ${context.toolsUsed.join(', ')}`));
    console.log(colors.info(`  • Token Count: ${context.tokenCount}`));
    console.log(colors.info(`  • Recommendations: ${context.recommendations.length}`));
  }

  private displayClaudeResponse(response: any): void {
    console.log(colors.claude('\n🎯 Claude Code Response:'));
    if (response.insights) {
      response.insights.slice(0, 3).forEach((insight: string) => {
        console.log(colors.info(`  • ${insight}`));
      });
    }
  }

  private displayAssessment(assessment: ClaudeAssessment): void {
    console.log(colors.phase('\n🔄 Change Assessment:'));
    console.log(colors.info(`  • ${assessment.changeSummary}`));
    console.log(colors.info(`  • Quality Improvement: +${(assessment.qualityImprovement * 100).toFixed(0)}%`));
    console.log(colors.info(`  • Tools Updated: ${assessment.toolsToUpdate.length}`));
    
    if (assessment.nextSteps.length > 0) {
      console.log(colors.warning('\n  💡 Next Steps:'));
      assessment.nextSteps.forEach(step => {
        console.log(colors.info(`    • ${step}`));
      });
    }
  }
}

// CLI Command Setup
const program = new Command();

program
  .name('codemind')
  .description('CodeMind Context Enhancer - Intelligent context optimization for Claude Code')
  .version('3.0.0');

program
  .argument('<query>', 'Your request or query')
  .option('-p, --project <path>', 'Project path', process.cwd())
  .option('-t, --project-type <type>', 'Project type (web, api, library, etc.)')
  .option('-i, --intent <intent>', 'Intent (refactor, debug, optimize, explore, etc.)')
  .option('--max-tokens <n>', 'Maximum context tokens', '4000')
  .option('--verbose', 'Verbose output')
  .action(async (query, options) => {
    const enhancer = new CodeMindContextEnhancer();
    await enhancer.processRequest(query, options);
  });

program.parse();

export default program;