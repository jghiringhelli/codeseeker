/**
 * Welcome Display - Single Responsibility Principle
 * Handles all CLI welcome/branding display logic
 */

import chalk from 'chalk';

export class WelcomeDisplay {
  private static readonly LOGO = chalk.cyan.bold(`
 ██████╗ ██████╗ ██████╗ ███████╗███████╗███████╗███████╗██╗  ██╗███████╗██████╗
██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔════╝██╔════╝██╔════╝██║ ██╔╝██╔════╝██╔══██╗
██║     ██║   ██║██║  ██║█████╗  ███████╗█████╗  █████╗  █████╔╝ █████╗  ██████╔╝
██║     ██║   ██║██║  ██║██╔══╝  ╚════██║██╔══╝  ██╔══╝  ██╔═██╗ ██╔══╝  ██╔══██╗
╚██████╗╚██████╔╝██████╔╝███████╗███████║███████╗███████╗██║  ██╗███████╗██║  ██║
 ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝
                      Graph-Powered Code Intelligence
`);

  /**
   * Display the main welcome screen
   */
  static displayWelcome(): void {
    console.clear();
    console.log(this.LOGO);
    console.log(chalk.gray('━'.repeat(70)));
    console.log(chalk.cyan('  Welcome to CodeSeeker - Your Intelligent Code Assistant'));
    console.log(chalk.gray('  Type /help for commands or start typing your request'));
    console.log(chalk.gray('━'.repeat(70)));
  }

  /**
   * Display startup information
   */
  static displayStartup(projectPath: string, projectName: string): void {
    console.log(chalk.blue('\n🚀 Starting CodeSeeker CLI...'));
    console.log(chalk.gray(`   Project: ${projectName}`));
    console.log(chalk.gray(`   Path: ${projectPath}`));
  }

  /**
   * Display shutdown message
   */
  static displayShutdown(): void {
    console.log(chalk.yellow('\n👋 Thank you for using CodeSeeker!'));
    console.log(chalk.gray('   Session ended.'));
  }
}