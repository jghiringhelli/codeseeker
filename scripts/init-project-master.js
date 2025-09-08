#!/usr/bin/env node

/**
 * CodeMind Master Project Initialization Script
 * 
 * This is the single entry point for initializing any CodeMind project.
 * It consolidates all initialization functionality including:
 * - Database initialization (PostgreSQL, MongoDB, Neo4j, Redis, DuckDB)
 * - Project registration and analysis
 * - Tool autodiscovery and setup
 * - Semantic graph population
 * - Dashboard data preparation
 * 
 * Usage:
 *   node scripts/init-project-master.js [PROJECT_PATH] [PROJECT_NAME]
 *   
 * Environment variables:
 *   PROJECT_PATH - Path to the project directory (default: current directory)
 *   PROJECT_NAME - Name of the project (default: directory name)
 *   RESET_PROJECT - Set to 'true' to reinitialize existing project data
 */

const path = require('path');
const fs = require('fs').promises;
const chalk = require('chalk');

// Import helper modules
const { main: initializeDatabases, testConnections } = require('./helpers/database-init');
const { initializeProjectData } = require('./helpers/project-init');
const { runComprehensiveAnalysis } = require('./helpers/analysis-runner');
const { validateDashboardData } = require('./helpers/dashboard-validator');

// Configuration from command line and environment
const config = {
  projectPath: process.argv[2] || process.env.PROJECT_PATH || process.cwd(),
  projectName: process.argv[3] || process.env.PROJECT_NAME || path.basename(process.cwd()),
  resetProject: process.env.RESET_PROJECT === 'true',
  skipAnalysis: process.env.SKIP_ANALYSIS === 'true',
  verbose: process.env.VERBOSE === 'true'
};

// Global status tracking
const masterStatus = {
  startTime: Date.now(),
  phases: {},
  errors: [],
  warnings: [],
  projectId: null,
  databasesReady: false,
  projectRegistered: false,
  analysisComplete: false,
  dashboardReady: false
};

// Helper functions
function logPhase(name, status, details = '') {
  const timestamp = new Date().toISOString();
  const statusIcon = status === 'start' ? '🔄' : status === 'success' ? '✅' : status === 'error' ? '❌' : '⚠️';
  
  console.log(chalk.cyan(`[${timestamp}] ${statusIcon} ${name}${details ? ': ' + details : ''}`));
  
  if (!masterStatus.phases[name]) {
    masterStatus.phases[name] = {};
  }
  masterStatus.phases[name][status] = timestamp;
  
  if (status === 'error') {
    masterStatus.errors.push({ phase: name, details, timestamp });
  }
  if (status === 'warning') {
    masterStatus.warnings.push({ phase: name, details, timestamp });
  }
}

async function validateProject() {
  logPhase('Project Validation', 'start');
  
  try {
    // Check if project path exists
    const stats = await fs.stat(config.projectPath);
    if (!stats.isDirectory()) {
      throw new Error(`Project path is not a directory: ${config.projectPath}`);
    }
    
    // Check if it's a valid project (has package.json or recognizable structure)
    const projectFiles = await fs.readdir(config.projectPath);
    const hasPackageJson = projectFiles.includes('package.json');
    const hasSourceCode = projectFiles.some(file => 
      file.includes('src') || file.includes('lib') || file.endsWith('.js') || file.endsWith('.ts')
    );
    
    if (!hasPackageJson && !hasSourceCode) {
      logPhase('Project Validation', 'warning', 'No package.json or source code detected');
    }
    
    // Get project stats
    const sourceFiles = [];
    async function scanDirectory(dir, depth = 0) {
      if (depth > 5) return; // Limit depth
      
      const items = await fs.readdir(dir);
      for (const item of items) {
        if (item.startsWith('.') || item === 'node_modules' || item === 'dist') continue;
        
        const itemPath = path.join(dir, item);
        const stat = await fs.stat(itemPath);
        
        if (stat.isDirectory()) {
          await scanDirectory(itemPath, depth + 1);
        } else if (/\.(js|ts|py|java|go|rs|cpp|c)$/.test(item)) {
          sourceFiles.push(itemPath);
        }
      }
    }
    
    await scanDirectory(config.projectPath);
    
    logPhase('Project Validation', 'success', `Found ${sourceFiles.length} source files`);
    
    return {
      isValid: true,
      stats: {
        totalFiles: sourceFiles.length,
        hasPackageJson,
        projectSize: sourceFiles.length > 1000 ? 'large' : sourceFiles.length > 100 ? 'medium' : 'small'
      }
    };
    
  } catch (error) {
    logPhase('Project Validation', 'error', error.message);
    throw error;
  }
}

