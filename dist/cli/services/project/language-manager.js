"use strict";
/**
 * Language Manager Service - Single Responsibility
 * Handles language detection and setup for projects
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
exports.LanguageManager = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class LanguageManager {
    languagePatterns = {
        typescript: ['.ts', '.tsx'],
        javascript: ['.js', '.jsx', '.mjs'],
        python: ['.py', '.pyx', '.pyi'],
        java: ['.java'],
        rust: ['.rs'],
        go: ['.go'],
        cpp: ['.cpp', '.cc', '.cxx', '.hpp', '.h'],
        csharp: ['.cs'],
        php: ['.php'],
        ruby: ['.rb'],
        kotlin: ['.kt', '.kts'],
        swift: ['.swift'],
        dart: ['.dart'],
        scala: ['.scala']
    };
    async detectLanguages(projectPath) {
        const detectedLanguages = new Set();
        try {
            await this.scanDirectoryForLanguages(projectPath, detectedLanguages);
        }
        catch (error) {
            console.warn(`Language detection failed: ${error.message}`);
        }
        return Array.from(detectedLanguages);
    }
    async setupLanguageSupport(languages) {
        const installedPackages = [];
        const errors = [];
        for (const language of languages) {
            try {
                const packageName = this.getTreeSitterPackage(language);
                if (packageName) {
                    await this.installTreeSitterParser(packageName);
                    installedPackages.push(packageName);
                }
            }
            catch (error) {
                errors.push(`Failed to install ${language} support: ${error.message}`);
            }
        }
        return {
            detectedLanguages: languages,
            selectedLanguages: languages,
            installedPackages,
            errors
        };
    }
    async scanDirectoryForLanguages(dirPath, detected) {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory() && !this.shouldSkipDirectory(entry.name)) {
                await this.scanDirectoryForLanguages(path.join(dirPath, entry.name), detected);
            }
            else if (entry.isFile()) {
                const language = this.detectLanguageFromFile(entry.name);
                if (language) {
                    detected.add(language);
                }
            }
        }
    }
    detectLanguageFromFile(filename) {
        const ext = path.extname(filename).toLowerCase();
        for (const [language, extensions] of Object.entries(this.languagePatterns)) {
            if (extensions.includes(ext)) {
                return language;
            }
        }
        return null;
    }
    shouldSkipDirectory(dirName) {
        const skipDirs = ['node_modules', '.git', 'dist', 'build', 'target', '__pycache__', '.venv', 'venv'];
        return skipDirs.includes(dirName);
    }
    getTreeSitterPackage(language) {
        const packageMap = {
            typescript: 'tree-sitter-typescript',
            javascript: 'tree-sitter-javascript',
            python: 'tree-sitter-python',
            java: 'tree-sitter-java',
            rust: 'tree-sitter-rust',
            go: 'tree-sitter-go',
            cpp: 'tree-sitter-cpp',
            csharp: 'tree-sitter-c-sharp'
        };
        return packageMap[language] || null;
    }
    async installTreeSitterParser(packageName) {
        try {
            const { stdout } = await execAsync(`npm list ${packageName}`);
            if (stdout.includes(packageName)) {
                return; // Already installed
            }
        }
        catch {
            // Package not found, proceed with installation
        }
        await execAsync(`npm install ${packageName}`);
    }
}
exports.LanguageManager = LanguageManager;
//# sourceMappingURL=language-manager.js.map