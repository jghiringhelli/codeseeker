/**
 * Platform Detector
 *
 * Simple platform detection service that identifies technologies used in a project
 * and provides official documentation URLs for Claude to reference.
 *
 * This is a lightweight alternative to full Documentation RAG - we just detect
 * platforms and store URLs. Claude can fetch documentation on-demand when needed.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface Platform {
  id: string;
  name: string;
  category: 'language' | 'framework' | 'database' | 'orm' | 'testing' | 'devops' | 'library';
  docsUrl: string;
  version?: string;
  detectedFrom?: string;
}

// Platform registry with official documentation URLs
const PLATFORM_REGISTRY: Record<string, Omit<Platform, 'version' | 'detectedFrom'>> = {
  // Languages
  'typescript': { id: 'typescript', name: 'TypeScript', category: 'language', docsUrl: 'https://www.typescriptlang.org/docs/' },
  'javascript': { id: 'javascript', name: 'JavaScript', category: 'language', docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript' },
  'python': { id: 'python', name: 'Python', category: 'language', docsUrl: 'https://docs.python.org/3/' },
  'go': { id: 'go', name: 'Go', category: 'language', docsUrl: 'https://go.dev/doc/' },
  'rust': { id: 'rust', name: 'Rust', category: 'language', docsUrl: 'https://doc.rust-lang.org/book/' },
  'java': { id: 'java', name: 'Java', category: 'language', docsUrl: 'https://docs.oracle.com/en/java/' },

  // Frontend Frameworks
  'react': { id: 'react', name: 'React', category: 'framework', docsUrl: 'https://react.dev/' },
  'vue': { id: 'vue', name: 'Vue.js', category: 'framework', docsUrl: 'https://vuejs.org/guide/' },
  'angular': { id: 'angular', name: 'Angular', category: 'framework', docsUrl: 'https://angular.io/docs' },
  'svelte': { id: 'svelte', name: 'Svelte', category: 'framework', docsUrl: 'https://svelte.dev/docs' },
  'nextjs': { id: 'nextjs', name: 'Next.js', category: 'framework', docsUrl: 'https://nextjs.org/docs' },

  // Backend Frameworks
  'express': { id: 'express', name: 'Express.js', category: 'framework', docsUrl: 'https://expressjs.com/' },
  'nestjs': { id: 'nestjs', name: 'NestJS', category: 'framework', docsUrl: 'https://docs.nestjs.com/' },
  'fastify': { id: 'fastify', name: 'Fastify', category: 'framework', docsUrl: 'https://fastify.dev/docs/latest/' },
  'koa': { id: 'koa', name: 'Koa.js', category: 'framework', docsUrl: 'https://koajs.com/' },
  'django': { id: 'django', name: 'Django', category: 'framework', docsUrl: 'https://docs.djangoproject.com/' },
  'flask': { id: 'flask', name: 'Flask', category: 'framework', docsUrl: 'https://flask.palletsprojects.com/' },
  'fastapi': { id: 'fastapi', name: 'FastAPI', category: 'framework', docsUrl: 'https://fastapi.tiangolo.com/' },

  // Databases
  'postgresql': { id: 'postgresql', name: 'PostgreSQL', category: 'database', docsUrl: 'https://www.postgresql.org/docs/' },
  'mongodb': { id: 'mongodb', name: 'MongoDB', category: 'database', docsUrl: 'https://www.mongodb.com/docs/' },
  'mysql': { id: 'mysql', name: 'MySQL', category: 'database', docsUrl: 'https://dev.mysql.com/doc/' },
  'redis': { id: 'redis', name: 'Redis', category: 'database', docsUrl: 'https://redis.io/docs/' },
  'neo4j': { id: 'neo4j', name: 'Neo4j', category: 'database', docsUrl: 'https://neo4j.com/docs/' },

  // ORMs
  'prisma': { id: 'prisma', name: 'Prisma', category: 'orm', docsUrl: 'https://www.prisma.io/docs' },
  'typeorm': { id: 'typeorm', name: 'TypeORM', category: 'orm', docsUrl: 'https://typeorm.io/' },
  'sequelize': { id: 'sequelize', name: 'Sequelize', category: 'orm', docsUrl: 'https://sequelize.org/docs/v6/' },
  'mongoose': { id: 'mongoose', name: 'Mongoose', category: 'orm', docsUrl: 'https://mongoosejs.com/docs/' },

  // Testing
  'jest': { id: 'jest', name: 'Jest', category: 'testing', docsUrl: 'https://jestjs.io/docs/getting-started' },
  'vitest': { id: 'vitest', name: 'Vitest', category: 'testing', docsUrl: 'https://vitest.dev/guide/' },
  'mocha': { id: 'mocha', name: 'Mocha', category: 'testing', docsUrl: 'https://mochajs.org/' },
  'cypress': { id: 'cypress', name: 'Cypress', category: 'testing', docsUrl: 'https://docs.cypress.io/' },
  'playwright': { id: 'playwright', name: 'Playwright', category: 'testing', docsUrl: 'https://playwright.dev/docs/intro' },

  // DevOps
  'docker': { id: 'docker', name: 'Docker', category: 'devops', docsUrl: 'https://docs.docker.com/' },
  'kubernetes': { id: 'kubernetes', name: 'Kubernetes', category: 'devops', docsUrl: 'https://kubernetes.io/docs/' },

  // Build Tools & Libraries
  'webpack': { id: 'webpack', name: 'Webpack', category: 'library', docsUrl: 'https://webpack.js.org/concepts/' },
  'vite': { id: 'vite', name: 'Vite', category: 'library', docsUrl: 'https://vitejs.dev/guide/' },
  'esbuild': { id: 'esbuild', name: 'esbuild', category: 'library', docsUrl: 'https://esbuild.github.io/' },
};

export class PlatformDetector {
  /**
   * Detect platforms used in a project
   */
  async detectPlatforms(projectPath: string): Promise<Platform[]> {
    const platforms: Platform[] = [];
    const seen = new Set<string>();

    // Check package.json for Node.js projects
    await this.detectFromPackageJson(projectPath, platforms, seen);

    // Check for config files
    await this.detectFromConfigFiles(projectPath, platforms, seen);

    // Check docker-compose.yml for services
    await this.detectFromDockerCompose(projectPath, platforms, seen);

    return platforms;
  }

  /**
   * Detect platforms from package.json dependencies
   */
  private async detectFromPackageJson(
    projectPath: string,
    platforms: Platform[],
    seen: Set<string>
  ): Promise<void> {
    const packageJsonPath = path.join(projectPath, 'package.json');

    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies
      };

      // Map package names to platform IDs
      const packageToPlatform: Record<string, string> = {
        'typescript': 'typescript',
        'react': 'react',
        'react-dom': 'react',
        'vue': 'vue',
        '@angular/core': 'angular',
        'svelte': 'svelte',
        'next': 'nextjs',
        'express': 'express',
        '@nestjs/core': 'nestjs',
        'fastify': 'fastify',
        'koa': 'koa',
        'pg': 'postgresql',
        'mongodb': 'mongodb',
        'mysql2': 'mysql',
        'redis': 'redis',
        'ioredis': 'redis',
        'neo4j-driver': 'neo4j',
        'prisma': 'prisma',
        '@prisma/client': 'prisma',
        'typeorm': 'typeorm',
        'sequelize': 'sequelize',
        'mongoose': 'mongoose',
        'jest': 'jest',
        'vitest': 'vitest',
        'mocha': 'mocha',
        'cypress': 'cypress',
        '@playwright/test': 'playwright',
        'webpack': 'webpack',
        'vite': 'vite',
        'esbuild': 'esbuild',
      };

      for (const [pkgName, version] of Object.entries(allDeps)) {
        const platformId = packageToPlatform[pkgName];
        if (platformId && !seen.has(platformId)) {
          seen.add(platformId);
          const registry = PLATFORM_REGISTRY[platformId];
          if (registry) {
            platforms.push({
              ...registry,
              version: String(version).replace(/^\^|~/, ''),
              detectedFrom: 'package.json'
            });
          }
        }
      }

      // Always add JavaScript/TypeScript based on presence
      if (!seen.has('javascript')) {
        seen.add('javascript');
        platforms.push({
          ...PLATFORM_REGISTRY['javascript'],
          detectedFrom: 'package.json'
        });
      }

    } catch {
      // package.json doesn't exist or can't be read
    }
  }

  /**
   * Detect platforms from configuration files
   */
  private async detectFromConfigFiles(
    projectPath: string,
    platforms: Platform[],
    seen: Set<string>
  ): Promise<void> {
    const configDetection: Record<string, string> = {
      'tsconfig.json': 'typescript',
      'jest.config.js': 'jest',
      'jest.config.ts': 'jest',
      'vitest.config.ts': 'vitest',
      'vitest.config.js': 'vitest',
      'cypress.config.js': 'cypress',
      'cypress.config.ts': 'cypress',
      'playwright.config.ts': 'playwright',
      'webpack.config.js': 'webpack',
      'vite.config.js': 'vite',
      'vite.config.ts': 'vite',
      'docker-compose.yml': 'docker',
      'docker-compose.yaml': 'docker',
      'Dockerfile': 'docker',
    };

    for (const [configFile, platformId] of Object.entries(configDetection)) {
      if (seen.has(platformId)) continue;

      try {
        await fs.access(path.join(projectPath, configFile));
        seen.add(platformId);
        const registry = PLATFORM_REGISTRY[platformId];
        if (registry) {
          platforms.push({
            ...registry,
            detectedFrom: configFile
          });
        }
      } catch {
        // File doesn't exist
      }
    }
  }

  /**
   * Detect database platforms from docker-compose.yml
   */
  private async detectFromDockerCompose(
    projectPath: string,
    platforms: Platform[],
    seen: Set<string>
  ): Promise<void> {
    const composePaths = ['docker-compose.yml', 'docker-compose.yaml'];

    for (const composePath of composePaths) {
      try {
        const content = await fs.readFile(path.join(projectPath, composePath), 'utf-8');

        // Simple pattern matching for common database images
        const imagePatterns: Record<string, string> = {
          'postgres': 'postgresql',
          'mysql': 'mysql',
          'mongo': 'mongodb',
          'redis': 'redis',
          'neo4j': 'neo4j',
        };

        for (const [pattern, platformId] of Object.entries(imagePatterns)) {
          if (content.includes(pattern) && !seen.has(platformId)) {
            seen.add(platformId);
            const registry = PLATFORM_REGISTRY[platformId];
            if (registry) {
              platforms.push({
                ...registry,
                detectedFrom: composePath
              });
            }
          }
        }
      } catch {
        // File doesn't exist
      }
    }
  }

  /**
   * Format detected platforms as markdown for CODEMIND.md
   */
  formatPlatformsMarkdown(platforms: Platform[]): string {
    if (platforms.length === 0) {
      return '';
    }

    const lines = [
      '## Detected Platforms & Documentation',
      '',
      'The following platforms were detected in this project. Claude can reference these official documentation URLs when needed:',
      ''
    ];

    // Group by category
    const byCategory = new Map<string, Platform[]>();
    for (const platform of platforms) {
      const list = byCategory.get(platform.category) || [];
      list.push(platform);
      byCategory.set(platform.category, list);
    }

    const categoryOrder = ['language', 'framework', 'database', 'orm', 'testing', 'devops', 'library'];
    const categoryNames: Record<string, string> = {
      'language': 'Languages',
      'framework': 'Frameworks',
      'database': 'Databases',
      'orm': 'ORMs',
      'testing': 'Testing',
      'devops': 'DevOps',
      'library': 'Libraries & Tools'
    };

    for (const category of categoryOrder) {
      const categoryPlatforms = byCategory.get(category);
      if (!categoryPlatforms || categoryPlatforms.length === 0) continue;

      lines.push(`### ${categoryNames[category]}`);
      for (const platform of categoryPlatforms) {
        const version = platform.version ? ` (${platform.version})` : '';
        lines.push(`- **${platform.name}**${version}: ${platform.docsUrl}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}

export const platformDetector = new PlatformDetector();