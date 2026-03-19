/**
 * Relevance Corpus
 *
 * Curated (query, expectedFiles, maxRank, tags) test cases for evaluating
 * search quality. Each case defines what a correct search pipeline must return.
 *
 * Design principles:
 *  - expectedFiles are matched by basename substring (not full path) for portability
 *  - maxRank: expected file must appear within this rank position (1-based)
 *  - tags: categorize the query type for grouped analysis
 *  - minScore: minimum similarity score acceptable for top result
 *
 * Corpus covers:
 *  1. Exact keyword / symbol name
 *  2. Semantic (no exact keywords in file)
 *  3. Cross-directory (relevant files in multiple dirs)
 *  4. Empty / out-of-scope (should return no false positives)
 *  5. Method-level precision (specific function, not just the file)
 *  6. Abstract / architectural queries (RAPTOR L2 should help)
 */

export interface CorpusCase {
  id: string;
  query: string;
  /** Basenames (substring match) that MUST appear in results */
  mustFind: string[];
  /** All mustFind items must appear within this rank (1-based, inclusive) */
  maxRank: number;
  /** Optional: result count must be >= this */
  minResults?: number;
  /** Optional: top result score must be >= this */
  minTopScore?: number;
  /** Optional: these basenames must NOT appear in top-5 (false-positive check) */
  mustNotFind?: string[];
  tags: Array<
    | 'exact-keyword'
    | 'exact-symbol'
    | 'semantic'
    | 'cross-directory'
    | 'empty-scope'
    | 'method-level'
    | 'architectural'
    | 'duplicate-detection'
  >;
  description: string;
}

export const CORPUS: CorpusCase[] = [
  // ── Exact keyword ──────────────────────────────────────────────────────────
  {
    id: 'exact-bcrypt',
    query: 'bcrypt password hashing',
    mustFind: ['UserService', 'user-service'],
    maxRank: 5,   // FTS BM25 ranks primary file at 1-2; secondary can fall to ~4
    minResults: 2,
    tags: ['exact-keyword'],
    description: 'Both service files that import and use bcrypt must surface',
  },
  {
    id: 'exact-jwt',
    query: 'jwt sign token expiresIn',
    mustFind: ['UserService'],
    maxRank: 2,
    minTopScore: 0.2,
    tags: ['exact-keyword'],
    description: 'UserService uses jwt.sign — must rank near top',
  },
  {
    id: 'exact-contract-validation',
    query: 'contract validation rules',
    mustFind: ['contract-validator'],
    maxRank: 3,
    tags: ['exact-keyword'],
    description: 'Dedicated contract validator file must surface',
  },

  // ── Exact symbol ───────────────────────────────────────────────────────────
  {
    id: 'symbol-registerUser',
    query: 'registerUser function',
    mustFind: ['MegaController'],
    maxRank: 3,
    tags: ['exact-symbol'],
    description: 'registerUser is a method in MegaController',
  },
  {
    id: 'symbol-authenticate',
    query: 'authenticate user credentials',
    mustFind: ['UserService'],
    maxRank: 3,
    tags: ['exact-symbol'],
    description: 'authenticate() is explicitly defined in UserService',
  },
  {
    id: 'symbol-getUserById',
    query: 'getUserById method',
    mustFind: ['UserController'],
    maxRank: 4,
    tags: ['exact-symbol', 'method-level'],
    description: 'getUserById defined in UserController',
  },

  // ── Semantic (no exact keyword match) ─────────────────────────────────────
  {
    id: 'semantic-auth-flow',
    query: 'user login session management',
    mustFind: ['UserService', 'MegaController'],
    maxRank: 5,
    tags: ['semantic'],
    description: 'Login/session semantically maps to auth files even without exact words',
  },
  {
    id: 'semantic-data-layer',
    query: 'database record persistence',
    mustFind: ['UserService'],
    maxRank: 5,
    tags: ['semantic'],
    description: 'Persistence semantics should surface service files using repositories',
  },

  // ── Cross-directory ────────────────────────────────────────────────────────
  {
    id: 'cross-dir-user-system',
    query: 'user management authentication validation',
    mustFind: ['UserService', 'UserController'],
    maxRank: 5,
    minResults: 3,
    tags: ['cross-directory', 'semantic'],
    description: 'User-related files span controllers/ and services/ — both must surface',
  },
  {
    id: 'cross-dir-business',
    query: 'business logic processing factory',
    mustFind: ['BusinessLogic', 'ProcessorFactory'],
    maxRank: 6,
    tags: ['cross-directory'],
    description: 'Business logic files exist in controllers/ and services/',
  },

  // ── Empty / out-of-scope ───────────────────────────────────────────────────
  // NOTE: Hybrid search always returns results (no min-score cutoff). These
  // cases document that out-of-domain queries DON'T surface the right files
  // (mustFind: []) but make no strong mustNotFind claim — zero-similarity
  // files are ranked by arbitrary row order and can land anywhere in top-5.
  // For mustNotFind guarantees, see the FTS-only corpus in corpus-forgecraft /
  // corpus-conclave where text search produces empty results for non-matching
  // queries.
  {
    id: 'empty-kubernetes',
    query: 'kubernetes helm chart deployment ingress',
    mustFind: [],
    maxRank: 1,
    tags: ['empty-scope'],
    description: 'DevOps query on a business-logic codebase — no specific files required; tests that search completes without error',
  },
  {
    id: 'empty-ml',
    query: 'neural network training gradient descent loss function',
    mustFind: [],
    maxRank: 1,
    tags: ['empty-scope'],
    description: 'ML query on a JS codebase — no specific files required; tests graceful handling of zero-match queries',
  },

  // ── Duplicate detection ────────────────────────────────────────────────────
  {
    id: 'duplicate-auth',
    query: 'duplicate authentication bcrypt login',
    mustFind: ['UserService', 'user-service'],
    maxRank: 4,
    minResults: 2,
    tags: ['duplicate-detection', 'exact-keyword'],
    description: 'Both UserService.js and user-service.js implement bcrypt auth — both must surface',
  },

  // ── Architectural (benefits from RAPTOR L2 directory nodes) ───────────────
  {
    id: 'arch-controllers',
    query: 'what do the controllers do',
    mustFind: ['MegaController', 'UserController'],
    maxRank: 5,
    tags: ['architectural'],
    description: 'Abstract architectural query — directory-level RAPTOR should surface controllers',
  },
  {
    id: 'arch-services',
    query: 'service layer business logic',
    mustFind: ['UserService', 'ProcessorFactory'],
    maxRank: 6,
    tags: ['architectural'],
    description: 'Service-layer query should surface services directory files',
  },
];

/** Lookup a case by ID */
export function getCase(id: string): CorpusCase {
  const c = CORPUS.find(x => x.id === id);
  if (!c) throw new Error(`Corpus case not found: ${id}`);
  return c;
}

/** All cases for a given tag */
export function getCasesByTag(tag: CorpusCase['tags'][number]): CorpusCase[] {
  return CORPUS.filter(c => c.tags.includes(tag));
}
