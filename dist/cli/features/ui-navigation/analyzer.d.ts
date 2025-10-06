/**
 * UI Navigation Analyzer - Simplified Frontend Flow Understanding
 * Analyzes UI components, navigation flows, and user journeys for Claude Code context enhancement
 */
export interface UINavigationAnalysisRequest {
    projectPath: string;
    framework?: string;
    excludePatterns?: string[];
}
export interface UIComponent {
    path: string;
    name: string;
    type: 'component' | 'page' | 'layout' | 'hook' | 'service';
    framework: string;
    dependencies: string[];
    exports: string[];
    props: ComponentProp[];
    routes: RouteInfo[];
    isShared: boolean;
    complexity: number;
}
export interface ComponentProp {
    name: string;
    type: string;
    required: boolean;
    description?: string;
}
export interface RouteInfo {
    path: string;
    method?: string;
    component?: string;
    guards?: string[];
    params?: string[];
}
export interface NavigationFlow {
    id: string;
    name: string;
    steps: NavigationStep[];
    entryPoints: string[];
    exitPoints: string[];
    userType: 'authenticated' | 'anonymous' | 'admin' | 'all';
    businessValue: 'high' | 'medium' | 'low';
}
export interface NavigationStep {
    component: string;
    action: string;
    trigger: string;
    nextComponent?: string;
    conditions?: string[];
}
export interface Screen {
    id: string;
    name: string;
    route: string;
    component: string;
    type: 'page' | 'modal' | 'overlay' | 'form';
    dependencies: string[];
    dataRequirements: string[];
}
export interface UINavigationResult {
    framework: string;
    components: UIComponent[];
    navigationFlows: NavigationFlow[];
    screens: Screen[];
    routes: RouteInfo[];
    sharedComponents: string[];
    recommendations: string[];
    architectureHealth: {
        score: number;
        componentReusability: number;
        navigationComplexity: number;
        issues: string[];
        strengths: string[];
    };
    mermaidDiagrams: {
        componentGraph: string;
        navigationFlow: string;
        screenFlow: string;
    };
}
export declare class UINavigationAnalyzer {
    private logger;
    analyzeUI(params: UINavigationAnalysisRequest): Promise<UINavigationResult>;
    private detectFramework;
    private findUIComponents;
    private getComponentPatterns;
    private analyzeComponent;
    private determineComponentType;
    private extractDependencies;
    private extractExports;
    private extractProps;
    private extractComponentRoutes;
    private isSharedComponent;
    private calculateComponentComplexity;
    private analyzeNavigationFlows;
    private createAuthenticationFlow;
    private createDashboardFlow;
    private createProfileFlow;
    private extractScreens;
    private extractDataRequirements;
    private extractRoutes;
    private getRoutePatterns;
    private extractRoutesFromFile;
    private identifySharedComponents;
    private assessArchitectureHealth;
    private generateRecommendations;
    private generateComponentMermaid;
    private generateNavigationMermaid;
    private generateScreenFlowMermaid;
}
export default UINavigationAnalyzer;
//# sourceMappingURL=analyzer.d.ts.map