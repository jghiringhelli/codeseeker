/**
 * Test Runner Service
 * Single responsibility: Execute tests and analyze coverage
 */

import { Logger } from '../../utils/logger';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import { TestResult } from './interfaces';

export class TestRunner {
  private logger = Logger.getInstance();

  constructor(private projectRoot: string) {}

  async runTests(): Promise<TestResult> {
    this.logger.debug('Starting test execution');

    try {
      const startTime = Date.now();
      const testResult = await this.executeTests();
      const coverageResult = await this.analyzeCoverage();
      const duration = Date.now() - startTime;

      return {
        passed: testResult.passed,
        failed: testResult.failed,
        coverage: coverageResult.overall,
        duration,
        failedTests: testResult.failedTests,
        coverageFiles: coverageResult.files
      };
    } catch (error) {
      this.logger.error('Test execution failed', error as Error);
      return {
        passed: 0,
        failed: 1,
        coverage: 0,
        duration: 0,
        failedTests: ['Test execution failed'],
        coverageFiles: []
      };
    }
  }

  private async executeTests(): Promise<{
    passed: number;
    failed: number;
    failedTests: string[];
  }> {
    return new Promise((resolve, reject) => {
      let passed = 0;
      let failed = 0;
      const failedTests: string[] = [];

      const testProcess = spawn('npm', ['test'], {
        cwd: this.projectRoot,
        stdio: 'pipe'
      });

      testProcess.stdout.on('data', (data) => {
        const output = data.toString();

        // Parse test output (Jest format)
        const passMatches = output.match(/(\d+) passing/);
        const failMatches = output.match(/(\d+) failing/);

        if (passMatches) passed += parseInt(passMatches[1]);
        if (failMatches) failed += parseInt(failMatches[1]);

        // Extract failed test names
        const failedTestRegex = /\s+\d+\)\s+(.+)/g;
        let match;
        while ((match = failedTestRegex.exec(output)) !== null) {
          failedTests.push(match[1]);
        }
      });

      testProcess.stderr.on('data', (data) => {
        this.logger.warn('Test stderr:', data.toString());
      });

      testProcess.on('close', (code) => {
        resolve({ passed, failed, failedTests });
      });

      testProcess.on('error', (error) => {
        reject(error);
      });
    });
  }

  private async analyzeCoverage(): Promise<{
    overall: number;
    files: Array<{ file: string; coverage: number }>;
  }> {
    try {
      const coveragePath = path.join(this.projectRoot, 'coverage', 'coverage-summary.json');

      if (await this.fileExists(coveragePath)) {
        const coverageData = JSON.parse(await fs.readFile(coveragePath, 'utf8'));

        const files = Object.entries(coverageData)
          .filter(([key]) => key !== 'total')
          .map(([file, data]: [string, any]) => ({
            file,
            coverage: data.lines?.pct || 0
          }));

        return {
          overall: coverageData.total?.lines?.pct || 0,
          files
        };
      }
    } catch (error) {
      this.logger.warn('Could not analyze coverage', error as Error);
    }

    return { overall: 0, files: [] };
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}