/**
 * Project Detection Service - Single Responsibility
 * Handles project type detection and configuration reading
 */

import * as path from 'path';
import * as fs from 'fs';
import { IProjectDetector, ProjectConfig } from '../../../core/interfaces/project-interfaces';

export class ProjectDetector implements IProjectDetector {
  async detectProjectType(projectPath: string): Promise<string> {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const cargoTomlPath = path.join(projectPath, 'Cargo.toml');
    const pomXmlPath = path.join(projectPath, 'pom.xml');
    const requirementsPath = path.join(projectPath, 'requirements.txt');
    const pipfilePath = path.join(projectPath, 'Pipfile');

    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

      // Detect specific Node.js project types
      if (packageJson.dependencies?.['express'] || packageJson.dependencies?.['fastify']) {
        return 'api_service';
      }
      if (packageJson.dependencies?.['react'] || packageJson.dependencies?.['vue'] || packageJson.dependencies?.['angular']) {
        return 'frontend_app';
      }
      if (packageJson.dependencies?.['electron']) {
        return 'desktop_app';
      }

      return 'nodejs_project';
    }

    if (fs.existsSync(cargoTomlPath)) {
      return 'rust_project';
    }

    if (fs.existsSync(pomXmlPath)) {
      return 'java_project';
    }

    if (fs.existsSync(requirementsPath) || fs.existsSync(pipfilePath)) {
      return 'python_project';
    }

    // Default fallback
    return 'general_project';
  }

  async getProjectConfig(projectPath: string): Promise<ProjectConfig | null> {
    const configPath = path.join(projectPath, '.codeseeker', 'project.json');

    if (!fs.existsSync(configPath)) {
      return null;
    }

    try {
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData) as ProjectConfig;
    } catch (error) {
      console.warn(`Failed to read project config: ${error.message}`);
      return null;
    }
  }
}