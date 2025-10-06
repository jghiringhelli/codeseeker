/**
 * Project Structure Analyzer - Single Responsibility: Analyzing project structure
 */

export class ProjectStructureAnalyzer {
  async analyze(projectPath: string): Promise<string> {
    try {
      const { glob } = await import('fast-glob');

      const files = await glob('**/*', {
        cwd: projectPath,
        ignore: ['node_modules/**', '.git/**', 'dist/**', '*.log'],
        onlyFiles: false,
        markDirectories: true
      });

      const structure = {
        directories: files.filter(f => f.endsWith('/')).slice(0, 20),
        sourceFiles: files.filter(f => /\.(ts|js|tsx|jsx)$/.test(f)).slice(0, 50),
        configFiles: files.filter(f => /\.(json|yml|yaml|toml|ini)$/.test(f)).slice(0, 10),
        totalFiles: files.length
      };

      return `PROJECT STRUCTURE:
Directories (${structure.directories.length}): ${structure.directories.join(', ')}
Source Files (${structure.sourceFiles.length}): ${structure.sourceFiles.join(', ')}
Config Files (${structure.configFiles.length}): ${structure.configFiles.join(', ')}
Total Files: ${structure.totalFiles}`;

    } catch (error) {
      return `Error analyzing project structure: ${error.message}`;
    }
  }
}