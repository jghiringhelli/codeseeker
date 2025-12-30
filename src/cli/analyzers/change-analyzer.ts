/**
 * Change Analyzer - Single Responsibility: Analyzing recent changes via git
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ChangeAnalyzer {
  async getRecentChanges(projectPath: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync('git log --oneline -10', { cwd: projectPath });
      return `RECENT GIT CHANGES:\n${stdout}`;
    } catch (error) {
      return null;
    }
  }
}