/**
 * Role Terminal Worker - Blocking queue-based role processing
 * 
 * Each role terminal waits on Redis queues for work, processes with specialized
 * tools and context, then passes enriched results to the next role in the workflow.
 * This creates a sequential pipeline of expert analysis.
 */

import { spawn, ChildProcess } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import RedisQueue, { WorkflowMessage, WorkflowCompletion } from '../messaging/redis-queue';
import { IntelligentToolSelector } from '../cli/intelligent-tool-selector';
import { Database } from '../database/database';
import { Logger } from '../utils/logger';

export interface RoleDefinition {
  id: string;
  name: string;
  expertise: string[];
  tools: string[];
  contextFocus: string[];
  promptTemplate: string;
}

export interface RoleContext {
  originalQuery: string;
  projectPath: string;
  roleSpecificFocus: string[];
  previousAnalyses: any[];
  toolResults: any[];
}

export class RoleTerminalWorker {
  private redis: RedisQueue;
  private toolSelector: IntelligentToolSelector;
  private db: Database;
  private logger = Logger.getInstance();
  private isRunning = false;
  private currentProcess?: ChildProcess;

  // Role definitions with specialized focus and prompting
  private roles: Map<string, RoleDefinition> = new Map([
    ['architect', {
      id: 'architect',
      name: 'System Architect',
      expertise: ['system-design', 'dependencies', 'architecture-patterns', 'scalability'],
      tools: ['tree-navigator', 'knowledge-graph', 'context-optimizer'],
      contextFocus: ['project-structure', 'dependencies', 'configuration', 'design-patterns'],
      promptTemplate: `You are a **System Architect** analyzing this codebase. Focus on:

🏗️ **Architecture Analysis**:
- System design and overall structure  
- Component dependencies and relationships
- Scalability and architectural patterns
- Design decisions and their implications

📊 **Your Task**: {originalQuery}

🎯 **Architecture Focus**: Analyze the system architecture, identify key components, assess design patterns, and evaluate scalability considerations.

Previous Context: {previousContext}

Provide architectural insights and recommendations for the next specialist.`
    }],
    
    ['security', {
      id: 'security', 
      name: 'Security Specialist',
      expertise: ['vulnerability-assessment', 'security-patterns', 'compliance', 'threat-modeling'],
      tools: ['issues-detector', 'centralization-detector', 'context-optimizer'],
      contextFocus: ['security-vulnerabilities', 'exposed-endpoints', 'authentication', 'authorization'],
      promptTemplate: `You are a **Security Specialist** reviewing this codebase. Focus on:

🔒 **Security Analysis**:
- Vulnerability assessment and threat modeling
- Authentication and authorization patterns  
- Security best practices and compliance
- Risk areas and exposure points

📊 **Your Task**: {originalQuery}

🎯 **Security Focus**: Building on the architectural analysis, identify security vulnerabilities, assess risk areas, and recommend security improvements.

Architecture Context: {previousContext}

Provide security findings and recommendations for the next specialist.`
    }],

    ['quality', {
      id: 'quality',
      name: 'Quality Engineer', 
      expertise: ['code-quality', 'testing', 'maintainability', 'technical-debt'],
      tools: ['issues-detector', 'duplication-detector', 'context-optimizer'],
      contextFocus: ['code-quality', 'test-coverage', 'maintainability', 'technical-debt'],
      promptTemplate: `You are a **Quality Engineer** assessing this codebase. Focus on:

🧪 **Quality Analysis**:
- Code quality and maintainability assessment
- Testing coverage and strategy evaluation
- Technical debt identification and prioritization
- Best practices compliance

📊 **Your Task**: {originalQuery}

🎯 **Quality Focus**: Considering the architecture and security findings, assess code quality, identify technical debt, and evaluate testing strategies.

Previous Context: {previousContext}

Provide quality assessment and recommendations for the next specialist.`
    }],

    ['performance', {
      id: 'performance',
      name: 'Performance Engineer',
      expertise: ['performance-analysis', 'optimization', 'scalability', 'resource-usage'],
      tools: ['issues-detector', 'tree-navigator', 'context-optimizer'], 
      contextFocus: ['performance-bottlenecks', 'resource-usage', 'optimization-opportunities'],
      promptTemplate: `You are a **Performance Engineer** optimizing this codebase. Focus on:

⚡ **Performance Analysis**:
- Performance bottleneck identification
- Resource usage optimization opportunities
- Scalability and efficiency assessment  
- Performance best practices evaluation

📊 **Your Task**: {originalQuery}

🎯 **Performance Focus**: Building on architecture, security, and quality analyses, identify performance bottlenecks and optimization opportunities.

Previous Context: {previousContext}

Provide performance insights and recommendations for the coordinator.`
    }],

    ['coordinator', {
      id: 'coordinator',
      name: 'Analysis Coordinator',
      expertise: ['synthesis', 'prioritization', 'action-planning', 'integration'],
      tools: ['context-optimizer', 'knowledge-graph'],
      contextFocus: ['synthesis', 'prioritization', 'actionable-recommendations'],
      promptTemplate: `You are an **Analysis Coordinator** synthesizing expert findings. Focus on:

🎯 **Synthesis & Coordination**:
- Integrate insights from all specialist analyses
- Prioritize recommendations by impact and effort
- Create actionable implementation roadmap
- Resolve conflicts between specialist recommendations

📊 **Original Task**: {originalQuery}

🔍 **All Specialist Analyses**: {previousContext}

**Your Mission**: Synthesize all expert insights into a cohesive, prioritized action plan with clear next steps and implementation guidance.`
    }]
  ]);

