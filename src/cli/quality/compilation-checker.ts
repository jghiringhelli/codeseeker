/**
 * Compilation Checker Service
 * Single responsibility: Check TypeScript compilation
 */

import { Logger } from '../../utils/logger';
import { spawn } from 'child_process';
import { CompilationResult } from './interfaces';

export class CompilationChecker {
  private logger = Logger.getInstance();

  constructor(private projectRoot: string) {}

  async checkCompilation(): Promise<CompilationResult> {
    this.logger.debug('Starting TypeScript compilation check');

    try {
      const startTime = Date.now();
      const result = await this.runTypeScriptCompiler();
      const duration = Date.now() - startTime;

      return {
        success: result.errors.length === 0,
        errors: result.errors,
        warnings: result.warnings,
        duration
      };
    } catch (error) {
      this.logger.error('Compilation check failed', error as Error);
      return {
        success: false,
        errors: [`Compilation failed: ${error instanceof Error ? error.message : error}`],
        warnings: [],
        duration: 0
      };
    }
  }

  private async runTypeScriptCompiler(): Promise<{ errors: string[]; warnings: string[] }> {
    return new Promise((resolve, reject) => {
      const errors: string[] = [];
      const warnings: string[] = [];

      const tscProcess = spawn('npx', ['tsc', '--noEmit'], {
        cwd: this.projectRoot,
        stdio: 'pipe'
      });

      tscProcess.stdout.on('data', (data) => {
        const output = data.toString();
        // Parse TypeScript compiler output
        const lines = output.split('\n').filter(line => line.trim());

        for (const line of lines) {
          if (line.includes('error TS')) {
            errors.push(line);
          } else if (line.includes('warning') || line.includes('note')) {
            warnings.push(line);
          }
        }
      });

      tscProcess.stderr.on('data', (data) => {
        errors.push(data.toString());
      });

      tscProcess.on('close', (code) => {
        if (code === 0 || errors.length === 0) {
          resolve({ errors, warnings });
        } else {
          resolve({ errors, warnings }); // Still resolve to handle gracefully
        }
      });

      tscProcess.on('error', (error) => {
        reject(error);
      });
    });
  }
}