#!/usr/bin/env node

/**
 * CodeMind SOLID Principles Analysis Script
 *
 * Analyzes code for SOLID principle violations:
 * - Single Responsibility Principle
 * - Open/Closed Principle
 * - Liskov Substitution Principle
 * - Interface Segregation Principle
 * - Dependency Inversion Principle
 *
 * Usage: node scripts/solid.js [options]
 * Options:
 *   --fix            Attempt automatic fixes where possible
 *   --report <path>  Save report to file
 */

const path = require('path');
const fs = require('fs').promises;
const chalk = require('chalk');

class SOLIDAnalyzer {
  constructor(options = {}) {
    this.projectPath = options.projectPath || process.cwd();
    this.autoFix = options.fix || false;
    this.reportPath = options.report;
    this.violations = [];
    this.fixes = [];
  }

  async run() {
    console.log(chalk.blue.bold('🔍 SOLID Principles Analysis'));
    console.log(chalk.gray(`Analyzing: ${this.projectPath}\n`));

    try {
      const files = await this.scanTypeScriptFiles();
      console.log(chalk.yellow(`📂 Found ${files.length} TypeScript files to analyze`));

      // Analyze each SOLID principle
      await this.checkSingleResponsibility(files);
      await this.checkOpenClosed(files);
      await this.checkLiskovSubstitution(files);
      await this.checkInterfaceSegregation(files);
      await this.checkDependencyInversion(files);

      // Generate report
      await this.generateReport();

      // Apply fixes if requested
      if (this.autoFix && this.fixes.length > 0) {
        await this.applyFixes();
      }

      console.log(chalk.green.bold('\n✅ SOLID analysis completed!'));

    } catch (error) {
      console.error(chalk.red.bold('\n❌ Analysis failed:'), error.message);
      process.exit(1);
    }
  }

  async scanTypeScriptFiles() {
    const files = [];
    const excludeDirs = ['node_modules', 'dist', 'build', '.git'];

    async function scan(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(this.projectPath, fullPath);

        if (entry.isDirectory()) {
          if (!excludeDirs.includes(entry.name) && !entry.name.startsWith('.')) {
            await scan.call(this, fullPath);
          }
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          files.push({ path: relativePath, fullPath });
        }
      }
    }

