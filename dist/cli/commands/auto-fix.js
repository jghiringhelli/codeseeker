"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoFixExamples = void 0;
exports.createAutoFixCommand = createAutoFixCommand;
const commander_1 = require("commander");
const path = __importStar(require("path"));
const project_fixer_1 = require("../../auto-improvement/project-fixer");
const logger_1 = require("../../utils/logger");
function createAutoFixCommand() {
    const logger = new logger_1.Logger();
    return new commander_1.Command('auto-fix')
        .description('Automatically analyze and fix issues in an existing project')
        .argument('<project-path>', 'Path to the project to analyze and fix')
        .option('-o, --output <path>', 'Output directory for reports (defaults to project path)')
        .option('--dry-run', 'Analyze only, do not make changes', false)
        .option('--no-backup', 'Skip creating backup before making changes', false)
        .option('--no-report', 'Skip generating improvement reports', false)
        .option('-t, --types <types...>', 'Specific fix types to apply', ['all'])
        .option('-a, --aggressiveness <level>', 'Aggressiveness level: conservative, moderate, aggressive', 'moderate')
        .option('-v, --verbose', 'Verbose logging', false)
        .action(async (projectPath, options) => {
        try {
            if (options.verbose) {
                logger.setLevel('debug');
            }
            // Resolve absolute path
            const absolutePath = path.resolve(projectPath);
            logger.info(`Starting auto-fix for project: ${absolutePath}`);
            // Parse fix types
            const fixTypes = options.types.includes('all')
                ? [project_fixer_1.AutoFixType.ALL]
                : options.types.map((type) => {
                    const fixType = Object.values(project_fixer_1.AutoFixType).find(ft => ft === type.toLowerCase());
                    if (!fixType) {
                        throw new Error(`Invalid fix type: ${type}. Valid types: ${Object.values(project_fixer_1.AutoFixType).join(', ')}`);
                    }
                    return fixType;
                });
            // Validate aggressiveness level
            const validLevels = ['conservative', 'moderate', 'aggressive'];
            if (!validLevels.includes(options.aggressiveness)) {
                throw new Error(`Invalid aggressiveness level: ${options.aggressiveness}. Valid levels: ${validLevels.join(', ')}`);
            }
            // Create project fixer options
            const fixerOptions = {
                projectPath: absolutePath,
                outputPath: options.output ? path.resolve(options.output) : undefined,
                dryRun: options.dryRun,
                fixTypes,
                aggressiveness: options.aggressiveness,
                backupOriginal: !options.noBackup,
                generateReport: !options.noReport
            };
            // Display configuration
            console.log('\n🔧 CodeMind Auto-Fix Configuration:');
            console.log(`   Project Path: ${fixerOptions.projectPath}`);
            console.log(`   Output Path: ${fixerOptions.outputPath || 'Same as project'}`);
            console.log(`   Dry Run: ${fixerOptions.dryRun ? 'Yes' : 'No'}`);
            console.log(`   Create Backup: ${fixerOptions.backupOriginal ? 'Yes' : 'No'}`);
            console.log(`   Generate Report: ${fixerOptions.generateReport ? 'Yes' : 'No'}`);
            console.log(`   Fix Types: ${fixTypes.join(', ')}`);
            console.log(`   Aggressiveness: ${fixerOptions.aggressiveness}`);
            console.log('');
            if (fixerOptions.dryRun) {
                console.log('🔍 DRY RUN MODE - No changes will be made to your project\n');
            }
            else {
                console.log('⚠️  LIVE MODE - Your project will be modified\n');
                if (!fixerOptions.backupOriginal) {
                    console.log('❗ WARNING: No backup will be created. Make sure you have version control!\n');
                }
            }
            // Create and run project fixer
            const fixer = new project_fixer_1.ProjectFixer();
            console.log('🚀 Starting project analysis and improvement...\n');
            const report = await fixer.analyzeAndFix(fixerOptions);
            // Display results
            console.log('✅ Project improvement completed!\n');
            console.log('📊 Summary:');
            console.log(`   Issues Found: ${report.summary.totalIssuesFound}`);
            console.log(`   Issues Fixed: ${report.summary.totalIssuesFixed}`);
            console.log(`   Files Analyzed: ${report.summary.filesAnalyzed}`);
            console.log(`   Files Modified: ${report.summary.filesModified}`);
            console.log(`   Lines Changed: ${report.summary.linesChanged}`);
            console.log(`   Overall Benefit Score: ${report.summary.overallBenefitScore}`);
            console.log('');
            // Display quality metrics
            console.log('📈 Quality Improvement:');
            console.log(`   Quality Score: ${report.metrics.before.qualityScore} → ${report.metrics.after.qualityScore} (+${report.metrics.improvement.qualityScore})`);
            if (report.metrics.improvement.duplicateLines > 0) {
                console.log(`   Duplicate Lines Removed: ${report.metrics.improvement.duplicateLines}`);
            }
            if (report.metrics.improvement.scatteredConfigs > 0) {
                console.log(`   Configurations Centralized: ${report.metrics.improvement.scatteredConfigs}`);
            }
            if (report.metrics.improvement.circularDependencies > 0) {
                console.log(`   Circular Dependencies Fixed: ${report.metrics.improvement.circularDependencies}`);
            }
            console.log('');
            // Display successful fixes
            const successfulFixes = report.fixes.filter(f => f.success);
            if (successfulFixes.length > 0) {
                console.log('✅ Successfully Applied Fixes:');
                successfulFixes.forEach(fix => {
                    console.log(`   ${fix.fixType.toUpperCase()}: ${fix.description}`);
                });
                console.log('');
            }
            // Display failed fixes
            const failedFixes = report.fixes.filter(f => !f.success);
            if (failedFixes.length > 0) {
                console.log('❌ Failed Fixes:');
                failedFixes.forEach(fix => {
                    console.log(`   ${fix.fixType.toUpperCase()}: ${fix.description}`);
                    if (fix.errors) {
                        console.log(`      Errors: ${fix.errors.join(', ')}`);
                    }
                });
                console.log('');
            }
            // Display recommendations
            if (report.recommendations.length > 0) {
                console.log('💡 Recommendations:');
                report.recommendations.forEach(rec => {
                    console.log(`   • ${rec}`);
                });
                console.log('');
            }
            // Display next steps
            if (report.nextSteps.length > 0) {
                console.log('🎯 Next Steps:');
                report.nextSteps.forEach(step => {
                    console.log(`   • ${step}`);
                });
                console.log('');
            }
            if (fixerOptions.generateReport) {
                console.log('📄 Detailed reports have been generated in your project directory');
                console.log('   • codemind-improvement-report.json');
                console.log('   • codemind-improvement-report.md');
            }
            process.exit(0);
        }
        catch (error) {
            logger.error('Auto-fix command failed', error);
            console.error(`\n❌ Error: ${error.message}`);
            process.exit(1);
        }
    });
}
// Example usage information
exports.autoFixExamples = `
Examples:
  # Analyze and fix all issues (with backup)
  npx codemind auto-fix ./my-project

  # Dry run to see what would be fixed
  npx codemind auto-fix ./my-project --dry-run

  # Fix only specific issue types
  npx codemind auto-fix ./my-project --types duplicates centralization

  # Conservative fixes only, no backup
  npx codemind auto-fix ./my-project --aggressiveness conservative --no-backup

  # Aggressive fixes with custom output directory
  npx codemind auto-fix ./my-project --aggressiveness aggressive --output ./reports

  # Verbose mode for debugging
  npx codemind auto-fix ./my-project --verbose

Fix Types:
  • duplicates      - Remove code duplications
  • centralization  - Centralize scattered configurations
  • dependencies    - Fix circular dependencies and optimize imports
  • security        - Address security vulnerabilities
  • performance     - Optimize performance bottlenecks
  • architecture    - Improve architectural patterns
  • quality         - General code quality improvements
  • all             - Apply all fix types (default)

Aggressiveness Levels:
  • conservative    - Apply only safe, low-risk fixes
  • moderate        - Apply most fixes with reasonable confidence (default)
  • aggressive      - Apply all possible fixes, including potentially risky ones
`;
//# sourceMappingURL=auto-fix.js.map