#!/usr/bin/env node

/**
 * CodeMind Project Analysis Script
 *
 * Comprehensive project analysis including:
 * - Code quality metrics
 * - Complexity analysis
 * - Dependency mapping
 * - Architecture assessment
 *
 * Usage: node scripts/analyze.js [options]
 * Options:
 *   --type <type>    Analysis type: quality|complexity|dependencies|all (default: all)
 *   --output <path>  Output file for report (default: console)
 *   --format <fmt>   Output format: json|html|markdown (default: json)
 */

const path = require('path');
const fs = require('fs').promises;
const chalk = require('chalk');
const { Pool } = require('pg');

class ProjectAnalyzer {
  constructor(options = {}) {
    this.projectPath = options.projectPath || process.cwd();
    this.analysisType = options.type || 'all';
    this.outputPath = options.output;
    this.outputFormat = options.format || 'json';

    // Database configuration
    this.pgConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'codemind',
      user: process.env.DB_USER || 'codemind',
      password: process.env.DB_PASSWORD || 'codemind123'
    };

    this.pgPool = null;
    this.analysis = {
      timestamp: new Date().toISOString(),
      projectPath: this.projectPath,
      metrics: {},
      issues: [],
      recommendations: []
    };
  }

  async run() {
    console.log(chalk.blue.bold('📊 CodeMind Project Analysis'));
    console.log(chalk.gray(`Project: ${this.projectPath}`));
    console.log(chalk.gray(`Analysis type: ${this.analysisType}\n`));

    try {
      // Connect to database
      await this.connectDatabase();

      // Run selected analyses
      if (this.analysisType === 'all' || this.analysisType === 'quality') {
        await this.analyzeCodeQuality();
      }

      if (this.analysisType === 'all' || this.analysisType === 'complexity') {
        await this.analyzeComplexity();
      }

      if (this.analysisType === 'all' || this.analysisType === 'dependencies') {
        await this.analyzeDependencies();
      }

      if (this.analysisType === 'all' || this.analysisType === 'architecture') {
        await this.analyzeArchitecture();
      }

      // Generate insights
      await this.generateInsights();

      // Output results
      await this.outputResults();

      console.log(chalk.green.bold('\n✅ Analysis completed successfully!'));

      // Store in database
      await this.storeAnalysis();

    } catch (error) {
      console.error(chalk.red.bold('\n❌ Analysis failed:'), error.message);
      console.error(chalk.gray(error.stack));
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  async connectDatabase() {
    console.log(chalk.yellow('📡 Connecting to database...'));
    this.pgPool = new Pool(this.pgConfig);

    try {
      await this.pgPool.query('SELECT 1');
      console.log(chalk.green('  ✅ Database connected'));
    } catch (error) {
      console.log(chalk.yellow('  ⚠ Database not available - continuing without persistence'));
      this.pgPool = null;
    }
  }

  async analyzeCodeQuality() {
    console.log(chalk.yellow('\n🔍 Analyzing code quality...'));

    const metrics = {
      totalFiles: 0,
      totalLines: 0,
      commentRatio: 0,
      testCoverage: 0,
      lintingIssues: 0
    };

    // Scan source files
    const files = await this.scanSourceFiles();
    metrics.totalFiles = files.length;

    for (const file of files) {
      try {
        const content = await fs.readFile(file.fullPath, 'utf-8');
        const lines = content.split('\n');
        metrics.totalLines += lines.length;

        // Count comments
        const commentLines = lines.filter(line =>
          line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')
        ).length;
        metrics.commentRatio = (commentLines / lines.length) * 100;

        // Check for common issues
        if (content.includes('console.log') && !file.path.includes('test')) {
          this.analysis.issues.push({
            type: 'quality',
            severity: 'low',
            file: file.path,
            message: 'Console.log found in production code'
          });
        }

        if (content.includes('TODO') || content.includes('FIXME')) {
          this.analysis.issues.push({
            type: 'quality',
            severity: 'medium',
            file: file.path,
            message: 'Unresolved TODO/FIXME comments'
          });
        }

        // Check test files
        if (file.path.includes('.test.') || file.path.includes('.spec.')) {
          metrics.testCoverage++;
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    // Calculate test coverage ratio
    const nonTestFiles = files.filter(f =>
      !f.path.includes('.test.') && !f.path.includes('.spec.')
    ).length;
    metrics.testCoverage = (metrics.testCoverage / nonTestFiles) * 100;

    this.analysis.metrics.quality = metrics;
    console.log(chalk.green(`  ✅ Quality analysis complete`));
    console.log(chalk.gray(`     Files: ${metrics.totalFiles}`));
    console.log(chalk.gray(`     Lines: ${metrics.totalLines}`));
    console.log(chalk.gray(`     Test coverage: ${metrics.testCoverage.toFixed(1)}%`));
  }

  async analyzeComplexity() {
    console.log(chalk.yellow('\n📈 Analyzing code complexity...'));

    const complexity = {
      cyclomaticComplexity: [],
      deepNesting: [],
      longFunctions: [],
      largeFiles: []
    };

    const files = await this.scanSourceFiles();

    for (const file of files) {
      try {
        const content = await fs.readFile(file.fullPath, 'utf-8');
        const lines = content.split('\n');

        // Check file size
        if (lines.length > 500) {
          complexity.largeFiles.push({
            file: file.path,
            lines: lines.length
          });
        }

        // Analyze functions
        const functions = this.extractFunctions(content);
        for (const func of functions) {
          const funcLines = func.content.split('\n').length;

          // Long functions
          if (funcLines > 50) {
            complexity.longFunctions.push({
              file: file.path,
              function: func.name,
              lines: funcLines
            });
          }

          // Cyclomatic complexity (simplified)
          const ccScore = this.calculateCyclomaticComplexity(func.content);
          if (ccScore > 10) {
            complexity.cyclomaticComplexity.push({
              file: file.path,
              function: func.name,
              score: ccScore
            });
          }

          // Deep nesting
          const maxNesting = this.calculateMaxNesting(func.content);
          if (maxNesting > 4) {
            complexity.deepNesting.push({
              file: file.path,
              function: func.name,
              depth: maxNesting
            });
          }
        }
      } catch (error) {
        // Skip files that can't be analyzed
      }
    }

    this.analysis.metrics.complexity = complexity;

    // Add issues for high complexity
    if (complexity.cyclomaticComplexity.length > 0) {
      this.analysis.issues.push({
        type: 'complexity',
        severity: 'high',
        message: `${complexity.cyclomaticComplexity.length} functions with high cyclomatic complexity`
      });
    }

    console.log(chalk.green(`  ✅ Complexity analysis complete`));
    console.log(chalk.gray(`     Large files: ${complexity.largeFiles.length}`));
    console.log(chalk.gray(`     Long functions: ${complexity.longFunctions.length}`));
    console.log(chalk.gray(`     Complex functions: ${complexity.cyclomaticComplexity.length}`));
  }

  async analyzeDependencies() {
    console.log(chalk.yellow('\n🔗 Analyzing dependencies...'));

    const dependencies = {
      direct: {},
      dev: {},
      circular: [],
      outdated: [],
      security: []
    };

    // Read package.json
    try {
      const packagePath = path.join(this.projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf-8'));

      dependencies.direct = packageJson.dependencies || {};
      dependencies.dev = packageJson.devDependencies || {};

      console.log(chalk.gray(`     Direct dependencies: ${Object.keys(dependencies.direct).length}`));
      console.log(chalk.gray(`     Dev dependencies: ${Object.keys(dependencies.dev).length}`));

    } catch (error) {
      console.log(chalk.yellow('  ⚠ Could not read package.json'));
    }

    // Analyze import statements for circular dependencies
    const files = await this.scanSourceFiles();
    const importGraph = new Map();

    for (const file of files) {
      try {
        const content = await fs.readFile(file.fullPath, 'utf-8');
        const imports = this.extractImports(content);
        importGraph.set(file.path, imports);
      } catch (error) {
        // Skip
      }
    }

    // Check for circular dependencies
    for (const [file, imports] of importGraph) {
      for (const imp of imports) {
        if (importGraph.has(imp)) {
          const targetImports = importGraph.get(imp);
          if (targetImports.includes(file)) {
            dependencies.circular.push({
              file1: file,
              file2: imp
            });
          }
        }
      }
    }

    this.analysis.metrics.dependencies = dependencies;

    if (dependencies.circular.length > 0) {
      this.analysis.issues.push({
        type: 'dependencies',
        severity: 'high',
        message: `${dependencies.circular.length} circular dependencies detected`
      });
    }

    console.log(chalk.green(`  ✅ Dependency analysis complete`));
  }

  async analyzeArchitecture() {
    console.log(chalk.yellow('\n🏗️  Analyzing architecture...'));

    const architecture = {
      layers: {},
      patterns: [],
      violations: []
    };

    // Analyze folder structure
    const structure = await this.analyzeStructure();

    // Detect architectural patterns
    if (structure.folders.includes('src/controllers')) {
      architecture.patterns.push('MVC');
    }
    if (structure.folders.includes('src/services')) {
      architecture.patterns.push('Service Layer');
    }
    if (structure.folders.includes('src/repositories')) {
      architecture.patterns.push('Repository Pattern');
    }

    // Check for layer violations
    const files = await this.scanSourceFiles();

    for (const file of files) {
      // Check if UI layer imports from data layer directly
      if (file.path.includes('/ui/') || file.path.includes('/components/')) {
        try {
          const content = await fs.readFile(file.fullPath, 'utf-8');
          if (content.includes('from "../database') || content.includes('from "../repositories')) {
            architecture.violations.push({
              file: file.path,
              violation: 'UI layer directly accessing data layer'
            });
          }
        } catch (error) {
          // Skip
        }
      }
    }

    this.analysis.metrics.architecture = architecture;

    if (architecture.violations.length > 0) {
      this.analysis.issues.push({
        type: 'architecture',
        severity: 'high',
        message: `${architecture.violations.length} architectural violations found`
      });
    }

    console.log(chalk.green(`  ✅ Architecture analysis complete`));
    console.log(chalk.gray(`     Patterns detected: ${architecture.patterns.join(', ')}`));
    console.log(chalk.gray(`     Violations: ${architecture.violations.length}`));
  }

  async generateInsights() {
    console.log(chalk.yellow('\n💡 Generating insights...'));

    // Quality insights
    if (this.analysis.metrics.quality) {
      const { testCoverage, commentRatio } = this.analysis.metrics.quality;

      if (testCoverage < 50) {
        this.analysis.recommendations.push({
          category: 'testing',
          priority: 'high',
          message: 'Increase test coverage - currently at ' + testCoverage.toFixed(1) + '%'
        });
      }

      if (commentRatio < 10) {
        this.analysis.recommendations.push({
          category: 'documentation',
          priority: 'medium',
          message: 'Add more code documentation and comments'
        });
      }
    }

    // Complexity insights
    if (this.analysis.metrics.complexity) {
      const { longFunctions, largeFiles } = this.analysis.metrics.complexity;

      if (longFunctions.length > 5) {
        this.analysis.recommendations.push({
          category: 'refactoring',
          priority: 'high',
          message: `Refactor ${longFunctions.length} long functions into smaller, focused functions`
        });
      }

      if (largeFiles.length > 3) {
        this.analysis.recommendations.push({
          category: 'refactoring',
          priority: 'medium',
          message: `Split ${largeFiles.length} large files into smaller modules`
        });
      }
    }

    // Architecture insights
    if (this.analysis.metrics.architecture) {
      const { violations } = this.analysis.metrics.architecture;

      if (violations.length > 0) {
        this.analysis.recommendations.push({
          category: 'architecture',
          priority: 'high',
          message: 'Fix architectural layer violations to maintain clean architecture'
        });
      }
    }

    console.log(chalk.green(`  ✅ Generated ${this.analysis.recommendations.length} recommendations`));
  }

  async scanSourceFiles() {
    const files = [];
    const extensions = ['.ts', '.js', '.tsx', '.jsx'];
    const excludeDirs = ['node_modules', 'dist', 'build', '.git', 'coverage'];

    async function scan(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(this.projectPath, fullPath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          if (!excludeDirs.includes(entry.name) && !entry.name.startsWith('.')) {
            await scan.call(this, fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            files.push({
              path: relativePath,
              fullPath: fullPath,
              name: entry.name,
              extension: ext
            });
          }
        }
      }
    }

    await scan.call(this, this.projectPath);
    return files;
  }

  async analyzeStructure() {
    const structure = {
      folders: [],
      depth: 0
    };

    async function scan(dir, depth = 0) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      structure.depth = Math.max(structure.depth, depth);

      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(this.projectPath, fullPath).replace(/\\/g, '/');
          structure.folders.push(relativePath);

          if (depth < 5) { // Limit recursion depth
            await scan.call(this, fullPath, depth + 1);
          }
        }
      }
    }

    await scan.call(this, this.projectPath);
    return structure;
  }

  extractFunctions(content) {
    const functions = [];
    const functionRegex = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))/g;

    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      const name = match[1] || match[2];
      functions.push({
        name: name,
        content: content.substring(match.index, match.index + 500) // Simplified extraction
      });
    }

    return functions;
  }

  extractImports(content) {
    const imports = [];
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;

    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      if (importPath.startsWith('.')) {
        imports.push(importPath);
      }
    }

    return imports;
  }

  calculateCyclomaticComplexity(code) {
    // Simplified cyclomatic complexity calculation
    const keywords = ['if', 'else', 'for', 'while', 'case', 'catch', '&&', '||', '?'];
    let complexity = 1;

    for (const keyword of keywords) {
      const regex = new RegExp('\\b' + keyword + '\\b', 'g');
      const matches = code.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  calculateMaxNesting(code) {
    let maxNesting = 0;
    let currentNesting = 0;

    for (const char of code) {
      if (char === '{') {
        currentNesting++;
        maxNesting = Math.max(maxNesting, currentNesting);
      } else if (char === '}') {
        currentNesting--;
      }
    }

    return maxNesting;
  }

  async outputResults() {
    if (this.outputPath) {
      // Save to file
      let output;

      switch (this.outputFormat) {
        case 'json':
          output = JSON.stringify(this.analysis, null, 2);
          break;
        case 'markdown':
          output = this.formatAsMarkdown();
          break;
        case 'html':
          output = this.formatAsHtml();
          break;
        default:
          output = JSON.stringify(this.analysis, null, 2);
      }

      await fs.writeFile(this.outputPath, output);
      console.log(chalk.green(`\n📄 Report saved to: ${this.outputPath}`));
    } else {
      // Display to console
      this.displayReport();
    }
  }

  displayReport() {
    console.log(chalk.blue('\n📊 Analysis Report'));
    console.log(chalk.gray('=' .repeat(50)));

    // Issues
    if (this.analysis.issues.length > 0) {
      console.log(chalk.yellow('\n⚠️  Issues Found:'));
      this.analysis.issues.forEach(issue => {
        const color = issue.severity === 'high' ? chalk.red :
                      issue.severity === 'medium' ? chalk.yellow : chalk.gray;
        console.log(color(`  [${issue.severity.toUpperCase()}] ${issue.message}`));
        if (issue.file) {
          console.log(chalk.gray(`    File: ${issue.file}`));
        }
      });
    }

    // Recommendations
    if (this.analysis.recommendations.length > 0) {
      console.log(chalk.blue('\n💡 Recommendations:'));
      this.analysis.recommendations.forEach(rec => {
        const color = rec.priority === 'high' ? chalk.cyan :
                      rec.priority === 'medium' ? chalk.blue : chalk.gray;
        console.log(color(`  [${rec.priority.toUpperCase()}] ${rec.message}`));
      });
    }

    // Metrics summary
    console.log(chalk.blue('\n📈 Metrics Summary:'));
    console.log(chalk.gray(JSON.stringify(this.analysis.metrics, null, 2)));
  }

  formatAsMarkdown() {
    let md = '# CodeMind Analysis Report\n\n';
    md += `**Date:** ${this.analysis.timestamp}\n`;
    md += `**Project:** ${this.analysis.projectPath}\n\n`;

    // Add sections for issues, recommendations, and metrics
    // (Implementation simplified for brevity)

    return md;
  }

  formatAsHtml() {
    // Generate HTML report (simplified)
    return `<html><body><h1>Analysis Report</h1><pre>${JSON.stringify(this.analysis, null, 2)}</pre></body></html>`;
  }

  async storeAnalysis() {
    if (!this.pgPool) return;

    try {
      const query = `
        INSERT INTO code_analysis (project_id, analysis_type, results, created_at)
        SELECT id, $1, $2, CURRENT_TIMESTAMP
        FROM projects
        WHERE project_path = $3
      `;

      await this.pgPool.query(query, [
        this.analysisType,
        JSON.stringify(this.analysis),
        this.projectPath
      ]);

      console.log(chalk.green('  ✅ Analysis stored in database'));
    } catch (error) {
      console.log(chalk.yellow('  ⚠ Could not store analysis in database'));
    }
  }

  async cleanup() {
    if (this.pgPool) {
      await this.pgPool.end();
    }
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    type: 'all',
    output: null,
    format: 'json',
    projectPath: process.cwd()
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--type':
        if (args[i + 1]) {
          options.type = args[i + 1];
          i++;
        }
        break;
      case '--output':
        if (args[i + 1]) {
          options.output = args[i + 1];
          i++;
        }
        break;
      case '--format':
        if (args[i + 1]) {
          options.format = args[i + 1];
          i++;
        }
        break;
      case '--project-path':
        if (args[i + 1]) {
          options.projectPath = path.resolve(args[i + 1]);
          i++;
        }
        break;
      case '--help':
        console.log(chalk.cyan('CodeMind Project Analysis'));
        console.log(chalk.gray('\nUsage: node scripts/analyze.js [options]'));
        console.log(chalk.gray('\nOptions:'));
        console.log(chalk.gray('  --type <type>     Analysis type: quality|complexity|dependencies|all'));
        console.log(chalk.gray('  --output <path>   Output file path'));
        console.log(chalk.gray('  --format <fmt>    Output format: json|html|markdown'));
        console.log(chalk.gray('  --project-path    Project path'));
        console.log(chalk.gray('  --help            Show this help'));
        process.exit(0);
    }
  }

  return options;
}

// Run if called directly
if (require.main === module) {
  const options = parseArgs();
  const analyzer = new ProjectAnalyzer(options);
  analyzer.run().catch(error => {
    console.error(chalk.red.bold('Fatal error:'), error);
    process.exit(1);
  });
}

module.exports = { ProjectAnalyzer };