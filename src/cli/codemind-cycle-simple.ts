#!/usr/bin/env node

/**
 * CodeMind Cycle-Enhanced CLI - Simplified Version
 * 
 * Demonstrates the validation cycle system without complex integrations.
 * Focus on showing how validation cycles work before every request.
 */

import { Command } from 'commander';
import { Logger } from '../utils/logger';
import { CLILogger } from '../utils/cli-logger';
import { CodeMindValidationCycle, ProjectContext } from '../shared/validation-cycle';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';

const program = new Command();
const logger = Logger.getInstance();
const cliLogger = CLILogger.getInstance();

class SimpleCycleEnhancedCLI {
  private validationCycle: CodeMindValidationCycle;

  constructor() {
    this.validationCycle = new CodeMindValidationCycle({
      enableCoreCycle: true,
      enableQualityCycle: true,
      maxDuration: 3000, // 3 seconds max
      qualityThresholds: {
        solidMinScore: 0.7,
        maxDuplicationLines: 15,
        maxComplexityPerFunction: 12
      }
    });
  }

  /**
   * Main request processing with integrated validation cycles
   */
  async processRequest(
    userRequest: string, 
    projectPath: string, 
    options: { force?: boolean; skipCycles?: boolean } = {}
  ): Promise<string> {
    try {
      cliLogger.info(chalk.blue('🚀 Processing request with cycle validation...'));
      
      // 1. Build project context
      const context = await this.buildProjectContext(userRequest, projectPath);
      cliLogger.info(chalk.gray(`📂 Project: ${path.basename(projectPath)} (${context.language})`));
      cliLogger.info(chalk.gray(`🎯 Request type: ${context.requestType}`));
      if (context.changedFiles && context.changedFiles.length > 0) {
        cliLogger.info(chalk.gray(`📝 Modified files: ${context.changedFiles.length}`));
      }
      
      // 2. Run validation cycles (unless skipped)
      if (!options.skipCycles) {
        const cycleResults = await this.runValidationCycles(context, options.force);
        
        // If core cycle fails and not forcing, return error
        if (!cycleResults.core.success && !options.force) {
          return this.formatErrorResponse(cycleResults);
        }

        // Show cycle insights
        const cycleInsights = this.validationCycle.formatCycleResults(
          cycleResults.core,
          cycleResults.quality
        );

        if (cycleInsights.trim()) {
          console.log(chalk.blue('\\n📊 Validation Results:'));
          console.log(cycleInsights);
        }
      }

      // 3. Simulate request processing
      const response = await this.simulateRequestExecution(userRequest, context);
      
      // 4. Post-execution validation (if code was modified)
      if (context.requestType === 'code_modification' && !options.skipCycles) {
        await this.runPostExecutionValidation(context);
      }

      return response;

    } catch (error: any) {
      logger.error('Request processing failed:', error);
      return `❌ Request failed: ${error.message}`;
    }
  }

