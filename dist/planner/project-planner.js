"use strict";
/**
 * Project Planner
 * Handles project planning and requirement analysis
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectPlanner = exports.ProjectPlanner = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const fast_glob_1 = require("fast-glob");
class ProjectPlanner {
    async analyzeProject(projectPath) {
        try {
            // Get all files in the project
            const allFiles = await (0, fast_glob_1.glob)('**/*', {
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
        }
        catch (error) {
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
    async generatePlan(requirements) {
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
    analyzeFileStats(files) {
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
    async detectTechnologies(projectPath, files) {
        const technologies = [];
        // Check package.json
        if (files.includes('package.json')) {
            try {
                const packageJson = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf8'));
                const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
                if (deps.react)
                    technologies.push('React');
                if (deps.vue)
                    technologies.push('Vue');
                if (deps.angular)
                    technologies.push('Angular');
                if (deps.typescript)
                    technologies.push('TypeScript');
                if (deps.express)
                    technologies.push('Express');
                if (deps.next)
                    technologies.push('Next.js');
                if (deps['@nestjs/core'])
                    technologies.push('NestJS');
                if (deps.webpack)
                    technologies.push('Webpack');
                if (deps.vite)
                    technologies.push('Vite');
            }
            catch (error) {
                // Ignore package.json parsing errors
            }
        }
        // Check file extensions
        if (files.some(f => f.endsWith('.ts') || f.endsWith('.tsx')))
            technologies.push('TypeScript');
        if (files.some(f => f.endsWith('.py')))
            technologies.push('Python');
        if (files.some(f => f.endsWith('.java')))
            technologies.push('Java');
        if (files.some(f => f.endsWith('.cs')))
            technologies.push('C#');
        if (files.some(f => f.endsWith('.go')))
            technologies.push('Go');
        if (files.some(f => f.endsWith('.rs')))
            technologies.push('Rust');
        // Check for Docker
        if (files.includes('Dockerfile') || files.includes('docker-compose.yml')) {
            technologies.push('Docker');
        }
        return [...new Set(technologies)];
    }
    determineProjectType(technologies, files) {
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
    calculateComplexity(fileStats, technologies) {
        const complexityScore = (fileStats.codeFiles * 1) +
            (technologies.length * 2) +
            (fileStats.configFiles * 0.5);
        if (complexityScore < 20)
            return 'low';
        if (complexityScore < 100)
            return 'medium';
        return 'high';
    }
    analyzeArchitecture(files) {
        const patterns = [];
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
    generateRecommendations(type, technologies, fileStats) {
        const recommendations = [];
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
    createPhases(requirements) {
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
    estimateTimeline(phases) {
        const totalDays = phases.reduce((sum, phase) => sum + phase.estimatedDays, 0);
        const weeks = Math.ceil(totalDays / 5);
        if (weeks <= 2)
            return `${totalDays} days (${weeks} weeks)`;
        if (weeks <= 8)
            return `${weeks} weeks`;
        return `${Math.ceil(weeks / 4)} months (${weeks} weeks)`;
    }
    identifyResources(requirements) {
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
    identifyRisks(requirements) {
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
    identifyDependencies(requirements) {
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
exports.ProjectPlanner = ProjectPlanner;
exports.projectPlanner = new ProjectPlanner();
//# sourceMappingURL=project-planner.js.map