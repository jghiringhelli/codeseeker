/**
 * FTS Relevance Tests — ForgeCraft-MCP + Conclave
 *
 * Indexes REAL source files from sibling projects in the workspace using dummy
 * zero-embeddings (vector search disabled), then runs FTS-only search queries
 * and checks precision/recall against the curated corpora.
 *
 * Why FTS-only?
 *  - Vector search requires the Xenova transformer model (slow, non-deterministic)
 *  - FTS on exact function/class names is 100% deterministic and fast
 *  - Validates MiniSearch BM25 + CamelCase tokenization + synonym expansion
 *
 * Skips gracefully if the sibling projects don't exist on disk.
 *
 * Run:
 *   npx jest tests/relevance/fts-relevance --no-coverage
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as crypto from 'crypto';
import {
  getStorageManager,
  resetStorageManager,
  StorageManager,
} from '../../src/storage';
import type { IVectorStore, IProjectStore } from '../../src/storage/interfaces';
import { SemanticSearchOrchestrator } from '../../src/cli/commands/services/semantic-search-orchestrator';
import {
  FORGECRAFT_CORPUS,
  FORGECRAFT_FILES,
  FORGECRAFT_SRC,
  type FtsCorpusCase,
} from './corpus-forgecraft';
import {
  CONCLAVE_CORPUS,
  CONCLAVE_FILES,
  CONCLAVE_ROOT,
} from './corpus-conclave';

// ── Helpers ───────────────────────────────────────────────────────────────────

function uuid(): string {
  return crypto.randomUUID();
}

/** Zero-vector embedding (FTS search doesn't use vector similarity) */
const ZERO_EMBEDDING = new Array(384).fill(0);

interface ProjectFixture {
  projectId: string;
  projectPath: string;
  files: string[]; // relative paths from projectPath
}

async function indexProject(
  vectorStore: IVectorStore,
  projectStore: IProjectStore,
  projectPath: string,
  relFiles: string[]
): Promise<ProjectFixture> {
  const projectId = uuid();
  await projectStore.upsert({ id: projectId, name: path.basename(projectPath), path: projectPath });

  const docs = [];
  for (const relPath of relFiles) {
    const absPath = path.join(projectPath, relPath);
    let content: string;
    try {
      content = fsSync.readFileSync(absPath, 'utf-8');
    } catch {
      continue; // file doesn't exist — skip gracefully
    }

    docs.push({
      id: crypto.createHash('md5').update(`${projectId}:${relPath}`).digest('hex'),
      projectId,
      filePath: absPath,
      content,
      embedding: ZERO_EMBEDDING,
      metadata: { fileName: path.basename(relPath), extension: path.extname(relPath) },
    });
  }

  if (docs.length > 0) await vectorStore.upsertMany(docs);

  return { projectId, projectPath, files: relFiles };
}

async function runFtsSearch(
  fixture: ProjectFixture,
  query: string
): Promise<string[]> {
  const orch = new SemanticSearchOrchestrator();
  orch.setProjectId(fixture.projectId);

  const results = await orch.performSemanticSearch(query, fixture.projectPath, 'fts');
  return results.map(r => path.basename(r.file));
}

function assertFtsCase(
  corpusCase: FtsCorpusCase,
  resultFiles: string[],
  label: string
): void {
  for (const expected of corpusCase.mustFind) {
    const rank = resultFiles.findIndex(f => f.includes(expected)) + 1;
    if (rank === 0) {
      throw new Error(`[${corpusCase.id}] ${label}: "${expected}" not found in [${resultFiles.join(', ')}]`);
    }
    if (rank > corpusCase.maxRank) {
      throw new Error(
        `[${corpusCase.id}] ${label}: "${expected}" at rank ${rank} > maxRank ${corpusCase.maxRank}. ` +
        `Top files: [${resultFiles.slice(0, 6).join(', ')}]`
      );
    }
  }

  for (const banned of corpusCase.mustNotFind ?? []) {
    const inTop5 = resultFiles.slice(0, 5).some(f => f.includes(banned));
    if (inTop5) {
      throw new Error(
        `[${corpusCase.id}] ${label}: "${banned}" unexpectedly in top-5: [${resultFiles.slice(0, 5).join(', ')}]`
      );
    }
  }

  if (corpusCase.minResults !== undefined && corpusCase.mustFind.length > 0) {
    expect(resultFiles.length).toBeGreaterThanOrEqual(corpusCase.minResults);
  }
}

