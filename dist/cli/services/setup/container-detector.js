"use strict";
/**
 * Container System Detector Service
 * Single Responsibility: Detect and configure container systems (Docker, Rancher, Podman)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContainerDetector = void 0;
const child_process_1 = require("child_process");
const os = __importStar(require("os"));
class ContainerDetector {
    platform = os.platform();
    async detect() {
        try {
            // Check basic Docker availability
            const dockerInfo = await this.getDockerInfo();
            if (!dockerInfo.available) {
                return this.createUnavailableConfig('Docker not available');
            }
            // Detect specific environment
            const environment = await this.detectSpecificEnvironment();
            const config = this.configureForEnvironment(environment);
            return {
                success: true,
                environment: environment.name,
                dockerCommand: config.dockerCommand,
                composeCommand: config.composeCommand,
                context: config.context
            };
        }
        catch (error) {
            return this.createUnavailableConfig(error instanceof Error ? error.message : 'Container detection failed');
        }
    }
    async testConnection() {
        try {
            (0, child_process_1.execSync)('docker info', { stdio: 'pipe', timeout: 5000 });
            return true;
        }
        catch {
            return false;
        }
    }
    async getDockerInfo() {
        try {
            const result = (0, child_process_1.execSync)('docker --version', {
                stdio: 'pipe',
                timeout: 5000,
                encoding: 'utf8'
            });
            return {
                available: true,
                info: result.trim()
            };
        }
        catch {
            return { available: false };
        }
    }
    async detectSpecificEnvironment() {
        try {
            // Try to get Docker context
            const context = (0, child_process_1.execSync)('docker context ls --format json', {
                stdio: 'pipe',
                timeout: 5000,
                encoding: 'utf8'
            });
            const contexts = context.trim().split('\n').map(line => {
                try {
                    return JSON.parse(line);
                }
                catch {
                    return null;
                }
            }).filter(Boolean);
            const currentContext = contexts.find(ctx => ctx.Current);
            // Detect Rancher Desktop
            if (currentContext?.Name?.includes('rancher-desktop') ||
                currentContext?.DockerEndpoint?.includes('rancher-desktop')) {
                return { name: 'Rancher Desktop', type: 'rancher' };
            }
            // Detect Docker Desktop
            if (currentContext?.Name?.includes('desktop') ||
                this.platform === 'win32' || this.platform === 'darwin') {
                return { name: 'Docker Desktop', type: 'docker-desktop' };
            }
            // Check for Podman
            try {
                (0, child_process_1.execSync)('podman --version', { stdio: 'pipe', timeout: 5000 });
                return { name: 'Podman', type: 'podman' };
            }
            catch {
                // Not Podman
            }
            // Default to Docker
            return { name: 'Docker Engine', type: 'docker' };
        }
        catch {
            return { name: 'Docker (Generic)', type: 'docker' };
        }
    }
    configureForEnvironment(environment) {
        let dockerCommand = 'docker';
        let composeCommand = 'docker-compose';
        let context;
        switch (environment.type) {
            case 'rancher':
                // Rancher Desktop specific optimizations
                composeCommand = 'docker compose'; // Prefer built-in compose
                context = 'rancher-desktop';
                break;
            case 'docker-desktop':
                // Docker Desktop optimizations
                composeCommand = 'docker compose'; // Use built-in compose V2
                break;
            case 'podman':
                dockerCommand = 'podman';
                composeCommand = 'podman-compose';
                break;
            default:
                // Try to detect compose version
                try {
                    (0, child_process_1.execSync)('docker compose version', { stdio: 'pipe', timeout: 3000 });
                    composeCommand = 'docker compose';
                }
                catch {
                    composeCommand = 'docker-compose';
                }
                break;
        }
        return { dockerCommand, composeCommand, context };
    }
    createUnavailableConfig(message) {
        return {
            success: false,
            environment: 'None',
            dockerCommand: 'docker',
            composeCommand: 'docker-compose'
        };
    }
}
exports.ContainerDetector = ContainerDetector;
//# sourceMappingURL=container-detector.js.map