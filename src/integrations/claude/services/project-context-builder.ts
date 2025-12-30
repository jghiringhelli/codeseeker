/**
 * Project Context Builder - SOLID Principles Implementation
 * Single Responsibility: Build comprehensive project context for Claude Code
 * Open/Closed: Extensible for different context types
 * Interface Segregation: Focused interface for context building only
 */

import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../../../utils/logger';
import { PlatformUtils } from '../../../shared/platform-utils';

export interface ProjectContext {
  structure: string;
  configurations: string;
  recentChanges: string | null;
  documentation: string | null;
  summary: string;
}

export interface IProjectContextBuilder {
  buildProjectContext(projectPath: string): Promise<ProjectContext>;
  getProjectStructure(projectPath: string): Promise<string>;
  getKeyConfigurations(projectPath: string): Promise<string>;
  getRecentChanges(projectPath: string): Promise<string | null>;
  getProjectDocumentation(projectPath: string): Promise<string | null>;
}

export class ProjectContextBuilder implements IProjectContextBuilder {
  private logger: Logger;

  constructor() {
    this.logger = Logger.getInstance().child('ProjectContextBuilder');
  }

  async buildProjectContext(projectPath: string): Promise<ProjectContext> {
    this.logger.debug('📋 Building project context');

    const [structure, configurations, recentChanges, documentation] = await Promise.all([
      this.getProjectStructure(projectPath),
      this.getKeyConfigurations(projectPath),
      this.getRecentChanges(projectPath),
      this.getProjectDocumentation(projectPath)
    ]);

    const summary = this.createContextSummary(structure, configurations, recentChanges, documentation);

    return {
      structure,
      configurations,
      recentChanges,
      documentation,
      summary
    };
  }

