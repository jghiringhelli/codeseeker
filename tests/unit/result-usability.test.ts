/**
 * A search result must name something the caller can open.
 *
 * Observed on a two-file project, over the real protocol:
 *
 *   {rank: 1, file: "src/tax.ts",  sig: "export function computeTaxRate…"}
 *   {rank: 2, file: "",            sig: "[Graph-related: connected via code relationships]"}
 *   {rank: 3, file: "src",         sig: "[Directory: src]"}
 *
 * Rank 2 is the project-root node: it is stored as a file node whose path *is* the project
 * root, so relativising it yields the empty string. It consumed a result slot and gave an
 * agent nothing it could read. The directory summary at rank 3 is fine — it is labelled as
 * a directory and a reader can tell.
 */

import { SemanticSearchOrchestrator } from '../../src/cli/commands/services/semantic-search-orchestrator';
import * as path from 'path';

const PROJECT_PATH = path.resolve('/tmp/repo');
const PROJECT_ID = '550e8400-e29b-41d4-a716-44665544000a';

function fileNode(filePath: string) {
  return {
    id: `n-${filePath}`,
    type: 'file',
    name: path.basename(filePath) || 'root',
    filePath,
    projectId: PROJECT_ID,
  };
}

/**
 * `src/a.ts` neighbours three nodes: a real file, the project root (relativises to ''),
 * and something outside the project (relativises to '../outside.ts').
 */
function makeOrchestrator() {
  const orch = new SemanticSearchOrchestrator();
  (orch as any).projectId = PROJECT_ID;
  (orch as any).graphStore = {
    findNodes: jest.fn().mockResolvedValue([
      fileNode(path.join(PROJECT_PATH, 'src/a.ts')),
      fileNode(path.join(PROJECT_PATH, 'src/real.ts')),
      fileNode(PROJECT_PATH),
      fileNode(path.resolve('/tmp/outside.ts')),
    ]),
    getNeighbors: jest.fn().mockImplementation((id: string) =>
      Promise.resolve(
        id === `n-${path.join(PROJECT_PATH, 'src/a.ts')}`
          ? [
              fileNode(path.join(PROJECT_PATH, 'src/real.ts')),
              fileNode(PROJECT_PATH),
              fileNode(path.resolve('/tmp/outside.ts')),
            ]
          : []
      )
    ),
  };
  return orch;
}

const directResults = () => [
  { file: 'src/a.ts', type: 'source', similarity: 1.0, content: 'a' },
];

async function expand() {
  const orch = makeOrchestrator();
  return (orch as any).expandWithGraphNeighbors(directResults(), PROJECT_PATH, 1);
}

describe('graph expansion returns only openable paths', () => {
  it('still returns a genuine neighbour', async () => {
    const files = (await expand()).map((r: any) => r.file);
    expect(files).toContain('src/real.ts');
  });

  it('never returns an empty path', async () => {
    // The project-root node. This is the exact result that reached rank 2.
    const files = (await expand()).map((r: any) => r.file);
    expect(files).not.toContain('');
    expect(files.every((f: string) => f.length > 0)).toBe(true);
  });

  it('never returns the project root as a dot', async () => {
    const files = (await expand()).map((r: any) => r.file);
    expect(files).not.toContain('.');
  });

  it('never returns a path outside the project', async () => {
    // A caller joining this to the project root would read the wrong file, or escape it.
    const files = (await expand()).map((r: any) => r.file);
    expect(files.some((f: string) => f.startsWith('../'))).toBe(false);
  });

  it('drops exactly the unusable ones and keeps the rest', async () => {
    const results = await expand();
    // one direct hit + one usable neighbour, from three neighbours offered
    expect(results).toHaveLength(2);
  });
});
