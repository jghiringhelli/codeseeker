"use strict";
/**
 * Theme - Single Responsibility Principle
 * Centralized color theme and styling configuration
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Theme = void 0;
const chalk_1 = __importDefault(require("chalk"));
class Theme {
    static colors = {
        primary: chalk_1.default.cyan,
        secondary: chalk_1.default.magenta,
        success: chalk_1.default.green,
        warning: chalk_1.default.yellow,
        error: chalk_1.default.red,
        info: chalk_1.default.blue,
        muted: chalk_1.default.gray,
        prompt: chalk_1.default.yellow,
        result: chalk_1.default.white,
        border: chalk_1.default.gray,
        command: chalk_1.default.cyan,
        highlight: chalk_1.default.cyan.bold
    };
    /**
     * Get themed prompt text
     */
    static getPrompt(projectName) {
        return this.colors.highlight(`\n🧠 ${projectName}`) + this.colors.primary(' ❯ ');
    }
    /**
     * Create a themed header
     */
    static createHeader(title, subtitle) {
        let header = this.colors.primary(`\n${title}`);
        if (subtitle) {
            header += `\n${this.colors.muted(subtitle)}`;
        }
        header += `\n${this.colors.border('━'.repeat(50))}`;
        return header;
    }
    /**
     * Format error messages consistently
     */
    static formatError(message, context) {
        let error = this.colors.error(`❌ ${message}`);
        if (context) {
            error += `\n${this.colors.muted(`   Context: ${context}`)}`;
        }
        return error;
    }
    /**
     * Format success messages consistently
     */
    static formatSuccess(message, details) {
        let success = this.colors.success(`✅ ${message}`);
        if (details) {
            success += `\n${this.colors.muted(`   ${details}`)}`;
        }
        return success;
    }
    /**
     * Format info messages consistently
     */
    static formatInfo(message, icon = 'ℹ️') {
        return this.colors.info(`${icon} ${message}`);
    }
}
exports.Theme = Theme;
//# sourceMappingURL=theme.js.map