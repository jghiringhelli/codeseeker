/**
 * Quality Tool Manager
 * Manages language-specific quality tools with validation, installation, and fallback handling
 * Following SOLID principles with extensible tool categories
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../../utils/logger';
import inquirer from 'inquirer';

const execAsync = promisify(exec);

export interface QualityTool {
  name: string;
  command: string;
  installCommand?: string;
  configFiles?: string[];
  requiredDependencies?: string[];
  description: string;
  category: 'linting' | 'formatting' | 'security' | 'testing' | 'compilation' | 'complexity';
  weight: number; // Quality score weight (0-1)
}

export interface LanguageTools {
  language: string;
  extensions: string[];
  tools: {
    linting: QualityTool[];
    formatting: QualityTool[];
    security: QualityTool[];
    testing: QualityTool[];
    compilation: QualityTool[];
    complexity: QualityTool[];
  };
}

export interface ToolValidationResult {
  isAvailable: boolean;
  isConfigured: boolean;
  missingDependencies: string[];
  missingConfigFiles: string[];
  installationRequired: boolean;
  skipReason?: string;
}

export interface QualityCheckOptions {
  autoInstall?: boolean;
  skipOnFailure?: boolean;
  userPrompts?: boolean;
  enableUserInteraction?: boolean;
  languages: string[];
  categories: string[];
}

export class QualityToolManager {
  private logger = Logger.getInstance();
  private languageToolMap: Map<string, LanguageTools> = new Map();
  private claudeCodeIntegration: any;

  constructor(claudeCodeIntegration?: any) {
    this.claudeCodeIntegration = claudeCodeIntegration;
    this.initializeLanguageTools();
  }

  /**
   * Initialize language-specific tool configurations
   */
  private initializeLanguageTools(): void {
    // TypeScript/JavaScript Tools
    this.languageToolMap.set('typescript', {
      language: 'typescript',
      extensions: ['.ts', '.tsx'],
      tools: {
        linting: [
          {
            name: 'ESLint (TypeScript)',
            command: 'npx eslint --ext .ts,.tsx --format json',
            installCommand: 'npm install --save-dev @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint',
            configFiles: ['.eslintrc.js', '.eslintrc.json', '.eslintrc.yml'],
            requiredDependencies: ['@typescript-eslint/parser', '@typescript-eslint/eslint-plugin', 'eslint'],
            description: 'TypeScript-aware ESLint linting',
            category: 'linting',
            weight: 0.2
          }
        ],
        formatting: [
          {
            name: 'Prettier',
            command: 'npx prettier --check',
            installCommand: 'npm install --save-dev prettier',
            configFiles: ['.prettierrc', '.prettierrc.json', 'prettier.config.js'],
            requiredDependencies: ['prettier'],
            description: 'Code formatting with Prettier',
            category: 'formatting',
            weight: 0.1
          }
        ],
        security: [
          {
            name: 'Audit (npm)',
            command: 'npm audit --audit-level moderate --json',
            description: 'NPM package vulnerability audit',
            category: 'security',
            weight: 0.15
          },
          {
            name: 'ESLint Security',
            command: 'npx eslint --ext .ts,.tsx --format json -c .eslintrc-security.js',
            installCommand: 'npm install --save-dev eslint-plugin-security',
            requiredDependencies: ['eslint-plugin-security'],
            description: 'Security-focused ESLint rules',
            category: 'security',
            weight: 0.1
          }
        ],
        testing: [
          {
            name: 'Jest',
            command: 'npx jest --coverage --json --outputFile coverage/coverage.json',
            installCommand: 'npm install --save-dev jest @types/jest ts-jest',
            configFiles: ['jest.config.js', 'jest.config.ts', 'package.json'],
            requiredDependencies: ['jest'],
            description: 'Unit testing with Jest',
            category: 'testing',
            weight: 0.2
          }
        ],
        compilation: [
          {
            name: 'TypeScript Compiler',
            command: 'npx tsc --noEmit --skipLibCheck',
            installCommand: 'npm install --save-dev typescript',
            configFiles: ['tsconfig.json'],
            requiredDependencies: ['typescript'],
            description: 'TypeScript compilation check',
            category: 'compilation',
            weight: 0.25
          }
        ],
        complexity: [
          {
            name: 'TypeScript Complexity',
            command: 'npx ts-complexity --format json',
            installCommand: 'npm install --save-dev ts-complexity',
            requiredDependencies: ['ts-complexity'],
            description: 'Code complexity analysis for TypeScript',
            category: 'complexity',
            weight: 0.1
          }
        ]
      }
    });

    // JavaScript Tools
    this.languageToolMap.set('javascript', {
      language: 'javascript',
      extensions: ['.js', '.jsx', '.mjs'],
      tools: {
        linting: [
          {
            name: 'ESLint (JavaScript)',
            command: 'npx eslint --ext .js,.jsx,.mjs --format json',
            installCommand: 'npm install --save-dev eslint',
            configFiles: ['.eslintrc.js', '.eslintrc.json'],
            requiredDependencies: ['eslint'],
            description: 'JavaScript ESLint linting',
            category: 'linting',
            weight: 0.2
          }
        ],
        formatting: [
          {
            name: 'Prettier',
            command: 'npx prettier --check',
            installCommand: 'npm install --save-dev prettier',
            configFiles: ['.prettierrc'],
            requiredDependencies: ['prettier'],
            description: 'Code formatting with Prettier',
            category: 'formatting',
            weight: 0.1
          }
        ],
        security: [
          {
            name: 'Audit (npm)',
            command: 'npm audit --audit-level moderate --json',
            description: 'NPM package vulnerability audit',
            category: 'security',
            weight: 0.2
          }
        ],
        testing: [
          {
            name: 'Jest',
            command: 'npx jest --coverage --json',
            installCommand: 'npm install --save-dev jest',
            configFiles: ['jest.config.js'],
            requiredDependencies: ['jest'],
            description: 'Unit testing with Jest',
            category: 'testing',
            weight: 0.2
          }
        ],
        compilation: [], // No compilation for plain JS
        complexity: [
          {
            name: 'ESComplex',
            command: 'npx escomplexity --format json',
            installCommand: 'npm install --save-dev escomplexity',
            requiredDependencies: ['escomplexity'],
            description: 'JavaScript complexity analysis',
            category: 'complexity',
            weight: 0.1
          }
        ]
      }
    });

    // Python Tools
    this.languageToolMap.set('python', {
      language: 'python',
      extensions: ['.py'],
      tools: {
        linting: [
          {
            name: 'Flake8',
            command: 'flake8 --format=json',
            installCommand: 'pip install flake8',
            configFiles: ['.flake8', 'setup.cfg', 'tox.ini'],
            description: 'Python code linting with Flake8',
            category: 'linting',
            weight: 0.2
          },
          {
            name: 'Pylint',
            command: 'pylint --output-format=json',
            installCommand: 'pip install pylint',
            configFiles: ['.pylintrc', 'pylint.cfg'],
            description: 'Comprehensive Python linting',
            category: 'linting',
            weight: 0.15
          }
        ],
        formatting: [
          {
            name: 'Black',
            command: 'black --check --diff',
            installCommand: 'pip install black',
            configFiles: ['pyproject.toml'],
            description: 'Python code formatting with Black',
            category: 'formatting',
            weight: 0.1
          }
        ],
        security: [
          {
            name: 'Bandit',
            command: 'bandit -f json -r .',
            installCommand: 'pip install bandit',
            description: 'Python security vulnerability scanner',
            category: 'security',
            weight: 0.2
          }
        ],
        testing: [
          {
            name: 'Pytest',
            command: 'pytest --cov --cov-report=json',
            installCommand: 'pip install pytest pytest-cov',
            configFiles: ['pytest.ini', 'setup.cfg', 'pyproject.toml'],
            description: 'Python unit testing with Pytest',
            category: 'testing',
            weight: 0.2
          }
        ],
        compilation: [
          {
            name: 'Python Syntax Check',
            command: 'python -m py_compile',
            description: 'Python syntax validation',
            category: 'compilation',
            weight: 0.15
          }
        ],
        complexity: [
          {
            name: 'Radon',
            command: 'radon cc --json .',
            installCommand: 'pip install radon',
            description: 'Python code complexity analysis',
            category: 'complexity',
            weight: 0.1
          }
        ]
      }
    });

    // Add more languages as needed...
  }

  /**
   * Detect project languages based on file extensions
   */
  async detectProjectLanguages(projectPath: string): Promise<string[]> {
    const languages = new Set<string>();

    try {
      const { glob } = await import('glob');

      for (const [lang, config] of this.languageToolMap) {
        for (const ext of config.extensions) {
          const pattern = `**/*${ext}`;
          const files = await glob(pattern, { cwd: projectPath });

          if (files.length > 0) {
            languages.add(lang);
            break;
          }
        }
      }
    } catch (error) {
      this.logger.warn(`Language detection failed: ${error.message}`);
    }

    return Array.from(languages);
  }

  /**
   * Validate if a tool is available and properly configured
   */
  async validateTool(tool: QualityTool, projectPath: string): Promise<ToolValidationResult> {
    const result: ToolValidationResult = {
      isAvailable: false,
      isConfigured: false,
      missingDependencies: [],
      missingConfigFiles: [],
      installationRequired: false
    };

    try {
      // Check if command is available
      await execAsync(tool.command.split(' ')[0] + ' --version', {
        cwd: projectPath,
        timeout: 5000
      });
      result.isAvailable = true;
    } catch (error) {
      result.installationRequired = true;
    }

    // Check dependencies
    if (tool.requiredDependencies) {
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies
        };

        for (const dep of tool.requiredDependencies) {
          if (!allDeps[dep]) {
            result.missingDependencies.push(dep);
            result.installationRequired = true;
          }
        }
      }
    }

    // Check configuration files
    if (tool.configFiles) {
      const foundConfig = tool.configFiles.some(configFile =>
        fs.existsSync(path.join(projectPath, configFile))
      );
      result.isConfigured = foundConfig;

      if (!foundConfig) {
        result.missingConfigFiles = tool.configFiles;
      }
    } else {
      result.isConfigured = true; // No config required
    }

    return result;
  }

  /**
   * Run quality checks for detected languages with resilient error handling
   */
  async runQualityChecks(
    projectPath: string,
    options: QualityCheckOptions = {
      autoInstall: false,
      skipOnFailure: true,
      userPrompts: true,
      languages: [],
      categories: ['linting', 'security', 'compilation', 'testing']
    }
  ): Promise<any> {
    // Map enableUserInteraction to userPrompts for backward compatibility
    if (options.enableUserInteraction !== undefined) {
      options.userPrompts = options.enableUserInteraction;
    }
    const results = {
      overallScore: 100,
      issues: [] as string[],
      results: {} as any, // Category-based results for compatibility
      detailedResults: {} as any,
      skippedTools: [] as string[],
      installedTools: [] as string[]
    };

    // Detect languages if not provided
    const languages = options.languages.length > 0
      ? options.languages
      : await this.detectProjectLanguages(projectPath);

    console.log(`🔍 Detected languages: ${languages.join(', ')}`);

    for (const language of languages) {
      const languageTools = this.languageToolMap.get(language);
      if (!languageTools) continue;

      console.log(`\n📋 Running quality checks for ${language}...`);

      for (const category of options.categories) {
        const tools = languageTools.tools[category as keyof typeof languageTools.tools];
        if (!tools || tools.length === 0) continue;

        console.log(`  🔧 ${category} checks...`);

        // Initialize category result if not exists
        if (!results.results[category]) {
          results.results[category] = {
            score: 100,
            issues: [] as string[],
            tools: [] as string[]
          };
        }

        for (const tool of tools) {
          const toolResult = await this.runSingleTool(
            tool,
            projectPath,
            options,
            results
          );

          if (toolResult.executed) {
            results.detailedResults[tool.name] = toolResult.result;
            results.results[category].tools.push(tool.name);

            if (toolResult.penalty > 0) {
              results.overallScore -= toolResult.penalty;
              results.results[category].score -= toolResult.penalty;
              results.results[category].issues.push(...toolResult.issues);
              results.issues.push(...toolResult.issues);
            }
          }
        }

        // Ensure category score stays within bounds
        results.results[category].score = Math.max(0, Math.min(100, results.results[category].score));
      }
    }

    results.overallScore = Math.max(0, Math.min(100, results.overallScore));
    return results;
  }

  /**
   * Run a single quality tool with comprehensive error handling
   */
  private async runSingleTool(
    tool: QualityTool,
    projectPath: string,
    options: QualityCheckOptions,
    results: any
  ): Promise<{executed: boolean, result?: any, penalty: number, issues: string[]}> {
    try {
      console.log(`    🔍 ${tool.name}...`);

      // Validate tool availability
      const validation = await this.validateTool(tool, projectPath);

      if (!validation.isAvailable || validation.installationRequired) {
        // Handle missing tool
        const shouldInstall = await this.handleMissingTool(tool, validation, options);

        if (shouldInstall && this.claudeCodeIntegration) {
          const installed = await this.installToolViaClaudeCode(tool, projectPath);
          if (installed) {
            results.installedTools.push(tool.name);
            console.log(`    ✅ ${tool.name} installed successfully`);
          } else {
            return this.skipTool(tool, 'Installation failed', results);
          }
        } else if (!shouldInstall) {
          return this.skipTool(tool, 'User declined installation', results);
        } else {
          return this.skipTool(tool, 'No Claude Code integration available', results);
        }
      }

      if (!validation.isConfigured && tool.configFiles) {
        // Handle missing configuration
        const shouldCreateConfig = await this.handleMissingConfig(tool, validation, options);

        if (shouldCreateConfig && this.claudeCodeIntegration) {
          const configured = await this.createConfigViaClaudeCode(tool, projectPath);
          if (!configured) {
            return this.skipTool(tool, 'Configuration creation failed', results);
          }
        } else {
          return this.skipTool(tool, 'Missing configuration', results);
        }
      }

      // Execute the tool
      const result = await execAsync(tool.command, {
        cwd: projectPath,
        timeout: 30000,
        encoding: 'utf8'
      });

      // Parse results based on tool type
      const parsedResult = this.parseToolOutput(tool, result.stdout);
      const penalty = this.calculatePenalty(tool, parsedResult);
      const issues = this.extractIssues(tool, parsedResult);

      console.log(`    ✅ ${tool.name} completed (${penalty > 0 ? issues.length + ' issues' : 'clean'})`);

      return {
        executed: true,
        result: parsedResult,
        penalty,
        issues
      };

    } catch (error) {
      if (options.skipOnFailure) {
        return this.skipTool(tool, `Execution failed: ${error.message}`, results);
      } else {
        throw error;
      }
    }
  }

  /**
   * Handle missing tool with user interaction
   */
  private async handleMissingTool(
    tool: QualityTool,
    validation: ToolValidationResult,
    options: QualityCheckOptions
  ): Promise<boolean> {
    if (options.autoInstall) return true;
    if (!options.userPrompts) return false;

    console.log(`\n⚠️  ${tool.name} is not available or properly installed.`);
    console.log(`   Description: ${tool.description}`);

    if (validation.missingDependencies.length > 0) {
      console.log(`   Missing dependencies: ${validation.missingDependencies.join(', ')}`);
    }

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: `What would you like to do with ${tool.name}?`,
        choices: [
          { name: '🔧 Install automatically via Claude Code', value: 'install' },
          { name: '⏭️  Skip this tool', value: 'skip' },
          { name: '🚫 Skip entire category', value: 'skip_category' }
        ]
      }
    ]);

    return answer.action === 'install';
  }

  /**
   * Handle missing configuration
   */
  private async handleMissingConfig(
    tool: QualityTool,
    validation: ToolValidationResult,
    options: QualityCheckOptions
  ): Promise<boolean> {
    if (!options.userPrompts) return false;

    console.log(`\n⚙️  ${tool.name} is installed but not configured.`);
    console.log(`   Missing config files: ${validation.missingConfigFiles.join(', ')}`);

    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'createConfig',
        message: `Create configuration for ${tool.name} via Claude Code?`,
        default: true
      }
    ]);

    return answer.createConfig;
  }

  /**
   * Install tool via Claude Code integration
   */
  private async installToolViaClaudeCode(tool: QualityTool, projectPath: string): Promise<boolean> {
    if (!tool.installCommand) return false;

    try {
      const installPrompt = `
Install ${tool.name} for quality checking:

Command to run: ${tool.installCommand}
Description: ${tool.description}

Please:
1. Run the installation command
2. Verify the installation was successful
3. Report any errors or issues

Project path: ${projectPath}
`;

      console.log(`    🔧 Installing ${tool.name} via Claude Code...`);
      const result = await this.claudeCodeIntegration.executeClaudeCode(
        installPrompt,
        `Tool installation request for ${tool.name}`,
        { projectPath }
      );

      return result.success;
    } catch (error) {
      this.logger.error(`Failed to install ${tool.name}: ${error.message}`);
      return false;
    }
  }

  /**
   * Create configuration via Claude Code
   */
  private async createConfigViaClaudeCode(tool: QualityTool, projectPath: string): Promise<boolean> {
    try {
      const configPrompt = `
Create configuration for ${tool.name}:

Tool: ${tool.name}
Description: ${tool.description}
Config files needed: ${tool.configFiles?.join(', ')}

Please:
1. Create appropriate configuration files
2. Use best practices for this tool
3. Consider the project structure and language

Project path: ${projectPath}
`;

      console.log(`    ⚙️  Creating configuration for ${tool.name}...`);
      const result = await this.claudeCodeIntegration.executeClaudeCode(
        configPrompt,
        `Configuration creation for ${tool.name}`,
        { projectPath }
      );

      return result.success;
    } catch (error) {
      this.logger.error(`Failed to create config for ${tool.name}: ${error.message}`);
      return false;
    }
  }

  /**
   * Skip a tool and record the reason
   */
  private skipTool(tool: QualityTool, reason: string, results: any): {executed: boolean, penalty: number, issues: string[]} {
    console.log(`    ⏭️  Skipping ${tool.name}: ${reason}`);
    results.skippedTools.push(`${tool.name}: ${reason}`);
    return { executed: false, penalty: 0, issues: [] };
  }

  /**
   * Parse tool output based on tool type and format
   */
  private parseToolOutput(tool: QualityTool, output: string): any {
    try {
      // Most tools support JSON output
      if (output.trim().startsWith('{') || output.trim().startsWith('[')) {
        return JSON.parse(output);
      }

      // Plain text output
      return { rawOutput: output };
    } catch (error) {
      return { rawOutput: output, parseError: error.message };
    }
  }

  /**
   * Calculate penalty based on tool results
   */
  private calculatePenalty(tool: QualityTool, result: any): number {
    if (!result || result.parseError) return 0;

    const maxPenalty = tool.weight * 100; // Convert weight to penalty points

    // Tool-specific penalty calculation
    switch (tool.category) {
      case 'linting':
        const issues = result.length || result.errorCount || 0;
        return Math.min(maxPenalty, issues * 2);

      case 'security':
        const vulnerabilities = result.vulnerabilities?.length || result.advisories?.length || 0;
        return Math.min(maxPenalty, vulnerabilities * 5);

      case 'compilation':
        return result.success === false ? maxPenalty : 0;

      case 'testing':
        const failed = result.numFailedTests || 0;
        const coverage = result.coverageMap?.total?.statements?.pct || 100;
        return Math.min(maxPenalty, failed * 3 + Math.max(0, 80 - coverage));

      default:
        return 0;
    }
  }

  /**
   * Extract human-readable issues from tool results
   */
  private extractIssues(tool: QualityTool, result: any): string[] {
    if (!result || result.parseError) return [];

    const issues: string[] = [];

    switch (tool.category) {
      case 'linting':
        if (Array.isArray(result)) {
          result.forEach(file => {
            if (file.messages) {
              file.messages.forEach((msg: any) => {
                issues.push(`${file.filePath}:${msg.line} - ${msg.message}`);
              });
            }
          });
        }
        break;

      case 'security':
        if (result.vulnerabilities) {
          result.vulnerabilities.forEach((vuln: any) => {
            issues.push(`${vuln.severity} vulnerability in ${vuln.module_name}: ${vuln.title}`);
          });
        }
        break;
    }

    return issues.slice(0, 10); // Limit to top 10 issues
  }
}

export default QualityToolManager;