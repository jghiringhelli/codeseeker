/**
 * Documentation Analyzer - Single Responsibility: Analyzing project documentation
 */

import * as fs from 'fs';
import * as path from 'path';

export class DocumentationAnalyzer {
  async analyze(projectPath: string): Promise<string | null> {
    const docFiles = ['README.md', 'README.txt', 'DOCS.md', 'docs/README.md'];

    for (const docFile of docFiles) {
      try {
        const docPath = path.join(projectPath, docFile);
        const content = await fs.promises.readFile(docPath, 'utf-8');
        return `DOCUMENTATION (${docFile}):\n${content.slice(0, 2000)}`;
      } catch (error) {
        continue;
      }
    }

    return null;
  }
}