#!/usr/bin/env node

import { Command } from 'commander';
import { ClaudeIntegration } from './claude-integration';
import { ContextOptimizer } from './context-optimizer';
import { DuplicationDetector } from '../features/duplication/detector';
import { TreeNavigator } from '../features/tree-navigation/navigator';
import { VectorSearch } from '../features/vector-search/search-engine';
import { CentralizationDetector } from '../features/centralization/detector';
import { GitIntegration } from '../git/git-integration';
import { Logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';

const program = new Command();
const logger = Logger.getInstance();

// Initialize core services
const claudeIntegration = new ClaudeIntegration();
const contextOptimizer = new ContextOptimizer();
const duplicationDetector = new DuplicationDetector();
const treeNavigator = new TreeNavigator();
const vectorSearch = new VectorSearch();
const centralizationDetector = new CentralizationDetector();
const gitIntegration = new GitIntegration();

program
  .name('codemind')
  .description('Intelligent Code Auxiliary System CLI')
  .version('0.1.0');

// Claude integration commands
program
  .command('ask')
  .description('Ask Claude a question with optimized context')
  .argument('<question>', 'Question to ask Claude')
  .option('-c, --context <type>', 'Context type (auto|smart|minimal|full)', 'smart')
  .option('-b, --budget <tokens>', 'Token budget for context', '8000')
  .option('-f, --focus <area>', 'Focus area for context selection')
  .option('--project <path>', 'Project path', '.')
  .action(async (question: string, options: any) => {
    try {
      logger.info('Processing question with context optimization...');
      
      const optimization = await contextOptimizer.optimizeContext({
        projectPath: options.project,
        query: question,
        tokenBudget: parseInt(options.budget),
        contextType: options.context,
        focusArea: options.focus
      });

      const response = await claudeIntegration.askQuestion(question, optimization);
      
      console.log('\n🤖 Claude Response:');
      console.log('─'.repeat(50));
      console.log(response.content);
      
      if (response.contextUsed) {
        console.log('\n📊 Context Info:');
        console.log(`- Tokens used: ${response.contextUsed.tokensUsed}/${options.budget}`);
        console.log(`- Files included: ${response.contextUsed.filesIncluded.length}`);
        console.log(`- Optimization: ${response.contextUsed.optimizationStrategy}`);
      }
      
    } catch (error) {
      logger.error('Failed to process question', error);
      process.exit(1);
    }
  });

program
  .command('optimize-context')
  .description('Optimize context window for better Claude interactions')
  .option('-b, --budget <tokens>', 'Token budget', '8000')
  .option('-f, --focus <area>', 'Focus area')
  .option('--project <path>', 'Project path', '.')
  .action(async (options: any) => {
    try {
      const analysis = await contextOptimizer.analyzeProject({
        projectPath: options.project,
        tokenBudget: parseInt(options.budget),
        focusArea: options.focus
      });

      console.log('\n📈 Context Optimization Analysis:');
      console.log('─'.repeat(50));
      console.log(`Project type: ${analysis.type}`);
      console.log(`Total files: ${analysis.totalFiles}`);
      console.log(`Primary language: ${analysis.primaryLanguage}`);
      console.log(`Framework: ${analysis.framework || 'None detected'}`);
      
      if ('recommendations' in analysis && analysis.recommendations) {
        console.log('\n💡 Recommendations:');
        analysis.recommendations.forEach((rec: string, i: number) => {
          console.log(`${i + 1}. ${rec}`);
        });
      }

    } catch (error) {
      logger.error('Failed to optimize context', error);
      process.exit(1);
    }
  });

// Duplication detection commands
program
  .command('find-duplicates')
  .description('Find code duplications across the codebase')
  .option('--semantic', 'Include semantic duplications', false)
  .option('-t, --threshold <value>', 'Similarity threshold', '0.8')
  .option('--suggest-refactor', 'Include refactoring suggestions', false)
  .option('--project <path>', 'Project path', '.')
  .option('--output <format>', 'Output format (json|table)', 'table')
  .action(async (options: any) => {
    try {
      logger.info('Scanning for code duplications...');
      
      const results = await duplicationDetector.findDuplicates({
        projectPath: options.project,
        includeSemantic: options.semantic,
        similarityThreshold: parseFloat(options.threshold),
        includeRefactoringSuggestions: options.suggestRefactor
      });

      if (options.output === 'json') {
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log('\n🔍 Duplication Analysis Results:');
        console.log('─'.repeat(50));
        console.log(`Found ${results.duplicates.length} duplication groups`);
        
        results.duplicates.forEach((group, i) => {
          console.log(`\n${i + 1}. ${group.type} duplication (${group.similarity.toFixed(2)} similarity)`);
          console.log(`   Files: ${group.locations.map(l => l.file).join(', ')}`);
          
          if (group.refactoring && options.suggestRefactor) {
            console.log(`   💡 Suggestion: ${group.refactoring.approach}`);
            console.log(`   ⏱️  Estimated effort: ${group.refactoring.estimatedEffort}`);
          }
        });
      }

    } catch (error) {
      logger.error('Failed to find duplicates', error);
      process.exit(1);
    }
  });

// Tree navigation commands
program
  .command('tree')
  .description('Navigate project dependency tree')
  .option('-i, --interactive', 'Interactive navigation mode', false)
  .option('-f, --filter <pattern>', 'File filter pattern', '**/*.{ts,js,py}')
  .option('--show-deps', 'Show dependencies', false)
  .option('--circular', 'Show circular dependencies only', false)
  .option('--project <path>', 'Project path', '.')
  .action(async (options: any) => {
    try {
      logger.info('Building dependency tree...');
      
      const tree = await treeNavigator.buildTree({
        projectPath: options.project,
        filePattern: options.filter,
        showDependencies: options.showDeps,
        circularOnly: options.circular
      });

      if (options.interactive) {
        await treeNavigator.startInteractiveMode(tree);
      } else {
        console.log('\n🌲 Project Dependency Tree:');
        console.log('─'.repeat(50));
        treeNavigator.printTree(tree);
        
        if (tree.circularDependencies.length > 0) {
          console.log('\n⚠️  Circular Dependencies:');
          tree.circularDependencies.forEach((cycle, i) => {
            console.log(`${i + 1}. ${cycle.path.join(' → ')}`);
          });
        }
      }

    } catch (error) {
      logger.error('Failed to build tree', error);
      process.exit(1);
    }
  });

// Vector search commands
program
  .command('search')
  .description('Search code using semantic similarity')
  .argument('<query>', 'Search query')
  .option('--semantic', 'Use semantic search', true)
  .option('-l, --limit <number>', 'Number of results', '10')
  .option('--cross-project', 'Search across projects', false)
  .option('--project <path>', 'Project path', '.')
  .action(async (query: string, options: any) => {
    try {
      logger.info('Searching with vector similarity...');
      
      const results = await vectorSearch.search({
        query,
        projectPath: options.project,
        limit: parseInt(options.limit),
        crossProject: options.crossProject,
        useSemanticSearch: options.semantic
      });

      console.log('\n🔎 Search Results:');
      console.log('─'.repeat(50));
      
      results.matches.forEach((match, i) => {
        console.log(`\n${i + 1}. ${match.file}:${match.line} (${match.similarity.toFixed(3)} similarity)`);
        console.log(`   ${match.codeSnippet}`);
        if (match.context) {
          console.log(`   📝 Context: ${match.context}`);
        }
      });

    } catch (error) {
      logger.error('Failed to search', error);
      process.exit(1);
    }
  });

// Centralization detection commands
program
  .command('centralize-config')
  .description('Detect scattered configurations that can be centralized')
  .option('--scan', 'Scan for opportunities', false)
  .option('--suggest-migrations', 'Include migration suggestions', false)
  .option('--risk-assess', 'Include risk assessment', false)
  .option('--type <types>', 'Config types to check (comma-separated)')
  .option('--project <path>', 'Project path', '.')
  .action(async (options: any) => {
    try {
      logger.info('Scanning for centralization opportunities...');
      
      const results = await centralizationDetector.scanProject({
        projectPath: options.project,
        configTypes: options.type ? options.type.split(',') : undefined,
        includeMigrationPlan: options.suggestMigrations,
        includeRiskAssessment: options.riskAssess
      });

      console.log('\n🎯 Centralization Opportunities:');
      console.log('─'.repeat(50));
      
      results.opportunities.forEach((opp, i) => {
        console.log(`\n${i + 1}. ${opp.configType} (${opp.scatteredLocations.length} locations)`);
        console.log(`   Benefit score: ${opp.benefitScore.toFixed(2)}`);
        console.log(`   Complexity: ${opp.complexityScore.toFixed(2)}`);
        console.log(`   Locations: ${opp.scatteredLocations.map(l => l.file).join(', ')}`);
        
        if (opp.migrationPlan && options.suggestMigrations) {
          console.log(`   📋 Migration: ${opp.migrationPlan.approach}`);
          console.log(`   ⏱️  Estimated effort: ${opp.migrationPlan.estimatedEffort}`);
        }
      });

    } catch (error) {
      logger.error('Failed to detect centralization opportunities', error);
      process.exit(1);
    }
  });

// Git integration commands
program
  .command('git')
  .description('Git integration and auto-commit management')
  .addCommand(
    new Command('status')
      .description('Show Git integration status and recent commits')
      .option('--project <path>', 'Project path', '.')
      .action(async (options: any) => {
        try {
          const status = await gitIntegration.getIntegrationStatus(options.project);
          
          console.log('\n📊 Git Integration Status:');
          console.log('─'.repeat(50));
          console.log(`Repository: ${status.isRepository ? '✅ Valid' : '❌ Not a git repo'}`);
          console.log(`Auto-commit: ${status.autoCommitEnabled ? '✅ Enabled' : '❌ Disabled'}`);
          console.log(`Tracking: ${status.isTracking ? '🔍 Active' : '⏸️  Paused'}`);
          
          if (status.recentCommits.length > 0) {
            console.log('\n📝 Recent Commits:');
            status.recentCommits.forEach(commit => {
              console.log(`  ${commit.hash.substring(0, 8)} - ${commit.message} (${commit.timestamp.toLocaleDateString()})`);
            });
          }

        } catch (error) {
          logger.error('Failed to get Git status', error);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('analyze')
      .description('Analyze changes between commits')
      .option('--from <hash>', 'From commit hash', 'HEAD~1')
      .option('--to <hash>', 'To commit hash', 'HEAD')
      .option('--project <path>', 'Project path', '.')
      .action(async (options: any) => {
        try {
          logger.info(`Analyzing changes from ${options.from} to ${options.to}...`);
          
          const analysis = await gitIntegration.analyzeCommitRange(
            options.project,
            options.from,
            options.to
          );
          
          console.log('\n🔍 Change Analysis:');
          console.log('─'.repeat(50));
          console.log(`Significance Score: ${analysis.significanceScore.toFixed(2)}/5.0`);
          console.log(`Files Changed: ${analysis.filesChanged}`);
          console.log(`Lines Added: +${analysis.linesAdded}`);
          console.log(`Lines Deleted: -${analysis.linesDeleted}`);
          
          if (analysis.newFeatures.length > 0) {
            console.log(`\n✨ New Features Detected:`);
            analysis.newFeatures.forEach(feature => {
              console.log(`  • ${feature}`);
            });
          }

        } catch (error) {
          logger.error('Failed to analyze commits', error);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('enable-autocommit')
      .description('Enable automatic commits for significant changes')
      .option('--min-score <value>', 'Minimum significance score for auto-commit', '2.0')
      .option('--check-compilation', 'Only commit if code compiles', true)
      .option('--project <path>', 'Project path', '.')
      .action(async (options: any) => {
        try {
          logger.info('Enabling auto-commit system...');
          
          const rules = {
            enabled: true,
            minSignificanceScore: parseFloat(options.minScore),
            requiresCompilation: options.checkCompilation,
            watchPatterns: ['src/**/*', 'test/**/*', 'tests/**/*']
          };

          await gitIntegration.configureAutoCommit(options.project, rules);
          await gitIntegration.startAutoCommitWatcher();
          
          console.log('\n✅ Auto-commit system enabled');
          console.log(`• Minimum score: ${rules.minSignificanceScore}`);
          console.log(`• Compilation check: ${rules.requiresCompilation ? 'Yes' : 'No'}`);
          console.log('• File watcher started');

        } catch (error) {
          logger.error('Failed to enable auto-commit', error);
          process.exit(1);
        }
      })
  )
  .addCommand(
    new Command('disable-autocommit')
      .description('Disable automatic commits')
      .option('--project <path>', 'Project path', '.')
      .action(async (options: any) => {
        try {
          await gitIntegration.configureAutoCommit(options.project, { enabled: false });
          await gitIntegration.stopAutoCommitWatcher();
          
          console.log('✅ Auto-commit system disabled');

        } catch (error) {
          logger.error('Failed to disable auto-commit', error);
          process.exit(1);
        }
      })
  );

// Global options
program.option('-v, --verbose', 'Verbose logging', false);
program.option('--debug', 'Debug mode', false);

program.hook('preAction', (thisCommand) => {
  const options = thisCommand.opts();
  if (options.verbose) {
    logger.setLevel('info');
  }
  if (options.debug) {
    logger.setLevel('debug');
  }
});

// Parse CLI arguments
program.parse();

export { program };