import { Tool, ToolSelectionContext } from './intelligent-tool-selector';
import { Database } from '../database/database';
export interface ToolBundle {
    id: string;
    name: string;
    description: string;
    category: string;
    tools: string[];
    dependencies: string[];
    conditions: BundleCondition[];
    executionOrder?: 'parallel' | 'sequential' | 'dependency-based';
    priority: number;
    tokenCost: 'low' | 'medium' | 'high';
    estimatedTime: 'fast' | 'medium' | 'slow';
    scenarios: string[];
    autoTrigger?: string[];
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
    weight: number;
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
export declare class ToolBundleSystem {
    private logger;
    private db;
    private configPath;
    private bundles;
    private tools;
    private descriptions;
    constructor(database: Database, configPath?: string);
    initialize(): Promise<void>;
    createBundle(bundle: Omit<ToolBundle, 'id' | 'created' | 'lastModified'>): Promise<string>;
    updateBundle(id: string, updates: Partial<ToolBundle>): Promise<void>;
    deleteBundle(id: string): Promise<void>;
    selectBundlesAndTools(context: ToolSelectionContext): Promise<BundleSelectionResult>;
    private evaluateBundles;
    private evaluateCondition;
    private compareValue;
    private matchScenario;
    private evaluateIndividualTools;
    private optimizeSelection;
    private createExecutionPlan;
    private resolveDependencies;
    private generateSelectionReasoning;
    private calculateTokenCost;
    private estimateExecutionTime;
    updateToolDescription(toolId: string, description: string, modifiedBy?: string): Promise<void>;
    updateBundleDescription(bundleId: string, description: string, modifiedBy?: string): Promise<void>;
    resetToDefault(id: string): Promise<void>;
    getAllBundles(): ToolBundle[];
    getBundle(id: string): ToolBundle | undefined;
    getAllDescriptions(): ConfigurableDescription[];
    getDescription(id: string): ConfigurableDescription | undefined;
    private loadDefaultBundles;
    private loadCustomBundles;
    private loadDescriptionsFromDatabase;
    private syncWithFileSystem;
    private syncConfigFile;
    private saveBundleToDatabase;
    private deleteBundleFromDatabase;
    private saveDescriptionToDatabase;
}
//# sourceMappingURL=tool-bundle-system.d.ts.map