/**
 * Prerequisite Checker Service
 * Single Responsibility: Validate project and environment prerequisites
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { IPrerequisiteChecker, SetupResult } from './interfaces/setup-interfaces';

export class PrerequisiteChecker implements IPrerequisiteChecker {

  async checkProject(projectPath?: string): Promise<SetupResult> {
    try {
      const targetPath = projectPath || process.cwd();
      const packageJsonPath = path.join(targetPath, 'package.json');

      // Check if package.json exists
      try {
        const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
        const pkg = JSON.parse(packageContent);

        if (pkg.name !== 'codemind-enhanced-cli') {
          return {
            success: false,
            message: 'Not a CodeMind project directory',
            errors: [`Expected package name 'codemind-enhanced-cli', found '${pkg.name}'`]
          };
        }

        // Change directory if needed
        if (projectPath && process.cwd() !== projectPath) {
          process.chdir(projectPath);
        }

        return {
          success: true,
          message: 'Valid CodeMind project detected',
          data: { projectPath: targetPath, packageInfo: pkg }
        };

      } catch (fileError) {
        return {
          success: false,
          message: 'package.json not found or invalid',
          errors: [
            `Could not read package.json at ${packageJsonPath}`,
            'Make sure you are in the CodeMind project directory'
          ]
        };
      }

    } catch (error) {
      return {
        success: false,
        message: 'Project validation failed',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  checkNodeVersion(): SetupResult {
    try {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

      if (majorVersion < 16) {
        return {
          success: false,
          message: 'Node.js version too old',
          errors: [
            `Current version: ${nodeVersion}`,
            'Minimum required: Node.js 16.x',
            'Please upgrade Node.js for best compatibility'
          ]
        };
      }

      return {
        success: true,
        message: `Node.js ${nodeVersion} is compatible`,
        data: { version: nodeVersion, majorVersion }
      };

    } catch (error) {
      return {
        success: false,
        message: 'Could not determine Node.js version',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }
}