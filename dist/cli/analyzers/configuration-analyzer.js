"use strict";
/**
 * Configuration Analyzer - Single Responsibility: Analyzing project configurations
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
exports.ConfigurationAnalyzer = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ConfigurationAnalyzer {
    async analyze(projectPath) {
        const configs = [];
        const configFiles = [
            'package.json', 'tsconfig.json', '.eslintrc.json', '.eslintrc.js',
            'webpack.config.js', 'vite.config.ts', 'next.config.js', 'tailwind.config.js'
        ];
        for (const configFile of configFiles) {
            try {
                const configPath = path.join(projectPath, configFile);
                if (await fs.promises.access(configPath).then(() => true).catch(() => false)) {
                    const content = await fs.promises.readFile(configPath, 'utf-8');
                    configs.push(`--- ${configFile} ---\n${content.slice(0, 500)}`);
                }
            }
            catch (error) {
                // Skip files we can't read
            }
        }
        return configs.length > 0
            ? `KEY CONFIGURATIONS:\n${configs.join('\n\n')}`
            : 'No key configuration files found';
    }
}
exports.ConfigurationAnalyzer = ConfigurationAnalyzer;
//# sourceMappingURL=configuration-analyzer.js.map