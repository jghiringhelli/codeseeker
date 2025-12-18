"use strict";
/**
 * Theme - Single Responsibility Principle
 * Centralized color theme and styling configuration
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Spinner = exports.Theme = void 0;
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
        accent: chalk_1.default.hex('#FF66CC').bold, // Bright bold magenta for accents
        // New semantic colors for important outputs
        file: chalk_1.default.hex('#00FFAA').bold, // Bright green for file paths
        relationship: chalk_1.default.hex('#FF99FF'), // Light magenta for relationships
        question: chalk_1.default.hex('#FFFF00').bold, // Bright yellow for questions
        component: chalk_1.default.hex('#66CCFF'), // Light cyan for components
        taskHeader: chalk_1.default.hex('#FF8C42').bold.underline, // Orange bold underline for task headers
        sectionTitle: chalk_1.default.hex('#FFFFFF').bold.inverse // Inverse white for section titles
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
    // ============================================
    // Enhanced Output Formatting Utilities
    // ============================================
    /**
     * Create a prominent section box with title
     */
    static createSectionBox(title, icon, content) {
        const width = 60;
        const borderChar = '─';
        const lines = [];
        // Top border with title
        lines.push(this.colors.primary(`╭${borderChar.repeat(2)} ${icon} ${title} ${borderChar.repeat(width - title.length - 7)}╮`));
        // Content lines
        content.forEach(line => {
            const paddedLine = line.padEnd(width - 2);
            lines.push(this.colors.primary('│') + ` ${paddedLine}` + this.colors.primary('│'));
        });
        // Bottom border
        lines.push(this.colors.primary(`╰${borderChar.repeat(width)}╯`));
        return lines.join('\n');
    }
    /**
     * Format a file path with emphasis
     */
    static formatFile(filePath, similarity, type) {
        let result = `  📄 ${this.colors.file(filePath)}`;
        if (type) {
            result += this.colors.muted(` [${type}]`);
        }
        if (similarity !== undefined) {
            const percent = (similarity * 100).toFixed(0);
            const color = similarity > 0.8 ? this.colors.success :
                similarity > 0.6 ? this.colors.warning : this.colors.muted;
            result += color(` (${percent}% match)`);
        }
        return result;
    }
    /**
     * Format a relationship with visual arrow
     */
    static formatRelationship(from, to, type) {
        return `  ${this.colors.component(from)} ${this.colors.relationship('→')} ${this.colors.component(to)} ${this.colors.muted(`[${type}]`)}`;
    }
    /**
     * Format a question prominently for user attention
     */
    static formatQuestion(question, index) {
        const prefix = index !== undefined ? `${index + 1}. ` : '❓ ';
        return `\n  ${this.colors.question(prefix + question)}`;
    }
    /**
     * Format a component/class entry
     */
    static formatComponent(name, type, location) {
        let result = `  📦 ${this.colors.component(name)}`;
        result += this.colors.muted(` (${type})`);
        if (location) {
            result += this.colors.muted(` at ${location}`);
        }
        return result;
    }
    /**
     * Create a mini progress bar
     */
    static createProgressBar(current, total, width = 20) {
        const filled = Math.round((current / total) * width);
        const empty = width - filled;
        const bar = this.colors.success('█'.repeat(filled)) + this.colors.muted('░'.repeat(empty));
        return `[${bar}] ${current}/${total}`;
    }
    /**
     * Create a step indicator with status
     */
    static formatStep(stepNumber, totalSteps, title, status) {
        const icons = {
            pending: this.colors.muted('○'),
            active: this.colors.warning('◉'),
            complete: this.colors.success('●')
        };
        const titleColor = status === 'active' ? this.colors.highlight :
            status === 'complete' ? this.colors.success : this.colors.muted;
        return `${icons[status]} Step ${stepNumber}/${totalSteps}: ${titleColor(title)}`;
    }
    /**
     * Create a horizontal divider
     */
    static divider(char = '─', width = 50) {
        return this.colors.border(char.repeat(width));
    }
    /**
     * Format a highlighted section title
     */
    static sectionTitle(title, icon) {
        const prefix = icon ? `${icon} ` : '';
        return `\n${this.colors.sectionTitle(` ${prefix}${title} `)}\n`;
    }
    /**
     * Format a task header for sub-tasks
     */
    static formatTaskHeader(taskId, taskType, description) {
        const typeIcons = {
            'create': '🆕',
            'modify': '✏️',
            'fix': '🔧',
            'delete': '🗑️',
            'understand': '🔍',
            'analyze': '📊',
            'refactor': '♻️',
            'test': '🧪',
            'default': '📋'
        };
        const icon = typeIcons[taskType.toLowerCase()] || typeIcons['default'];
        const lines = [];
        lines.push(this.colors.taskHeader(`\n${icon} Sub-Task ${taskId}: ${taskType.toUpperCase()}`));
        lines.push(this.colors.result(`   ${description}`));
        return lines.join('\n');
    }
    /**
     * Format a results summary with statistics
     */
    static formatResultsSummary(stats) {
        return [
            this.colors.muted('  ┌──────────────────────────────────┐'),
            this.colors.muted('  │ ') + this.colors.file(`📁 ${stats.files} files`) +
                this.colors.muted(' │ ') + this.colors.component(`📦 ${stats.components} components`) +
                this.colors.muted(' │ ') + this.colors.relationship(`🔗 ${stats.relationships} relationships`) + this.colors.muted(' │'),
            this.colors.muted('  └──────────────────────────────────┘')
        ].join('\n');
    }
    /**
     * Create emphasized output for important information
     */
    static emphasize(text) {
        return this.colors.highlight(`▶ ${text}`);
    }
    /**
     * Format a list of items with visual hierarchy
     */
    static formatList(items, icon = '•', indent = 2) {
        const indentStr = ' '.repeat(indent);
        return items.map(item => `${indentStr}${this.colors.primary(icon)} ${item}`).join('\n');
    }
}
exports.Theme = Theme;
/**
 * Spinner - Interactive thinking indicator
 * Shows animated spinner while processing
 *
 * Uses carriage return + clear-to-end-of-line for proper in-place animation
 * that works across Windows (cmd, PowerShell, Git Bash) and Unix terminals.
 */
