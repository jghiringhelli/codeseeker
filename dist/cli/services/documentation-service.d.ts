/**
 * Documentation Service
 * Generates package-by-package documentation and creates ADRs for technical decisions
 */
export interface PackageDocumentation {
    packageName: string;
    packagePath: string;
    description: string;
    architecture: {
        pattern: string;
        layers: string[];
        dependencies: string[];
    };
    components: {
        classes: ComponentDoc[];
        interfaces: ComponentDoc[];
        functions: ComponentDoc[];
        constants: ComponentDoc[];
    };
    relationships: {
        internal: string[];
        external: string[];
    };
    technicalDecisions: TechnicalDecision[];
    usage: {
        examples: string[];
        apiReference: string;
    };
    quality: {
        testCoverage: number;
        complexity: number;
        maintainability: string;
    };
}
export interface ComponentDoc {
    name: string;
    type: 'class' | 'interface' | 'function' | 'constant';
    description: string;
    purpose: string;
    parameters?: Array<{
        name: string;
        type: string;
        description: string;
    }>;
    returns?: {
        type: string;
        description: string;
    };
    examples?: string[];
    relatedComponents: string[];
}
export interface TechnicalDecision {
    title: string;
    description: string;
    context: string;
    decision: string;
    consequences: string[];
    alternatives: string[];
    status: 'proposed' | 'accepted' | 'deprecated';
    priority: 'high' | 'medium' | 'low';
    generateADR: boolean;
}
export interface ADRMetadata {
    number: number;
    title: string;
    status: 'Proposed' | 'Accepted' | 'Superseded' | 'Deprecated';
    date: string;
    context: string;
    decision: string;
    consequences: string;
    alternatives?: string;
}
export declare class DocumentationService {
    private logger;
    private codeParser;
    constructor();
    /**
     * Generate comprehensive project documentation
     */
    generateProjectDocumentation(projectPath: string, progressCallback?: (progress: number, current: string) => void): Promise<{
        packages: PackageDocumentation[];
        adrsGenerated: number;
    }>;
    /**
     * Generate documentation for a single package
     */
    generatePackageDocumentation(packagePath: string, packageName: string): Promise<PackageDocumentation>;
    /**
     * Generate ADRs for technical decisions
     */
    generateADRsForDecisions(decisions: TechnicalDecision[]): Promise<number>;
    /**
     * Print documentation generation report
     */
    printDocumentationReport(packages: PackageDocumentation[], adrsGenerated: number): void;
    private discoverPackages;
    private getPackageFiles;
    private documentClasses;
    private documentInterfaces;
    private documentFunctions;
    private documentConstants;
    private identifyTechnicalDecisions;
    private analyzePackageArchitecture;
    private calculateQualityMetrics;
    private generateUsageExamples;
    private writePackageDocumentation;
    private formatPackageDocumentation;
    private getNextADRNumber;
    private createADR;
    private writeADR;
    private generateDocumentationIndex;
    private generatePackageDescription;
    private generateClassDescription;
    private generateInterfaceDescription;
    private generateFunctionDescription;
    private inferClassPurpose;
    private inferFunctionPurpose;
    private extractInternalRelationships;
    private extractExternalRelationships;
    private getQualityIndicator;
}
export default DocumentationService;
//# sourceMappingURL=documentation-service.d.ts.map