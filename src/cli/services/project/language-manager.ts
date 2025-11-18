/**
 * Language Manager Service - Single Responsibility
 * Handles language detection and setup for projects
 */

import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ILanguageDetector, LanguageSetupResult } from '../../../core/interfaces/project-interfaces';

const execAsync = promisify(exec);

export class LanguageManager implements ILanguageDetector {
  private readonly languagePatterns = {
    typescript: ['.ts', '.tsx'],
    javascript: ['.js', '.jsx', '.mjs'],
    python: ['.py', '.pyx', '.pyi'],
    java: ['.java'],
    rust: ['.rs'],
    go: ['.go'],
    cpp: ['.cpp', '.cc', '.cxx', '.hpp', '.h'],
    csharp: ['.cs'],
    php: ['.php'],
    ruby: ['.rb'],
    kotlin: ['.kt', '.kts'],
    swift: ['.swift'],
    dart: ['.dart'],
    scala: ['.scala']
  };

  async detectLanguages(projectPath: string): Promise<string[]> {
    const detectedLanguages = new Set<string>();

    try {
      await this.scanDirectoryForLanguages(projectPath, detectedLanguages);
    } catch (error) {
      console.warn(`Language detection failed: ${error.message}`);
    }

    return Array.from(detectedLanguages);
  }

  async setupLanguageSupport(languages: string[]): Promise<LanguageSetupResult> {
    const installedPackages: string[] = [];
    const errors: string[] = [];

    for (const language of languages) {
      try {
        const packageName = this.getTreeSitterPackage(language);
        if (packageName) {
          await this.installTreeSitterParser(packageName);
          installedPackages.push(packageName);
        }
      } catch (error) {
        errors.push(`Failed to install ${language} support: ${error.message}`);
      }
    }

    return {
      detectedLanguages: languages,
      selectedLanguages: languages,
      installedPackages,
      errors
    };
  }

  private async scanDirectoryForLanguages(dirPath: string, detected: Set<string>): Promise<void> {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && !this.shouldSkipDirectory(entry.name)) {
        await this.scanDirectoryForLanguages(path.join(dirPath, entry.name), detected);
      } else if (entry.isFile()) {
        const language = this.detectLanguageFromFile(entry.name);
        if (language) {
          detected.add(language);
        }
      }
    }
  }

  private detectLanguageFromFile(filename: string): string | null {
    const ext = path.extname(filename).toLowerCase();

    for (const [language, extensions] of Object.entries(this.languagePatterns)) {
      if (extensions.includes(ext)) {
        return language;
      }
    }

    return null;
  }

  private shouldSkipDirectory(dirName: string): boolean {
    const skipDirs = ['node_modules', '.git', 'dist', 'build', 'target', '__pycache__', '.venv', 'venv'];
    return skipDirs.includes(dirName);
  }

  private getTreeSitterPackage(language: string): string | null {
    const packageMap: Record<string, string> = {
      typescript: 'tree-sitter-typescript',
      javascript: 'tree-sitter-javascript',
      python: 'tree-sitter-python',
      java: 'tree-sitter-java',
      rust: 'tree-sitter-rust',
      go: 'tree-sitter-go',
      cpp: 'tree-sitter-cpp',
      csharp: 'tree-sitter-c-sharp'
    };

    return packageMap[language] || null;
  }

  private async installTreeSitterParser(packageName: string): Promise<void> {
    try {
      const { stdout } = await execAsync(`npm list ${packageName}`);
      if (stdout.includes(packageName)) {
        return; // Already installed
      }
    } catch {
      // Package not found, proceed with installation
    }

    await execAsync(`npm install ${packageName}`);
  }
}