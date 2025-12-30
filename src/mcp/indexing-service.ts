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

export interface IndexingProgress {
  phase: 'scanning' | 'indexing' | 'graph' | 'complete';
  filesTotal: number;
  filesProcessed: number;
  chunksCreated: number;
  nodesCreated: number;
  edgesCreated: number;
}

export interface IndexingResult {
  success: boolean;
  filesIndexed: number;
  chunksCreated: number;
  nodesCreated: number;
  edgesCreated: number;
  durationMs: number;
  errors: string[];
}

export class IndexingService {
  private logger = Logger.getInstance();
  private embeddingService: EmbeddingService;

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

      // Phase 1: Scan for files
      progress.phase = 'scanning';
      onProgress?.(progress);

      const files = await this.scanForFiles(projectPath);
      progress.filesTotal = files.length;
      onProgress?.(progress);

      if (files.length === 0) {
        return {
          success: true,
          filesIndexed: 0,
          chunksCreated: 0,
          nodesCreated: 0,
          edgesCreated: 0,
          durationMs: Date.now() - startTime,
          errors: ['No indexable files found']
        };
      }

      // Phase 2: Index files with embeddings
      progress.phase = 'indexing';
      onProgress?.(progress);

      for (const file of files) {
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

      return {
        success: true,
        filesIndexed: progress.filesProcessed,
        chunksCreated: progress.chunksCreated,
        nodesCreated: progress.nodesCreated,
        edgesCreated: progress.edgesCreated,
        durationMs: Date.now() - startTime,
        errors
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
        errors
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

      // Extract code elements (classes, functions)
      const codeElements = this.extractCodeElements(content, relativePath, projectId);

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

  /**
   * Scan for indexable files in a directory
   */
  private async scanForFiles(projectPath: string): Promise<string[]> {
    const patterns = this.SUPPORTED_EXTENSIONS.map(ext => `**/*${ext}`);
    const ignorePatterns = this.IGNORE_DIRS.map(dir => `**/${dir}/**`);

    const files = await glob(patterns, {
      cwd: projectPath,
      ignore: ignorePatterns,
      onlyFiles: true,
      followSymbolicLinks: false
    });

    return files;
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

    // Limit files for performance (prioritize src/ files)
    const srcFiles = files.filter(f => f.startsWith('src/') || f.startsWith('src\\'));
    const otherFiles = files.filter(f => !f.startsWith('src/') && !f.startsWith('src\\'));
    const filesToProcess = [...srcFiles.slice(0, 100), ...otherFiles.slice(0, 50)].slice(0, 150);

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

        // Extract code elements
        const codeElements = this.extractCodeElements(content, file, projectId);

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
   */
  private extractCodeElements(
    content: string,
    file: string,
    projectId: string
  ): Array<{ id: string; type: 'class' | 'function'; name: string; line: number }> {
    const elements: Array<{ id: string; type: 'class' | 'function'; name: string; line: number }> = [];
    const lines = content.split('\n');

    const classRegex = /class\s+(\w+)/g;
    const functionRegex = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=]*?)\s*=>|(\w+)\s*\([^)]*\)\s*{)/g;

    // Find classes
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
      if (elements.filter(e => e.type === 'function').length < 10) {
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

    return elements;
  }

  /**
   * Extract import relationships from file content
   */
  private extractImports(
    content: string,
    sourceFile: string,
    projectId: string,
    allFiles: string[]
  ): GraphEdge[] {
    const edges: GraphEdge[] = [];
    const sourceFileNodeId = `file-${projectId}-${sourceFile.replace(/[\/\\]/g, '-')}`;

    // Match import statements
    const importRegex = /import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    let match;

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

    return edges;
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