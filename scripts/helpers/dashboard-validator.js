#!/usr/bin/env node

/**
 * Dashboard Data Validation Helper
 * Validates that dashboard has sufficient data to display meaningful information
 */

const { Pool } = require('pg');
const chalk = require('chalk');

// PostgreSQL configuration
const config = {
  postgres: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'codemind',
    user: process.env.DB_USER || 'codemind',
    password: process.env.DB_PASSWORD || 'codemind123'
  }
};

// Tables that should have data for a complete dashboard experience
const CRITICAL_TABLES = [
  { name: 'projects', minRows: 1, description: 'Project registrations' },
  { name: 'tree_navigation_data', minRows: 5, description: 'File tree structure' },
  { name: 'detected_patterns', minRows: 3, description: 'Code patterns' },
  { name: 'analysis_results', minRows: 2, description: 'Analysis results' }
];

const OPTIONAL_TABLES = [
  { name: 'code_duplications', minRows: 1, description: 'Code duplication issues' },
  { name: 'centralization_opportunities', minRows: 1, description: 'Refactoring opportunities' },
  { name: 'test_coverage_data', minRows: 1, description: 'Test coverage metrics' },
  { name: 'compilation_results', minRows: 1, description: 'Build results' },
  { name: 'solid_violations', minRows: 1, description: 'SOLID principle violations' },
  { name: 'ui_components', minRows: 1, description: 'UI component analysis' },
  { name: 'use_cases', minRows: 1, description: 'Use case documentation' }
];

async function validateDashboardData(projectId = null) {
  const pgClient = new Pool(config.postgres);
  
  const validation = {
    isValid: false,
    tablesWithData: 0,
    criticalTablesMissing: 0,
    issues: [],
    warnings: [],
    tableStatus: {},
    projectSpecificData: false
  };
  
  try {
    console.log(chalk.blue('🔍 Validating dashboard data...'));
    
    // Check critical tables
    for (const table of CRITICAL_TABLES) {
      const status = await checkTableData(pgClient, table, projectId);
      validation.tableStatus[table.name] = status;
      
      if (status.hasData) {
        validation.tablesWithData++;
      } else {
        validation.criticalTablesMissing++;
        validation.issues.push(`Critical table '${table.name}' has insufficient data (${status.rowCount} < ${table.minRows})`);
      }
    }
    
    // Check optional tables
    for (const table of OPTIONAL_TABLES) {
      const status = await checkTableData(pgClient, table, projectId);
      validation.tableStatus[table.name] = status;
      
      if (status.hasData) {
        validation.tablesWithData++;
      } else {
        validation.warnings.push(`Optional table '${table.name}' has no data - some dashboard features may be limited`);
      }
    }
    
    // Check if we have project-specific data
    if (projectId) {
      const projectDataCount = await checkProjectSpecificData(pgClient, projectId);
      validation.projectSpecificData = projectDataCount > 0;
      validation.projectDataCount = projectDataCount;
    }
    
    // Overall validation
    validation.isValid = validation.criticalTablesMissing === 0;
    
    if (validation.isValid) {
      console.log(chalk.green(`✅ Dashboard validation passed: ${validation.tablesWithData} tables have data`));
    } else {
      console.log(chalk.yellow(`⚠️  Dashboard validation issues: ${validation.criticalTablesMissing} critical tables missing data`));
    }
    
    return validation;
    
  } catch (error) {
    console.log(chalk.red(`❌ Dashboard validation failed: ${error.message}`));
    return {
      isValid: false,
      error: error.message,
      issues: [`Validation failed: ${error.message}`]
    };
  } finally {
    await pgClient.end();
  }
}

async function checkTableData(pgClient, table, projectId) {
  try {
    let query = `SELECT COUNT(*) as count FROM ${table.name}`;
    let params = [];
    
    // Add project filter if applicable and projectId provided
    const projectFilterTables = [
      'tree_navigation_data', 'code_duplications', 'centralization_opportunities',
      'test_coverage_data', 'compilation_results', 'solid_violations',
      'ui_components', 'use_cases', 'detected_patterns', 'analysis_results'
    ];
    
    if (projectId && projectFilterTables.includes(table.name)) {
      query += ' WHERE project_id = $1';
      params = [projectId];
    }
    
    const result = await pgClient.query(query, params);
    const rowCount = parseInt(result.rows[0].count);
    
    return {
      exists: true,
      rowCount,
      hasData: rowCount >= table.minRows,
      description: table.description
    };
    
  } catch (error) {
    // Table might not exist
    return {
      exists: false,
      rowCount: 0,
      hasData: false,
      error: error.message,
      description: table.description
    };
  }
}

