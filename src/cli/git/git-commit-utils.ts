/**
 * Git Commit Utilities
 * Extracted commit message generation and compilation checking utilities
 */

import { promisify } from 'util';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ChangeSignificance as DetailedChangeSignificance } from './change-detector';

const execAsync = promisify(exec);

export class GitCommitUtils {
  static generateCommitMessage(significance: DetailedChangeSignificance): string {
    const categories = significance.categories;
    const primaryCategory = categories?.length > 0 ? categories[0] : null;

    let baseMessage = '';

    if (primaryCategory) {
      switch (primaryCategory.type) {
        case 'feature':
          baseMessage = 'feat: ';
          break;
        case 'bugfix':
          baseMessage = 'fix: ';
          break;
        case 'refactor':
          baseMessage = 'refactor: ';
          break;
        case 'test':
          baseMessage = 'test: ';
          break;
        case 'config':
          baseMessage = 'chore: ';
          break;
        case 'docs':
          baseMessage = 'docs: ';
          break;
        default:
          baseMessage = 'update: ';
      }
    } else {
      baseMessage = 'update: ';
    }

    // Generate description based on changes
    const descriptions: string[] = [];

    if (significance.newFeatures?.length > 0) {
      descriptions.push(`add ${significance.newFeatures.slice(0, 2).join(', ')}`);
    }

    if (significance.bugFixes?.length > 0) {
      descriptions.push(`fix ${significance.bugFixes.slice(0, 2).join(', ')}`);
    }

    if (significance.testChanges?.length > 0) {
      descriptions.push(`update ${significance.testChanges.length} tests`);
    }

    if (significance.configChanges?.length > 0) {
      descriptions.push(`modify ${significance.configChanges.slice(0, 2).join(', ')}`);
    }

    if (descriptions.length === 0) {
      descriptions.push(`${significance.filesChanged} files, +${significance.linesAdded}/-${significance.linesDeleted}`);
    }

    const message = baseMessage + descriptions.join(', ');

    // Add context about significance and impact areas
    const details: string[] = [];
    if (significance.riskLevel === 'high') {
      details.push('High-risk changes');
    }
    if (significance.impactAreas?.length > 0) {
      details.push(`Affects: ${significance.impactAreas.slice(0, 3).join(', ')}`);
    }

    return details.length > 0 ? `${message}\n\n${details.join(', ')}` : message;
  }

  static async compilesSuccessfully(projectPath: string): Promise<boolean> {
    try {
      // Check for TypeScript project
      const tsConfigExists = await fs.access(path.join(projectPath, 'tsconfig.json'))
        .then(() => true)
        .catch(() => false);

      if (tsConfigExists) {
        const { stdout, stderr } = await execAsync('npm run build', { cwd: projectPath });
        return !stderr || !stderr.includes('error');
      }

      // Check for package.json scripts
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJsonExists = await fs.access(packageJsonPath)
        .then(() => true)
        .catch(() => false);

      if (packageJsonExists) {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

        // Try common build scripts
        const buildScripts = ['build', 'compile', 'dist'];
        for (const script of buildScripts) {
          if (packageJson.scripts && packageJson.scripts[script]) {
            try {
              await execAsync(`npm run ${script}`, {
                cwd: projectPath,
                timeout: 30000 // 30 second timeout
              });
              return true;
            } catch {
              return false;
            }
          }
        }

        // Try compiling TypeScript directly if no build script
        if (tsConfigExists) {
          try {
            await execAsync('npx tsc --noEmit', { cwd: projectPath, timeout: 30000 });
            return true;
          } catch {
            return false;
          }
        }
      }

      // Check for other project types
      const projectFiles = [
        'Cargo.toml',    // Rust
        'pom.xml',       // Java Maven
        'build.gradle',  // Java Gradle
        'Makefile',      // C/C++
        'go.mod'         // Go
      ];

      for (const file of projectFiles) {
        const exists = await fs.access(path.join(projectPath, file))
          .then(() => true)
          .catch(() => false);

        if (exists) {
          return await this.tryProjectSpecificBuild(projectPath, file);
        }
      }

      // If no build system detected, assume compilation is successful
      return true;

    } catch (error) {
      return false;
    }
  }

  private static async tryProjectSpecificBuild(projectPath: string, projectFile: string): Promise<boolean> {
    try {
      switch (projectFile) {
        case 'Cargo.toml':
          await execAsync('cargo check', { cwd: projectPath, timeout: 30000 });
          return true;

        case 'pom.xml':
          await execAsync('mvn compile', { cwd: projectPath, timeout: 60000 });
          return true;

        case 'build.gradle':
          await execAsync('./gradlew compileJava', { cwd: projectPath, timeout: 60000 });
          return true;

        case 'Makefile':
          await execAsync('make -n', { cwd: projectPath, timeout: 30000 });
          return true;

        case 'go.mod':
          await execAsync('go build', { cwd: projectPath, timeout: 30000 });
          return true;

        default:
          return true;
      }
    } catch {
      return false;
    }
  }

  static async isGitRepository(projectPath: string): Promise<boolean> {
    try {
      await execAsync('git status', { cwd: projectPath });
      return true;
    } catch {
      return false;
    }
  }
}