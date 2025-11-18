"use strict";
/**
 * Base Command Handler
 * Single Responsibility: Provide common functionality for all command handlers
 * Open/Closed Principle: Extensible base class for new command types
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
exports.BaseCommandHandler = void 0;
const path = __importStar(require("path"));
class BaseCommandHandler {
    context;
    constructor(context) {
        this.context = context;
    }
    /**
     * Parse path and flags from command arguments
     */
    parsePathAndFlags(args) {
        const parts = args.trim().split(/\s+/);
        let targetPath = parts[0] || '/'; // Default to root if no path
        let recursive = true; // Default to recursive
        // Check for --no-recursive flag
        if (parts.includes('--no-recursive') || parts.includes('--nr')) {
            recursive = false;
        }
        // Resolve path relative to project or current directory
        const projectPath = this.context.currentProject?.projectPath || process.env.CODEMIND_USER_CWD || process.cwd();
        let resolvedPath;
        if (targetPath === '/' || targetPath === '.') {
            resolvedPath = projectPath;
        }
        else if (path.isAbsolute(targetPath)) {
            resolvedPath = targetPath;
        }
        else {
            resolvedPath = path.join(projectPath, targetPath);
        }
        return {
            path: targetPath,
            recursive,
            resolvedPath
        };
    }
    /**
     * Check if current project is available
     */
    requireProject() {
        if (!this.context.currentProject) {
            return {
                success: false,
                message: 'No project loaded. Run "init" first to set up a project.'
            };
        }
        return null;
    }
    /**
     * Parse boolean flags from arguments
     */
    parseFlags(args, flagMappings) {
        const flags = {};
        const argParts = args.toLowerCase().split(/\s+/);
        for (const [key, aliases] of Object.entries(flagMappings)) {
            flags[key] = aliases.some(alias => argParts.includes(alias));
        }
        return flags;
    }
    /**
     * Extract specific argument values (e.g., --tech-stack=react,node)
     */
    extractArgValue(args, argName) {
        const regex = new RegExp(`--${argName}=([^\\s]+)`, 'i');
        const match = args.match(regex);
        return match ? match[1] : null;
    }
}
exports.BaseCommandHandler = BaseCommandHandler;
//# sourceMappingURL=base-command-handler.js.map