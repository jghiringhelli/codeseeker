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
}

export class Theme {
  static readonly colors: ThemeColors = {
    primary: chalk.cyan,
    secondary: chalk.magenta,
    success: chalk.green,
    warning: chalk.yellow,
    error: chalk.red,
    info: chalk.blue,
    muted: chalk.gray,
    prompt: chalk.yellow,
    result: chalk.white,
    border: chalk.gray,
    command: chalk.cyan,
    highlight: chalk.cyan.bold
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