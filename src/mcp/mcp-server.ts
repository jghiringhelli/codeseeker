/**
 * CodeMind MCP Server
 *
 * Exposes CodeMind's semantic search and code analysis capabilities
 * as an MCP (Model Context Protocol) server for use with Claude Desktop
 * and Claude Code.
 *
 * Usage:
 *   codemind serve --mcp
 *
 * Then add to claude_desktop_config.json:
 *   {
 *     "mcpServers": {
 *       "codemind": {
 *         "command": "codemind",
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
 * MCP Server for CodeMind
 */
export class CodeMindMcpServer {
  private server: McpServer;
  private searchOrchestrator: SemanticSearchOrchestrator;
  private indexingService: IndexingService;
  private languageSupportService: LanguageSupportService;

  constructor() {
    this.server = new McpServer({
      name: 'codemind',
      version: VERSION,
    });

    this.searchOrchestrator = new SemanticSearchOrchestrator();
    this.indexingService = new IndexingService();
    this.languageSupportService = new LanguageSupportService();
    this.registerTools();
  }

  /**
   * Find CodeMind project by walking up directory tree from startPath
   * looking for .codemind/project.json
   */
  private async findProjectPath(startPath: string): Promise<string> {
    let currentPath = path.resolve(startPath);
    const root = path.parse(currentPath).root;

    while (currentPath !== root) {
      const configPath = path.join(currentPath, '.codemind', 'project.json');
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
        description: 'Search codebase using semantic similarity to find relevant code, documentation, and config files. ' +
          'IMPORTANT: If project is not indexed, use index_project tool FIRST to enable search. ' +
          'Accepts natural language queries or code snippets. Returns ranked file chunks with similarity scores. ' +
          'Use this BEFORE reading files to understand what exists in the codebase. ' +
          'If this tool returns "not indexed" error, IMMEDIATELY call index_project with the project path, then retry the search.',
        inputSchema: {
          query: z.string().describe('Natural language query or code snippet (e.g., "validation logic", "error handling")'),
          project: z.string().describe('Project path - typically the current working directory where you are working'),
          limit: z.number().optional().default(10).describe('Maximum results (default: 10)'),
          search_type: z.enum(['hybrid', 'fts', 'vector', 'graph']).optional().default('hybrid')
            .describe('Search method: hybrid (default), fts, vector, or graph'),
        },
      },
      async ({ query, project, limit = 10, search_type = 'hybrid' }) => {
        try {
          // Get storage manager
          const storageManager = await getStorageManager();
          const projectStore = storageManager.getProjectStore();

          // Resolve project path - try to find by name/path, or use as direct path
          let projectPath: string;
          const projects = await projectStore.list();
          const found = projects.find(p =>
            p.name === project ||
            p.path === project ||
            path.basename(p.path) === project ||
            path.resolve(project) === p.path
          );

          if (found) {
            projectPath = found.path;
          } else {
            // Use provided path directly and try to find CodeMind project
            projectPath = await this.findProjectPath(path.resolve(project));
          }

          // Check if project is indexed by checking for embeddings
          const vectorStore = storageManager.getVectorStore();
          const projectRecord = await projectStore.findByPath(projectPath);

          if (projectRecord) {
            // Quick check: does this project have any embeddings?
            try {
              const testResults = await vectorStore.searchByText('test', projectRecord.id, 1);
              if (!testResults || testResults.length === 0) {
                return {
                  content: [{
                    type: 'text' as const,
                    text: `⚠️  Project found but not indexed.\n\n` +
                      `ACTION REQUIRED: Call index_project tool now with path "${projectPath}", then retry this search.`,
                  }],
                  isError: true,
                };
              }
            } catch (err) {
              // If search fails, project likely not indexed
              return {
                content: [{
                  type: 'text' as const,
                  text: `⚠️  Project needs indexing.\n\n` +
                    `ACTION REQUIRED: Call index_project tool now with path "${projectPath}", then retry this search.`,
                }],
                isError: true,
              };
            }
          }

          // Perform search
          const results = await this.searchOrchestrator.performSemanticSearch(query, projectPath);
          const limitedResults = results.slice(0, limit);

          if (limitedResults.length === 0) {
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

          // Format results
          const formattedResults = limitedResults.map((r, i) => ({
            rank: i + 1,
            filepath: r.file,
            score: Math.round(r.similarity * 100) / 100,
            type: r.type,
            chunk: r.content.substring(0, 500) + (r.content.length > 500 ? '...' : ''),
            lines: r.lineStart && r.lineEnd ? `${r.lineStart}-${r.lineEnd}` : undefined,
          }));

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                query,
                total_results: limitedResults.length,
                search_type,
                results: formattedResults,
              }, null, 2),
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
   * Tool 2: Get file with semantic context
   */
  private registerGetFileContextTool(): void {
    this.server.registerTool(
      'get_file_context',
      {
        description: 'Read a file with semantically related code context. ' +
          'Returns the file content plus similar code chunks from other files in the project. ' +
          'Use when you need to understand a file and its connections to related code. ' +
          'Example: get_file_context({filepath: "src/auth.ts"}) returns auth.ts content plus related authentication code.',
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
            // Extract key terms from file for semantic search
            const fileName = path.basename(filepath);
            const searchQuery = fileName.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');

            const results = await this.searchOrchestrator.performSemanticSearch(searchQuery, projectPath);

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
        description: 'Explore code dependencies and relationships in the knowledge graph. ' +
          'Returns import chains, class hierarchies, function calls, and component dependencies. ' +
          'Accepts filepath(s) or a query to find seed files via semantic search, then expands to show relationships. ' +
          'Example: get_code_relationships({filepath: "src/auth.ts"}) or get_code_relationships({query: "authentication"}).',
        inputSchema: {
          filepath: z.string().optional().describe('Path to a single file to explore (use this OR filepaths OR query)'),
          filepaths: z.array(z.string()).optional().describe('Array of file paths to explore relationships between'),
          query: z.string().optional().describe('Semantic search query to find seed files automatically'),
          depth: z.number().optional().default(2).describe('How many relationship hops to traverse (1-3, default: 2)'),
          relationship_types: z.array(z.enum([
            'imports', 'exports', 'calls', 'extends', 'implements', 'contains', 'uses', 'depends_on'
          ])).optional().describe('Filter to specific relationship types (default: all)'),
          direction: z.enum(['in', 'out', 'both']).optional().default('both')
            .describe('Direction of relationships: in (what points to this), out (what this points to), both'),
          project: z.string().optional().describe('Project name or path'),
        },
      },
      async ({ filepath, filepaths, query, depth = 2, relationship_types, direction = 'both', project }) => {
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

          // Find all nodes for this project
          const allNodes = await graphStore.findNodes(projectId);

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

          const traverse = async (nodeId: string, currentDepth: number) => {
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
            await traverse(startNode.id, 1);
          }

          // Format output
          const nodes = Array.from(visitedNodes.values());
          const uniqueEdges = collectedEdges.filter((e, i, arr) =>
            arr.findIndex(x => x.from === e.from && x.to === e.to && x.type === e.type) === i
          );

          // Create a summary
          const summary = {
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
            },
            results: {
              seed_nodes: startNodes.length,
              nodes_found: nodes.length,
              relationships_found: uniqueEdges.length,
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

          // Get document counts for each project
          const projectsWithCounts = await Promise.all(
            projects.map(async (p) => {
              const count = await vectorStore.count(p.id);
              return {
                name: p.name,
                path: p.path,
                file_count: count,
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
          const codingStandardsPath = path.join(absolutePath, '.codemind', 'coding-standards.json');
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
        description: 'Update the search index after modifying files. ' +
          'Keeps semantic search and knowledge graph current with changes to code, docs, or configs. ' +
          'Call after creating, editing, or deleting files to ensure search results reflect the latest content. ' +
          'Example: notify_file_changes({project: "my-app", changes: [{type: "modified", path: "src/auth.ts"}]}). ' +
          'For large changes (git pull, branch switch), use full_reindex: true.',
        inputSchema: {
          project: z.string().describe('Project name or path'),
          changes: z.array(z.object({
            type: z.enum(['created', 'modified', 'deleted']),
            path: z.string().describe('Path to the changed file'),
          })).optional().describe('Array of file changes (not needed if full_reindex is true)'),
          full_reindex: z.boolean().optional().default(false)
            .describe('Trigger a complete re-index of the project. Use after git pull, branch switch, or major changes.'),
        },
      },
      async ({ project, changes, full_reindex = false }) => {
        try {
          const startTime = Date.now();

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

          // Full reindex mode - use IndexingService
          if (full_reindex) {
            // Clear existing index for this project
            await vectorStore.deleteByProject(found.id);
            await graphStore.deleteByProject(found.id);

            // Delete coding standards file (will be regenerated)
            const codingStandardsPath = path.join(found.path, '.codemind', 'coding-standards.json');
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
                const result = await this.indexingService.indexSingleFile(found.path, relativePath, found.id);
                if (result.success) {
                  chunksCreated += result.chunksCreated;
                  filesProcessed++;
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
                files_processed: filesProcessed,
                chunks_created: chunksCreated,
                chunks_deleted: chunksDeleted,
                duration_ms: duration,
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
          const standardsPath = path.join(found.path, '.codemind', 'coding-standards.json');
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
          'or include files that were incorrectly excluded. Exclusions persist in .codemind/exclusions.json. ' +
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
          const exclusionsPath = path.join(found.path, '.codemind', 'exclusions.json');
          let exclusions: {
            patterns: Array<{ pattern: string; reason?: string; addedAt: string }>;
            lastModified: string;
          } = {
            patterns: [],
            lastModified: new Date().toISOString()
          };

          // Ensure .codemind directory exists
          const codemindDir = path.join(found.path, '.codemind');
          if (!fs.existsSync(codemindDir)) {
            fs.mkdirSync(codemindDir, { recursive: true });
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
    console.error('Starting CodeMind MCP server...');

    // Initialize storage manager first to ensure singleton is ready
    const storageManager = await getStorageManager();
    console.error(`Storage mode: ${storageManager.getMode()}`);

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('CodeMind MCP server running on stdio');
  }

  /**
   * Graceful shutdown - flush and close all storage before exit
   */
  async shutdown(): Promise<void> {
    console.error('Shutting down CodeMind MCP server...');
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
  const server = new CodeMindMcpServer();
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