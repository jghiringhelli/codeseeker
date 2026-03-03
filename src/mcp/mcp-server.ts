/**
 * CodeSeeker MCP Server (Consolidated)
 *
 * Exposes CodeSeeker's semantic search and code analysis capabilities
 * as an MCP (Model Context Protocol) server for use with Claude Desktop
 * and Claude Code.
 *
 * OPTIMIZED: 12 tools consolidated to 3 to minimize token usage:
 *   1. search  - Code discovery (search, search+read, read-with-context)
 *   2. analyze - Code analysis (dependencies, dead_code, duplicates, standards)
 *   3. index   - Index management (init, sync, status, parsers, exclude)
 *
 * Usage:
 *   codeseeker serve --mcp
 *
 * Then add to claude_desktop_config.json:
 *   {
 *     "mcpServers": {
 *       "codeseeker": {
 *         "command": "codeseeker",
 *         "args": ["serve", "--mcp"]
 *       }
 *     }
 *   }
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

import { getStorageManager } from '../storage';
import { IVectorStore, VectorDocument } from '../storage/interfaces';
import { SemanticSearchOrchestrator } from '../cli/commands/services/semantic-search-orchestrator';
import { IndexingService } from './indexing-service';
import { CodingStandardsGenerator } from '../cli/services/analysis/coding-standards-generator';
import { LanguageSupportService } from '../cli/services/project/language-support-service';
import { getQueryCacheService, QueryCacheService } from './query-cache-service';
import { RaptorIndexingService } from '../cli/services/search/raptor-indexing-service';

// Version from package.json
const VERSION = '2.0.0';

/**
 * Background indexing job status
 */
interface IndexingJob {
  projectId: string;
  projectName: string;
  projectPath: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  progress?: {
    phase: string;
    filesProcessed: number;
    filesTotal: number;
    chunksCreated: number;
  };
  result?: {
    filesIndexed: number;
    chunksCreated: number;
    nodesCreated: number;
    edgesCreated: number;
    durationMs: number;
  };
  error?: string;
}

/**
 * MCP Server for CodeSeeker - Consolidated 3-tool architecture
 *
 * Tools:
 *   1. search  - Semantic code search with optional file reading
 *   2. analyze - Code analysis (dependencies, dead_code, duplicates, standards)
 *   3. index   - Index management (init, sync, status, parsers, exclude)
 */
export class CodeSeekerMcpServer {
  private server: McpServer;
  private searchOrchestrator: SemanticSearchOrchestrator;
  private indexingService: IndexingService;
  private languageSupportService: LanguageSupportService;
  private queryCache: QueryCacheService;

  // Background indexing state
  private indexingJobs: Map<string, IndexingJob> = new Map();
  private indexingMutex: Set<string> = new Set();
  private cancellationTokens: Map<string, { cancelled: boolean }> = new Map();

  // Job cleanup interval (clean completed/failed jobs after 1 hour)
  private readonly JOB_TTL_MS = 60 * 60 * 1000;
  private cleanupTimer: NodeJS.Timeout | null = null;

  // Dangerous paths that should never be indexed (security)
  private readonly DANGEROUS_PATHS = [
    '/etc', '/var', '/usr', '/bin', '/sbin', '/lib', '/boot', '/root', '/proc', '/sys', '/dev',
    'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)', 'C:\\ProgramData',
    '.ssh', '.gnupg', '.aws', '.azure', '.config',
  ];

  constructor() {
    this.server = new McpServer({
      name: 'codeseeker',
      version: VERSION,
    });

    this.searchOrchestrator = new SemanticSearchOrchestrator();
    this.indexingService = new IndexingService();
    this.languageSupportService = new LanguageSupportService();
    this.queryCache = getQueryCacheService();
    this.registerTools();
    this.startJobCleanupTimer();
  }

  // ============================================================
  // LIFECYCLE & UTILITY METHODS
  // ============================================================

