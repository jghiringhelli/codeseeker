/**
 * CodeSeeker MCP Server
 *
 * Exposes CodeSeeker's semantic search and code analysis capabilities
 * as an MCP (Model Context Protocol) server for use with Claude Desktop
 * and Claude Code.
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
import { SemanticSearchOrchestrator } from '../cli/commands/services/semantic-search-orchestrator';
import { IndexingService } from './indexing-service';
import { CodingStandardsGenerator } from '../cli/services/analysis/coding-standards-generator';
import { LanguageSupportService } from '../cli/services/project/language-support-service';
import { getQueryCacheService, QueryCacheService } from './query-cache-service';
import { DuplicateCodeDetector } from '../cli/services/analysis/deduplication/duplicate-code-detector';
import { SemanticKnowledgeGraph } from '../cli/knowledge/graph/knowledge-graph';

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
 * MCP Server for CodeSeeker
 */
export class CodeSeekerMcpServer {
  private server: McpServer;
  private searchOrchestrator: SemanticSearchOrchestrator;
  private indexingService: IndexingService;
  private languageSupportService: LanguageSupportService;
  private queryCache: QueryCacheService;

  // Background indexing state
  private indexingJobs: Map<string, IndexingJob> = new Map();

  // Mutex for concurrent indexing protection
  private indexingMutex: Set<string> = new Set();

  // Cancellation tokens for running indexing jobs
  private cancellationTokens: Map<string, { cancelled: boolean }> = new Map();

  // Job cleanup interval (clean completed/failed jobs after 1 hour)
  private readonly JOB_TTL_MS = 60 * 60 * 1000; // 1 hour
  private cleanupTimer: NodeJS.Timeout | null = null;

  // Dangerous paths that should never be indexed (security)
  private readonly DANGEROUS_PATHS = [
    // System directories
    '/etc', '/var', '/usr', '/bin', '/sbin', '/lib', '/boot', '/root', '/proc', '/sys', '/dev',
    // Windows system directories
    'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)', 'C:\\ProgramData',
    // User sensitive directories
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

    // Start cleanup timer for old indexing jobs
    this.startJobCleanupTimer();
  }

