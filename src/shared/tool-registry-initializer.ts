/**
 * Tool Registry Initializer - Auto-discovers and registers all internal tools
 * Bridges enhanced tools with the InternalTool interface via adapters
 */

import { ToolRegistry } from './tool-interface';
import { ToolAdapter } from './tool-adapter';
import { Logger, LogLevel } from '../utils/logger';
import path from 'path';

export class ToolRegistryInitializer {
  private static logger = new Logger(LogLevel.INFO, 'ToolRegistryInitializer');

  /**
   * Initialize all available tools and register them
   */
  static async initializeAllTools(projectRoot: string = process.cwd()): Promise<void> {
    this.logger.info('Discovering and registering internal tools...');

    const toolConfigurations = [
      {
        name: 'tree-navigator',
        path: '../features/tree-navigation/navigator',
        className: 'TreeNavigator'
      },
      {
        name: 'compilation-verifier',
        path: '../features/compilation/verifier',
        className: 'CompilationVerifier'
      },
      {
        name: 'solid-analyzer',
        path: '../features/solid-principles/analyzer',
        className: 'SOLIDAnalyzer'
      },
      {
        name: 'centralization-detector',
        path: '../features/centralization/detector',
        className: 'CentralizationDetector'
      },
      {
        name: 'ui-navigator',
        path: '../features/ui-navigation/analyzer',
        className: 'UINavigationAnalyzer'
      },
      {
        name: 'use-case-analyzer',
        path: '../features/use-cases/analyzer',
        className: 'UseCaseAnalyzer'
      },
      {
        name: 'semantic-search',
        path: '../features/search/semantic-search-complete',
        className: 'SemanticSearchTool'
      }
    ];

    let registeredCount = 0;

    for (const config of toolConfigurations) {
      try {
        await this.registerTool(config, projectRoot);
        registeredCount++;
      } catch (error) {
        this.logger.warn(`Failed to register tool ${config.name}: ${error}`);
      }
    }

    this.logger.info(`Successfully registered ${registeredCount}/${toolConfigurations.length} tools`);
  }

  /**
   * Register a single tool with error handling
   */
  private static async registerTool(config: {
    name: string;
    path: string;
    className: string;
  }, projectRoot: string): Promise<void> {
    try {
      // Determine the correct path based on whether we're in dist or src
      const possiblePaths = [
        path.resolve(__dirname, config.path),
        path.resolve(projectRoot, 'dist', 'features', config.name.replace('-', '/'), config.className.toLowerCase()),
        path.resolve(projectRoot, 'src', 'features', config.name.replace('-', '/'), config.className.toLowerCase())
      ];

      let toolModule = null;
      let loadedPath = '';

      // Try each possible path
      for (const tryPath of possiblePaths) {
        try {
          toolModule = require(tryPath);
          loadedPath = tryPath;
          break;
        } catch (error) {
          // Try next path
          continue;
        }
      }

      if (!toolModule) {
        throw new Error(`Could not load module from any of the attempted paths`);
      }

      // Find the tool class in the module
      const ToolClass = toolModule[config.className] || 
                       toolModule.default || 
                       Object.values(toolModule).find(exp => 
                         typeof exp === 'function' && exp.name === config.className
                       );

      if (!ToolClass || typeof ToolClass !== 'function') {
        throw new Error(`Could not find class ${config.className} in module`);
      }

      // Create instance and adapt to InternalTool interface
      const toolInstance = new ToolClass();
      
      // Verify it has the required methods for enhanced interface
      if (!toolInstance.getDatabaseToolName || !toolInstance.performAnalysis) {
        throw new Error(`Tool ${config.name} does not implement AnalysisTool interface`);
      }

      const adaptedTool = new ToolAdapter(toolInstance);
      ToolRegistry.registerTool(config.name, adaptedTool);

      this.logger.info(`✅ Registered tool: ${config.name} from ${loadedPath}`);

    } catch (error) {
      this.logger.error(`❌ Failed to register tool ${config.name}: ${error}`);
      throw error;
    }
  }

  /**
   * Get tool registration status
   */
  static getRegistrationStatus(): {
    totalRegistered: number;
    availableTools: string[];
    toolsByCategory: Record<string, string[]>;
  } {
    const allTools = ToolRegistry.getAllTools();
    const toolsByCategory: Record<string, string[]> = {};

    allTools.forEach(tool => {
      const metadata = tool.getMetadata();
      if (!toolsByCategory[metadata.category]) {
        toolsByCategory[metadata.category] = [];
      }
      toolsByCategory[metadata.category].push(metadata.name);
    });

    return {
      totalRegistered: allTools.length,
      availableTools: allTools.map(tool => tool.getMetadata().name),
      toolsByCategory
    };
  }

  /**
   * Verify all registered tools are healthy
   */
  static async verifyAllTools(projectId: string): Promise<{
    healthy: string[];
    unhealthy: string[];
    details: Record<string, any>;
  }> {
    const allTools = ToolRegistry.getAllTools();
    const healthy: string[] = [];
    const unhealthy: string[] = [];
    const details: Record<string, any> = {};

    for (const tool of allTools) {
      try {
        const status = await tool.getStatus(projectId);
        const toolName = tool.getMetadata().name;
        
        details[toolName] = status;
        
        if (status.health === 'healthy') {
          healthy.push(toolName);
        } else {
          unhealthy.push(toolName);
        }
      } catch (error) {
        const toolName = tool.getMetadata().name;
        unhealthy.push(toolName);
        details[toolName] = { 
          health: 'error', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    }

    return { healthy, unhealthy, details };
  }
}