// ── Shared storage setup ──────────────────────────────────────────────────────

const TEST_DIR = path.join(os.tmpdir(), `codeseeker-fts-${Date.now()}`);
let storageManager: StorageManager;
let vectorStore: IVectorStore;
let projectStore: IProjectStore;

beforeAll(async () => {
  await fs.mkdir(TEST_DIR, { recursive: true });
  await resetStorageManager();

  process.env.CODESEEKER_DATA_DIR = path.join(TEST_DIR, '.codeseeker-fts');
  process.env.CODESEEKER_STORAGE_MODE = 'embedded';

  storageManager = await getStorageManager();
  vectorStore    = storageManager.getVectorStore();
  projectStore   = storageManager.getProjectStore();
}, 60_000);

afterAll(async () => {
  try { await storageManager.closeAll(); } catch { /* ignore */ }
  try { await fs.rm(TEST_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
});

// ── ForgeCraft corpus ─────────────────────────────────────────────────────────

describe('FTS Relevance — ForgeCraft-MCP', () => {
  let fixture: ProjectFixture;
  const forgecraftExists = fsSync.existsSync(FORGECRAFT_SRC);

  beforeAll(async () => {
    if (!forgecraftExists) return;
    fixture = await indexProject(vectorStore, projectStore, FORGECRAFT_SRC, FORGECRAFT_FILES);
  }, 60_000);

  for (const corpusCase of FORGECRAFT_CORPUS) {
    it(`[${corpusCase.id}] ${corpusCase.description}`, async () => {
      if (!forgecraftExists) {
        console.warn(`Skipping: ForgeCraft not found at ${FORGECRAFT_SRC}`);
        return;
      }
      const files = await runFtsSearch(fixture, corpusCase.query);
      assertFtsCase(corpusCase, files, 'fts');
    });
  }

  it('corpus has cases', () => {
    expect(FORGECRAFT_CORPUS.length).toBeGreaterThanOrEqual(6);
  });
});

// ── Conclave corpus ───────────────────────────────────────────────────────────

describe('FTS Relevance — Conclave', () => {
  let fixture: ProjectFixture;
  const conclaveExists = fsSync.existsSync(CONCLAVE_ROOT);

  beforeAll(async () => {
    if (!conclaveExists) return;
    fixture = await indexProject(vectorStore, projectStore, CONCLAVE_ROOT, CONCLAVE_FILES);
  }, 60_000);

  for (const corpusCase of CONCLAVE_CORPUS) {
    it(`[${corpusCase.id}] ${corpusCase.description}`, async () => {
      if (!conclaveExists) {
        console.warn(`Skipping: Conclave not found at ${CONCLAVE_ROOT}`);
        return;
      }
      const files = await runFtsSearch(fixture, corpusCase.query);
      assertFtsCase(corpusCase, files, 'fts');
    });
  }

  it('corpus has cases', () => {
    expect(CONCLAVE_CORPUS.length).toBeGreaterThanOrEqual(6);
  });
});

// ── Corpus metadata ───────────────────────────────────────────────────────────

describe('FTS corpus metadata', () => {
  it('ForgeCraft: every mustFind is a non-empty string', () => {
    for (const c of FORGECRAFT_CORPUS) {
      for (const f of c.mustFind) {
        expect(f.length).toBeGreaterThan(0);
      }
    }
  });

  it('Conclave: every mustFind is a non-empty string', () => {
    for (const c of CONCLAVE_CORPUS) {
      for (const f of c.mustFind) {
        expect(f.length).toBeGreaterThan(0);
      }
    }
  });

  it('all maxRanks are 1-10', () => {
    for (const c of [...FORGECRAFT_CORPUS, ...CONCLAVE_CORPUS]) {
      expect(c.maxRank).toBeGreaterThanOrEqual(1);
      expect(c.maxRank).toBeLessThanOrEqual(10);
    }
  });
});
