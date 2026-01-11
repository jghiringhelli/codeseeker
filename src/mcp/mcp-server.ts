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

// Version from package.json
const VERSION = '2.0.0';

/**
 * MCP Server for CodeSeeker
 */
export class CodeSeekerMcpServer {
  private server: McpServer;
  private searchOrchestrator: SemanticSearchOrchestrator;
  private indexingService: IndexingService;
  private languageSupportService: LanguageSupportService;

  constructor() {
    this.server = new McpServer({
      name: 'codeseeker',
      version: VERSION,
    });

    this.searchOrchestrator = new SemanticSearchOrchestrator();
    this.indexingService = new IndexingService();
    this.languageSupportService = new LanguageSupportService();
    this.registerTools();
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
    this.registerSearchCodeTool();
    this.registerFindAndReadTool();
    this.registerGetFileContextTool();
    this.registerGetCodeRelationshipsTool();
    this.registerListProjectsTool();
    this.registerIndexProjectTool();
    this.registerNotifyFileChangesTool();
    this.registerInstallLanguageSupportTool();
    this.registerManageIndexTool();
  }

  /**
   * Tool 1: Semantic search across indexed projects
   */
  private registerSearchCodeTool(): void {
    this.server.registerTool(
      'search_code',
      {
        description: '**DEFAULT TOOL FOR CODE DISCOVERY** - Use this BEFORE grep/glob for any code search. ' +
          'This semantic search finds code by meaning, not just text patterns. ' +
          'ALWAYS use for: "Where is X handled?", "Find the auth logic", "How does Y work?", "What calls Z?" ' +
          'Only fall back to grep when: you need exact literal strings, regex patterns, or already know the exact file. ' +
          'Why better than grep: finds "user authentication" even if code says "login", "session", "credentials". ' +
          'Examples: ❌ grep -r "damage.*ship" → ✅ search_code("how ships take damage"). ' +
          'Returns absolute file paths ready for the Read tool. If not indexed, call index_project first.',
        inputSchema: {
          query: z.string().describe('Natural language query or code snippet (e.g., "validation logic", "error handling")'),
          project: z.string().optional().describe('Project path (optional - auto-detects from indexed projects if omitted)'),
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
            // Auto-detect: try cwd first, then fall back to most recently indexed project
            const cwd = process.cwd();
            projectRecord = projects.find(p =>
              p.path === cwd ||
              cwd.startsWith(p.path + path.sep) ||
              cwd.startsWith(p.path + '/')
            );

            if (projectRecord) {
              projectPath = projectRecord.path;
            } else if (projects.length > 0) {
              // Use most recently updated project
              const sorted = [...projects].sort((a, b) =>
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
              );
              projectRecord = sorted[0];
              projectPath = projectRecord.path;
            } else {
              return {
                content: [{
                  type: 'text' as const,
                  text: `No indexed projects found. Use index_project to index a project first.`,
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
                      `ACTION REQUIRED: Call index_project({path: "${projectPath}"}) then retry this search.`,
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
                    `ACTION REQUIRED: Call index_project({path: "${projectPath}"}) then retry this search.`,
                }],
                isError: true,
              };
            }
          }

          // Perform search
          const results = await this.searchOrchestrator.performSemanticSearch(query, projectPath);
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
          const message = error instanceof Error ? error.message : String(error);
          return {
            content: [{
              type: 'text' as const,
              text: `Search failed: ${message}`,
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
  private registerFindAndReadTool(): void {
    this.server.registerTool(
      'find_and_read',
      {
        description: '**SEARCH + READ IN ONE STEP** - Use when you need to see actual code, not just file paths. ' +
          'Combines search_code + Read into a single call. Saves a round-trip when you know you\'ll need to read results. ' +
          'Use this instead of search_code when: implementing something similar, understanding HOW code works, ' +
          'user asks "show me the X code", or you need full context to make changes. ' +
          'Examples: "Show me how damage is calculated" → find_and_read("damage calculation"). ' +
          '"I need to add validation like login" → find_and_read("login form validation"). ' +
          'Use search_code instead when: you only need file paths, checking if something exists (mode="exists"), ' +
          'or want to see many results before picking one. Returns full file content with line numbers.',
        inputSchema: {
          query: z.string().describe('Natural language query or code snippet (e.g., "validation logic", "error handling")'),
          project: z.string().optional().describe('Project path (optional - auto-detects from indexed projects if omitted)'),
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
            // Auto-detect: try cwd first, then fall back to most recently indexed project
            const cwd = process.cwd();
            projectRecord = projects.find(p =>
              p.path === cwd ||
              cwd.startsWith(p.path + path.sep) ||
              cwd.startsWith(p.path + '/')
            );

            if (projectRecord) {
              projectPath = projectRecord.path;
            } else if (projects.length > 0) {
              // Use most recently updated project
              const sorted = [...projects].sort((a, b) =>
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
              );
              projectRecord = sorted[0];
              projectPath = projectRecord.path;
            } else {
              return {
                content: [{
                  type: 'text' as const,
                  text: `No indexed projects found. Use index_project to index a project first.`,
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
                      `ACTION REQUIRED: Call index_project({path: "${projectPath}"}) then retry.`,
                  }],
                  isError: true,
                };
              }
            } catch {
              return {
                content: [{
                  type: 'text' as const,
                  text: `⚠️  Project "${path.basename(projectPath)}" needs indexing.\n\n` +
                    `ACTION REQUIRED: Call index_project({path: "${projectPath}"}) then retry.`,
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
          const message = error instanceof Error ? error.message : String(error);
          return {
            content: [{
              type: 'text' as const,
              text: `Find and read failed: ${message}`,
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
  private registerGetFileContextTool(): void {
    this.server.registerTool(
      'get_file_context',
      {
        description: '**READ FILE WITH RELATED CODE** - Enhanced Read that includes semantically similar code. ' +
          'Use instead of basic Read when: reading a file for the first time, the file references other modules, ' +
          'or you want to discover patterns used elsewhere in the codebase. ' +
          'Examples: Understanding a component → get_file_context("src/Button.tsx") returns Button + similar patterns. ' +
          'Reading a service → get_file_context("src/api.ts") returns api.ts + related implementations. ' +
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
          const message = error instanceof Error ? error.message : String(error);
          return {
            content: [{
              type: 'text' as const,
              text: `Failed to get file context: ${message}`,
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
  private registerGetCodeRelationshipsTool(): void {
    this.server.registerTool(
      'get_code_relationships',
      {
        description: '**UNDERSTAND CODE CONNECTIONS** - Use after search_code to explore how files relate. ' +
          'Maps imports, class hierarchies, function calls, dependencies. Essential for understanding impact of changes. ' +
          'Use when: planning refactors ("what breaks if I change this?"), understanding architecture ("what depends on this?"), ' +
          'tracing data flow ("where does this come from?"), before changing shared code. ' +
          'WORKFLOW: 1) search_code to find files, 2) pass those paths here via filepaths parameter. ' +
          'Filter with relationship_types: ["imports"], ["calls"], ["extends"] to reduce noise. ' +
          'Use direction="in" to find what USES this file, direction="out" for what this file USES.',
        inputSchema: {
          filepath: z.string().optional().describe('Single file path to explore (prefer filepaths for multiple)'),
          filepaths: z.array(z.string()).optional().describe('PREFERRED: Array of file paths from search_code results'),
          query: z.string().optional().describe('Fallback: semantic search to find seed files (prefer using filepaths from search_code)'),
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
                text: 'Project not indexed. Use index_project first.',
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
          const message = error instanceof Error ? error.message : String(error);
          return {
            content: [{
              type: 'text' as const,
              text: `Failed to get code relationships: ${message}`,
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
  private registerListProjectsTool(): void {
    this.server.registerTool(
      'list_projects',
      {
        description: 'List all indexed projects with their metadata. ' +
          'Returns project names, paths, indexed file counts, and last index timestamps. ' +
          'Use to discover available projects before running search_code or get_code_relationships. ' +
          'Example: list_projects() shows all projects ready for semantic search.',
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
                text: 'No projects indexed. Use index_project to add a project.',
              }],
            };
          }

          // Get file and chunk counts for each project
          const projectsWithCounts = await Promise.all(
            projects.map(async (p) => {
              const fileCount = await vectorStore.countFiles(p.id);
              const chunkCount = await vectorStore.count(p.id);
              return {
                name: p.name,
                path: p.path,
                files: fileCount,
                chunks: chunkCount,
                last_indexed: p.updatedAt.toISOString(),
              };
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
          const message = error instanceof Error ? error.message : String(error);
          return {
            content: [{
              type: 'text' as const,
              text: `Failed to list projects: ${message}`,
            }],
            isError: true,
          };
        }
      }
    );
  }

  /**
   * Tool 5: Index a project (with proper embeddings and knowledge graph)
   */
  private registerIndexProjectTool(): void {
    this.server.registerTool(
      'index_project',
      {
        description: 'Index a project directory for semantic search and knowledge graph. ' +
          'Scans code, documentation, configs, and other text files. Generates vector embeddings and extracts code relationships. ' +
          'Run once per project, then use notify_file_changes for incremental updates. ' +
          'Example: index_project({path: "/home/user/my-app"}) indexes all files in my-app.',
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

          // Get storage and create project
          const storageManager = await getStorageManager();
          const projectStore = storageManager.getProjectStore();
          const vectorStore = storageManager.getVectorStore();
          const graphStore = storageManager.getGraphStore();

          // Create or update project
          const project = await projectStore.upsert({
            id: this.generateProjectId(absolutePath),
            name: projectName,
            path: absolutePath,
            metadata: { indexedAt: new Date().toISOString() },
          });

          // Clear existing index data for clean reindex
          await vectorStore.deleteByProject(project.id);
          await graphStore.deleteByProject(project.id);

          // Delete coding standards file (will be regenerated)
          const codingStandardsPath = path.join(absolutePath, '.codeseeker', 'coding-standards.json');
          if (fs.existsSync(codingStandardsPath)) {
            fs.unlinkSync(codingStandardsPath);
          }

          // Use IndexingService for proper indexing with embeddings and graph
          // Track progress for detailed reporting
          let lastProgress: import('./indexing-service').IndexingProgress | undefined;

          const result = await this.indexingService.indexProject(absolutePath, project.id, (progress) => {
            lastProgress = progress;
          });

          // Build response with progress details
          const response: Record<string, unknown> = {
            success: result.success,
            project_name: projectName,
            project_path: absolutePath,
            files_indexed: result.filesIndexed,
            chunks_created: result.chunksCreated,
            graph_nodes: result.nodesCreated,
            graph_edges: result.edgesCreated,
            duration_ms: result.durationMs,
          };

          // Add scanning summary if available
          if (lastProgress?.scanningStatus) {
            response.scanning_summary = {
              folders_scanned: lastProgress.scanningStatus.foldersScanned,
              files_found: lastProgress.scanningStatus.filesFound,
            };
          }

          // Add warnings (file limits, recommendations)
          if (result.warnings && result.warnings.length > 0) {
            response.warnings = result.warnings;
          }

          // Add errors if any
          if (result.errors.length > 0) {
            response.errors = result.errors.slice(0, 5);
          }

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(response, null, 2),
            }],
          };

        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            content: [{
              type: 'text' as const,
              text: `Failed to index project: ${message}`,
            }],
            isError: true,
          };
        }
      }
    );
  }

  /**
   * Tool 5: Notify file changes for incremental updates
   */
  private registerNotifyFileChangesTool(): void {
    this.server.registerTool(
      'notify_file_changes',
      {
        description: '**KEEP INDEX IN SYNC** - Call this after creating, editing, or deleting files. ' +
          'IMPORTANT: If search_code returns stale results or grep finds content not in search results, ' +
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
                  ? `Project not found: ${project}. Use list_projects to see available projects.`
                  : `Could not auto-detect project. Specify project name or use absolute paths in changes. Available: ${projects.map(p => p.name).join(', ')}`,
              }],
              isError: true,
            };
          }

          // Full reindex mode - use IndexingService
          if (full_reindex) {
            // Clear existing index for this project
            await vectorStore.deleteByProject(found.id);
            await graphStore.deleteByProject(found.id);

            // Delete coding standards file (will be regenerated)
            const codingStandardsPath = path.join(found.path, '.codeseeker', 'coding-standards.json');
            if (fs.existsSync(codingStandardsPath)) {
              fs.unlinkSync(codingStandardsPath);
            }

            // Re-index all files using IndexingService (with proper embeddings and graph)
            let lastProgress: import('./indexing-service').IndexingProgress | undefined;
            const result = await this.indexingService.indexProject(found.path, found.id, (progress) => {
              lastProgress = progress;
            });

            // Update project metadata
            await projectStore.upsert({
              id: found.id,
              name: found.name,
              path: found.path,
              metadata: {
                ...found.metadata,
                lastFullReindex: new Date().toISOString(),
              },
            });

            // Build response with all details
            const response: Record<string, unknown> = {
              success: result.success,
              mode: 'full_reindex',
              project: found.name,
              files_indexed: result.filesIndexed,
              chunks_created: result.chunksCreated,
              graph_nodes: result.nodesCreated,
              graph_edges: result.edgesCreated,
              duration_ms: result.durationMs,
              message: `Complete reindex finished. ${result.filesIndexed} files indexed, ${result.chunksCreated} chunks created.`,
            };

            // Add scanning summary
            if (lastProgress?.scanningStatus) {
              response.scanning_summary = {
                folders_scanned: lastProgress.scanningStatus.foldersScanned,
                files_found: lastProgress.scanningStatus.filesFound,
              };
            }

            // Add warnings
            if (result.warnings && result.warnings.length > 0) {
              response.warnings = result.warnings;
            }

            // Add errors
            if (result.errors.length > 0) {
              response.errors = result.errors.slice(0, 5);
            }

            return {
              content: [{
                type: 'text' as const,
                text: JSON.stringify(response, null, 2),
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
                duration_ms: duration,
                note: filesSkipped > 0 ? `${filesSkipped} file(s) unchanged (skipped via mtime/hash check)` : undefined,
                errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
              }, null, 2),
            }],
          };

        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            content: [{
              type: 'text' as const,
              text: `Failed to process file changes: ${message}`,
            }],
            isError: true,
          };
        }
      }
    );

    // get_coding_standards - Get auto-detected coding standards
    this.server.registerTool(
      'get_coding_standards',
      {
        description: 'Get auto-detected coding patterns and standards for a project. ' +
          'Returns validation patterns, error handling patterns, logging patterns, and testing patterns ' +
          'discovered from the codebase. Use this to write code that follows project conventions. ' +
          'Example: get_coding_standards({project: "my-app", category: "validation"})',
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
                text: `Project not found: ${project}. Use list_projects to see available projects.`,
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
                  text: 'No coding standards detected yet. The project may need to be indexed first using index_project.',
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
          const message = error instanceof Error ? error.message : String(error);
          return {
            content: [{
              type: 'text' as const,
              text: `Failed to get coding standards: ${message}`,
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
  private registerInstallLanguageSupportTool(): void {
    this.server.registerTool(
      'install_language_support',
      {
        description: 'Analyze project languages and install Tree-sitter parsers for better code understanding. ' +
          'Detects which programming languages are used in a project and installs enhanced parsers. ' +
          'Enhanced parsers provide better AST extraction for imports, classes, functions, and relationships. ' +
          'Example: install_language_support({project: "/path/to/project"}) to auto-detect and install. ' +
          'Example: install_language_support({languages: ["python", "java"]}) to install specific parsers.',
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
                    ? `Use install_language_support({languages: [${available.slice(0, 3).map(p => `"${p.language.toLowerCase()}"`).join(', ')}]})`
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
                    ? 'Reindex your project to use the new parsers: notify_file_changes({project: "...", full_reindex: true})'
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
                    ? `Use install_language_support({languages: [${missingLanguages.map(l => `"${l}"`).join(', ')}]}) to install enhanced parsers`
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
                  analyze_project: 'install_language_support({project: "/path/to/project"}) - Detect languages and suggest parsers',
                  install_specific: 'install_language_support({languages: ["python", "java"]}) - Install parsers for specific languages',
                  list_available: 'install_language_support({list_available: true}) - Show all available parsers',
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
          const message = error instanceof Error ? error.message : String(error);
          return {
            content: [{
              type: 'text' as const,
              text: `Failed to manage language support: ${message}`,
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
  private registerManageIndexTool(): void {
    this.server.registerTool(
      'manage_index',
      {
        description: 'Dynamically manage which files are included or excluded from the index. ' +
          'Use this to exclude files that shouldn\'t be searched (e.g., Library/, build outputs, generated files) ' +
          'or include files that were incorrectly excluded. Exclusions persist in .codeseeker/exclusions.json. ' +
          'Example: manage_index({action: "exclude", project: "my-app", paths: ["Library/**", "Temp/**"]}) ' +
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
                text: `Project not found: ${project}. Use list_projects to see available projects.`,
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
                    exclude: 'manage_index({action: "exclude", project: "...", paths: ["pattern/**"]})',
                    include: 'manage_index({action: "include", project: "...", paths: ["pattern/**"]})',
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
                    ? 'Run notify_file_changes({project: "...", full_reindex: true}) to index the previously excluded files.'
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
          const message = error instanceof Error ? error.message : String(error);
          return {
            content: [{
              type: 'text' as const,
              text: `Failed to manage index: ${message}`,
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