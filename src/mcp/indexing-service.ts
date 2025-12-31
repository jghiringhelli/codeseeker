/**
 * Indexing Service for MCP Server
 *
 * Provides reusable indexing logic for:
 * - File indexing with chunking and embeddings
 * - Knowledge graph building
 * - Incremental updates
 *
 * This service reuses the same indexing logic as the CLI init command.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { glob } from 'fast-glob';
import { getStorageManager } from '../storage';
import { EmbeddingService } from '../cli/services/data/embedding/embedding-service';
import { Logger } from '../utils/logger';
import type { IVectorStore, IGraphStore, GraphNode, GraphEdge } from '../storage/interfaces';
import { CSharpParser } from '../cli/services/data/semantic-graph/parsers/csharp-parser';
import { GoParser } from '../cli/services/data/semantic-graph/parsers/go-parser';
import { PythonParser } from '../cli/services/data/semantic-graph/parsers/python-parser';
import { JavaParser } from '../cli/services/data/semantic-graph/parsers/java-parser';
import type { ParsedCodeStructure } from '../cli/services/data/semantic-graph/parsers/ilanguage-parser';

export interface IndexingProgress {
  phase: 'scanning' | 'indexing' | 'graph' | 'complete';
  filesTotal: number;
  filesProcessed: number;
  chunksCreated: number;
  nodesCreated: number;
  edgesCreated: number;
  /** Warning message when file limits are reached */
  limitWarning?: string;
  /** Current scanning status (during scan phase) */
  scanningStatus?: {
    foldersScanned: number;
    filesFound: number;
    currentFolder?: string;
    percentage: number;
  };
}

export interface IndexingResult {
  success: boolean;
  filesIndexed: number;
  chunksCreated: number;
  nodesCreated: number;
  edgesCreated: number;
  durationMs: number;
  errors: string[];
  /** Warning messages about limits or recommendations */
  warnings: string[];
}

export class IndexingService {
  private logger = Logger.getInstance();
  private embeddingService: EmbeddingService;

  // Language-specific parsers for proper AST extraction
  private readonly parsers = {
    csharp: new CSharpParser(),
    go: new GoParser(),
    python: new PythonParser(),
    java: new JavaParser()
  };

  // Map file extensions to parser types
  private readonly extensionToParser: Record<string, keyof typeof this.parsers> = {
    '.cs': 'csharp',
    '.go': 'go',
    '.py': 'python',
    '.java': 'java'
  };

  // Supported file extensions for indexing
  private readonly SUPPORTED_EXTENSIONS = [
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.py', '.java', '.go', '.rs', '.rb', '.php',
    '.c', '.cpp', '.h', '.hpp', '.cs',
    '.json', '.yaml', '.yml', '.toml',
    '.md', '.txt', '.rst',
  ];

  // Directories to ignore (must match file-scanner-config.json)
  private readonly IGNORE_DIRS = [
    // Package managers / dependencies
    'node_modules', 'vendor', 'packages', 'venv', 'virtualenv', '.venv',
    // Version control
    '.git', '.svn', '.hg',
    // Build outputs
    'dist', 'build', 'out', 'target', 'bin', 'obj',
    // Caches
    '.cache', 'tmp', 'temp', '__pycache__', '.pytest_cache', '.tox',
    // Test outputs
    'coverage', '.nyc_output', 'TestReports',
    // IDE / Editor
    '.idea', '.vscode', '.vs',
    // Framework-specific
    '.next', '.nuxt',
    // Unity (critical - Library alone can have 35K+ files)
    'Library', 'Temp', 'Logs', 'UserSettings', 'MemoryCaptures', 'Recordings', 'PackageCache',
    // Other game engines / platforms
    'Exec', 'DerivedData', 'Intermediate', 'Saved', 'Binaries'
  ];

  constructor() {
    this.embeddingService = new EmbeddingService({
      provider: 'xenova',
      model: 'Xenova/all-MiniLM-L6-v2'
    });
  }

  /**
   * Index a project directory
   * Creates vector embeddings and knowledge graph nodes/edges
   */
  async indexProject(
    projectPath: string,
    projectId: string,
    onProgress?: (progress: IndexingProgress) => void
  ): Promise<IndexingResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    const progress: IndexingProgress = {
      phase: 'scanning',
      filesTotal: 0,
      filesProcessed: 0,
      chunksCreated: 0,
      nodesCreated: 0,
      edgesCreated: 0
    };

