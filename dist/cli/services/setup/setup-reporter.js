"use strict";
/**
 * Setup Progress Reporter Service
 * Single Responsibility: Handle all setup UI and progress reporting
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetupReporter = void 0;
const chalk_1 = __importDefault(require("chalk"));
class SetupReporter {
    stepCount = 0;
    displayProgress(step, status) {
        const icons = {
            running: '⏳',
            success: '✅',
            error: '❌',
            warning: '⚠️'
        };
        const colors = {
            running: chalk_1.default.yellow,
            success: chalk_1.default.green,
            error: chalk_1.default.red,
            warning: chalk_1.default.yellow
        };
        const icon = icons[status];
        const colorFn = colors[status];
        if (status === 'running') {
            this.stepCount++;
            console.log(colorFn(`\n${icon} Step ${this.stepCount}: ${step}...`));
        }
        else {
            console.log(colorFn(`   ${icon} ${step}`));
        }
    }
    displaySummary(status, duration) {
        console.log(chalk_1.default.blue('\n📋 Setup Summary:'));
        // Project validation
        if (status.projectValid) {
            console.log(chalk_1.default.green('  ✓ Project: Valid CodeMind project'));
        }
        else {
            console.log(chalk_1.default.red('  ✗ Project: Validation failed'));
        }
        // Container system
        if (status.containerSystem) {
            console.log(chalk_1.default.green('  ✓ Container System: Running and healthy'));
        }
        else {
            console.log(chalk_1.default.yellow('  ○ Container System: Not available (local-only mode)'));
        }
        // Database status
        const dbEntries = Object.entries(status.databases);
        const successfulDbs = dbEntries.filter(([_, success]) => success);
        const totalDbs = dbEntries.length;
        if (successfulDbs.length === totalDbs) {
            console.log(chalk_1.default.green('  ✓ Databases: All initialized'));
            dbEntries.forEach(([name, success]) => {
                if (success) {
                    console.log(chalk_1.default.green(`    ✓ ${this.capitalize(name)}: Connected and initialized`));
                }
            });
        }
        else {
            console.log(chalk_1.default.yellow(`  ○ Databases: ${successfulDbs.length}/${totalDbs} initialized`));
            dbEntries.forEach(([name, success]) => {
                if (success) {
                    console.log(chalk_1.default.green(`    ✓ ${this.capitalize(name)}: Connected and initialized`));
                }
                else {
                    console.log(chalk_1.default.gray(`    ○ ${this.capitalize(name)}: Not initialized`));
                }
            });
        }
        // Overall status
        if (status.initialization) {
            console.log(chalk_1.default.green('  ✓ Initialization: Complete'));
        }
        else {
            console.log(chalk_1.default.yellow('  ○ Initialization: Partial'));
        }
        // Timing
        const durationText = duration < 60 ? `${duration}s` : `${Math.floor(duration / 60)}m ${duration % 60}s`;
        console.log(chalk_1.default.gray(`  ⏱ Duration: ${durationText}`));
        this.displayNextSteps(status);
    }
    displayErrorHelp(error) {
        console.error(chalk_1.default.red.bold('\n❌ Setup failed:'), error.message);
        if (error.message.includes('Docker') || error.message.includes('container')) {
            console.log(chalk_1.default.yellow('\n💡 Container Issues? Try these solutions:'));
            console.log(chalk_1.default.cyan('  • Ensure Docker/Rancher Desktop is running'));
            console.log(chalk_1.default.cyan('  • Try running as administrator/sudo'));
            console.log(chalk_1.default.cyan('  • Check container status: docker ps'));
            console.log(chalk_1.default.cyan('  • Restart containers: docker-compose restart'));
            console.log(chalk_1.default.cyan('  • For manual setup see: docs/MANUAL_SETUP.md'));
        }
        else if (error.message.includes('project') || error.message.includes('directory')) {
            console.log(chalk_1.default.yellow('\n💡 Project Issues? Try these solutions:'));
            console.log(chalk_1.default.cyan('  1. Navigate to CodeMind directory: cd /path/to/codemind'));
            console.log(chalk_1.default.cyan('  2. Then run setup again'));
            console.log(chalk_1.default.cyan('  3. Or specify path: npm run setup -- --project-path /path/to/codemind'));
        }
        else if (error.message.includes('database') || error.message.includes('connection')) {
            console.log(chalk_1.default.yellow('\n💡 Database Issues? Try these solutions:'));
            console.log(chalk_1.default.cyan('  • Wait for containers to fully start (may take 30-60 seconds)'));
            console.log(chalk_1.default.cyan('  • Check container logs: docker-compose logs'));
            console.log(chalk_1.default.cyan('  • Restart setup after containers are stable'));
        }
        console.log(chalk_1.default.gray('\n🔍 For detailed troubleshooting:'));
        console.log(chalk_1.default.gray('  • Check logs above for specific error details'));
        console.log(chalk_1.default.gray('  • Visit: docs/TROUBLESHOOTING.md'));
        console.log(chalk_1.default.gray('  • Run with debug: DEBUG=* npm run setup'));
    }
    displayNextSteps(status) {
        console.log(chalk_1.default.blue('\n🎯 Next Steps:'));
        if (status.initialization) {
            console.log(chalk_1.default.cyan('  ✓ Setup completed successfully!'));
            console.log(chalk_1.default.cyan('  1. Run: npm run codemind (or just "codemind" if globally linked)'));
            console.log(chalk_1.default.cyan('  2. Navigate to your project and run: /init'));
            console.log(chalk_1.default.cyan('  3. Start analyzing: "what is this project about?"'));
        }
        else {
            if (!status.containerSystem) {
                console.log(chalk_1.default.yellow('  • Install Docker Desktop or Rancher Desktop'));
                console.log(chalk_1.default.yellow('  • Run setup again for full functionality'));
                console.log(chalk_1.default.cyan('  • Or continue with limited local-only mode'));
            }
            const failedDbs = Object.entries(status.databases)
                .filter(([_, success]) => !success)
                .map(([name]) => name);
            if (failedDbs.length > 0) {
                console.log(chalk_1.default.yellow(`  • Database initialization incomplete for: ${failedDbs.join(', ')}`));
                console.log(chalk_1.default.cyan('  • Run: npm run setup:db to retry database setup'));
            }
        }
    }
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}
exports.SetupReporter = SetupReporter;
//# sourceMappingURL=setup-reporter.js.map