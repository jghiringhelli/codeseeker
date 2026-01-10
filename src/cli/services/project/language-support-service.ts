/**
 * Language Support Service
 * Handles dynamic installation of Tree-sitter parsers based on detected languages
 * Follows Single Responsibility: manages parser availability and installation
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import glob from 'fast-glob';

export interface LanguageParserInfo {
  language: string;
  extensions: string[];
  npmPackage: string;
  installed: boolean;
  quality: 'excellent' | 'good' | 'basic';
  description: string;
}

export interface ProjectLanguageAnalysis {
  detectedLanguages: Array<{
    language: string;
    fileCount: number;
    percentage: number;
  }>;
  installedParsers: string[];
  missingParsers: LanguageParserInfo[];
  recommendations: string[];
}

export interface InstallResult {
  success: boolean;
  installed: string[];
  failed: Array<{ package: string; error: string }>;
  message: string;
}

/**
 * Manages Tree-sitter parser availability and installation
 */
export class LanguageSupportService {

  // Registry of available Tree-sitter parsers
  private readonly parserRegistry: LanguageParserInfo[] = [
    {
      language: 'TypeScript',
      extensions: ['ts', 'tsx'],
      npmPackage: '@babel/parser', // Already bundled, uses Babel
      installed: true, // Always available
      quality: 'excellent',
      description: 'Babel AST parser (bundled)'
    },
    {
      language: 'JavaScript',
      extensions: ['js', 'jsx'],
      npmPackage: '@babel/parser', // Already bundled
      installed: true,
      quality: 'excellent',
      description: 'Babel AST parser (bundled)'
    },
    {
      language: 'Python',
      extensions: ['py', 'pyx', 'pyi'],
      npmPackage: 'tree-sitter-python',
      installed: false,
      quality: 'excellent',
      description: 'Tree-sitter AST (classes, functions, decorators)'
    },
    {
      language: 'Java',
      extensions: ['java'],
      npmPackage: 'tree-sitter-java',
      installed: false,
      quality: 'excellent',
      description: 'Tree-sitter AST (packages, annotations, generics)'
    },
    {
      language: 'C#',
      extensions: ['cs'],
      npmPackage: 'tree-sitter-c-sharp',
      installed: false,
      quality: 'excellent',
      description: 'Tree-sitter AST (namespaces, LINQ, async/await)'
    },
    {
      language: 'Go',
      extensions: ['go'],
      npmPackage: 'tree-sitter-go',
      installed: false,
      quality: 'excellent',
      description: 'Tree-sitter AST (packages, interfaces, goroutines)'
    },
    {
      language: 'Rust',
      extensions: ['rs'],
      npmPackage: 'tree-sitter-rust',
      installed: false,
      quality: 'excellent',
      description: 'Tree-sitter AST (traits, macros, ownership)'
    },
    {
      language: 'C',
      extensions: ['c', 'h'],
      npmPackage: 'tree-sitter-c',
      installed: false,
      quality: 'excellent',
      description: 'Tree-sitter AST (headers, functions, structs)'
    },
    {
      language: 'C++',
      extensions: ['cpp', 'cc', 'cxx', 'hpp'],
      npmPackage: 'tree-sitter-cpp',
      installed: false,
      quality: 'excellent',
      description: 'Tree-sitter AST (classes, templates, namespaces)'
    },
    {
      language: 'Ruby',
      extensions: ['rb'],
      npmPackage: 'tree-sitter-ruby',
      installed: false,
      quality: 'excellent',
      description: 'Tree-sitter AST (classes, modules, blocks)'
    },
    {
      language: 'PHP',
      extensions: ['php'],
      npmPackage: 'tree-sitter-php',
      installed: false,
      quality: 'good',
      description: 'Tree-sitter AST (classes, namespaces, traits)'
    },
    {
      language: 'Swift',
      extensions: ['swift'],
      npmPackage: 'tree-sitter-swift',
      installed: false,
      quality: 'good',
      description: 'Tree-sitter AST (protocols, extensions)'
    },
    {
      language: 'Kotlin',
      extensions: ['kt', 'kts'],
      npmPackage: 'tree-sitter-kotlin',
      installed: false,
      quality: 'good',
      description: 'Tree-sitter AST (data classes, coroutines)'
    }
  ];

  /**
   * Check which parsers are currently installed
   */
  async checkInstalledParsers(): Promise<LanguageParserInfo[]> {
    const results: LanguageParserInfo[] = [];

    for (const parser of this.parserRegistry) {
      const info = { ...parser };

      // Babel is always available (bundled)
      if (parser.npmPackage === '@babel/parser') {
        info.installed = true;
      } else {
        info.installed = await this.isPackageInstalled(parser.npmPackage);
      }

      results.push(info);
    }

    return results;
  }

