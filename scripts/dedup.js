#!/usr/bin/env node

/**
 * CodeMind Duplicate Detection Script
 *
 * Finds and analyzes code duplication across the project
 * Identifies redundant implementations, similar functions, and repeated patterns
 *
 * Usage: node scripts/dedup.js [options]
 * Options:
 *   --threshold <number>  Similarity threshold (0.0-1.0, default: 0.8)
 *   --merge               Interactive merge mode for duplicates
 *   --report              Generate detailed report only
 *   --project-path <path> Specify project path (defaults to current directory)
 */

const path = require('path');
const fs = require('fs').promises;
const chalk = require('chalk');
const crypto = require('crypto');

class DuplicateDetector {
  constructor(options = {}) {
    this.projectPath = options.projectPath || process.cwd();
    this.threshold = options.threshold || 0.8;
    this.mergeMode = options.merge || false;
    this.reportOnly = options.report || false;
    this.duplicates = new Map();
    this.similarities = [];
  }

  async run() {
    console.log(chalk.blue.bold('🔍 CodeMind Duplicate Detection'));
    console.log(chalk.gray(`Analyzing project at: ${this.projectPath}`));
    console.log(chalk.gray(`Similarity threshold: ${this.threshold * 100}%\n`));

    try {
      // Scan project files
      const files = await this.scanProjectFiles();
      console.log(chalk.yellow(`📂 Found ${files.length} files to analyze`));

      // Analyze for duplicates
      await this.detectDuplicates(files);

      // Find similar code blocks
      await this.findSimilarities(files);

      // Generate report
      const report = await this.generateReport();

      // Display results
      await this.displayResults(report);

      // Handle merge mode if enabled
      if (this.mergeMode && !this.reportOnly) {
        await this.interactiveMerge();
      }

      // Save report if requested
      if (this.reportOnly) {
        await this.saveReport(report);
      }

      console.log(chalk.green.bold('\n✅ Duplicate detection completed!'));

    } catch (error) {
      console.error(chalk.red.bold('\n❌ Detection failed:'), error.message);
      console.error(chalk.gray(error.stack));
      process.exit(1);
    }
  }

  async scanProjectFiles() {
    const files = [];
    const extensions = ['.ts', '.js', '.tsx', '.jsx'];
    const excludeDirs = ['node_modules', 'dist', 'build', '.git', 'coverage'];

    async function scan(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(this.projectPath, fullPath);

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

  async detectDuplicates(files) {
    console.log(chalk.yellow('\n🔎 Detecting exact duplicates...'));

    const fileHashes = new Map();

    for (const file of files) {
      try {
        const content = await fs.readFile(file.fullPath, 'utf-8');

        // Create hash of normalized content (remove whitespace variations)
        const normalizedContent = this.normalizeCode(content);
        const hash = crypto.createHash('md5').update(normalizedContent).digest('hex');

        if (fileHashes.has(hash)) {
          // Found duplicate
          if (!this.duplicates.has(hash)) {
            this.duplicates.set(hash, [fileHashes.get(hash)]);
          }
          this.duplicates.get(hash).push(file);
        } else {
          fileHashes.set(hash, file);
        }
      } catch (error) {
        console.log(chalk.gray(`  Skipped ${file.path}: ${error.message}`));
      }
    }

    const duplicateCount = this.duplicates.size;
    if (duplicateCount > 0) {
      console.log(chalk.yellow(`  Found ${duplicateCount} sets of duplicate files`));
    } else {
      console.log(chalk.green('  No exact duplicates found'));
    }
  }

  async findSimilarities(files) {
    console.log(chalk.yellow('\n🔍 Finding similar code blocks...'));

    const functionPatterns = [];
    const classPatterns = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(file.fullPath, 'utf-8');

        // Extract functions and classes
        const functions = this.extractFunctions(content);
        const classes = this.extractClasses(content);

        functions.forEach(func => {
          functionPatterns.push({
            file: file.path,
            name: func.name,
            content: func.content,
            lines: func.lines
          });
        });

        classes.forEach(cls => {
          classPatterns.push({
            file: file.path,
            name: cls.name,
            content: cls.content,
            lines: cls.lines
          });
        });
      } catch (error) {
        // Skip files that can't be read
      }
    }

    // Compare functions for similarity
    for (let i = 0; i < functionPatterns.length; i++) {
      for (let j = i + 1; j < functionPatterns.length; j++) {
        const similarity = this.calculateSimilarity(
          functionPatterns[i].content,
          functionPatterns[j].content
        );

        if (similarity >= this.threshold) {
          this.similarities.push({
            type: 'function',
            item1: functionPatterns[i],
            item2: functionPatterns[j],
            similarity: similarity
          });
        }
      }
    }

    // Compare classes for similarity
    for (let i = 0; i < classPatterns.length; i++) {
      for (let j = i + 1; j < classPatterns.length; j++) {
        const similarity = this.calculateSimilarity(
          classPatterns[i].content,
          classPatterns[j].content
        );

        if (similarity >= this.threshold) {
          this.similarities.push({
            type: 'class',
            item1: classPatterns[i],
            item2: classPatterns[j],
            similarity: similarity
          });
        }
      }
    }

    console.log(chalk.yellow(`  Found ${this.similarities.length} similar code blocks`));
  }

  normalizeCode(content) {
    // Remove comments, extra whitespace, and normalize formatting
    return content
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
      .replace(/\/\/.*/g, '') // Remove line comments
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  extractFunctions(content) {
    const functions = [];
    const functionRegex = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))/g;

    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      const name = match[1] || match[2];
      const startIndex = match.index;

      // Extract function body (simplified - would need proper parsing for production)
      const endIndex = this.findBlockEnd(content, startIndex);

