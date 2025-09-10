#!/usr/bin/env node

/**
 * CodeMind Cycle-Enhanced CLI
 * 
 * Integrates automatic validation cycles for quality-aware AI assistance.
 * Runs safety and quality checks before every response to prevent issues.
 */

import { Command } from 'commander';
import { Logger } from '../utils/logger';
import { CLILogger } from '../utils/cli-logger';
import { CodeMindValidationCycle, ProjectContext } from '../shared/validation-cycle';
import { SemanticOrchestrator } from '../orchestration/semantic-orchestrator';
import { ContextOptimizer } from './context-optimizer';
import { IntelligentToolSelector } from '../shared/intelligent-tool-selector';
import { ContextProvider } from '../shared/context-provider';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';

const program = new Command();
const logger = Logger.getInstance();
const cliLogger = CLILogger.getInstance();

class CycleEnhancedCLI {
  private validationCycle: CodeMindValidationCycle;
  private semanticOrchestrator: SemanticOrchestrator;
  private contextOptimizer: ContextOptimizer;
  private toolSelector: IntelligentToolSelector;
  private contextProvider: ContextProvider;

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

    this.semanticOrchestrator = new SemanticOrchestrator();
    this.contextOptimizer = new ContextOptimizer();
    this.toolSelector = new IntelligentToolSelector();
    this.contextProvider = new ContextProvider();
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
      logger.info('🚀 Processing request with cycle validation...');
      
      // 1. Build project context
      const context = await this.buildProjectContext(userRequest, projectPath);
      
      // 2. Run validation cycles (unless skipped)
      if (!options.skipCycles) {
        const cycleResults = await this.runValidationCycles(context, options.force);
        
        // If core cycle fails and not forcing, return error
        if (!cycleResults.core.success && !options.force) {
          return this.formatErrorResponse(cycleResults);
        }

        // Add cycle insights to response
        const cycleInsights = this.validationCycle.formatCycleResults(
          cycleResults.core,
          cycleResults.quality
        );

        if (cycleInsights.trim()) {
          cliLogger.info('\\n' + chalk.blue('📊 Validation Results:'));
          cliLogger.info(cycleInsights);
        }
      }

      // 3. Execute the actual request with intelligent tool selection
      const response = await this.executeIntelligentRequest(userRequest, context);
      
      // 4. Post-execution validation (if code was modified)
      if (context.requestType === 'code_modification') {
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
      // Not a git repo or git not available - use current directory scan
      try {
        const recentFiles = await this.findRecentlyModifiedFiles(projectPath);
        changedFiles = recentFiles;
      } catch (scanError) {
        // If we can't determine changed files, we'll work with what we have
        changedFiles = [];
      }
    }

    // Detect language and framework
    const { language, framework } = await this.detectProjectTechnology(projectPath);

