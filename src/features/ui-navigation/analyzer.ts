import { Logger } from '../../utils/logger';
import { cliLogger } from '../../utils/colored-logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';

export interface UIComponent {
  name: string;
  path: string;
  type: 'component' | 'page' | 'layout' | 'modal' | 'form';
  framework: 'react' | 'vue' | 'angular' | 'svelte' | 'vanilla';
  dependencies: string[];
  props?: string[];
  state?: string[];
  routes?: string[];
  children?: string[];
  screens?: string[];
  navigationTargets?: string[];
}

export interface NavigationFlow {
  from: string;
  to: string;
  trigger: string;
  conditions?: string[];
  parameters?: string[];
}

export interface UIAnalysisResult {
  components: UIComponent[];
  navigationFlows: NavigationFlow[];
  screens: string[];
  routes: string[];
  sharedComponents: string[];
  dependencies: Record<string, string[]>;
  recommendations: string[];
}

export class UINavigationAnalyzer {
  private logger = Logger.getInstance();

  async analyzeUI(params: {
    projectPath: string;
    includeScreens?: boolean;
    includeComponents?: boolean;
    includeNavigationFlows?: boolean;
    frameworks?: string[];
  }): Promise<UIAnalysisResult> {
    const startTime = Date.now();
    
    cliLogger.toolExecution('ui-navigation-analyzer', 'started');
    
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
      
      const result: UIAnalysisResult = {
        components,
        navigationFlows,
        screens,
        routes,
        sharedComponents,
        dependencies,
        recommendations
      };
      
      const duration = Date.now() - startTime;
      cliLogger.toolExecution('ui-navigation-analyzer', 'completed', duration, {
        componentsFound: components.length,
        screensFound: screens.length,
        navigationFlows: navigationFlows.length,
        framework
      });
      
      return result;
      
    } catch (error) {
      cliLogger.toolExecution('ui-navigation-analyzer', 'failed', Date.now() - startTime, error);
      throw error;
    }
  }

  private async detectFramework(projectPath: string): Promise<string> {
    try {
      const packageJson = JSON.parse(
        await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8')
      );
      
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      if (deps.react || deps['@types/react']) return 'react';
      if (deps.vue || deps['@vue/cli']) return 'vue';
      if (deps['@angular/core']) return 'angular';
      if (deps.svelte) return 'svelte';
      
      return 'vanilla';
    } catch {
      return 'vanilla';
    }
  }

  private async findUIComponents(projectPath: string, framework: string): Promise<UIComponent[]> {
    const components: UIComponent[] = [];
    
    // Define search patterns based on framework
    const patterns = this.getComponentPatterns(framework);
    
    for (const pattern of patterns) {
      const files = await glob(pattern, { cwd: projectPath });
      
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

  private getComponentPatterns(framework: string): string[] {
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

  private async analyzeComponentFile(filePath: string, framework: string): Promise<UIComponent | null> {
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
        framework: framework as any,
        dependencies,
        props,
        state,
        routes,
        navigationTargets
      };
      
    } catch (error) {
      this.logger.warn(`Failed to analyze component ${filePath}:`, error);
      return null;
    }
  }

  private determineComponentType(filePath: string, content: string): UIComponent['type'] {
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

  private extractDependencies(content: string): string[] {
    const dependencies: string[] = [];
    
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

  private extractProps(content: string, framework: string): string[] {
    const props: string[] = [];
    
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

  private extractState(content: string, framework: string): string[] {
    const state: string[] = [];
    
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

  private extractComponentRoutes(content: string): string[] {
    const routes: string[] = [];
    
    // Extract route paths
    const routeRegex = /(?:path|route)['"`]\s*:\s*['"`]([^'"`]+)['"`]/g;
    let match;
    
    while ((match = routeRegex.exec(content)) !== null) {
      routes.push(match[1]);
    }
    
    return routes;
  }

  private extractNavigationTargets(content: string): string[] {
    const targets: string[] = [];
    
    // Extract navigation calls (navigate, push, etc.)
    const navigationRegex = /(?:navigate|push|replace|href)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let match;
    
    while ((match = navigationRegex.exec(content)) !== null) {
      targets.push(match[1]);
    }
    
    return targets;
  }

  private async analyzeNavigationFlows(components: UIComponent[], projectPath: string): Promise<NavigationFlow[]> {
    const flows: NavigationFlow[] = [];
    
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

  private async extractScreens(components: UIComponent[]): Promise<string[]> {
    return components
      .filter(c => c.type === 'page')
      .map(c => c.name);
  }

  private async extractRoutes(projectPath: string, framework: string): Promise<string[]> {
    const routes: string[] = [];
    
    try {
      // Look for routing configuration files
      const routeFiles = await this.findRouteFiles(projectPath, framework);
      
      for (const routeFile of routeFiles) {
        const content = await fs.readFile(routeFile, 'utf-8');
        const fileRoutes = this.extractRoutesFromFile(content);
        routes.push(...fileRoutes);
      }
    } catch (error) {
      this.logger.warn('Failed to extract routes:', error);
    }
    
    return [...new Set(routes)];
  }

  private async findRouteFiles(projectPath: string, framework: string): Promise<string[]> {
    const patterns: string[] = [];
    
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
    
    const files: string[] = [];
    for (const pattern of patterns) {
      const matches = await glob(pattern, { cwd: projectPath });
      files.push(...matches.map(m => path.join(projectPath, m)));
    }
    
    return files;
  }

  private extractRoutesFromFile(content: string): string[] {
    const routes: string[] = [];
    
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

  private identifySharedComponents(components: UIComponent[]): string[] {
    const componentUsage = new Map<string, number>();
    
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

  private async buildDependencyMap(components: UIComponent[]): Promise<Record<string, string[]>> {
    const dependencyMap: Record<string, string[]> = {};
    
    for (const component of components) {
      dependencyMap[component.name] = component.dependencies;
    }
    
    return dependencyMap;
  }

  private generateRecommendations(components: UIComponent[], navigationFlows: NavigationFlow[]): string[] {
    const recommendations: string[] = [];
    
    // Check for components with no navigation
    const isolatedComponents = components.filter(c => 
      c.type === 'page' && 
      !navigationFlows.some(f => f.from === c.name || f.to === c.name)
    );
    
    if (isolatedComponents.length > 0) {
      recommendations.push(`Found ${isolatedComponents.length} isolated pages that may need navigation links`);
    }
    
    // Check for deeply nested components
    const deepComponents = components.filter(c => 
      c.path.split('/').length > 6
    );
    
    if (deepComponents.length > 0) {
      recommendations.push(`Consider flattening component structure for ${deepComponents.length} deeply nested components`);
    }
    
    // Check for missing prop validation
    const unvalidatedComponents = components.filter(c => 
      c.props && c.props.length > 0 && !c.dependencies.includes('prop-types')
    );
    
    if (unvalidatedComponents.length > 0) {
      recommendations.push(`Add prop validation to ${unvalidatedComponents.length} components for better type safety`);
    }
    
    return recommendations;
  }
}

export default UINavigationAnalyzer;