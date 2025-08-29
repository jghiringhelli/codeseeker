"use strict";
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
const logger_1 = require("../../utils/logger");
const colored_logger_1 = require("../../utils/colored-logger");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const glob_1 = require("glob");
class UINavigationAnalyzer {
    logger = logger_1.Logger.getInstance();
    async analyzeUI(params) {
        const startTime = Date.now();
        colored_logger_1.cliLogger.toolExecution('ui-navigation-analyzer', 'started');
        try {
            // Detect UI framework
            const framework = await this.detectFramework(params.projectPath);
            // Find UI components and pages
            const components = await this.findUIComponents(params.projectPath, framework);
            // Analyze navigation flows
            const navigationFlows = await this.analyzeNavigationFlows(components, params.projectPath);
            // Extract screens and routes
            const screens = await this.extractScreens(components);
            const routes = await this.extractRoutes(params.projectPath, framework);
            // Find shared components
            const sharedComponents = this.identifySharedComponents(components);
            // Build dependency map
            const dependencies = await this.buildDependencyMap(components);
            // Generate recommendations
            const recommendations = this.generateRecommendations(components, navigationFlows);
            const result = {
                components,
                navigationFlows,
                screens,
                routes,
                sharedComponents,
                dependencies,
                recommendations
            };
            const duration = Date.now() - startTime;
            colored_logger_1.cliLogger.toolExecution('ui-navigation-analyzer', 'completed', duration, {
                componentsFound: components.length,
                screensFound: screens.length,
                navigationFlows: navigationFlows.length,
                framework
            });
            return result;
        }
        catch (error) {
            colored_logger_1.cliLogger.toolExecution('ui-navigation-analyzer', 'failed', Date.now() - startTime, error);
            throw error;
        }
    }
    async detectFramework(projectPath) {
        try {
            const packageJson = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'));
            const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
            if (deps.react || deps['@types/react'])
                return 'react';
            if (deps.vue || deps['@vue/cli'])
                return 'vue';
            if (deps['@angular/core'])
                return 'angular';
            if (deps.svelte)
                return 'svelte';
            return 'vanilla';
        }
        catch {
            return 'vanilla';
        }
    }
    async findUIComponents(projectPath, framework) {
        const components = [];
        // Define search patterns based on framework
        const patterns = this.getComponentPatterns(framework);
        for (const pattern of patterns) {
            const files = await (0, glob_1.glob)(pattern, { cwd: projectPath });
            for (const file of files) {
                const fullPath = path.join(projectPath, file);
                const component = await this.analyzeComponentFile(fullPath, framework);
                if (component) {
                    components.push(component);
                }
            }
        }
        return components;
    }
    getComponentPatterns(framework) {
        switch (framework) {
            case 'react':
                return [
                    'src/components/**/*.{tsx,jsx,ts,js}',
                    'src/pages/**/*.{tsx,jsx,ts,js}',
                    'src/screens/**/*.{tsx,jsx,ts,js}',
                    'src/views/**/*.{tsx,jsx,ts,js}'
                ];
            case 'vue':
                return [
                    'src/components/**/*.vue',
                    'src/pages/**/*.vue',
                    'src/views/**/*.vue'
                ];
            case 'angular':
                return [
                    'src/app/**/*.component.ts',
                    'src/app/**/*.page.ts'
                ];
            case 'svelte':
                return [
                    'src/components/**/*.svelte',
                    'src/routes/**/*.svelte'
                ];
            default:
                return [
                    'src/**/*.{html,js,ts}',
                    'public/**/*.html'
                ];
        }
    }
    async analyzeComponentFile(filePath, framework) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const fileName = path.basename(filePath, path.extname(filePath));
            // Determine component type
            const type = this.determineComponentType(filePath, content);
            // Extract dependencies (imports)
            const dependencies = this.extractDependencies(content);
            // Extract props (React/Vue specific)
            const props = this.extractProps(content, framework);
            // Extract state
            const state = this.extractState(content, framework);
            // Extract routes (if applicable)
            const routes = this.extractComponentRoutes(content);
            // Extract navigation targets
            const navigationTargets = this.extractNavigationTargets(content);
            return {
                name: fileName,
                path: filePath,
                type,
                framework: framework,
                dependencies,
                props,
                state,
                routes,
                navigationTargets
            };
        }
        catch (error) {
            this.logger.warn(`Failed to analyze component ${filePath}:`, error);
            return null;
        }
    }
    determineComponentType(filePath, content) {
        const pathLower = filePath.toLowerCase();
        if (pathLower.includes('/pages/') || pathLower.includes('/screens/')) {
            return 'page';
        }
        if (pathLower.includes('/layouts/')) {
            return 'layout';
        }
        if (content.includes('modal') || content.includes('Modal')) {
            return 'modal';
        }
        if (content.includes('form') || content.includes('Form') ||
            content.includes('input') || content.includes('Input')) {
            return 'form';
        }
        return 'component';
    }
    extractDependencies(content) {
        const dependencies = [];
        // Extract import statements
        const importRegex = /import.*from\s+['"`]([^'"`]+)['"`]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const importPath = match[1];
            if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
                dependencies.push(importPath);
            }
        }
        return [...new Set(dependencies)];
    }
    extractProps(content, framework) {
        const props = [];
        if (framework === 'react') {
            // Extract TypeScript interface props
            const interfaceRegex = /interface\s+\w*Props[^{]*\{([^}]+)\}/g;
            const match = interfaceRegex.exec(content);
            if (match) {
                const propsContent = match[1];
                const propRegex = /(\w+)\s*[?:]?\s*:/g;
                let propMatch;
                while ((propMatch = propRegex.exec(propsContent)) !== null) {
                    props.push(propMatch[1]);
                }
            }
        }
        return props;
    }
    extractState(content, framework) {
        const state = [];
        if (framework === 'react') {
            // Extract useState hooks
            const useStateRegex = /const\s+\[(\w+),\s*set\w+\]\s*=\s*useState/g;
            let match;
            while ((match = useStateRegex.exec(content)) !== null) {
                state.push(match[1]);
            }
        }
        return state;
    }
    extractComponentRoutes(content) {
        const routes = [];
        // Extract route paths
        const routeRegex = /(?:path|route)['"`]\s*:\s*['"`]([^'"`]+)['"`]/g;
        let match;
        while ((match = routeRegex.exec(content)) !== null) {
            routes.push(match[1]);
        }
        return routes;
    }
    extractNavigationTargets(content) {
        const targets = [];
        // Extract navigation calls (navigate, push, etc.)
        const navigationRegex = /(?:navigate|push|replace|href)\s*\(\s*['"`]([^'"`]+)['"`]/g;
        let match;
        while ((match = navigationRegex.exec(content)) !== null) {
            targets.push(match[1]);
        }
        return targets;
    }
    async analyzeNavigationFlows(components, projectPath) {
        const flows = [];
        for (const component of components) {
            if (component.navigationTargets && component.navigationTargets.length > 0) {
                for (const target of component.navigationTargets) {
                    flows.push({
                        from: component.name,
                        to: target,
                        trigger: 'user_action'
                    });
                }
            }
        }
        return flows;
    }
    async extractScreens(components) {
        return components
            .filter(c => c.type === 'page')
            .map(c => c.name);
    }
    async extractRoutes(projectPath, framework) {
        const routes = [];
        try {
            // Look for routing configuration files
            const routeFiles = await this.findRouteFiles(projectPath, framework);
            for (const routeFile of routeFiles) {
                const content = await fs.readFile(routeFile, 'utf-8');
                const fileRoutes = this.extractRoutesFromFile(content);
                routes.push(...fileRoutes);
            }
        }
        catch (error) {
            this.logger.warn('Failed to extract routes:', error);
        }
        return [...new Set(routes)];
    }
    async findRouteFiles(projectPath, framework) {
        const patterns = [];
        switch (framework) {
            case 'react':
                patterns.push('src/**/*{router,route,routing}*.{ts,tsx,js,jsx}');
                break;
            case 'vue':
                patterns.push('src/router/**/*.{ts,js}');
                break;
            case 'angular':
                patterns.push('src/app/**/*routing*.ts');
                break;
        }
        const files = [];
        for (const pattern of patterns) {
            const matches = await (0, glob_1.glob)(pattern, { cwd: projectPath });
            files.push(...matches.map(m => path.join(projectPath, m)));
        }
        return files;
    }
    extractRoutesFromFile(content) {
        const routes = [];
        // Extract various route patterns
        const routePatterns = [
            /path\s*:\s*['"`]([^'"`]+)['"`]/g,
            /route\s*\(\s*['"`]([^'"`]+)['"`]/g,
            /'([^']+)':\s*\w+/g
        ];
        for (const pattern of routePatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                routes.push(match[1]);
            }
        }
        return routes;
    }
    identifySharedComponents(components) {
        const componentUsage = new Map();
        // Count how many times each component is imported
        for (const component of components) {
            for (const dep of component.dependencies) {
                if (dep.startsWith('.') || dep.startsWith('/')) {
                    // Local component import
                    const count = componentUsage.get(dep) || 0;
                    componentUsage.set(dep, count + 1);
                }
            }
        }
        // Return components used in multiple places
        return Array.from(componentUsage.entries())
            .filter(([, count]) => count > 1)
            .map(([component]) => component);
    }
    async buildDependencyMap(components) {
        const dependencyMap = {};
        for (const component of components) {
            dependencyMap[component.name] = component.dependencies;
        }
        return dependencyMap;
    }
    generateRecommendations(components, navigationFlows) {
        const recommendations = [];
        // Check for components with no navigation
        const isolatedComponents = components.filter(c => c.type === 'page' &&
            !navigationFlows.some(f => f.from === c.name || f.to === c.name));
        if (isolatedComponents.length > 0) {
            recommendations.push(`Found ${isolatedComponents.length} isolated pages that may need navigation links`);
        }
        // Check for deeply nested components
        const deepComponents = components.filter(c => c.path.split('/').length > 6);
        if (deepComponents.length > 0) {
            recommendations.push(`Consider flattening component structure for ${deepComponents.length} deeply nested components`);
        }
        // Check for missing prop validation
        const unvalidatedComponents = components.filter(c => c.props && c.props.length > 0 && !c.dependencies.includes('prop-types'));
        if (unvalidatedComponents.length > 0) {
            recommendations.push(`Add prop validation to ${unvalidatedComponents.length} components for better type safety`);
        }
        return recommendations;
    }
}
exports.UINavigationAnalyzer = UINavigationAnalyzer;
exports.default = UINavigationAnalyzer;
//# sourceMappingURL=analyzer.js.map