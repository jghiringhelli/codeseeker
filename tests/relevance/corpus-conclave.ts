/**
 * Conclave Relevance Corpus
 *
 * FTS-only cases against the Conclave monorepo (AI role orchestrator).
 * Every query uses exact symbols / unique string literals from specific
 * source files. No synthetic embeddings needed.
 *
 * Fixture roots:
 *   packages/core/src/
 *   packages/roles/src/
 *   packages/mcp-server/src/
 */

export interface FtsCorpusCase {
  id: string;
  query: string;
  mustFind: string[];
  maxRank: number;
  mustNotFind?: string[];
  minResults?: number;
  tags: string[];
  description: string;
}

export const CONCLAVE_CORPUS: FtsCorpusCase[] = [
  // ── Core engine — DAG ─────────────────────────────────────────────────────
  {
    id: 'cv-dag',
    query: 'topologicalSort getCriticalPath DagCycleError detectCycle',
    mustFind: ['dag-engine'],
    maxRank: 2,
    tags: ['exact-symbol'],
    description: 'topologicalSort and getCriticalPath are unique to dag-engine.ts',
  },
  {
    id: 'cv-dag-errors',
    query: 'DagCycleError DagDuplicateNodeError DagInvalidDependencyError DagNodeNotFoundError',
    mustFind: ['dag-engine'],
    maxRank: 2,
    tags: ['exact-symbol'],
    description: 'Dag-specific error classes defined only in dag-engine.ts',
  },

  // ── Core engine — Bounce protocol ─────────────────────────────────────────
  {
    id: 'cv-bounce',
    query: 'escalate_tech_lead ESCALATE_TECH_LEAD_AT SUMMARIZE_AT BounceExceededError',
    mustFind: ['bounce-protocol'],
    maxRank: 2,
    tags: ['exact-symbol'],
    description: 'Bounce constants and escalation actions defined only in bounce-protocol.ts',
  },
  {
    id: 'cv-bounce-actions',
    query: 'bounceCount recordBounce determineAction getHumanEscalations resolveThread',
    mustFind: ['bounce-protocol'],
    maxRank: 2,
    tags: ['exact-symbol'],
    description: 'BounceProtocol public methods unique to bounce-protocol.ts',
  },

  // ── Roles — Registry ──────────────────────────────────────────────────────
  {
    id: 'cv-registry',
    query: 'spawnInstance teardownInstance findIdleInstances tokensConsumed instanceCounters',
    mustFind: ['registry'],
    maxRank: 2,
    tags: ['exact-symbol'],
    description: 'RoleRegistry lifecycle and token tracking methods in registry.ts',
  },

  // ── Roles — Executor ──────────────────────────────────────────────────────
  {
    id: 'cv-executor',
    query: 'pendingGates approveGate rejectGate ConfirmationGate handleTaskAssigned',
    mustFind: ['role-executor'],
    maxRank: 2,
    tags: ['exact-symbol'],
    description: 'Gate management methods defined only in role-executor.ts',
  },
  {
    id: 'cv-execution-mode',
    query: 'ExecutionMode autonomous supervised interactive',
    mustFind: ['role-executor', 'types'],
    maxRank: 4,
    minResults: 2,
    tags: ['exact-symbol', 'cross-file'],
    description: 'ExecutionMode declared in types.ts, dispatched in role-executor.ts — both should surface',
  },

  // ── Core — Orchestrator ───────────────────────────────────────────────────
  {
    id: 'cv-orchestrator',
    query: 'checkpoint resume phase_change tickIntervalMs executionMode maxConcurrentRoles',
    mustFind: ['orchestrator'],
    maxRank: 2,
    tags: ['exact-symbol'],
    description: 'Orchestrator config fields and event types unique to orchestrator.ts',
  },

  // ── Semantic / architectural ──────────────────────────────────────────────
  {
    id: 'cv-pipeline',
    query: 'STANDARD_PIPELINE pipeline phases planning executing reviewing',
    mustFind: ['pipeline-template'],
    maxRank: 3,
    tags: ['exact-keyword'],
    description: 'STANDARD_PIPELINE constant and phase names in pipeline-template.ts',
  },
  {
    id: 'cv-prompts',
    query: 'loadSystemPrompt role architect developer code_reviewer security',
    mustFind: ['orchestrator', 'role-executor'],
    maxRank: 5,
    minResults: 2,
    tags: ['exact-keyword', 'cross-file'],
    description: 'System prompt loading spans orchestrator and role-executor',
  },

  // ── Out-of-scope ──────────────────────────────────────────────────────────
  {
    id: 'cv-empty-bcrypt',
    query: 'bcrypt password hash salt rounds compare',
    mustFind: [],
    maxRank: 1,
    mustNotFind: ['orchestrator', 'dag-engine', 'registry'],
    tags: ['empty-scope'],
    description: 'Auth-specific query on an orchestration codebase — FTS should return empty',
  },
  {
    id: 'cv-empty-css',
    query: 'flexbox grid media query CSS breakpoint viewport',
    mustFind: [],
    maxRank: 1,
    mustNotFind: ['bounce-protocol', 'dag-engine', 'role-executor'],
    tags: ['empty-scope'],
    description: 'Frontend styling query on a backend orchestrator — no matches expected',
  },
];

/** Monorepo root for Conclave */
export const CONCLAVE_ROOT = 'C:\\workspace\\claude\\conclave';

/**
 * Key implementation files to index — one entry per file with its relative
 * path from CONCLAVE_ROOT.  Test files excluded to avoid false positives.
 */
export const CONCLAVE_FILES = [
  'packages/core/src/dag/dag-engine.ts',
  'packages/core/src/bounce/bounce-protocol.ts',
  'packages/core/src/orchestrator/orchestrator.ts',
  'packages/core/src/bus/message-bus.ts',
  'packages/core/src/state/state-store.ts',
  'packages/core/src/types.ts',
  'packages/core/src/errors.ts',
  'packages/roles/src/registry.ts',
  'packages/roles/src/role-executor.ts',
  'packages/roles/src/executor.ts',
  'packages/roles/src/pipeline-template.ts',
  'packages/roles/src/prompt-builder.ts',
  'packages/mcp-server/src/server.ts',
];
