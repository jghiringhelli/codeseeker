/**
 * Theme - Single Responsibility Principle
 * Centralized color theme and styling configuration
 */

import chalk from 'chalk';

export interface ThemeColors {
  primary: chalk.Chalk;
  secondary: chalk.Chalk;
  success: chalk.Chalk;
  warning: chalk.Chalk;
  error: chalk.Chalk;
  info: chalk.Chalk;
  muted: chalk.Chalk;
  prompt: chalk.Chalk;
  result: chalk.Chalk;
  border: chalk.Chalk;
  command: chalk.Chalk;
  highlight: chalk.Chalk;
  claudeCode: chalk.Chalk;
  claudeCodeMuted: chalk.Chalk;
  interrupt: chalk.Chalk;
  accent: chalk.Chalk;
  // New colors for enhanced output
  file: chalk.Chalk;
  relationship: chalk.Chalk;
  question: chalk.Chalk;
  component: chalk.Chalk;
  taskHeader: chalk.Chalk;
  sectionTitle: chalk.Chalk;
}

export class Theme {
  static readonly colors: ThemeColors = {
    primary: chalk.hex('#00CCFF'),        // Bright cyan for dark backgrounds
    secondary: chalk.hex('#FF66CC'),      // Bright magenta
    success: chalk.hex('#00FF88'),        // Bright green
    warning: chalk.hex('#FFD700'),        // Bright yellow/gold
    error: chalk.hex('#FF4444'),          // Bright red
    info: chalk.hex('#4488FF'),           // Bright blue
    muted: chalk.hex('#888888'),          // Lighter gray that's more visible on black
    prompt: chalk.hex('#FFD700'),         // Bright yellow for prompts
    result: chalk.hex('#FFFFFF'),         // White for results
    border: chalk.hex('#666666'),         // Lighter border gray
    command: chalk.hex('#00CCFF'),        // Bright cyan for commands
    highlight: chalk.hex('#00CCFF').bold, // Bold bright cyan for highlights
    claudeCode: chalk.hex('#FF8C42'),     // Slightly lighter Claude orange
    claudeCodeMuted: chalk.hex('#CC6A2C'), // Muted but visible Claude color
    interrupt: chalk.hex('#FF4444').bold, // Bright bold red for interrupts
    accent: chalk.hex('#FF66CC').bold,    // Bright bold magenta for accents
    // New semantic colors for important outputs
    file: chalk.hex('#00FFAA').bold,      // Bright green for file paths
    relationship: chalk.hex('#FF99FF'),   // Light magenta for relationships
    question: chalk.hex('#FFFF00').bold,  // Bright yellow for questions
    component: chalk.hex('#66CCFF'),      // Light cyan for components
    taskHeader: chalk.hex('#FF8C42').bold.underline, // Orange bold underline for task headers
    sectionTitle: chalk.hex('#FFFFFF').bold.inverse  // Inverse white for section titles
  };

  /**
   * Get themed prompt text
   */
  static getPrompt(projectName: string): string {
    return this.colors.highlight(`\n🧠 ${projectName}`) + this.colors.primary(' ❯ ');
  }