async function initializeDatabasesStep() {
  logPhase('Database Initialization', 'start');
  
  try {
    // Test connections first
    const connections = await testConnections();
    const connectedDbs = Object.values(connections).filter(Boolean).length;
    
    if (connectedDbs === 0) {
      throw new Error('No databases are available. Please ensure at least PostgreSQL is running.');
    }
    
    logPhase('Database Initialization', 'info', `${connectedDbs}/4 databases connected`);
    
    // Initialize all connected databases
    await initializeDatabases();
    
    masterStatus.databasesReady = true;
    logPhase('Database Initialization', 'success', `${connectedDbs} databases initialized`);
    
    return { success: true, connectedDbs };
    
  } catch (error) {
    logPhase('Database Initialization', 'error', error.message);
    throw error;
  }
}

async function registerProjectStep(projectStats) {
  logPhase('Project Registration', 'start');
  
  try {
    const projectData = await initializeProjectData({
      projectPath: config.projectPath,
      projectName: config.projectName,
      resetProject: config.resetProject,
      projectStats
    });
    
    if (!projectData.projectId) {
      throw new Error('Failed to register project - no project ID returned');
    }
    
    masterStatus.projectId = projectData.projectId;
    masterStatus.projectRegistered = true;
    
    logPhase('Project Registration', 'success', `Project ID: ${projectData.projectId}`);
    
    return projectData;
    
  } catch (error) {
    logPhase('Project Registration', 'error', error.message);
    throw error;
  }
}

async function runAnalysisStep() {
  if (config.skipAnalysis) {
    logPhase('Analysis', 'warning', 'Skipped by user request');
    return { skipped: true };
  }
  
  logPhase('Comprehensive Analysis', 'start');
  
  try {
    const analysisResult = await runComprehensiveAnalysis({
      projectPath: config.projectPath,
      projectId: masterStatus.projectId,
      projectName: config.projectName
    });
    
    masterStatus.analysisComplete = true;
    
    const recordsCreated = analysisResult.totalRecordsCreated || 0;
    logPhase('Comprehensive Analysis', 'success', `${recordsCreated} records created`);
    
    return analysisResult;
    
  } catch (error) {
    logPhase('Comprehensive Analysis', 'error', error.message);
    // Don't throw - analysis failure shouldn't stop the whole process
    return { failed: true, error: error.message };
  }
}

async function validateDashboardStep() {
  logPhase('Dashboard Validation', 'start');
  
  try {
    const validation = await validateDashboardData(masterStatus.projectId);
    
    if (validation.isValid) {
      masterStatus.dashboardReady = true;
      logPhase('Dashboard Validation', 'success', `${validation.tablesWithData} tables populated`);
    } else {
      logPhase('Dashboard Validation', 'warning', `${validation.issues.length} issues found`);
    }
    
    return validation;
    
  } catch (error) {
    logPhase('Dashboard Validation', 'error', error.message);
    return { isValid: false, error: error.message };
  }
}

