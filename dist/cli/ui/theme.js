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
        primary: chalk_1.default.hex('#00CCFF'), // Bright cyan for dark backgrounds
        secondary: chalk_1.default.hex('#FF66CC'), // Bright magenta
        success: chalk_1.default.hex('#00FF88'), // Bright green
        warning: chalk_1.default.hex('#FFD700'), // Bright yellow/gold
        error: chalk_1.default.hex('#FF4444'), // Bright red
        info: chalk_1.default.hex('#4488FF'), // Bright blue
        muted: chalk_1.default.hex('#888888'), // Lighter gray that's more visible on black
        prompt: chalk_1.default.hex('#FFD700'), // Bright yellow for prompts
        result: chalk_1.default.hex('#FFFFFF'), // White for results
        border: chalk_1.default.hex('#666666'), // Lighter border gray
        command: chalk_1.default.hex('#00CCFF'), // Bright cyan for commands
        highlight: chalk_1.default.hex('#00CCFF').bold, // Bold bright cyan for highlights
        claudeCode: chalk_1.default.hex('#FF8C42'), // Slightly lighter Claude orange
        claudeCodeMuted: chalk_1.default.hex('#CC6A2C'), // Muted but visible Claude color
        interrupt: chalk_1.default.hex('#FF4444').bold, // Bright bold red for interrupts
        accent: chalk_1.default.hex('#FF66CC').bold // Bright bold magenta for accents
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