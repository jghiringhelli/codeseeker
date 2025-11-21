/**
 * Container Management Service
 * Single Responsibility: Manage Docker container lifecycle
 */
import { IContainerManager, ContainerConfig, SetupResult } from './interfaces/setup-interfaces';
export declare class ContainerManager implements IContainerManager {
    startServices(config: ContainerConfig): Promise<SetupResult>;
    waitForHealth(config: ContainerConfig): Promise<SetupResult>;
    getContainerStatus(config: ContainerConfig): Promise<any>;
    private handleContainerStartup;
    private executeCommand;
    private parseComposeOutput;
}
//# sourceMappingURL=container-manager.d.ts.map