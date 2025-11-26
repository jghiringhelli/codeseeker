/**
 * Compilation Service
 * SOLID Principles: Single Responsibility - Handle compilation checks only
 */

import { Logger } from '../../../utils/logger';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  ICompilationService,
  CompilationResult,
  SubTaskResult
} from '../interfaces/index';

export class CompilationService implements ICompilationService {
  private logger = Logger.getInstance();

  constructor(private projectRoot: string) {}

  async runCompilationChecks(subTaskResults: SubTaskResult[]): Promise<CompilationResult> {
    this.logger.debug('Running compilation checks...');

    const startTime = Date.now();

    try {
      // Check if TypeScript project
      const tsconfigPath = path.join(this.projectRoot, 'tsconfig.json');
      const hasTypeScript = await fs.access(tsconfigPath).then(() => true).catch(() => false);

      if (hasTypeScript) {
        return await this.runTypeScriptCompilation();
      } else {
        // For JavaScript projects, run basic syntax checks
        return await this.runJavaScriptSyntaxCheck(subTaskResults);
      }

    } catch (error) {
      return {
        success: false,
        errors: [`Compilation check failed: ${(error as Error).message}`],
        warnings: [],
        duration: Date.now() - startTime
      };
    }
  }

  async runTypeScriptCompilation(): Promise<CompilationResult> {
    return new Promise((resolve) => {
      const tscProcess = spawn('npx', ['tsc', '--noEmit'], {
        cwd: this.projectRoot,
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';

      tscProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      tscProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const startTime = Date.now();

      tscProcess.on('close', (code) => {
        const duration = Date.now() - startTime;
        const errors = this.parseTypeScriptErrors(stderr);
        const warnings = this.parseTypeScriptWarnings(stderr);

        resolve({
          success: code === 0,
          errors,
          warnings,
          duration
        });
      });

      tscProcess.on('error', (error) => {
        resolve({
          success: false,
          errors: [`TypeScript compilation failed: ${error.message}`],
          warnings: [],
          duration: Date.now() - startTime
        });
      });
    });
  }

  async runJavaScriptSyntaxCheck(subTaskResults: SubTaskResult[]): Promise<CompilationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const startTime = Date.now();

    // Basic syntax validation for modified files
    for (const result of subTaskResults) {
      for (const filePath of result.filesModified) {
        if (filePath.endsWith('.js') || filePath.endsWith('.ts')) {
          try {
            const content = await fs.readFile(path.join(this.projectRoot, filePath), 'utf-8');
            // Basic syntax check - try to parse with Node
            new Function(content);
          } catch (syntaxError) {
            errors.push(`${filePath}: ${(syntaxError as Error).message}`);
          }
        }
      }
    }

    return {
      success: errors.length === 0,
      errors,
      warnings,
      duration: Date.now() - startTime
    };
  }

  private parseTypeScriptErrors(stderr: string): string[] {
    const errors: string[] = [];

    // Parse TypeScript compiler output
    const lines = stderr.split('\n');
    for (const line of lines) {
      if (line.includes('error TS')) {
        // Extract error message
        const match = line.match(/^(.+)\(\d+,\d+\): error (.+): (.+)$/);
        if (match) {
          errors.push(`${match[1]}: ${match[3]}`);
        } else {
          // Fallback for other error formats
          errors.push(line.trim());
        }
      }
    }

    return errors;
  }

  private parseTypeScriptWarnings(stderr: string): string[] {
    const warnings: string[] = [];

    // Parse TypeScript compiler output for warnings
    const lines = stderr.split('\n');
    for (const line of lines) {
      if (line.includes('warning TS')) {
        // Extract warning message
        const match = line.match(/^(.+)\(\d+,\d+\): warning (.+): (.+)$/);
        if (match) {
          warnings.push(`${match[1]}: ${match[3]}`);
        } else {
          // Fallback for other warning formats
          warnings.push(line.trim());
        }
      }
    }

    return warnings;
  }
}