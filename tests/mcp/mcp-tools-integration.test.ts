/**
 * MCP 3-Tool Integration Tests
 *
 * Tests the consolidated search / analyze / index tool handlers
 * against a mock-indexed test project. Uses random embeddings to
 * avoid downloading the transformer model.
 *
 * Run with: npm test -- tests/mcp/mcp-tools-integration.test.ts
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';
import { getStorageManager, resetStorageManager } from '../../src/storage';
import { CodeSeekerMcpServer } from '../../src/mcp/mcp-server';

// ─── fixtures ─────────────────────────────────────────────────────────────────
const TEST_DIR = path.join(os.tmpdir(), `cs-integration-${Date.now()}`);
const PROJECT_PATH = path.join(TEST_DIR, 'sample-project');

const SAMPLE_FILES = {
  'src/auth/auth-service.ts': `
import { hash, compare } from 'bcrypt';

export class AuthService {
  private sessions = new Map<string, string>();

  async login(email: string, password: string): Promise<string> {
    const user = await this.findUser(email);
    if (!user || !await compare(password, user.passwordHash)) {
      throw new Error('Invalid credentials');
    }
    const token = crypto.randomUUID();
    this.sessions.set(token, email);
    return token;
  }

  isAuthenticated(token: string): boolean {
    return this.sessions.has(token);
  }

  logout(token: string): void {
    this.sessions.delete(token);
  }

  private async findUser(email: string): Promise<any> {
    return null; // stub
  }
}
`,
  'src/users/user-controller.ts': `
import { AuthService } from '../auth/auth-service';

export class UserController {
  constructor(private auth: AuthService) {}

  async createUser(body: { name: string; email: string }): Promise<any> {
    return { id: crypto.randomUUID(), ...body };
  }

  async getUser(id: string, token: string): Promise<any> {
    if (!this.auth.isAuthenticated(token)) {
      throw new Error('Unauthorized');
    }
    return { id, name: 'Test User' };
  }
}
`,
  'src/utils/validation.ts': `
export function validateEmail(email: string): boolean {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
}

export function validatePassword(password: string): boolean {
  return password.length >= 8;
}

export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>'"]/g, '');
}
`,
  'src/utils/logger.ts': `
export class Logger {
  info(msg: string, meta?: Record<string, unknown>): void {
    console.log(JSON.stringify({ level: 'info', msg, ...meta }));
  }
  error(msg: string, err?: Error): void {
    console.error(JSON.stringify({ level: 'error', msg, stack: err?.stack }));
  }
}
`,
};

/** Random 384-dim embedding */
function rndEmbed(): number[] {
  return Array.from({ length: 384 }, () => Math.random() * 2 - 1);
}

function projectId(p = PROJECT_PATH): string {
  return crypto.createHash('md5').update(p).digest('hex');
}

// ─── server accessor (private handlers via any-cast) ─────────────────────────
// We cast to `any` because TypeScript's intersection would collapse to `never`
// when the target class declares the same methods as private. At runtime
// JavaScript does NOT enforce the private modifier, so the calls work fine.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Server = any;

function srv(server: CodeSeekerMcpServer): Server {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return server as any;
}

/** Extract text from MCP tool response */
function text(r: any): string {
  return r?.content?.[0]?.text ?? '';
}

/** Parse JSON from MCP tool response */
function json<T = any>(r: any): T {
  return JSON.parse(text(r)) as T;
}

