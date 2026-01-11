/**
 * MiniSearch-based Text Store
 *
 * Provides full-text search using MiniSearch with:
 * - BM25 scoring algorithm
 * - CamelCase-aware tokenization for code
 * - Synonym expansion for better query matching
 * - Persistence to SQLite
 * - Per-project document isolation
 *
 * Zero external dependencies beyond MiniSearch - works immediately.
 */

import MiniSearch from 'minisearch';
import Database, { Database as DatabaseType } from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import {
  ITextStore,
  TextDocument,
  TextSearchResult,
  Synonym
} from '../interfaces';

interface IndexedDocument {
  id: string;
  projectId: string;
  filePath: string;
  content: string;
  metadata?: string; // JSON stringified
}

export class MiniSearchTextStore implements ITextStore {
  private db: DatabaseType;
  private miniSearch: MiniSearch<IndexedDocument>;
  private synonymMap: Map<string, string[]> = new Map();
  private isDirty = false;
  private flushTimer: NodeJS.Timeout | null = null;
  private documentMap: Map<string, TextDocument> = new Map();
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;

  constructor(
    private dataDir: string,
    private flushIntervalSeconds = 30
  ) {
    // Ensure data directory exists
    fs.mkdirSync(dataDir, { recursive: true });

    const dbPath = path.join(dataDir, 'text-search.db');
    this.db = new Database(dbPath);

    // Enable WAL mode for better performance
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');

    this.initializeSchema();
    this.miniSearch = this.createMiniSearch();
    // LAZY LOADING: Don't load documents on startup - defer until first search
    // This prevents MCP server timeout during initialization
    this.startFlushTimer();
  }

  /**
   * Ensure documents are loaded before search operations
   * Uses lazy loading to avoid blocking MCP server startup
   */
  private async ensureLoaded(): Promise<void> {
    if (this.isLoaded) return;

    // Prevent concurrent loading
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = new Promise<void>((resolve) => {
      this.loadFromDatabase();
      this.isLoaded = true;
      resolve();
    });

    return this.loadPromise;
  }

