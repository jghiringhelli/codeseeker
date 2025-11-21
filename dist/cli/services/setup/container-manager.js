"use strict";
/**
 * Container Management Service
 * Single Responsibility: Manage Docker container lifecycle
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContainerManager = void 0;
const child_process_1 = require("child_process");
class ContainerManager {
    async startServices(config) {
        try {
            // Check existing container status
            const existingStatus = await this.getContainerStatus(config);
            if (existingStatus.allHealthy) {
                return {
                    success: true,
                    message: 'All containers already running and healthy',
                    data: { skipped: true, containers: existingStatus.containers }
                };
            }
            // Start containers based on their current state
            const result = await this.handleContainerStartup(config, existingStatus);
            return result;
        }
        catch (error) {
            return {
                success: false,
                message: 'Failed to start containers',
                errors: [error instanceof Error ? error.message : 'Unknown error']
            };
        }
    }
    async waitForHealth(config) {
        const maxRetries = 30; // 30 seconds
        let retries = 0;
        while (retries < maxRetries) {
            try {
                const status = await this.getContainerStatus(config);
                if (status.allHealthy && status.containers.length > 0) {
                    return {
                        success: true,
                        message: 'All containers are healthy',
                        data: { containers: status.containers, retries }
                    };
                }
                // Wait 1 second between checks
                await new Promise(resolve => setTimeout(resolve, 1000));
                retries++;
            }
            catch (error) {
                retries++;
                if (retries >= maxRetries) {
                    return {
                        success: false,
                        message: 'Containers did not become healthy within timeout',
                        errors: [`Timeout after ${maxRetries} seconds`, error instanceof Error ? error.message : 'Unknown error']
                    };
                }
            }
        }
        return {
            success: false,
            message: 'Health check timeout',
            errors: [`Containers did not start properly within ${maxRetries} seconds`]
        };
    }
    async getContainerStatus(config) {
        try {
            const command = `${config.composeCommand} ps --format json`;
            const result = this.executeCommand(command, false);
            const output = result.toString().trim();
            if (!output) {
                return { allRunning: false, allHealthy: false, containers: [], needsStart: true };
            }
            const containers = this.parseComposeOutput(output);
            const runningContainers = containers.filter(c => c.State === 'running');
            const healthyContainers = containers.filter(c => c.State === 'running' && (!c.Health || c.Health === 'healthy'));
            return {
                allRunning: containers.length > 0 && runningContainers.length === containers.length,
                allHealthy: containers.length > 0 && healthyContainers.length === containers.length,
                containers,
                needsStart: containers.length === 0,
                needsRestart: containers.some(c => c.State !== 'running')
            };
        }
        catch (error) {
            return { allRunning: false, allHealthy: false, containers: [], needsStart: true };
        }
    }
    async handleContainerStartup(config, status) {
        try {
            if (status.needsStart) {
                // Fresh start
                const command = `${config.composeCommand} up -d --build`;
                this.executeCommand(command, true);
            }
            else if (status.needsRestart) {
                // Restart failed containers
                const stoppedContainers = status.containers
                    .filter((c) => c.State !== 'running')
                    .map((c) => c.Name || c.Service)
                    .filter(Boolean);
                if (stoppedContainers.length > 0) {
                    const command = `${config.composeCommand} up -d ${stoppedContainers.join(' ')}`;
                    this.executeCommand(command, true);
                }
            }
            return {
                success: true,
                message: 'Containers started successfully',
                data: { action: status.needsStart ? 'fresh_start' : 'restart' }
            };
        }
        catch (error) {
            return {
                success: false,
                message: 'Container startup failed',
                errors: [error instanceof Error ? error.message : 'Unknown error']
            };
        }
    }
    executeCommand(command, inheritStdio = false) {
        return (0, child_process_1.execSync)(command, {
            stdio: inheritStdio ? 'inherit' : 'pipe',
            cwd: process.cwd(),
            timeout: 120000 // 2 minutes timeout
        });
    }
    parseComposeOutput(output) {
        try {
            // Handle JSON format (newer compose versions)
            return JSON.parse(`[${output.split('\n').join(',')}]`);
        }
        catch {
            // Fallback for non-JSON formats
            return output.split('\n')
                .filter(line => line.trim())
                .map(line => ({
                State: line.includes('Up') ? 'running' : 'stopped',
                Health: 'unknown',
                Name: line.split(/\s+/)[0] || 'unknown'
            }));
        }
    }
}
exports.ContainerManager = ContainerManager;
//# sourceMappingURL=container-manager.js.map