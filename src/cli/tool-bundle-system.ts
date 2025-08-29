import { Tool, ToolSelectionContext } from './intelligent-tool-selector';
import { Database } from '../database/database';
import { Logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

export interface ToolBundle {
  id: string;
  name: string;
  description: string;
  category: string;
  tools: string[]; // Tool IDs in this bundle
  dependencies: string[]; // Other bundle IDs this depends on
  conditions: BundleCondition[];
  executionOrder?: 'parallel' | 'sequential' | 'dependency-based';
  priority: number; // Higher priority bundles are preferred
  tokenCost: 'low' | 'medium' | 'high';
  estimatedTime: 'fast' | 'medium' | 'slow';
  scenarios: string[]; // Scenarios where this bundle is most useful
  autoTrigger?: string[]; // Keywords that auto-trigger this bundle
  version: string;
  created: Date;
  lastModified: Date;
  isDefault: boolean;
  isActive: boolean;
}

export interface BundleCondition {
  type: 'codebase_size' | 'language' | 'framework' | 'task_type' | 'context' | 'custom';
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'matches_regex';
  value: string | number;
  weight: number; // 0-1, how important this condition is
}

export interface BundleSelectionResult {
  selectedBundles: ToolBundle[];
  selectedTools: Tool[];
  executionPlan: ExecutionStep[];
  reasoning: string;
  totalTokenCost: number;
  estimatedTime: number;
}

export interface ExecutionStep {
  type: 'tool' | 'bundle';
  id: string;
  name: string;
  dependsOn: string[];
  canRunInParallel: boolean;
  order: number;
}

export interface ConfigurableDescription {
  id: string;
  type: 'tool' | 'bundle';
  name: string;
  description: string;
  defaultDescription: string;
  lastModified: Date;
  modifiedBy: string;
  isCustom: boolean;
}

export class ToolBundleSystem {
  private logger = Logger.getInstance();
  private db: Database;
  private configPath: string;
  private bundles: Map<string, ToolBundle> = new Map();
  private tools: Map<string, Tool> = new Map();
  private descriptions: Map<string, ConfigurableDescription> = new Map();

  constructor(database: Database, configPath?: string) {
    this.db = database;
    this.configPath = configPath || path.join(process.cwd(), 'config', 'tool-bundles.json');
  }

  async initialize(): Promise<void> {
    await this.loadDefaultBundles();
    await this.loadCustomBundles();
    await this.loadDescriptionsFromDatabase();
    await this.syncWithFileSystem();
    this.logger.info('Tool Bundle System initialized');
  }

  // Bundle Management
  async createBundle(bundle: Omit<ToolBundle, 'id' | 'created' | 'lastModified'>): Promise<string> {
    const id = `bundle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newBundle: ToolBundle = {
      ...bundle,
      id,
      created: new Date(),
      lastModified: new Date()
    };

    this.bundles.set(id, newBundle);
    await this.saveBundleToDatabase(newBundle);
    await this.syncConfigFile();
    
    this.logger.info(`Created bundle: ${bundle.name} (${id})`);
    return id;
  }

  async updateBundle(id: string, updates: Partial<ToolBundle>): Promise<void> {
    const existing = this.bundles.get(id);
    if (!existing) {
      throw new Error(`Bundle not found: ${id}`);
    }

    const updated: ToolBundle = {
      ...existing,
      ...updates,
      id,
      lastModified: new Date()
    };

    this.bundles.set(id, updated);
    await this.saveBundleToDatabase(updated);
    await this.syncConfigFile();
    
    this.logger.info(`Updated bundle: ${updated.name} (${id})`);
  }

  async deleteBundle(id: string): Promise<void> {
    const bundle = this.bundles.get(id);
    if (!bundle) {
      throw new Error(`Bundle not found: ${id}`);
    }

    this.bundles.delete(id);
    await this.deleteBundleFromDatabase(id);
    await this.syncConfigFile();
    
    this.logger.info(`Deleted bundle: ${bundle.name} (${id})`);
  }

  // Smart Bundle Selection
  async selectBundlesAndTools(context: ToolSelectionContext): Promise<BundleSelectionResult> {
    const candidateBundles = this.evaluateBundles(context);
    const candidateTools = this.evaluateIndividualTools(context);
    
    const selected = await this.optimizeSelection(candidateBundles, candidateTools, context);
    const executionPlan = this.createExecutionPlan(selected.bundles, selected.tools);
    
    return {
      selectedBundles: selected.bundles,
      selectedTools: selected.tools,
      executionPlan,
      reasoning: this.generateSelectionReasoning(selected, context),
      totalTokenCost: this.calculateTokenCost(selected.bundles, selected.tools),
      estimatedTime: this.estimateExecutionTime(executionPlan)
    };
  }

  private evaluateBundles(context: ToolSelectionContext): Array<{bundle: ToolBundle, score: number}> {
    const evaluated: Array<{bundle: ToolBundle, score: number}> = [];
    
    for (const bundle of this.bundles.values()) {
      if (!bundle.isActive) continue;
      
      let score = bundle.priority;
      
      // Evaluate conditions
      for (const condition of bundle.conditions) {
        const conditionScore = this.evaluateCondition(condition, context);
        score += conditionScore * condition.weight;
      }
      
      // Check auto-triggers
      if (bundle.autoTrigger) {
        const taskLower = context.task.toLowerCase();
        for (const trigger of bundle.autoTrigger) {
          if (taskLower.includes(trigger.toLowerCase())) {
            score += 2; // Auto-trigger bonus
          }
        }
      }
      
      // Scenario matching
      if (bundle.scenarios.length > 0) {
        const scenarioMatch = this.matchScenario(bundle.scenarios, context);
        score += scenarioMatch;
      }
      
      evaluated.push({ bundle, score });
    }
    
    return evaluated.sort((a, b) => b.score - a.score);
  }

  private evaluateCondition(condition: BundleCondition, context: ToolSelectionContext): number {
    try {
      switch (condition.type) {
        case 'codebase_size':
          if (!context.codebaseContext) return 0;
          return this.compareValue(context.codebaseContext.size, condition.operator, condition.value) ? 1 : 0;
        
        case 'language':
          if (!context.codebaseContext) return 0;
          return context.codebaseContext.primaryLanguages.some(lang => 
            this.compareValue(lang, condition.operator, condition.value)
          ) ? 1 : 0;
        
        case 'framework':
          if (!context.codebaseContext) return 0;
          return context.codebaseContext.frameworks.some(fw => 
            this.compareValue(fw, condition.operator, condition.value)
          ) ? 1 : 0;
        
        case 'task_type':
          return this.compareValue(context.task, condition.operator, condition.value) ? 1 : 0;
        
        case 'context':
          return this.compareValue(JSON.stringify(context), condition.operator, condition.value) ? 1 : 0;
        
        default:
          return 0;
      }
    } catch (error) {
      this.logger.warn(`Error evaluating condition: ${error}`);
      return 0;
    }
  }

  private compareValue(actual: any, operator: string, expected: any): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'contains':
        return String(actual).toLowerCase().includes(String(expected).toLowerCase());
      case 'greater_than':
        return Number(actual) > Number(expected);
      case 'less_than':
        return Number(actual) < Number(expected);
      case 'matches_regex':
        return new RegExp(String(expected), 'i').test(String(actual));
      default:
        return false;
    }
  }

  private matchScenario(scenarios: string[], context: ToolSelectionContext): number {
    const taskLower = context.task.toLowerCase();
    let score = 0;
    
    for (const scenario of scenarios) {
      if (taskLower.includes(scenario.toLowerCase())) {
        score += 1;
      }
    }
    
    return score;
  }

  private evaluateIndividualTools(context: ToolSelectionContext): Array<{tool: Tool, score: number}> {
    // This would integrate with the existing intelligent tool selector
    // For now, return empty array as individual tools will be handled by existing system
    return [];
  }

  private async optimizeSelection(
    candidateBundles: Array<{bundle: ToolBundle, score: number}>,
    candidateTools: Array<{tool: Tool, score: number}>,
    context: ToolSelectionContext
  ): Promise<{bundles: ToolBundle[], tools: Tool[]}> {
    const selectedBundles: ToolBundle[] = [];
    const selectedTools: Tool[] = [];
    const includedToolIds = new Set<string>();
    
    // Select top bundles
    const topBundles = candidateBundles.slice(0, 3); // Limit to prevent overwhelming
    
    for (const {bundle} of topBundles) {
      selectedBundles.push(bundle);
      
      // Add tools from bundle
      for (const toolId of bundle.tools) {
        if (!includedToolIds.has(toolId)) {
          const tool = this.tools.get(toolId);
          if (tool) {
            selectedTools.push(tool);
            includedToolIds.add(toolId);
          }
        }
      }
    }
    
    // Add individual tools that aren't already included
    for (const {tool} of candidateTools) {
      if (!includedToolIds.has(tool.name)) {
        selectedTools.push(tool);
        includedToolIds.add(tool.name);
      }
    }
    
    return { bundles: selectedBundles, tools: selectedTools };
  }

  private createExecutionPlan(bundles: ToolBundle[], tools: Tool[]): ExecutionStep[] {
    const steps: ExecutionStep[] = [];
    let order = 0;
    
    // Process bundles first
    for (const bundle of bundles) {
      steps.push({
        type: 'bundle',
        id: bundle.id,
        name: bundle.name,
        dependsOn: bundle.dependencies,
        canRunInParallel: bundle.executionOrder === 'parallel',
        order: order++
      });
    }
    
    // Then individual tools
    for (const tool of tools) {
      steps.push({
        type: 'tool',
        id: tool.name,
        name: tool.name,
        dependsOn: tool.dependencies,
        canRunInParallel: tool.parallelizable,
        order: order++
      });
    }
    
    // Sort by dependencies and order
    return this.resolveDependencies(steps);
  }

  private resolveDependencies(steps: ExecutionStep[]): ExecutionStep[] {
    // Simple topological sort
    const resolved: ExecutionStep[] = [];
    const visited = new Set<string>();
    
    const visit = (step: ExecutionStep) => {
      if (visited.has(step.id)) return;
      
      for (const depId of step.dependsOn) {
        const dep = steps.find(s => s.id === depId);
        if (dep && !visited.has(dep.id)) {
          visit(dep);
        }
      }
      
      visited.add(step.id);
      resolved.push(step);
    };
    
    for (const step of steps) {
      visit(step);
    }
    
    return resolved;
  }

  private generateSelectionReasoning(
    selected: {bundles: ToolBundle[], tools: Tool[]},
    context: ToolSelectionContext
  ): string {
    const reasons: string[] = [];
    
    if (selected.bundles.length > 0) {
      reasons.push(`Selected ${selected.bundles.length} bundle(s): ${selected.bundles.map(b => b.name).join(', ')}`);
    }
    
    if (selected.tools.length > 0) {
      reasons.push(`Selected ${selected.tools.length} individual tool(s): ${selected.tools.map(t => t.name).join(', ')}`);
    }
    
    reasons.push(`Based on task: "${context.task}"`);
    
    if (context.codebaseContext) {
      reasons.push(`Codebase context: ${context.codebaseContext.complexity} complexity, ${context.codebaseContext.primaryLanguages.join(', ')}`);
    }
    
    return reasons.join('. ');
  }

  private calculateTokenCost(bundles: ToolBundle[], tools: Tool[]): number {
    let total = 0;
    const costMap = { low: 1, medium: 3, high: 5 };
    
    for (const bundle of bundles) {
      total += costMap[bundle.tokenCost];
    }
    
    for (const tool of tools) {
      total += costMap[tool.tokenCost];
    }
    
    return total;
  }

  private estimateExecutionTime(steps: ExecutionStep[]): number {
    // Estimate in seconds
    const timeMap = { fast: 5, medium: 15, slow: 30 };
    const parallelSteps = steps.filter(s => s.canRunInParallel);
    const sequentialSteps = steps.filter(s => !s.canRunInParallel);
    
    const parallelTime = parallelSteps.length > 0 ? timeMap.medium : 0; // Assume parallel steps take medium time
    const sequentialTime = sequentialSteps.length * timeMap.medium;
    
    return parallelTime + sequentialTime;
  }

  // Configuration Management
  async updateToolDescription(toolId: string, description: string, modifiedBy: string = 'user'): Promise<void> {
    const existing = this.descriptions.get(toolId);
    const updated: ConfigurableDescription = {
      id: toolId,
      type: 'tool',
      name: toolId,
      description,
      defaultDescription: existing?.defaultDescription || description,
      lastModified: new Date(),
      modifiedBy,
      isCustom: true
    };

    this.descriptions.set(toolId, updated);
    await this.saveDescriptionToDatabase(updated);
    this.logger.info(`Updated tool description: ${toolId}`);
  }

  async updateBundleDescription(bundleId: string, description: string, modifiedBy: string = 'user'): Promise<void> {
    const bundle = this.bundles.get(bundleId);
    if (!bundle) {
      throw new Error(`Bundle not found: ${bundleId}`);
    }

    await this.updateBundle(bundleId, { description });
    
    const updated: ConfigurableDescription = {
      id: bundleId,
      type: 'bundle',
      name: bundle.name,
      description,
      defaultDescription: bundle.description,
      lastModified: new Date(),
      modifiedBy,
      isCustom: true
    };

    this.descriptions.set(bundleId, updated);
    await this.saveDescriptionToDatabase(updated);
    this.logger.info(`Updated bundle description: ${bundleId}`);
  }

  async resetToDefault(id: string): Promise<void> {
    const description = this.descriptions.get(id);
    if (!description) {
      throw new Error(`Description not found: ${id}`);
    }

    if (description.type === 'bundle') {
      await this.updateBundle(id, { description: description.defaultDescription });
    }

    description.description = description.defaultDescription;
    description.isCustom = false;
    description.lastModified = new Date();

    this.descriptions.set(id, description);
    await this.saveDescriptionToDatabase(description);
    this.logger.info(`Reset to default description: ${id}`);
  }

  // Data Access
  getAllBundles(): ToolBundle[] {
    return Array.from(this.bundles.values());
  }

  getBundle(id: string): ToolBundle | undefined {
    return this.bundles.get(id);
  }

  getAllDescriptions(): ConfigurableDescription[] {
    return Array.from(this.descriptions.values());
  }

  getDescription(id: string): ConfigurableDescription | undefined {
    return this.descriptions.get(id);
  }

  // Private helper methods
  private async loadDefaultBundles(): Promise<void> {
    const defaultBundles: ToolBundle[] = [
      {
        id: 'code-analysis-bundle',
        name: 'Code Analysis Bundle',
        description: 'Comprehensive code analysis including structure, patterns, and quality metrics',
        category: 'analysis',
        tools: ['ast-analyzer', 'pattern-detector', 'quality-metrics', 'complexity-analyzer'],
        dependencies: [],
        conditions: [
          { type: 'task_type', operator: 'contains', value: 'analyze', weight: 0.8 },
          { type: 'codebase_size', operator: 'greater_than', value: 1000, weight: 0.6 }
        ],
        executionOrder: 'parallel',
        priority: 5,
        tokenCost: 'medium',
        estimatedTime: 'medium',
        scenarios: ['code review', 'refactoring', 'quality assessment'],
        autoTrigger: ['analyze', 'review', 'assess'],
        version: '1.0.0',
        created: new Date(),
        lastModified: new Date(),
        isDefault: true,
        isActive: true
      },
      {
        id: 'documentation-bundle',
        name: 'Documentation Bundle',
        description: 'Generate and update project documentation, README files, and API docs',
        category: 'documentation',
        tools: ['readme-generator', 'api-doc-generator', 'comment-analyzer', 'doc-validator'],
        dependencies: ['code-analysis-bundle'],
        conditions: [
          { type: 'task_type', operator: 'contains', value: 'document', weight: 0.9 },
          { type: 'task_type', operator: 'contains', value: 'readme', weight: 0.8 }
        ],
        executionOrder: 'sequential',
        priority: 4,
        tokenCost: 'medium',
        estimatedTime: 'medium',
        scenarios: ['project setup', 'documentation update', 'onboarding'],
        autoTrigger: ['document', 'readme', 'docs'],
        version: '1.0.0',
        created: new Date(),
        lastModified: new Date(),
        isDefault: true,
        isActive: true
      },
      {
        id: 'testing-bundle',
        name: 'Testing Bundle',
        description: 'Comprehensive testing suite including unit tests, integration tests, and coverage',
        category: 'testing',
        tools: ['test-generator', 'coverage-analyzer', 'test-runner', 'mock-generator'],
        dependencies: [],
        conditions: [
          { type: 'task_type', operator: 'contains', value: 'test', weight: 0.9 },
          { type: 'context', operator: 'contains', value: 'hasTests', weight: 0.7 }
        ],
        executionOrder: 'sequential',
        priority: 6,
        tokenCost: 'high',
        estimatedTime: 'slow',
        scenarios: ['test creation', 'coverage improvement', 'quality assurance'],
        autoTrigger: ['test', 'coverage', 'unit test', 'integration'],
        version: '1.0.0',
        created: new Date(),
        lastModified: new Date(),
        isDefault: true,
        isActive: true
      }
    ];

    for (const bundle of defaultBundles) {
      this.bundles.set(bundle.id, bundle);
    }
  }

  private async loadCustomBundles(): Promise<void> {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        for (const bundleData of configData.bundles || []) {
          this.bundles.set(bundleData.id, bundleData);
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to load config file: ${error}`);
    }
  }

  private async loadDescriptionsFromDatabase(): Promise<void> {
    // Implementation would load from database
    // For now, creating default descriptions
  }

  private async syncWithFileSystem(): Promise<void> {
    await this.syncConfigFile();
  }

  private async syncConfigFile(): Promise<void> {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const config = {
        bundles: Array.from(this.bundles.values()),
        lastUpdated: new Date().toISOString(),
        version: '1.0.0'
      };

      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      this.logger.error(`Failed to sync config file: ${error}`);
    }
  }

  private async saveBundleToDatabase(bundle: ToolBundle): Promise<void> {
    // Implementation would save to database
    this.logger.debug(`Would save bundle to database: ${bundle.id}`);
  }

  private async deleteBundleFromDatabase(id: string): Promise<void> {
    // Implementation would delete from database
    this.logger.debug(`Would delete bundle from database: ${id}`);
  }

  private async saveDescriptionToDatabase(description: ConfigurableDescription): Promise<void> {
    // Implementation would save to database
    this.logger.debug(`Would save description to database: ${description.id}`);
  }
}