/**
 * File Processor Service
 * SOLID Principles: Single Responsibility - Handle file processing for embeddings
 */

import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { Logger } from '../../../../../utils/logger';
import { IFileProcessor, IEmbeddingProvider, FileEmbedding, EmbeddingConfig } from '../interfaces';

export class FileProcessor implements IFileProcessor {
  private logger = Logger.getInstance();

  constructor(
    private config: EmbeddingConfig,
    private embeddingProvider: IEmbeddingProvider
  ) {}

  async processFiles(projectPath: string, files: string[]): Promise<FileEmbedding[]> {
    this.logger.info(`🔮 Processing ${files.length} files for embeddings`);

    const embeddings: FileEmbedding[] = [];
    const batchSize = this.config.batchSize;

    // Process files in batches
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      this.logger.info(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(files.length / batchSize)}`);

      const batchPromises = batch.map(async (filePath) => {
        try {
          return await this.generateFileEmbedding(filePath, projectPath);
        } catch (error) {
          this.logger.error(`Failed to process ${filePath}:`, error);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      embeddings.push(...batchResults.filter(result => result !== null));

      // Small delay between batches to prevent overwhelming the system
      if (i + batchSize < files.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    this.logger.info(`✅ Successfully processed ${embeddings.length}/${files.length} files`);
    return embeddings;
  }

  async generateFileEmbedding(filePath: string, projectPath: string): Promise<FileEmbedding> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const hash = crypto.createHash('md5').update(content).digest('hex');

      // Extract metadata
      const metadata = this.extractFileMetadata(content, filePath);

      // Generate embedding based on provider
      const embedding = await this.embeddingProvider.generateEmbedding(content, filePath);

      return {
        filePath: filePath.replace(projectPath, '').replace(/\\/g, '/'),
        content: content.substring(0, this.config.maxTokens),
        hash,
        embedding,
        metadata
      };
    } catch (error) {
      throw new Error(`Failed to generate embedding for ${filePath}: ${error}`);
    }
  }

  private extractFileMetadata(content: string, filePath: string): any {
    const lines = content.split('\n');
    const size = content.length;
    const language = this.getLanguageFromPath(filePath);

    // Basic extraction - more sophisticated parsing would be in a separate service
    const functions = this.extractFunctions(content, language);
    const classes = this.extractClasses(content, language);
    const imports = this.extractImports(content, language);
    const exports = this.extractExports(content, language);

    return {
      language,
      size,
      lines: lines.length,
      functions,
      classes,
      imports,
      exports
    };
  }

  private getLanguageFromPath(filePath: string): string {
    const ext = filePath.toLowerCase().split('.').pop() || '';

    switch (ext) {
      case 'ts': case 'tsx': return 'typescript';
      case 'js': case 'jsx': return 'javascript';
      case 'py': return 'python';
      case 'java': return 'java';
      case 'cpp': case 'cc': case 'cxx': return 'cpp';
      case 'c': return 'c';
      case 'cs': return 'csharp';
      case 'go': return 'go';
      case 'rs': return 'rust';
      case 'php': return 'php';
      case 'rb': return 'ruby';
      default: return 'unknown';
    }
  }

  private extractFunctions(content: string, language: string): string[] {
    const functions: string[] = [];

    try {
      switch (language) {
        case 'typescript':
        case 'javascript':
          // Extract function declarations and expressions
          const funcRegex = /(?:function\s+(\w+)|(\w+)\s*[:=]\s*(?:async\s+)?function|(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{)/g;
          let match;
          while ((match = funcRegex.exec(content)) !== null) {
            const funcName = match[1] || match[2] || match[3];
            if (funcName && !functions.includes(funcName)) {
              functions.push(funcName);
            }
          }
          break;

        case 'python':
          // Extract Python function definitions
          const pyFuncRegex = /def\s+(\w+)\s*\(/g;
          while ((match = pyFuncRegex.exec(content)) !== null) {
            if (!functions.includes(match[1])) {
              functions.push(match[1]);
            }
          }
          break;

        case 'java':
          // Extract Java method declarations
          const javaMethodRegex = /(?:public|private|protected)?\s*(?:static\s+)?(?:\w+\s+)*(\w+)\s*\([^)]*\)\s*(?:throws\s+\w+(?:\s*,\s*\w+)*)?\s*\{/g;
          while ((match = javaMethodRegex.exec(content)) !== null) {
            if (!functions.includes(match[1])) {
              functions.push(match[1]);
            }
          }
          break;
      }
    } catch (error) {
      this.logger.debug(`Failed to extract functions from ${language} file:`, error);
    }

    return functions;
  }

  private extractClasses(content: string, language: string): string[] {
    const classes: string[] = [];

    try {
      switch (language) {
        case 'typescript':
        case 'javascript':
          const tsClassRegex = /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/g;
          let match;
          while ((match = tsClassRegex.exec(content)) !== null) {
            if (!classes.includes(match[1])) {
              classes.push(match[1]);
            }
          }
          break;

        case 'python':
          const pyClassRegex = /class\s+(\w+)/g;
          while ((match = pyClassRegex.exec(content)) !== null) {
            if (!classes.includes(match[1])) {
              classes.push(match[1]);
            }
          }
          break;

        case 'java':
          const javaClassRegex = /(?:public\s+)?(?:abstract\s+)?class\s+(\w+)/g;
          while ((match = javaClassRegex.exec(content)) !== null) {
            if (!classes.includes(match[1])) {
              classes.push(match[1]);
            }
          }
          break;
      }
    } catch (error) {
      this.logger.debug(`Failed to extract classes from ${language} file:`, error);
    }

    return classes;
  }

  private extractImports(content: string, language: string): string[] {
    const imports: string[] = [];

    try {
      switch (language) {
        case 'typescript':
        case 'javascript':
          const tsImportRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
          let match;
          while ((match = tsImportRegex.exec(content)) !== null) {
            if (!imports.includes(match[1])) {
              imports.push(match[1]);
            }
          }
          break;

        case 'python':
          const pyImportRegex = /(?:from\s+(\w+(?:\.\w+)*)|import\s+(\w+(?:\.\w+)*))/g;
          while ((match = pyImportRegex.exec(content)) !== null) {
            const importName = match[1] || match[2];
            if (importName && !imports.includes(importName)) {
              imports.push(importName);
            }
          }
          break;

        case 'java':
          const javaImportRegex = /import\s+([^;]+);/g;
          while ((match = javaImportRegex.exec(content)) !== null) {
            if (!imports.includes(match[1])) {
              imports.push(match[1]);
            }
          }
          break;
      }
    } catch (error) {
      this.logger.debug(`Failed to extract imports from ${language} file:`, error);
    }

    return imports;
  }

  private extractExports(content: string, language: string): string[] {
    const exports: string[] = [];

    try {
      switch (language) {
        case 'typescript':
        case 'javascript':
          const exportRegex = /export\s+(?:(?:default\s+)?(?:class|function|interface|enum|const|let|var)\s+(\w+)|(?:\{([^}]+)\})|default\s+(\w+))/g;
          let match;
          while ((match = exportRegex.exec(content)) !== null) {
            if (match[1]) {
              // Named export (class, function, etc.)
              exports.push(match[1]);
            } else if (match[2]) {
              // Destructured exports
              const namedExports = match[2].split(',').map(e => e.trim());
              exports.push(...namedExports);
            } else if (match[3]) {
              // Default export
              exports.push(match[3]);
            }
          }
          break;

        case 'python':
          // Python doesn't have explicit exports, but we can track __all__
          const pyAllRegex = /__all__\s*=\s*\[([^\]]+)\]/;
          const allMatch = content.match(pyAllRegex);
          if (allMatch) {
            const items = allMatch[1].split(',').map(item =>
              item.trim().replace(/['"]/g, '')
            );
            exports.push(...items);
          }
          break;

        case 'java':
          // Java uses public classes as exports
          const javaPublicRegex = /public\s+(?:class|interface|enum)\s+(\w+)/g;
          while ((match = javaPublicRegex.exec(content)) !== null) {
            if (!exports.includes(match[1])) {
              exports.push(match[1]);
            }
          }
          break;
      }
    } catch (error) {
      this.logger.debug(`Failed to extract exports from ${language} file:`, error);
    }

    return exports;
  }
}