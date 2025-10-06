"use strict";
/**
 * UI Navigation Analyzer - Simplified Frontend Flow Understanding
 * Analyzes UI components, navigation flows, and user journeys for Claude Code context enhancement
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
exports.UINavigationAnalyzer = void 0;
const logger_1 = require("../../../utils/logger");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const fast_glob_1 = require("fast-glob");
class UINavigationAnalyzer {
    logger = logger_1.Logger.getInstance();
    async analyzeUI(params) {
        const startTime = Date.now();
        try {
            this.logger.info('🎨 Starting UI navigation analysis...');
            // 1. Detect UI framework
            const framework = params.framework || await this.detectFramework(params.projectPath);
            // 2. Find UI components and pages
            const components = await this.findUIComponents(params.projectPath, framework);
            // 3. Analyze navigation flows
            const navigationFlows = await this.analyzeNavigationFlows(components, params.projectPath);
            // 4. Extract screens and routes
            const screens = await this.extractScreens(components);
            const routes = await this.extractRoutes(params.projectPath, framework);
            // 5. Identify shared components
            const sharedComponents = this.identifySharedComponents(components);
            // 6. Assess architecture health
            const architectureHealth = this.assessArchitectureHealth(components, navigationFlows);
            // 7. Generate recommendations
            const recommendations = this.generateRecommendations(components, navigationFlows, architectureHealth);
            // 8. Generate Mermaid diagrams
            const mermaidDiagrams = {
                componentGraph: this.generateComponentMermaid(components, sharedComponents),
                navigationFlow: this.generateNavigationMermaid(navigationFlows),
                screenFlow: this.generateScreenFlowMermaid(screens, routes)
            };
            const result = {
                framework,
                components,
                navigationFlows,
                screens,
                routes,
                sharedComponents,
                recommendations,
                architectureHealth,
                mermaidDiagrams
            };
            const duration = Date.now() - startTime;
            this.logger.info(`✅ UI navigation analysis completed in ${duration}ms`, {
                componentsFound: components.length,
                screensFound: screens.length,
                navigationFlows: navigationFlows.length,
                framework
            });
            return result;
        }
        catch (error) {
            this.logger.error('❌ UI navigation analysis failed:', error);
            throw error;
        }
    }
    async detectFramework(projectPath) {
        try {
            const packageJsonPath = path.join(projectPath, 'package.json');
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
            const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
            // Check for popular frontend frameworks
            if (deps['react'] || deps['@types/react'])
                return 'react';
            if (deps['vue'] || deps['@vue/cli'])
                return 'vue';
            if (deps['@angular/core'])
                return 'angular';
            if (deps['svelte'])
                return 'svelte';
            if (deps['next'])
                return 'nextjs';
            if (deps['nuxt'])
                return 'nuxtjs';
            if (deps['gatsby'])
                return 'gatsby';
            return 'vanilla';
        }
        catch {
            return 'unknown';
        }
    }
    async findUIComponents(projectPath, framework) {
        const components = [];
        try {
            // Framework-specific component patterns
            const patterns = this.getComponentPatterns(framework);
            const files = await (0, fast_glob_1.glob)(patterns, {
                cwd: projectPath,
                ignore: ['node_modules/**', 'dist/**', 'build/**', '**/*.test.*', '**/*.spec.*']
            });
            for (const file of files.slice(0, 50)) { // Reasonable limit
                const component = await this.analyzeComponent(path.join(projectPath, file), framework);
                if (component) {
                    components.push(component);
                }
            }
        }
        catch (error) {
            this.logger.warn('Could not find UI components:', error);
        }
        return components;
    }
    getComponentPatterns(framework) {
        switch (framework) {
            case 'react':
            case 'nextjs':
            case 'gatsby':
                return [
                    'src/**/*.{jsx,tsx}',
                    'pages/**/*.{js,ts,jsx,tsx}',
                    'components/**/*.{js,ts,jsx,tsx}',
                    'app/**/*.{js,ts,jsx,tsx}'
                ];
            case 'vue':
            case 'nuxtjs':
                return [
                    'src/**/*.vue',
                    'pages/**/*.vue',
                    'components/**/*.vue',
                    'layouts/**/*.vue'
                ];
            case 'angular':
                return [
                    'src/**/*.component.ts',
                    'src/**/*.page.ts',
                    'src/**/*.module.ts'
                ];
            case 'svelte':
                return [
                    'src/**/*.svelte',
                    'src/routes/**/*.svelte'
                ];
            default:
                return [
                    'src/**/*.{js,ts,jsx,tsx,vue}',
                    'components/**/*.{js,ts,jsx,tsx,vue}',
                    'pages/**/*.{js,ts,jsx,tsx,vue}'
                ];
        }
    }
    async analyzeComponent(filePath, framework) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const name = path.basename(filePath, path.extname(filePath));
            return {
                path: filePath,
                name,
                type: this.determineComponentType(content, filePath),
                framework,
                dependencies: this.extractDependencies(content),
                exports: this.extractExports(content),
                props: this.extractProps(content, framework),
                routes: this.extractComponentRoutes(content),
                isShared: this.isSharedComponent(content, filePath),
                complexity: this.calculateComponentComplexity(content)
            };
        }
        catch (error) {
            this.logger.warn(`Could not analyze component ${filePath}:`, error);
            return null;
        }
    }
    determineComponentType(content, filePath) {
        const pathLower = filePath.toLowerCase();
        const contentLower = content.toLowerCase();
        if (pathLower.includes('page') || pathLower.includes('route'))
            return 'page';
        if (pathLower.includes('layout') || contentLower.includes('layout'))
            return 'layout';
        if (pathLower.includes('hook') || contentLower.includes('usehook') || contentLower.includes('use'))
            return 'hook';
        if (pathLower.includes('service') || contentLower.includes('service'))
            return 'service';
        return 'component';
    }
    extractDependencies(content) {
        const dependencies = new Set();
        // Extract import statements
        const importMatches = content.matchAll(/import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g);
        for (const match of importMatches) {
            if (match[1] && !match[1].startsWith('.') && !match[1].includes('node_modules')) {
                dependencies.add(match[1]);
            }
        }
        return Array.from(dependencies).slice(0, 10);
    }
    extractExports(content) {
        const exports = new Set();
        // Extract export statements
        const exportMatches = content.matchAll(/export\s+(?:default\s+)?(?:function|const|class|interface|type)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
        for (const match of exportMatches) {
            if (match[1]) {
                exports.add(match[1]);
            }
        }
        return Array.from(exports);
    }
    extractProps(content, framework) {
        const props = [];
        if (framework === 'react') {
            // React props interface pattern
            const propsInterfaceMatch = content.match(/interface\s+\w*Props\s*\{([^}]+)\}/);
            if (propsInterfaceMatch) {
                const propsContent = propsInterfaceMatch[1];
                const propMatches = propsContent.matchAll(/(\w+)\??\s*:\s*([^;,\n]+)/g);
                for (const match of propMatches) {
                    if (match[1] && match[2]) {
                        props.push({
                            name: match[1],
                            type: match[2].trim(),
                            required: !propsContent.includes(`${match[1]}?`)
                        });
                    }
                }
            }
        }
        return props.slice(0, 10);
    }
    extractComponentRoutes(content) {
        const routes = [];
        // Look for route definitions
        const routePatterns = [
            /Route\s+path=['"`]([^'"`]+)['"`]/g,
            /router\.(?:get|post|put|delete)\s*\(['"`]([^'"`]+)['"`]/g,
            /@Route\s*\(['"`]([^'"`]+)['"`]/g
        ];
        for (const pattern of routePatterns) {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                if (match[1]) {
                    routes.push({
                        path: match[1],
                        component: path.basename(content, '.tsx')
                    });
                }
            }
        }
        return routes;
    }
    isSharedComponent(content, filePath) {
        const pathLower = filePath.toLowerCase();
        return pathLower.includes('shared') ||
            pathLower.includes('common') ||
            pathLower.includes('ui') ||
            pathLower.includes('components');
    }
    calculateComponentComplexity(content) {
        // Simple complexity calculation
        const lines = content.split('\n').length;
        const functions = (content.match(/function|=>/g) || []).length;
        const conditions = (content.match(/if|else|switch|case|\?/g) || []).length;
        const loops = (content.match(/for|while|map|filter|forEach/g) || []).length;
        return Math.round((lines / 10) + functions + (conditions * 1.5) + (loops * 1.2));
    }
    async analyzeNavigationFlows(components, projectPath) {
        const flows = [];
        try {
            // Simple heuristic-based flow detection
            const pageComponents = components.filter(c => c.type === 'page');
            // Create basic flows based on common patterns
            if (pageComponents.some(p => p.name.toLowerCase().includes('login'))) {
                flows.push(this.createAuthenticationFlow(pageComponents));
            }
            if (pageComponents.some(p => p.name.toLowerCase().includes('dashboard'))) {
                flows.push(this.createDashboardFlow(pageComponents));
            }
            if (pageComponents.some(p => p.name.toLowerCase().includes('profile'))) {
                flows.push(this.createProfileFlow(pageComponents));
            }
        }
        catch (error) {
            this.logger.warn('Could not analyze navigation flows:', error);
        }
        return flows;
    }
    createAuthenticationFlow(components) {
        const loginComponent = components.find(c => c.name.toLowerCase().includes('login'));
        const dashboardComponent = components.find(c => c.name.toLowerCase().includes('dashboard'));
        return {
            id: 'authentication_flow',
            name: 'User Authentication Flow',
            steps: [
                {
                    component: 'LoginPage',
                    action: 'Enter credentials',
                    trigger: 'form_submit',
                    nextComponent: dashboardComponent?.name || 'Dashboard'
                },
                {
                    component: dashboardComponent?.name || 'Dashboard',
                    action: 'View authenticated content',
                    trigger: 'successful_auth'
                }
            ],
            entryPoints: [loginComponent?.name || 'LoginPage'],
            exitPoints: [dashboardComponent?.name || 'Dashboard'],
            userType: 'anonymous',
            businessValue: 'high'
        };
    }
    createDashboardFlow(components) {
        return {
            id: 'dashboard_flow',
            name: 'Dashboard Navigation Flow',
            steps: [
                {
                    component: 'Dashboard',
                    action: 'View overview',
                    trigger: 'page_load'
                }
            ],
            entryPoints: ['Dashboard'],
            exitPoints: [],
            userType: 'authenticated',
            businessValue: 'high'
        };
    }
    createProfileFlow(components) {
        return {
            id: 'profile_flow',
            name: 'User Profile Management Flow',
            steps: [
                {
                    component: 'ProfilePage',
                    action: 'View profile',
                    trigger: 'navigation',
                    nextComponent: 'EditProfile'
                },
                {
                    component: 'EditProfile',
                    action: 'Edit profile information',
                    trigger: 'edit_button'
                }
            ],
            entryPoints: ['ProfilePage'],
            exitPoints: ['EditProfile'],
            userType: 'authenticated',
            businessValue: 'medium'
        };
    }
    async extractScreens(components) {
        const screens = [];
        const pageComponents = components.filter(c => c.type === 'page');
        for (const component of pageComponents) {
            screens.push({
                id: `screen_${component.name.toLowerCase()}`,
                name: component.name,
                route: component.routes[0]?.path || `/${component.name.toLowerCase()}`,
                component: component.name,
                type: 'page',
                dependencies: component.dependencies,
                dataRequirements: this.extractDataRequirements(component)
            });
        }
        return screens;
    }
    extractDataRequirements(component) {
        const requirements = new Set();
        // Look for common data patterns in component dependencies
        component.dependencies.forEach(dep => {
            if (dep.includes('api') || dep.includes('service')) {
                requirements.add('api_data');
            }
            if (dep.includes('auth')) {
                requirements.add('user_auth');
            }
            if (dep.includes('store') || dep.includes('state')) {
                requirements.add('global_state');
            }
        });
        return Array.from(requirements);
    }
    async extractRoutes(projectPath, framework) {
        const routes = [];
        try {
            // Framework-specific route file patterns
            const routePatterns = this.getRoutePatterns(framework);
            const routeFiles = await (0, fast_glob_1.glob)(routePatterns, {
                cwd: projectPath,
                ignore: ['node_modules/**', 'dist/**']
            });
            for (const file of routeFiles.slice(0, 10)) {
                const fileRoutes = await this.extractRoutesFromFile(path.join(projectPath, file));
                routes.push(...fileRoutes);
            }
        }
        catch (error) {
            this.logger.warn('Could not extract routes:', error);
        }
        return routes;
    }
    getRoutePatterns(framework) {
        switch (framework) {
            case 'nextjs':
                return ['pages/**/*.{js,ts,jsx,tsx}', 'app/**/*.{js,ts,jsx,tsx}'];
            case 'nuxtjs':
                return ['pages/**/*.vue'];
            case 'angular':
                return ['**/*-routing.module.ts', '**/app.routes.ts'];
            default:
                return ['**/*route*.{js,ts}', '**/router.{js,ts}'];
        }
    }
    async extractRoutesFromFile(filePath) {
        const routes = [];
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            // Extract route definitions
            const routeMatches = content.matchAll(/(?:path|route):\s*['"`]([^'"`]+)['"`]/g);
            for (const match of routeMatches) {
                if (match[1]) {
                    routes.push({
                        path: match[1],
                        component: path.basename(filePath, path.extname(filePath))
                    });
                }
            }
        }
        catch (error) {
            this.logger.warn(`Could not extract routes from ${filePath}:`, error);
        }
        return routes;
    }
    identifySharedComponents(components) {
        return components
            .filter(component => component.isShared)
            .map(component => component.name);
    }
    assessArchitectureHealth(components, flows) {
        const issues = [];
        const strengths = [];
        // Component reusability analysis
        const sharedCount = components.filter(c => c.isShared).length;
        const componentReusability = components.length > 0 ? sharedCount / components.length : 0;
        if (componentReusability < 0.2) {
            issues.push('Low component reusability - consider creating more shared components');
        }
        else if (componentReusability > 0.4) {
            strengths.push('Good component reusability with shared components');
        }
        // Navigation complexity analysis  
        const avgFlowSteps = flows.length > 0 ? flows.reduce((sum, f) => sum + f.steps.length, 0) / flows.length : 0;
        const navigationComplexity = Math.min(avgFlowSteps / 5, 1); // Normalize to 0-1
        if (avgFlowSteps > 8) {
            issues.push('Complex navigation flows may confuse users');
        }
        else if (avgFlowSteps > 0 && avgFlowSteps <= 4) {
            strengths.push('Simple, intuitive navigation flows');
        }
        // Component complexity analysis
        const highComplexityComponents = components.filter(c => c.complexity > 20).length;
        if (highComplexityComponents > components.length * 0.2) {
            issues.push('Many components have high complexity - consider refactoring');
        }
        const score = Math.max(0, 1 - (issues.length * 0.2));
        return {
            score,
            componentReusability,
            navigationComplexity,
            issues,
            strengths
        };
    }
    generateRecommendations(components, flows, health) {
        const recommendations = [];
        if (health.componentReusability < 0.3) {
            recommendations.push('Create more reusable shared components to improve maintainability');
        }
        if (health.navigationComplexity > 0.7) {
            recommendations.push('Simplify navigation flows to improve user experience');
        }
        const highComplexityComponents = components.filter(c => c.complexity > 20);
        if (highComplexityComponents.length > 0) {
            recommendations.push(`${highComplexityComponents.length} components have high complexity and should be refactored`);
        }
        if (flows.length === 0) {
            recommendations.push('Define clear user navigation flows to improve UX planning');
        }
        if (recommendations.length === 0) {
            recommendations.push('UI architecture appears well-structured');
        }
        return recommendations;
    }
    // Mermaid Diagram Generation Methods
    generateComponentMermaid(components, sharedComponents) {
        const lines = ['graph TD'];
        // Add component nodes
        components.forEach(comp => {
            const shape = sharedComponents.includes(comp.name) ? '((' : '[';
            const endShape = sharedComponents.includes(comp.name) ? '))' : ']';
            const label = `${comp.name}\\n<${comp.type}>`;
            lines.push(`    ${comp.name}${shape}${label}${endShape}`);
        });
        // Add dependencies as edges
        components.forEach(comp => {
            comp.dependencies.forEach(dep => {
                const depComponent = components.find(c => c.path.includes(dep));
                if (depComponent) {
                    lines.push(`    ${comp.name} --> ${depComponent.name}`);
                }
            });
        });
        // Add styling
        lines.push('    classDef shared fill:#f9f,stroke:#333,stroke-width:2px');
        sharedComponents.forEach(name => {
            lines.push(`    class ${name} shared`);
        });
        return lines.join('\n');
    }
    generateNavigationMermaid(flows) {
        const lines = ['stateDiagram-v2'];
        flows.forEach(flow => {
            lines.push(`    state "${flow.name}" as ${flow.id} {`);
            // Add entry points
            flow.entryPoints.forEach(entry => {
                lines.push(`        [*] --> ${entry}`);
            });
            // Add navigation steps
            flow.steps.forEach(step => {
                if (step.nextComponent) {
                    const condition = step.conditions?.length > 0
                        ? `: ${step.conditions[0]}`
                        : `: ${step.action}`;
                    lines.push(`        ${step.component} --> ${step.nextComponent}${condition}`);
                }
            });
            // Add exit points
            flow.exitPoints.forEach(exit => {
                lines.push(`        ${exit} --> [*]`);
            });
            lines.push(`    }`);
        });
        return lines.join('\n');
    }
    generateScreenFlowMermaid(screens, routes) {
        const lines = ['journey'];
        lines.push('    title User Navigation Journey');
        lines.push('    section Main Flow');
        // Group screens by type
        const pageScreens = screens.filter(s => s.type === 'page');
        const modalScreens = screens.filter(s => s.type === 'modal');
        // Add page navigation
        pageScreens.forEach((screen, index) => {
            const route = routes.find(r => r.component === screen.component);
            const method = route?.method || 'Navigate';
            lines.push(`        ${method} to ${screen.name}: 5: User`);
            // Add data requirements as tasks
            if (screen.dataRequirements.length > 0) {
                lines.push(`        Load ${screen.dataRequirements[0]}: 3: System`);
            }
        });
        // Add modal interactions
        if (modalScreens.length > 0) {
            lines.push('    section Modals & Overlays');
            modalScreens.forEach(screen => {
                lines.push(`        Open ${screen.name}: 4: User`);
                lines.push(`        Complete action: 3: User`);
            });
        }
        return lines.join('\n');
    }
}
exports.UINavigationAnalyzer = UINavigationAnalyzer;
exports.default = UINavigationAnalyzer;
//# sourceMappingURL=analyzer.js.map