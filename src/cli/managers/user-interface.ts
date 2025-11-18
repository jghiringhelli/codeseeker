/**
 * UserInterface - Handles all user interaction, prompts, and display
 * Single Responsibility: User interface and interaction
 */

import inquirer from 'inquirer';
import * as readline from 'readline';
import { Theme } from '../ui/theme';
import { ProjectInitOptions } from './project-manager';

export class UserInterface {
  private rl?: readline.Interface;

  /**
   * Set the readline interface for managing input during inquirer prompts
   */
  setReadlineInterface(rl: readline.Interface): void {
    this.rl = rl;
  }
  
  /**
   * Get project initialization options from user
   */
  async getProjectInitOptions(): Promise<ProjectInitOptions> {
    const path = require('path');
    // Use user's original working directory (set by bin/codemind.js)
    const userCwd = process.env.CODEMIND_USER_CWD || process.cwd();
    const defaultProjectName = path.basename(userCwd);
    
    // Pause readline if available to prevent conflicts with inquirer
    if (this.rl) {
      this.rl.pause();
    }

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectName',
        message: 'Project name:',
        default: defaultProjectName,
        validate: (input) => input.trim().length > 0 || 'Project name is required'
      },
      {
        type: 'list',
        name: 'projectType',
        message: 'Project type:',
        choices: [
          { name: 'Web Application', value: 'web_app' },
          { name: 'Mobile Application', value: 'mobile_app' },
          { name: 'Desktop Application', value: 'desktop_app' },
          { name: 'Library/Framework', value: 'library' },
          { name: 'API/Microservice', value: 'api' },
          { name: 'CLI Tool', value: 'cli' },
          { name: 'Other', value: 'other' }
        ]
      },
      {
        type: 'checkbox',
        name: 'features',
        message: 'Select features to enable:',
        choices: [
          { name: 'Semantic Search', value: 'semantic_search', checked: true },
          { name: 'Architecture Analysis', value: 'architecture', checked: true },
          { name: 'Use Cases Inference', value: 'usecases', checked: true },
          { name: 'Code Quality Analysis', value: 'quality', checked: true },
          { name: 'Dependency Graph', value: 'dependencies', checked: true },
          { name: 'Performance Monitoring', value: 'performance' }
        ]
      }
    ]);

    // Resume readline after inquirer is done
    if (this.rl) {
      this.rl.resume();
    }

    return answers as ProjectInitOptions;
  }

  /**
   * Display comprehensive help information
   */
  displayHelp(): void {
    console.log(Theme.colors.primary('\n🤖 CodeMind CLI - Intelligent Code Assistant'));
    console.log(Theme.colors.border('═'.repeat(60)));
    
    console.log(Theme.colors.secondary('\n📋 COMMANDS'));
    console.log(Theme.colors.info('  /setup          Initialize infrastructure (Docker, databases)'));
    console.log(Theme.colors.info('  /init [--reset] Initialize current directory as CodeMind project'));
    console.log(Theme.colors.info('  /status         Show system and project status'));
    console.log(Theme.colors.info('  /project        Project management (switch, info)'));
    console.log(Theme.colors.info('  /search <query> Semantic search across project'));
    console.log(Theme.colors.info('  /analyze        Re-analyze project with Claude Code'));
    console.log(Theme.colors.info('  /dedup <path>   Granular duplicate code analysis and merging'));
    console.log(Theme.colors.info('  /solid <path>   SOLID principles analysis and refactoring'));
    console.log(Theme.colors.info('  /docs <path>    Package documentation and ADR generation'));
    console.log(Theme.colors.info('  /sync [cmd]     Sync semantic search and graph with code changes'));
    console.log(Theme.colors.info('  /instructions   Manage CODEMIND.md project instructions'));
    console.log(Theme.colors.info('  /help           Show this help message'));
    console.log(Theme.colors.info('  /exit           Exit CodeMind CLI'));

    console.log(Theme.colors.secondary('\n🔍 PATH-BASED ANALYSIS COMMANDS'));
    console.log(Theme.colors.muted('  /dedup /src              Analyze duplicates in /src directory (recursive)'));
    console.log(Theme.colors.muted('  /dedup file.ts           Analyze single file'));
    console.log(Theme.colors.muted('  /dedup /utils --nr       Analyze /utils directory (non-recursive)'));
    console.log(Theme.colors.muted(''));
    console.log(Theme.colors.muted('  /solid /                 Analyze entire project for SOLID violations'));
    console.log(Theme.colors.muted('  /solid /src/services     Analyze services directory only'));
    console.log(Theme.colors.muted('  /solid file.ts           Analyze single file'));
    console.log(Theme.colors.muted(''));
    console.log(Theme.colors.muted('  /docs /                  Generate docs for entire project'));
    console.log(Theme.colors.muted('  /docs /src/api          Generate docs for API package'));
    console.log(Theme.colors.muted(''));
    console.log(Theme.colors.muted('  /sync run               Intelligent incremental sync'));
    console.log(Theme.colors.muted('  /sync check             Quick sync status check'));
    console.log(Theme.colors.muted('  /sync force             Force full rebuild of semantic data'));
    console.log(Theme.colors.muted('  /sync watch start       Start real-time file watcher'));
    console.log(Theme.colors.muted('  /sync watch stop        Stop file watcher'));
    console.log(Theme.colors.muted(''));
    console.log(Theme.colors.muted('  📁 Paths: "/" = project root, relative paths supported'));
    console.log(Theme.colors.muted('  🔄 Flags: --no-recursive (--nr) to disable recursive scanning'));

    console.log(Theme.colors.secondary('\n📋 INSTRUCTION COMMANDS'));
    console.log(Theme.colors.muted('  /instructions show     Display current CODEMIND.md instructions'));
    console.log(Theme.colors.muted('  /instructions create   Generate sample CODEMIND.md file'));
    console.log(Theme.colors.muted('  /instructions edit     Open CODEMIND.md in default editor'));
    console.log(Theme.colors.muted('  /instructions reload   Refresh instruction cache'));
    console.log(Theme.colors.muted(''));
    console.log(Theme.colors.muted('  CODEMIND.md provides project-specific guidance (like Claude Code\'s CLAUDE.md)'));
    console.log(Theme.colors.muted('  and supports cascading from global, project, directory, and local sources.'));

    console.log(Theme.colors.secondary('\n🤖 NATURAL LANGUAGE'));
    console.log(Theme.colors.muted('  Just type your request in natural language:'));
    console.log(Theme.colors.info('  "Add a login system with JWT authentication"'));
    console.log(Theme.colors.info('  "Refactor the user service to follow SOLID principles"'));
    console.log(Theme.colors.info('  "Find and fix potential security vulnerabilities"'));
    console.log(Theme.colors.info('  "Write unit tests for the payment module"'));

    console.log(Theme.colors.secondary('\n🚀 WORKFLOW'));
    console.log(Theme.colors.muted('  1. Run "/setup" (one-time setup)'));
    console.log(Theme.colors.muted('  2. Navigate to your project directory'));
    console.log(Theme.colors.muted('  3. Run "/init" to analyze and register your project'));
    console.log(Theme.colors.muted('  4. Start making requests in natural language'));

    console.log(Theme.colors.secondary('\n⌨️ KEYBOARD SHORTCUTS'));
    console.log(Theme.colors.interrupt('  Ctrl+Z        '));
    console.log(Theme.colors.muted('                Interrupt running operations (like Escape in Claude Code)'));
    console.log(Theme.colors.interrupt('  Ctrl+C        '));
    console.log(Theme.colors.muted('                Graceful exit (press twice to force exit)'));
    console.log(Theme.colors.interrupt('  Ctrl+U        '));
    console.log(Theme.colors.muted('                Clear current input line'));
    console.log(Theme.colors.muted(''));
    console.log(Theme.colors.claudeCode('  🤖 '));
    console.log(Theme.colors.muted('                Claude Code output (distinctive orange color)'));
    console.log(Theme.colors.muted('                Real-time forwarding from Claude Code processes'));

    console.log(Theme.colors.border('\n' + '═'.repeat(60)));
  }

  /**
   * Display processing results from Claude Code
   */
  displayProcessingResults(data: any): void {
    // If data is a string (raw Claude Code response), display it directly
    if (typeof data === 'string') {
      console.log(Theme.colors.claudeCode('\n🤖 Claude Code Response:'));
      console.log(Theme.colors.border('─'.repeat(60)));
      console.log(data);
      console.log(Theme.colors.border('─'.repeat(60)));
      return;
    }

    // Handle structured data
    console.log(Theme.colors.result('\n📋 Processing Results:'));

    if (data.files_modified && data.files_modified.length > 0) {
      console.log(Theme.colors.success(`📝 Files Modified: ${data.files_modified.length}`));
      data.files_modified.forEach((file: string) => {
        console.log(Theme.colors.muted(`   • ${file}`));
      });
    }

    if (data.tests_run) {
      const testColor = data.tests_run.passed === data.tests_run.total ?
        Theme.colors.success : Theme.colors.warning;
      console.log(testColor(`🧪 Tests: ${data.tests_run.passed}/${data.tests_run.total} passed`));
    }

    if (data.quality_score) {
      const scoreColor = data.quality_score >= 8 ? Theme.colors.success :
                        data.quality_score >= 6 ? Theme.colors.warning : Theme.colors.error;
      console.log(scoreColor(`⭐ Quality Score: ${data.quality_score}/10`));
    }

    if (data.summary) {
      console.log(Theme.colors.result(`\n📄 Summary: ${data.summary}`));
    }

    if (data.recommendations && data.recommendations.length > 0) {
      console.log(Theme.colors.info('\n💡 Recommendations:'));
      data.recommendations.forEach((rec: string) => {
        console.log(Theme.colors.muted(`   • ${rec}`));
      });
    }
  }

  /**
   * Display search results
   */
  displaySearchResults(results: Array<{ file: string; relevance: number; summary: string }>): void {
    console.log(Theme.colors.primary(`\n🔍 Search Results (${results.length} found)`));
    console.log(Theme.colors.border('─'.repeat(60)));

    if (results.length === 0) {
      console.log(Theme.colors.muted('No results found. Try different search terms.'));
      return;
    }

    results.forEach((result, index) => {
      const relevanceBar = '█'.repeat(Math.floor(result.relevance * 10));
      console.log(Theme.colors.secondary(`\n${index + 1}. ${result.file}`));
      console.log(Theme.colors.info(`   Relevance: ${relevanceBar} ${Math.round(result.relevance * 100)}%`));
      console.log(Theme.colors.muted(`   ${result.summary}`));
    });
  }

  /**
   * Display analysis results
   */
  displayAnalysisResults(analysis: any): void {
    console.log(Theme.colors.primary('\n🔍 Project Analysis Results'));
    console.log(Theme.colors.border('═'.repeat(60)));

    // Architecture
    console.log(Theme.colors.secondary('\n🏗️  Architecture:'));
    console.log(Theme.colors.info(`   Type: ${analysis.architecture.type}`));
    if (analysis.architecture.patterns.length > 0) {
      console.log(Theme.colors.info(`   Patterns: ${analysis.architecture.patterns.join(', ')}`));
    }
    if (analysis.architecture.frameworks.length > 0) {
      console.log(Theme.colors.info(`   Frameworks: ${analysis.architecture.frameworks.join(', ')}`));
    }

    // Dependencies
    console.log(Theme.colors.secondary('\n🔗 Dependencies:'));
    console.log(Theme.colors.info(`   Files analyzed: ${analysis.dependencies.files.length}`));
    console.log(Theme.colors.info(`   Relationships: ${analysis.dependencies.relationships.length}`));

    // Use Cases
    if (analysis.useCases.length > 0) {
      console.log(Theme.colors.secondary('\n📋 Use Cases:'));
      analysis.useCases.slice(0, 5).forEach((useCase: any, index: number) => {
        console.log(Theme.colors.info(`   ${index + 1}. ${useCase.name}`));
        console.log(Theme.colors.muted(`      ${useCase.description}`));
      });
      if (analysis.useCases.length > 5) {
        console.log(Theme.colors.muted(`   ... and ${analysis.useCases.length - 5} more`));
      }
    }

    // Code Quality
    console.log(Theme.colors.secondary('\n⭐ Code Quality:'));
    const scoreColor = analysis.codeQuality.score >= 8 ? Theme.colors.success :
                      analysis.codeQuality.score >= 6 ? Theme.colors.warning : Theme.colors.error;
    console.log(scoreColor(`   Score: ${analysis.codeQuality.score}/10`));
    
    if (analysis.codeQuality.issues.length > 0) {
      console.log(Theme.colors.warning('   Issues:'));
      analysis.codeQuality.issues.slice(0, 3).forEach((issue: string) => {
        console.log(Theme.colors.muted(`     • ${issue}`));
      });
    }

    if (analysis.codeQuality.recommendations.length > 0) {
      console.log(Theme.colors.info('   Recommendations:'));
      analysis.codeQuality.recommendations.slice(0, 3).forEach((rec: string) => {
        console.log(Theme.colors.muted(`     • ${rec}`));
      });
    }
  }

  /**
   * Display project information
   */
  displayProjectInfo(projectInfo: any): void {
    if (!projectInfo) {
      console.log(Theme.colors.warning('No project information available'));
      return;
    }

    console.log(Theme.colors.primary('\n📊 Project Information'));
    console.log(Theme.colors.border('═'.repeat(60)));

    console.log(Theme.colors.secondary('Basic Info:'));
    console.log(Theme.colors.info(`   Name: ${projectInfo.project_name}`));
    console.log(Theme.colors.info(`   Type: ${projectInfo.project_type}`));
    
    if (projectInfo.languages) {
      const languages = JSON.parse(projectInfo.languages || '[]');
      console.log(Theme.colors.info(`   Languages: ${languages.join(', ')}`));
    }

    if (projectInfo.frameworks) {
      const frameworks = JSON.parse(projectInfo.frameworks || '[]');
      console.log(Theme.colors.info(`   Frameworks: ${frameworks.join(', ')}`));
    }

    console.log(Theme.colors.secondary('\nStatistics:'));
    console.log(Theme.colors.info(`   Total Files: ${projectInfo.total_files || 0}`));
    if (projectInfo.statistics) {
      console.log(Theme.colors.info(`   Embeddings: ${projectInfo.statistics.embeddings || 0}`));
      console.log(Theme.colors.info(`   Last Analyzed: ${new Date(projectInfo.statistics.lastAnalyzed).toLocaleDateString()}`));
    }

    console.log(Theme.colors.secondary('\nTimestamps:'));
    console.log(Theme.colors.muted(`   Created: ${new Date(projectInfo.created_at).toLocaleString()}`));
    console.log(Theme.colors.muted(`   Updated: ${new Date(projectInfo.updated_at).toLocaleString()}`));
  }

  /**
   * Display a spinner or progress indicator
   */
  showProgress(message: string): void {
    console.log(Theme.colors.info(`🔄 ${message}`));
  }

  /**
   * Display success message
   */
  showSuccess(message: string): void {
    console.log(Theme.colors.success(`✅ ${message}`));
  }

  /**
   * Display error message
   */
  showError(message: string): void {
    console.log(Theme.colors.error(`❌ ${message}`));
  }

  /**
   * Display warning message
   */
  showWarning(message: string): void {
    console.log(Theme.colors.warning(`⚠️  ${message}`));
  }

  /**
   * Show a confirmation prompt to the user
   */
  async confirm(message: string): Promise<boolean> {
    // Pause readline if available to prevent conflicts with inquirer
    if (this.rl) {
      this.rl.pause();
    }

    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmed',
        message: message,
        default: false
      }
    ]);

    // Resume readline after inquirer is done
    if (this.rl) {
      this.rl.resume();
    }

    return answer.confirmed;
  }

  /**
   * Ask user to choose from multiple options when project is already initialized
   */
  async getInitializationAction(projectName: string): Promise<'reinitialize' | 'skip' | 'sync' | 'prompt_user'> {
    console.log(Theme.colors.warning(`\n⚠️  Project "${projectName}" is already initialized in CodeMind.`));
    console.log(Theme.colors.info('\nWhat would you like to do?'));

    const choices = [
      { name: 'Sync - Update only changed files (recommended)', value: 'sync' },
      { name: 'Skip - Keep existing data unchanged', value: 'skip' },
      { name: 'Reinitialize - Clear all data and start fresh', value: 'reinitialize' }
    ];

    // Pause readline if available to prevent conflicts with inquirer
    if (this.rl) {
      this.rl.pause();
    }

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Choose an action:',
        choices,
        default: 'sync'
      }
    ]);

    // Resume readline after inquirer is done
    if (this.rl) {
      this.rl.resume();
    }

    console.log(Theme.colors.info('\n💡 Tip: You can skip this prompt next time by using:'));
    console.log(Theme.colors.muted(`   /init --${answer.action === 'reinitialize' ? 'reinit' : answer.action}`));

    return answer.action as 'reinitialize' | 'skip' | 'sync';
  }

  /**
   * Display deduplication report with detailed findings
   */
  displayDeduplicationReport(report: any): void {
    console.log(Theme.colors.primary('\n🔍 Duplicate Code Analysis Report'));
    console.log(Theme.colors.border('═'.repeat(60)));

    // Summary statistics
    console.log(Theme.colors.secondary('\nSummary:'));
    console.log(Theme.colors.info(`   📊 Total code chunks analyzed: ${report.totalChunksAnalyzed}`));
    console.log(Theme.colors.info(`   🔍 Duplicate groups found: ${report.duplicateGroups.length}`));

    if (report.summary.exactDuplicates > 0) {
      console.log(Theme.colors.warning(`   🎯 Exact duplicates: ${report.summary.exactDuplicates} groups`));
    }
    if (report.summary.semanticDuplicates > 0) {
      console.log(Theme.colors.info(`   🧠 Semantic duplicates: ${report.summary.semanticDuplicates} groups`));
    }
    if (report.summary.structuralDuplicates > 0) {
      console.log(Theme.colors.muted(`   🏗️  Structural duplicates: ${report.summary.structuralDuplicates} groups`));
    }

    if (report.summary.totalLinesAffected > 0) {
      console.log(Theme.colors.warning(`   📏 Total lines affected: ${report.summary.totalLinesAffected}`));
      console.log(Theme.colors.success(`   💾 Potential lines saved: ${report.summary.potentialSavings}`));
    }

    // Detailed duplicate groups
    if (report.duplicateGroups.length > 0) {
      console.log(Theme.colors.secondary('\nDuplicate Groups:'));

      report.duplicateGroups.slice(0, 10).forEach((group: any, index: number) => {
        const typeIcon = group.type === 'exact' ? '🎯' : group.type === 'semantic' ? '🧠' : '🏗️';
        const similarity = (group.similarity * 100).toFixed(1);

        console.log(Theme.colors.result(`\n   ${typeIcon} Group ${index + 1}: ${similarity}% similarity (${group.type})`));
        console.log(Theme.colors.muted(`      Type: ${group.chunks[0].type}`));
        console.log(Theme.colors.muted(`      Instances: ${group.chunks.length}`));
        console.log(Theme.colors.muted(`      Files affected: ${group.estimatedSavings.filesAffected}`));
        console.log(Theme.colors.muted(`      Potential savings: ${group.estimatedSavings.linesReduced} lines`));

        if (group.consolidationSuggestion) {
          console.log(Theme.colors.info(`      💡 Suggestion: ${group.consolidationSuggestion}`));
        }

        // Show file locations
        group.chunks.slice(0, 3).forEach((chunk: any) => {
          const fileName = chunk.filePath.split(/[/\\]/).pop();
          console.log(Theme.colors.muted(`         📄 ${fileName}:${chunk.startLine}-${chunk.endLine}`));
        });

        if (group.chunks.length > 3) {
          console.log(Theme.colors.muted(`         ... and ${group.chunks.length - 3} more locations`));
        }
      });

      if (report.duplicateGroups.length > 10) {
        console.log(Theme.colors.muted(`\n   ... and ${report.duplicateGroups.length - 10} more duplicate groups`));
      }
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      console.log(Theme.colors.secondary('\n💡 Recommendations:'));
      report.recommendations.forEach((rec: string) => {
        console.log(Theme.colors.info(`   • ${rec}`));
      });
    }

    console.log(Theme.colors.border('\n' + '═'.repeat(60)));
  }

  /**
   * Display consolidation summary after automatic consolidation
   */
  displayConsolidationSummary(summary: any): void {
    console.log(Theme.colors.primary('\n🔄 Code Consolidation Summary'));
    console.log(Theme.colors.border('═'.repeat(60)));

    // Overall results
    console.log(Theme.colors.secondary('\nResults:'));
    console.log(Theme.colors.info(`   📊 Groups processed: ${summary.totalGroupsProcessed}`));
    console.log(Theme.colors.success(`   ✅ Successful: ${summary.successfulConsolidations}`));

    if (summary.failedConsolidations > 0) {
      console.log(Theme.colors.error(`   ❌ Failed: ${summary.failedConsolidations}`));
    }

    console.log(Theme.colors.success(`   📏 Lines reduced: ${summary.totalLinesReduced}`));
    console.log(Theme.colors.info(`   📁 Files modified: ${summary.filesModified.length}`));

    if (summary.newUtilitiesCreated.length > 0) {
      console.log(Theme.colors.secondary('\nNew Utilities Created:'));
      summary.newUtilitiesCreated.forEach((utility: string) => {
        console.log(Theme.colors.info(`   🔧 ${utility}`));
      });
    }

    if (summary.overallQualityImprovement > 0) {
      console.log(Theme.colors.success(`\n⭐ Quality improvement: ${summary.overallQualityImprovement.toFixed(1)}%`));
    }

    // Show errors if any
    if (summary.errors.length > 0) {
      console.log(Theme.colors.secondary('\n⚠️  Issues encountered:'));
      summary.errors.slice(0, 5).forEach((error: string) => {
        console.log(Theme.colors.error(`   • ${error}`));
      });

      if (summary.errors.length > 5) {
        console.log(Theme.colors.muted(`   ... and ${summary.errors.length - 5} more issues`));
      }
    }

    // Modified files
    if (summary.filesModified.length > 0) {
      console.log(Theme.colors.secondary('\nModified Files:'));
      summary.filesModified.slice(0, 10).forEach((file: string) => {
        const fileName = file.split(/[/\\]/).pop();
        console.log(Theme.colors.muted(`   📄 ${fileName}`));
      });

      if (summary.filesModified.length > 10) {
        console.log(Theme.colors.muted(`   ... and ${summary.filesModified.length - 10} more files`));
      }
    }

    console.log(Theme.colors.border('\n' + '═'.repeat(60)));

    if (summary.successfulConsolidations > 0) {
      console.log(Theme.colors.success('\n🎉 Code consolidation completed successfully!'));
      console.log(Theme.colors.info('💡 Consider running tests to ensure everything works correctly.'));
    }
  }
}