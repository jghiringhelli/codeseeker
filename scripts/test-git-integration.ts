#!/usr/bin/env tsx
/**
 * Test script for Git integration system
 */

import { GitIntegration } from '../src/git/git-integration';
import { Logger, LogLevel } from '../src/utils/logger';

async function testGitIntegration() {
  const logger = new Logger(LogLevel.INFO, 'GitTest');
  
  try {
    logger.info('🧪 Testing Git Integration System...');
    
    const projectPath = process.cwd();
    const gitIntegration = new GitIntegration(projectPath);
    
    // Test 1: Check if this is a Git repository
    logger.info('📁 Test 1: Checking repository status...');
    const isRepo = await gitIntegration.isGitRepository();
    logger.info(`Repository status: ${isRepo ? '✅ Valid Git repo' : '❌ Not a Git repo'}`);
    
    if (!isRepo) {
      logger.warn('Skipping Git-specific tests - not a repository');
      return;
    }

    // Test 2: Get recent commits
    logger.info('📜 Test 2: Fetching recent commits...');
    const recentCommits = await gitIntegration.getCommitsSince('HEAD~3');
    logger.info(`Found ${recentCommits.length} recent commits:`);
    recentCommits.slice(0, 2).forEach(commit => {
      logger.info(`  ${commit.shortHash} - ${commit.message.split('\n')[0]} (${commit.author})`);
    });

    // Test 3: Analyze changes between commits
    if (recentCommits.length >= 2) {
      logger.info('🔍 Test 3: Analyzing changes between commits...');
      const oldCommit = recentCommits[recentCommits.length - 1];
      const newCommit = recentCommits[0];
      
      const diff = await gitIntegration.getDiffBetweenCommits(oldCommit.hash, newCommit.hash);
      logger.info(`Changes between ${oldCommit.shortHash} and ${newCommit.shortHash}:`);
      logger.info(`  Files changed: ${diff.length}`);
      
      if (diff.length > 0) {
        const significance = await gitIntegration.analyzeChangeSignificance(diff);
        logger.info(`  Significance score: ${significance.score.toFixed(2)}/5.0`);
        logger.info(`  Factors: ${significance.factors.map(f => f.type).join(', ')}`);
      }
    }

    // Test 4: Check working directory changes
    logger.info('📝 Test 4: Checking working directory changes...');
    const workingDiff = await gitIntegration.getWorkingDirectoryDiff(projectPath);
    if (workingDiff.length > 0) {
      logger.info(`Working directory has ${workingDiff.length} changed files:`);
      workingDiff.slice(0, 3).forEach(change => {
        logger.info(`  ${change.status} ${change.file}`);
      });
      
      const workingSignificance = await gitIntegration.analyzeChangeSignificance(workingDiff);
      logger.info(`Working changes significance: ${workingSignificance.score.toFixed(2)}/5.0`);
      
      if (workingSignificance.commitMessage) {
        logger.info(`Generated commit message: "${workingSignificance.commitMessage.split('\n')[0]}"`);
      }
    } else {
      logger.info('  No working directory changes detected');
    }

    // Test 5: Test compilation check
    logger.info('🔨 Test 5: Testing compilation check...');
    const compiles = await gitIntegration.compilesSuccessfully();
    logger.info(`Compilation status: ${compiles ? '✅ Success' : '❌ Failed'}`);

    // Test 6: Test database operations
    logger.info('💾 Test 6: Testing database operations...');
    try {
      await gitIntegration.updateDatabaseFromGitHistory();
      logger.info('Database update completed successfully');
    } catch (error) {
      logger.warn('Database update failed (expected if no database setup):', error);
    }

    logger.info('✅ Git integration tests completed!');

  } catch (error) {
    logger.error('❌ Git integration test failed:', error);
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  testGitIntegration().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

export { testGitIntegration };