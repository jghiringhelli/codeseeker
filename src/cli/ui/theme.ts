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
    accent: chalk.hex('#FF66CC').bold     // Bright bold magenta for accents
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