function generateFinalReport(projectStats, analysisResult, dashboardValidation) {
  const duration = Date.now() - masterStatus.startTime;
  
  console.log(chalk.bold.cyan('\n' + '═'.repeat(80)));
  console.log(chalk.bold.cyan('🎯 CODEMIND PROJECT INITIALIZATION REPORT'));
  console.log(chalk.bold.cyan('═'.repeat(80)));
  
  // Project info
  console.log(chalk.bold.yellow('\n📁 PROJECT INFORMATION:'));
  console.log(`   Name: ${chalk.white(config.projectName)}`);
  console.log(`   Path: ${chalk.white(config.projectPath)}`);
  console.log(`   ID: ${chalk.white(masterStatus.projectId || 'Not assigned')}`);
  console.log(`   Size: ${chalk.white(projectStats?.projectSize || 'Unknown')} (${projectStats?.totalFiles || 0} files)`);
  
  // Phase status
  console.log(chalk.bold.yellow('\n⚡ EXECUTION PHASES:'));
  Object.entries(masterStatus.phases).forEach(([phase, statuses]) => {
    const hasSuccess = statuses.success;
    const hasError = statuses.error;
    const status = hasError ? chalk.red('❌ FAILED') : hasSuccess ? chalk.green('✅ SUCCESS') : chalk.yellow('⚠️ PARTIAL');
    console.log(`   ${phase.padEnd(25)}: ${status}`);
  });
  
  // Key metrics
  console.log(chalk.bold.yellow('\n📊 KEY METRICS:'));
  console.log(`   Databases Ready: ${masterStatus.databasesReady ? chalk.green('Yes') : chalk.red('No')}`);
  console.log(`   Project Registered: ${masterStatus.projectRegistered ? chalk.green('Yes') : chalk.red('No')}`);
  console.log(`   Analysis Complete: ${masterStatus.analysisComplete ? chalk.green('Yes') : chalk.red('No')}`);
  console.log(`   Dashboard Ready: ${masterStatus.dashboardReady ? chalk.green('Yes') : chalk.red('No')}`);
  console.log(`   Total Duration: ${chalk.white(Math.round(duration / 1000))}s`);
  
  // Analysis results
  if (analysisResult && !analysisResult.skipped && !analysisResult.failed) {
    console.log(chalk.bold.yellow('\n🧠 ANALYSIS RESULTS:'));
    console.log(`   Records Created: ${chalk.white(analysisResult.totalRecordsCreated || 0)}`);
    console.log(`   Tools Initialized: ${chalk.white(analysisResult.toolsInitialized || 0)}`);
    if (analysisResult.semanticGraphNodes) {
      console.log(`   Graph Nodes: ${chalk.white(analysisResult.semanticGraphNodes)}`);
    }
  }
  
  // Dashboard validation
  if (dashboardValidation) {
    console.log(chalk.bold.yellow('\n📊 DASHBOARD STATUS:'));
    if (dashboardValidation.isValid) {
      console.log(`   Status: ${chalk.green('✅ Ready')}`);
      console.log(`   Tables with Data: ${chalk.white(dashboardValidation.tablesWithData || 0)}`);
    } else {
      console.log(`   Status: ${chalk.yellow('⚠️ Issues Found')}`);
      if (dashboardValidation.issues) {
        dashboardValidation.issues.forEach(issue => {
          console.log(`   • ${chalk.yellow(issue)}`);
        });
      }
    }
  }
  
  // Errors and warnings
  if (masterStatus.errors.length > 0) {
    console.log(chalk.bold.red('\n❌ ERRORS:'));
    masterStatus.errors.forEach(error => {
      console.log(`   [${error.phase}] ${chalk.red(error.details)}`);
    });
  }
  
  if (masterStatus.warnings.length > 0) {
    console.log(chalk.bold.yellow('\n⚠️ WARNINGS:'));
    masterStatus.warnings.forEach(warning => {
      console.log(`   [${warning.phase}] ${chalk.yellow(warning.details)}`);
    });
  }
  
  // Next steps
  console.log(chalk.bold.yellow('\n🚀 NEXT STEPS:'));
  if (masterStatus.dashboardReady) {
    console.log(chalk.green('   ✅ Your project is ready! Start the dashboard:'));
    console.log(chalk.white('      npm run dashboard'));
    console.log(chalk.white('      # or'));
    console.log(chalk.white('      docker-compose up dashboard'));
    console.log(chalk.white('      # then visit: http://localhost:3005'));
  } else if (masterStatus.projectRegistered) {
    console.log(chalk.yellow('   ⚠️ Project registered but dashboard needs attention'));
    console.log(chalk.white('      Check dashboard logs and retry initialization'));
  } else {
    console.log(chalk.red('   ❌ Initialization incomplete'));
    console.log(chalk.white('      Review errors above and ensure databases are running'));
  }
  
  console.log(chalk.bold.cyan('\n═'.repeat(80)));
  
  // Return overall success status
  return {
    success: masterStatus.dashboardReady,
    projectId: masterStatus.projectId,
    errors: masterStatus.errors,
    warnings: masterStatus.warnings
  };
}

// Main execution
async function main() {
  console.log(chalk.bold.cyan('\n🚀 CODEMIND MASTER PROJECT INITIALIZATION'));
  console.log(chalk.bold.cyan('════════════════════════════════════════════\n'));
  
  console.log(chalk.blue('Configuration:'));
  console.log(chalk.gray(`  Project Path: ${config.projectPath}`));
  console.log(chalk.gray(`  Project Name: ${config.projectName}`));
  console.log(chalk.gray(`  Reset Project: ${config.resetProject}`));
  console.log(chalk.gray(`  Skip Analysis: ${config.skipAnalysis}\n`));
  
  try {
    // Phase 1: Validate project
    const projectStats = await validateProject();
    
    // Phase 2: Initialize databases
    await initializeDatabasesStep();
    
    // Phase 3: Register project
    const projectData = await registerProjectStep(projectStats.stats);
    
    // Phase 4: Run comprehensive analysis
    const analysisResult = await runAnalysisStep();
    
    // Phase 5: Validate dashboard data
    const dashboardValidation = await validateDashboardStep();
    
    // Generate final report
    const report = generateFinalReport(projectStats.stats, analysisResult, dashboardValidation);
    
    // Exit with appropriate code
    process.exit(report.success ? 0 : 1);
    
  } catch (error) {
    console.error(chalk.bold.red('\n💥 FATAL ERROR:'));
    console.error(chalk.red(error.message));
    if (config.verbose && error.stack) {
      console.error(chalk.gray(error.stack));
    }
    
    masterStatus.errors.push({
      phase: 'Fatal',
      details: error.message,
      timestamp: new Date().toISOString()
    });
    
    generateFinalReport({}, {}, {});
    process.exit(1);
  }
}

// Export for testing
module.exports = { main, masterStatus, config };

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.bold.red('Unhandled error:'), error);
    process.exit(1);
  });
}