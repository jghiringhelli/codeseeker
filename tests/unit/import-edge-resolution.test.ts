/**
 * Resolving an import specifier to the file it names.
 *
 * Import edges are the backbone of the graph — ADR-0008 calls them the one reliable
 * signal, and everything structural (graph traversal, dead code, coupling, expansion)
 * rests on them.
 *
 * They were mostly missing. The resolver decided whether a specifier already carried an
 * extension with `path.extname`, which for `../../models/http-exception.model` returns
 * `.model`. So no extension was ever appended, the target was never matched, and no edge
 * was created. That is the dominant naming convention in TypeScript backends —
 * `*.service.ts`, `*.model.ts`, `*.controller.ts`, `*.mapper.ts` — so an entire ecosystem
 * of projects had almost no import edges. `article.service.ts` declares six imports and
 * produced one edge; the one that worked was the only specifier with no dot in its name.
 *
 * Fixing it took the RealWorld Express corpus from 173 edges to 209, and graph expansion
 * from finding one of the two lexically-silent benchmark targets to finding both — at no
 * cost to top-5 precision.
 */

import { IndexingService } from '../../src/mcp/indexing-service';

const PROJECT_FILES = [
  'src/app/routes/article/article.service.ts',
  'src/app/routes/article/article.mapper.ts',
  'src/app/models/http-exception.model.ts',
  'src/app/routes/profile/profile.utils.ts',
  'src/app/routes/tag/tag.model.ts',
  'src/prisma/prisma-client.ts',
  'src/shared/index.ts',
  'src/legacy/helper.mjs',
];

const SOURCE = 'src/app/routes/article/article.service.ts';

/**
 * Target node id of each import edge, with only the prefix stripped.
 *
 * The id encodes a path by replacing separators with `-`, which is lossy for a name that
 * already contains one — `prisma-client.ts` and `prisma/client.ts` encode identically —
 * so the encoded form is matched directly rather than decoded back.
 */
function importTargets(source: string, content: string): string[] {
  const service = new IndexingService();
  const edges = (service as never as {
    extractImports(c: string, f: string, p: string, all: string[]): Array<{ type: string; target: string }>;
  }).extractImports(content, source, 'p1', PROJECT_FILES);

  return edges
    .filter(e => e.type === 'imports')
    .map(e => e.target.replace(/^file-p1-/, ''));
}

describe('import edge resolution', () => {
  it('resolves a specifier whose name contains a dot', async () => {
    // The regression, stated exactly: `.model` is not an extension.
    const targets = importTargets(SOURCE, "import HttpException from '../../models/http-exception.model';\n");
    expect(targets).toHaveLength(1);
    expect(targets[0]).toContain('http-exception.model.ts');
  });

  it('creates an edge for every project-internal import, not just the first', async () => {
    const targets = importTargets(SOURCE, [
      "import slugify from 'slugify';",
      "import prisma from '../../../prisma/prisma-client';",
      "import HttpException from '../../models/http-exception.model';",
      "import profileMapper from '../profile/profile.utils';",
      "import articleMapper from './article.mapper';",
      "import { Tag } from '../tag/tag.model';",
      '',
    ].join('\n'));

    // Five project-internal imports; `slugify` is a package and correctly has no edge.
    expect(targets).toHaveLength(5);
    expect(targets.some(t => t.includes('prisma-client.ts'))).toBe(true);
    expect(targets.some(t => t.includes('http-exception.model.ts'))).toBe(true);
    expect(targets.some(t => t.includes('profile.utils.ts'))).toBe(true);
    expect(targets.some(t => t.includes('article.mapper.ts'))).toBe(true);
    expect(targets.some(t => t.includes('tag.model.ts'))).toBe(true);
  });

  it('never creates an edge to a package', async () => {
    const targets = importTargets(SOURCE, "import slugify from 'slugify';\nimport express from 'express';\n");
    expect(targets).toEqual([]);
  });

  it('resolves a directory import to its index file', async () => {
    const targets = importTargets(SOURCE, "import { thing } from '../../../shared';\n");
    expect(targets[0]).toContain('shared-index.ts');
  });

  it('resolves an extension the old list omitted', async () => {
    // .mjs/.cjs/.mts/.cts were absent — the same extension drift that once hid these
    // files from the graph entirely.
    const targets = importTargets(SOURCE, "import { help } from '../../../legacy/helper';\n");
    expect(targets[0]).toContain('legacy-helper.mjs');
  });

  it('creates no edge for a path that does not exist in the project', async () => {
    // The file list is the authority; a wrong guess must simply fail to match rather
    // than invent an edge to a file that is not there.
    const targets = importTargets(SOURCE, "import x from './does-not-exist';\n");
    expect(targets).toEqual([]);
  });
});

describe('type-only imports', () => {
  it('creates an edge for `import type { X } from`', async () => {
    // `import type { IVectorStore } from '../storage/interfaces'` produced no edge: the
    // alternation captured `type` as the imported name, then looked for `from` and found
    // `{`. TypeScript projects using verbatimModuleSyntax write most imports this way, so
    // the graph was missing them wholesale. Found while building scripts/chronos-bench.js,
    // which asked why an imported file was not a graph neighbour.
    const targets = importTargets(SOURCE, "import type { Tag } from '../tag/tag.model';\n");
    expect(targets).toHaveLength(1);
    expect(targets[0]).toContain('tag.model.ts');
  });

  it('creates an edge for a default type import', async () => {
    const targets = importTargets(SOURCE, "import type Prisma from '../../../prisma/prisma-client';\n");
    expect(targets[0]).toContain('prisma-client.ts');
  });

  it('still creates an edge for the inline `{ type X }` form', async () => {
    // This one always worked — the braces matched — and must keep working.
    const targets = importTargets(SOURCE, "import { type Tag, other } from '../tag/tag.model';\n");
    expect(targets[0]).toContain('tag.model.ts');
  });
});
