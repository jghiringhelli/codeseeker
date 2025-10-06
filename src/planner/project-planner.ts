/**
 * Project Planner
 * Handles project planning and requirement analysis
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'fast-glob';

interface ProjectAnalysis {
  type: string;
  complexity: 'low' | 'medium' | 'high';
  recommendations: string[];
  technologies: string[];
  fileStats: {
    totalFiles: number;
    codeFiles: number;
    testFiles: number;
    configFiles: number;
  };
  architecture: string[];
}

interface ProjectPlan {
  phases: Array<{
    name: string;
    description: string;
    tasks: string[];
    estimatedDays: number;
  }>;
  timeline: string;
  resources: string[];
  risks: string[];
  dependencies: string[];
}

export class ProjectPlanner {

  async analyzeProject(projectPath: string): Promise<ProjectAnalysis> {
    try {
      // Get all files in the project
      const allFiles = await glob('**/*', {
        cwd: projectPath,
        ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
        onlyFiles: true
      });

      const fileStats = this.analyzeFileStats(allFiles);
      const technologies = await this.detectTechnologies(projectPath, allFiles);
      const projectType = this.determineProjectType(technologies, allFiles);
      const complexity = this.calculateComplexity(fileStats, technologies);
      const architecture = this.analyzeArchitecture(allFiles);
      const recommendations = this.generateRecommendations(projectType, technologies, fileStats);

      return {
        type: projectType,
        complexity,
        recommendations,
        technologies,
        fileStats,
        architecture
      };
    } catch (error) {
      console.error(`Project analysis failed: ${error.message}`);
      return {
        type: 'unknown',
        complexity: 'medium',
        recommendations: ['Unable to analyze project structure'],
        technologies: [],
        fileStats: { totalFiles: 0, codeFiles: 0, testFiles: 0, configFiles: 0 },
        architecture: []
      };
    }
  }

  async generatePlan(requirements: string[]): Promise<ProjectPlan> {
    const phases = this.createPhases(requirements);
    const timeline = this.estimateTimeline(phases);
    const resources = this.identifyResources(requirements);
    const risks = this.identifyRisks(requirements);
    const dependencies = this.identifyDependencies(requirements);

    return {
      phases,
      timeline,
      resources,
      risks,
      dependencies
    };
  }

  private analyzeFileStats(files: string[]) {
    const codeExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.cs', '.php', '.rb', '.go', '.rs'];
    const testPatterns = ['/test/', '/tests/', '.test.', '.spec.', '__tests__'];
    const configPatterns = ['package.json', 'tsconfig.json', '.eslintrc', 'webpack.config', 'babel.config', '.env'];

    return {
      totalFiles: files.length,
      codeFiles: files.filter(f => codeExtensions.some(ext => f.endsWith(ext))).length,
      testFiles: files.filter(f => testPatterns.some(pattern => f.includes(pattern))).length,
      configFiles: files.filter(f => configPatterns.some(pattern => f.includes(pattern))).length
    };
  }

  private async detectTechnologies(projectPath: string, files: string[]): Promise<string[]> {
    const technologies: string[] = [];

    // Check package.json
    if (files.includes('package.json')) {
      try {
        const packageJson = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf8'));
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

        if (deps.react) technologies.push('React');
        if (deps.vue) technologies.push('Vue');
        if (deps.angular) technologies.push('Angular');
        if (deps.typescript) technologies.push('TypeScript');
        if (deps.express) technologies.push('Express');
        if (deps.next) technologies.push('Next.js');
        if (deps['@nestjs/core']) technologies.push('NestJS');
        if (deps.webpack) technologies.push('Webpack');
        if (deps.vite) technologies.push('Vite');
      } catch (error) {
        // Ignore package.json parsing errors
      }
    }

    // Check file extensions
    if (files.some(f => f.endsWith('.ts') || f.endsWith('.tsx'))) technologies.push('TypeScript');
    if (files.some(f => f.endsWith('.py'))) technologies.push('Python');
    if (files.some(f => f.endsWith('.java'))) technologies.push('Java');
    if (files.some(f => f.endsWith('.cs'))) technologies.push('C#');
    if (files.some(f => f.endsWith('.go'))) technologies.push('Go');
    if (files.some(f => f.endsWith('.rs'))) technologies.push('Rust');

    // Check for Docker
    if (files.includes('Dockerfile') || files.includes('docker-compose.yml')) {
      technologies.push('Docker');
    }

    return [...new Set(technologies)];
  }

  private determineProjectType(technologies: string[], files: string[]): string {
    if (technologies.includes('React') || technologies.includes('Vue') || technologies.includes('Angular')) {
      return 'Frontend Application';
    }
    if (technologies.includes('Express') || technologies.includes('NestJS')) {
      return 'Backend API';
    }
    if (technologies.includes('Next.js')) {
      return 'Full-Stack Application';
    }
    if (files.some(f => f.includes('test') || f.includes('spec'))) {
      return 'Library/Package';
    }
    if (technologies.includes('Python')) {
      return 'Python Application';
    }
    return 'General Software Project';
  }

  private calculateComplexity(fileStats: any, technologies: string[]): 'low' | 'medium' | 'high' {
    const complexityScore =
      (fileStats.codeFiles * 1) +
      (technologies.length * 2) +
      (fileStats.configFiles * 0.5);

    if (complexityScore < 20) return 'low';
    if (complexityScore < 100) return 'medium';
    return 'high';
  }

  private analyzeArchitecture(files: string[]): string[] {
    const patterns: string[] = [];

    if (files.some(f => f.includes('/components/') && f.includes('/pages/'))) {
      patterns.push('Component-based Architecture');
    }
    if (files.some(f => f.includes('/services/') || f.includes('/api/'))) {
      patterns.push('Service Layer Architecture');
    }
    if (files.some(f => f.includes('/models/') || f.includes('/entities/'))) {
      patterns.push('Data Model Layer');
    }
    if (files.some(f => f.includes('/utils/') || f.includes('/helpers/'))) {
      patterns.push('Utility Layer');
    }
    if (files.some(f => f.includes('/middleware/'))) {
      patterns.push('Middleware Pattern');
    }

    return patterns;
  }

  private generateRecommendations(type: string, technologies: string[], fileStats: any): string[] {
    const recommendations: string[] = [];

    if (fileStats.testFiles === 0) {
      recommendations.push('Add unit tests for better code quality');
    }

    if (!technologies.includes('TypeScript') && fileStats.codeFiles > 10) {
      recommendations.push('Consider migrating to TypeScript for better type safety');
    }

    if (fileStats.configFiles < 2) {
      recommendations.push('Add linting and formatting configuration files');
    }

    if (!technologies.includes('Docker') && type.includes('Application')) {
      recommendations.push('Consider containerization with Docker');
    }

    recommendations.push('Implement CI/CD pipeline for automated testing and deployment');
    recommendations.push('Add comprehensive documentation and README');

    return recommendations;
  }

  private createPhases(requirements: string[]) {
    const phases = [];

    // Analysis Phase
    phases.push({
      name: 'Project Analysis',
      description: 'Analyze existing codebase and requirements',
      tasks: [
        'Review current codebase structure',
        'Identify technical debt',
        'Document existing functionality',
        'Analyze performance bottlenecks'
      ],
      estimatedDays: Math.max(3, Math.ceil(requirements.length * 0.5))
    });

    // Planning Phase
    phases.push({
      name: 'Technical Planning',
      description: 'Design technical solution and architecture',
      tasks: [
        'Create technical specification',
        'Design system architecture',
        'Plan database schema changes',
        'Define API contracts'
      ],
      estimatedDays: Math.max(5, Math.ceil(requirements.length * 0.8))
    });

    // Implementation Phase
    phases.push({
      name: 'Implementation',
      description: 'Develop the required features',
      tasks: requirements.map(req => `Implement: ${req}`),
      estimatedDays: Math.max(10, requirements.length * 2)
    });

    // Testing Phase
    phases.push({
      name: 'Testing & QA',
      description: 'Test and validate the implementation',
      tasks: [
        'Write unit tests',
        'Perform integration testing',
        'User acceptance testing',
        'Performance testing'
      ],
      estimatedDays: Math.max(5, Math.ceil(requirements.length * 1.2))
    });

    // Deployment Phase
    phases.push({
      name: 'Deployment',
      description: 'Deploy to production environment',
      tasks: [
        'Setup production environment',
        'Database migration',
        'Deploy application',
        'Monitor and validate'
      ],
      estimatedDays: 3
    });

    return phases;
  }

  private estimateTimeline(phases: any[]): string {
    const totalDays = phases.reduce((sum, phase) => sum + phase.estimatedDays, 0);
    const weeks = Math.ceil(totalDays / 5);

    if (weeks <= 2) return `${totalDays} days (${weeks} weeks)`;
    if (weeks <= 8) return `${weeks} weeks`;
    return `${Math.ceil(weeks / 4)} months (${weeks} weeks)`;
  }

  private identifyResources(requirements: string[]): string[] {
    const resources = [
      'Development Team (Frontend/Backend)',
      'DevOps Engineer',
      'QA Engineer',
      'Project Manager'
    ];

    if (requirements.some(req => req.toLowerCase().includes('database'))) {
      resources.push('Database Administrator');
    }
    if (requirements.some(req => req.toLowerCase().includes('ui') || req.toLowerCase().includes('design'))) {
      resources.push('UI/UX Designer');
    }
    if (requirements.some(req => req.toLowerCase().includes('security'))) {
      resources.push('Security Specialist');
    }

    return resources;
  }

  private identifyRisks(requirements: string[]): string[] {
    const risks = [
      'Technical complexity may lead to delays',
      'Integration challenges with existing systems',
      'Performance requirements may require optimization',
      'Resource availability and scheduling conflicts'
    ];

    if (requirements.length > 10) {
      risks.push('Scope creep due to large number of requirements');
    }

    if (requirements.some(req => req.toLowerCase().includes('migration'))) {
      risks.push('Data migration risks and potential downtime');
    }

    return risks;
  }

  private identifyDependencies(requirements: string[]): string[] {
    const dependencies = [
      'Access to production environment',
      'Database access and permissions',
      'Third-party API documentation',
      'Stakeholder approval for major changes'
    ];

    if (requirements.some(req => req.toLowerCase().includes('integration'))) {
      dependencies.push('External system availability and cooperation');
    }

    return dependencies;
  }
}

export const projectPlanner = new ProjectPlanner();