  async getProjectStructure(projectPath: string): Promise<string> {
    try {
      // Use tree command if available, otherwise fall back to basic directory listing
      const platformInfo = PlatformUtils.getPlatformInfo();
      const treeCommand = platformInfo.platform.includes('win32') ? 'tree /f' : 'tree -a';

      try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        const result = await execAsync(`${treeCommand} "${projectPath}"`, {
          timeout: 10000, // 10 second timeout
          cwd: projectPath
        });

        return result.stdout || 'Project structure not available';
      } catch (treeError) {
        // Fall back to basic file listing
        this.logger.debug('Tree command failed, falling back to basic listing');
        return await this.getBasicDirectoryListing(projectPath);
      }
    } catch (error) {
      this.logger.warn(`Failed to get project structure: ${error}`);
      return 'Project structure unavailable';
    }
  }

  async getKeyConfigurations(projectPath: string): Promise<string> {
    const configFiles = [
      'package.json',
      'tsconfig.json',
      'jest.config.js',
      'webpack.config.js',
      'vite.config.js',
      'babel.config.js',
      'eslint.config.js',
      '.eslintrc.js',
      '.eslintrc.json',
      'prettier.config.js',
      '.prettierrc',
      'docker-compose.yml',
      'Dockerfile',
      'README.md',
      'CLAUDE.md'
    ];

    const configs: string[] = [];

    for (const configFile of configFiles) {
      const configPath = path.join(projectPath, configFile);
      try {
        if (fs.existsSync(configPath)) {
          const content = await fs.promises.readFile(configPath, 'utf-8');

          // Truncate very large files
          const truncated = content.length > 2000 ? content.substring(0, 2000) + '\\n... [truncated]' : content;

          configs.push(`=== ${configFile} ===\\n${truncated}\\n`);
        }
      } catch (error) {
        this.logger.debug(`Failed to read ${configFile}: ${error}`);
      }
    }

    return configs.length > 0 ? configs.join('\\n') : 'No key configuration files found';
  }

  async getRecentChanges(projectPath: string): Promise<string | null> {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);

      // Get recent git commits
      const result = await execAsync(
        'git log --oneline --decorate --graph -10',
        {
          cwd: projectPath,
          timeout: 5000
        }
      );

      return result.stdout || null;
    } catch (error) {
      this.logger.debug('Git log not available or failed');
      return null;
    }
  }

  async getProjectDocumentation(projectPath: string): Promise<string | null> {
    const docFiles = ['README.md', 'CLAUDE.md', 'docs/README.md', 'DOCUMENTATION.md'];

    for (const docFile of docFiles) {
      const docPath = path.join(projectPath, docFile);
      try {
        if (fs.existsSync(docPath)) {
          const content = await fs.promises.readFile(docPath, 'utf-8');

          // Truncate very large documentation
          const truncated = content.length > 3000 ? content.substring(0, 3000) + '\\n... [truncated]' : content;

          return `=== ${docFile} ===\\n${truncated}`;
        }
      } catch (error) {
        this.logger.debug(`Failed to read ${docFile}: ${error}`);
      }
    }

    return null;
  }

  private async getBasicDirectoryListing(projectPath: string): Promise<string> {
    try {
      const items = await fs.promises.readdir(projectPath, { withFileTypes: true });
      const structure: string[] = [];

      // Sort directories first, then files
      const directories = items.filter(item => item.isDirectory()).map(item => item.name);
      const files = items.filter(item => item.isFile()).map(item => item.name);

      structure.push(`📁 ${path.basename(projectPath)}/`);

      for (const dir of directories.sort()) {
        structure.push(`  📁 ${dir}/`);

        // Get a few files from each directory for context
        try {
          const subItems = await fs.promises.readdir(path.join(projectPath, dir));
          const subFiles = subItems.filter(item => !item.startsWith('.')).slice(0, 3);

          for (const subFile of subFiles) {
            structure.push(`    📄 ${subFile}`);
          }

          if (subItems.length > 3) {
            structure.push(`    ... and ${subItems.length - 3} more files`);
          }
        } catch (error) {
          // Ignore directory access errors
        }
      }

      for (const file of files.sort()) {
        structure.push(`  📄 ${file}`);
      }

      return structure.join('\\n');
    } catch (error) {
      this.logger.warn(`Failed to get basic directory listing: ${error}`);
      return 'Directory listing unavailable';
    }
  }

  private createContextSummary(
    structure: string,
    configurations: string,
    recentChanges: string | null,
    documentation: string | null
  ): string {
    const parts: string[] = [
      '🏗️ PROJECT CONTEXT SUMMARY',
      '='.repeat(50)
    ];

    // Analyze project type from structure and configs
    const projectType = this.detectProjectType(structure, configurations);
    if (projectType) {
      parts.push(`📦 Project Type: ${projectType}`);
    }

    // Key technologies
    const technologies = this.detectTechnologies(configurations);
    if (technologies.length > 0) {
      parts.push(`🔧 Technologies: ${technologies.join(', ')}`);
    }

    // File count estimate
    const fileCount = (structure.match(/📄/g) || []).length;
    if (fileCount > 0) {
      parts.push(`📊 Estimated Files: ~${fileCount}`);
    }

    // Recent activity
    if (recentChanges) {
      const commitCount = (recentChanges.split('\\n') || []).length - 1;
      parts.push(`🔄 Recent Commits: ${commitCount} recent changes`);
    }

    // Documentation status
    if (documentation) {
      parts.push(`📚 Documentation: Available`);
    } else {
      parts.push(`📚 Documentation: Limited or none found`);
    }

    return parts.join('\\n');
  }

  private detectProjectType(structure: string, configurations: string): string | null {
    if (configurations.includes('package.json')) {
      if (configurations.includes('next.config')) return 'Next.js Application';
      if (configurations.includes('react')) return 'React Application';
      if (configurations.includes('express')) return 'Node.js Express API';
      if (configurations.includes('@types/node')) return 'Node.js TypeScript Project';
      return 'Node.js Application';
    }

    if (configurations.includes('Cargo.toml')) return 'Rust Project';
    if (configurations.includes('pom.xml')) return 'Java Maven Project';
    if (configurations.includes('requirements.txt') || configurations.includes('pyproject.toml')) return 'Python Project';
    if (structure.includes('.go')) return 'Go Project';

    return null;
  }

  private detectTechnologies(configurations: string): string[] {
    const technologies: string[] = [];

    // Frontend frameworks
    if (configurations.includes('react')) technologies.push('React');
    if (configurations.includes('vue')) technologies.push('Vue.js');
    if (configurations.includes('angular')) technologies.push('Angular');
    if (configurations.includes('svelte')) technologies.push('Svelte');

    // Backend frameworks
    if (configurations.includes('express')) technologies.push('Express.js');
    if (configurations.includes('fastify')) technologies.push('Fastify');
    if (configurations.includes('koa')) technologies.push('Koa.js');

    // Languages
    if (configurations.includes('typescript')) technologies.push('TypeScript');
    if (configurations.includes('webpack')) technologies.push('Webpack');
    if (configurations.includes('vite')) technologies.push('Vite');

    // Testing
    if (configurations.includes('jest')) technologies.push('Jest');
    if (configurations.includes('vitest')) technologies.push('Vitest');
    if (configurations.includes('cypress')) technologies.push('Cypress');

    // Databases
    if (configurations.includes('prisma')) technologies.push('Prisma');
    if (configurations.includes('mongoose')) technologies.push('MongoDB');
    if (configurations.includes('pg')) technologies.push('PostgreSQL');

    // Infrastructure
    if (configurations.includes('docker')) technologies.push('Docker');
    if (configurations.includes('kubernetes')) technologies.push('Kubernetes');

    return technologies;
  }
}