  /**
   * Custom tokenizer that handles CamelCase, snake_case, and kebab-case
   * for better code search
   */
  private tokenize(text: string): string[] {
    const tokens: string[] = [];

    // Split on whitespace and punctuation first
    const words = text.split(/[\s\-_./\\:;,!?()[\]{}'"<>]+/);

    for (const word of words) {
      if (!word) continue;

      // Add the whole word
      tokens.push(word.toLowerCase());

      // Split CamelCase: "getUserById" -> ["get", "user", "by", "id"]
      const camelParts = word.split(/(?=[A-Z])/);
      if (camelParts.length > 1) {
        for (const part of camelParts) {
          if (part.length > 1) {
            tokens.push(part.toLowerCase());
          }
        }
      }

      // Also add acronym handling: "XMLParser" -> ["xml", "parser"]
      const acronymMatch = word.match(/^([A-Z]+)([A-Z][a-z]+)/);
      if (acronymMatch) {
        tokens.push(acronymMatch[1].toLowerCase());
        tokens.push(acronymMatch[2].toLowerCase());
      }
    }

    // Filter out very short tokens and duplicates
    const seen = new Set<string>();
    return tokens.filter(t => {
      if (t.length < 2 || seen.has(t)) return false;
      seen.add(t);
      return true;
    });
  }

  private createMiniSearch(): MiniSearch<IndexedDocument> {
    return new MiniSearch<IndexedDocument>({
      fields: ['content', 'filePath'],
      storeFields: ['id', 'projectId', 'filePath', 'content', 'metadata'],
      tokenize: this.tokenize.bind(this),
      searchOptions: {
        boost: { filePath: 2 }, // Boost file path matches
        fuzzy: 0.2, // Allow some typo tolerance
        prefix: true // Enable prefix matching
      }
    });
  }

  private initializeSchema(): void {
    // Documents table for persistence
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS text_documents (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_text_documents_project ON text_documents(project_id);
      CREATE INDEX IF NOT EXISTS idx_text_documents_file ON text_documents(file_path);
    `);

    // Synonyms table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS text_synonyms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        term TEXT NOT NULL,
        synonyms TEXT NOT NULL,
        project_id TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(term, project_id)
      );

      CREATE INDEX IF NOT EXISTS idx_text_synonyms_term ON text_synonyms(term);
      CREATE INDEX IF NOT EXISTS idx_text_synonyms_project ON text_synonyms(project_id);
    `);
  }

  private loadFromDatabase(): void {
    // Load documents
    const docs = this.db.prepare(`
      SELECT id, project_id, file_path, content, metadata
      FROM text_documents
    `).all() as Array<{
      id: string;
      project_id: string;
      file_path: string;
      content: string;
      metadata: string | null;
    }>;

    const indexDocs: IndexedDocument[] = docs.map(row => ({
      id: row.id,
      projectId: row.project_id,
      filePath: row.file_path,
      content: row.content,
      metadata: row.metadata || undefined
    }));

    if (indexDocs.length > 0) {
      this.miniSearch.addAll(indexDocs);
    }

    // Build document map for retrieval
    for (const doc of docs) {
      this.documentMap.set(doc.id, {
        id: doc.id,
        projectId: doc.project_id,
        filePath: doc.file_path,
        content: doc.content,
        metadata: doc.metadata ? JSON.parse(doc.metadata) : undefined
      });
    }

    // Load synonyms
    const synonyms = this.db.prepare(`
      SELECT term, synonyms, project_id
      FROM text_synonyms
    `).all() as Array<{
      term: string;
      synonyms: string;
      project_id: string | null;
    }>;

    for (const row of synonyms) {
      const key = row.project_id ? `${row.project_id}:${row.term}` : row.term;
      this.synonymMap.set(key, JSON.parse(row.synonyms));
    }

    console.log(`[MiniSearch] Loaded ${docs.length} documents, ${synonyms.length} synonym rules`);
  }

  private startFlushTimer(): void {
    if (this.flushIntervalSeconds > 0) {
      this.flushTimer = setInterval(() => {
        if (this.isDirty) {
          this.flush().catch(console.error);
        }
      }, this.flushIntervalSeconds * 1000);
    }
  }

  async index(doc: TextDocument): Promise<void> {
    const now = new Date().toISOString();
    const metadata = doc.metadata ? JSON.stringify(doc.metadata) : null;

    // Upsert to SQLite
    this.db.prepare(`
      INSERT INTO text_documents (id, project_id, file_path, content, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        file_path = excluded.file_path,
        content = excluded.content,
        metadata = excluded.metadata,
        updated_at = excluded.updated_at
    `).run(doc.id, doc.projectId, doc.filePath, doc.content, metadata, now, now);

    // Update MiniSearch index
    const indexDoc: IndexedDocument = {
      id: doc.id,
      projectId: doc.projectId,
      filePath: doc.filePath,
      content: doc.content,
      metadata: metadata || undefined
    };

    // Remove old version if exists
    if (this.miniSearch.has(doc.id)) {
      this.miniSearch.discard(doc.id);
    }

    this.miniSearch.add(indexDoc);
    this.documentMap.set(doc.id, doc);
    this.isDirty = true;
    // Mark as loaded since we now have in-memory data
    // This prevents ensureLoaded from trying to re-add documents
    this.isLoaded = true;
  }

  async indexMany(docs: TextDocument[]): Promise<void> {
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO text_documents (id, project_id, file_path, content, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        file_path = excluded.file_path,
        content = excluded.content,
        metadata = excluded.metadata,
        updated_at = excluded.updated_at
    `);

    const insertMany = this.db.transaction((documents: TextDocument[]) => {
      const indexDocs: IndexedDocument[] = [];

      for (const doc of documents) {
        const metadata = doc.metadata ? JSON.stringify(doc.metadata) : null;
        stmt.run(doc.id, doc.projectId, doc.filePath, doc.content, metadata, now, now);

        // Remove old version from index
        if (this.miniSearch.has(doc.id)) {
          this.miniSearch.discard(doc.id);
        }

        indexDocs.push({
          id: doc.id,
          projectId: doc.projectId,
          filePath: doc.filePath,
          content: doc.content,
          metadata: metadata || undefined
        });

        this.documentMap.set(doc.id, doc);
      }

      // Bulk add to MiniSearch
      this.miniSearch.addAll(indexDocs);
    });

    insertMany(docs);
    this.isDirty = true;
    // Mark as loaded since we now have in-memory data
    this.isLoaded = true;
  }

  async search(query: string, projectId: string, limit = 10): Promise<TextSearchResult[]> {
    // Ensure documents are loaded (lazy loading for fast MCP startup)
    await this.ensureLoaded();

    // Tokenize query for matched terms tracking
    const queryTokens = this.tokenize(query);

    // Search with MiniSearch
    const results = this.miniSearch.search(query, {
      filter: (result) => result.projectId === projectId
    });

    return results.slice(0, limit).map(result => {
      const doc = this.documentMap.get(result.id);
      if (!doc) {
        // Fallback if not in map
        return {
          document: {
            id: result.id,
            projectId: result.projectId,
            filePath: result.filePath,
            content: result.content,
            metadata: result.metadata ? JSON.parse(result.metadata) : undefined
          },
          score: result.score,
          matchedTerms: result.terms
        };
      }

      return {
        document: doc,
        score: result.score,
        matchedTerms: result.terms
      };
    });
  }

  async searchWithSynonyms(query: string, projectId: string, limit = 10): Promise<TextSearchResult[]> {
    // Ensure documents are loaded (lazy loading for fast MCP startup)
    await this.ensureLoaded();

    // Expand query with synonyms
    const { expandedQuery, synonymsApplied } = this.expandQueryWithSynonyms(query, projectId);

    // Only log if actual synonyms were applied (not just tokenization)
    if (synonymsApplied.length > 0) {
      const synonymInfo = synonymsApplied.map(s => `${s.term}→${s.synonyms.join(',')}`).join('; ');
      console.log(`[MiniSearch] 🔄 Synonym expansion: ${synonymInfo}`);
    }

    return this.search(expandedQuery, projectId, limit);
  }

  private expandQueryWithSynonyms(query: string, projectId: string): { expandedQuery: string; synonymsApplied: Array<{ term: string; synonyms: string[] }> } {
    const tokens = this.tokenize(query);
    const expandedTokens: string[] = [];
    const synonymsApplied: Array<{ term: string; synonyms: string[] }> = [];

    for (const token of tokens) {
      expandedTokens.push(token);

      // Check project-specific synonyms first
      const projectKey = `${projectId}:${token}`;
      if (this.synonymMap.has(projectKey)) {
        const synonyms = this.synonymMap.get(projectKey)!;
        expandedTokens.push(...synonyms);
        synonymsApplied.push({ term: token, synonyms });
      }

      // Then check global synonyms
      if (this.synonymMap.has(token)) {
        const synonyms = this.synonymMap.get(token)!;
        expandedTokens.push(...synonyms);
        synonymsApplied.push({ term: token, synonyms });
      }
    }

    return { expandedQuery: expandedTokens.join(' '), synonymsApplied };
  }

  async remove(id: string): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM text_documents WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes > 0) {
      if (this.miniSearch.has(id)) {
        this.miniSearch.discard(id);
      }
      this.documentMap.delete(id);
      this.isDirty = true;
      return true;
    }

    return false;
  }

  async removeByProject(projectId: string): Promise<number> {
    // Get IDs first for MiniSearch removal
    const ids = this.db.prepare(
      'SELECT id FROM text_documents WHERE project_id = ?'
    ).all(projectId) as Array<{ id: string }>;

    // Delete from SQLite
    const stmt = this.db.prepare('DELETE FROM text_documents WHERE project_id = ?');
    const result = stmt.run(projectId);

    // Remove from MiniSearch
    for (const { id } of ids) {
      if (this.miniSearch.has(id)) {
        this.miniSearch.discard(id);
      }
      this.documentMap.delete(id);
    }

    this.isDirty = true;
    return result.changes;
  }

  async addSynonym(term: string, synonyms: string[], projectId?: string): Promise<void> {
    const now = new Date().toISOString();
    const synonymsJson = JSON.stringify(synonyms);

    this.db.prepare(`
      INSERT INTO text_synonyms (term, synonyms, project_id, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(term, project_id) DO UPDATE SET
        synonyms = excluded.synonyms
    `).run(term.toLowerCase(), synonymsJson, projectId || null, now);

    // Update in-memory map
    const key = projectId ? `${projectId}:${term.toLowerCase()}` : term.toLowerCase();
    this.synonymMap.set(key, synonyms.map(s => s.toLowerCase()));
    this.isDirty = true;
  }

  async removeSynonym(term: string, projectId?: string): Promise<boolean> {
    const stmt = projectId
      ? this.db.prepare('DELETE FROM text_synonyms WHERE term = ? AND project_id = ?')
      : this.db.prepare('DELETE FROM text_synonyms WHERE term = ? AND project_id IS NULL');

    const result = projectId
      ? stmt.run(term.toLowerCase(), projectId)
      : stmt.run(term.toLowerCase());

    if (result.changes > 0) {
      const key = projectId ? `${projectId}:${term.toLowerCase()}` : term.toLowerCase();
      this.synonymMap.delete(key);
      this.isDirty = true;
      return true;
    }

    return false;
  }

  async getSynonyms(projectId?: string): Promise<Synonym[]> {
    const stmt = projectId
      ? this.db.prepare('SELECT term, synonyms, project_id FROM text_synonyms WHERE project_id = ? OR project_id IS NULL')
      : this.db.prepare('SELECT term, synonyms, project_id FROM text_synonyms');

    const rows = projectId
      ? stmt.all(projectId) as Array<{ term: string; synonyms: string; project_id: string | null }>
      : stmt.all() as Array<{ term: string; synonyms: string; project_id: string | null }>;

    return rows.map(row => ({
      term: row.term,
      synonyms: JSON.parse(row.synonyms),
      projectId: row.project_id || undefined
    }));
  }

  async clearSynonyms(projectId?: string): Promise<void> {
    if (projectId) {
      this.db.prepare('DELETE FROM text_synonyms WHERE project_id = ?').run(projectId);

      // Clear from map
      for (const key of this.synonymMap.keys()) {
        if (key.startsWith(`${projectId}:`)) {
          this.synonymMap.delete(key);
        }
      }
    } else {
      this.db.prepare('DELETE FROM text_synonyms').run();
      this.synonymMap.clear();
    }

    this.isDirty = true;
  }

  async count(projectId: string): Promise<number> {
    const result = this.db.prepare(
      'SELECT COUNT(*) as count FROM text_documents WHERE project_id = ?'
    ).get(projectId) as { count: number };

    return result.count;
  }

  async flush(): Promise<void> {
    // SQLite with WAL mode auto-persists, but we can checkpoint
    this.db.pragma('wal_checkpoint(PASSIVE)');
    this.isDirty = false;
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
    this.db.close();
  }

  /**
   * Get default code-related synonyms for bootstrapping
   */
  static getDefaultCodeSynonyms(): Array<{ term: string; synonyms: string[] }> {
    return [
      // Common programming synonyms
      { term: 'function', synonyms: ['method', 'func', 'procedure', 'fn'] },
      { term: 'class', synonyms: ['type', 'struct', 'object'] },
      { term: 'interface', synonyms: ['contract', 'protocol', 'trait'] },
      { term: 'variable', synonyms: ['var', 'const', 'let', 'field', 'property'] },
      { term: 'array', synonyms: ['list', 'collection', 'vector'] },
      { term: 'string', synonyms: ['str', 'text', 'varchar'] },
      { term: 'number', synonyms: ['int', 'integer', 'float', 'double', 'numeric'] },
      { term: 'boolean', synonyms: ['bool', 'flag'] },
      { term: 'null', synonyms: ['nil', 'none', 'undefined', 'void'] },
      { term: 'error', synonyms: ['exception', 'fault', 'failure'] },
      { term: 'async', synonyms: ['asynchronous', 'concurrent', 'parallel'] },
      { term: 'callback', synonyms: ['handler', 'listener', 'hook'] },
      { term: 'module', synonyms: ['package', 'namespace', 'library'] },
      { term: 'import', synonyms: ['require', 'include', 'use'] },
      { term: 'export', synonyms: ['expose', 'public'] },
      { term: 'database', synonyms: ['db', 'datastore', 'storage'] },
      { term: 'query', synonyms: ['search', 'find', 'select', 'fetch'] },
      { term: 'create', synonyms: ['add', 'insert', 'new', 'make'] },
      { term: 'update', synonyms: ['modify', 'change', 'edit', 'patch'] },
      { term: 'delete', synonyms: ['remove', 'destroy', 'drop'] },
      { term: 'read', synonyms: ['get', 'fetch', 'retrieve', 'load'] },
      { term: 'api', synonyms: ['endpoint', 'route', 'service'] },
      { term: 'config', synonyms: ['configuration', 'settings', 'options'] },
      { term: 'test', synonyms: ['spec', 'unit', 'assertion'] },
      { term: 'mock', synonyms: ['stub', 'fake', 'spy'] },

      // Validation and form synonyms (Zod, Yup, react-hook-form, etc.)
      { term: 'validation', synonyms: ['validate', 'validator', 'schema', 'zod', 'yup', 'joi'] },
      { term: 'schema', synonyms: ['validation', 'validator', 'zod', 'yup', 'joi'] },
      { term: 'zod', synonyms: ['validation', 'schema', 'zodResolver', 'zodSchema'] },
      { term: 'form', synonyms: ['useForm', 'formState', 'register', 'handleSubmit'] },
      { term: 'resolver', synonyms: ['zodResolver', 'yupResolver', 'hookform'] },

      // Authentication and authorization
      { term: 'auth', synonyms: ['authentication', 'authorization', 'login', 'session', 'token'] },
      { term: 'login', synonyms: ['signin', 'authenticate', 'auth'] },
      { term: 'logout', synonyms: ['signout', 'disconnect', 'unauthenticate'] },
      { term: 'password', synonyms: ['pwd', 'credential', 'secret'] },
      { term: 'token', synonyms: ['jwt', 'bearer', 'session', 'accessToken'] },

      // Common UI/React patterns
      { term: 'component', synonyms: ['widget', 'element', 'view'] },
      { term: 'hook', synonyms: ['useEffect', 'useState', 'useCallback', 'useMemo'] },
      { term: 'state', synonyms: ['store', 'context', 'redux', 'zustand'] },
      { term: 'props', synonyms: ['properties', 'attributes', 'params'] }
    ];
  }
}