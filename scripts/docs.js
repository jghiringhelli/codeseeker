#!/usr/bin/env node

/**
 * CodeMind Documentation Management Script
 *
 * Generates, ingests, and manages project documentation
 * Supports markdown, API docs, and code documentation
 *
 * Usage: node scripts/docs.js [command] [options]
 * Commands:
 *   generate  Generate documentation from code
 *   ingest    Ingest external documentation
 *   search    Search documentation
 */

const path = require('path');
const fs = require('fs').promises;
const chalk = require('chalk');
const { Pool } = require('pg');

class DocumentationManager {
  constructor(options = {}) {
    this.command = options.command || 'generate';
    this.projectPath = options.projectPath || process.cwd();
    this.outputPath = options.output || path.join(this.projectPath, 'docs');

    this.pgConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'codemind',
      user: process.env.DB_USER || 'codemind',
      password: process.env.DB_PASSWORD || 'codemind123'
    };

    this.pgPool = null;
  }

  async run() {
    console.log(chalk.blue.bold('📚 CodeMind Documentation Manager'));
    console.log(chalk.gray(`Command: ${this.command}\n`));

    try {
      await this.connectDatabase();

      switch (this.command) {
        case 'generate':
          await this.generateDocs();
          break;
        case 'ingest':
          await this.ingestDocs();
          break;
        case 'search':
          await this.searchDocs();
          break;
        default:
          console.log(chalk.red(`Unknown command: ${this.command}`));
          this.showHelp();
      }

      console.log(chalk.green.bold('\n✅ Documentation task completed!'));

    } catch (error) {
      console.error(chalk.red.bold('\n❌ Task failed:'), error.message);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }

  async connectDatabase() {
    this.pgPool = new Pool(this.pgConfig);
    try {
      await this.pgPool.query('SELECT 1');
    } catch (error) {
      console.log(chalk.yellow('⚠ Database not available - some features disabled'));
      this.pgPool = null;
    }
  }

  async generateDocs() {
    console.log(chalk.yellow('📝 Generating documentation...'));

    // Ensure output directory exists
    await fs.mkdir(this.outputPath, { recursive: true });

    // Generate different types of documentation
    await this.generateAPIDoc();
    await this.generateReadme();
    await this.generateCodeDocs();

    console.log(chalk.green(`✅ Documentation generated in ${this.outputPath}`));
  }

  async generateAPIDoc() {
    console.log(chalk.gray('  Generating API documentation...'));

    const apiDoc = {
      title: 'CodeMind API Documentation',
      version: '1.0.0',
      endpoints: [],
      generated: new Date().toISOString()
    };

    // Scan for API routes
    const files = await this.scanFiles(['src/api', 'src/routes']);

    for (const file of files) {
      try {
        const content = await fs.readFile(file.fullPath, 'utf-8');
        const routes = this.extractRoutes(content);

        routes.forEach(route => {
          apiDoc.endpoints.push({
            method: route.method,
            path: route.path,
            file: file.path,
            description: route.description || 'No description available'
          });
        });
      } catch (error) {
        // Skip files that can't be parsed
      }
    }

    // Write API documentation
    const apiDocPath = path.join(this.outputPath, 'api.md');
    let markdown = `# ${apiDoc.title}\n\n`;
    markdown += `Version: ${apiDoc.version}\n`;
    markdown += `Generated: ${apiDoc.generated}\n\n`;
    markdown += `## Endpoints\n\n`;

    apiDoc.endpoints.forEach(endpoint => {
      markdown += `### ${endpoint.method} ${endpoint.path}\n`;
      markdown += `${endpoint.description}\n`;
      markdown += `Source: ${endpoint.file}\n\n`;
    });

    await fs.writeFile(apiDocPath, markdown);
    console.log(chalk.green(`    ✅ API docs: ${apiDocPath}`));
  }

  async generateReadme() {
    console.log(chalk.gray('  Generating README documentation...'));

    const packagePath = path.join(this.projectPath, 'package.json');
    let packageInfo = {};

    try {
      packageInfo = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
    } catch (error) {
      packageInfo = { name: 'CodeMind', version: '1.0.0' };
    }

    const readme = `# ${packageInfo.name}

${packageInfo.description || 'Intelligent Code Analysis System'}

## Installation

\`\`\`bash
npm install
npm run setup
npm run init
\`\`\`

## Commands

- \`/setup\` - Initialize database containers
- \`/init\` - Initialize project data
- \`/analyze\` - Run project analysis
- \`/dedup\` - Find duplicate code
- \`/solid\` - Check SOLID principles
- \`/sync\` - Sync project changes
- \`/docs\` - Manage documentation
- \`/help\` - Show help

## Configuration

Configure databases in \`.env\`:

\`\`\`env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=codemind
DB_USER=codemind
DB_PASSWORD=codemind123
NEO4J_URI=bolt://localhost:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=codemind123
\`\`\`

## License

${packageInfo.license || 'MIT'}
`;

    const readmePath = path.join(this.outputPath, 'README.md');
    await fs.writeFile(readmePath, readme);
    console.log(chalk.green(`    ✅ README: ${readmePath}`));
  }

  async generateCodeDocs() {
    console.log(chalk.gray('  Generating code documentation...'));

    const codeDoc = {
      classes: [],
      functions: [],
      interfaces: []
    };

    const files = await this.scanFiles(['src']);

    for (const file of files) {
      if (file.extension === '.ts' || file.extension === '.tsx') {
        try {
          const content = await fs.readFile(file.fullPath, 'utf-8');

          // Extract JSDoc comments and definitions
          const classes = this.extractClasses(content);
          const functions = this.extractFunctions(content);
          const interfaces = this.extractInterfaces(content);

          codeDoc.classes.push(...classes.map(c => ({ ...c, file: file.path })));
          codeDoc.functions.push(...functions.map(f => ({ ...f, file: file.path })));
          codeDoc.interfaces.push(...interfaces.map(i => ({ ...i, file: file.path })));
        } catch (error) {
          // Skip files that can't be parsed
        }
      }
    }

    // Write code documentation
    const codeDocPath = path.join(this.outputPath, 'code-reference.md');
    let markdown = '# Code Reference\n\n';

    if (codeDoc.classes.length > 0) {
      markdown += '## Classes\n\n';
      codeDoc.classes.forEach(cls => {
        markdown += `### ${cls.name}\n`;
        markdown += `File: ${cls.file}\n\n`;
      });
    }

    if (codeDoc.interfaces.length > 0) {
      markdown += '## Interfaces\n\n';
      codeDoc.interfaces.forEach(iface => {
        markdown += `### ${iface.name}\n`;
        markdown += `File: ${iface.file}\n\n`;
      });
    }

    await fs.writeFile(codeDocPath, markdown);
    console.log(chalk.green(`    ✅ Code docs: ${codeDocPath}`));
  }

  async ingestDocs() {
    console.log(chalk.yellow('📥 Ingesting documentation...'));

    const docsToIngest = await this.findDocumentationFiles();
    console.log(chalk.gray(`  Found ${docsToIngest.length} documentation files`));

    if (this.pgPool) {
      // Get or create project
      const projectResult = await this.pgPool.query(
        'SELECT id FROM projects WHERE project_path = $1',
        [this.projectPath]
      );

      if (projectResult.rows.length === 0) {
        console.log(chalk.yellow('  Project not initialized - skipping database storage'));
        return;
      }

      const projectId = projectResult.rows[0].id;
      let ingested = 0;

      for (const doc of docsToIngest) {
        try {
          const content = await fs.readFile(doc.fullPath, 'utf-8');

          // Store in database
          await this.pgPool.query(`
            INSERT INTO project_documentation (project_id, file_path, content, doc_type, created_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            ON CONFLICT (project_id, file_path)
            DO UPDATE SET content = $3, updated_at = CURRENT_TIMESTAMP
          `, [projectId, doc.path, content, doc.type]);

          ingested++;
        } catch (error) {
          console.log(chalk.yellow(`  ⚠ Skipped ${doc.path}: ${error.message}`));
        }
      }

      console.log(chalk.green(`  ✅ Ingested ${ingested} documentation files`));
    } else {
      console.log(chalk.yellow('  Database not available - documentation not stored'));
    }
  }

  async searchDocs() {
    const query = this.searchQuery || '';
    console.log(chalk.yellow(`🔍 Searching documentation for: "${query}"`));

    if (!this.pgPool) {
      console.log(chalk.red('Database not available - cannot search'));
      return;
    }

    const result = await this.pgPool.query(`
      SELECT file_path,
             substring(content,
                      GREATEST(1, position(LOWER($1) in LOWER(content)) - 100),
                      200) as snippet
      FROM project_documentation
      WHERE project_id IN (SELECT id FROM projects WHERE project_path = $2)
        AND LOWER(content) LIKE LOWER('%' || $1 || '%')
      LIMIT 10
    `, [query, this.projectPath]);

    if (result.rows.length === 0) {
      console.log(chalk.gray('  No results found'));
    } else {
      console.log(chalk.green(`  Found ${result.rows.length} results:\n`));
      result.rows.forEach(row => {
        console.log(chalk.cyan(`  📄 ${row.file_path}`));
        console.log(chalk.gray(`     ...${row.snippet}...\n`));
      });
    }
  }

  async findDocumentationFiles() {
    const docs = [];
    const docPatterns = ['README', 'CHANGELOG', 'LICENSE', 'CONTRIBUTING'];
    const docExtensions = ['.md', '.txt', '.rst', '.adoc'];

    async function scan(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(this.projectPath, fullPath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
          if (entry.name === 'docs' || entry.name === 'documentation') {
            await scan.call(this, fullPath);
          } else if (!entry.name.startsWith('.') &&
                     !['node_modules', 'dist', 'build'].includes(entry.name)) {
            // Check for docs in subdirectories
            await scan.call(this, fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          const nameUpper = entry.name.toUpperCase();

          if (docExtensions.includes(ext) ||
              docPatterns.some(pattern => nameUpper.includes(pattern))) {
            docs.push({
              path: relativePath,
              fullPath: fullPath,
              name: entry.name,
              type: ext === '.md' ? 'markdown' : 'text'
            });
          }
        }
      }
    }

    await scan.call(this, this.projectPath);
    return docs;
  }

  async scanFiles(directories) {
    const files = [];

    for (const dir of directories) {
      const dirPath = path.join(this.projectPath, dir);

      try {
        await fs.access(dirPath);
        await this.scanDirectory(dirPath, files);
      } catch (error) {
        // Directory doesn't exist
      }
    }

    return files;
  }

  async scanDirectory(dir, files) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(this.projectPath, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        await this.scanDirectory(fullPath, files);
      } else if (entry.isFile()) {
        files.push({
          path: relativePath,
          fullPath: fullPath,
          name: entry.name,
          extension: path.extname(entry.name)
        });
      }
    }
  }

  extractRoutes(content) {
    const routes = [];
    const routeRegex = /\.(get|post|put|patch|delete|use)\s*\(\s*['"`]([^'"`]+)['"`]/g;

    let match;
    while ((match = routeRegex.exec(content)) !== null) {
      routes.push({
        method: match[1].toUpperCase(),
        path: match[2]
      });
    }

    return routes;
  }

  extractClasses(content) {
    const classes = [];
    const classRegex = /(?:export\s+)?class\s+(\w+)/g;

    let match;
    while ((match = classRegex.exec(content)) !== null) {
      classes.push({ name: match[1] });
    }

    return classes;
  }

  extractFunctions(content) {
    const functions = [];
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;

    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      functions.push({ name: match[1] });
    }

    return functions;
  }

  extractInterfaces(content) {
    const interfaces = [];
    const interfaceRegex = /(?:export\s+)?interface\s+(\w+)/g;

    let match;
    while ((match = interfaceRegex.exec(content)) !== null) {
      interfaces.push({ name: match[1] });
    }

    return interfaces;
  }

  showHelp() {
    console.log(chalk.cyan('\nUsage: node scripts/docs.js [command] [options]'));
    console.log(chalk.gray('\nCommands:'));
    console.log(chalk.gray('  generate  Generate documentation from code'));
    console.log(chalk.gray('  ingest    Ingest external documentation'));
    console.log(chalk.gray('  search    Search documentation'));
    console.log(chalk.gray('\nOptions:'));
    console.log(chalk.gray('  --output <path>  Output directory for generated docs'));
    console.log(chalk.gray('  --query <text>   Search query for search command'));
  }

  async cleanup() {
    if (this.pgPool) await this.pgPool.end();
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    command: args[0] || 'generate',
    output: null,
    searchQuery: null,
    projectPath: process.cwd()
  };

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--output':
        if (args[i + 1]) {
          options.output = args[i + 1];
          i++;
        }
        break;
      case '--query':
        if (args[i + 1]) {
          options.searchQuery = args[i + 1];
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
        const manager = new DocumentationManager(options);
        manager.showHelp();
        process.exit(0);
    }
  }

  return options;
}

// Run if called directly
if (require.main === module) {
  const options = parseArgs();
  const manager = new DocumentationManager(options);
  manager.run().catch(error => {
    console.error(chalk.red.bold('Fatal error:'), error);
    process.exit(1);
  });
}

module.exports = { DocumentationManager };