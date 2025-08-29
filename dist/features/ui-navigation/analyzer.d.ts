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
export declare class UINavigationAnalyzer {
    private logger;
    analyzeUI(params: {
        projectPath: string;
        includeScreens?: boolean;
        includeComponents?: boolean;
        includeNavigationFlows?: boolean;
        frameworks?: string[];
    }): Promise<UIAnalysisResult>;
    private detectFramework;
    private findUIComponents;
    private getComponentPatterns;
    private analyzeComponentFile;
    private determineComponentType;
    private extractDependencies;
    private extractProps;
    private extractState;
    private extractComponentRoutes;
    private extractNavigationTargets;
    private analyzeNavigationFlows;
    private extractScreens;
    private extractRoutes;
    private findRouteFiles;
    private extractRoutesFromFile;
    private identifySharedComponents;
    private buildDependencyMap;
    private generateRecommendations;
}
export default UINavigationAnalyzer;
//# sourceMappingURL=analyzer.d.ts.map