  /**
   * Analyze a project and determine which parsers are needed
   */
  async analyzeProjectLanguages(projectPath: string): Promise<ProjectLanguageAnalysis> {
    const languageCounts = new Map<string, number>();
    let totalFiles = 0;

    // Scan project files
    const files = await glob(['**/*'], {
      cwd: projectPath,
      absolute: false,
      ignore: [
        '**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**',
        '**/vendor/**', '**/venv/**', '**/__pycache__/**',
        '**/Library/**', '**/Temp/**', '**/Packages/**', '**/obj/**'
      ]
    });

    // Count files by language
    for (const file of files) {
      const ext = path.extname(file).slice(1).toLowerCase();
      if (!ext) continue;

      const language = this.getLanguageByExtension(ext);
      if (language) {
        totalFiles++;
        languageCounts.set(language, (languageCounts.get(language) || 0) + 1);
      }
    }

    // Sort by count
    const sortedLanguages = Array.from(languageCounts.entries())
      .map(([language, count]) => ({
        language,
        fileCount: count,
        percentage: Math.round((count / totalFiles) * 100)
      }))
      .sort((a, b) => b.fileCount - a.fileCount);

    // Check installed parsers
    const installedParsers = await this.checkInstalledParsers();
    const installedNames = installedParsers
      .filter(p => p.installed)
      .map(p => p.language);

    // Find missing parsers for detected languages
    const missingParsers = sortedLanguages
      .filter(lang => lang.percentage >= 5) // Only recommend for significant presence
      .map(lang => this.parserRegistry.find(p => p.language === lang.language))
      .filter((p): p is LanguageParserInfo => p !== undefined && !p.installed && p.npmPackage !== '@babel/parser');

    // Generate recommendations
    const recommendations: string[] = [];
    if (missingParsers.length > 0) {
      const packages = missingParsers.map(p => p.npmPackage).join(' ');
      recommendations.push(`Install enhanced parsers: npm install ${packages}`);
      recommendations.push('This will improve code structure extraction and relationship detection.');
    }

    return {
      detectedLanguages: sortedLanguages,
      installedParsers: installedNames,
      missingParsers,
      recommendations
    };
  }

  /**
   * Install Tree-sitter parsers for specified languages
   */
  async installLanguageParsers(languages: string[]): Promise<InstallResult> {
    const result: InstallResult = {
      success: true,
      installed: [],
      failed: [],
      message: ''
    };

    // Also need tree-sitter core if installing any tree-sitter packages
    const packagesToInstall: string[] = [];
    let needsTreeSitterCore = false;

    for (const language of languages) {
      const parserInfo = this.parserRegistry.find(
        p => p.language.toLowerCase() === language.toLowerCase()
      );

      if (!parserInfo) {
        result.failed.push({ package: language, error: 'Unknown language' });
        continue;
      }

      if (parserInfo.npmPackage === '@babel/parser') {
        result.installed.push(parserInfo.language + ' (bundled)');
        continue;
      }

      if (await this.isPackageInstalled(parserInfo.npmPackage)) {
        result.installed.push(parserInfo.language + ' (already installed)');
        continue;
      }

      packagesToInstall.push(parserInfo.npmPackage);
      needsTreeSitterCore = true;
    }

    // Check if tree-sitter core is needed
    if (needsTreeSitterCore && !(await this.isPackageInstalled('tree-sitter'))) {
      packagesToInstall.unshift('tree-sitter');
    }

    // Install packages
    if (packagesToInstall.length > 0) {
      for (const pkg of packagesToInstall) {
        try {
          console.log(`📦 Installing ${pkg}...`);
          execSync(`npm install ${pkg}`, {
            stdio: 'pipe',
            cwd: this.getCodeSeekerRoot()
          });

          const langName = this.parserRegistry.find(p => p.npmPackage === pkg)?.language || pkg;
          result.installed.push(langName);
          console.log(`✅ ${pkg} installed`);
        } catch (error: any) {
          result.success = false;
          result.failed.push({ package: pkg, error: error.message });
          console.error(`❌ Failed to install ${pkg}: ${error.message}`);
        }
      }
    }

    // Generate result message
    if (result.installed.length > 0) {
      result.message = `Installed parsers for: ${result.installed.join(', ')}`;
    }
    if (result.failed.length > 0) {
      result.message += result.message ? '. ' : '';
      result.message += `Failed: ${result.failed.map(f => f.package).join(', ')}`;
    }
    if (result.installed.length === 0 && result.failed.length === 0) {
      result.message = 'All requested parsers are already installed.';
    }

    return result;
  }

  /**
   * Get parser info for a specific language
   */
  getParserInfo(language: string): LanguageParserInfo | undefined {
    return this.parserRegistry.find(
      p => p.language.toLowerCase() === language.toLowerCase()
    );
  }

  /**
   * Get all supported languages
   */
  getSupportedLanguages(): LanguageParserInfo[] {
    return [...this.parserRegistry];
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private async isPackageInstalled(packageName: string): Promise<boolean> {
    try {
      // Try to require the package
      require.resolve(packageName, { paths: [this.getCodeSeekerRoot()] });
      return true;
    } catch {
      return false;
    }
  }

  private getLanguageByExtension(ext: string): string | undefined {
    for (const parser of this.parserRegistry) {
      if (parser.extensions.includes(ext)) {
        return parser.language;
      }
    }
    return undefined;
  }

  private getCodeSeekerRoot(): string {
    // Find the CodeSeeker installation directory
    // This handles both development and installed scenarios
    let dir = __dirname;
    while (dir !== path.dirname(dir)) {
      if (fs.existsSync(path.join(dir, 'package.json'))) {
        const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
        if (pkg.name === 'codeseeker-enhanced-cli') {
          return dir;
        }
      }
      dir = path.dirname(dir);
    }
    // Fallback to current working directory
    return process.cwd();
  }
}

// Export singleton for convenience
export const languageSupportService = new LanguageSupportService();
