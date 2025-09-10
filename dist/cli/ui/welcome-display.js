"use strict";
/**
 * Welcome Display - Single Responsibility Principle
 * Handles all CLI welcome/branding display logic
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WelcomeDisplay = void 0;
const chalk_1 = __importDefault(require("chalk"));
class WelcomeDisplay {
    static LOGO = chalk_1.default.cyan.bold(`
 ██████╗  ██████╗ ██████╗ ███████╗███╗   ███╗██╗███╗   ██╗██████╗ 
██╔════╝ ██╔═══██╗██╔══██╗██╔════╝████╗ ████║██║████╗  ██║██╔══██╗
██║      ██║   ██║██║  ██║█████╗  ██╔████╔██║██║██╔██╗ ██║██║  ██║
██║      ██║   ██║██║  ██║██╔══╝  ██║╚██╔╝██║██║██║╚██╗██║██║  ██║
╚██████╗ ╚██████╔╝██████╔╝███████╗██║ ╚═╝ ██║██║██║ ╚████║██████╔╝
 ╚═════╝  ╚═════╝ ╚═════╝ ╚══════╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═════╝ 
                    Intelligent Code Assistant
`);
    /**
     * Display the main welcome screen
     */
    static displayWelcome() {
        console.clear();
        console.log(this.LOGO);
        console.log(chalk_1.default.gray('━'.repeat(70)));
        console.log(chalk_1.default.cyan('  Welcome to CodeMind - Your Intelligent Code Assistant'));
        console.log(chalk_1.default.gray('  Type /help for commands or start typing your request'));
        console.log(chalk_1.default.gray('━'.repeat(70)));
    }
    /**
     * Display startup information
     */
    static displayStartup(projectPath, projectName) {
        console.log(chalk_1.default.blue('\n🚀 Starting CodeMind CLI...'));
        console.log(chalk_1.default.gray(`   Project: ${projectName}`));
        console.log(chalk_1.default.gray(`   Path: ${projectPath}`));
    }
    /**
     * Display shutdown message
     */
    static displayShutdown() {
        console.log(chalk_1.default.yellow('\n👋 Thank you for using CodeMind!'));
        console.log(chalk_1.default.gray('   Session ended.'));
    }
}
exports.WelcomeDisplay = WelcomeDisplay;
//# sourceMappingURL=welcome-display.js.map