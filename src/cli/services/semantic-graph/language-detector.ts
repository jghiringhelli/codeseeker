/**
 * Language Detector and Package Installer
 * Detects project languages and installs required Tree-sitter parsers
 */

import { Logger } from '../../../utils/logger';
import glob from 'fast-glob';
import * as path from 'path';
import { execSync } from 'child_process';

export interface LanguageInfo {
  name: string;
  extensions: string[];
  treeSitterPackage: string;
  parserClass: string;
  quality: 'excellent' | 'good' | 'basic';
  description: string;
}

export interface ProjectLanguageStats {
  language: string;
  fileCount: number;
  percentage: number;
  extensions: string[];
}

export interface LanguageSetupResult {
  detectedLanguages: ProjectLanguageStats[];
  selectedLanguages: string[];
  installedPackages: string[];
  errors: string[];
}

export class LanguageDetector {
  private logger = Logger.getInstance();

  private readonly supportedLanguages: LanguageInfo[] = [
    {
      name: 'TypeScript',
      extensions: ['ts', 'tsx'],
      treeSitterPackage: '@babel/parser', // Already installed
      parserClass: 'TypeScriptParser',
      quality: 'excellent',
      description: 'TypeScript/JSX - Babel AST (Perfect parsing)'
    },
    {
      name: 'JavaScript',
      extensions: ['js', 'jsx'],
      treeSitterPackage: '@babel/parser', // Already installed
      parserClass: 'TypeScriptParser',
      quality: 'excellent', 
      description: 'JavaScript/JSX - Babel AST (Perfect parsing)'
    },
    {
      name: 'Python',
      extensions: ['py', 'pyx', 'pyi'],
      treeSitterPackage: 'tree-sitter-python',
      parserClass: 'TreeSitterPythonParser',
      quality: 'excellent',
      description: 'Python - Tree-sitter AST (Classes, functions, decorators)'
    },
    {
      name: 'Java',
      extensions: ['java'],
      treeSitterPackage: 'tree-sitter-java',
      parserClass: 'TreeSitterJavaParser', 
      quality: 'excellent',
      description: 'Java - Tree-sitter AST (Packages, annotations, generics)'
    },
    {
      name: 'C',
      extensions: ['c', 'h'],
      treeSitterPackage: 'tree-sitter-c',
      parserClass: 'TreeSitterCParser',
      quality: 'excellent',
      description: 'C - Tree-sitter AST (Headers, functions, structs)'
    },
    {
      name: 'C++',
      extensions: ['cpp', 'cc', 'cxx', 'hpp'],
      treeSitterPackage: 'tree-sitter-cpp',
      parserClass: 'TreeSitterCppParser',
      quality: 'excellent',
      description: 'C++ - Tree-sitter AST (Classes, templates, namespaces)'
    },
    {
      name: 'C#',
      extensions: ['cs'],
      treeSitterPackage: 'tree-sitter-c-sharp',
      parserClass: 'TreeSitterCSharpParser',
      quality: 'excellent',
      description: 'C# - Tree-sitter AST (Namespaces, LINQ, async/await)'
    },
    {
      name: 'Go',
      extensions: ['go'],
      treeSitterPackage: 'tree-sitter-go',
      parserClass: 'TreeSitterGoParser',
      quality: 'excellent',
      description: 'Go - Tree-sitter AST (Packages, interfaces, goroutines)'
    },
    {
      name: 'Rust',
      extensions: ['rs'],
      treeSitterPackage: 'tree-sitter-rust',
      parserClass: 'TreeSitterRustParser',
      quality: 'excellent',
      description: 'Rust - Tree-sitter AST (Traits, macros, ownership)'
    },
    {
      name: 'Ruby',
      extensions: ['rb'],
      treeSitterPackage: 'tree-sitter-ruby',
      parserClass: 'TreeSitterRubyParser',
      quality: 'good',
      description: 'Ruby - Tree-sitter AST (Classes, modules, blocks)'
    },
    {
      name: 'PHP',
      extensions: ['php'],
      treeSitterPackage: 'tree-sitter-php',
      parserClass: 'TreeSitterPhpParser',
      quality: 'good',
      description: 'PHP - Tree-sitter AST (Classes, namespaces, traits)'
    }
  ];

  /**
   * Detect languages in project directory
   */
  async detectProjectLanguages(projectPath: string): Promise<ProjectLanguageStats[]> {
    this.logger.info('🔍 Detecting project languages...');
    
    const languageStats = new Map<string, { count: number; extensions: Set<string> }>();
    let totalFiles = 0;

    // Scan all code files
    const codeFiles = await glob(['**/*'], {
      cwd: projectPath,
      absolute: false,
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**', 
        '**/.git/**',
        '**/coverage/**'
      ]
    });

    // Count files by language
    for (const file of codeFiles) {
      const ext = this.getFileExtension(file);
      if (!ext) continue;

      const language = this.findLanguageByExtension(ext);
      if (language) {
        totalFiles++;
        
        if (!languageStats.has(language.name)) {
          languageStats.set(language.name, { count: 0, extensions: new Set() });
        }
        
        const stats = languageStats.get(language.name)!;
        stats.count++;
        stats.extensions.add(ext);
      }
    }

    // Convert to sorted results
    const results: ProjectLanguageStats[] = [];
    for (const [language, stats] of languageStats) {
      results.push({
        language,
        fileCount: stats.count,
        percentage: Math.round((stats.count / totalFiles) * 100),
        extensions: Array.from(stats.extensions)
      });
    }

