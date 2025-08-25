#!/usr/bin/env tsx
/**
 * Pre-commit hook for CodeMind Git integration
 * Runs code analysis before commits
 */

import { GitIntegration } from '../src/git/git-integration';
import { Logger, LogLevel } from '../src/utils/logger';
import { DuplicationDetector } from '../src/features/duplication/detector';
import * as path from 'path';

const logger = new Logger(LogLevel.INFO, 'PreCommit');

async function runPreCommitAnalysis(): Promise<boolean> {
  try {
    logger.info('🔍 Running pre-commit analysis...');
    
    const projectPath = process.cwd();
    const gitIntegration = new GitIntegration();
    const duplicationDetector = new DuplicationDetector();

    // Get staged files
    const stagedFiles = await gitIntegration.getStagedFiles(projectPath);
    
    if (stagedFiles.length === 0) {
      logger.info('ℹ️  No staged files found');
      return true;
    }

    logger.info(`📄 Analyzing ${stagedFiles.length} staged files...`);

    // Run duplication analysis on staged files
    const duplications = await duplicationDetector.findDuplicates({
      projectPath,
      includeSemantic: true,
      similarityThreshold: 0.8,
      includeRefactoringSuggestions: true
    });

    // Check for new duplications
    const newDuplications = duplications.duplicates.filter(dup => 
      dup.locations.some(loc => 
        stagedFiles.some(file => path.resolve(file).endsWith(path.resolve(loc.file)))
      )
    );

    if (newDuplications.length > 0) {
      logger.warn(`⚠️  Found ${newDuplications.length} new duplication groups in staged files:`);
      
      newDuplications.forEach((dup, i) => {
        logger.warn(`${i + 1}. ${dup.type} duplication (${dup.similarity.toFixed(2)} similarity)`);
        logger.warn(`   Files: ${dup.locations.map(l => l.file).join(', ')}`);
        
        if (dup.refactoring) {
          logger.warn(`   💡 Suggestion: ${dup.refactoring.approach}`);
        }
      });

      // Allow commit but warn user
      logger.warn('⚠️  Proceeding with commit despite duplications. Consider refactoring.');
    }

    // Analyze change significance
    const diff = await gitIntegration.getWorkingDirectoryDiff(projectPath);
    const significance = await gitIntegration.analyzeChangeSignificance(diff);

    logger.info(`📊 Change significance: ${significance.score.toFixed(2)}/5.0`);
    
    if (significance.score >= 3.0) {
      logger.info('✨ High-impact changes detected - good candidate for auto-commit tracking');
    }

    // Check compilation status if TypeScript project
    const hasPackageJson = require('fs').existsSync(path.join(projectPath, 'package.json'));
    const hasTsConfig = require('fs').existsSync(path.join(projectPath, 'tsconfig.json'));
    
    if (hasPackageJson && hasTsConfig) {
      try {
        logger.info('🔨 Checking TypeScript compilation...');
        
        const { execSync } = require('child_process');
        execSync('npx tsc --noEmit', { 
          cwd: projectPath, 
          stdio: 'pipe',
          timeout: 30000 
        });
        
        logger.info('✅ TypeScript compilation successful');
        
      } catch (error) {
        logger.error('❌ TypeScript compilation failed');
        logger.error('Please fix compilation errors before committing');
        return false;
      }
    }

    logger.info('✅ Pre-commit analysis completed successfully');
    return true;

  } catch (error) {
    logger.error('❌ Pre-commit analysis failed:', error);
    return false;
  }
}

async function main() {
  const success = await runPreCommitAnalysis();
  
  if (!success) {
    process.exit(1);
  }
  
  process.exit(0);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Pre-commit hook failed:', error);
    process.exit(1);
  });
}

export { runPreCommitAnalysis };