/**
 * ForgeCraft-MCP Relevance Corpus
 *
 * FTS-only cases: every query uses exact function names / interface names / unique
 * string literals that are present in EXACTLY ONE primary source file.
 * No synthetic embeddings needed — text search alone should route correctly.
 *
 * Fixture root: C:\workspace\claude\forgecraft-mcp\src
 */

import type { CorpusCase } from './corpus';

export interface FtsCorpusCase {
  id: string;
  query: string;
  /** Basenames that MUST appear within maxRank */
  mustFind: string[];
  maxRank: number;
  /** These basenames must NOT appear in top-5 (false-positive check) */
  mustNotFind?: string[];
  minResults?: number;
  tags: string[];
  description: string;
}

export const FORGECRAFT_CORPUS: FtsCorpusCase[] = [
  // ── Exact function names ──────────────────────────────────────────────────
  {
    id: 'fc-scorer',
    query: 'scoreGsProperties findDirectDbCallsInRoutes findMissingTestFiles',
    mustFind: ['gs-scorer'],
    maxRank: 2,
    tags: ['exact-symbol'],
    description: 'scoreGsProperties is defined only in gs-scorer.ts — should rank #1',
  },
  {
    id: 'fc-probes',
    query: 'probeLayerViolations probeLoc probeCoverage probeComplexity probeMutation',
    mustFind: ['code-probes'],
    maxRank: 2,
    tags: ['exact-symbol'],
    description: 'All probe* functions are defined only in code-probes.ts',
  },
  {
    id: 'fc-properties',
    query: 'SelfDescribingSpec BoundedSpec VerifiableSpec DefendedSpec AuditableSpec ComposableSpec',
    mustFind: ['properties'],
    maxRank: 2,
    tags: ['exact-symbol'],
    description: '6 GS property interfaces exported only from properties.ts',
  },
  {
    id: 'fc-verify',
    query: 'verifyHandler pass_threshold testSuite overallPass propertyScores',
    mustFind: ['verify'],
    maxRank: 2,
    tags: ['exact-symbol'],
    description: 'Unique verify.ts symbols: verifyHandler + verify-specific params',
  },
  {
    id: 'fc-audit',
    query: 'auditProjectHandler include_anti_patterns checkCompleteness',
    mustFind: ['audit'],
    maxRank: 3,
    tags: ['exact-symbol'],
    description: 'auditProjectHandler defined and exported only in audit.ts',
  },
  {
    id: 'fc-sentinel',
    query: 'sentinelHandler forgecraft.yaml .claude/hooks',
    mustFind: ['sentinel'],
    maxRank: 2,
    tags: ['exact-symbol'],
    description: 'sentinel.ts uniquely checks for forgecraft.yaml + .claude/hooks',
  },

  // ── Semantic / conceptual queries ─────────────────────────────────────────
  {
    id: 'fc-adr',
    query: 'generate ADR architectural decision record',
    mustFind: ['generate-adr'],
    maxRank: 3,
    tags: ['exact-keyword'],
    description: 'generate-adr.ts is the only file handling ADR generation',
  },
  {
    id: 'fc-classify',
    query: 'language detector tech stack classification',
    mustFind: ['language-detector'],
    maxRank: 4,
    tags: ['exact-keyword'],
    description: 'language-detector.ts handles tech stack classification',
  },

  // ── Cross-file (multiple files expected) ─────────────────────────────────
  {
    id: 'fc-cross-verify-scorer',
    query: 'scoreGsProperties pass_threshold propertyScores',
    mustFind: ['gs-scorer', 'verify'],
    maxRank: 4,
    minResults: 2,
    tags: ['cross-file'],
    description: 'scoreGsProperties defined in gs-scorer, called in verify — both must surface',
  },

  // ── Out-of-scope (FTS should return empty / no false positives) ───────────
  {
    id: 'fc-empty-kubernetes',
    query: 'kubernetes helm chart ingress deployment replica',
    mustFind: [],
    maxRank: 1,
    mustNotFind: ['verify', 'audit', 'gs-scorer'],
    tags: ['empty-scope'],
    description: 'DevOps query on a code-quality tool — no relevant files, no false positives',
  },
  {
    id: 'fc-empty-ml',
    query: 'neural network backpropagation gradient descent epoch',
    mustFind: [],
    maxRank: 1,
    mustNotFind: ['verify', 'properties', 'code-probes'],
    tags: ['empty-scope'],
    description: 'ML query on a code-quality tool — should return empty FTS results',
  },
];

/** ForgeCraft fixture root */
export const FORGECRAFT_SRC = 'C:\\workspace\\claude\\forgecraft-mcp\\src';

/**
 * Primary implementation files to index for FTS tests.
 * Excludes test files to avoid false positives from test file keyword repetition.
 */
export const FORGECRAFT_FILES = [
  'analyzers/gs-scorer.ts',
  'analyzers/code-probes.ts',
  'analyzers/completeness.ts',
  'analyzers/anti-pattern.ts',
  'analyzers/language-detector.ts',
  'analyzers/folder-structure.ts',
  'core/properties.ts',
  'tools/verify.ts',
  'tools/audit.ts',
  'tools/sentinel.ts',
  'tools/generate-adr.ts',
  'tools/classify.ts',
  'tools/review.ts',
  'tools/scaffold.ts',
  'tools/metrics.ts',
  'registry/loader.ts',
  'registry/renderer.ts',
];