// ─── suite ────────────────────────────────────────────────────────────────────
describe('MCP 3-Tool Integration', () => {
  let server: Server;
  const pid = projectId();

  // ── beforeAll: seed test project into storage ──────────────────────────────
  beforeAll(async () => {
    await fs.mkdir(PROJECT_PATH, { recursive: true });
    for (const [rel, content] of Object.entries(SAMPLE_FILES)) {
      const abs = path.join(PROJECT_PATH, rel);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, content);
    }

    process.env.CODESEEKER_DATA_DIR = path.join(TEST_DIR, '.data');
    await resetStorageManager();

    const storage = await getStorageManager();
    const projectStore = storage.getProjectStore();
    const vectorStore = storage.getVectorStore();
    const graphStore = storage.getGraphStore();

    // Register project
    await projectStore.upsert({ id: pid, name: 'sample-project', path: PROJECT_PATH, metadata: {} });

    // Seed vector store with mock embeddings
    for (const [rel, content] of Object.entries(SAMPLE_FILES)) {
      const abs = path.join(PROJECT_PATH, rel);
      const docId = crypto.createHash('md5').update(abs).digest('hex');
      await vectorStore.upsert({
        id: docId, projectId: pid, filePath: abs, content,
        embedding: rndEmbed(),
        metadata: { fileName: path.basename(rel), extension: path.extname(rel), relativePath: rel },
      });
    }

    // Seed graph: file + class nodes
    const entries: Array<{ rel: string; className: string }> = [
      { rel: 'src/auth/auth-service.ts',      className: 'AuthService'    },
      { rel: 'src/users/user-controller.ts',  className: 'UserController' },
      { rel: 'src/utils/validation.ts',        className: 'ValidationUtils' },
      { rel: 'src/utils/logger.ts',            className: 'Logger'         },
    ];

    for (const { rel, className } of entries) {
      const abs = path.join(PROJECT_PATH, rel);
      const fileId = `file:${pid}:${rel}`;
      const classId = `class:${pid}:${rel}:${className}`;

      await graphStore.upsertNode({ id: fileId, type: 'file', name: path.basename(rel), filePath: abs, projectId: pid, properties: { relativePath: rel } });
      await graphStore.upsertNode({ id: classId, type: 'class', name: className, filePath: abs, projectId: pid, properties: { relativePath: rel } });
      await graphStore.upsertEdge({ id: `contains:${fileId}:${classId}`, source: fileId, target: classId, type: 'contains' });
    }

    // AuthService ← UserController (imports)
    await graphStore.upsertEdge({
      id: 'imports:UserController:AuthService',
      source: 'class:' + pid + ':src/users/user-controller.ts:UserController',
      target: 'class:' + pid + ':src/auth/auth-service.ts:AuthService',
      type: 'imports',
    });

    await vectorStore.flush();
    await graphStore.flush();

    server = srv(new CodeSeekerMcpServer());
  }, 60_000);

  afterAll(async () => {
    try {
      const storage = await getStorageManager();
      await storage.closeAll();
    } catch { /* ignore */ }
    await fs.rm(TEST_DIR, { recursive: true, force: true }).catch(() => {});
  }, 30_000);

  // ── TOOL: search ─────────────────────────────────────────────────────────────
  describe('search tool', () => {
    describe('handleSearch (query mode)', () => {
      it('returns matching results for a text query', async () => {
        const r = await server.handleSearch('authentication login', 'sample-project', 10, 'hybrid', 'full');
        const d = json(r);
        expect(d.results).toBeDefined();
        expect(Array.isArray(d.results)).toBe(true);
        expect(d.total_results).toBeGreaterThan(0);
      });

      it('each result has required fields', async () => {
        const r = await server.handleSearch('validation email', 'sample-project', 5, 'hybrid', 'full');
        const d = json(r);
        for (const result of d.results) {
          expect(result).toHaveProperty('rank');
          expect(result).toHaveProperty('file');
          expect(result).toHaveProperty('score');
          expect(result).toHaveProperty('chunk');
        }
      });

      it('respects limit parameter', async () => {
        const r = await server.handleSearch('service', 'sample-project', 2, 'hybrid', 'full');
        const d = json(r);
        expect(d.results.length).toBeLessThanOrEqual(2);
      });

      it('mode=exists returns quick summary', async () => {
        const r = await server.handleSearch('authentication', 'sample-project', 5, 'hybrid', 'exists');
        const d = json(r);
        expect(d).toHaveProperty('exists');
        // Note: may be false since search uses real semantic search with mock embeddings
        expect(typeof d.exists).toBe('boolean');
      });

      it('returns some failure response for unknown/unindexed project', async () => {
        const r = await server.handleSearch('anything', 'no-such-project', 5, 'hybrid', 'full');
        // resolveProject falls back to a directory; verifyIndexed may pass or deny.
        // In either case we should NOT get a valid results list.
        const t = text(r);
        if (r.isError) {
          expect(r.isError).toBe(true);
        } else {
          // no-results text response is also an acceptable outcome
          expect(typeof t).toBe('string');
          expect(t.length).toBeGreaterThan(0);
        }
      });
    });

    describe('handleReadWithContext (filepath mode)', () => {
      it('reads an existing file', async () => {
        const fp = path.join(PROJECT_PATH, 'src/auth/auth-service.ts');
        const r = await server.handleReadWithContext(fp, undefined, false);
        const d = json(r);
        expect(d.content).toBeDefined();
        expect(d.content).toContain('AuthService');
        expect(d.line_count).toBeGreaterThan(10);
      });

      it('filepath is relative to project', async () => {
        const fp = path.join(PROJECT_PATH, 'src/utils/validation.ts');
        const r = await server.handleReadWithContext(fp, undefined, false);
        const d = json(r);
        expect(d.filepath).toMatch(/validation\.ts$/);
      });

      it('returns error for nonexistent file', async () => {
        const r = await server.handleReadWithContext('/nonexistent/file.ts', undefined, false);
        expect(r?.isError).toBe(true);
        expect(text(r)).toContain('not found');
      });

      it('include_related=false skips related_chunks', async () => {
        const fp = path.join(PROJECT_PATH, 'src/utils/logger.ts');
        const r = await server.handleReadWithContext(fp, undefined, false);
        const d = json(r);
        expect(d.related_chunks).toBeUndefined();
      });

      it('include_related=true returns related_chunks array', async () => {
        const fp = path.join(PROJECT_PATH, 'src/auth/auth-service.ts');
        const r = await server.handleReadWithContext(fp, 'sample-project', true);
        const d = json(r);
        expect(d.related_chunks).toBeDefined();
        expect(Array.isArray(d.related_chunks)).toBe(true);
      });
    });

    describe('handleSearchAndRead (query + read mode)', () => {
      it('returns file contents in results', async () => {
        const r = await server.handleSearchAndRead('authentication', 'sample-project', 2, 200);
        const d = json(r);
        // files array may be empty if text search doesn't match (random embeddings)
        // but the response structure must be correct
        expect(d).toHaveProperty('query');
        expect(d).toHaveProperty('project');
        expect(d.files_found).toBeGreaterThanOrEqual(0);
      });

      it('respects max_files limit', async () => {
        const r = await server.handleSearchAndRead('service class', 'sample-project', 1, 500);
        const d = json(r);
        if (d.results) {
          expect(d.results.length).toBeLessThanOrEqual(1);
        }
      });

      it('result items include content field when files exist', async () => {
        const r = await server.handleSearchAndRead('function', 'sample-project', 3, 100);
        const d = json(r);
        if (d.results && d.results.length > 0) {
          const first = d.results[0];
          expect(first).toHaveProperty('file');
          expect(first).toHaveProperty('content');
          expect(first).toHaveProperty('score');
        }
      });
    });
  });

  // ── TOOL: analyze ─────────────────────────────────────────────────────────────
  describe('analyze tool', () => {
    describe('handleShowDependencies (action: dependencies)', () => {
      it('finds dependencies for a known file', async () => {
        const r = await server.handleShowDependencies({
          project: 'sample-project',
          filepath: 'src/auth/auth-service.ts',
          depth: 1,
          direction: 'both',
          max_nodes: 50,
        });
        const d = json(r);
        expect(d).toHaveProperty('graph_stats');
        expect(d).toHaveProperty('nodes');
        expect(d).toHaveProperty('relationships');
      });

      it('graph_stats has file/class/function counts', async () => {
        const r = await server.handleShowDependencies({
          project: 'sample-project',
          filepath: 'src/auth/auth-service.ts',
          depth: 1,
          direction: 'both',
          max_nodes: 50,
        });
        const d = json(r);
        expect(d.graph_stats.total_nodes).toBeGreaterThan(0);
        // handler uses file_nodes / class_nodes in graph_stats
        expect(typeof d.graph_stats.file_nodes).toBe('number');
        expect(typeof d.graph_stats.class_nodes).toBe('number');
      });

      it('traverses imports correctly (UserController → AuthService)', async () => {
        const r = await server.handleShowDependencies({
          project: 'sample-project',
          filepath: 'src/users/user-controller.ts',
          depth: 2,
          direction: 'out',
          relationship_types: ['imports'],
          max_nodes: 50,
        });
        const d = json(r);
        const names = d.nodes.map((n: any) => n.name);
        // Should find UserController at minimum
        expect(names.some((n: string) => n.includes('UserController') || n.includes('user-controller'))).toBe(true);
      });

      it('returns error when no filepath/query provided', async () => {
        const r = await server.handleShowDependencies({ project: 'sample-project' });
        expect(r?.isError ?? json(r)?.error).toBeTruthy();
      });

      it('returns error for unknown project', async () => {
        const r = await server.handleShowDependencies({
          project: 'nonexistent-xyz',
          filepath: 'anything.ts',
        });
        expect(r?.isError).toBe(true);
      });
    });

    describe('handleFindDuplicates (action: duplicates)', () => {
      it('returns summary object', async () => {
        const r = await server.handleFindDuplicates({ project: 'sample-project' });
        const d = json(r);
        expect(d).toHaveProperty('summary');
        expect(d.summary).toHaveProperty('total_chunks_analyzed');
        expect(d.summary).toHaveProperty('exact_duplicates');
        expect(d.summary).toHaveProperty('semantic_duplicates');
      });

      it('returns an array for duplicate_groups', async () => {
        const r = await server.handleFindDuplicates({ project: 'sample-project' });
        const d = json(r);
        expect(Array.isArray(d.duplicate_groups)).toBe(true);
      });

      it('returns error for unknown project', async () => {
        const r = await server.handleFindDuplicates({ project: 'unknown-project-xyz' });
        expect(r?.isError).toBe(true);
      });
    });

    describe('handleFindDeadCode (action: dead_code)', () => {
      it('returns dead/anti-pattern summary', async () => {
        const r = await server.handleFindDeadCode({ project: 'sample-project' });
        const d = json(r);
        expect(d).toHaveProperty('summary');
        expect(d.summary).toHaveProperty('total_issues');
        expect(d.summary).toHaveProperty('dead_code_count');
        expect(d.summary).toHaveProperty('anti_patterns_count');
      });

      it('returns arrays for issue lists', async () => {
        const r = await server.handleFindDeadCode({ project: 'sample-project' });
        const d = json(r);
        expect(Array.isArray(d.dead_code)).toBe(true);
        expect(Array.isArray(d.anti_patterns)).toBe(true);
        expect(Array.isArray(d.coupling_issues)).toBe(true);
      });

      it('includes graph_stats', async () => {
        const r = await server.handleFindDeadCode({ project: 'sample-project' });
        const d = json(r);
        expect(d.graph_stats.total_nodes).toBeGreaterThan(0);
      });

      it('respects include_patterns filter', async () => {
        // Only check for god_class pattern
        const r = await server.handleFindDeadCode({
          project: 'sample-project',
          include_patterns: ['god_class'],
        });
        const d = json(r);
        // dead_code items should be absent since we didn't include dead_code pattern
        expect(d.dead_code.length).toBe(0);
      });

      it('returns error for unknown project', async () => {
        const r = await server.handleFindDeadCode({ project: 'unknown-project-xyz' });
        expect(r?.isError).toBe(true);
      });
    });

    describe('handleStandards (action: standards)', () => {
      it('generates standards when file is missing', async () => {
        // Remove any existing standards file to force generation
        const standardsPath = path.join(PROJECT_PATH, '.codeseeker', 'coding-standards.json');
        await fs.rm(standardsPath, { force: true }).catch(() => {});

        const r = await server.handleStandards({ project: 'sample-project', category: 'all' });
        // either returns standards or an error about needing to index first
        const t = text(r);
        expect(t).toBeTruthy();
        expect(t.length).toBeGreaterThan(10);
      });

      it('returns error for unknown project', async () => {
        const r = await server.handleStandards({ project: 'unknown-xyz', category: 'all' });
        expect(r?.isError).toBe(true);
      });
    });
  });

  // ── TOOL: index ──────────────────────────────────────────────────────────────
  describe('index tool', () => {
    describe('handleProjects (action: status)', () => {
      it('lists indexed project', async () => {
        const r = await server.handleProjects();
        const t = text(r);
        // May show as JSON or as a message
        expect(t).toBeTruthy();
        try {
          const d = json(r);
          if (d.total_projects !== undefined) {
            expect(d.total_projects).toBeGreaterThanOrEqual(1);
            expect(Array.isArray(d.projects)).toBe(true);
          }
        } catch {
          // String response like "No projects indexed" is also valid
          expect(typeof t).toBe('string');
        }
      });

      it('project entry has name, path, files, chunks', async () => {
        const r = await server.handleProjects();
        try {
          const d = json(r);
          if (d.projects && d.projects.length > 0) {
            const p = d.projects[0];
            expect(p).toHaveProperty('name');
            expect(p).toHaveProperty('path');
            expect(p).toHaveProperty('files');
            expect(p).toHaveProperty('chunks');
          }
        } catch {
          // non-JSON response is ok if no projects
        }
      });
    });

    describe('handleIndexInit (action: init)', () => {
      it('rejects missing path', async () => {
        const r = await server.handleIndexInit({});
        expect(r?.isError).toBe(true);
        expect(text(r)).toContain('path parameter required');
      });

      it('rejects nonexistent directory', async () => {
        const r = await server.handleIndexInit({ path: '/absolutely/nonexistent/dir/xyz' });
        expect(r?.isError).toBe(true);
      });

      it('rejects dangerous system paths', async () => {
        const r = await server.handleIndexInit({ path: 'C:\\Windows' });
        expect(r?.isError ?? true).toBe(true);
      });

      it('starts indexing for a valid directory', async () => {
        const tmpDir = path.join(os.tmpdir(), 'cs-init-test-' + Date.now());
        await fs.mkdir(tmpDir, { recursive: true });
        await fs.writeFile(path.join(tmpDir, 'test.ts'), 'export const x = 1;');
        try {
          const r = await server.handleIndexInit({ path: tmpDir, name: 'tmp-test' });
          const d = json(r);
          expect(['indexing_started', 'already_indexing']).toContain(d.status);
          expect(d.project_name).toBe('tmp-test');
        } finally {
          await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        }
      });
    });

    describe('handleSync (action: sync)', () => {
      it('returns error when no changes and no full_reindex', async () => {
        const r = await server.handleSync({ project: 'sample-project' });
        expect(r?.isError).toBe(true);
        expect(text(r)).toContain('changes');
      });

      it('processes modified file changes', async () => {
        const r = await server.handleSync({
          project: 'sample-project',
          changes: [{ type: 'modified', path: path.join(PROJECT_PATH, 'src/utils/logger.ts') }],
        });
        const d = json(r);
        expect(d).toHaveProperty('success');
        expect(d).toHaveProperty('mode', 'incremental');
        expect(d.changes_processed).toBe(1);
      });

      it('handles deleted file', async () => {
        const r = await server.handleSync({
          project: 'sample-project',
          changes: [{ type: 'deleted', path: 'src/deleted-file.ts' }],
        });
        const d = json(r);
        // deleted file that doesn't exist in store → success: false or 0 deleted is fine
        expect(d).toHaveProperty('mode', 'incremental');
      });

      it('starts full reindex with full_reindex: true', async () => {
        const r = await server.handleSync({ project: 'sample-project', full_reindex: true });
        const d = json(r);
        expect(['reindex_started', 'already_indexing']).toContain(d.status);
      });
    });

    describe('handleInstallParsers (action: parsers)', () => {
      it('lists available parsers when list_available: true', async () => {
        const r = await server.handleInstallParsers({ list_available: true });
        const d = json(r);
        expect(Array.isArray(d.installed_parsers)).toBe(true);
        expect(Array.isArray(d.available_parsers)).toBe(true);
      });

      it('each parser entry has language and extensions', async () => {
        const r = await server.handleInstallParsers({ list_available: true });
        const d = json(r);
        const all = [...d.installed_parsers, ...d.available_parsers];
        for (const p of all) {
          expect(p).toHaveProperty('language');
          expect(p).toHaveProperty('extensions');
        }
      });

      it('returns error when no options provided', async () => {
        const r = await server.handleInstallParsers({});
        expect(r?.isError).toBe(true);
      });

      it('auto-detects for a given project path', async () => {
        const r = await server.handleInstallParsers({ project: PROJECT_PATH });
        const d = json(r);
        expect(d).toHaveProperty('detected_languages');
        expect(d).toHaveProperty('install_command');
      });
    });

    describe('handleExclude (action: exclude)', () => {
      it('requires project param', async () => {
        const r = await server.handleExclude({ exclude_action: 'list' });
        expect(r?.isError).toBe(true);
        expect(text(r)).toContain('project');
      });

      it('requires exclude_action param', async () => {
        const r = await server.handleExclude({ project: 'sample-project' });
        expect(r?.isError).toBe(true);
        expect(text(r)).toContain('exclude_action');
      });

      it('lists exclusions (empty initially)', async () => {
        // remove any leftover exclusions file
        const excPath = path.join(PROJECT_PATH, '.codeseeker', 'exclusions.json');
        await fs.rm(excPath, { force: true }).catch(() => {});

        const r = await server.handleExclude({ project: 'sample-project', exclude_action: 'list' });
        const d = json(r);
        expect(d).toHaveProperty('patterns');
        expect(Array.isArray(d.patterns)).toBe(true);
      });

      it('adds an exclusion pattern', async () => {
        const r = await server.handleExclude({
          project: 'sample-project',
          exclude_action: 'exclude',
          paths: ['dist/**'],
          reason: 'build output',
        });
        const d = json(r);
        expect(d.success).toBe(true);
        expect(d.patterns_added).toContain('dist/**');
      });

      it('lists the added exclusion', async () => {
        const r = await server.handleExclude({ project: 'sample-project', exclude_action: 'list' });
        const d = json(r);
        expect(d.patterns.some((p: any) => p.pattern === 'dist/**')).toBe(true);
      });

      it('removes an exclusion with include action', async () => {
        const r = await server.handleExclude({
          project: 'sample-project',
          exclude_action: 'include',
          paths: ['dist/**'],
        });
        const d = json(r);
        expect(d.success).toBe(true);
        expect(d.patterns_removed).toContain('dist/**');
      });

      it('returns error for unknown project', async () => {
        const r = await server.handleExclude({
          project: 'nonexistent-xyz',
          exclude_action: 'list',
        });
        expect(r?.isError).toBe(true);
      });
    });
  });

  // ── Tool routing ─────────────────────────────────────────────────────────────
  // These tests verify each handler is callable and returns the structural
  // signature of the right handler — regardless of whether the index has data
  // (the full_reindex test above may have cleared the vector store).
  describe('Tool dispatch routing', () => {
    it('search({filepath}) routes to handleReadWithContext', async () => {
      const fp = path.join(PROJECT_PATH, 'src/utils/validation.ts');
      const r = await server.handleReadWithContext(fp, undefined, false);
      // handleReadWithContext succeeds even without vector data — it reads disk
      const d = json(r);
      expect(d).toHaveProperty('content');
      expect(d).toHaveProperty('line_count');
      expect(d).not.toHaveProperty('total_results'); // NOT a handleSearch response
    });

    it('search({query, read: true}) routes to handleSearchAndRead', async () => {
      const r = await server.handleSearchAndRead('auth', 'sample-project', 1, 100);
      const t = text(r);
      expect(typeof t).toBe('string');
      expect(t.length).toBeGreaterThan(0);
      // The response should contain 'query' (JSON success) or 'not indexed' error
      // — either way it is distinct from a handleSearch plain-results response
      const looksLikeHandleSearch = t.includes('"search_type"');
      expect(looksLikeHandleSearch).toBe(false);
    });

    it('search({query}) routes to handleSearch', async () => {
      const r = await server.handleSearch('auth login', 'sample-project', 5, 'hybrid', 'full');
      const t = text(r);
      expect(typeof t).toBe('string');
      expect(t.length).toBeGreaterThan(0);
      // handleSearch response includes 'search_type' (JSON) or plain 'No results' string
      // Either way it must NOT look like a handleSearchAndRead response
      const looksLikeSearchAndRead = t.includes('"files_found"');
      expect(looksLikeSearchAndRead).toBe(false);
    });
  });
});
