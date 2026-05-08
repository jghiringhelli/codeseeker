/**
 * CodeSeeker library entry — programmatic API.
 *
 * pragmaworks (at C:/workspace/PragmaWorks/pragmaworks/) embeds this client
 * to call CodeSeeker directly without going through the MCP transport.
 *
 * The underlying implementation lives in the MCP tool handlers
 * (see src/mcp/mcp-server.ts). These stubs mirror the sentinel `codeseeker`
 * tool's action surface (search, sym, graph, analyze, index) and will
 * delegate into the shared handlers once wired up.
 */

export type SearchType = 'hybrid' | 'fts' | 'vector';
export type GraphDirection = 'in' | 'out' | 'both';
export type GraphRelation =
  | 'imports' | 'exports' | 'calls' | 'extends'
  | 'implements' | 'contains' | 'uses' | 'depends_on';
export type AnalyzeKind = 'duplicates' | 'dead_code' | 'standards';
export type IndexOp = 'init' | 'sync' | 'status' | 'parsers' | 'exclude';
export type ExcludeOp = 'exclude' | 'include' | 'list';

export interface SearchParams {
  q: string;
  project?: string;
  exists?: boolean;
  full?: boolean;
  limit?: number;
  type?: SearchType;
}

export interface SymbolParams {
  name: string;
  project?: string;
  full?: boolean;
}

export interface GraphParams {
  project?: string;
  seed?: string;
  q?: string;
  depth?: number;
  rel?: GraphRelation[];
  dir?: GraphDirection;
  max?: number;
}

export interface AnalyzeParams {
  project: string;
  kind: AnalyzeKind;
  threshold?: number;
  min_lines?: number;
  patterns?: Array<'dead_code' | 'god_class' | 'circular_deps' | 'feature_envy' | 'coupling'>;
  category?: 'validation' | 'error-handling' | 'logging' | 'testing' | 'all';
}

export interface IndexParams {
  project?: string;
  op: IndexOp;
  path?: string;
  name?: string;
  changes?: Array<{ type: 'created' | 'modified' | 'deleted'; path: string }>;
  full_reindex?: boolean;
  languages?: string[];
  list_available?: boolean;
  exclude_op?: ExcludeOp;
  paths?: string[];
  reason?: string;
}

/**
 * Programmatic client for CodeSeeker.
 *
 * Mirrors the MCP `codeseeker` sentinel tool's action surface so embedders
 * (e.g. pragmaworks) can invoke the same operations in-process.
 */
export class CodeSeekerClient {
  constructor() {
    // No configuration required for now. Future: storage/logger overrides.
  }

  /** Semantic / hybrid / FTS / vector search. Mirrors action=search. */
  async search(_params: SearchParams): Promise<unknown> {
    throw new Error('CodeSeekerClient.search: not implemented');
  }

  /** Symbol lookup by name. Mirrors action=sym. */
  async symbol(_params: SymbolParams): Promise<unknown> {
    throw new Error('CodeSeekerClient.symbol: not implemented');
  }

  /** Knowledge-graph traversal from a seed file or query. Mirrors action=graph. */
  async graph(_params: GraphParams): Promise<unknown> {
    throw new Error('CodeSeekerClient.graph: not implemented');
  }

  /** Run an analysis (duplicates / dead_code / standards). Mirrors action=analyze. */
  async analyze(_params: AnalyzeParams): Promise<unknown> {
    throw new Error('CodeSeekerClient.analyze: not implemented');
  }

  /** Index management (init / sync / status / parsers / exclude). Mirrors action=index. */
  async index(_params: IndexParams): Promise<unknown> {
    throw new Error('CodeSeekerClient.index: not implemented');
  }
}

export default CodeSeekerClient;
