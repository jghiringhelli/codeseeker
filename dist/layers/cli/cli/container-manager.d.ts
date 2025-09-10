export interface ContainerConfig {
    name: string;
    image: string;
    ports?: {
        [key: string]: string;
    };
    volumes?: {
        [key: string]: string;
    };
    environment?: {
        [key: string]: string;
    };
    networks?: string[];
    dependsOn?: string[];
    healthCheck?: {
        command: string;
        interval: string;
        timeout: string;
        retries: number;
    };
}
export interface DockerComposeConfig {
    version: string;
    services: {
        [key: string]: any;
    };
    volumes?: {
        [key: string]: any;
    };
    networks?: {
        [key: string]: any;
    };
}
/**
 * Container Manager for CodeMind CLI
 * Integrates Docker and containerization tools with intelligent configuration
 */
export declare class ContainerManager {
    private logger;
    private projectPath;
    private configPath;
    constructor(projectPath: string);
    /**
     * Initialize containerization for project
     */
    initializeContainerization(options: {
        includeDatabase?: boolean;
        includeRedis?: boolean;
        includeMonitoring?: boolean;
        customServices?: ContainerConfig[];
    }): Promise<DockerComposeConfig>;
    /**
     * Create application service configuration
     */
    private createApplicationService;
    /**
     * Create database service configuration
     */
    private createDatabaseService;
    /**
     * Create Redis service configuration
     */
    private createRedisService;
    /**
     * Create monitoring services (optional)
     */
    private createMonitoringServices;
    /**
     * Convert ContainerConfig to Docker Compose service
     */
    private containerConfigToDockerService;
    /**
     * Generate Docker Compose file
     */
    generateDockerCompose(config: DockerComposeConfig): Promise<string>;
    /**
     * Generate environment file
     */
    generateEnvironmentFile(config: DockerComposeConfig): Promise<string>;
    /**
     * Start containers
     */
    startContainers(options?: {
        detached?: boolean;
        build?: boolean;
    }): Promise<void>;
    /**
     * Stop containers
     */
    stopContainers(): Promise<void>;
    /**
     * Get container status
     */
    getContainerStatus(): Promise<any[]>;
    /**
     * Save container configuration
     */
    private saveContainerConfig;
    /**
     * Load saved container configuration
     */
    loadContainerConfig(): Promise<DockerComposeConfig | null>;
    /**
     * Read package.json for project metadata
     */
    private readPackageJson;
    /**
     * Convert configuration object to YAML
     */
    private convertToYaml;
    /**
     * Generate environment file content
     */
    private generateEnvironmentContent;
}
/**
 * CLI integration for container management
 */
export declare class CLIContainerIntegration {
    private containerManager;
    private logger;
    constructor(projectPath: string);
    /**
     * Initialize containerization for a project via CLI
     */
    initializeProject(options: {
        projectPath: string;
        includeDatabase?: boolean;
        includeRedis?: boolean;
        includeMonitoring?: boolean;
        autoStart?: boolean;
    }): Promise<void>;
    /**
     * Send saved configurations when CLI requests containerization
     */
    getContainerConfiguration(): Promise<{
        config: DockerComposeConfig | null;
        recommendations: string[];
        quickStart: string[];
    }>;
}
//# sourceMappingURL=container-manager.d.ts.map