class Spinner {
    static frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    intervalId = null;
    frameIndex = 0;
    message;
    stream;
    constructor(message = 'Processing') {
        this.message = message;
        this.stream = process.stdout;
    }
    /**
     * Start the spinner animation
     */
    start() {
        if (this.intervalId)
            return; // Already running
        // Hide cursor
        this.stream.write('\x1B[?25l');
        this.intervalId = setInterval(() => {
            const frame = Spinner.frames[this.frameIndex];
            // Clear the line first, then write new content
            // Using \r (carriage return) + \x1B[K (clear to end of line)
            // This ensures the line is fully cleared before writing new content
            this.stream.write(`\r\x1B[K${Theme.colors.primary(frame)} ${Theme.colors.muted(this.message)}`);
            this.frameIndex = (this.frameIndex + 1) % Spinner.frames.length;
        }, 80);
    }
    /**
     * Update the spinner message
     */
    update(message) {
        this.message = message;
    }
    /**
     * Stop the spinner and show success
     */
    succeed(message) {
        this.stop();
        const finalMessage = message || this.message;
        this.stream.write(`\r\x1B[K${Theme.colors.success('✓')} ${finalMessage}\n`);
    }
    /**
     * Stop the spinner and show failure
     */
    fail(message) {
        this.stop();
        const finalMessage = message || this.message;
        this.stream.write(`\r\x1B[K${Theme.colors.error('✗')} ${finalMessage}\n`);
    }
    /**
     * Stop the spinner without message
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        // Clear line and show cursor
        this.stream.write('\r\x1B[K\x1B[?25h');
    }
    /**
     * Static helper to create and start a spinner
     */
    static create(message) {
        const spinner = new Spinner(message);
        spinner.start();
        return spinner;
    }
}
exports.Spinner = Spinner;
//# sourceMappingURL=theme.js.map