  /**
   * Start periodic cleanup of completed/failed indexing jobs
   */
  private startJobCleanupTimer(): void {
    // Clean up every 10 minutes
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldJobs();
    }, 10 * 60 * 1000);

    // Ensure timer doesn't prevent process exit
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Clean up completed/failed jobs older than TTL
   */
  private cleanupOldJobs(): void {
    const now = Date.now();
    const jobsToDelete: string[] = [];

    for (const [projectId, job] of this.indexingJobs) {
      // Only clean up non-running jobs
      if (job.status !== 'running' && job.completedAt) {
        const age = now - job.completedAt.getTime();
        if (age > this.JOB_TTL_MS) {
          jobsToDelete.push(projectId);
        }
      }
    }

    for (const projectId of jobsToDelete) {
      this.indexingJobs.delete(projectId);
    }
  }

  /**
   * Validate that a path is safe to index (security)
   * Returns error message if unsafe, null if safe
   */
  private validateProjectPath(projectPath: string): string | null {
    const normalizedPath = path.normalize(projectPath);

    // Check for path traversal attempts
    if (normalizedPath.includes('..')) {
      return 'Path traversal detected: paths with ".." are not allowed';
    }

    // Check for dangerous system directories
    const lowerPath = normalizedPath.toLowerCase();
    for (const dangerous of this.DANGEROUS_PATHS) {
      const lowerDangerous = dangerous.toLowerCase();
      if (lowerPath === lowerDangerous || lowerPath.startsWith(lowerDangerous + path.sep)) {
        return `Security: cannot index system directory "${dangerous}"`;
      }
    }

    // Check path components for sensitive directories
    const pathParts = normalizedPath.split(path.sep);
    for (const part of pathParts) {
      const lowerPart = part.toLowerCase();
      if (lowerPart === '.ssh' || lowerPart === '.gnupg' || lowerPart === '.aws') {
        return `Security: cannot index sensitive directory "${part}"`;
      }
    }

    return null; // Path is safe
  }

  /**
   * Start background indexing for a project
   * Returns immediately, indexing happens asynchronously
   */
  private startBackgroundIndexing(
    projectId: string,
    projectName: string,
    projectPath: string,
    clearExisting: boolean = true
  ): void {
    // Create cancellation token
    const cancellationToken = { cancelled: false };
    this.cancellationTokens.set(projectId, cancellationToken);

    // Create job entry
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

    // Release mutex once job is registered (actual indexing is tracked by job status)
    this.indexingMutex.delete(projectId);

    // Start indexing in background (don't await)
    this.runBackgroundIndexing(job, clearExisting, cancellationToken).catch((error) => {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : String(error);
      job.completedAt = new Date();
      this.cancellationTokens.delete(projectId);
    });
  }

  /**
   * Cancel a running indexing job
   */
  cancelIndexing(projectId: string): boolean {
    const token = this.cancellationTokens.get(projectId);
    if (token) {
      token.cancelled = true;
      return true;
    }
    return false;
  }

  /**
   * Run the actual indexing (called asynchronously)
   */
  private async runBackgroundIndexing(
    job: IndexingJob,
    clearExisting: boolean,
    cancellationToken: { cancelled: boolean }
  ): Promise<void> {
    try {
      const storageManager = await getStorageManager();
      const vectorStore = storageManager.getVectorStore();
      const graphStore = storageManager.getGraphStore();

      // Clear existing data if requested
      if (clearExisting) {
        await vectorStore.deleteByProject(job.projectId);
        await graphStore.deleteByProject(job.projectId);
      }

      // Check for cancellation before starting
      if (cancellationToken.cancelled) {
        job.status = 'failed';
        job.error = 'Indexing cancelled by user';
        job.completedAt = new Date();
        this.cancellationTokens.delete(job.projectId);
        return;
      }

      // Run indexing with progress tracking
      const result = await this.indexingService.indexProject(
        job.projectPath,
        job.projectId,
        (progress) => {
          // Check for cancellation during indexing
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

      // Update job with results
      job.status = 'completed';
      job.completedAt = new Date();
      job.result = {
        filesIndexed: result.filesIndexed,
        chunksCreated: result.chunksCreated,
        nodesCreated: result.nodesCreated,
        edgesCreated: result.edgesCreated,
        durationMs: result.durationMs,
      };

      // Generate coding standards after indexing (if not cancelled)
      if (!cancellationToken.cancelled) {
        try {
          const generator = new CodingStandardsGenerator(vectorStore);
          await generator.generateStandards(job.projectId, job.projectPath);
        } catch {
          // Non-fatal - standards generation is optional
        }
      }

      // Invalidate query cache for this project (full reindex)
      try {
        await this.queryCache.invalidateProject(job.projectId);
      } catch {
        // Non-fatal - cache invalidation is optional
      }

      // Clean up cancellation token
      this.cancellationTokens.delete(job.projectId);
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : String(error);
      job.completedAt = new Date();
      this.cancellationTokens.delete(job.projectId);
    }
  }

  /**
   * Get indexing status for a project
   */
  private getIndexingStatus(projectId: string): IndexingJob | undefined {
    return this.indexingJobs.get(projectId);
  }

  /**
   * Find CodeSeeker project by walking up directory tree from startPath
   * looking for .codeseeker/project.json
   */
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

    // No project found, return original path
    return startPath;
  }

  /**
   * Register all MCP tools
   */
  private registerTools(): void {
    this.registerSearchTool();
    this.registerSearchAndReadTool();
    this.registerReadWithContextTool();
    this.registerShowDependenciesTool();
    this.registerProjectsTool();
    this.registerIndexTool();
    this.registerSyncTool();
    this.registerInstallParsersTool();
    this.registerExcludeTool();
    this.registerFindDuplicatesTool();
    this.registerFindDeadCodeTool();
  }

  /**
   * Tool 1: Semantic search across indexed projects
   */
  private registerSearchTool(): void {
    this.server.registerTool(
      'search',
      {
        description: '**DEFAULT TOOL FOR CODE DISCOVERY** - Use this BEFORE grep/glob for any code search. ' +
          'This semantic search finds code by meaning, not just text patterns. ' +
          'ALWAYS use for: "Where is X handled?", "Find the auth logic", "How does Y work?", "What calls Z?" ' +
          'Only fall back to grep when: you need exact literal strings, regex patterns, or already know the exact file. ' +
          'Why better than grep: finds "user authentication" even if code says "login", "session", "credentials". ' +
          'Examples: ❌ grep -r "damage.*ship" → ✅ search("how ships take damage"). ' +
          'Returns absolute file paths ready for the Read tool. If not indexed, call index first. ' +
          '**IMPORTANT**: Always pass the project parameter with the current working directory to ensure correct index is searched.',
        inputSchema: {
          query: z.string().describe('Natural language query or code snippet (e.g., "validation logic", "error handling")'),
          project: z.string().optional().describe('Project path - RECOMMENDED: pass cwd/workspace root to ensure correct index. Auto-detects if omitted but may select wrong project.'),
          limit: z.number().optional().default(10).describe('Maximum results (default: 10)'),
          search_type: z.enum(['hybrid', 'fts', 'vector', 'graph']).optional().default('hybrid')
            .describe('Search method: hybrid (default), fts, vector, or graph'),
          mode: z.enum(['full', 'exists']).optional().default('full')
            .describe('Mode: "full" returns detailed results, "exists" returns quick summary (faster)'),
        },
      },
      async ({ query, project, limit = 10, search_type = 'hybrid', mode = 'full' }) => {
        try {
          // Get storage manager
          const storageManager = await getStorageManager();
          const projectStore = storageManager.getProjectStore();
          const projects = await projectStore.list();

          // Resolve project path - auto-detect if not provided
          let projectPath: string;
          let projectRecord: typeof projects[0] | undefined;

          if (project) {
            // Try to find by name/path
            projectRecord = projects.find(p =>
              p.name === project ||
              p.path === project ||
              path.basename(p.path) === project ||
              path.resolve(project) === p.path
            );

            if (projectRecord) {
              projectPath = projectRecord.path;
            } else {
              // Use provided path directly and try to find CodeSeeker project
              projectPath = await this.findProjectPath(path.resolve(project));
            }
          } else {
            // No project specified - this is unreliable! MCP servers don't receive client's cwd.
            // We'll try to auto-detect but require explicit parameter when ambiguous.
            if (projects.length === 0) {
              return {
                content: [{
                  type: 'text' as const,
                  text: `No indexed projects found. Use index to index a project first.`,
                }],
                isError: true,
              };
            } else if (projects.length === 1) {
              // Only one project indexed - safe to use it
              projectRecord = projects[0];
              projectPath = projectRecord.path;
            } else {
              // Multiple projects - we can't reliably detect which one
              // Return an error asking for explicit project parameter
              const projectList = projects.map(p => `  - "${p.name}" (${p.path})`).join('\n');
              return {
                content: [{
                  type: 'text' as const,
                  text: `⚠️ Multiple projects indexed. Please specify which project to search:\n\n` +
                    `${projectList}\n\n` +
                    `Example: search({query: "${query}", project: "/path/to/project"})\n\n` +
                    `TIP: Always pass the 'project' parameter with your workspace root path.`,
                }],
                isError: true,
              };
            }
          }

          // Check if project is indexed by checking for embeddings
          const vectorStore = storageManager.getVectorStore();
          if (!projectRecord) {
            projectRecord = await projectStore.findByPath(projectPath);
          }

          if (projectRecord) {
            // Quick check: does this project have any embeddings?
            try {
              const testResults = await vectorStore.searchByText('test', projectRecord.id, 1);
              if (!testResults || testResults.length === 0) {
                return {
                  content: [{
                    type: 'text' as const,
                    text: `⚠️  Project "${path.basename(projectPath)}" found but not indexed.\n\n` +
                      `ACTION REQUIRED: Call index({path: "${projectPath}"}) then retry this search.`,
                  }],
                  isError: true,
                };
              }
            } catch (err) {
              // If search fails, project likely not indexed
              return {
                content: [{
                  type: 'text' as const,
                  text: `⚠️  Project "${path.basename(projectPath)}" needs indexing.\n\n` +
                    `ACTION REQUIRED: Call index({path: "${projectPath}"}) then retry this search.`,
                }],
                isError: true,
              };
            }
          }

          // Check cache first (only for 'full' mode - exists mode is fast enough)
          let results: any[];
          let fromCache = false;
          const cacheProjectId = projectRecord?.id || this.generateProjectId(projectPath);

          if (mode === 'full') {
            const cached = await this.queryCache.get(query, cacheProjectId, search_type);
            if (cached) {
              results = cached.results;
              fromCache = true;
            } else {
              // Perform actual search
              results = await this.searchOrchestrator.performSemanticSearch(query, projectPath);
              // Cache results for future queries
              if (results.length > 0) {
                await this.queryCache.set(query, cacheProjectId, results, search_type);
              }
            }
          } else {
            // exists mode - always search fresh (it's fast)
            results = await this.searchOrchestrator.performSemanticSearch(query, projectPath);
          }

          const limitedResults = results.slice(0, mode === 'exists' ? 5 : limit);

          if (limitedResults.length === 0) {
            // For exists mode, return structured response
            if (mode === 'exists') {
              return {
                content: [{
                  type: 'text' as const,
                  text: JSON.stringify({
                    exists: false,
                    query,
                    project: projectPath,
                    message: 'No matching code found',
                  }, null, 2),
                }],
              };
            }
            return {
              content: [{
                type: 'text' as const,
                text: `No results found for query: "${query}"\n\n` +
                  `This could mean:\n` +
                  `1. No matching code exists for this query\n` +
                  `2. Try different search terms or broader queries\n` +
                  `3. The project may need reindexing if code was recently added`,
              }],
            };
          }

          // For exists mode, return quick summary
          if (mode === 'exists') {
            const topResult = limitedResults[0];
            const absolutePath = path.isAbsolute(topResult.file)
              ? topResult.file
              : path.join(projectPath, topResult.file);

            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  exists: true,
                  query,
                  project: projectPath,
                  total_matches: results.length,
                  top_file: absolutePath,
                  top_score: Math.round(topResult.similarity * 100) / 100,
                  hint: `Use Read tool with "${absolutePath}" to view the file`,
                }, null, 2),
              }],
            };
          }

          // Format full results with absolute paths and match type info
          const formattedResults = limitedResults.map((r, i) => {
            const absolutePath = path.isAbsolute(r.file)
              ? r.file
              : path.join(projectPath, r.file);

            return {
              rank: i + 1,
              file: absolutePath,
              relative_path: r.file,
              score: Math.round(r.similarity * 100) / 100,
              type: r.type,
              // Include match source for better understanding of why file matched
              match_source: r.debug?.matchSource || 'hybrid',
              chunk: r.content.substring(0, 500) + (r.content.length > 500 ? '...' : ''),
              lines: r.lineStart && r.lineEnd ? `${r.lineStart}-${r.lineEnd}` : undefined,
            };
          });

          // Build response with truncation warning if applicable
          const wasLimited = results.length > limit;
          const response: Record<string, unknown> = {
            query,
            project: projectPath,
            total_results: limitedResults.length,
            search_type,
            results: formattedResults,
          };

          // Add cache indicator
          if (fromCache) {
            response.cached = true;
          }

          // Add truncation warning when results were limited
          if (wasLimited) {
            response.truncated = true;
            response.total_available = results.length;
            response.hint = `Showing ${limit} of ${results.length} results. Use limit parameter to see more.`;
          }

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(response, null, 2),
            }],
          };

        } catch (error) {
          return {
            content: [{
              type: 'text' as const,
              text: this.formatErrorMessage('Search', error instanceof Error ? error : String(error), { projectPath: project }),
            }],
            isError: true,
          };
        }
      }
    );
  }

  /**
   * Tool 2: Find and read - combined search + read in one call
   */
  private registerSearchAndReadTool(): void {
    this.server.registerTool(
      'search_and_read',
      {
        description: '**SEARCH + READ IN ONE STEP** - Use when you need to see actual code, not just file paths. ' +
          'Combines search + Read into a single call. Saves a round-trip when you know you\'ll need to read results. ' +
          'Use this instead of search when: implementing something similar, understanding HOW code works, ' +
          'user asks "show me the X code", or you need full context to make changes. ' +
          'Examples: "Show me how damage is calculated" → search_and_read("damage calculation"). ' +
          '"I need to add validation like login" → search_and_read("login form validation"). ' +
          'Use search instead when: you only need file paths, checking if something exists (mode="exists"), ' +
          'or want to see many results before picking one. Returns full file content with line numbers. ' +
          '**IMPORTANT**: Always pass the project parameter with the current working directory to ensure correct index is searched.',
        inputSchema: {
          query: z.string().describe('Natural language query or code snippet (e.g., "validation logic", "error handling")'),
          project: z.string().optional().describe('Project path - RECOMMENDED: pass cwd/workspace root to ensure correct index. Auto-detects if omitted but may select wrong project.'),
          max_files: z.number().optional().default(1).describe('Maximum files to read (default: 1, max: 3)'),
          max_lines: z.number().optional().default(500).describe('Maximum lines per file (default: 500, max: 1000)'),
        },
      },
      async ({ query, project, max_files = 1, max_lines = 500 }) => {
        try {
          // Cap the limits
          const fileLimit = Math.min(max_files, 3);
          const lineLimit = Math.min(max_lines, 1000);

          // Get storage manager
          const storageManager = await getStorageManager();
          const projectStore = storageManager.getProjectStore();
          const projects = await projectStore.list();

          // Resolve project path - auto-detect if not provided
          let projectPath: string;
          let projectRecord: typeof projects[0] | undefined;

          if (project) {
            // Try to find by name/path
            projectRecord = projects.find(p =>
              p.name === project ||
              p.path === project ||
              path.basename(p.path) === project ||
              path.resolve(project) === p.path
            );

            if (projectRecord) {
              projectPath = projectRecord.path;
            } else {
              projectPath = await this.findProjectPath(path.resolve(project));
            }
          } else {
            // No project specified - require explicit parameter when ambiguous
            if (projects.length === 0) {
              return {
                content: [{
                  type: 'text' as const,
                  text: `No indexed projects found. Use index to index a project first.`,
                }],
                isError: true,
              };
            } else if (projects.length === 1) {
              // Only one project indexed - safe to use it
              projectRecord = projects[0];
              projectPath = projectRecord.path;
            } else {
              // Multiple projects - require explicit project parameter
              const projectList = projects.map(p => `  - "${p.name}" (${p.path})`).join('\n');
              return {
                content: [{
                  type: 'text' as const,
                  text: `⚠️ Multiple projects indexed. Please specify which project to search:\n\n` +
                    `${projectList}\n\n` +
                    `Example: search_and_read({query: "${query}", project: "/path/to/project"})\n\n` +
                    `TIP: Always pass the 'project' parameter with your workspace root path.`,
                }],
                isError: true,
              };
            }
          }

          // Check if project is indexed
          const vectorStore = storageManager.getVectorStore();
          if (!projectRecord) {
            projectRecord = await projectStore.findByPath(projectPath);
          }

          if (projectRecord) {
            try {
              const testResults = await vectorStore.searchByText('test', projectRecord.id, 1);
              if (!testResults || testResults.length === 0) {
                return {
                  content: [{
                    type: 'text' as const,
                    text: `⚠️  Project "${path.basename(projectPath)}" found but not indexed.\n\n` +
                      `ACTION REQUIRED: Call index({path: "${projectPath}"}) then retry.`,
                  }],
                  isError: true,
                };
              }
            } catch {
              return {
                content: [{
                  type: 'text' as const,
                  text: `⚠️  Project "${path.basename(projectPath)}" needs indexing.\n\n` +
                    `ACTION REQUIRED: Call index({path: "${projectPath}"}) then retry.`,
                }],
                isError: true,
              };
            }
          }

          // Perform search
          const results = await this.searchOrchestrator.performSemanticSearch(query, projectPath);

          if (results.length === 0) {
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  query,
                  project: projectPath,
                  found: false,
                  message: 'No matching code found. Try different search terms.',
                }, null, 2),
              }],
            };
          }

          // Get unique files (a search may return multiple chunks from the same file)
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

          // Read each file
          const files: Array<{
            file: string;
            relative_path: string;
            score: number;
            file_type: string;
            match_source: string;
            line_count: number;
            content: string;
            truncated: boolean;
          }> = [];

          for (const result of uniqueResults) {
            const absolutePath = path.isAbsolute(result.file)
              ? result.file
              : path.join(projectPath, result.file);

            try {
              if (!fs.existsSync(absolutePath)) {
                continue;
              }

              const content = fs.readFileSync(absolutePath, 'utf-8');
              const lines = content.split('\n');
              const truncated = lines.length > lineLimit;
              const displayLines = truncated ? lines.slice(0, lineLimit) : lines;

              // Add line numbers
              const numberedContent = displayLines
                .map((line, i) => `${String(i + 1).padStart(4)}│ ${line}`)
                .join('\n');

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
            } catch (err) {
              // Skip files we can't read
              continue;
            }
          }

          if (files.length === 0) {
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  query,
                  project: projectPath,
                  found: true,
                  readable: false,
                  message: 'Found matching files but could not read them.',
                }, null, 2),
              }],
            };
          }

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                query,
                project: projectPath,
                files_found: results.length,
                files_returned: files.length,
                results: files,
              }, null, 2),
            }],
          };

        } catch (error) {
          return {
            content: [{
              type: 'text' as const,
              text: this.formatErrorMessage('Find and read', error instanceof Error ? error : String(error), { projectPath: project }),
            }],
            isError: true,
          };
        }
      }
    );
  }

  /**
   * Tool 3: Get file with semantic context
   */
  private registerReadWithContextTool(): void {
    this.server.registerTool(
      'read_with_context',
      {
        description: '**READ FILE WITH RELATED CODE** - Enhanced Read that includes semantically similar code. ' +
          'Use instead of basic Read when: reading a file for the first time, the file references other modules, ' +
          'or you want to discover patterns used elsewhere in the codebase. ' +
          'Examples: Understanding a component → read_with_context("src/Button.tsx") returns Button + similar patterns. ' +
          'Reading a service → read_with_context("src/api.ts") returns api.ts + related implementations. ' +
          'Use basic Read instead when: you just need file contents, already understand the codebase, or making quick edits. ' +
          'Set include_related=false to get just the file without related chunks.',
        inputSchema: {
          filepath: z.string().describe('Path to the file (absolute or relative to project)'),
          include_related: z.boolean().optional().default(true)
            .describe('If true, also return semantically similar chunks from other files'),
          project: z.string().optional().describe('Project name or path (optional, defaults to current directory)'),
        },
      },
      async ({ filepath, include_related = true, project }) => {
        try {
          // Resolve project path
          const storageManager = await getStorageManager();
          const projectStore = storageManager.getProjectStore();

          let projectPath: string;
          if (project) {
            const projects = await projectStore.list();
            const found = projects.find(p =>
              p.name === project ||
              p.path === project ||
              path.basename(p.path) === project
            );
            projectPath = found?.path || process.cwd();
          } else {
            projectPath = process.cwd();
          }

          // Resolve file path
          const absolutePath = path.isAbsolute(filepath)
            ? filepath
            : path.join(projectPath, filepath);

          // Read file content
          if (!fs.existsSync(absolutePath)) {
            return {
              content: [{
                type: 'text' as const,
                text: `File not found: ${absolutePath}`,
              }],
              isError: true,
            };
          }

          const content = fs.readFileSync(absolutePath, 'utf-8');

          // Get related chunks if requested
          let relatedChunks: Array<{ file: string; chunk: string; score: number }> = [];
          if (include_related) {
            // Build a semantic search query from the file content
            // Use the first meaningful lines of code (skip comments, imports, empty lines)
            const lines = content.split('\n');
            const meaningfulLines: string[] = [];

            for (const line of lines) {
              const trimmed = line.trim();
              // Skip empty, comments, and import lines
              if (!trimmed) continue;
              if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;
              if (trimmed.startsWith('import ') || trimmed.startsWith('from ') || trimmed.startsWith('require(')) continue;
              if (trimmed.startsWith('#') && !trimmed.startsWith('##')) continue; // Skip Python comments but not markdown headers
              if (trimmed.startsWith('using ') || trimmed.startsWith('namespace ')) continue; // C#

              meaningfulLines.push(trimmed);
              if (meaningfulLines.length >= 5) break; // Use first 5 meaningful lines
            }

            // Create search query from file name + meaningful content
            const fileName = path.basename(filepath);
            const fileNameQuery = fileName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
            const contentQuery = meaningfulLines.join(' ').substring(0, 200);
            const searchQuery = `${fileNameQuery} ${contentQuery}`.trim();

            const results = await this.searchOrchestrator.performSemanticSearch(
              searchQuery || fileNameQuery, // Fallback to filename if no content
              projectPath
            );

            // Filter out the current file and limit results
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
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                filepath: path.relative(projectPath, absolutePath),
                content: content.length > 10000 ? content.substring(0, 10000) + '\n... (truncated)' : content,
                line_count: content.split('\n').length,
                related_chunks: include_related ? relatedChunks : undefined,
              }, null, 2),
            }],
          };

        } catch (error) {
          return {
            content: [{
              type: 'text' as const,
              text: this.formatErrorMessage('Get file context', error instanceof Error ? error : String(error), { projectPath: project }),
            }],
            isError: true,
          };
        }
      }
    );
  }

  /**
   * Tool 3: Get code relationships from the knowledge graph
   * Uses "Seed + Expand" strategy like the CLI's GraphAnalysisService
   */
  private registerShowDependenciesTool(): void {
    this.server.registerTool(
      'show_dependencies',
      {
        description: '**UNDERSTAND CODE CONNECTIONS** - Use after search to explore how files relate. ' +
          'Maps imports, class hierarchies, function calls, dependencies. Essential for understanding impact of changes. ' +
          'Use when: planning refactors ("what breaks if I change this?"), understanding architecture ("what depends on this?"), ' +
          'tracing data flow ("where does this come from?"), before changing shared code. ' +
          'WORKFLOW: 1) search to find files, 2) pass those paths here via filepaths parameter. ' +
          'Filter with relationship_types: ["imports"], ["calls"], ["extends"] to reduce noise. ' +
          'Use direction="in" to find what USES this file, direction="out" for what this file USES.',
        inputSchema: {
          filepath: z.string().optional().describe('Single file path to explore (prefer filepaths for multiple)'),
          filepaths: z.array(z.string()).optional().describe('PREFERRED: Array of file paths from search results'),
          query: z.string().optional().describe('Fallback: semantic search to find seed files (prefer using filepaths from search)'),
          depth: z.number().optional().default(1).describe('How many relationship hops to traverse (1-3, default: 1). Use 1 for focused results, 2+ can return many nodes.'),
          relationship_types: z.array(z.enum([
            'imports', 'exports', 'calls', 'extends', 'implements', 'contains', 'uses', 'depends_on'
          ])).optional().describe('Filter to specific relationship types (default: all). Recommended: use ["imports"] or ["imports", "calls"] to reduce output.'),
          direction: z.enum(['in', 'out', 'both']).optional().default('both')
            .describe('Direction of relationships: in (what points to this), out (what this points to), both'),
          max_nodes: z.number().optional().default(50).describe('Maximum nodes to return (default: 50). Increase for comprehensive analysis.'),
          project: z.string().optional().describe('Project name or path'),
        },
      },
      async ({ filepath, filepaths, query, depth = 1, relationship_types, direction = 'both', max_nodes = 50, project }) => {
        try {
          const storageManager = await getStorageManager();
          const projectStore = storageManager.getProjectStore();
          const graphStore = storageManager.getGraphStore();

          // Resolve project
          let projectId: string | undefined;
          let projectPath: string;

          if (project) {
            const projects = await projectStore.list();
            const found = projects.find(p =>
              p.name === project ||
              p.path === project ||
              path.basename(p.path) === project
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
              p.path === projectPath ||
              path.basename(p.path) === path.basename(projectPath)
            );
            if (found) {
              projectId = found.id;
              projectPath = found.path;
            }
          }

          if (!projectId) {
            return {
              content: [{
                type: 'text' as const,
                text: 'Project not indexed. Use index first.',
              }],
              isError: true,
            };
          }

          // Determine seed file paths
          let seedFilePaths: string[] = [];

          if (query) {
            // Use semantic search to find seed files
            const searchResults = await this.searchOrchestrator.performSemanticSearch(query, projectPath);
            seedFilePaths = searchResults.slice(0, 5).map(r => r.file.replace(/\\/g, '/'));
          } else if (filepaths && filepaths.length > 0) {
            seedFilePaths = filepaths.map(fp => fp.replace(/\\/g, '/'));
          } else if (filepath) {
            seedFilePaths = [filepath.replace(/\\/g, '/')];
          } else {
            return {
              content: [{
                type: 'text' as const,
                text: 'Please provide filepath, filepaths, or query to explore relationships.',
              }],
              isError: true,
            };
          }

          // Find all nodes for this project and get graph stats
          const allNodes = await graphStore.findNodes(projectId);
          const graphStats = {
            total_nodes: allNodes.length,
            file_nodes: allNodes.filter(n => n.type === 'file').length,
            class_nodes: allNodes.filter(n => n.type === 'class').length,
            function_nodes: allNodes.filter(n => n.type === 'function' || n.type === 'method').length,
          };

          // Find starting nodes using flexible path matching (like CLI's GraphAnalysisService)
          const startNodes = allNodes.filter(n => {
            const normalizedNodePath = n.filePath.replace(/\\/g, '/');
            const nodeRelativePath = (n.properties as { relativePath?: string })?.relativePath?.replace(/\\/g, '/');

            return seedFilePaths.some(seedPath => {
              const normalizedSeedPath = seedPath.replace(/\\/g, '/');
              return (
                // Exact matches
                normalizedNodePath === normalizedSeedPath ||
                nodeRelativePath === normalizedSeedPath ||
                // Ends with (for relative paths)
                normalizedNodePath.endsWith(normalizedSeedPath) ||
                normalizedNodePath.endsWith('/' + normalizedSeedPath) ||
                // Contains match (for partial paths)
                normalizedNodePath.includes('/' + normalizedSeedPath) ||
                // Name match (for class/function names)
                n.name === path.basename(normalizedSeedPath).replace(/\.[^.]+$/, '')
              );
            });
          });

          if (startNodes.length === 0) {
            // List available files in graph with relative paths
            const fileNodes = allNodes.filter(n => n.type === 'file').slice(0, 15);
            const availableFiles = fileNodes.map(n => {
              const relPath = (n.properties as { relativePath?: string })?.relativePath;
              return relPath || path.relative(projectPath, n.filePath);
            });

            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  error: `No graph nodes found for: ${seedFilePaths.join(', ')}`,
                  suggestion: query
                    ? 'The semantic search found files but they are not in the knowledge graph. Try re-indexing.'
                    : 'The file(s) may not be indexed in the knowledge graph.',
                  available_files: availableFiles,
                  tip: 'Use relative paths like "src/mcp/mcp-server.ts" or a query like "authentication middleware"',
                }, null, 2),
              }],
              isError: true,
            };
          }

          // Traverse relationships from all start nodes (Seed + Expand)
          const visitedNodes = new Map<string, any>();
          const collectedEdges: any[] = [];
          let truncated = false;

          const traverse = async (nodeId: string, currentDepth: number) => {
            // Stop if we've reached max_nodes limit
            if (visitedNodes.size >= max_nodes) {
              truncated = true;
              return;
            }

            if (currentDepth > Math.min(depth, 3) || visitedNodes.has(nodeId)) return;

            const node = await graphStore.getNode(nodeId);
            if (!node) return;

            const relPath = (node.properties as { relativePath?: string })?.relativePath;
            visitedNodes.set(nodeId, {
              id: node.id,
              type: node.type,
              name: node.name,
              file: relPath || path.relative(projectPath, node.filePath),
            });

            // Get edges based on direction
            const edges = await graphStore.getEdges(nodeId, direction);

            for (const edge of edges) {
              // Stop if we've reached max_nodes limit
              if (visitedNodes.size >= max_nodes) {
                truncated = true;
                return;
              }

              // Filter by relationship type if specified
              if (relationship_types && relationship_types.length > 0) {
                if (!relationship_types.includes(edge.type as any)) continue;
              }

              collectedEdges.push({
                from: edge.source,
                to: edge.target,
                type: edge.type,
              });

              // Continue traversal
              const nextNodeId = edge.source === nodeId ? edge.target : edge.source;
              await traverse(nextNodeId, currentDepth + 1);
            }
          };

          // Traverse from ALL start nodes (multiple seeds)
          for (const startNode of startNodes) {
            if (visitedNodes.size >= max_nodes) {
              truncated = true;
              break;
            }
            await traverse(startNode.id, 1);
          }

          // Format output
          const nodes = Array.from(visitedNodes.values());
          const uniqueEdges = collectedEdges.filter((e, i, arr) =>
            arr.findIndex(x => x.from === e.from && x.to === e.to && x.type === e.type) === i
          );

          // Create a summary
          const summary: Record<string, any> = {
            graph_stats: graphStats,
            seed_files: startNodes.map(n => ({
              name: n.name,
              type: n.type,
              file: (n.properties as { relativePath?: string })?.relativePath || path.relative(projectPath, n.filePath),
            })),
            traversal: {
              depth_requested: depth,
              direction,
              relationship_filters: relationship_types || 'all',
              seed_method: query ? 'semantic_search' : (filepaths ? 'multiple_files' : 'single_file'),
              max_nodes,
            },
            results: {
              seed_nodes: startNodes.length,
              nodes_found: nodes.length,
              relationships_found: uniqueEdges.length,
              truncated,
            },
            nodes: nodes.map(n => ({
              name: n.name,
              type: n.type,
              file: n.file,
            })),
            relationships: uniqueEdges.map(e => {
              const fromNode = visitedNodes.get(e.from);
              const toNode = visitedNodes.get(e.to);
              return {
                type: e.type,
                from: fromNode?.name || e.from,
                to: toNode?.name || e.to,
              };
            }),
          };

          // Add truncation warning and recommendations if results were limited
          if (truncated) {
            summary.truncated_warning = {
              message: `Results truncated at ${max_nodes} nodes.`,
              recommendations: [
                relationship_types ? null : 'Add relationship_types filter (e.g., ["imports"])',
                depth > 1 ? 'Reduce depth to 1' : null,
                `Increase max_nodes (current: ${max_nodes})`,
              ].filter(Boolean),
            };
          }

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(summary, null, 2),
            }],
          };

        } catch (error) {
          return {
            content: [{
              type: 'text' as const,
              text: this.formatErrorMessage('Get code relationships', error instanceof Error ? error : String(error), { projectPath: project }),
            }],
            isError: true,
          };
        }
      }
    );
  }

  /**
   * Tool 4: List indexed projects
   */
  private registerProjectsTool(): void {
    this.server.registerTool(
      'projects',
      {
        description: 'List all indexed projects with their metadata. ' +
          'Returns project names, paths, indexed file counts, and last index timestamps. ' +
          'Use to discover available projects before running search or show_dependencies. ' +
          'Example: projects() shows all projects ready for semantic search.',
      },
      async () => {
        try {
          const storageManager = await getStorageManager();
          const projectStore = storageManager.getProjectStore();
          const vectorStore = storageManager.getVectorStore();

          const projects = await projectStore.list();

          if (projects.length === 0) {
            return {
              content: [{
                type: 'text' as const,
                text: 'No projects indexed. Use index to add a project.',
              }],
            };
          }

          // Get file and chunk counts for each project, plus indexing status
          const projectsWithCounts = await Promise.all(
            projects.map(async (p) => {
              const fileCount = await vectorStore.countFiles(p.id);
              const chunkCount = await vectorStore.count(p.id);

              // Check for background indexing status
              const indexingStatus = this._getIndexingStatusForProject(p.id);

              const projectInfo: Record<string, unknown> = {
                name: p.name,
                path: p.path,
                files: fileCount,
                chunks: chunkCount,
                last_indexed: p.updatedAt.toISOString(),
              };

              // Add indexing status if job exists
              if (indexingStatus) {
                Object.assign(projectInfo, indexingStatus);
              }

              return projectInfo;
            })
          );

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                storage_mode: storageManager.getMode(),
                total_projects: projects.length,
                projects: projectsWithCounts,
              }, null, 2),
            }],
          };

        } catch (error) {
          return {
            content: [{
              type: 'text' as const,
              text: this.formatErrorMessage('List projects', error instanceof Error ? error : String(error)),
            }],
            isError: true,
          };
        }
      }
    );
  }

  /**
   * Tool 5: Index a project (with proper embeddings and knowledge graph)
   * NOW RUNS IN BACKGROUND to prevent MCP timeouts
   */
  private registerIndexTool(): void {
    this.server.registerTool(
      'index',
      {
        description: 'Index a project directory for semantic search and knowledge graph. ' +
          'Scans code, documentation, configs, and other text files. Generates vector embeddings and extracts code relationships. ' +
          'Run once per project, then use sync for incremental updates. ' +
          'Example: index({path: "/home/user/my-app"}) indexes all files in my-app.' +
          '\n\nNOTE: Indexing runs in BACKGROUND to prevent timeouts. Use projects() to check indexing status.',
        inputSchema: {
          path: z.string().describe('Absolute path to the project directory'),
          name: z.string().optional().describe('Project name (defaults to directory name)'),
        },
      },
      async (args) => {
        try {
          const { path: projectPath, name } = args;

          // Validate path
          const absolutePath = path.isAbsolute(projectPath)
            ? projectPath
            : path.resolve(projectPath);

          // Security: validate path is safe to index
          const pathError = this.validateProjectPath(absolutePath);
          if (pathError) {
            return {
              content: [{
                type: 'text' as const,
                text: pathError,
              }],
              isError: true,
            };
          }

          if (!fs.existsSync(absolutePath)) {
            return {
              content: [{
                type: 'text' as const,
                text: `Directory not found: ${absolutePath}`,
              }],
              isError: true,
            };
          }

          if (!fs.statSync(absolutePath).isDirectory()) {
            return {
              content: [{
                type: 'text' as const,
                text: `Not a directory: ${absolutePath}`,
              }],
              isError: true,
            };
          }

          const projectName = name || path.basename(absolutePath);
          const projectId = this.generateProjectId(absolutePath);

          // Mutex: prevent concurrent indexing of same project (race condition protection)
          if (this.indexingMutex.has(projectId)) {
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  status: 'already_indexing',
                  project_name: projectName,
                  project_path: absolutePath,
                  message: 'Indexing request already being processed. Please wait.',
                }, null, 2),
              }],
            };
          }

          // Check if already indexing (from job status)
          const existingJob = this.getIndexingStatus(projectId);
          if (existingJob?.status === 'running') {
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  status: 'already_indexing',
                  project_name: projectName,
                  project_path: absolutePath,
                  progress: existingJob.progress,
                  message: 'Indexing already in progress. Use projects() to check status.',
                }, null, 2),
              }],
            };
          }

          // Acquire mutex before starting
          this.indexingMutex.add(projectId);

          // Get storage and create project entry
          const storageManager = await getStorageManager();
          const projectStore = storageManager.getProjectStore();

          // Create or update project
          await projectStore.upsert({
            id: projectId,
            name: projectName,
            path: absolutePath,
            metadata: { indexedAt: new Date().toISOString(), indexing: true },
          });

          // Delete coding standards file (will be regenerated)
          const codingStandardsPath = path.join(absolutePath, '.codeseeker', 'coding-standards.json');
          if (fs.existsSync(codingStandardsPath)) {
            try { fs.unlinkSync(codingStandardsPath); } catch { /* ignore */ }
          }

          // Start background indexing (returns immediately)
          this.startBackgroundIndexing(projectId, projectName, absolutePath, true);

          // Return immediately with "started" status
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                status: 'indexing_started',
                project_name: projectName,
                project_path: absolutePath,
                message: 'Indexing started in background. Search will work with partial results. Use projects() to check progress.',
              }, null, 2),
            }],
          };

          // OLD SYNCHRONOUS CODE REMOVED - was causing MCP timeouts
          // Now handled by startBackgroundIndexing()

        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ error: message }, null, 2),
            }],
            isError: true,
          };
        }
      }
    );
  }

  // Remove the old synchronous indexing response builder (now in background)
  private _unusedOldIndexingResponse(): void {
    // This is a placeholder to mark where old code was removed
    // The synchronous indexing logic is now in runBackgroundIndexing()
  }

  /**
   * Tool 5b: Check indexing status (part of projects output now)
   */
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
   * Tool 6: Notify file changes for incremental updates
   */
  private registerSyncTool(): void {
    this.server.registerTool(
      'sync',
      {
        description: '**KEEP INDEX IN SYNC** - Call this after creating, editing, or deleting files. ' +
          'IMPORTANT: If search returns stale results or grep finds content not in search results, ' +
          'call this tool immediately to sync. Fast incremental updates (~100-500ms per file). ' +
          'Use after: Edit/Write tool, file deletions, or when search results seem outdated. ' +
          'For large changes (git pull, branch switch, many files), use full_reindex: true instead.',
        inputSchema: {
          project: z.string().optional().describe('Project name or path (optional - auto-detects from indexed projects)'),
          changes: z.array(z.object({
            type: z.enum(['created', 'modified', 'deleted']),
            path: z.string().describe('Path to the changed file'),
          })).optional().describe('Array of file changes (not needed if full_reindex is true)'),
          full_reindex: z.boolean().optional().default(false)
            .describe('Trigger a complete re-index of the project. Use after git pull, branch switch, or major changes.'),
        },
      },
      async ({ project, changes, full_reindex = false }: { project?: string; changes?: Array<{type: 'created' | 'modified' | 'deleted'; path: string}>; full_reindex?: boolean }) => {
        try {
          const startTime = Date.now();

          // Resolve project
          const storageManager = await getStorageManager();
          const projectStore = storageManager.getProjectStore();
          const vectorStore = storageManager.getVectorStore();
          const graphStore = storageManager.getGraphStore();

          const projects = await projectStore.list();

          // Auto-detect project if not provided
          let found: typeof projects[0] | undefined;
          if (project) {
            found = projects.find(p =>
              p.name === project ||
              p.path === project ||
              path.basename(p.path) === project ||
              path.resolve(project) === p.path
            );
          } else {
            // Try to find project from file paths in changes
            if (changes && changes.length > 0) {
              const firstPath = changes[0].path;
              if (path.isAbsolute(firstPath)) {
                found = projects.find(p => firstPath.startsWith(p.path));
              }
            }
            // If still not found, use single project if only one exists
            if (!found && projects.length === 1) {
              found = projects[0];
            }
          }

          if (!found) {
            return {
              content: [{
                type: 'text' as const,
                text: project
                  ? `Project not found: ${project}. Use projects to see available projects.`
                  : `Could not auto-detect project. Specify project name or use absolute paths in changes. Available: ${projects.map(p => p.name).join(', ')}`,
              }],
              isError: true,
            };
          }

          // Full reindex mode - NOW RUNS IN BACKGROUND
          if (full_reindex) {
            // Check if already indexing
            const existingJob = this.getIndexingStatus(found.id);
            if (existingJob?.status === 'running') {
              return {
                content: [{
                  type: 'text' as const,
                  text: JSON.stringify({
                    status: 'already_indexing',
                    project: found.name,
                    progress: existingJob.progress,
                    message: 'Full reindex already in progress. Use projects() to check status.',
                  }, null, 2),
                }],
              };
            }

            // Delete coding standards file (will be regenerated)
            const codingStandardsPath = path.join(found.path, '.codeseeker', 'coding-standards.json');
            if (fs.existsSync(codingStandardsPath)) {
              try { fs.unlinkSync(codingStandardsPath); } catch { /* ignore */ }
            }

            // Start background indexing (returns immediately)
            this.startBackgroundIndexing(found.id, found.name, found.path, true);

            // Return immediately with "started" status
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  status: 'reindex_started',
                  mode: 'full_reindex',
                  project: found.name,
                  message: 'Full reindex started in background. Search will work with partial results. Use projects() to check progress.',
                }, null, 2),
              }],
            };
          }

          // Incremental update mode - use IndexingService
          if (!changes || changes.length === 0) {
            return {
              content: [{
                type: 'text' as const,
                text: 'No changes provided. Either pass file changes or set full_reindex: true.',
              }],
              isError: true,
            };
          }

          let chunksCreated = 0;
          let chunksDeleted = 0;
          let filesProcessed = 0;
          let filesSkipped = 0;
          const errors: string[] = [];

          for (const change of changes) {
            const relativePath = path.isAbsolute(change.path)
              ? path.relative(found.path, change.path)
              : change.path;

            try {
              if (change.type === 'deleted') {
                // Remove chunks for deleted file using IndexingService
                const result = await this.indexingService.deleteFile(found.id, relativePath);
                if (result.success) {
                  chunksDeleted += result.deleted;
                  filesProcessed++;
                }
              } else {
                // created or modified: re-index the file using IndexingService
                // Uses two-stage change detection: mtime (~0.1ms) then hash (~1-5ms)
                const result = await this.indexingService.indexSingleFile(found.path, relativePath, found.id);
                if (result.success) {
                  if (result.skipped) {
                    filesSkipped++;
                  } else {
                    chunksCreated += result.chunksCreated;
                    filesProcessed++;
                  }
                }
              }
            } catch (error) {
              const msg = error instanceof Error ? error.message : String(error);
              errors.push(`${change.path}: ${msg}`);
            }
          }

          // Update coding standards if pattern-related files changed
          try {
            const changedPaths = changes.map(c => c.path);
            const generator = new CodingStandardsGenerator(vectorStore);
            await generator.updateStandards(found.id, found.path, changedPaths);
          } catch (error) {
            // Don't fail the whole operation if standards update fails
            console.error('Failed to update coding standards:', error);
          }

          // Invalidate query cache for this project (files changed)
          let cacheInvalidated = 0;
          try {
            cacheInvalidated = await this.queryCache.invalidateProject(found.id);
          } catch (error) {
            // Don't fail if cache invalidation fails
            console.error('Failed to invalidate query cache:', error);
          }

          const duration = Date.now() - startTime;

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                success: errors.length === 0,
                mode: 'incremental',
                project: found.name,
                changes_processed: changes.length,
                files_reindexed: filesProcessed,
                files_skipped: filesSkipped > 0 ? filesSkipped : undefined,
                chunks_created: chunksCreated,
                chunks_deleted: chunksDeleted,
                cache_invalidated: cacheInvalidated > 0 ? cacheInvalidated : undefined,
                duration_ms: duration,
                note: filesSkipped > 0 ? `${filesSkipped} file(s) unchanged (skipped via mtime/hash check)` : undefined,
                errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
              }, null, 2),
            }],
          };

        } catch (error) {
          return {
            content: [{
              type: 'text' as const,
              text: this.formatErrorMessage('Process file changes', error instanceof Error ? error : String(error), { projectPath: project }),
            }],
            isError: true,
          };
        }
      }
    );

    // standards - Get auto-detected coding standards
    this.server.registerTool(
      'standards',
      {
        description: 'Get auto-detected coding patterns and standards for a project. ' +
          'Returns validation patterns, error handling patterns, logging patterns, and testing patterns ' +
          'discovered from the codebase. Use this to write code that follows project conventions. ' +
          'Example: standards({project: "my-app", category: "validation"})',
        inputSchema: {
          project: z.string().describe('Project name or path'),
          category: z.enum(['validation', 'error-handling', 'logging', 'testing', 'all']).optional().default('all')
            .describe('Category of standards to retrieve (default: all)'),
        },
      },
      async ({ project, category = 'all' }) => {
        try {
          // Resolve project
          const storageManager = await getStorageManager();
          const projectStore = storageManager.getProjectStore();
          const vectorStore = storageManager.getVectorStore();

          const projects = await projectStore.list();
          const found = projects.find(p =>
            p.name === project ||
            p.path === project ||
            path.basename(p.path) === project
          );

          if (!found) {
            return {
              content: [{
                type: 'text' as const,
                text: `Project not found: ${project}. Use projects to see available projects.`,
              }],
              isError: true,
            };
          }

          // Try to load standards file
          const standardsPath = path.join(found.path, '.codeseeker', 'coding-standards.json');
          let standardsContent: string;

          try {
            standardsContent = fs.readFileSync(standardsPath, 'utf-8');
          } catch (error) {
            // Standards file doesn't exist - generate it now
            const generator = new CodingStandardsGenerator(vectorStore);
            await generator.generateStandards(found.id, found.path);

            // Try reading again
            try {
              standardsContent = fs.readFileSync(standardsPath, 'utf-8');
            } catch {
              return {
                content: [{
                  type: 'text' as const,
                  text: 'No coding standards detected yet. The project may need to be indexed first using index.',
                }],
                isError: true,
              };
            }
          }

          const standards = JSON.parse(standardsContent);

          // Filter by category if requested
          let result = standards;
          if (category !== 'all') {
            result = {
              ...standards,
              standards: {
                [category]: standards.standards[category] || {}
              }
            };
          }

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(result, null, 2),
            }],
          };

        } catch (error) {
          return {
            content: [{
              type: 'text' as const,
              text: this.formatErrorMessage('Get coding standards', error instanceof Error ? error : String(error), { projectPath: project }),
            }],
            isError: true,
          };
        }
      }
    );
  }

  /**
   * Tool 7: Install language support (Tree-sitter parsers)
   */
  private registerInstallParsersTool(): void {
    this.server.registerTool(
      'install_parsers',
      {
        description: 'Analyze project languages and install Tree-sitter parsers for better code understanding. ' +
          'Detects which programming languages are used in a project and installs enhanced parsers. ' +
          'Enhanced parsers provide better AST extraction for imports, classes, functions, and relationships. ' +
          'Example: install_parsers({project: "/path/to/project"}) to auto-detect and install. ' +
          'Example: install_parsers({languages: ["python", "java"]}) to install specific parsers.',
        inputSchema: {
          project: z.string().optional().describe('Project path to analyze for languages (auto-detects needed parsers)'),
          languages: z.array(z.string()).optional().describe('Specific languages to install parsers for (e.g., ["python", "java", "csharp"])'),
          list_available: z.boolean().optional().default(false).describe('List all available language parsers and their status'),
        },
      },
      async ({ project, languages, list_available = false }) => {
        try {
          // List mode - show available parsers
          if (list_available) {
            const parsers = await this.languageSupportService.checkInstalledParsers();
            const installed = parsers.filter(p => p.installed);
            const available = parsers.filter(p => !p.installed);

            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  installed_parsers: installed.map(p => ({
                    language: p.language,
                    extensions: p.extensions,
                    quality: p.quality,
                    description: p.description,
                  })),
                  available_parsers: available.map(p => ({
                    language: p.language,
                    extensions: p.extensions,
                    npm_package: p.npmPackage,
                    quality: p.quality,
                    description: p.description,
                  })),
                  install_command: available.length > 0
                    ? `Use install_parsers({languages: [${available.slice(0, 3).map(p => `"${p.language.toLowerCase()}"`).join(', ')}]})`
                    : 'All parsers are already installed!',
                }, null, 2),
              }],
            };
          }

          // Install specific languages
          if (languages && languages.length > 0) {
            const result = await this.languageSupportService.installLanguageParsers(languages);

            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  success: result.success,
                  installed: result.installed,
                  failed: result.failed.length > 0 ? result.failed : undefined,
                  message: result.message,
                  next_step: result.success
                    ? 'Reindex your project to use the new parsers: sync({project: "...", full_reindex: true})'
                    : 'Check the errors above and try again.',
                }, null, 2),
              }],
            };
          }

          // Analyze project and suggest parsers
          if (project) {
            const projectPath = path.isAbsolute(project)
              ? project
              : path.resolve(project);

            if (!fs.existsSync(projectPath)) {
              return {
                content: [{
                  type: 'text' as const,
                  text: `Directory not found: ${projectPath}`,
                }],
                isError: true,
              };
            }

            const analysis = await this.languageSupportService.analyzeProjectLanguages(projectPath);

            // If there are missing parsers, offer to install them
            const missingLanguages = analysis.missingParsers.map(p => p.language.toLowerCase());

            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  project: projectPath,
                  detected_languages: analysis.detectedLanguages,
                  installed_parsers: analysis.installedParsers,
                  missing_parsers: analysis.missingParsers.map(p => ({
                    language: p.language,
                    npm_package: p.npmPackage,
                    quality: p.quality,
                    description: p.description,
                  })),
                  recommendations: analysis.recommendations,
                  install_command: missingLanguages.length > 0
                    ? `Use install_parsers({languages: [${missingLanguages.map(l => `"${l}"`).join(', ')}]}) to install enhanced parsers`
                    : 'All detected languages have parsers installed!',
                }, null, 2),
              }],
            };
          }

          // No arguments - show usage
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                usage: {
                  analyze_project: 'install_parsers({project: "/path/to/project"}) - Detect languages and suggest parsers',
                  install_specific: 'install_parsers({languages: ["python", "java"]}) - Install parsers for specific languages',
                  list_available: 'install_parsers({list_available: true}) - Show all available parsers',
                },
                supported_languages: [
                  'TypeScript (bundled)', 'JavaScript (bundled)',
                  'Python', 'Java', 'C#', 'Go', 'Rust',
                  'C', 'C++', 'Ruby', 'PHP', 'Swift', 'Kotlin'
                ],
              }, null, 2),
            }],
          };

        } catch (error) {
          return {
            content: [{
              type: 'text' as const,
              text: this.formatErrorMessage('Manage language support', error instanceof Error ? error : String(error), { projectPath: project }),
            }],
            isError: true,
          };
        }
      }
    );
  }

  /**
   * Tool 8: Manage index exclusions/inclusions dynamically
   * Allows Claude to exclude files that shouldn't be indexed (like Unity's Library folder)
   * and include files that were wrongly excluded
   */
  private registerExcludeTool(): void {
    this.server.registerTool(
      'exclude',
      {
        description: 'Dynamically manage which files are included or excluded from the index. ' +
          'Use this to exclude files that shouldn\'t be searched (e.g., Library/, build outputs, generated files) ' +
          'or include files that were incorrectly excluded. Exclusions persist in .codeseeker/exclusions.json. ' +
          'Example: exclude({action: "exclude", project: "my-app", paths: ["Library/**", "Temp/**"]}) ' +
          'to exclude Unity folders. Changes take effect immediately - excluded files are removed from the index.',
        inputSchema: {
          action: z.enum(['exclude', 'include', 'list']).describe(
            'Action: "exclude" adds paths to exclusion list and removes from index, ' +
            '"include" removes paths from exclusion list (they will be indexed on next reindex), ' +
            '"list" shows current exclusions'
          ),
          project: z.string().describe('Project name or path'),
          paths: z.array(z.string()).optional().describe(
            'File paths or glob patterns to exclude/include (e.g., ["Library/**", "Temp/**", "*.generated.cs"]). ' +
            'Required for exclude/include actions.'
          ),
          reason: z.string().optional().describe('Optional reason for the exclusion (for documentation)'),
        },
      },
      async ({ action, project, paths, reason }) => {
        try {
          // Resolve project
          const storageManager = await getStorageManager();
          const projectStore = storageManager.getProjectStore();
          const vectorStore = storageManager.getVectorStore();
          const graphStore = storageManager.getGraphStore();

          const projects = await projectStore.list();
          const found = projects.find(p =>
            p.name === project ||
            p.path === project ||
            path.basename(p.path) === project
          );

          if (!found) {
            return {
              content: [{
                type: 'text' as const,
                text: `Project not found: ${project}. Use projects to see available projects.`,
              }],
              isError: true,
            };
          }

          // Load or create exclusions file
          const exclusionsPath = path.join(found.path, '.codeseeker', 'exclusions.json');
          let exclusions: {
            patterns: Array<{ pattern: string; reason?: string; addedAt: string }>;
            lastModified: string;
          } = {
            patterns: [],
            lastModified: new Date().toISOString()
          };

          // Ensure .codeseeker directory exists
          const codeseekerDir = path.join(found.path, '.codeseeker');
          if (!fs.existsSync(codeseekerDir)) {
            fs.mkdirSync(codeseekerDir, { recursive: true });
          }

          // Load existing exclusions
          if (fs.existsSync(exclusionsPath)) {
            try {
              exclusions = JSON.parse(fs.readFileSync(exclusionsPath, 'utf-8'));
            } catch {
              // Invalid JSON, start fresh
            }
          }

          // Handle list action
          if (action === 'list') {
            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  project: found.name,
                  project_path: found.path,
                  exclusions_file: exclusionsPath,
                  total_exclusions: exclusions.patterns.length,
                  patterns: exclusions.patterns,
                  last_modified: exclusions.lastModified,
                  usage: {
                    exclude: 'exclude({action: "exclude", project: "...", paths: ["pattern/**"]})',
                    include: 'exclude({action: "include", project: "...", paths: ["pattern/**"]})',
                  }
                }, null, 2),
              }],
            };
          }

          // Validate paths for exclude/include
          if (!paths || paths.length === 0) {
            return {
              content: [{
                type: 'text' as const,
                text: 'No paths provided. Please specify paths or patterns to exclude/include.',
              }],
              isError: true,
            };
          }

          // Handle exclude action
          if (action === 'exclude') {
            const addedPatterns: string[] = [];
            const alreadyExcluded: string[] = [];
            let filesRemoved = 0;

            for (const pattern of paths) {
              // Normalize pattern (use forward slashes)
              const normalizedPattern = pattern.replace(/\\/g, '/');

              // Check if already excluded
              if (exclusions.patterns.some(p => p.pattern === normalizedPattern)) {
                alreadyExcluded.push(normalizedPattern);
                continue;
              }

              // Add to exclusions
              exclusions.patterns.push({
                pattern: normalizedPattern,
                reason: reason,
                addedAt: new Date().toISOString()
              });
              addedPatterns.push(normalizedPattern);

              // Remove matching files from the vector store and graph
              // Search for files matching this pattern
              const results = await vectorStore.searchByText(normalizedPattern, found.id, 1000);

              for (const result of results) {
                const filePath = result.document.filePath.replace(/\\/g, '/');

                // Check if file matches the exclusion pattern
                if (this.matchesExclusionPattern(filePath, normalizedPattern)) {
                  // Delete from vector store
                  await vectorStore.delete(result.document.id);
                  filesRemoved++;
                }
              }
            }

            // Save exclusions
            exclusions.lastModified = new Date().toISOString();
            fs.writeFileSync(exclusionsPath, JSON.stringify(exclusions, null, 2));

            // Flush to persist deletions
            await vectorStore.flush();

            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  success: true,
                  action: 'exclude',
                  project: found.name,
                  patterns_added: addedPatterns,
                  already_excluded: alreadyExcluded.length > 0 ? alreadyExcluded : undefined,
                  files_removed_from_index: filesRemoved,
                  total_exclusions: exclusions.patterns.length,
                  message: addedPatterns.length > 0
                    ? `Added ${addedPatterns.length} exclusion pattern(s). ${filesRemoved} file chunk(s) removed from index.`
                    : 'No new patterns added (all were already excluded).',
                  note: 'Excluded files will not appear in search results. Use action: "include" to re-enable indexing.'
                }, null, 2),
              }],
            };
          }

          // Handle include action (remove from exclusions)
          if (action === 'include') {
            const removedPatterns: string[] = [];
            const notFound: string[] = [];

            for (const pattern of paths) {
              const normalizedPattern = pattern.replace(/\\/g, '/');

              const index = exclusions.patterns.findIndex(p => p.pattern === normalizedPattern);
              if (index >= 0) {
                exclusions.patterns.splice(index, 1);
                removedPatterns.push(normalizedPattern);
              } else {
                notFound.push(normalizedPattern);
              }
            }

            // Save exclusions
            exclusions.lastModified = new Date().toISOString();
            fs.writeFileSync(exclusionsPath, JSON.stringify(exclusions, null, 2));

            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify({
                  success: true,
                  action: 'include',
                  project: found.name,
                  patterns_removed: removedPatterns,
                  not_found: notFound.length > 0 ? notFound : undefined,
                  total_exclusions: exclusions.patterns.length,
                  message: removedPatterns.length > 0
                    ? `Removed ${removedPatterns.length} exclusion pattern(s). ` +
                      `Files matching these patterns will be indexed on next reindex.`
                    : 'No patterns were removed (none matched).',
                  next_step: removedPatterns.length > 0
                    ? 'Run sync({project: "...", full_reindex: true}) to index the previously excluded files.'
                    : undefined
                }, null, 2),
              }],
            };
          }

          // Should not reach here
          return {
            content: [{
              type: 'text' as const,
              text: `Unknown action: ${action}`,
            }],
            isError: true,
          };

        } catch (error) {
          return {
            content: [{
              type: 'text' as const,
              text: this.formatErrorMessage('Manage index exclusions', error instanceof Error ? error : String(error), { projectPath: project }),
            }],
            isError: true,
          };
        }
      }
    );
  }

  /**
   * Check if a file path matches an exclusion pattern
   * Supports glob-like patterns: ** for any path, * for any segment
   */
  private matchesExclusionPattern(filePath: string, pattern: string): boolean {
    // Normalize paths
    const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
    const normalizedPattern = pattern.replace(/\\/g, '/').toLowerCase();

    // Direct match
    if (normalizedPath === normalizedPattern) {
      return true;
    }

    // Convert glob pattern to regex
    // ** matches any path including slashes
    // * matches any characters except slashes
    let regexPattern = normalizedPattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')  // Escape special regex chars except * and ?
      .replace(/\*\*/g, '<<GLOBSTAR>>')      // Temporarily replace **
      .replace(/\*/g, '[^/]*')               // * matches anything except /
      .replace(/<<GLOBSTAR>>/g, '.*')        // ** matches anything including /
      .replace(/\?/g, '.');                  // ? matches any single char

    // Check if pattern should match at start
    if (!regexPattern.startsWith('.*')) {
      // Pattern like "Library/**" should match "Library/foo" but not "src/Library/foo"
      // Unless it's a more specific path pattern
      if (normalizedPattern.includes('/')) {
        regexPattern = `(^|/)${regexPattern}`;
      } else {
        regexPattern = `(^|/)${regexPattern}`;
      }
    }

    // Allow matching at end without trailing slash
    regexPattern = `${regexPattern}(/.*)?$`;

    try {
      const regex = new RegExp(regexPattern);
      return regex.test(normalizedPath);
    } catch {
      // If regex fails, try simple includes check
      return normalizedPath.includes(normalizedPattern.replace(/\*/g, ''));
    }
  }

  /**
   * Generate a deterministic project ID from path
   */
  private generateProjectId(projectPath: string): string {
    return crypto.createHash('md5').update(projectPath).digest('hex');
  }

  /**
   * Generate actionable error message based on error type
   */
  private formatErrorMessage(operation: string, error: Error | string, context?: { projectPath?: string }): string {
    const message = error instanceof Error ? error.message : String(error);
    const lowerMessage = message.toLowerCase();

    // Common error patterns with actionable guidance
    if (lowerMessage.includes('enoent') || lowerMessage.includes('not found') || lowerMessage.includes('no such file')) {
      return `${operation} failed: File or directory not found.\n\n` +
        `TROUBLESHOOTING:\n` +
        `• Verify the path exists: ${context?.projectPath || 'the specified path'}\n` +
        `• Check for typos in the path\n` +
        `• Ensure you have read permissions`;
    }

    if (lowerMessage.includes('eacces') || lowerMessage.includes('permission denied')) {
      return `${operation} failed: Permission denied.\n\n` +
        `TROUBLESHOOTING:\n` +
        `• Check file/folder permissions\n` +
        `• Run with appropriate access rights\n` +
        `• Avoid system-protected directories`;
    }

    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
      return `${operation} failed: Operation timed out.\n\n` +
        `TROUBLESHOOTING:\n` +
        `• Try again - the operation may complete on retry\n` +
        `• For large projects, indexing runs in background - check status with projects()\n` +
        `• Check network connectivity if using server storage mode`;
    }

    if (lowerMessage.includes('connection') || lowerMessage.includes('econnrefused') || lowerMessage.includes('network')) {
      return `${operation} failed: Connection error.\n\n` +
        `TROUBLESHOOTING:\n` +
        `• Check if storage services are running (if using server mode)\n` +
        `• Verify network connectivity\n` +
        `• Consider switching to embedded mode for local development`;
    }

    if (lowerMessage.includes('not indexed') || lowerMessage.includes('no project')) {
      const pathHint = context?.projectPath ? `index({path: "${context.projectPath}"})` : 'index({path: "/path/to/project"})';
      return `${operation} failed: Project not indexed.\n\n` +
        `ACTION REQUIRED:\n` +
        `• First run: ${pathHint}\n` +
        `• Then retry your search\n` +
        `• Use projects() to see indexed projects`;
    }

    if (lowerMessage.includes('out of memory') || lowerMessage.includes('heap')) {
      return `${operation} failed: Out of memory.\n\n` +
        `TROUBLESHOOTING:\n` +
        `• Try indexing fewer files at once\n` +
        `• Use exclude() to skip large directories (e.g., node_modules, dist)\n` +
        `• Increase Node.js memory: NODE_OPTIONS=--max-old-space-size=4096`;
    }

    // Default: include original message with generic guidance
    return `${operation} failed: ${message}\n\n` +
      `TROUBLESHOOTING:\n` +
      `• Check the error message above for details\n` +
      `• Use projects() to verify project status\n` +
      `• Try sync({project: "...", full_reindex: true}) if index seems corrupted`;
  }

  /**
   * Tool 10: Find duplicate code patterns
   */
  private registerFindDuplicatesTool(): void {
    this.server.registerTool(
      'find_duplicates',
      {
        description: '**FIND DUPLICATE CODE** - Detects duplicate and similar code patterns using semantic analysis. ' +
          'Finds: exact copies, semantically similar code (same logic, different names), and structurally similar patterns. ' +
          'Use when: cleaning up codebase, finding copy-paste code, reducing maintenance burden. ' +
          'Returns groups of duplicates with consolidation suggestions and estimated savings. ' +
          '**IMPORTANT**: Always pass the project parameter with your workspace root path.',
        inputSchema: {
          project: z.string().describe('Project path - REQUIRED: the workspace root path to analyze'),
          similarity_threshold: z.number().optional().default(0.80)
            .describe('Minimum similarity score (0.0-1.0) to consider as duplicate. Default: 0.80'),
          min_lines: z.number().optional().default(5)
            .describe('Minimum lines in a code block to analyze. Default: 5'),
          include_types: z.array(z.enum(['function', 'class', 'method', 'block'])).optional()
            .describe('Types of code to analyze. Default: all types'),
        },
      },
      async ({ project, similarity_threshold = 0.80, min_lines = 5, include_types }) => {
        try {
          const storageManager = await getStorageManager();
          const projectStore = storageManager.getProjectStore();
          const projects = await projectStore.list();

          // Find the project
          const projectRecord = projects.find(p =>
            p.name === project ||
            p.path === project ||
            path.basename(p.path) === project ||
            path.resolve(project) === p.path
          );

          const projectPath = projectRecord?.path || path.resolve(project);

          // Verify project exists
          if (!fs.existsSync(projectPath)) {
            return {
              content: [{
                type: 'text' as const,
                text: `Project path not found: ${projectPath}`,
              }],
              isError: true,
            };
          }

          // Run duplicate detection
          const detector = new DuplicateCodeDetector();
          const report = await detector.analyzeProject(projectPath, {
            semanticSimilarityThreshold: similarity_threshold,
            minimumChunkSize: min_lines,
            includeTypes: include_types || ['function', 'class', 'method', 'block'],
          });

          // Format results
          const duplicateGroups = report.duplicateGroups.slice(0, 20).map(group => ({
            type: group.type,
            similarity: `${(group.similarity * 100).toFixed(1)}%`,
            files_affected: group.estimatedSavings.filesAffected,
            lines_savable: group.estimatedSavings.linesReduced,
            suggestion: group.consolidationSuggestion,
            locations: group.chunks.map(c => ({
              file: c.filePath,
              lines: `${c.startLine}-${c.endLine}`,
              name: c.functionName || c.className || 'code block',
            })),
          }));

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                project: path.basename(projectPath),
                summary: {
                  total_chunks_analyzed: report.totalChunksAnalyzed,
                  exact_duplicates: report.summary.exactDuplicates,
                  semantic_duplicates: report.summary.semanticDuplicates,
                  structural_duplicates: report.summary.structuralDuplicates,
                  total_lines_affected: report.summary.totalLinesAffected,
                  potential_lines_saved: report.summary.potentialSavings,
                },
                duplicate_groups: duplicateGroups,
                recommendations: report.recommendations,
              }, null, 2),
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: 'text' as const,
              text: this.formatErrorMessage('Find duplicates', error instanceof Error ? error : String(error), { projectPath: project }),
            }],
            isError: true,
          };
        }
      }
    );
  }

  /**
   * Tool 11: Find dead/unused code
   */
  private registerFindDeadCodeTool(): void {
    this.server.registerTool(
      'find_dead_code',
      {
        description: '**FIND DEAD/UNUSED CODE** - Detects code that is never used or referenced. ' +
          'Uses the knowledge graph to find: unused classes, unused functions, isolated code components. ' +
          'Also detects: God classes (too many responsibilities), circular dependencies, feature envy. ' +
          'Use when: cleaning up codebase, finding code to remove, improving architecture. ' +
          '**IMPORTANT**: Always pass the project parameter. Project must be indexed first.',
        inputSchema: {
          project: z.string().describe('Project path - REQUIRED: the workspace root path to analyze'),
          include_patterns: z.array(z.enum(['dead_code', 'god_class', 'circular_deps', 'feature_envy', 'coupling'])).optional()
            .describe('Anti-patterns to detect. Default: all patterns'),
        },
      },
      async ({ project, include_patterns }) => {
        try {
          const storageManager = await getStorageManager();
          const projectStore = storageManager.getProjectStore();
          const projects = await projectStore.list();

          // Find the project
          const projectRecord = projects.find(p =>
            p.name === project ||
            p.path === project ||
            path.basename(p.path) === project ||
            path.resolve(project) === p.path
          );

          if (!projectRecord) {
            return {
              content: [{
                type: 'text' as const,
                text: `Project not found or not indexed: ${project}\n\n` +
                  `Use index({path: "${project}"}) to index the project first.`,
              }],
              isError: true,
            };
          }

          // Load the knowledge graph for this project
          const knowledgeGraph = new SemanticKnowledgeGraph(projectRecord.path);

          // Run architectural insight detection (includes dead code, god classes, circular deps, etc.)
          const allInsights = await knowledgeGraph.detectArchitecturalInsights();

          // Filter by requested patterns
          const patterns = include_patterns || ['dead_code', 'god_class', 'circular_deps', 'feature_envy', 'coupling'];
          const patternMapping: Record<string, string[]> = {
            'dead_code': ['Dead Code'],
            'god_class': ['God Class'],
            'circular_deps': ['Circular Dependencies', 'Circular Dependency'],
            'feature_envy': ['Feature Envy'],
            'coupling': ['High Coupling', 'Inappropriate Intimacy'],
          };

          const selectedPatterns = patterns.flatMap(p => patternMapping[p] || []);
          const filteredInsights = allInsights.filter(insight =>
            selectedPatterns.some(pattern =>
              insight.pattern?.toLowerCase().includes(pattern.toLowerCase()) ||
              insight.description?.toLowerCase().includes(pattern.toLowerCase())
            )
          );

          // Group by type
          const deadCode = filteredInsights.filter(i => i.pattern === 'Dead Code');
          const antiPatterns = filteredInsights.filter(i => i.type === 'anti_pattern' && i.pattern !== 'Dead Code');
          const couplingIssues = filteredInsights.filter(i => i.type === 'coupling_issue');

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                project: projectRecord.name,
                summary: {
                  total_issues: filteredInsights.length,
                  dead_code_count: deadCode.length,
                  anti_patterns_count: antiPatterns.length,
                  coupling_issues_count: couplingIssues.length,
                },
                dead_code: deadCode.slice(0, 20).map(d => ({
                  type: d.pattern,
                  description: d.description,
                  confidence: `${((d.confidence || 0) * 100).toFixed(0)}%`,
                  impact: d.impact,
                  recommendation: d.recommendation,
                })),
                anti_patterns: antiPatterns.slice(0, 10).map(a => ({
                  type: a.pattern,
                  description: a.description,
                  confidence: `${((a.confidence || 0) * 100).toFixed(0)}%`,
                  impact: a.impact,
                  recommendation: a.recommendation,
                })),
                coupling_issues: couplingIssues.slice(0, 10).map(c => ({
                  type: c.pattern,
                  description: c.description,
                  confidence: `${((c.confidence || 0) * 100).toFixed(0)}%`,
                  impact: c.impact,
                  recommendation: c.recommendation,
                })),
              }, null, 2),
            }],
          };
        } catch (error) {
          return {
            content: [{
              type: 'text' as const,
              text: this.formatErrorMessage('Find dead code', error instanceof Error ? error : String(error), { projectPath: project }),
            }],
            isError: true,
          };
        }
      }
    );
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    // Use stderr for logging since stdout is for JSON-RPC
    console.error('Starting CodeSeeker MCP server...');

    // Initialize storage manager first to ensure singleton is ready
    const storageManager = await getStorageManager();
    console.error(`Storage mode: ${storageManager.getMode()}`);

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('CodeSeeker MCP server running on stdio');
  }

  /**
   * Graceful shutdown - flush and close all storage before exit
   */
  async shutdown(): Promise<void> {
    console.error('Shutting down CodeSeeker MCP server...');
    try {
      const storageManager = await getStorageManager();
      // Flush first to ensure data is saved
      await storageManager.flushAll();
      console.error('Storage flushed successfully');
      // Close to stop interval timers and release resources
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

  // Register signal handlers for graceful shutdown
  const shutdown = async (signal: string) => {
    // Prevent multiple shutdown attempts
    if (isShuttingDown) {
      console.error(`Already shutting down, ignoring ${signal}`);
      return;
    }
    isShuttingDown = true;

    console.error(`\nReceived ${signal}, shutting down gracefully...`);

    // Set a hard timeout to force exit if shutdown takes too long
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

  // CRITICAL: Handle stdin close - this is how MCP clients signal disconnect
  // On Windows, signals are unreliable, so stdin close is the primary shutdown mechanism
  process.stdin.on('close', () => shutdown('stdin-close'));
  process.stdin.on('end', () => shutdown('stdin-end'));

  // Also handle stdin errors (broken pipe, etc.)
  process.stdin.on('error', (err) => {
    // EPIPE and similar errors mean the parent process disconnected
    console.error(`stdin error: ${err.message}`);
    shutdown('stdin-error');
  });

  // Handle Windows-specific signals
  if (process.platform === 'win32') {
    process.on('SIGHUP', () => shutdown('SIGHUP'));

    // Windows: also listen for parent process disconnect via stdin
    // Resume stdin to ensure we receive close/end events
    process.stdin.resume();
  }

  // Handle uncaught exceptions - try to flush before crashing
  process.on('uncaughtException', async (error) => {
    console.error('Uncaught exception:', error);
    await shutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason) => {
    console.error('Unhandled rejection:', reason);
    await shutdown('unhandledRejection');
  });

  await server.start();
}