  /**
   * Build comprehensive project context
   */
  private async buildProjectContext(userRequest: string, projectPath: string): Promise<ProjectContext> {
    const requestType = this.classifyRequestType(userRequest);
    
    // Get recently modified files (git status)
    let changedFiles: string[] = [];
    try {
      const gitStatus = execSync('git status --porcelain', { 
        cwd: projectPath, 
        encoding: 'utf-8',
        timeout: 5000
      });
      
      changedFiles = gitStatus
        .split('\\n')
        .filter(line => line.trim())
        .map(line => line.substring(3)) // Remove git status prefix
        .filter(file => file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.json'));
    } catch (error) {
      // Not a git repo or git not available
      changedFiles = [];
    }

    // Detect language and framework
    const { language, framework } = await this.detectProjectTechnology(projectPath);

    return {
      projectPath,
      changedFiles,
      requestType,
      language,
      framework,
      userIntent: userRequest
    };
  }

  /**
   * Classify the type of user request
   */
  private classifyRequestType(userRequest: string): 'code_modification' | 'analysis' | 'general' {
    const codeWords = [
      'write', 'create', 'add', 'implement', 'build', 'generate', 'modify', 'update', 'refactor',
      'fix', 'change', 'delete', 'remove', 'edit', 'replace', 'insert'
    ];
    
    const analysisWords = [
      'analyze', 'review', 'check', 'examine', 'explain', 'understand', 'show', 'list',
      'find', 'search', 'locate', 'identify', 'describe'
    ];

    const lowerRequest = userRequest.toLowerCase();
    
    if (codeWords.some(word => lowerRequest.includes(word))) {
      return 'code_modification';
    } else if (analysisWords.some(word => lowerRequest.includes(word))) {
      return 'analysis';
    } else {
      return 'general';
    }
  }

  /**
   * Detect project language and framework
   */
  private async detectProjectTechnology(projectPath: string): Promise<{ language?: string; framework?: string }> {
    let language: string | undefined;
    let framework: string | undefined;

    try {
      // Check package.json for clues
      const packageJsonPath = path.join(projectPath, 'package.json');
      try {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        
        // Detect TypeScript
        if (packageJson.dependencies?.typescript || packageJson.devDependencies?.typescript) {
          language = 'typescript';
        } else {
          language = 'javascript';
        }

        // Detect frameworks
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        if (deps.react) framework = 'react';
        else if (deps.vue) framework = 'vue';
        else if (deps.express) framework = 'express';
        else if (deps.next) framework = 'nextjs';
        
      } catch (error) {
        // No package.json, check for other indicators
      }

      // Check tsconfig.json
      if (!language) {
        try {
          await fs.access(path.join(projectPath, 'tsconfig.json'));
          language = 'typescript';
        } catch (error) {
          language = 'javascript';
        }
      }

    } catch (error) {
      language = 'javascript';
    }

    return { language, framework };
  }

  /**
   * Run validation cycles
   */
  private async runValidationCycles(
    context: ProjectContext,
    force: boolean = false
  ): Promise<{ core: any; quality?: any }> {
    cliLogger.info(chalk.blue('🔄 Running validation cycles...'));
    
    // Always run core safety cycle
    const coreResult = await this.validationCycle.runCoreCycle(context);
    
    let qualityResult;
    // Run quality cycle for code modifications or analysis
    if (context.requestType === 'code_modification' || context.requestType === 'analysis') {
      qualityResult = await this.validationCycle.runQualityCycle(context);
    }

    return { core: coreResult, quality: qualityResult };
  }

  /**
   * Simulate request execution
   */
  private async simulateRequestExecution(userRequest: string, context: ProjectContext): Promise<string> {
    const lines: string[] = [];
    
    lines.push(chalk.green('✅ Request processed successfully\\n'));
    
    // Simulate different response types
    if (context.requestType === 'code_modification') {
      lines.push(chalk.cyan('💻 Code Modification Request:'));
      lines.push(`   Request: "${userRequest}"`);
      lines.push(`   Language: ${context.language || 'javascript'}`);
      lines.push(`   Framework: ${context.framework || 'none'}`);
      
      if (context.changedFiles && context.changedFiles.length > 0) {
        lines.push(`   Files to consider: ${context.changedFiles.slice(0, 3).join(', ')}${context.changedFiles.length > 3 ? '...' : ''}`);
      }
      
      lines.push('\\n💡 In a real implementation, this would:');
      lines.push('   • Generate appropriate code based on validation results');
      lines.push('   • Apply architectural patterns suggested by SOLID analyzer');
      lines.push('   • Avoid creating duplicate code flagged by duplication detector');
      lines.push('   • Ensure the result compiles and passes tests');
      
    } else if (context.requestType === 'analysis') {
      lines.push(chalk.cyan('🔍 Analysis Request:'));
      lines.push(`   Query: "${userRequest}"`);
      lines.push(`   Project type: ${context.language}/${context.framework || 'vanilla'}`);
      
      lines.push('\\n📊 Analysis would include:');
      lines.push('   • Code quality metrics from validation cycles');
      lines.push('   • SOLID principles adherence scores');
      lines.push('   • Security and duplication analysis results');
      lines.push('   • Compilation and test status');
      
    } else {
      lines.push(chalk.cyan('💬 General Request:'));
      lines.push(`   Query: "${userRequest}"`);
      lines.push('\\n📋 Response would be enhanced with:');
      lines.push('   • Project-specific context');
      lines.push('   • Quality insights from validation cycles');
      lines.push('   • Best practices for this codebase');
    }

    return lines.join('\\n');
  }

  /**
   * Run post-execution validation
   */
  private async runPostExecutionValidation(context: ProjectContext): Promise<void> {
    try {
      cliLogger.info(chalk.blue('\\n🔄 Running post-execution validation...'));
      
      // Quick compilation check after code changes
      const postResult = await this.validationCycle.runCoreCycle(context);
      
      if (!postResult.success) {
        cliLogger.warning(chalk.yellow('⚠️ Post-execution validation found issues:'));
        postResult.errors.forEach(error => {
          cliLogger.warning(`   • ${error.message}`);
        });
        cliLogger.info(chalk.blue('Consider running: npm run build'));
      } else {
        cliLogger.success('✅ Post-execution validation passed');
      }
    } catch (error) {
      logger.warn('Post-execution validation failed:', error);
    }
  }

  /**
   * Format error response for validation failures
   */
  private formatErrorResponse(cycleResults: { core: any; quality?: any }): string {
    const lines: string[] = [];
    
    lines.push(chalk.red('❌ Safety Validation Failed\\n'));
    
    if (cycleResults.core.errors.length > 0) {
      lines.push(chalk.red('Critical Issues:'));
      cycleResults.core.errors.forEach((error: any) => {
        lines.push(`   • ${error.message}${error.file ? ` (${error.file})` : ''}`);
      });
    }

    lines.push('\\n' + chalk.yellow('Please fix these issues before proceeding.'));
    lines.push(chalk.gray('Use --force to bypass validation (not recommended).'));

    return lines.join('\\n');
  }
}

// CLI Commands
program
  .name('codemind-cycle')
  .description('CodeMind CLI with integrated validation cycles (demo)')
  .version('3.0.0');

program
  .command('analyze')
  .description('Analyze project with quality validation')
  .argument('<query>', 'Analysis query')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('--skip-cycles', 'Skip validation cycles')
  .action(async (query: string, options: any) => {
    const cli = new SimpleCycleEnhancedCLI();
    const result = await cli.processRequest(query, options.path, {
      skipCycles: options.skipCycles
    });
    console.log(result);
  });

program
  .command('code')
  .description('Execute code modification with full validation')
  .argument('<request>', 'Code modification request')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('--force', 'Force execution even with validation errors')
  .option('--skip-cycles', 'Skip validation cycles')
  .action(async (request: string, options: any) => {
    const cli = new SimpleCycleEnhancedCLI();
    const result = await cli.processRequest(request, options.path, {
      force: options.force,
      skipCycles: options.skipCycles
    });
    console.log(result);
  });

program
  .command('validate')
  .description('Run validation cycles only')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .action(async (options: any) => {
    const validationCycle = new CodeMindValidationCycle();
    const cli = new SimpleCycleEnhancedCLI();
    
    // Build context for validation
    const context = await (cli as any).buildProjectContext('validate project', options.path);
    
    console.log(chalk.blue('🔄 Running validation cycles...\\n'));
    
    // Run core cycle
    const coreResult = await validationCycle.runCoreCycle(context);
    
    // Run quality cycle
    const qualityResult = await validationCycle.runQualityCycle(context);
    
    // Display results
    const output = validationCycle.formatCycleResults(coreResult, qualityResult);
    console.log(output);
    
    // Exit with appropriate code
    if (!coreResult.success) {
      process.exit(1);
    }
  });

program
  .command('demo')
  .description('Demo the cycle system with sample requests')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .action(async (options: any) => {
    const cli = new SimpleCycleEnhancedCLI();
    
    const demoRequests = [
      { type: 'analysis', request: 'analyze the architecture of this project' },
      { type: 'code', request: 'add a new user authentication function' },
      { type: 'general', request: 'explain how dependency injection works' }
    ];

    console.log(chalk.bold.cyan('🎭 CodeMind Cycle System Demo\\n'));
    console.log(chalk.gray('This demonstrates how validation cycles work before every request.\\n'));

    for (const demo of demoRequests) {
      console.log(chalk.bold.yellow(`\\n${'='.repeat(60)}`));
      console.log(chalk.bold.yellow(`DEMO: ${demo.type.toUpperCase()} REQUEST`));
      console.log(chalk.bold.yellow(`${'='.repeat(60)}`));
      
      const result = await cli.processRequest(demo.request, options.path);
      console.log(result);
    }

    console.log(chalk.bold.green('\\n🎉 Demo completed! This shows how CodeMind now validates every request.'));
  });

// Default command for backwards compatibility
program
  .argument('[request]', 'Request to process')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('--force', 'Force execution even with validation errors')
  .option('--skip-cycles', 'Skip validation cycles')
  .action(async (request: string | undefined, options: any) => {
    if (!request) {
      program.help();
      return;
    }
    
    const cli = new SimpleCycleEnhancedCLI();
    const result = await cli.processRequest(request, options.path, {
      force: options.force,
      skipCycles: options.skipCycles
    });
    console.log(result);
  });

// Error handling
program.configureOutput({
  writeErr: (str) => process.stderr.write(chalk.red(str))
});

program.exitOverride();

try {
  program.parse();
} catch (error: any) {
  if (error.exitCode === 0) {
    process.exit(0);
  }
  
  console.error(chalk.red('CLI Error:'), error.message);
  process.exit(1);
}

export { SimpleCycleEnhancedCLI };
export default program;