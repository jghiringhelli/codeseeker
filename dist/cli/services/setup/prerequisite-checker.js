"use strict";
/**
 * Prerequisite Checker Service
 * Single Responsibility: Validate project and environment prerequisites
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
exports.PrerequisiteChecker = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class PrerequisiteChecker {
    async checkProject(projectPath) {
        try {
            const targetPath = projectPath || process.cwd();
            const packageJsonPath = path.join(targetPath, 'package.json');
            // Check if package.json exists
            try {
                const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
                const pkg = JSON.parse(packageContent);
                if (pkg.name !== 'codemind-enhanced-cli') {
                    return {
                        success: false,
                        message: 'Not a CodeMind project directory',
                        errors: [`Expected package name 'codemind-enhanced-cli', found '${pkg.name}'`]
                    };
                }
                // Change directory if needed
                if (projectPath && process.cwd() !== projectPath) {
                    process.chdir(projectPath);
                }
                return {
                    success: true,
                    message: 'Valid CodeMind project detected',
                    data: { projectPath: targetPath, packageInfo: pkg }
                };
            }
            catch (fileError) {
                return {
                    success: false,
                    message: 'package.json not found or invalid',
                    errors: [
                        `Could not read package.json at ${packageJsonPath}`,
                        'Make sure you are in the CodeMind project directory'
                    ]
                };
            }
        }
        catch (error) {
            return {
                success: false,
                message: 'Project validation failed',
                errors: [error instanceof Error ? error.message : 'Unknown error']
            };
        }
    }
    checkNodeVersion() {
        try {
            const nodeVersion = process.version;
            const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
            if (majorVersion < 16) {
                return {
                    success: false,
                    message: 'Node.js version too old',
                    errors: [
                        `Current version: ${nodeVersion}`,
                        'Minimum required: Node.js 16.x',
                        'Please upgrade Node.js for best compatibility'
                    ]
                };
            }
            return {
                success: true,
                message: `Node.js ${nodeVersion} is compatible`,
                data: { version: nodeVersion, majorVersion }
            };
        }
        catch (error) {
            return {
                success: false,
                message: 'Could not determine Node.js version',
                errors: [error instanceof Error ? error.message : 'Unknown error']
            };
        }
    }
}
exports.PrerequisiteChecker = PrerequisiteChecker;
//# sourceMappingURL=prerequisite-checker.js.map