  private startJobCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldJobs();
    }, 10 * 60 * 1000);
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  private cleanupOldJobs(): void {
    const now = Date.now();
    const jobsToDelete: string[] = [];
    for (const [projectId, job] of this.indexingJobs) {
      if (job.status !== 'running' && job.completedAt) {
        if (now - job.completedAt.getTime() > this.JOB_TTL_MS) {
          jobsToDelete.push(projectId);
        }
      }
    }
    for (const projectId of jobsToDelete) {
      this.indexingJobs.delete(projectId);
    }
  }

  private validateProjectPath(projectPath: string): string | null {
    const normalizedPath = path.normalize(projectPath);
    if (normalizedPath.includes('..')) {
      return 'Path traversal detected: paths with ".." are not allowed';
    }
    const lowerPath = normalizedPath.toLowerCase();
    for (const dangerous of this.DANGEROUS_PATHS) {
      const lowerDangerous = dangerous.toLowerCase();
      if (lowerPath === lowerDangerous || lowerPath.startsWith(lowerDangerous + path.sep)) {
        return `Security: cannot index system directory "${dangerous}"`;
      }
    }
    const pathParts = normalizedPath.split(path.sep);
    for (const part of pathParts) {
      const lowerPart = part.toLowerCase();
      if (lowerPart === '.ssh' || lowerPart === '.gnupg' || lowerPart === '.aws') {
        return `Security: cannot index sensitive directory "${part}"`;
      }
    }
    return null;
  }

  private startBackgroundIndexing(
    projectId: string,
    projectName: string,
    projectPath: string,
    clearExisting: boolean = true
  ): void {
    const cancellationToken = { cancelled: false };
    this.cancellationTokens.set(projectId, cancellationToken);
    const job: IndexingJob = {
      projectId,
      projectName,
      projectPath,
      status: 'running',
      startedAt: new Date(),
      progress: {
        phase: 'starting',
        filesProcessed: 0,
        filesTotal: 0,
        chunksCreated: 0,
      },
    };
    this.indexingJobs.set(projectId, job);
    this.indexingMutex.delete(projectId);
    this.runBackgroundIndexing(job, clearExisting, cancellationToken).catch((error) => {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : String(error);
      job.completedAt = new Date();
      this.cancellationTokens.delete(projectId);
    });
  }

  cancelIndexing(projectId: string): boolean {
    const token = this.cancellationTokens.get(projectId);
    if (token) {
      token.cancelled = true;
      return true;
    }
    return false;
  }

  private async runBackgroundIndexing(
    job: IndexingJob,
    clearExisting: boolean,
    cancellationToken: { cancelled: boolean }
  ): Promise<void> {
    try {
      const storageManager = await getStorageManager();
      const vectorStore = storageManager.getVectorStore();
      const graphStore = storageManager.getGraphStore();
      if (clearExisting) {
        await vectorStore.deleteByProject(job.projectId);
        await graphStore.deleteByProject(job.projectId);
      }
      if (cancellationToken.cancelled) {
        job.status = 'failed';
        job.error = 'Indexing cancelled by user';
        job.completedAt = new Date();
        this.cancellationTokens.delete(job.projectId);
        return;
      }
      const result = await this.indexingService.indexProject(
        job.projectPath,
        job.projectId,
        (progress) => {
          if (cancellationToken.cancelled) {
            throw new Error('Indexing cancelled by user');
          }
          job.progress = {
            phase: progress.phase,
            filesProcessed: progress.filesProcessed,
            filesTotal: progress.filesTotal,
            chunksCreated: progress.chunksCreated,
          };
        }
      );
      job.status = 'completed';
      job.completedAt = new Date();
      job.result = {
        filesIndexed: result.filesIndexed,
        chunksCreated: result.chunksCreated,
        nodesCreated: result.nodesCreated,
        edgesCreated: result.edgesCreated,
        durationMs: result.durationMs,
      };
      if (!cancellationToken.cancelled) {
        try {
          const generator = new CodingStandardsGenerator(vectorStore);
          await generator.generateStandards(job.projectId, job.projectPath);
        } catch { /* Non-fatal */ }
      }
      try {
        await this.queryCache.invalidateProject(job.projectId);
      } catch { /* Non-fatal */ }
      this.cancellationTokens.delete(job.projectId);
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : String(error);
      job.completedAt = new Date();
      this.cancellationTokens.delete(job.projectId);
    }
  }

  private getIndexingStatus(projectId: string): IndexingJob | undefined {
    return this.indexingJobs.get(projectId);
  }

  private async findProjectPath(startPath: string): Promise<string> {
    let currentPath = path.resolve(startPath);
    const root = path.parse(currentPath).root;
    while (currentPath !== root) {
      const configPath = path.join(currentPath, '.codeseeker', 'project.json');
      if (fs.existsSync(configPath)) {
        return currentPath;
      }
      currentPath = path.dirname(currentPath);
    }
    return startPath;
  }

  private generateProjectId(projectPath: string): string {
    return crypto.createHash('md5').update(projectPath).digest('hex');
  }

  private async getAllProjectDocuments(vectorStore: IVectorStore, projectId: string): Promise<VectorDocument[]> {
    const randomEmbedding = Array.from({ length: 384 }, () => Math.random() - 0.5);
    const results = await vectorStore.searchByVector(randomEmbedding, projectId, 10000);
    return results.map(r => r.document);
  }

  private formatErrorMessage(operation: string, error: Error | string, context?: { projectPath?: string }): string {
    const message = error instanceof Error ? error.message : String(error);
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('enoent') || lowerMessage.includes('not found') || lowerMessage.includes('no such file')) {
      return `${operation} failed: File or directory not found. Verify: ${context?.projectPath || 'the specified path'}`;
    }
    if (lowerMessage.includes('eacces') || lowerMessage.includes('permission denied')) {
      return `${operation} failed: Permission denied.`;
    }
    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
      return `${operation} failed: Timed out. Check status with index({action: "status"}).`;
    }
    if (lowerMessage.includes('connection') || lowerMessage.includes('econnrefused') || lowerMessage.includes('network')) {
      return `${operation} failed: Connection error. Check storage services.`;
    }
    if (lowerMessage.includes('not indexed') || lowerMessage.includes('no project')) {
      const pathHint = context?.projectPath ? `index({action: "init", path: "${context.projectPath}"})` : 'index({action: "init", path: "/path/to/project"})';
      return `${operation} failed: Project not indexed. Run: ${pathHint}`;
    }
    if (lowerMessage.includes('out of memory') || lowerMessage.includes('heap')) {
      return `${operation} failed: Out of memory. Use index({action: "exclude"}) to skip large directories.`;
    }
    return `${operation} failed: ${message}`;
  }

  private matchesExclusionPattern(filePath: string, pattern: string): boolean {
    const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
    const normalizedPattern = pattern.replace(/\\/g, '/').toLowerCase();
    if (normalizedPath === normalizedPattern) return true;
    let regexPattern = normalizedPattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '<<GLOBSTAR>>')
      .replace(/\*/g, '[^/]*')
      .replace(/<<GLOBSTAR>>/g, '.*')
      .replace(/\?/g, '.');
    if (!regexPattern.startsWith('.*')) {
      regexPattern = `(^|/)${regexPattern}`;
    }
    regexPattern = `${regexPattern}(/.*)?$`;
    try {
      return new RegExp(regexPattern).test(normalizedPath);
    } catch {
      return normalizedPath.includes(normalizedPattern.replace(/\*/g, ''));
    }
  }

  private _getIndexingStatusForProject(projectId: string): Record<string, unknown> | null {
    const job = this.indexingJobs.get(projectId);
    if (!job) return null;
    return {
      indexing_status: job.status,
      indexing_progress: job.progress,
      indexing_result: job.result,
      indexing_error: job.error,
      indexing_started: job.startedAt.toISOString(),
      indexing_completed: job.completedAt?.toISOString(),
    };
  }

  /**
   * Resolve project from name/path, returning project record and path.
   * Shared helper for search and analyze tools.
   */
  private async resolveProject(project?: string): Promise<{
    projectPath: string;
    projectRecord?: { id: string; name: string; path: string; updatedAt: Date };
    error?: { content: Array<{ type: 'text'; text: string }>; isError: true };
  }> {
    const storageManager = await getStorageManager();
    const projectStore = storageManager.getProjectStore();
    const projects = await projectStore.list();

    if (project) {
      const found = projects.find(p =>
        p.name === project ||
        p.path === project ||
        path.basename(p.path) === project ||
        path.resolve(project) === p.path
      );
      if (found) {
        return { projectPath: found.path, projectRecord: found };
      }
      return { projectPath: await this.findProjectPath(path.resolve(project)) };
    }

    if (projects.length === 0) {
      return {
        projectPath: '',
        error: {
          content: [{ type: 'text' as const, text: 'No indexed projects. Use index({action: "init", path: "/path/to/project"}) first.' }],
          isError: true,
        },
      };
    }
    if (projects.length === 1) {
      return { projectPath: projects[0].path, projectRecord: projects[0] };
    }
    const projectList = projects.map(p => `  - "${p.name}" (${p.path})`).join('\n');
    return {
      projectPath: '',
      error: {
        content: [{ type: 'text' as const, text: `Multiple projects indexed. Specify project parameter:\n\n${projectList}` }],
        isError: true,
      },
    };
  }

  /**
   * Verify project has embeddings (is actually indexed).
   */
  private async verifyIndexed(projectPath: string, projectRecord?: { id: string; name: string; path: string }): Promise<{
    error?: { content: Array<{ type: 'text'; text: string }>; isError: true };
  }> {
    if (!projectRecord) return {};
    const storageManager = await getStorageManager();
    const vectorStore = storageManager.getVectorStore();
    try {
      const testResults = await vectorStore.searchByText('test', projectRecord.id, 1);
      if (!testResults || testResults.length === 0) {
        return {
          error: {
            content: [{ type: 'text' as const, text: `Project "${path.basename(projectPath)}" not indexed. Run index({action: "init", path: "${projectPath}"}) first.` }],
            isError: true,
          },
        };
      }
    } catch {
      return {
        error: {
          content: [{ type: 'text' as const, text: `Project "${path.basename(projectPath)}" needs indexing. Run index({action: "init", path: "${projectPath}"}) first.` }],
          isError: true,
        },
      };
    }
    return {};
  }

  // ============================================================
  // TOOL REGISTRATION - 3 CONSOLIDATED TOOLS
  // ============================================================

  private registerTools(): void {
    this.registerSearchTool();
    this.registerAnalyzeTool();
    this.registerIndexTool();
  }

  // ============================================================
  // TOOL 1: search
  //   Combines: search, search_and_read, read_with_context
  // ============================================================

  private registerSearchTool(): void {
    this.server.registerTool(
      'search',
      {
        description: 'Semantic code search. Finds code by meaning, not just text. ' +
          'Pass query to search, add read=true to include file contents, or pass filepath instead to read a file with related context.',
        inputSchema: {
          query: z.string().optional().describe('Natural language search query'),
          filepath: z.string().optional().describe('File path to read with semantic context (alternative to query)'),
          project: z.string().optional().describe('Project path or name'),
          read: z.boolean().optional().default(false).describe('Include file contents in results'),
          limit: z.number().optional().default(10).describe('Max results'),
          max_lines: z.number().optional().default(500).describe('Max lines per file when read=true'),
          search_type: z.enum(['hybrid', 'fts', 'vector', 'graph']).optional().default('hybrid')
            .describe('Search method'),
          mode: z.enum(['full', 'exists']).optional().default('full')
            .describe('"exists" returns quick yes/no'),
        },
      },
      async ({ query, filepath, project, read = false, limit = 10, max_lines = 500, search_type = 'hybrid', mode = 'full' }) => {
        try {
          // Dispatch: filepath → read-with-context, read → search-and-read, else → search
          if (filepath) {
            return await this.handleReadWithContext(filepath, project, !read ? true : read);
          }
          if (!query) {
            return {
              content: [{ type: 'text' as const, text: 'Provide either query or filepath parameter.' }],
              isError: true,
            };
          }
          if (read) {
            return await this.handleSearchAndRead(query, project, Math.min(limit, 3), Math.min(max_lines, 1000));
          }
          return await this.handleSearch(query, project, limit, search_type, mode);
        } catch (error) {
          return {
            content: [{ type: 'text' as const, text: this.formatErrorMessage('Search', error instanceof Error ? error : String(error), { projectPath: project }) }],
            isError: true,
          };
        }
      }
    );
  }

  private async handleSearch(
    query: string,
    project: string | undefined,
    limit: number,
    search_type: string,
    mode: string
  ) {
    const { projectPath, projectRecord, error } = await this.resolveProject(project);
    if (error) return error;

    const indexCheck = await this.verifyIndexed(projectPath, projectRecord as any);
    if (indexCheck.error) return indexCheck.error;

    // Check cache (only for 'full' mode)
    let results: any[];
    let fromCache = false;
    const cacheProjectId = projectRecord?.id || this.generateProjectId(projectPath);

    if (mode === 'full') {
      const cached = await this.queryCache.get(query, cacheProjectId, search_type);
      if (cached) {
        results = cached.results;
        fromCache = true;
      } else {
        results = await this.searchOrchestrator.performSemanticSearch(query, projectPath, search_type as any);
        if (results.length > 0) {
          await this.queryCache.set(query, cacheProjectId, results, search_type);
        }
      }
    } else {
      results = await this.searchOrchestrator.performSemanticSearch(query, projectPath, search_type as any);
    }

    const limitedResults = results.slice(0, mode === 'exists' ? 5 : limit);

    if (limitedResults.length === 0) {
      if (mode === 'exists') {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ exists: false, query, project: projectPath, message: 'No matching code found' }, null, 2) }],
        };
      }
      return {
        content: [{ type: 'text' as const, text: `No results for: "${query}". Try different terms or reindex.` }],
      };
    }

    if (mode === 'exists') {
      const topResult = limitedResults[0];
      const absolutePath = path.isAbsolute(topResult.file) ? topResult.file : path.join(projectPath, topResult.file);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          exists: true, query, project: projectPath,
          total_matches: results.length, top_file: absolutePath,
          top_score: Math.round(topResult.similarity * 100) / 100,
        }, null, 2) }],
      };
    }

    const formattedResults = limitedResults.map((r: any, i: number) => {
      const absolutePath = path.isAbsolute(r.file) ? r.file : path.join(projectPath, r.file);
      return {
        rank: i + 1,
        file: absolutePath,
        relative_path: r.file,
        score: Math.round(r.similarity * 100) / 100,
        type: r.type,
        match_source: r.debug?.matchSource || 'hybrid',
        chunk: r.content.substring(0, 500) + (r.content.length > 500 ? '...' : ''),
        lines: r.lineStart && r.lineEnd ? `${r.lineStart}-${r.lineEnd}` : undefined,
      };
    });

    const wasLimited = results.length > limit;
    const response: Record<string, unknown> = {
      query, project: projectPath,
      total_results: limitedResults.length,
      search_type, results: formattedResults,
    };
    if (fromCache) response.cached = true;
    if (wasLimited) {
      response.truncated = true;
      response.total_available = results.length;
    }

    return { content: [{ type: 'text' as const, text: JSON.stringify(response, null, 2) }] };
  }

  private async handleSearchAndRead(
    query: string,
    project: string | undefined,
    max_files: number,
    max_lines: number
  ) {
    const fileLimit = Math.min(max_files, 3);
    const lineLimit = Math.min(max_lines, 1000);

    const { projectPath, projectRecord, error } = await this.resolveProject(project);
    if (error) return error;

    const indexCheck = await this.verifyIndexed(projectPath, projectRecord as any);
    if (indexCheck.error) return indexCheck.error;

    const results = await this.searchOrchestrator.performSemanticSearch(query, projectPath);
    if (results.length === 0) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ query, project: projectPath, found: false, message: 'No matching code found.' }, null, 2) }],
      };
    }

    // Get unique files
    const seenFiles = new Set<string>();
    const uniqueResults: typeof results = [];
    for (const r of results) {
      const normalizedPath = r.file.replace(/\\/g, '/');
      if (!seenFiles.has(normalizedPath)) {
        seenFiles.add(normalizedPath);
        uniqueResults.push(r);
        if (uniqueResults.length >= fileLimit) break;
      }
    }

    const files: Array<{
      file: string; relative_path: string; score: number;
      file_type: string; match_source: string; line_count: number;
      content: string; truncated: boolean;
    }> = [];

    for (const result of uniqueResults) {
      const absolutePath = path.isAbsolute(result.file) ? result.file : path.join(projectPath, result.file);
      try {
        if (!fs.existsSync(absolutePath)) continue;
        const content = fs.readFileSync(absolutePath, 'utf-8');
        const lines = content.split('\n');
        const truncated = lines.length > lineLimit;
        const displayLines = truncated ? lines.slice(0, lineLimit) : lines;
        const numberedContent = displayLines.map((line, i) => `${String(i + 1).padStart(4)}│ ${line}`).join('\n');

        files.push({
          file: absolutePath,
          relative_path: result.file,
          score: Math.round(result.similarity * 100) / 100,
          file_type: result.type,
          match_source: result.debug?.matchSource || 'hybrid',
          line_count: lines.length,
          content: numberedContent + (truncated ? `\n... (truncated at ${lineLimit} lines)` : ''),
          truncated,
        });
      } catch {
        continue;
      }
    }

    if (files.length === 0) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ query, project: projectPath, found: true, readable: false, message: 'Found matching files but could not read them.' }, null, 2) }],
      };
    }

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({
        query, project: projectPath,
        files_found: results.length, files_returned: files.length,
        results: files,
      }, null, 2) }],
    };
  }

  private async handleReadWithContext(
    filepath: string,
    project: string | undefined,
    include_related: boolean
  ) {
    const storageManager = await getStorageManager();
    const projectStore = storageManager.getProjectStore();

    let projectPath: string;
    if (project) {
      const projects = await projectStore.list();
      const found = projects.find(p =>
        p.name === project || p.path === project || path.basename(p.path) === project
      );
      projectPath = found?.path || process.cwd();
    } else {
      projectPath = process.cwd();
    }

    const absolutePath = path.isAbsolute(filepath) ? filepath : path.join(projectPath, filepath);
    if (!fs.existsSync(absolutePath)) {
      return { content: [{ type: 'text' as const, text: `File not found: ${absolutePath}` }], isError: true };
    }

    const content = fs.readFileSync(absolutePath, 'utf-8');
    let relatedChunks: Array<{ file: string; chunk: string; score: number }> = [];

    if (include_related) {
      const lines = content.split('\n');
      const meaningfulLines: string[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;
        if (trimmed.startsWith('import ') || trimmed.startsWith('from ') || trimmed.startsWith('require(')) continue;
        if (trimmed.startsWith('#') && !trimmed.startsWith('##')) continue;
        if (trimmed.startsWith('using ') || trimmed.startsWith('namespace ')) continue;
        meaningfulLines.push(trimmed);
        if (meaningfulLines.length >= 5) break;
      }

      const fileName = path.basename(filepath);
      const fileNameQuery = fileName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
      const contentQuery = meaningfulLines.join(' ').substring(0, 200);
      const searchQuery = `${fileNameQuery} ${contentQuery}`.trim();

      const results = await this.searchOrchestrator.performSemanticSearch(
        searchQuery || fileNameQuery,
        projectPath
      );

      relatedChunks = results
        .filter(r => !r.file.endsWith(path.basename(filepath)))
        .slice(0, 5)
        .map(r => ({
          file: r.file,
          chunk: r.content.substring(0, 300) + (r.content.length > 300 ? '...' : ''),
          score: Math.round(r.similarity * 100) / 100,
        }));
    }

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({
        filepath: path.relative(projectPath, absolutePath),
        content: content.length > 10000 ? content.substring(0, 10000) + '\n... (truncated)' : content,
        line_count: content.split('\n').length,
        related_chunks: include_related ? relatedChunks : undefined,
      }, null, 2) }],
    };
  }

  // ============================================================
  // TOOL 2: analyze
  //   Combines: show_dependencies, find_duplicates, find_dead_code, standards
  // ============================================================

  private registerAnalyzeTool(): void {
    this.server.registerTool(
      'analyze',
      {
        description: 'Code analysis. Actions: "dependencies" (imports/calls/extends graph), ' +
          '"dead_code" (unused code, anti-patterns), "duplicates" (similar code), ' +
          '"standards" (auto-detected coding patterns).',
        inputSchema: {
          action: z.enum(['dependencies', 'dead_code', 'duplicates', 'standards']).describe('Analysis type'),
          project: z.string().describe('Project path or name'),
          // dependencies params
          filepath: z.string().optional().describe('File for dependency analysis'),
          filepaths: z.array(z.string()).optional().describe('Multiple files for dependency analysis'),
          query: z.string().optional().describe('Search query to find seed files for dependencies'),
          depth: z.number().optional().default(1).describe('Relationship hops (1-3)'),
          relationship_types: z.array(z.enum([
            'imports', 'exports', 'calls', 'extends', 'implements', 'contains', 'uses', 'depends_on'
          ])).optional().describe('Filter relationship types'),
          direction: z.enum(['in', 'out', 'both']).optional().default('both').describe('Relationship direction'),
          max_nodes: z.number().optional().default(50).describe('Max nodes'),
          // duplicates params
          similarity_threshold: z.number().optional().default(0.80).describe('Min similarity for duplicates (0-1)'),
          min_lines: z.number().optional().default(5).describe('Min lines for duplicate analysis'),
          // dead_code params
          include_patterns: z.array(z.enum(['dead_code', 'god_class', 'circular_deps', 'feature_envy', 'coupling'])).optional()
            .describe('Anti-patterns to detect'),
          // standards params
          category: z.enum(['validation', 'error-handling', 'logging', 'testing', 'all']).optional().default('all')
            .describe('Standards category'),
        },
      },
      async (params) => {
        try {
          switch (params.action) {
            case 'dependencies':
              return await this.handleShowDependencies(params);
            case 'dead_code':
              return await this.handleFindDeadCode(params);
            case 'duplicates':
              return await this.handleFindDuplicates(params);
            case 'standards':
              return await this.handleStandards(params);
            default:
              return { content: [{ type: 'text' as const, text: `Unknown action: ${params.action}` }], isError: true };
          }
        } catch (error) {
          return {
            content: [{ type: 'text' as const, text: this.formatErrorMessage('Analyze', error instanceof Error ? error : String(error), { projectPath: params.project }) }],
            isError: true,
          };
        }
      }
    );
  }

  private async handleShowDependencies(params: {
    project: string;
    filepath?: string;
    filepaths?: string[];
    query?: string;
    depth?: number;
    relationship_types?: string[];
    direction?: string;
    max_nodes?: number;
  }) {
    const { filepath, filepaths, query, depth = 1, relationship_types, direction = 'both', max_nodes = 50, project } = params;

    const storageManager = await getStorageManager();
    const projectStore = storageManager.getProjectStore();
    const graphStore = storageManager.getGraphStore();

    let projectId: string | undefined;
    let projectPath: string;

    if (project) {
      const projects = await projectStore.list();
      const found = projects.find(p =>
        p.name === project || p.path === project || path.basename(p.path) === project
      );
      if (found) {
        projectId = found.id;
        projectPath = found.path;
      } else {
        projectPath = process.cwd();
      }
    } else {
      projectPath = process.cwd();
      const projects = await projectStore.list();
      const found = projects.find(p =>
        p.path === projectPath || path.basename(p.path) === path.basename(projectPath)
      );
      if (found) {
        projectId = found.id;
        projectPath = found.path;
      }
    }

    if (!projectId) {
      return { content: [{ type: 'text' as const, text: 'Project not indexed. Use index({action: "init"}) first.' }], isError: true };
    }

    // Determine seed file paths
    let seedFilePaths: string[] = [];
    if (query) {
      const searchResults = await this.searchOrchestrator.performSemanticSearch(query, projectPath);
      seedFilePaths = searchResults.slice(0, 5).map(r => r.file.replace(/\\/g, '/'));
    } else if (filepaths && filepaths.length > 0) {
      seedFilePaths = filepaths.map(fp => fp.replace(/\\/g, '/'));
    } else if (filepath) {
      seedFilePaths = [filepath.replace(/\\/g, '/')];
    } else {
      return {
        content: [{ type: 'text' as const, text: 'Provide filepath, filepaths, or query for dependency analysis.' }],
        isError: true,
      };
    }

    const allNodes = await graphStore.findNodes(projectId);
    const graphStats = {
      total_nodes: allNodes.length,
      file_nodes: allNodes.filter(n => n.type === 'file').length,
      class_nodes: allNodes.filter(n => n.type === 'class').length,
      function_nodes: allNodes.filter(n => n.type === 'function' || n.type === 'method').length,
    };

    // Find starting nodes using flexible path matching
    const startNodes = allNodes.filter(n => {
      const normalizedNodePath = n.filePath.replace(/\\/g, '/');
      const nodeRelativePath = (n.properties as { relativePath?: string })?.relativePath?.replace(/\\/g, '/');
      return seedFilePaths.some(seedPath => {
        const normalizedSeedPath = seedPath.replace(/\\/g, '/');
        return (
          normalizedNodePath === normalizedSeedPath ||
          nodeRelativePath === normalizedSeedPath ||
          normalizedNodePath.endsWith(normalizedSeedPath) ||
          normalizedNodePath.endsWith('/' + normalizedSeedPath) ||
          normalizedNodePath.includes('/' + normalizedSeedPath) ||
          n.name === path.basename(normalizedSeedPath).replace(/\.[^.]+$/, '')
        );
      });
    });

    if (startNodes.length === 0) {
      const fileNodes = allNodes.filter(n => n.type === 'file').slice(0, 15);
      const availableFiles = fileNodes.map(n => {
        const relPath = (n.properties as { relativePath?: string })?.relativePath;
        return relPath || path.relative(projectPath, n.filePath);
      });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          error: `No graph nodes found for: ${seedFilePaths.join(', ')}`,
          available_files: availableFiles,
        }, null, 2) }],
        isError: true,
      };
    }

    // Traverse relationships
    const visitedNodes = new Map<string, any>();
    const collectedEdges: any[] = [];
    let truncated = false;

    const traverse = async (nodeId: string, currentDepth: number) => {
      if (visitedNodes.size >= max_nodes) { truncated = true; return; }
      if (currentDepth > Math.min(depth, 3) || visitedNodes.has(nodeId)) return;

      const node = await graphStore.getNode(nodeId);
      if (!node) return;

      const relPath = (node.properties as { relativePath?: string })?.relativePath;
      visitedNodes.set(nodeId, {
        id: node.id, type: node.type, name: node.name,
        file: relPath || path.relative(projectPath, node.filePath),
      });

      const edges = await graphStore.getEdges(nodeId, direction as 'in' | 'out' | 'both');
      for (const edge of edges) {
        if (visitedNodes.size >= max_nodes) { truncated = true; return; }
        if (relationship_types && relationship_types.length > 0) {
          if (!relationship_types.includes(edge.type as any)) continue;
        }
        collectedEdges.push({ from: edge.source, to: edge.target, type: edge.type });
        const nextNodeId = edge.source === nodeId ? edge.target : edge.source;
        await traverse(nextNodeId, currentDepth + 1);
      }
    };

    for (const startNode of startNodes) {
      if (visitedNodes.size >= max_nodes) { truncated = true; break; }
      await traverse(startNode.id, 1);
    }

    const nodes = Array.from(visitedNodes.values());
    const uniqueEdges = collectedEdges.filter((e, i, arr) =>
      arr.findIndex(x => x.from === e.from && x.to === e.to && x.type === e.type) === i
    );

    const summary: Record<string, any> = {
      graph_stats: graphStats,
      seed_files: startNodes.map(n => ({
        name: n.name, type: n.type,
        file: (n.properties as { relativePath?: string })?.relativePath || path.relative(projectPath, n.filePath),
      })),
      traversal: { depth_requested: depth, direction, relationship_filters: relationship_types || 'all', max_nodes },
      results: { seed_nodes: startNodes.length, nodes_found: nodes.length, relationships_found: uniqueEdges.length, truncated },
      nodes: nodes.map(n => ({ name: n.name, type: n.type, file: n.file })),
      relationships: uniqueEdges.map(e => {
        const fromNode = visitedNodes.get(e.from);
        const toNode = visitedNodes.get(e.to);
        return { type: e.type, from: fromNode?.name || e.from, to: toNode?.name || e.to };
      }),
    };

    if (truncated) {
      summary.truncated_warning = {
        message: `Results truncated at ${max_nodes} nodes.`,
        recommendations: [
          relationship_types ? null : 'Add relationship_types filter',
          depth > 1 ? 'Reduce depth to 1' : null,
          `Increase max_nodes (current: ${max_nodes})`,
        ].filter(Boolean),
      };
    }

    return { content: [{ type: 'text' as const, text: JSON.stringify(summary, null, 2) }] };
  }

  private async handleFindDuplicates(params: {
    project: string;
    similarity_threshold?: number;
    min_lines?: number;
  }) {
    const { project, similarity_threshold = 0.80, min_lines = 5 } = params;

    const storageManager = await getStorageManager();
    const projectStore = storageManager.getProjectStore();
    const vectorStore = storageManager.getVectorStore();
    const projects = await projectStore.list();

    const projectRecord = projects.find(p =>
      p.name === project || p.path === project ||
      path.basename(p.path) === project || path.resolve(project) === p.path
    );

    if (!projectRecord) {
      return {
        content: [{ type: 'text' as const, text: `Project not found: ${project}. Use index({action: "init"}) first.` }],
        isError: true,
      };
    }

    const allDocs = await this.getAllProjectDocuments(vectorStore, projectRecord.id);
    if (allDocs.length === 0) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          project: projectRecord.name,
          summary: { total_chunks_analyzed: 0, exact_duplicates: 0, semantic_duplicates: 0, total_lines_affected: 0, potential_lines_saved: 0 },
          duplicate_groups: [],
        }, null, 2) }],
      };
    }

    const filteredDocs = allDocs.filter(doc => doc.content.split('\n').length >= min_lines);
    const duplicateGroups: Array<{
      type: 'exact' | 'semantic'; similarity: number;
      chunks: Array<{ id: string; filePath: string; content: string; startLine?: number; endLine?: number }>;
    }> = [];

    const processed = new Set<string>();
    const EXACT_THRESHOLD = 0.98;

    for (let i = 0; i < filteredDocs.length && duplicateGroups.length < 50; i++) {
      const doc = filteredDocs[i];
      if (processed.has(doc.id)) continue;

      const similarDocs = await vectorStore.searchByVector(doc.embedding, projectRecord.id, 20);
      const matches = similarDocs.filter(match =>
        match.document.id !== doc.id && match.score >= similarity_threshold && !processed.has(match.document.id)
      );

      if (matches.length > 0) {
        const maxScore = Math.max(...matches.map(m => m.score));
        const type = maxScore >= EXACT_THRESHOLD ? 'exact' : 'semantic';
        const getLines = (d: typeof doc) => {
          const meta = d.metadata as Record<string, unknown> | undefined;
          return { startLine: meta?.startLine as number | undefined, endLine: meta?.endLine as number | undefined };
        };

        duplicateGroups.push({
          type, similarity: maxScore,
          chunks: [
            { id: doc.id, filePath: doc.filePath, content: doc.content.substring(0, 200) + (doc.content.length > 200 ? '...' : ''), ...getLines(doc) },
            ...matches.map(m => ({
              id: m.document.id, filePath: m.document.filePath,
              content: m.document.content.substring(0, 200) + (m.document.content.length > 200 ? '...' : ''),
              ...getLines(m.document),
            })),
          ],
        });
        processed.add(doc.id);
        matches.forEach(m => processed.add(m.document.id));
      }
    }

    const exactDuplicates = duplicateGroups.filter(g => g.type === 'exact').length;
    const semanticDuplicates = duplicateGroups.filter(g => g.type === 'semantic').length;
    const totalLinesAffected = duplicateGroups.reduce((sum, g) =>
      sum + g.chunks.reduce((chunkSum, c) =>
        chunkSum + (c.endLine && c.startLine ? c.endLine - c.startLine + 1 : c.content.split('\n').length), 0
      ), 0
    );

    const formattedGroups = duplicateGroups.slice(0, 20).map(group => ({
      type: group.type,
      similarity: `${(group.similarity * 100).toFixed(1)}%`,
      files_affected: new Set(group.chunks.map(c => c.filePath)).size,
      locations: group.chunks.map(c => ({
        file: path.relative(projectRecord.path, c.filePath),
        lines: c.startLine && c.endLine ? `${c.startLine}-${c.endLine}` : 'N/A',
        preview: c.content.substring(0, 100).replace(/\n/g, ' '),
      })),
    }));

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({
        project: projectRecord.name,
        summary: {
          total_chunks_analyzed: filteredDocs.length,
          exact_duplicates: exactDuplicates,
          semantic_duplicates: semanticDuplicates,
          total_lines_affected: totalLinesAffected,
          potential_lines_saved: Math.floor(totalLinesAffected * 0.6),
        },
        duplicate_groups: formattedGroups,
        recommendations: exactDuplicates > 0
          ? [`Found ${exactDuplicates} exact duplicate groups - prioritize consolidation`]
          : semanticDuplicates > 0
            ? [`Found ${semanticDuplicates} semantic duplicates - review for potential abstraction`]
            : ['No significant duplicates found above threshold'],
      }, null, 2) }],
    };
  }

  private async handleFindDeadCode(params: {
    project: string;
    include_patterns?: string[];
  }) {
    const { project, include_patterns } = params;

    const storageManager = await getStorageManager();
    const projectStore = storageManager.getProjectStore();
    const graphStore = storageManager.getGraphStore();
    const projects = await projectStore.list();

    const projectRecord = projects.find(p =>
      p.name === project || p.path === project ||
      path.basename(p.path) === project || path.resolve(project) === p.path
    );

    if (!projectRecord) {
      return {
        content: [{ type: 'text' as const, text: `Project not found: ${project}. Use index({action: "init"}) first.` }],
        isError: true,
      };
    }

    const allNodes = await graphStore.findNodes(projectRecord.id);
    if (allNodes.length === 0) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          project: projectRecord.name,
          summary: { total_issues: 0, dead_code_count: 0, anti_patterns_count: 0, coupling_issues_count: 0 },
          dead_code: [], anti_patterns: [], coupling_issues: [],
          note: 'No graph data. Project may need reindexing.',
        }, null, 2) }],
      };
    }

    const patterns = include_patterns || ['dead_code', 'god_class', 'circular_deps', 'feature_envy', 'coupling'];
    const deadCodeItems: Array<{ type: string; name: string; file: string; description: string; confidence: string; impact: string; recommendation: string }> = [];
    const antiPatternItems: typeof deadCodeItems = [];
    const couplingItems: typeof deadCodeItems = [];

    for (const node of allNodes) {
      const inEdges = await graphStore.getEdges(node.id, 'in');
      const outEdges = await graphStore.getEdges(node.id, 'out');

      if (patterns.includes('dead_code')) {
        const isEntryPoint = node.type === 'file' ||
          node.name.toLowerCase().includes('main') ||
          node.name.toLowerCase().includes('index') ||
          node.name.toLowerCase().includes('app');
        if (!isEntryPoint && (node.type === 'class' || node.type === 'function') && inEdges.length === 0) {
          deadCodeItems.push({
            type: 'Dead Code', name: node.name,
            file: path.relative(projectRecord.path, node.filePath),
            description: `Unused ${node.type}: ${node.name} - no incoming references`,
            confidence: '70%', impact: 'medium',
            recommendation: 'Review if needed. Remove if unused or add to exports.',
          });
        }
      }

      if (patterns.includes('god_class') && node.type === 'class') {
        const containsEdges = outEdges.filter(e => e.type === 'contains');
        const dependsOnEdges = outEdges.filter(e => e.type === 'imports' || e.type === 'depends_on');
        if (containsEdges.length > 15 || dependsOnEdges.length > 10) {
          antiPatternItems.push({
            type: 'God Class', name: node.name,
            file: path.relative(projectRecord.path, node.filePath),
            description: `${node.name} has ${containsEdges.length} members, ${dependsOnEdges.length} dependencies`,
            confidence: '80%', impact: 'high',
            recommendation: 'Break down following Single Responsibility Principle',
          });
        }
      }

      if (patterns.includes('coupling') && (node.type === 'class' || node.type === 'file')) {
        const dependencies = outEdges.filter(e => e.type === 'imports' || e.type === 'depends_on');
        if (dependencies.length > 8) {
          couplingItems.push({
            type: 'High Coupling', name: node.name,
            file: path.relative(projectRecord.path, node.filePath),
            description: `${node.type} ${node.name} has ${dependencies.length} dependencies`,
            confidence: '75%', impact: 'high',
            recommendation: 'Reduce via interfaces or dependency injection',
          });
        }
      }
    }

    // Circular dependency detection
    if (patterns.includes('circular_deps')) {
      const fileNodes = allNodes.filter(n => n.type === 'file');
      const importMap = new Map<string, Set<string>>();
      for (const fileNode of fileNodes) {
        const imports = await graphStore.getEdges(fileNode.id, 'out');
        importMap.set(fileNode.id, new Set(imports.filter(e => e.type === 'imports').map(e => e.target)));
      }
      for (const [fileId, imports] of importMap.entries()) {
        for (const targetId of imports) {
          const targetImports = importMap.get(targetId);
          if (targetImports?.has(fileId)) {
            const sourceNode = allNodes.find(n => n.id === fileId);
            const targetNode = allNodes.find(n => n.id === targetId);
            if (sourceNode && targetNode) {
              antiPatternItems.push({
                type: 'Circular Dependency',
                name: `${sourceNode.name} <-> ${targetNode.name}`,
                file: path.relative(projectRecord.path, sourceNode.filePath),
                description: `Bidirectional import between ${sourceNode.name} and ${targetNode.name}`,
                confidence: '90%', impact: 'high',
                recommendation: 'Break cycle using dependency inversion or extract shared code',
              });
            }
          }
        }
      }
    }

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({
        project: projectRecord.name,
        graph_stats: {
          total_nodes: allNodes.length,
          files: allNodes.filter(n => n.type === 'file').length,
          classes: allNodes.filter(n => n.type === 'class').length,
          functions: allNodes.filter(n => n.type === 'function').length,
        },
        summary: {
          total_issues: deadCodeItems.length + antiPatternItems.length + couplingItems.length,
          dead_code_count: deadCodeItems.length,
          anti_patterns_count: antiPatternItems.length,
          coupling_issues_count: couplingItems.length,
        },
        dead_code: deadCodeItems.slice(0, 20),
        anti_patterns: antiPatternItems.slice(0, 10),
        coupling_issues: couplingItems.slice(0, 10),
      }, null, 2) }],
    };
  }

  private async handleStandards(params: {
    project: string;
    category?: string;
  }) {
    const { project, category = 'all' } = params;

    const storageManager = await getStorageManager();
    const projectStore = storageManager.getProjectStore();
    const vectorStore = storageManager.getVectorStore();
    const projects = await projectStore.list();

    const found = projects.find(p =>
      p.name === project || p.path === project || path.basename(p.path) === project
    );

    if (!found) {
      return {
        content: [{ type: 'text' as const, text: `Project not found: ${project}. Use index({action: "status"}) to list projects.` }],
        isError: true,
      };
    }

    const standardsPath = path.join(found.path, '.codeseeker', 'coding-standards.json');
    let standardsContent: string;

    try {
      standardsContent = fs.readFileSync(standardsPath, 'utf-8');
    } catch {
      const generator = new CodingStandardsGenerator(vectorStore);
      await generator.generateStandards(found.id, found.path);
      try {
        standardsContent = fs.readFileSync(standardsPath, 'utf-8');
      } catch {
        return {
          content: [{ type: 'text' as const, text: 'No coding standards detected. Index the project first.' }],
          isError: true,
        };
      }
    }

    const standards = JSON.parse(standardsContent);
    let result = standards;
    if (category !== 'all') {
      result = { ...standards, standards: { [category]: standards.standards[category] || {} } };
    }

    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }

  // ============================================================
  // TOOL 3: index
  //   Combines: index (init), sync, projects (status), install_parsers, exclude
  // ============================================================

  private registerIndexTool(): void {
    this.server.registerTool(
      'index',
      {
        description: 'Index management. Actions: "init" (index project), "sync" (update changed files), ' +
          '"status" (list projects), "parsers" (install language parsers), "exclude" (manage exclusions).',
        inputSchema: {
          action: z.enum(['init', 'sync', 'status', 'parsers', 'exclude']).describe('Action'),
          path: z.string().optional().describe('Project directory (for init)'),
          project: z.string().optional().describe('Project name or path'),
          name: z.string().optional().describe('Project name (for init)'),
          // sync params
          changes: z.array(z.object({
            type: z.enum(['created', 'modified', 'deleted']),
            path: z.string(),
          })).optional().describe('File changes for sync'),
          full_reindex: z.boolean().optional().default(false).describe('Full reindex'),
          // parsers params
          languages: z.array(z.string()).optional().describe('Languages to install parsers for'),
          list_available: z.boolean().optional().default(false).describe('List available parsers'),
          // exclude params
          exclude_action: z.enum(['exclude', 'include', 'list']).optional().describe('Exclusion sub-action'),
          paths: z.array(z.string()).optional().describe('Paths/patterns to exclude/include'),
          reason: z.string().optional().describe('Exclusion reason'),
        },
      },
      async (params) => {
        try {
          switch (params.action) {
            case 'init':
              return await this.handleIndexInit(params);
            case 'sync':
              return await this.handleSync(params);
            case 'status':
              return await this.handleProjects();
            case 'parsers':
              return await this.handleInstallParsers(params);
            case 'exclude':
              return await this.handleExclude(params);
            default:
              return { content: [{ type: 'text' as const, text: `Unknown action: ${params.action}` }], isError: true };
          }
        } catch (error) {
          return {
            content: [{ type: 'text' as const, text: this.formatErrorMessage('Index', error instanceof Error ? error : String(error), { projectPath: params.path || params.project }) }],
            isError: true,
          };
        }
      }
    );
  }

  private async handleIndexInit(params: {
    path?: string;
    name?: string;
  }) {
    const projectPath = params.path;
    if (!projectPath) {
      return {
        content: [{ type: 'text' as const, text: 'path parameter required for init action.' }],
        isError: true,
      };
    }

    const absolutePath = path.isAbsolute(projectPath) ? projectPath : path.resolve(projectPath);
    const pathError = this.validateProjectPath(absolutePath);
    if (pathError) {
      return { content: [{ type: 'text' as const, text: pathError }], isError: true };
    }

    if (!fs.existsSync(absolutePath)) {
      return { content: [{ type: 'text' as const, text: `Directory not found: ${absolutePath}` }], isError: true };
    }
    if (!fs.statSync(absolutePath).isDirectory()) {
      return { content: [{ type: 'text' as const, text: `Not a directory: ${absolutePath}` }], isError: true };
    }

    const projectName = params.name || path.basename(absolutePath);
    const projectId = this.generateProjectId(absolutePath);

    if (this.indexingMutex.has(projectId)) {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          status: 'already_indexing', project_name: projectName,
          message: 'Indexing request already being processed.',
        }, null, 2) }],
      };
    }

    const existingJob = this.getIndexingStatus(projectId);
    if (existingJob?.status === 'running') {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          status: 'already_indexing', project_name: projectName,
          progress: existingJob.progress,
          message: 'Indexing in progress. Check with index({action: "status"}).',
        }, null, 2) }],
      };
    }

    this.indexingMutex.add(projectId);

    const storageManager = await getStorageManager();
    const projectStore = storageManager.getProjectStore();
    await projectStore.upsert({
      id: projectId, name: projectName, path: absolutePath,
      metadata: { indexedAt: new Date().toISOString(), indexing: true },
    });

    const codingStandardsPath = path.join(absolutePath, '.codeseeker', 'coding-standards.json');
    if (fs.existsSync(codingStandardsPath)) {
      try { fs.unlinkSync(codingStandardsPath); } catch { /* ignore */ }
    }

    this.startBackgroundIndexing(projectId, projectName, absolutePath, true);

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({
        status: 'indexing_started', project_name: projectName, project_path: absolutePath,
        message: 'Indexing started in background. Use index({action: "status"}) to check progress.',
      }, null, 2) }],
    };
  }

  private async handleSync(params: {
    project?: string;
    changes?: Array<{ type: 'created' | 'modified' | 'deleted'; path: string }>;
    full_reindex?: boolean;
  }) {
    const { project, changes, full_reindex = false } = params;
    const startTime = Date.now();

    const storageManager = await getStorageManager();
    const projectStore = storageManager.getProjectStore();
    const vectorStore = storageManager.getVectorStore();
    const projects = await projectStore.list();

    let found: typeof projects[0] | undefined;
    if (project) {
      found = projects.find(p =>
        p.name === project || p.path === project ||
        path.basename(p.path) === project || path.resolve(project) === p.path
      );
    } else {
      if (changes && changes.length > 0 && path.isAbsolute(changes[0].path)) {
        found = projects.find(p => changes[0].path.startsWith(p.path));
      }
      if (!found && projects.length === 1) {
        found = projects[0];
      }
    }

    if (!found) {
      return {
        content: [{ type: 'text' as const, text: project
          ? `Project not found: ${project}. Use index({action: "status"}) to see projects.`
          : `Could not auto-detect project. Specify project. Available: ${projects.map(p => p.name).join(', ')}`
        }],
        isError: true,
      };
    }

    if (full_reindex) {
      const existingJob = this.getIndexingStatus(found.id);
      if (existingJob?.status === 'running') {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({
            status: 'already_indexing', project: found.name,
            progress: existingJob.progress,
          }, null, 2) }],
        };
      }

      const codingStandardsPath = path.join(found.path, '.codeseeker', 'coding-standards.json');
      if (fs.existsSync(codingStandardsPath)) {
        try { fs.unlinkSync(codingStandardsPath); } catch { /* ignore */ }
      }

      this.startBackgroundIndexing(found.id, found.name, found.path, true);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          status: 'reindex_started', project: found.name,
          message: 'Full reindex started. Use index({action: "status"}) to check.',
        }, null, 2) }],
      };
    }

    if (!changes || changes.length === 0) {
      return {
        content: [{ type: 'text' as const, text: 'No changes provided. Either pass changes or set full_reindex: true.' }],
        isError: true,
      };
    }

    let chunksCreated = 0, chunksDeleted = 0, filesProcessed = 0, filesSkipped = 0;
    const errors: string[] = [];

    for (const change of changes) {
      const relativePath = path.isAbsolute(change.path) ? path.relative(found.path, change.path) : change.path;
      try {
        if (change.type === 'deleted') {
          const result = await this.indexingService.deleteFile(found.id, relativePath);
          if (result.success) { chunksDeleted += result.deleted; filesProcessed++; }
        } else {
          const result = await this.indexingService.indexSingleFile(found.path, relativePath, found.id);
          if (result.success) {
            if (result.skipped) { filesSkipped++; }
            else { chunksCreated += result.chunksCreated; filesProcessed++; }
          }
        }
      } catch (error) {
        errors.push(`${change.path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Update coding standards
    try {
      const changedPaths = changes.map(c => c.path);
      const generator = new CodingStandardsGenerator(vectorStore);
      await generator.updateStandards(found.id, found.path, changedPaths);
    } catch { /* Non-fatal */ }

    // Update RAPTOR hierarchical nodes (drift-checked, skips when semantics unchanged)
    try {
      const allRelative = changes.map(c =>
        path.isAbsolute(c.path) ? path.relative(found.path, c.path) : c.path
      );
      const deletedRelative = changes
        .filter(c => c.type === 'deleted')
        .map(c => path.isAbsolute(c.path) ? path.relative(found.path, c.path) : c.path);

      const raptorService = new RaptorIndexingService();
      await raptorService.updateForChanges(
        found.path, found.id, allRelative, deletedRelative, vectorStore
      );
    } catch { /* Non-fatal */ }

    // Invalidate cache
    let cacheInvalidated = 0;
    try { cacheInvalidated = await this.queryCache.invalidateProject(found.id); } catch { /* Non-fatal */ }

    const duration = Date.now() - startTime;

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({
        success: errors.length === 0,
        mode: 'incremental', project: found.name,
        changes_processed: changes.length,
        files_reindexed: filesProcessed,
        files_skipped: filesSkipped > 0 ? filesSkipped : undefined,
        chunks_created: chunksCreated,
        chunks_deleted: chunksDeleted,
        cache_invalidated: cacheInvalidated > 0 ? cacheInvalidated : undefined,
        duration_ms: duration,
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      }, null, 2) }],
    };
  }

  private async handleProjects() {
    const storageManager = await getStorageManager();
    const projectStore = storageManager.getProjectStore();
    const vectorStore = storageManager.getVectorStore();
    const projects = await projectStore.list();

    if (projects.length === 0) {
      return {
        content: [{ type: 'text' as const, text: 'No projects indexed. Use index({action: "init", path: "/path/to/project"}).' }],
      };
    }

    const projectsWithCounts = await Promise.all(
      projects.map(async (p) => {
        const fileCount = await vectorStore.countFiles(p.id);
        const chunkCount = await vectorStore.count(p.id);
        const indexingStatus = this._getIndexingStatusForProject(p.id);
        const projectInfo: Record<string, unknown> = {
          name: p.name, path: p.path, files: fileCount, chunks: chunkCount,
          last_indexed: p.updatedAt.toISOString(),
        };
        if (indexingStatus) Object.assign(projectInfo, indexingStatus);
        return projectInfo;
      })
    );

    return {
      content: [{ type: 'text' as const, text: JSON.stringify({
        storage_mode: storageManager.getMode(),
        total_projects: projects.length,
        projects: projectsWithCounts,
      }, null, 2) }],
    };
  }

  private async handleInstallParsers(params: {
    project?: string;
    languages?: string[];
    list_available?: boolean;
  }) {
    const { project, languages, list_available = false } = params;

    if (list_available) {
      const parsers = await this.languageSupportService.checkInstalledParsers();
      const installed = parsers.filter(p => p.installed);
      const available = parsers.filter(p => !p.installed);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          installed_parsers: installed.map(p => ({ language: p.language, extensions: p.extensions, quality: p.quality })),
          available_parsers: available.map(p => ({ language: p.language, extensions: p.extensions, npm_package: p.npmPackage, quality: p.quality })),
        }, null, 2) }],
      };
    }

    if (languages && languages.length > 0) {
      const result = await this.languageSupportService.installLanguageParsers(languages);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          success: result.success, installed: result.installed,
          failed: result.failed.length > 0 ? result.failed : undefined,
          message: result.message,
          next_step: result.success ? 'Reindex: index({action: "sync", project: "...", full_reindex: true})' : undefined,
        }, null, 2) }],
      };
    }

    if (project) {
      const projectPath = path.isAbsolute(project) ? project : path.resolve(project);
      if (!fs.existsSync(projectPath)) {
        return { content: [{ type: 'text' as const, text: `Directory not found: ${projectPath}` }], isError: true };
      }
      const analysis = await this.languageSupportService.analyzeProjectLanguages(projectPath);
      const missingLanguages = analysis.missingParsers.map(p => p.language.toLowerCase());
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          project: projectPath,
          detected_languages: analysis.detectedLanguages,
          installed_parsers: analysis.installedParsers,
          missing_parsers: analysis.missingParsers.map(p => ({ language: p.language, npm_package: p.npmPackage })),
          install_command: missingLanguages.length > 0
            ? `index({action: "parsers", languages: [${missingLanguages.map(l => `"${l}"`).join(', ')}]})`
            : 'All parsers installed!',
        }, null, 2) }],
      };
    }

    return {
      content: [{ type: 'text' as const, text: 'Provide project path or languages, or set list_available: true.' }],
      isError: true,
    };
  }

  private async handleExclude(params: {
    project?: string;
    exclude_action?: string;
    paths?: string[];
    reason?: string;
  }) {
    const { project, exclude_action, paths: excludePaths, reason } = params;

    if (!project) {
      return { content: [{ type: 'text' as const, text: 'project parameter required for exclude action.' }], isError: true };
    }
    if (!exclude_action) {
      return { content: [{ type: 'text' as const, text: 'exclude_action required (exclude, include, or list).' }], isError: true };
    }

    const storageManager = await getStorageManager();
    const projectStore = storageManager.getProjectStore();
    const vectorStore = storageManager.getVectorStore();
    const projects = await projectStore.list();

    const found = projects.find(p =>
      p.name === project || p.path === project || path.basename(p.path) === project
    );
    if (!found) {
      return { content: [{ type: 'text' as const, text: `Project not found: ${project}.` }], isError: true };
    }

    // Load exclusions
    const exclusionsPath = path.join(found.path, '.codeseeker', 'exclusions.json');
    let exclusions: {
      patterns: Array<{ pattern: string; reason?: string; addedAt: string }>;
      lastModified: string;
    } = { patterns: [], lastModified: new Date().toISOString() };

    const codeseekerDir = path.join(found.path, '.codeseeker');
    if (!fs.existsSync(codeseekerDir)) {
      fs.mkdirSync(codeseekerDir, { recursive: true });
    }
    if (fs.existsSync(exclusionsPath)) {
      try { exclusions = JSON.parse(fs.readFileSync(exclusionsPath, 'utf-8')); } catch { /* start fresh */ }
    }

    if (exclude_action === 'list') {
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          project: found.name,
          total_exclusions: exclusions.patterns.length,
          patterns: exclusions.patterns,
        }, null, 2) }],
      };
    }

    if (!excludePaths || excludePaths.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No paths provided for exclude/include.' }], isError: true };
    }

    if (exclude_action === 'exclude') {
      const addedPatterns: string[] = [];
      const alreadyExcluded: string[] = [];
      let filesRemoved = 0;

      for (const pattern of excludePaths) {
        const normalizedPattern = pattern.replace(/\\/g, '/');
        if (exclusions.patterns.some(p => p.pattern === normalizedPattern)) {
          alreadyExcluded.push(normalizedPattern);
          continue;
        }
        exclusions.patterns.push({ pattern: normalizedPattern, reason, addedAt: new Date().toISOString() });
        addedPatterns.push(normalizedPattern);

        const results = await vectorStore.searchByText(normalizedPattern, found.id, 1000);
        for (const result of results) {
          if (this.matchesExclusionPattern(result.document.filePath.replace(/\\/g, '/'), normalizedPattern)) {
            await vectorStore.delete(result.document.id);
            filesRemoved++;
          }
        }
      }

      exclusions.lastModified = new Date().toISOString();
      fs.writeFileSync(exclusionsPath, JSON.stringify(exclusions, null, 2));
      await vectorStore.flush();

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          success: true, action: 'exclude', project: found.name,
          patterns_added: addedPatterns,
          already_excluded: alreadyExcluded.length > 0 ? alreadyExcluded : undefined,
          files_removed_from_index: filesRemoved,
          total_exclusions: exclusions.patterns.length,
        }, null, 2) }],
      };
    }

    if (exclude_action === 'include') {
      const removedPatterns: string[] = [];
      const notFound: string[] = [];
      for (const pattern of excludePaths) {
        const normalizedPattern = pattern.replace(/\\/g, '/');
        const index = exclusions.patterns.findIndex(p => p.pattern === normalizedPattern);
        if (index >= 0) {
          exclusions.patterns.splice(index, 1);
          removedPatterns.push(normalizedPattern);
        } else {
          notFound.push(normalizedPattern);
        }
      }
      exclusions.lastModified = new Date().toISOString();
      fs.writeFileSync(exclusionsPath, JSON.stringify(exclusions, null, 2));

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          success: true, action: 'include', project: found.name,
          patterns_removed: removedPatterns,
          not_found: notFound.length > 0 ? notFound : undefined,
          total_exclusions: exclusions.patterns.length,
          next_step: removedPatterns.length > 0 ? 'index({action: "sync", project: "...", full_reindex: true})' : undefined,
        }, null, 2) }],
      };
    }

    return { content: [{ type: 'text' as const, text: `Unknown exclude_action: ${exclude_action}` }], isError: true };
  }

  // ============================================================
  // SERVER LIFECYCLE
  // ============================================================

  async start(): Promise<void> {
    console.error('Starting CodeSeeker MCP server...');
    const storageManager = await getStorageManager();
    console.error(`Storage mode: ${storageManager.getMode()}`);
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('CodeSeeker MCP server running on stdio');
  }

  async shutdown(): Promise<void> {
    console.error('Shutting down CodeSeeker MCP server...');
    try {
      const storageManager = await getStorageManager();
      await storageManager.flushAll();
      console.error('Storage flushed successfully');
      await storageManager.closeAll();
      console.error('Storage closed successfully');
    } catch (error) {
      console.error('Error during storage shutdown:', error);
    }
  }
}

/**
 * Main entry point for MCP server
 */
export async function startMcpServer(): Promise<void> {
  const server = new CodeSeekerMcpServer();
  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      console.error(`Already shutting down, ignoring ${signal}`);
      return;
    }
    isShuttingDown = true;
    console.error(`\nReceived ${signal}, shutting down gracefully...`);

    const forceExitTimeout = setTimeout(() => {
      console.error('Shutdown timeout, forcing exit...');
      process.exit(1);
    }, 5000);

    try {
      await server.shutdown();
      clearTimeout(forceExitTimeout);
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      clearTimeout(forceExitTimeout);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.stdin.on('close', () => shutdown('stdin-close'));
  process.stdin.on('end', () => shutdown('stdin-end'));
  process.stdin.on('error', (err) => {
    console.error(`stdin error: ${err.message}`);
    shutdown('stdin-error');
  });

  if (process.platform === 'win32') {
    process.on('SIGHUP', () => shutdown('SIGHUP'));
    process.stdin.resume();
  }

  process.on('uncaughtException', async (error) => {
    console.error('Uncaught exception:', error);
    await shutdown('uncaughtException');
  });

  process.on('unhandledRejection', async (reason) => {
    console.error('Unhandled rejection:', reason);
    await shutdown('unhandledRejection');
  });

  await server.start();
}