    return {
      projectPath,
      changedFiles,
      requestType,
      language,
      framework
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
   * Find recently modified files
   */
  private async findRecentlyModifiedFiles(projectPath: string): Promise<string[]> {
    const files: string[] = [];
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago

    const scanDirectory = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue; // Skip hidden files/dirs
          
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(projectPath, fullPath);
          
          if (entry.isDirectory()) {
            if (!['node_modules', 'dist', 'build', '.git'].includes(entry.name)) {
              await scanDirectory(fullPath);
            }
          } else if (entry.isFile()) {
            if (entry.name.endsWith('.ts') || entry.name.endsWith('.js') || entry.name.endsWith('.json')) {
              const stats = await fs.stat(fullPath);
              if (stats.mtime.getTime() > cutoffTime) {
                files.push(relativePath);
              }
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    await scanDirectory(projectPath);
    return files.slice(0, 20); // Limit to 20 most recent files
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
        else if (deps.angular || deps['@angular/core']) framework = 'angular';
        else if (deps.express) framework = 'express';
        else if (deps.next) framework = 'nextjs';
        else if (deps.nuxt) framework = 'nuxtjs';
        
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
      // Default fallback
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
    logger.info('🔄 Running validation cycles...');
    
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
   * Execute request using intelligent tool selection
   */
  private async executeIntelligentRequest(userRequest: string, context: ProjectContext): Promise<string> {
    try {
      // Use semantic orchestrator for complex requests
      if (context.requestType === 'code_modification') {
        const result = await this.semanticOrchestrator.analyzeWithSemanticContext({
          query: userRequest,
          projectPath: context.projectPath,
          intent: 'coding',
          maxResults: 10,
          includeRelated: true
        });

        return this.formatSemanticResponse(result);
      } else {
        // For analysis requests, use context optimization
        const optimizedContext = await this.contextOptimizer.optimizeContext({
          query: userRequest,
          projectPath: context.projectPath,
          tokenBudget: 8000,
          strategy: 'smart'
        });

        return `Context optimization completed. ${optimizedContext.priorityFiles.length} files prioritized for analysis.`;
      }

    } catch (error: any) {
      logger.error('Intelligent request execution failed:', error);
      return `Request execution failed: ${error.message}. Please try again or use --force to bypass validation.`;
    }
  }

  /**
   * Run post-execution validation
   */
  private async runPostExecutionValidation(context: ProjectContext): Promise<void> {
    try {
      // Quick compilation check after code changes
      const postResult = await this.validationCycle.runCoreCycle(context);
      
      if (!postResult.success) {
        cliLogger.warning(chalk.yellow('\\n⚠️ Post-execution validation found issues:'));
        postResult.errors.forEach(error => {
          cliLogger.warning(`   • ${error.message}`);
        });
        cliLogger.info(chalk.blue('\\nConsider running: npm run build'));
      } else {
        cliLogger.success(chalk.green('✅ Post-execution validation passed'));
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

  /**
   * Format semantic orchestrator response
   */
  private formatSemanticResponse(result: any): string {
    const lines: string[] = [];
    
    if (result.success) {
      lines.push(chalk.green('✅ Task completed successfully\\n'));
      
      if (result.analysis) {
        lines.push(chalk.blue('📊 Analysis Results:'));
        lines.push(result.analysis);
        lines.push('');
      }

      if (result.recommendations?.length > 0) {
        lines.push(chalk.cyan('💡 Recommendations:'));
        result.recommendations.forEach((rec: string) => {
          lines.push(`   • ${rec}`);
        });
      }
    } else {
      lines.push(chalk.red('❌ Task failed:'));
      lines.push(result.error || 'Unknown error occurred');
    }

    return lines.join('\\n');
  }
}

// CLI Commands
program
  .name('codemind-enhanced')
  .description('CodeMind CLI with integrated validation cycles')
  .version('3.0.0');

program
  .command('analyze')
  .description('Analyze project with quality validation')
  .argument('<query>', 'Analysis query')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('--skip-cycles', 'Skip validation cycles')
  .action(async (query: string, options: any) => {
    const cli = new CycleEnhancedCLI();
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
    const cli = new CycleEnhancedCLI();
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
    const cli = new CycleEnhancedCLI();
    
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
  .command('status')
  .description('Show project and validation status')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .action(async (options: any) => {
    try {
      console.log(chalk.blue('📊 CodeMind Project Status\\n'));
      
      // Project info
      console.log(chalk.cyan('Project Path:'), options.path);
      
      // Git status
      try {
        const gitStatus = execSync('git status --porcelain', { 
          cwd: options.path, 
          encoding: 'utf-8',
          timeout: 5000
        });
        const changedFileCount = gitStatus.split('\\n').filter(l => l.trim()).length;
        console.log(chalk.cyan('Modified Files:'), changedFileCount);
      } catch (error) {
        console.log(chalk.cyan('Git Status:'), 'Not a git repository');
      }

      // Package info
      try {
        const packagePath = path.join(options.path, 'package.json');
        const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
        console.log(chalk.cyan('Project Name:'), packageJson.name);
        console.log(chalk.cyan('Version:'), packageJson.version);
      } catch (error) {
        console.log(chalk.cyan('Package Info:'), 'No package.json found');
      }

      // Quick validation
      const validationCycle = new CodeMindValidationCycle();
      const cli = new CycleEnhancedCLI();
      const context = await (cli as any).buildProjectContext('status check', options.path);
      
      console.log(chalk.blue('\\n🔄 Running quick validation...'));
      const coreResult = await validationCycle.runCoreCycle(context);
      
      if (coreResult.success) {
        console.log(chalk.green('✅ Core validation passed'));
      } else {
        console.log(chalk.red('❌ Core validation failed'));
        coreResult.errors.forEach((error: any) => {
          console.log(chalk.red(`   • ${error.message}`));
        });
      }
      
      console.log(chalk.gray(`\\nValidation completed in ${coreResult.duration}ms`));
      
    } catch (error: any) {
      console.error(chalk.red('Status check failed:'), error.message);
    }
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
    
    const cli = new CycleEnhancedCLI();
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
    // Help command
    process.exit(0);
  }
  
  console.error(chalk.red('CLI Error:'), error.message);
  process.exit(1);
}

export { CycleEnhancedCLI };
export default program;