  constructor() {
    this.redis = new RedisQueue();
    this.toolSelector = new IntelligentToolSelector();
    this.db = new Database();
  }

  async initialize(): Promise<void> {
    await this.redis.connect();
    this.logger.info('🎭 Role Terminal Worker initialized');
  }

  async shutdown(): Promise<void> {
    this.isRunning = false;
    if (this.currentProcess) {
      this.currentProcess.kill();
    }
    await this.redis.disconnect();
    this.logger.info('🎭 Role Terminal Worker shutdown');
  }

  /**
   * Start processing work for multiple roles
   */
  async startProcessing(roles: string[] = ['architect', 'security', 'quality', 'performance', 'coordinator']): Promise<void> {
    this.isRunning = true;
    
    this.logger.info(`🚀 Starting role processing for: ${roles.join(', ')}`);
    
    // Start processing each role in parallel
    const processingPromises = roles.map(role => this.processRole(role));
    
    await Promise.all(processingPromises);
  }

  /**
   * Process work for a specific role (blocking loop)
   */
  private async processRole(roleId: string): Promise<void> {
    const role = this.roles.get(roleId);
    if (!role) {
      this.logger.error(`❌ Unknown role: ${roleId}`);
      return;
    }

    this.logger.info(`🎭 Role ${roleId} starting to process work`);

    while (this.isRunning) {
      try {
        // Block waiting for work (30 second timeout to allow graceful shutdown)
        const message = await this.redis.waitForWork(roleId, 30);
        
        if (!message) {
          continue; // Timeout, check if still running
        }

        await this.processMessage(role, message);
        
      } catch (error) {
        this.logger.error(`❌ Error processing role ${roleId}:`, error);
        
        // Brief pause before retrying to prevent tight error loops
        await this.sleep(5000);
      }
    }

    this.logger.info(`🛑 Role ${roleId} stopped processing`);
  }

  /**
   * Process a workflow message for a role
   */
  private async processMessage(role: RoleDefinition, message: WorkflowMessage): Promise<void> {
    const startTime = Date.now();
    
    this.logger.info(`🔄 Processing message for role ${role.id}`, {
      workflowId: message.workflowId,
      step: message.metadata.step
    });

    try {
      // Build specialized context for this role
      const roleContext = this.buildRoleContext(role, message);
      
      // Execute role-specific analysis
      const analysisResult = await this.executeRoleAnalysis(role, roleContext);
      
      // Determine next role in workflow
      const nextRole = this.determineNextRole(role.id, message.metadata.step, message.metadata.totalSteps);
      
      if (nextRole) {
        // Pass enriched context to next role
        await this.passToNextRole(message, role, analysisResult, nextRole);
      } else {
        // Final role - send completion
        await this.sendFinalCompletion(message, analysisResult);
      }

      // Record processing metrics
      await this.recordProcessingMetrics(role.id, message.workflowId, Date.now() - startTime, true);
      
    } catch (error) {
      this.logger.error(`❌ Role ${role.id} processing failed:`, error);
      
      // Handle failure with retry logic
      await this.redis.handleFailedMessage(message, error as Error);
      await this.recordProcessingMetrics(role.id, message.workflowId, Date.now() - startTime, false);
    }
  }

  /**
   * Build role-specific context from message and previous analyses
   */
  private buildRoleContext(role: RoleDefinition, message: WorkflowMessage): RoleContext {
    return {
      originalQuery: message.input.originalQuery,
      projectPath: message.input.projectPath,
      roleSpecificFocus: role.contextFocus,
      previousAnalyses: message.input.toolResults || [],
      toolResults: message.input.toolResults || []
    };
  }

  /**
   * Execute role-specific analysis using CodeMind CLI
   */
  private async executeRoleAnalysis(role: RoleDefinition, context: RoleContext): Promise<any> {
    // Create specialized prompt for this role
    const rolePrompt = this.createRolePrompt(role, context);
    
    // Create temporary prompt file
    const promptFile = await this.createTempPromptFile(rolePrompt);
    
    try {
      // Execute CodeMind CLI with role-specific context
      const result = await this.executeCodeMindCLI(context.projectPath, promptFile, role.tools);
      
      return {
        roleId: role.id,
        roleName: role.name,
        analysis: result,
        timestamp: Date.now(),
        toolsUsed: role.tools,
        contextFocus: role.contextFocus
      };
    } finally {
      // Cleanup temp file
      await fs.unlink(promptFile).catch(() => {}); // Ignore cleanup errors
    }
  }

