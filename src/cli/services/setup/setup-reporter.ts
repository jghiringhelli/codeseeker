/**
 * Setup Progress Reporter Service
 * Single Responsibility: Handle all setup UI and progress reporting
 */

import chalk from 'chalk';
import { ISetupReporter, SetupStatus } from './interfaces/setup-interfaces';

export class SetupReporter implements ISetupReporter {
  private stepCount = 0;

  displayProgress(step: string, status: 'running' | 'success' | 'error' | 'warning'): void {
    const icons = {
      running: '⏳',
      success: '✅',
      error: '❌',
      warning: '⚠️'
    };

    const colors = {
      running: chalk.yellow,
      success: chalk.green,
      error: chalk.red,
      warning: chalk.yellow
    };

    const icon = icons[status];
    const colorFn = colors[status];

    if (status === 'running') {
      this.stepCount++;
      console.log(colorFn(`\n${icon} Step ${this.stepCount}: ${step}...`));
    } else {
      console.log(colorFn(`   ${icon} ${step}`));
    }
  }

  displaySummary(status: SetupStatus, duration: number): void {
    console.log(chalk.blue('\n📋 Setup Summary:'));

    // Project validation
    if (status.projectValid) {
      console.log(chalk.green('  ✓ Project: Valid CodeMind project'));
    } else {
      console.log(chalk.red('  ✗ Project: Validation failed'));
    }

    // Container system
    if (status.containerSystem) {
      console.log(chalk.green('  ✓ Container System: Running and healthy'));
    } else {
      console.log(chalk.yellow('  ○ Container System: Not available (local-only mode)'));
    }

    // Database status
    const dbEntries = Object.entries(status.databases);
    const successfulDbs = dbEntries.filter(([_, success]) => success);
    const totalDbs = dbEntries.length;

    if (successfulDbs.length === totalDbs) {
      console.log(chalk.green('  ✓ Databases: All initialized'));
      dbEntries.forEach(([name, success]) => {
        if (success) {
          console.log(chalk.green(`    ✓ ${this.capitalize(name)}: Connected and initialized`));
        }
      });
    } else {
      console.log(chalk.yellow(`  ○ Databases: ${successfulDbs.length}/${totalDbs} initialized`));
      dbEntries.forEach(([name, success]) => {
        if (success) {
          console.log(chalk.green(`    ✓ ${this.capitalize(name)}: Connected and initialized`));
        } else {
          console.log(chalk.gray(`    ○ ${this.capitalize(name)}: Not initialized`));
        }
      });
    }

    // Overall status
    if (status.initialization) {
      console.log(chalk.green('  ✓ Initialization: Complete'));
    } else {
      console.log(chalk.yellow('  ○ Initialization: Partial'));
    }

    // Timing
    const durationText = duration < 60 ? `${duration}s` : `${Math.floor(duration/60)}m ${duration%60}s`;
    console.log(chalk.gray(`  ⏱ Duration: ${durationText}`));

    this.displayNextSteps(status);
  }

  displayErrorHelp(error: Error): void {
    console.error(chalk.red.bold('\n❌ Setup failed:'), error.message);

    if (error.message.includes('Docker') || error.message.includes('container')) {
      console.log(chalk.yellow('\n💡 Container Issues? Try these solutions:'));
      console.log(chalk.cyan('  • Ensure Docker/Rancher Desktop is running'));
      console.log(chalk.cyan('  • Try running as administrator/sudo'));
      console.log(chalk.cyan('  • Check container status: docker ps'));
      console.log(chalk.cyan('  • Restart containers: docker-compose restart'));
      console.log(chalk.cyan('  • For manual setup see: docs/MANUAL_SETUP.md'));
    } else if (error.message.includes('project') || error.message.includes('directory')) {
      console.log(chalk.yellow('\n💡 Project Issues? Try these solutions:'));
      console.log(chalk.cyan('  1. Navigate to CodeMind directory: cd /path/to/codemind'));
      console.log(chalk.cyan('  2. Then run setup again'));
      console.log(chalk.cyan('  3. Or specify path: npm run setup -- --project-path /path/to/codemind'));
    } else if (error.message.includes('database') || error.message.includes('connection')) {
      console.log(chalk.yellow('\n💡 Database Issues? Try these solutions:'));
      console.log(chalk.cyan('  • Wait for containers to fully start (may take 30-60 seconds)'));
      console.log(chalk.cyan('  • Check container logs: docker-compose logs'));
      console.log(chalk.cyan('  • Restart setup after containers are stable'));
    }

    console.log(chalk.gray('\n🔍 For detailed troubleshooting:'));
    console.log(chalk.gray('  • Check logs above for specific error details'));
    console.log(chalk.gray('  • Visit: docs/TROUBLESHOOTING.md'));
    console.log(chalk.gray('  • Run with debug: DEBUG=* npm run setup'));
  }

  private displayNextSteps(status: SetupStatus): void {
    console.log(chalk.blue('\n🎯 Next Steps:'));

    if (status.initialization) {
      console.log(chalk.cyan('  ✓ Setup completed successfully!'));
      console.log(chalk.cyan('  1. Run: npm run codemind (or just "codemind" if globally linked)'));
      console.log(chalk.cyan('  2. Navigate to your project and run: /init'));
      console.log(chalk.cyan('  3. Start analyzing: "what is this project about?"'));
    } else {
      if (!status.containerSystem) {
        console.log(chalk.yellow('  • Install Docker Desktop or Rancher Desktop'));
        console.log(chalk.yellow('  • Run setup again for full functionality'));
        console.log(chalk.cyan('  • Or continue with limited local-only mode'));
      }

      const failedDbs = Object.entries(status.databases)
        .filter(([_, success]) => !success)
        .map(([name]) => name);

      if (failedDbs.length > 0) {
        console.log(chalk.yellow(`  • Database initialization incomplete for: ${failedDbs.join(', ')}`));
        console.log(chalk.cyan('  • Run: npm run setup:db to retry database setup'));
      }
    }
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}