      functions.push({
        name: name,
        content: content.substring(startIndex, endIndex),
        lines: content.substring(0, startIndex).split('\n').length
      });
    }

    return functions;
  }

  extractClasses(content) {
    const classes = [];
    const classRegex = /class\s+(\w+)/g;

    let match;
    while ((match = classRegex.exec(content)) !== null) {
      const name = match[1];
      const startIndex = match.index;

      // Extract class body
      const endIndex = this.findBlockEnd(content, startIndex);

      classes.push({
        name: name,
        content: content.substring(startIndex, endIndex),
        lines: content.substring(0, startIndex).split('\n').length
      });
    }

    return classes;
  }

  findBlockEnd(content, startIndex) {
    let braceCount = 0;
    let inBlock = false;

    for (let i = startIndex; i < content.length; i++) {
      if (content[i] === '{') {
        braceCount++;
        inBlock = true;
      } else if (content[i] === '}') {
        braceCount--;
        if (inBlock && braceCount === 0) {
          return i + 1;
        }
      }
    }

    return content.length;
  }

  calculateSimilarity(str1, str2) {
    // Simple Levenshtein distance-based similarity
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0 || len2 === 0) return 0;

    const maxLen = Math.max(len1, len2);
    const distance = this.levenshteinDistance(str1, str2);

    return 1 - (distance / maxLen);
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  async generateReport() {
    const report = {
      summary: {
        filesAnalyzed: 0,
        exactDuplicates: this.duplicates.size,
        similarBlocks: this.similarities.length,
        estimatedSavings: 0
      },
      duplicates: [],
      similarities: []
    };

    // Process exact duplicates
    for (const [hash, files] of this.duplicates) {
      const fileList = files.map(f => f.path);
      report.duplicates.push({
        files: fileList,
        count: files.length
      });

      // Estimate savings (keep one, remove others)
      report.summary.estimatedSavings += files.length - 1;
    }

    // Process similarities
    report.similarities = this.similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 20) // Top 20 similarities
      .map(sim => ({
        type: sim.type,
        similarity: Math.round(sim.similarity * 100),
        item1: `${sim.item1.file}:${sim.item1.name}`,
        item2: `${sim.item2.file}:${sim.item2.name}`
      }));

    return report;
  }

  async displayResults(report) {
    console.log(chalk.blue('\n📊 Duplication Analysis Report'));
    console.log(chalk.gray('=' .repeat(50)));

    // Summary
    console.log(chalk.yellow('\n📈 Summary:'));
    console.log(`  Exact duplicate sets: ${report.summary.exactDuplicates}`);
    console.log(`  Similar code blocks: ${report.summary.similarBlocks}`);
    console.log(`  Potential files to remove: ${report.summary.estimatedSavings}`);

    // Exact duplicates
    if (report.duplicates.length > 0) {
      console.log(chalk.yellow('\n🔄 Exact Duplicates:'));
      report.duplicates.forEach((dup, index) => {
        console.log(chalk.red(`\n  Duplicate Set ${index + 1}:`));
        dup.files.forEach(file => {
          console.log(chalk.gray(`    - ${file}`));
        });
      });
    }

    // Similar code blocks
    if (report.similarities.length > 0) {
      console.log(chalk.yellow('\n🔍 Similar Code Blocks:'));
      report.similarities.forEach(sim => {
        console.log(chalk.cyan(`\n  ${sim.type} similarity: ${sim.similarity}%`));
        console.log(chalk.gray(`    ${sim.item1}`));
        console.log(chalk.gray(`    ${sim.item2}`));
      });
    }

    // Recommendations
    console.log(chalk.blue('\n💡 Recommendations:'));
    if (report.summary.exactDuplicates > 0) {
      console.log(chalk.cyan('  • Review and merge exact duplicate files'));
    }
    if (report.summary.similarBlocks > 5) {
      console.log(chalk.cyan('  • Consider extracting common functionality into shared utilities'));
    }
    console.log(chalk.cyan('  • Run with --merge flag for interactive consolidation'));
  }

  async interactiveMerge() {
    console.log(chalk.yellow('\n🔧 Interactive Merge Mode'));
    console.log(chalk.gray('This feature would guide you through merging duplicates'));
    console.log(chalk.gray('(Full implementation pending)'));
  }

  async saveReport(report) {
    const reportPath = path.join(this.projectPath, 'duplication-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(chalk.green(`\n📄 Report saved to: ${reportPath}`));
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    threshold: 0.8,
    merge: false,
    report: false,
    projectPath: process.cwd()
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--threshold':
        if (args[i + 1]) {
          options.threshold = parseFloat(args[i + 1]);
          i++;
        }
        break;
      case '--merge':
        options.merge = true;
        break;
      case '--report':
        options.report = true;
        break;
      case '--project-path':
        if (args[i + 1]) {
          options.projectPath = path.resolve(args[i + 1]);
          i++;
        }
        break;
      case '--help':
        console.log(chalk.cyan('CodeMind Duplicate Detection'));
        console.log(chalk.gray('\nUsage: node scripts/dedup.js [options]'));
        console.log(chalk.gray('\nOptions:'));
        console.log(chalk.gray('  --threshold <number>  Similarity threshold (0.0-1.0)'));
        console.log(chalk.gray('  --merge               Interactive merge mode'));
        console.log(chalk.gray('  --report              Generate report only'));
        console.log(chalk.gray('  --project-path <path> Project path'));
        console.log(chalk.gray('  --help                Show this help'));
        process.exit(0);
    }
  }

  return options;
}

// Run if called directly
if (require.main === module) {
  const options = parseArgs();
  const detector = new DuplicateDetector(options);
  detector.run().catch(error => {
    console.error(chalk.red.bold('Fatal error:'), error);
    process.exit(1);
  });
}

module.exports = { DuplicateDetector };