  /**
   * Create specialized prompt for role
   */
  private createRolePrompt(role: RoleDefinition, context: RoleContext): string {
    const previousContext = context.previousAnalyses
      .map(analysis => `${analysis.roleName}: ${JSON.stringify(analysis.analysis, null, 2)}`)
      .join('\n\n');

    return role.promptTemplate
      .replace('{originalQuery}', context.originalQuery)
      .replace('{previousContext}', previousContext || 'No previous analysis');
  }

  /**
   * Create temporary prompt file for CodeMind CLI
   */
  private async createTempPromptFile(prompt: string): Promise<string> {
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    
    const promptFile = path.join(tempDir, `role_prompt_${uuidv4()}.txt`);
    await fs.writeFile(promptFile, prompt);
    
    return promptFile;
  }

  /**
   * Execute CodeMind CLI with role-specific parameters
   */
  private async executeCodeMindCLI(projectPath: string, promptFile: string, tools: string[]): Promise<any> {
    return new Promise((resolve, reject) => {
      // Build CodeMind CLI command
      const args = [
        'src/cli/codemind-cli.ts',
        '--project', projectPath,
        '--prompt-file', promptFile,
        '--tools', tools.join(','),
        '--optimization', 'balanced',
        '--output', 'json'
      ];

      this.currentProcess = spawn('tsx', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let stdout = '';
      let stderr = '';

      this.currentProcess.stdout!.on('data', (data) => {
        stdout += data.toString();
      });

      this.currentProcess.stderr!.on('data', (data) => {
        stderr += data.toString();
      });

      this.currentProcess.on('close', (code) => {
        if (code === 0) {
          try {
            // Parse JSON output from CLI
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (error) {
            // If not JSON, return raw output
            resolve({ output: stdout });
          }
        } else {
          reject(new Error(`CodeMind CLI failed with code ${code}: ${stderr}`));
        }
      });

      this.currentProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Determine next role based on current role and workflow progress
   */
  private determineNextRole(currentRole: string, currentStep: number, totalSteps: number): string | null {
    const roleSequence = ['architect', 'security', 'quality', 'performance', 'coordinator'];
    const currentIndex = roleSequence.indexOf(currentRole);
    
    if (currentIndex >= 0 && currentIndex < roleSequence.length - 1) {
      return roleSequence[currentIndex + 1];
    }
    
    return null; // Final role
  }

  /**
   * Pass enriched results to next role
   */
  private async passToNextRole(
    originalMessage: WorkflowMessage,
    currentRole: RoleDefinition, 
    analysisResult: any,
    nextRole: string
  ): Promise<void> {
    const nextMessage: WorkflowMessage = {
      workflowId: originalMessage.workflowId,
      roleId: nextRole,
      previousRole: currentRole.id,
      input: {
        originalQuery: originalMessage.input.originalQuery,
        projectPath: originalMessage.input.projectPath,
        toolResults: [...(originalMessage.input.toolResults || []), analysisResult],
        contextFromPrevious: {
          ...originalMessage.input.contextFromPrevious,
          [`${currentRole.id}Analysis`]: analysisResult
        }
      },
      metadata: {
        ...originalMessage.metadata,
        step: originalMessage.metadata.step + 1,
        timestamp: Date.now()
      }
    };

    await this.redis.sendToRole(nextRole, nextMessage);

    // Send progress update
    await this.redis.sendCompletion({
      workflowId: originalMessage.workflowId,
      roleId: currentRole.id,
      status: 'progress',
      result: analysisResult,
      timestamp: Date.now()
    });

    this.logger.info(`✅ Role ${currentRole.id} passed work to ${nextRole}`, {
      workflowId: originalMessage.workflowId,
      step: originalMessage.metadata.step
    });
  }

  /**
   * Send final workflow completion
   */
  private async sendFinalCompletion(message: WorkflowMessage, finalResult: any): Promise<void> {
    await this.redis.sendCompletion({
      workflowId: message.workflowId,
      roleId: message.roleId,
      status: 'complete',
      result: {
        finalAnalysis: finalResult,
        allAnalyses: message.input.toolResults,
        workflowSummary: {
          totalSteps: message.metadata.totalSteps,
          completedAt: Date.now(),
          originalQuery: message.input.originalQuery
        }
      },
      timestamp: Date.now()
    });

    this.logger.info(`🎉 Workflow ${message.workflowId} completed by role ${message.roleId}`);
  }

  /**
   * Record processing metrics for monitoring
   */
  private async recordProcessingMetrics(
    roleId: string, 
    workflowId: string, 
    duration: number, 
    success: boolean
  ): Promise<void> {
    try {
      // This would integrate with your existing database schema
      this.logger.info(`📊 Role ${roleId} processing metrics`, {
        workflowId,
        duration,
        success
      });
    } catch (error) {
      this.logger.warn('Failed to record processing metrics:', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI entry point for role terminal worker
async function main() {
  const worker = new RoleTerminalWorker();
  
  try {
    await worker.initialize();
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down role terminal worker...');
      await worker.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down role terminal worker...');
      await worker.shutdown();
      process.exit(0);
    });
    
    // Start processing (this will run indefinitely)
    await worker.startProcessing();
    
  } catch (error) {
    console.error('❌ Failed to start role terminal worker:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export default RoleTerminalWorker;