    // Sort by file count (most used first)
    results.sort((a, b) => b.fileCount - a.fileCount);

    this.logger.info(`📊 Found ${results.length} languages in ${totalFiles} files`);
    return results;
  }

  /**
   * Interactive language selection with user prompts
   */
  async selectLanguagesInteractively(
    detectedLanguages: ProjectLanguageStats[]
  ): Promise<string[]> {
    
    console.log('\n🌐 Detected Languages in Your Project:');
    console.log('=====================================');
    
    detectedLanguages.forEach((lang, index) => {
      const langInfo = this.supportedLanguages.find(l => l.name === lang.language);
      const qualityEmoji = this.getQualityEmoji(langInfo?.quality || 'basic');
      
      console.log(`${index + 1}. ${qualityEmoji} ${lang.language} - ${lang.fileCount} files (${lang.percentage}%)`);
      if (langInfo) {
        console.log(`   📝 ${langInfo.description}`);
      }
    });

    console.log('\n🎯 Parsing Quality Levels:');
    console.log('🟢 Excellent - Perfect AST parsing with full language support');
    console.log('🟡 Good - Regex-based parsing with most features');
    console.log('🟠 Basic - Generic text analysis');

    // Auto-select languages with >5% of files
    const autoSelected = detectedLanguages
      .filter(lang => lang.percentage >= 5)
      .map(lang => lang.language);

    console.log(`\n✅ Auto-selected languages (>5% of files): ${autoSelected.join(', ')}`);
    
    // For now, return auto-selected languages
    // TODO: Add actual interactive prompts using inquirer
    return autoSelected;
  }

  /**
   * Install Tree-sitter packages for selected languages
   */
  async installLanguagePackages(selectedLanguages: string[]): Promise<LanguageSetupResult> {
    const result: LanguageSetupResult = {
      detectedLanguages: [],
      selectedLanguages,
      installedPackages: [],
      errors: []
    };

    console.log('\n📦 Installing Tree-sitter Packages...');
    console.log('====================================');

    const packagesToInstall = new Set<string>();
    
    // Collect required packages
    for (const languageName of selectedLanguages) {
      const languageInfo = this.supportedLanguages.find(l => l.name === languageName);
      
      if (languageInfo && languageInfo.treeSitterPackage !== '@babel/parser') {
        // Skip @babel/parser as it's already installed
        packagesToInstall.add(languageInfo.treeSitterPackage);
      }
    }

    // Install Tree-sitter core if needed
    if (packagesToInstall.size > 0) {
      packagesToInstall.add('tree-sitter');
    }

    // Install packages
    for (const packageName of packagesToInstall) {
      try {
        console.log(`📥 Installing ${packageName}...`);
        
        // Check if package is already installed
        if (await this.isPackageInstalled(packageName)) {
          console.log(`✅ ${packageName} already installed`);
          result.installedPackages.push(packageName);
          continue;
        }

        // Install package
        execSync(`npm install ${packageName}`, {
          stdio: 'pipe',
          cwd: process.cwd()
        });
        
        console.log(`✅ ${packageName} installed successfully`);
        result.installedPackages.push(packageName);
        
      } catch (error) {
        const errorMsg = `Failed to install ${packageName}: ${error.message}`;
        console.log(`❌ ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }

    console.log(`\n🎉 Installation complete! ${result.installedPackages.length} packages installed`);
    
    if (result.errors.length > 0) {
      console.log(`⚠️ ${result.errors.length} errors occurred (parsers will fallback to regex)`);
    }

    return result;
  }

  /**
   * Get parsing quality for a language
   */
  getLanguageQuality(languageName: string): 'excellent' | 'good' | 'basic' {
    const langInfo = this.supportedLanguages.find(l => l.name === languageName);
    return langInfo?.quality || 'basic';
  }

  /**
   * Get recommended parser class for a language
   */
  getParserClass(languageName: string): string {
    const langInfo = this.supportedLanguages.find(l => l.name === languageName);
    return langInfo?.parserClass || 'GenericParser';
  }

  /**
   * Check if enhanced parsing is available for languages
   */
  async validateParsersAvailable(selectedLanguages: string[]): Promise<{
    available: string[];
    unavailable: string[];
  }> {
    const available: string[] = [];
    const unavailable: string[] = [];

    for (const languageName of selectedLanguages) {
      const langInfo = this.supportedLanguages.find(l => l.name === languageName);
      
      if (!langInfo) {
        unavailable.push(languageName);
        continue;
      }

      // Check if package is available
      if (langInfo.treeSitterPackage === '@babel/parser' || 
          await this.isPackageInstalled(langInfo.treeSitterPackage)) {
        available.push(languageName);
      } else {
        unavailable.push(languageName);
      }
    }

    return { available, unavailable };
  }

  // ============================================
  // PRIVATE UTILITY METHODS
  // ============================================

  private getFileExtension(filePath: string): string {
    return path.extname(filePath).substring(1).toLowerCase();
  }

  private findLanguageByExtension(extension: string): LanguageInfo | undefined {
    return this.supportedLanguages.find(lang => 
      lang.extensions.includes(extension)
    );
  }

  private getQualityEmoji(quality: string): string {
    switch (quality) {
      case 'excellent': return '🟢';
      case 'good': return '🟡';
      case 'basic': return '🟠';
      default: return '⚪';
    }
  }

  private async isPackageInstalled(packageName: string): Promise<boolean> {
    try {
      execSync(`npm list ${packageName}`, { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }
}