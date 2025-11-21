/**
 * Container System Detector Service
 * Single Responsibility: Detect and configure container systems (Docker, Rancher, Podman)
 */
import { IContainerDetector, ContainerConfig } from './interfaces/setup-interfaces';
export declare class ContainerDetector implements IContainerDetector {
    private platform;
    detect(): Promise<ContainerConfig>;
    testConnection(): Promise<boolean>;
    private getDockerInfo;
    private detectSpecificEnvironment;
    private configureForEnvironment;
    private createUnavailableConfig;
}
//# sourceMappingURL=container-detector.d.ts.map