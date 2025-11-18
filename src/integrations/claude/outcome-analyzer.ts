/**
 * Claude Code Outcome Analyzer
 * Analyzes the outcome of Claude Code execution to determine intelligent database updates
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { cliLogger } from '../../utils/colored-logger';
import CLILogger from '../../utils/cli-logger';

const execAsync = promisify(exec);
const cliLoggerInstance = CLILogger.getInstance();

export interface ClaudeCodeOutcome {
  filesModified: string[];
  classesChanged: string[];
  newClasses: string[];
  functionsChanged: string[];
  newFunctions: string[];
  importsModified: string[];
  success: boolean;
  errorMessages?: string[];
  warnings?: string[];
}

export interface FileAnalysis {
  path: string;
  wasModified: boolean;
  classChanges: {
    added: string[];
    modified: string[];
    removed: string[];
  };
  functionChanges: {
    added: string[];
    modified: string[];
    removed: string[];
  };
  importChanges: {
    added: string[];
    removed: string[];
  };
  needsRehashing: boolean;
}

export class ClaudeCodeOutcomeAnalyzer {
  private static instance: ClaudeCodeOutcomeAnalyzer;
  private beforeSnapshot: Map<string, string> = new Map();
  private afterSnapshot: Map<string, string> = new Map();

  static getInstance(): ClaudeCodeOutcomeAnalyzer {
    if (!ClaudeCodeOutcomeAnalyzer.instance) {
      ClaudeCodeOutcomeAnalyzer.instance = new ClaudeCodeOutcomeAnalyzer();
    }
    return ClaudeCodeOutcomeAnalyzer.instance;
  }

  /**
   * Take a snapshot before Claude Code execution
   */
  async takeBeforeSnapshot(projectPath: string): Promise<void> {
    cliLoggerInstance.info('Taking before-execution snapshot...');
    
    try {
      const files = await this.getAllRelevantFiles(projectPath);
      
      for (const filePath of files) {
        try {
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const relativePath = path.relative(projectPath, filePath);
          this.beforeSnapshot.set(relativePath, content);
        } catch (error) {
          // File might not exist or be readable, skip
          continue;
        }
      }
      
      cliLogger.info('SNAPSHOT', 'Before-execution snapshot captured', {
        filesTracked: this.beforeSnapshot.size
      });
      
    } catch (error) {
      cliLogger.error('SNAPSHOT', 'Failed to take before snapshot', { error: error.message });
    }
  }

  /**
   * Take a snapshot after Claude Code execution and analyze differences
   */
  async takeAfterSnapshotAndAnalyze(projectPath: string): Promise<ClaudeCodeOutcome> {
    cliLoggerInstance.info('Taking after-execution snapshot and analyzing changes...');
    
    try {
      const files = await this.getAllRelevantFiles(projectPath);
      const outcome: ClaudeCodeOutcome = {
        filesModified: [],
        classesChanged: [],
        newClasses: [],
        functionsChanged: [],
        newFunctions: [],
        importsModified: [],
        success: true,
        errorMessages: [],
        warnings: []
      };

      // Take after snapshot
      for (const filePath of files) {
        try {
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const relativePath = path.relative(projectPath, filePath);
          this.afterSnapshot.set(relativePath, content);
        } catch (error) {
          continue;
        }
      }

      // Analyze differences
      const modifiedFiles: FileAnalysis[] = [];
      
      // Check for modifications in existing files
      for (const [relativePath, afterContent] of this.afterSnapshot) {
        const beforeContent = this.beforeSnapshot.get(relativePath);
        
        if (beforeContent !== afterContent) {
          const analysis = await this.analyzeFileChanges(
            relativePath, 
            beforeContent || '', 
            afterContent
          );
          
          if (analysis.wasModified) {
            modifiedFiles.push(analysis);
            outcome.filesModified.push(analysis.path);
          }
        }
      }

      // Check for new files
      for (const [relativePath, afterContent] of this.afterSnapshot) {
        if (!this.beforeSnapshot.has(relativePath)) {
          const analysis = await this.analyzeFileChanges(relativePath, '', afterContent);
          modifiedFiles.push(analysis);
          outcome.filesModified.push(analysis.path);
        }
      }

      // Aggregate changes
      for (const file of modifiedFiles) {
        outcome.classesChanged.push(...file.classChanges.modified);
        outcome.newClasses.push(...file.classChanges.added);
        outcome.functionsChanged.push(...file.functionChanges.modified);
        outcome.newFunctions.push(...file.functionChanges.added);
        outcome.importsModified.push(...file.importChanges.added, ...file.importChanges.removed);
      }

      // Check for compilation errors
      const compilationCheck = await this.checkCompilationStatus(projectPath);
      if (!compilationCheck.success) {
        outcome.success = false;
        outcome.errorMessages = compilationCheck.errors;
      }

      cliLogger.info('OUTCOME', 'Claude Code outcome analysis completed', {
        filesModified: outcome.filesModified.length,
        classesChanged: outcome.classesChanged.length,
        newClasses: outcome.newClasses.length,
        functionsChanged: outcome.functionsChanged.length,
        success: outcome.success
      });

      return outcome;

    } catch (error) {
      cliLogger.error('OUTCOME', 'Failed to analyze Claude Code outcome', { error: error.message });
      
      return {
        filesModified: [],
        classesChanged: [],
        newClasses: [],
        functionsChanged: [],
        newFunctions: [],
        importsModified: [],
        success: false,
        errorMessages: [error.message]
      };
    }
  }

  /**
   * Analyze changes in a specific file
   */
  private async analyzeFileChanges(
    filePath: string, 
    beforeContent: string, 
    afterContent: string
  ): Promise<FileAnalysis> {
    const analysis: FileAnalysis = {
      path: filePath,
      wasModified: beforeContent !== afterContent,
      classChanges: { added: [], modified: [], removed: [] },
      functionChanges: { added: [], modified: [], removed: [] },
      importChanges: { added: [], removed: [] },
      needsRehashing: false
    };

    if (!analysis.wasModified) {
      return analysis;
    }

    try {
      // Extract classes and functions using regex patterns
      const beforeClasses = this.extractClasses(beforeContent);
      const afterClasses = this.extractClasses(afterContent);
      const beforeFunctions = this.extractFunctions(beforeContent);
      const afterFunctions = this.extractFunctions(afterContent);
      const beforeImports = this.extractImports(beforeContent);
      const afterImports = this.extractImports(afterContent);

      // Analyze class changes
      analysis.classChanges.added = afterClasses.filter(cls => !beforeClasses.includes(cls));
      analysis.classChanges.removed = beforeClasses.filter(cls => !afterClasses.includes(cls));
      analysis.classChanges.modified = afterClasses.filter(cls => 
        beforeClasses.includes(cls) && 
        this.getClassContent(beforeContent, cls) !== this.getClassContent(afterContent, cls)
      );

      // Analyze function changes
      analysis.functionChanges.added = afterFunctions.filter(fn => !beforeFunctions.includes(fn));
      analysis.functionChanges.removed = beforeFunctions.filter(fn => !afterFunctions.includes(fn));
      analysis.functionChanges.modified = afterFunctions.filter(fn =>
        beforeFunctions.includes(fn) &&
        this.getFunctionContent(beforeContent, fn) !== this.getFunctionContent(afterContent, fn)
      );

      // Analyze import changes
      analysis.importChanges.added = afterImports.filter(imp => !beforeImports.includes(imp));
      analysis.importChanges.removed = beforeImports.filter(imp => !afterImports.includes(imp));

      // Determine if rehashing is needed
      analysis.needsRehashing = 
        analysis.classChanges.added.length > 0 ||
        analysis.classChanges.modified.length > 0 ||
        analysis.functionChanges.added.length > 0 ||
        analysis.functionChanges.modified.length > 0;

    } catch (error) {
      cliLogger.warning('ANALYSIS', `Failed to analyze file ${filePath}`, { error: error.message });
    }

    return analysis;
  }

  /**
   * Extract class names from code content
   */
  private extractClasses(content: string): string[] {
    const classRegex = /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/g;
    const classes: string[] = [];
    let match;
    
    while ((match = classRegex.exec(content)) !== null) {
      classes.push(match[1]);
    }
    
    return classes;
  }

  /**
   * Extract function names from code content
   */
  private extractFunctions(content: string): string[] {
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)|(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*{/g;
    const functions: string[] = [];
    let match;
    
    while ((match = functionRegex.exec(content)) !== null) {
      functions.push(match[1] || match[2]);
    }
    
    return functions;
  }

  /**
   * Extract import statements from code content
   */
  private extractImports(content: string): string[] {
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    const imports: string[] = [];
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  }

  /**
   * Get class content for comparison
   */
  private getClassContent(content: string, className: string): string {
    const classRegex = new RegExp(`class\\s+${className}[^{]*{`, 'g');
    const match = classRegex.exec(content);
    
    if (!match) return '';
    
    const startIndex = match.index;
    let braceCount = 0;
    let endIndex = startIndex;
    
    for (let i = startIndex; i < content.length; i++) {
      if (content[i] === '{') braceCount++;
      if (content[i] === '}') braceCount--;
      if (braceCount === 0 && i > startIndex) {
        endIndex = i + 1;
        break;
      }
    }
    
    return content.substring(startIndex, endIndex);
  }

  /**
   * Get function content for comparison
   */
  private getFunctionContent(content: string, functionName: string): string {
    const functionRegex = new RegExp(`function\\s+${functionName}[^{]*{|${functionName}\\s*\\([^)]*\\)\\s*{`, 'g');
    const match = functionRegex.exec(content);
    
    if (!match) return '';
    
    const startIndex = match.index;
    let braceCount = 0;
    let endIndex = startIndex;
    
    for (let i = startIndex; i < content.length; i++) {
      if (content[i] === '{') braceCount++;
      if (content[i] === '}') braceCount--;
      if (braceCount === 0 && i > startIndex) {
        endIndex = i + 1;
        break;
      }
    }
    
    return content.substring(startIndex, endIndex);
  }

  /**
   * Get all relevant files for tracking
   */
  private async getAllRelevantFiles(projectPath: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`find "${projectPath}" -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" -o -name "*.py" -o -name "*.java" -o -name "*.cpp" -o -name "*.c" -o -name "*.h" | head -1000`);
      return stdout.trim().split('\n').filter(line => line.length > 0);
    } catch (error) {
      // Fallback for Windows or other systems
      return this.getFilesRecursively(projectPath, ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.h']);
    }
  }

  /**
   * Recursively get files with specific extensions
   */
  private async getFilesRecursively(dir: string, extensions: string[]): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const subFiles = await this.getFilesRecursively(fullPath, extensions);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Directory not accessible, skip
    }
    
    return files.slice(0, 1000); // Limit to prevent excessive processing
  }

  /**
   * Check compilation status after changes
   */
  private async checkCompilationStatus(projectPath: string): Promise<{ success: boolean; errors: string[] }> {
    try {
      // Check if there's a tsconfig.json or package.json with build script
      const tsconfigExists = await fs.promises.access(path.join(projectPath, 'tsconfig.json')).then(() => true).catch(() => false);
      const packageJsonExists = await fs.promises.access(path.join(projectPath, 'package.json')).then(() => true).catch(() => false);
      
      if (tsconfigExists) {
        // Try TypeScript compilation
        const { stderr } = await execAsync('npx tsc --noEmit', { 
          cwd: projectPath,
          timeout: 30000 
        });
        
        if (stderr) {
          return { success: false, errors: [stderr] };
        }
      } else if (packageJsonExists) {
        // Try npm run build if available
        try {
          const { stderr } = await execAsync('npm run build --if-present', { 
            cwd: projectPath,
            timeout: 30000
          });
          
          if (stderr && stderr.includes('error')) {
            return { success: false, errors: [stderr] };
          }
        } catch (buildError) {
          // Build script might not exist, that's ok
        }
      }
      
      return { success: true, errors: [] };
      
    } catch (error) {
      return { success: false, errors: [error.message] };
    }
  }

  /**
   * Clear snapshots to free memory
   */
  clearSnapshots(): void {
    this.beforeSnapshot.clear();
    this.afterSnapshot.clear();
    cliLogger.debug('SNAPSHOT', 'Snapshots cleared');
  }
}

export default ClaudeCodeOutcomeAnalyzer;