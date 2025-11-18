"use strict";
/**
 * Project Detection Service - Single Responsibility
 * Handles project type detection and configuration reading
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
exports.ProjectDetector = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class ProjectDetector {
    async detectProjectType(projectPath) {
        const packageJsonPath = path.join(projectPath, 'package.json');
        const cargoTomlPath = path.join(projectPath, 'Cargo.toml');
        const pomXmlPath = path.join(projectPath, 'pom.xml');
        const requirementsPath = path.join(projectPath, 'requirements.txt');
        const pipfilePath = path.join(projectPath, 'Pipfile');
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            // Detect specific Node.js project types
            if (packageJson.dependencies?.['express'] || packageJson.dependencies?.['fastify']) {
                return 'api_service';
            }
            if (packageJson.dependencies?.['react'] || packageJson.dependencies?.['vue'] || packageJson.dependencies?.['angular']) {
                return 'frontend_app';
            }
            if (packageJson.dependencies?.['electron']) {
                return 'desktop_app';
            }
            return 'nodejs_project';
        }
        if (fs.existsSync(cargoTomlPath)) {
            return 'rust_project';
        }
        if (fs.existsSync(pomXmlPath)) {
            return 'java_project';
        }
        if (fs.existsSync(requirementsPath) || fs.existsSync(pipfilePath)) {
            return 'python_project';
        }
        // Default fallback
        return 'general_project';
    }
    async getProjectConfig(projectPath) {
        const configPath = path.join(projectPath, '.codemind', 'project.json');
        if (!fs.existsSync(configPath)) {
            return null;
        }
        try {
            const configData = fs.readFileSync(configPath, 'utf8');
            return JSON.parse(configData);
        }
        catch (error) {
            console.warn(`Failed to read project config: ${error.message}`);
            return null;
        }
    }
}
exports.ProjectDetector = ProjectDetector;
//# sourceMappingURL=project-detector.js.map