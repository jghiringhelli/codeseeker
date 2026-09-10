/**
 * Python imports are the edges of a Python knowledge graph.
 *
 * Two independent defects met here. The regex parser — which, despite the name
 * `PythonParser` and a header claiming Tree-sitter, is what the indexer actually used —
 * cannot read a parenthesised import and emitted the literal `(` as a symbol name. The
 * Tree-sitter parser read parentheses correctly but reached for `childForFieldName('name')`
 * on a field that is multi-valued, so it kept the first import of each statement and
 * dropped the rest: 8 of 16 on one Django view module.
 *
 * Measured over RealWorld Conduit's 34 Python files: 107 imports with 5 malformed names,
 * against 120 imports with none.
 */

import { TreeSitterPythonParser } from '../../src/cli/services/data/semantic-graph/parsers/tree-sitter-python-parser';

const parser = new TreeSitterPythonParser();

async function importsOf(source: string) {
  const parsed = await parser.parse(source, 'views.py');
  return parsed.imports.map(i => ({ name: i.name, from: i.from, alias: i.alias }));
}

describe('python import extraction', () => {
  it('keeps every name in a comma-separated from-import', async () => {
    const imports = await importsOf('from rest_framework import generics, mixins, status, viewsets\n');
    expect(imports.map(i => i.name)).toEqual(['generics', 'mixins', 'status', 'viewsets']);
    expect(imports.every(i => i.from === 'rest_framework')).toBe(true);
  });

  it('reads a parenthesised multi-line import', async () => {
    // The shape the regex parser could not see. It returned a single import named `(`.
    const imports = await importsOf(
      'from rest_framework.permissions import (\n    AllowAny,\n    IsAuthenticated,\n)\n'
    );
    expect(imports.map(i => i.name)).toEqual(['AllowAny', 'IsAuthenticated']);
  });

  it('keeps every name in a comma-separated plain import', async () => {
    const imports = await importsOf('import os, sys\n');
    expect(imports.map(i => i.name)).toEqual(['os', 'sys']);
  });

  it('records a relative import as a dependency', async () => {
    const parsed = await parser.parse('from .models import Article, Comment, Tag\n', 'views.py');
    expect(parsed.imports.map(i => i.name)).toEqual(['Article', 'Comment', 'Tag']);
    expect(parsed.dependencies).toContain('.models');
  });

  it('never emits a name that is not an identifier', async () => {
    // The `(` regression stated as the invariant it violated, so any future parser that
    // reintroduces it fails here rather than quietly poisoning the graph.
    const parsed = await parser.parse(
      'from a import (\n  b,\n  c as d,\n)\nfrom .e import f, g\nimport h.i\n',
      'views.py'
    );
    for (const imported of parsed.imports) {
      expect(imported.name).toMatch(/^[A-Za-z_][A-Za-z0-9_.]*$/);
    }
  });

  it('still finds classes and their methods', async () => {
    const parsed = await parser.parse(
      'class Profile(TimestampedModel):\n' +
        '    def follow(self, profile):\n        pass\n' +
        '    def unfollow(self, profile):\n        pass\n',
      'models.py'
    );
    const profile = parsed.classes.find(c => c.name === 'Profile');
    expect(profile).toBeDefined();
    expect(profile!.methods).toEqual(expect.arrayContaining(['follow', 'unfollow']));
  });
});