    await scan.call(this, this.projectPath);
    return files;
  }

  async checkSingleResponsibility(files) {
    console.log(chalk.yellow('\n📏 Checking Single Responsibility Principle...'));
    let violations = 0;

    for (const file of files) {
      try {
        const content = await fs.readFile(file.fullPath, 'utf-8');
        const classes = this.extractClasses(content);

        for (const cls of classes) {
          const responsibilities = this.countResponsibilities(cls.content);

          if (responsibilities > 1) {
            this.violations.push({
              principle: 'SRP',
              file: file.path,
              class: cls.name,
              message: `Class has ${responsibilities} responsibilities (should have 1)`,
              severity: 'high'
            });
            violations++;
          }
        }
      } catch (error) {
        // Skip files that can't be analyzed
      }
    }

    console.log(violations > 0
      ? chalk.red(`  ❌ Found ${violations} SRP violations`)
      : chalk.green('  ✅ No SRP violations found'));
  }

  async checkOpenClosed(files) {
    console.log(chalk.yellow('\n🔒 Checking Open/Closed Principle...'));
    let violations = 0;

    for (const file of files) {
      try {
        const content = await fs.readFile(file.fullPath, 'utf-8');

        // Check for switch statements on types
        if (content.includes('switch') && content.includes('instanceof')) {
          this.violations.push({
            principle: 'OCP',
            file: file.path,
            message: 'Switch statement on type checking - consider polymorphism',
            severity: 'medium'
          });
          violations++;
        }

        // Check for modification instead of extension
        if (content.match(/class\s+\w+\s*{[^}]*\bif\s*\([^)]*type[^)]*\)/)) {
          this.violations.push({
            principle: 'OCP',
            file: file.path,
            message: 'Type checking in class - violates open/closed principle',
            severity: 'medium'
          });
          violations++;
        }
      } catch (error) {
        // Skip
      }
    }

    console.log(violations > 0
      ? chalk.red(`  ❌ Found ${violations} OCP violations`)
      : chalk.green('  ✅ No OCP violations found'));
  }

  async checkLiskovSubstitution(files) {
    console.log(chalk.yellow('\n🔄 Checking Liskov Substitution Principle...'));
    let violations = 0;

    for (const file of files) {
      try {
        const content = await fs.readFile(file.fullPath, 'utf-8');

        // Check for method overrides that change behavior
        if (content.match(/override.*throw\s+new\s+Error/)) {
          this.violations.push({
            principle: 'LSP',
            file: file.path,
            message: 'Override throws error - breaks substitutability',
            severity: 'high'
          });
          violations++;
        }

        // Check for type narrowing in overrides
        if (content.match(/override.*:\s*\w+\s*&/)) {
          this.violations.push({
            principle: 'LSP',
            file: file.path,
            message: 'Override narrows return type',
            severity: 'medium'
          });
          violations++;
        }
      } catch (error) {
        // Skip
      }
    }

    console.log(violations > 0
      ? chalk.red(`  ❌ Found ${violations} LSP violations`)
      : chalk.green('  ✅ No LSP violations found'));
  }

  async checkInterfaceSegregation(files) {
    console.log(chalk.yellow('\n✂️  Checking Interface Segregation Principle...'));
    let violations = 0;

    for (const file of files) {
      try {
        const content = await fs.readFile(file.fullPath, 'utf-8');
        const interfaces = this.extractInterfaces(content);

        for (const iface of interfaces) {
          const methodCount = (iface.content.match(/\w+\s*\(/g) || []).length;

          if (methodCount > 5) {
            this.violations.push({
              principle: 'ISP',
              file: file.path,
              interface: iface.name,
              message: `Interface has ${methodCount} methods (consider splitting)`,
              severity: 'medium'
            });
            violations++;
          }
        }
      } catch (error) {
        // Skip
      }
    }

    console.log(violations > 0
      ? chalk.red(`  ❌ Found ${violations} ISP violations`)
      : chalk.green('  ✅ No ISP violations found'));
  }

  async checkDependencyInversion(files) {
    console.log(chalk.yellow('\n🔀 Checking Dependency Inversion Principle...'));
    let violations = 0;

    for (const file of files) {
      try {
        const content = await fs.readFile(file.fullPath, 'utf-8');

        // Check for concrete class dependencies
        if (content.match(/constructor\s*\([^)]*new\s+\w+/)) {
          this.violations.push({
            principle: 'DIP',
            file: file.path,
            message: 'Constructor creates concrete dependencies - use injection',
            severity: 'high'
          });
          violations++;
        }

        // Check for direct imports from implementation layers
        if (file.path.includes('/domain/') && content.match(/from\s+['"]\.\.\/(data|infrastructure)/)) {
          this.violations.push({
            principle: 'DIP',
            file: file.path,
            message: 'Domain layer depends on infrastructure',
            severity: 'high'
          });
          violations++;
        }
      } catch (error) {
        // Skip
      }
    }

    console.log(violations > 0
      ? chalk.red(`  ❌ Found ${violations} DIP violations`)
      : chalk.green('  ✅ No DIP violations found'));
  }

  extractClasses(content) {
    const classes = [];
    const classRegex = /class\s+(\w+)[\s\S]*?{([\s\S]*?)^}/gm;

    let match;
    while ((match = classRegex.exec(content)) !== null) {
      classes.push({
        name: match[1],
        content: match[2]
      });
    }

    return classes;
  }

  extractInterfaces(content) {
    const interfaces = [];
    const interfaceRegex = /interface\s+(\w+)[\s\S]*?{([\s\S]*?)^}/gm;

    let match;
    while ((match = interfaceRegex.exec(content)) !== null) {
      interfaces.push({
        name: match[1],
        content: match[2]
      });
    }

    return interfaces;
  }

  countResponsibilities(classContent) {
    // Simplified: count distinct method prefixes
    const methodPrefixes = new Set();
    const methodRegex = /(\w+)\s*\(/g;

    let match;
    while ((match = methodRegex.exec(classContent)) !== null) {
      const method = match[1];
      const prefix = method.replace(/([A-Z])/g, '_$1').split('_')[1]?.toLowerCase();
      if (prefix) methodPrefixes.add(prefix);
    }

    return methodPrefixes.size;
  }

  async generateReport() {
    console.log(chalk.blue('\n📊 SOLID Analysis Report'));
    console.log(chalk.gray('=' .repeat(50)));

    const summary = {
      SRP: this.violations.filter(v => v.principle === 'SRP').length,
      OCP: this.violations.filter(v => v.principle === 'OCP').length,
      LSP: this.violations.filter(v => v.principle === 'LSP').length,
      ISP: this.violations.filter(v => v.principle === 'ISP').length,
      DIP: this.violations.filter(v => v.principle === 'DIP').length
    };

    console.log(chalk.yellow('\n📈 Summary:'));
    Object.entries(summary).forEach(([principle, count]) => {
      const color = count === 0 ? chalk.green : count < 3 ? chalk.yellow : chalk.red;
      console.log(color(`  ${principle}: ${count} violations`));
    });

    if (this.violations.length > 0) {
      console.log(chalk.yellow('\n⚠️  Violations:'));
      this.violations.slice(0, 10).forEach(v => {
        const color = v.severity === 'high' ? chalk.red : chalk.yellow;
        console.log(color(`  [${v.principle}] ${v.file}`));
        console.log(chalk.gray(`    ${v.message}`));
      });

      if (this.violations.length > 10) {
        console.log(chalk.gray(`  ... and ${this.violations.length - 10} more`));
      }
    }

    console.log(chalk.blue('\n💡 Recommendations:'));
    console.log(chalk.cyan('  • Refactor large classes into smaller, focused ones'));
    console.log(chalk.cyan('  • Use dependency injection instead of creating dependencies'));
    console.log(chalk.cyan('  • Split large interfaces into role-specific ones'));
    console.log(chalk.cyan('  • Depend on abstractions, not concrete implementations'));

    if (this.reportPath) {
      await fs.writeFile(this.reportPath, JSON.stringify({
        summary,
        violations: this.violations,
        timestamp: new Date().toISOString()
      }, null, 2));
      console.log(chalk.green(`\n📄 Report saved to: ${this.reportPath}`));
    }
  }

  async applyFixes() {
    console.log(chalk.yellow('\n🔧 Applying automatic fixes...'));
    console.log(chalk.gray('(Full auto-fix implementation pending)'));
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    fix: false,
    report: null,
    projectPath: process.cwd()
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--fix':
        options.fix = true;
        break;
      case '--report':
        if (args[i + 1]) {
          options.report = args[i + 1];
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
        console.log(chalk.cyan('SOLID Principles Analysis'));
        console.log(chalk.gray('\nUsage: node scripts/solid.js [options]'));
        console.log(chalk.gray('\nOptions:'));
        console.log(chalk.gray('  --fix           Attempt automatic fixes'));
        console.log(chalk.gray('  --report <path> Save report to file'));
        console.log(chalk.gray('  --help          Show this help'));
        process.exit(0);
    }
  }

  return options;
}

// Run if called directly
if (require.main === module) {
  const options = parseArgs();
  const analyzer = new SOLIDAnalyzer(options);
  analyzer.run().catch(error => {
    console.error(chalk.red.bold('Fatal error:'), error);
    process.exit(1);
  });
}

module.exports = { SOLIDAnalyzer };