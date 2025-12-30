/**
 * Configuration Analyzer - Single Responsibility: Analyzing project configurations
 */

import * as fs from 'fs';
import * as path from 'path';

export class ConfigurationAnalyzer {
  async analyze(projectPath: string): Promise<string> {
    const configs = [];

    const configFiles = [
      'package.json', 'tsconfig.json', '.eslintrc.json', '.eslintrc.js',
      'webpack.config.js', 'vite.config.ts', 'next.config.js', 'tailwind.config.js'
    ];

    for (const configFile of configFiles) {
      try {
        const configPath = path.join(projectPath, configFile);
        if (await fs.promises.access(configPath).then(() => true).catch(() => false)) {
          const content = await fs.promises.readFile(configPath, 'utf-8');
          configs.push(`--- ${configFile} ---\n${content.slice(0, 500)}`);
        }
      } catch (error) {
        // Skip files we can't read
      }
    }

    return configs.length > 0
      ? `KEY CONFIGURATIONS:\n${configs.join('\n\n')}`
      : 'No key configuration files found';
  }
}