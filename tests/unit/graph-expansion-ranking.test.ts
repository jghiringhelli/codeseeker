/**
 * A graph neighbour never outranks a direct hit.
 *
 * Expansion scored a neighbour at `sourceScore * 0.7` and then re-sorted the whole list by
 * score, so a neighbour of the top hit (0.70) displaced a genuine match at 0.65.
 *
 * Measured by scripts/graph-bench.js, whose queries are built so that part of each answer
 * is reachable only by following an import edge:
 *
 *   before   depth 0  R@5 80.0%  R@10 85.0%     depth 1  R@5 65.0%  R@10 90.0%
 *   after    depth 0  R@5 80.0%  R@10 85.0%     depth 1  R@5 80.0%  R@10 85.0%
 *
 * Expansion was buying recall deep in the list by pushing real answers out of the top
 * five. Being adjacent to an answer is categorically weaker evidence than being one, so
 * derived results are ranked below every direct result and scaled under the weakest of
 * them — which also keeps the list descending, the invariant the old re-sort existed for.
 */

import { SemanticSearchOrchestrator } from '../../src/cli/commands/services/semantic-search-orchestrator';
import * as path from 'path';

const PROJECT_PATH = path.resolve('/tmp/repo');
const PROJECT_ID = '550e8400-e29b-41d4-a716-446655440009';

const GRAPH_MARKER = 'Graph-related';

function fileNode(rel: string) {
  return { id: `n-${rel}`, type: 'file', name: path.basename(rel), filePath: rel, projectId: PROJECT_ID };
}

/**
 * Direct hits `a.ts` (1.00) and `b.ts` (0.65); `a.ts` imports `neighbour.ts`.
 * A 0.7 decay puts the neighbour at 0.70, above `b.ts`.
 */
function makeOrchestrator() {
  const orch = new SemanticSearchOrchestrator();
  (orch as any).projectId = PROJECT_ID;
  (orch as any).graphStore = {
    findNodes: jest.fn().mockResolvedValue([
      fileNode('src/a.ts'), fileNode('src/b.ts'), fileNode('src/neighbour.ts'),
    ]),
    getNeighbors: jest.fn().mockImplementation((id: string) =>
      Promise.resolve(id === 'n-src/a.ts' ? [fileNode('src/neighbour.ts')] : [])),
  };
  return orch;
}

const directResults = () => ([
  { file: 'src/a.ts', type: 'source', similarity: 1.0, content: 'a' },
  { file: 'src/b.ts', type: 'source', similarity: 0.65, content: 'b' },
]);

async function expand(orch: SemanticSearchOrchestrator, depth = 1) {
  return (orch as any).expandWithGraphNeighbors(directResults(), PROJECT_PATH, depth);
}

describe('graph expansion ranking', () => {
  it('still finds the neighbour', async () => {
    const out = await expand(makeOrchestrator());
    expect(out.map((r: any) => r.file)).toContain('src/neighbour.ts');
  });

  it('places every direct hit above every derived one', async () => {
    const out = await expand(makeOrchestrator());
    const lastDirect = out.map((r: any) => r.content.includes(GRAPH_MARKER)).lastIndexOf(false);
    const firstDerived = out.findIndex((r: any) => r.content.includes(GRAPH_MARKER));
    expect(firstDerived).toBeGreaterThan(lastDirect);
  });

  it('does not let a neighbour of the top hit displace a weaker direct hit', async () => {
    // The exact regression: 1.00 * 0.7 = 0.70 beat a genuine 0.65.
    const out = await expand(makeOrchestrator());
    const files = out.map((r: any) => r.file);
    expect(files.indexOf('src/b.ts')).toBeLessThan(files.indexOf('src/neighbour.ts'));
  });

  it('keeps the list in descending score order', async () => {
    // The invariant the old global re-sort existed to protect. Scaling derived scores
    // under the weakest direct score preserves it without reordering anything.
    const out = await expand(makeOrchestrator());
    const scores = out.map((r: any) => r.similarity);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  it('returns the results untouched when nothing is reachable', async () => {
    const orch = makeOrchestrator();
    (orch as any).graphStore.getNeighbors = jest.fn().mockResolvedValue([]);
    const out = await expand(orch);
    expect(out).toHaveLength(2);
    expect(out.every((r: any) => !r.content.includes(GRAPH_MARKER))).toBe(true);
  });

  it('falls back to the direct results when the graph store throws', async () => {
    const orch = makeOrchestrator();
    (orch as any).graphStore.findNodes = jest.fn().mockRejectedValue(new Error('graph down'));
    const out = await expand(orch);
    expect(out.map((r: any) => r.file)).toEqual(['src/a.ts', 'src/b.ts']);
  });
});