async function checkProjectSpecificData(pgClient, projectId) {
  const projectTables = [
    'tree_navigation_data',
    'code_duplications', 
    'centralization_opportunities',
    'test_coverage_data',
    'solid_violations',
    'analysis_results'
  ];
  
  let totalRecords = 0;
  
  for (const tableName of projectTables) {
    try {
      const result = await pgClient.query(`SELECT COUNT(*) as count FROM ${tableName} WHERE project_id = $1`, [projectId]);
      totalRecords += parseInt(result.rows[0].count);
    } catch (error) {
      // Skip tables that don't exist
    }
  }
  
  return totalRecords;
}

async function generateDataReport(projectId = null) {
  const validation = await validateDashboardData(projectId);
  
  console.log(chalk.bold.cyan('\n📊 DASHBOARD DATA REPORT'));
  console.log(chalk.cyan('═'.repeat(50)));
  
  // Overall status
  const status = validation.isValid ? chalk.green('✅ READY') : chalk.yellow('⚠️  NEEDS ATTENTION');
  console.log(`\nOverall Status: ${status}`);
  console.log(`Tables with Data: ${chalk.white(validation.tablesWithData)}`);
  
  if (projectId) {
    const projectStatus = validation.projectSpecificData ? chalk.green('Yes') : chalk.red('No');
    console.log(`Project-Specific Data: ${projectStatus} (${validation.projectDataCount || 0} records)`);
  }
  
  // Critical tables
  console.log(chalk.bold.yellow('\n🔴 CRITICAL TABLES:'));
  CRITICAL_TABLES.forEach(table => {
    const status = validation.tableStatus[table.name];
    if (status) {
      const statusIcon = status.hasData ? chalk.green('✅') : chalk.red('❌');
      const count = status.exists ? `${status.rowCount} rows` : 'not found';
      console.log(`   ${statusIcon} ${table.name.padEnd(25)}: ${count} - ${table.description}`);
    }
  });
  
  // Optional tables
  console.log(chalk.bold.yellow('\n🟡 OPTIONAL TABLES:'));
  OPTIONAL_TABLES.forEach(table => {
    const status = validation.tableStatus[table.name];
    if (status) {
      const statusIcon = status.hasData ? chalk.green('✅') : chalk.gray('⚪');
      const count = status.exists ? `${status.rowCount} rows` : 'not found';
      console.log(`   ${statusIcon} ${table.name.padEnd(25)}: ${count} - ${table.description}`);
    }
  });
  
  // Issues
  if (validation.issues.length > 0) {
    console.log(chalk.bold.red('\n❌ ISSUES:'));
    validation.issues.forEach(issue => {
      console.log(`   • ${issue}`);
    });
  }
  
  // Warnings
  if (validation.warnings.length > 0) {
    console.log(chalk.bold.yellow('\n⚠️  WARNINGS:'));
    validation.warnings.forEach(warning => {
      console.log(`   • ${warning}`);
    });
  }
  
  // Recommendations
  console.log(chalk.bold.cyan('\n💡 RECOMMENDATIONS:'));
  if (!validation.isValid) {
    console.log('   • Run: node scripts/init-project-master.js to populate missing data');
    console.log('   • Ensure all databases are running and accessible');
  }
  if (validation.warnings.length > 0) {
    console.log('   • Consider running comprehensive analysis to populate optional tables');
  }
  if (validation.isValid) {
    console.log('   • Dashboard is ready! Start with: npm run dashboard');
  }
  
  console.log(chalk.cyan('═'.repeat(50)));
  
  return validation;
}

module.exports = {
  validateDashboardData,
  generateDataReport,
  checkTableData,
  checkProjectSpecificData
};