    try {
      // Get storage manager
      const storageManager = await getStorageManager();
      const vectorStore = storageManager.getVectorStore();
      const graphStore = storageManager.getGraphStore();

      // Phase 1: Scan for files with progress reporting
      progress.phase = 'scanning';
      progress.scanningStatus = { foldersScanned: 0, filesFound: 0, percentage: 0 };
      onProgress?.(progress);

      const files = await this.scanForFiles(projectPath, (scanStatus) => {
        progress.scanningStatus = scanStatus;
        onProgress?.(progress);
      });

      // Check file limits and generate warnings
      const totalFiles = files.length;
      progress.filesTotal = Math.min(totalFiles, this.FILE_LIMITS.maxFiles);

      if (totalFiles > this.FILE_LIMITS.dbServerThreshold) {
        progress.limitWarning = `⚠️ Large project detected: ${totalFiles.toLocaleString()} files found. ` +
          `For projects with 100K+ files, we recommend using DB server mode (PostgreSQL + Neo4j) for optimal performance. ` +
          `Run 'codemind config --storage=server' to switch. Currently indexing first ${this.FILE_LIMITS.maxFiles.toLocaleString()} files.`;
      } else if (totalFiles > this.FILE_LIMITS.maxFiles) {
        progress.limitWarning = `ℹ️ Project has ${totalFiles.toLocaleString()} files. ` +
          `Indexing first ${this.FILE_LIMITS.maxFiles.toLocaleString()} files. ` +
          `To increase limits, edit .codemind/config.json or use DB server mode for very large projects.`;
      }

      onProgress?.(progress);

      if (files.length === 0) {
        return {
          success: true,
          filesIndexed: 0,
          chunksCreated: 0,
          nodesCreated: 0,
          edgesCreated: 0,
          durationMs: Date.now() - startTime,
          errors: ['No indexable files found'],
          warnings: []
        };
      }

      // Phase 2: Index files with embeddings
      progress.phase = 'indexing';
      onProgress?.(progress);

      // Apply file limit
      const filesToIndex = files.slice(0, this.FILE_LIMITS.maxFiles);

      for (const file of filesToIndex) {
        try {
          const chunksCreated = await this.indexFile(
            path.join(projectPath, file),
            file,
            projectId,
            vectorStore
          );
          progress.filesProcessed++;
          progress.chunksCreated += chunksCreated;
          onProgress?.(progress);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(`Failed to index ${file}: ${message}`);
          this.logger.debug(`Failed to index ${file}: ${message}`);
        }
      }

      // Phase 3: Build knowledge graph
      progress.phase = 'graph';
      onProgress?.(progress);

      const graphResult = await this.buildKnowledgeGraph(
        projectPath,
        projectId,
        files,
        graphStore
      );
      progress.nodesCreated = graphResult.nodesCreated;
      progress.edgesCreated = graphResult.edgesCreated;
      onProgress?.(progress);

      // Flush to persist
      await vectorStore.flush();
      await graphStore.flush();

      // Phase 4: Complete
      progress.phase = 'complete';
      onProgress?.(progress);

      // Collect any warnings
      const warnings: string[] = [];
      if (progress.limitWarning) {
        warnings.push(progress.limitWarning);
      }

      return {
        success: true,
        filesIndexed: progress.filesProcessed,
        chunksCreated: progress.chunksCreated,
        nodesCreated: progress.nodesCreated,
        edgesCreated: progress.edgesCreated,
        durationMs: Date.now() - startTime,
        errors,
        warnings
      };

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Indexing failed: ${message}`);
      return {
        success: false,
        filesIndexed: progress.filesProcessed,
        chunksCreated: progress.chunksCreated,
        nodesCreated: progress.nodesCreated,
        edgesCreated: progress.edgesCreated,
        durationMs: Date.now() - startTime,
        errors,
        warnings: progress.limitWarning ? [progress.limitWarning] : []
      };
    }
  }

  /**
   * Index a single file (for incremental updates)
   */
  async indexSingleFile(
    projectPath: string,
    relativePath: string,
    projectId: string
  ): Promise<{ success: boolean; chunksCreated: number; nodesCreated?: number }> {
    try {
      const storageManager = await getStorageManager();
      const vectorStore = storageManager.getVectorStore();
      const graphStore = storageManager.getGraphStore();

      const absolutePath = path.join(projectPath, relativePath);

      // Delete existing embeddings for this file
      await this.deleteFileEmbeddings(projectId, relativePath, vectorStore);

      // Re-index the file for vector search
      const chunksCreated = await this.indexFile(
        absolutePath,
        relativePath,
        projectId,
        vectorStore
      );

      // Also update the knowledge graph for this file
      const nodesCreated = await this.indexFileToGraph(
        projectPath,
        relativePath,
        projectId,
        graphStore
      );

      await vectorStore.flush();
      await graphStore.flush();

      return { success: true, chunksCreated, nodesCreated };
    } catch (error) {
      this.logger.debug(`Failed to index ${relativePath}: ${error}`);
      return { success: false, chunksCreated: 0 };
    }
  }

  /**
   * Index a single file to the knowledge graph
   */
  private async indexFileToGraph(
    projectPath: string,
    relativePath: string,
    projectId: string,
    graphStore: IGraphStore
  ): Promise<number> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    try {
      const absolutePath = path.join(projectPath, relativePath);
      const content = fs.readFileSync(absolutePath, 'utf-8');

      // Create file node
      const fileNodeId = `file-${projectId}-${relativePath.replace(/[\/\\]/g, '-')}`;
      nodes.push({
        id: fileNodeId,
        type: 'file',
        name: path.basename(relativePath),
        filePath: absolutePath,
        projectId,
        properties: { relativePath }
      });

      // Link file to project root
      const projectNodeId = `project-${projectId}`;
      edges.push({
        id: `contains-${projectNodeId}-${fileNodeId}`,
        source: projectNodeId,
        target: fileNodeId,
        type: 'contains'
      });

      // Extract code elements using language-specific parser
      const codeElements = await this.extractCodeElementsAsync(content, relativePath, projectId);

      for (const element of codeElements) {
        nodes.push({
          id: element.id,
          type: element.type,
          name: element.name,
          filePath: absolutePath,
          projectId,
          properties: { relativePath, lineNumber: element.line }
        });

        // Link element to file
        edges.push({
          id: `contains-${fileNodeId}-${element.id}`,
          source: fileNodeId,
          target: element.id,
          type: 'contains'
        });
      }

      // Extract import relationships (scan all project files for context)
      const allFiles = await this.scanForFiles(projectPath);
      const imports = this.extractImports(content, relativePath, projectId, allFiles);
      edges.push(...imports);

      // Upsert nodes and edges
      if (nodes.length > 0) {
        await graphStore.upsertNodes(nodes);
      }
      if (edges.length > 0) {
        await graphStore.upsertEdges(edges);
      }

      return nodes.length;
    } catch (error) {
      this.logger.debug(`Failed to index ${relativePath} to graph: ${error}`);
      return 0;
    }
  }

  /**
   * Delete a file from the index
   */
  async deleteFile(
    projectId: string,
    relativePath: string
  ): Promise<{ success: boolean; deleted: number }> {
    try {
      const storageManager = await getStorageManager();
      const vectorStore = storageManager.getVectorStore();
      const graphStore = storageManager.getGraphStore();

      // Delete vector embeddings
      const vectorsDeleted = await this.deleteFileEmbeddings(projectId, relativePath, vectorStore);

      // Delete graph nodes for this file
      const nodesDeleted = await this.deleteFileGraphNodes(projectId, relativePath, graphStore);

      await vectorStore.flush();
      await graphStore.flush();

      return { success: true, deleted: vectorsDeleted + nodesDeleted };
    } catch (error) {
      this.logger.debug(`Failed to delete ${relativePath}: ${error}`);
      return { success: false, deleted: 0 };
    }
  }

  // File limits configuration
  private readonly FILE_LIMITS = {
    /** Maximum files to index (embedded mode). Increase for DB server mode. */
    maxFiles: 50000,
    /** Threshold to suggest DB server mode */
    dbServerThreshold: 100000,
    /** Files for knowledge graph: source folders */
    graphSourceFiles: 30000,
    /** Files for knowledge graph: other code */
    graphOtherCode: 15000,
    /** Files for knowledge graph: config/docs */
    graphConfigFiles: 5000
  };

  /**
   * Load user-defined exclusions from .codemind/exclusions.json
   */
  private loadUserExclusions(projectPath: string): string[] {
    const exclusionsPath = path.join(projectPath, '.codemind', 'exclusions.json');

    if (!fs.existsSync(exclusionsPath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(exclusionsPath, 'utf-8');
      const exclusions = JSON.parse(content);

      if (exclusions.patterns && Array.isArray(exclusions.patterns)) {
        return exclusions.patterns.map((p: { pattern: string }) => p.pattern);
      }
    } catch (error) {
      this.logger.debug(`Failed to load user exclusions: ${error}`);
    }

    return [];
  }

  /**
   * Check if a file matches any user exclusion pattern
   */
  private matchesUserExclusion(filePath: string, exclusionPatterns: string[]): boolean {
    if (exclusionPatterns.length === 0) {
      return false;
    }

    const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();

    for (const pattern of exclusionPatterns) {
      const normalizedPattern = pattern.replace(/\\/g, '/').toLowerCase();

      // Direct match
      if (normalizedPath === normalizedPattern) {
        return true;
      }

      // Convert glob pattern to regex
      let regexPattern = normalizedPattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '<<GLOBSTAR>>')
        .replace(/\*/g, '[^/]*')
        .replace(/<<GLOBSTAR>>/g, '.*')
        .replace(/\?/g, '.');

      // Pattern matching at start or after /
      if (!regexPattern.startsWith('.*')) {
        regexPattern = `(^|/)${regexPattern}`;
      }

      regexPattern = `${regexPattern}(/.*)?$`;

      try {
        const regex = new RegExp(regexPattern);
        if (regex.test(normalizedPath)) {
          return true;
        }
      } catch {
        // Fallback to simple includes check
        if (normalizedPath.includes(normalizedPattern.replace(/\*/g, ''))) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Scan for indexable files in a directory
   * Reports progress during scanning via callback
   * Respects user-defined exclusions from .codemind/exclusions.json
   */
  private async scanForFiles(
    projectPath: string,
    onProgress?: (status: { foldersScanned: number; filesFound: number; currentFolder?: string; percentage: number }) => void
  ): Promise<string[]> {
    const patterns = this.SUPPORTED_EXTENSIONS.map(ext => `**/*${ext}`);

    // Build comprehensive ignore patterns:
    // - `dir/**` matches top-level directory
    // - `**/dir/**` matches nested directories
    const ignorePatterns = this.IGNORE_DIRS.flatMap(dir => [
      `${dir}/**`,      // Top-level: Library/**, Temp/**, etc.
      `**/${dir}/**`    // Nested: foo/Library/**, src/Temp/**, etc.
    ]);

    // Load user-defined exclusions
    const userExclusions = this.loadUserExclusions(projectPath);

    // Track unique folders for progress reporting
    const foldersScanned = new Set<string>();
    let filesFound = 0;

    const files = await glob(patterns, {
      cwd: projectPath,
      ignore: ignorePatterns,
      onlyFiles: true,
      followSymbolicLinks: false
    });

    // Double-check: filter out any files that slipped through
    // (glob patterns can sometimes miss edge cases)
    const excludedDirSet = new Set(this.IGNORE_DIRS.map(d => d.toLowerCase()));
    let filteredFiles = files.filter(file => {
      const pathParts = file.replace(/\\/g, '/').toLowerCase().split('/');
      return !pathParts.some(part => excludedDirSet.has(part));
    });

    // Apply user-defined exclusions
    if (userExclusions.length > 0) {
      const beforeCount = filteredFiles.length;
      filteredFiles = filteredFiles.filter(file => !this.matchesUserExclusion(file, userExclusions));
      const excludedCount = beforeCount - filteredFiles.length;

      if (excludedCount > 0) {
        this.logger.debug(`User exclusions filtered out ${excludedCount} files`);
      }
    }

    // Report progress by analyzing discovered files
    if (onProgress) {
      for (const file of filteredFiles) {
        const folder = path.dirname(file);
        if (!foldersScanned.has(folder)) {
          foldersScanned.add(folder);
          // Report progress every 10 new folders
          if (foldersScanned.size % 10 === 0) {
            onProgress({
              foldersScanned: foldersScanned.size,
              filesFound: filesFound,
              currentFolder: folder,
              percentage: 100 // Scanning complete, just counting
            });
          }
        }
        filesFound++;
      }

      // Final progress report
      onProgress({
        foldersScanned: foldersScanned.size,
        filesFound: filteredFiles.length,
        percentage: 100
      });
    }

    return filteredFiles;
  }

  /**
   * Index a single file with chunking and embeddings
   */
  private async indexFile(
    absolutePath: string,
    relativePath: string,
    projectId: string,
    vectorStore: IVectorStore
  ): Promise<number> {
    const content = fs.readFileSync(absolutePath, 'utf-8');

    // Skip very small files
    if (content.length < 50) {
      return 0;
    }

    // Chunk the file content
    const chunks = this.chunkContent(content);

    // Generate embeddings for each chunk
    const fileHash = crypto.createHash('md5').update(content).digest('hex');
    let chunksCreated = 0;

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];

      try {
        // Generate embedding vector
        const embeddingVector = await this.embeddingService.generateEmbedding(
          chunk.content,
          relativePath
        );

        // Create document ID: projectId:filePath:chunkIndex
        const docId = `${projectId}:${relativePath}:${chunkIndex}`;

        await vectorStore.upsert({
          id: docId,
          projectId,
          filePath: relativePath,
          content: chunk.content,
          embedding: embeddingVector,
          metadata: {
            fileName: path.basename(relativePath),
            extension: path.extname(relativePath),
            chunkIndex,
            lineStart: chunk.lineStart,
            lineEnd: chunk.lineEnd,
            fileHash,
            indexedAt: new Date().toISOString()
          }
        });

        chunksCreated++;
      } catch (error) {
        this.logger.debug(`Failed to create embedding for chunk ${chunkIndex} of ${relativePath}: ${error}`);
      }
    }