  /**
   * Create a themed header
   */
  static createHeader(title: string, subtitle?: string): string {
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
  static formatError(message: string, context?: string): string {
    let error = this.colors.error(`❌ ${message}`);
    if (context) {
      error += `\n${this.colors.muted(`   Context: ${context}`)}`;
    }
    return error;
  }

  /**
   * Format success messages consistently
   */
  static formatSuccess(message: string, details?: string): string {
    let success = this.colors.success(`✅ ${message}`);
    if (details) {
      success += `\n${this.colors.muted(`   ${details}`)}`;
    }
    return success;
  }

  /**
   * Format info messages consistently
   */
  static formatInfo(message: string, icon = 'ℹ️'): string {
    return this.colors.info(`${icon} ${message}`);
  }

  // ============================================
  // Enhanced Output Formatting Utilities
  // ============================================

  /**
   * Create a prominent section box with title
   */
  static createSectionBox(title: string, icon: string, content: string[]): string {
    const width = 60;
    const borderChar = '─';
    const lines: string[] = [];

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
  static formatFile(filePath: string, similarity?: number, type?: string): string {
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
  static formatRelationship(from: string, to: string, type: string): string {
    return `  ${this.colors.component(from)} ${this.colors.relationship('→')} ${this.colors.component(to)} ${this.colors.muted(`[${type}]`)}`;
  }

  /**
   * Format a question prominently for user attention
   */
  static formatQuestion(question: string, index?: number): string {
    const prefix = index !== undefined ? `${index + 1}. ` : '❓ ';
    return `\n  ${this.colors.question(prefix + question)}`;
  }

  /**
   * Format a component/class entry
   */
  static formatComponent(name: string, type: string, location?: string): string {
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
  static createProgressBar(current: number, total: number, width: number = 20): string {
    const filled = Math.round((current / total) * width);
    const empty = width - filled;
    const bar = this.colors.success('█'.repeat(filled)) + this.colors.muted('░'.repeat(empty));
    return `[${bar}] ${current}/${total}`;
  }

  /**
   * Create a step indicator with status
   */
  static formatStep(stepNumber: number, totalSteps: number, title: string, status: 'pending' | 'active' | 'complete'): string {
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
  static divider(char: string = '─', width: number = 50): string {
    return this.colors.border(char.repeat(width));
  }

  /**
   * Format a highlighted section title
   */
  static sectionTitle(title: string, icon?: string): string {
    const prefix = icon ? `${icon} ` : '';
    return `\n${this.colors.sectionTitle(` ${prefix}${title} `)}\n`;
  }

  /**
   * Format a task header for sub-tasks
   */
  static formatTaskHeader(taskId: number, taskType: string, description: string): string {
    const typeIcons: Record<string, string> = {
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
    const lines: string[] = [];
    lines.push(this.colors.taskHeader(`\n${icon} Sub-Task ${taskId}: ${taskType.toUpperCase()}`));
    lines.push(this.colors.result(`   ${description}`));
    return lines.join('\n');
  }

  /**
   * Format a results summary with statistics
   */
  static formatResultsSummary(stats: { files: number; components: number; relationships: number }): string {
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
  static emphasize(text: string): string {
    return this.colors.highlight(`▶ ${text}`);
  }

  /**
   * Format a list of items with visual hierarchy
   */
  static formatList(items: string[], icon: string = '•', indent: number = 2): string {
    const indentStr = ' '.repeat(indent);
    return items.map(item => `${indentStr}${this.colors.primary(icon)} ${item}`).join('\n');
  }
}

/**
 * Spinner - Interactive thinking indicator
 * Shows animated spinner while processing
 */
export class Spinner {
  private static readonly frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private intervalId: NodeJS.Timeout | null = null;
  private frameIndex = 0;
  private message: string;
  private stream: NodeJS.WriteStream;

  constructor(message: string = 'Processing') {
    this.message = message;
    this.stream = process.stdout;
  }

  /**
   * Start the spinner animation
   */
  start(): void {
    if (this.intervalId) return; // Already running

    // Hide cursor
    this.stream.write('\x1B[?25l');

    this.intervalId = setInterval(() => {
      const frame = Spinner.frames[this.frameIndex];
      this.stream.write(`\r${Theme.colors.primary(frame)} ${Theme.colors.muted(this.message)}`);
      this.frameIndex = (this.frameIndex + 1) % Spinner.frames.length;
    }, 80);
  }

  /**
   * Update the spinner message
   */
  update(message: string): void {
    this.message = message;
  }

  /**
   * Stop the spinner and show success
   */
  succeed(message?: string): void {
    this.stop();
    const finalMessage = message || this.message;
    this.stream.write(`\r${Theme.colors.success('✓')} ${finalMessage}\n`);
  }

  /**
   * Stop the spinner and show failure
   */
  fail(message?: string): void {
    this.stop();
    const finalMessage = message || this.message;
    this.stream.write(`\r${Theme.colors.error('✗')} ${finalMessage}\n`);
  }

  /**
   * Stop the spinner without message
   */
  stop(): void {
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
  static create(message: string): Spinner {
    const spinner = new Spinner(message);
    spinner.start();
    return spinner;
  }
}