    return chunksCreated;
  }

  /**
   * Chunk file content into smaller pieces for better search granularity
   */
  private chunkContent(content: string): Array<{ content: string; lineStart: number; lineEnd: number }> {
    const lines = content.split('\n');
    const chunks: Array<{ content: string; lineStart: number; lineEnd: number }> = [];

    const CHUNK_SIZE = 25; // lines per chunk
    const OVERLAP = 5; // overlapping lines for context

    for (let i = 0; i < lines.length; i += (CHUNK_SIZE - OVERLAP)) {
      const chunkLines = lines.slice(i, i + CHUNK_SIZE);
      const chunkContent = chunkLines.join('\n');

      // Only include chunks with meaningful content
      if (chunkContent.trim().length > 30) {
        chunks.push({
          content: chunkContent,
          lineStart: i + 1,
          lineEnd: Math.min(i + CHUNK_SIZE, lines.length)
        });
      }
    }

    return chunks;
  }

  /**
   * Build knowledge graph for the project
   */
  private async buildKnowledgeGraph(
    projectPath: string,
    projectId: string,
    files: string[],
    graphStore: IGraphStore
  ): Promise<{ nodesCreated: number; edgesCreated: number }> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Create project root node
    const projectNodeId = `project-${projectId}`;
    nodes.push({
      id: projectNodeId,
      type: 'file',
      name: path.basename(projectPath),
      filePath: projectPath,
      projectId,
      properties: { isProjectRoot: true }
    });

    // Limit files for performance (prioritize source code folders)
    // Support multiple common source folder patterns: src/, Assets/Scripts/ (Unity), app/, lib/
    const sourcePatterns = ['src/', 'src\\', 'Assets/Scripts/', 'Assets\\Scripts\\', 'app/', 'app\\', 'lib/', 'lib\\'];
    const sourceFiles = files.filter(f => sourcePatterns.some(p => f.startsWith(p)));
    const otherCodeFiles = files.filter(f =>
      !sourcePatterns.some(p => f.startsWith(p)) &&
      ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.cs', '.rs', '.rb', '.php', '.c', '.cpp'].some(ext => f.endsWith(ext))
    );
    const configFiles = files.filter(f =>
      !sourcePatterns.some(p => f.startsWith(p)) &&
      ['.json', '.yaml', '.yml', '.toml', '.md'].some(ext => f.endsWith(ext))
    );
    // Prioritize: source folders > other code > config
    // Use configurable limits for large project support
    const totalGraphLimit = this.FILE_LIMITS.graphSourceFiles + this.FILE_LIMITS.graphOtherCode + this.FILE_LIMITS.graphConfigFiles;
    const filesToProcess = [
      ...sourceFiles.slice(0, this.FILE_LIMITS.graphSourceFiles),
      ...otherCodeFiles.slice(0, this.FILE_LIMITS.graphOtherCode),
      ...configFiles.slice(0, this.FILE_LIMITS.graphConfigFiles)
    ].slice(0, totalGraphLimit);

    for (const file of filesToProcess) {
      try {
        const absolutePath = path.join(projectPath, file);
        const content = fs.readFileSync(absolutePath, 'utf-8');

        // Create file node
        const fileNodeId = `file-${projectId}-${file.replace(/[\/\\]/g, '-')}`;
        nodes.push({
          id: fileNodeId,
          type: 'file',
          name: path.basename(file),
          filePath: absolutePath,
          projectId,
          properties: { relativePath: file }
        });

        // Link file to project
        edges.push({
          id: `contains-${projectNodeId}-${fileNodeId}`,
          source: projectNodeId,
          target: fileNodeId,
          type: 'contains'
        });

        // Extract code elements using language-specific parser
        const codeElements = await this.extractCodeElementsAsync(content, file, projectId);

        for (const element of codeElements) {
          nodes.push({
            id: element.id,
            type: element.type,
            name: element.name,
            filePath: absolutePath,
            projectId,
            properties: { relativePath: file, lineNumber: element.line }
          });

          // Link element to file
          edges.push({
            id: `contains-${fileNodeId}-${element.id}`,
            source: fileNodeId,
            target: element.id,
            type: 'contains'
          });
        }

        // Extract import relationships
        const imports = this.extractImports(content, file, projectId, filesToProcess);
        edges.push(...imports);

      } catch (error) {
        this.logger.debug(`Failed to process graph for ${file}: ${error}`);
      }
    }

    // Batch insert nodes and edges
    if (nodes.length > 0) {
      await graphStore.upsertNodes(nodes);
    }
    if (edges.length > 0) {
      await graphStore.upsertEdges(edges);
    }

    return {
      nodesCreated: nodes.length,
      edgesCreated: edges.length
    };
  }

  /**
   * Extract code elements (classes, functions) from file content
   * Uses language-specific parsers for C#, Go, Python, Java
   * Falls back to generic regex for JS/TS
   */
  private async extractCodeElementsAsync(
    content: string,
    file: string,
    projectId: string
  ): Promise<Array<{ id: string; type: 'class' | 'function'; name: string; line: number }>> {
    const elements: Array<{ id: string; type: 'class' | 'function'; name: string; line: number }> = [];
    const ext = path.extname(file).toLowerCase();
    const parserType = this.extensionToParser[ext];

    // Use language-specific parser if available
    if (parserType && this.parsers[parserType]) {
      try {
        const parser = this.parsers[parserType];
        const absolutePath = file; // Will be resolved by caller
        const parsed: ParsedCodeStructure = await parser.parse(content, absolutePath);

        // Extract classes
        for (const cls of parsed.classes) {
          elements.push({
            id: `class-${projectId}-${file.replace(/[\/\\]/g, '-')}-${cls.name}`,
            type: 'class',
            name: cls.name,
            line: 1 // Line info not available from parser, could be enhanced
          });

          // Extract methods from classes (limit to 20 per class)
          for (const method of cls.methods.slice(0, 20)) {
            elements.push({
              id: `function-${projectId}-${file.replace(/[\/\\]/g, '-')}-${cls.name}-${method}`,
              type: 'function',
              name: `${cls.name}.${method}`,
              line: 1
            });
          }
        }

        // Extract standalone functions
        for (const func of parsed.functions.slice(0, 30)) {
          elements.push({
            id: `function-${projectId}-${file.replace(/[\/\\]/g, '-')}-${func.name}`,
            type: 'function',
            name: func.name,
            line: 1
          });
        }

        // Extract interfaces (as class-like elements)
        for (const iface of parsed.interfaces) {
          elements.push({
            id: `class-${projectId}-${file.replace(/[\/\\]/g, '-')}-${iface}`,
            type: 'class',
            name: iface,
            line: 1
          });
        }

        return elements;
      } catch (error) {
        this.logger.debug(`Parser failed for ${file}, falling back to regex: ${error}`);
      }
    }

    // Fallback: generic regex parsing for JS/TS and unsupported languages
    return this.extractCodeElementsRegex(content, file, projectId);
  }

  /**
   * Regex-based extraction for JS/TS and fallback
   * Also handles C# with specialized regex patterns
   */
  private extractCodeElementsRegex(
    content: string,
    file: string,
    projectId: string
  ): Array<{ id: string; type: 'class' | 'function'; name: string; line: number }> {
    const elements: Array<{ id: string; type: 'class' | 'function'; name: string; line: number }> = [];
    const lines = content.split('\n');
    const ext = path.extname(file).toLowerCase();

    // Use C#-aware regex for .cs files
    if (ext === '.cs') {
      const classRegex = /(?:public\s+|private\s+|protected\s+|internal\s+)?(?:abstract\s+|sealed\s+|static\s+|partial\s+)*(?:class|struct|interface)\s+(\w+)/g;
      const methodRegex = /(?:public\s+|private\s+|protected\s+|internal\s+)?(?:virtual\s+|override\s+|abstract\s+|static\s+|async\s+)*(?:[\w<>\[\],\s]+)\s+(\w+)\s*\([^)]*\)\s*[{;]/g;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let match;

        classRegex.lastIndex = 0;
        while ((match = classRegex.exec(line)) !== null) {
          const className = match[1];
          if (className && className.length > 1) {
            elements.push({
              id: `class-${projectId}-${file.replace(/[\/\\]/g, '-')}-${className}`,
              type: 'class',
              name: className,
              line: i + 1
            });
          }
        }

        // Limit methods per file
        if (elements.filter(e => e.type === 'function').length < 50) {
          methodRegex.lastIndex = 0;
          while ((match = methodRegex.exec(line)) !== null) {
            const methodName = match[1];
            if (methodName && methodName.length > 1 &&
                !['if', 'for', 'while', 'switch', 'foreach', 'catch', 'using', 'lock', 'get', 'set'].includes(methodName)) {
              elements.push({
                id: `function-${projectId}-${file.replace(/[\/\\]/g, '-')}-${methodName}`,
                type: 'function',
                name: methodName,
                line: i + 1
              });
            }
          }
        }
      }
    } else {
      // Generic JS/TS regex
      const classRegex = /class\s+(\w+)/g;
      const functionRegex = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=]*?)\s*=>|(\w+)\s*\([^)]*\)\s*{)/g;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let match;

        classRegex.lastIndex = 0;
        while ((match = classRegex.exec(line)) !== null) {
          const className = match[1];
          if (className && className.length > 1) {
            elements.push({
              id: `class-${projectId}-${file.replace(/[\/\\]/g, '-')}-${className}`,
              type: 'class',
              name: className,
              line: i + 1
            });
          }
        }

        // Limit functions per file
        if (elements.filter(e => e.type === 'function').length < 30) {
          functionRegex.lastIndex = 0;
          while ((match = functionRegex.exec(line)) !== null) {
            const funcName = match[1] || match[2] || match[3];
            if (funcName && funcName.length > 2 && !['if', 'for', 'while', 'switch'].includes(funcName)) {
              elements.push({
                id: `function-${projectId}-${file.replace(/[\/\\]/g, '-')}-${funcName}`,
                type: 'function',
                name: funcName,
                line: i + 1
              });
            }
          }
        }
      }
    }

    return elements;
  }

  /**
   * Extract import relationships from file content
   * Supports: JS/TS imports, require(), C# using statements
   */
  private extractImports(
    content: string,
    sourceFile: string,
    projectId: string,
    allFiles: string[]
  ): GraphEdge[] {
    const edges: GraphEdge[] = [];
    const sourceFileNodeId = `file-${projectId}-${sourceFile.replace(/[\/\\]/g, '-')}`;
    const ext = path.extname(sourceFile).toLowerCase();

    let match: RegExpExecArray | null;

    // C# using statements - link to files in same namespace
    if (ext === '.cs') {
      const usingRegex = /using\s+([\w.]+);/g;
      const namespaceMap = this.buildNamespaceMap(allFiles, projectId);

      while ((match = usingRegex.exec(content)) !== null) {
        const namespace = match[1];
        // Skip System namespaces
        if (namespace.startsWith('System') || namespace.startsWith('UnityEngine') || namespace.startsWith('UnityEditor')) {
          continue;
        }

        // Find files in this namespace
        const filesInNamespace = namespaceMap.get(namespace) || [];
        for (const targetFile of filesInNamespace) {
          if (targetFile !== sourceFile) {
            const targetFileNodeId = `file-${projectId}-${targetFile.replace(/[\/\\]/g, '-')}`;
            edges.push({
              id: `imports-${sourceFileNodeId}-${targetFileNodeId}`,
              source: sourceFileNodeId,
              target: targetFileNodeId,
              type: 'imports'
            });
          }
        }
      }
    } else {
      // JS/TS imports and require()
      const importRegex = /import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
      const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

      const processImport = (importPath: string) => {
        // Skip node_modules imports
        if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
          return;
        }

        // Resolve relative path
        const sourceDir = path.dirname(sourceFile);
        let resolvedPath = path.join(sourceDir, importPath).replace(/\\/g, '/');

        // Add extension if missing
        if (!path.extname(resolvedPath)) {
          const extensions = ['.ts', '.tsx', '.js', '.jsx'];
          for (const ext of extensions) {
            const withExt = resolvedPath + ext;
            if (allFiles.includes(withExt)) {
              resolvedPath = withExt;
              break;
            }
          }
        }

        // Check if target file exists in project
        if (allFiles.includes(resolvedPath)) {
          const targetFileNodeId = `file-${projectId}-${resolvedPath.replace(/[\/\\]/g, '-')}`;
          edges.push({
            id: `imports-${sourceFileNodeId}-${targetFileNodeId}`,
            source: sourceFileNodeId,
            target: targetFileNodeId,
            type: 'imports'
          });
        }
      };

      while ((match = importRegex.exec(content)) !== null) {
        processImport(match[1]);
      }

      while ((match = requireRegex.exec(content)) !== null) {
        processImport(match[1]);
      }
    }

    return edges;
  }

  /**
   * Build a map of namespace -> files for C# projects
   * This is cached per indexing run for performance
   */
  private namespaceMapCache: Map<string, string[]> | null = null;

  private buildNamespaceMap(allFiles: string[], _projectId: string): Map<string, string[]> {
    // Return cached map if available (reset between indexing runs)
    if (this.namespaceMapCache) {
      return this.namespaceMapCache;
    }

    const namespaceMap = new Map<string, string[]>();
    const csFiles = allFiles.filter(f => f.endsWith('.cs'));

    // For performance, only scan first 200 C# files for namespace detection
    for (const file of csFiles.slice(0, 200)) {
      try {
        // Infer namespace from file path (common Unity/C# convention)
        // Assets/Scripts/UI/MenuScreen.cs -> Project.UI
        const pathParts = file.replace(/\\/g, '/').split('/');
        const scriptsIndex = pathParts.findIndex(p => p.toLowerCase() === 'scripts');

        if (scriptsIndex >= 0 && pathParts.length > scriptsIndex + 1) {
          // Build namespace from path after Scripts/
          const namespaceParts = pathParts.slice(scriptsIndex + 1, -1); // Exclude filename
          if (namespaceParts.length > 0) {
            const namespace = namespaceParts.join('.');
            const existing = namespaceMap.get(namespace) || [];
            existing.push(file);
            namespaceMap.set(namespace, existing);
          }
        }
      } catch {
        // Skip files that can't be processed
      }
    }

    this.namespaceMapCache = namespaceMap;
    return namespaceMap;
  }

  /**
   * Delete embeddings for a specific file
   */
  private async deleteFileEmbeddings(
    projectId: string,
    relativePath: string,
    vectorStore: IVectorStore
  ): Promise<number> {
    // Search for documents with this file path and delete them
    // The document IDs are formatted as: projectId:filePath:chunkIndex
    const results = await vectorStore.searchByText(relativePath, projectId, 100);

    let deleted = 0;
    for (const result of results) {
      if (result.document.filePath === relativePath) {
        await vectorStore.delete(result.document.id);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Delete graph nodes for a specific file
   */
  private async deleteFileGraphNodes(
    projectId: string,
    relativePath: string,
    graphStore: IGraphStore
  ): Promise<number> {
    // Note: IGraphStore doesn't support individual node/edge deletion
    // Graph nodes for deleted files will be cleaned up on next full reindex
    // This is a limitation of the current storage abstraction
    const fileNodeId = `file-${projectId}-${relativePath.replace(/[\/\\]/g, '-')}`;

    try {
      // Check if the node exists (for logging purposes)
      const node = await graphStore.getNode(fileNodeId);
      if (node) {
        this.logger.debug(
          `Graph node for ${relativePath} exists but individual deletion not supported. ` +
          `Will be cleaned up on next full reindex.`
        );
        // Count edges for informational purposes
        const edges = await graphStore.getEdges(fileNodeId, 'both');
        return 1 + edges.length; // Return count of what would be deleted
      }
    } catch (error) {
      this.logger.debug(`Failed to check graph nodes for ${relativePath}: ${error}`);
    }

    return 0;
  }
}