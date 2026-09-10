/**
 * Where a symbol was declared.
 *
 * Every AST-derived graph node was recorded at `line: 1`, under a comment reading "Line
 * info not available from parser, could be enhanced". So `sym` pointed at the top of the
 * file for every TypeScript, Python and Java symbol in the index — and wiring the real
 * parsers made that worse, because the regex fallback they replaced did compute a line.
 *
 * `symbolLines` carries the position the parser already knew. Absent when a parser cannot
 * report one, so a consumer must handle its absence; what it must not do is invent 1.
 */

import { TypeScriptParser } from '../../src/cli/services/data/semantic-graph/parsers/typescript-parser';
import { TreeSitterPythonParser } from '../../src/cli/services/data/semantic-graph/parsers/tree-sitter-python-parser';

const ts = new TypeScriptParser();
const py = new TreeSitterPythonParser();

async function pythonAstAvailable(): Promise<boolean> {
  return (await py.usingAst()) && (await py.astUnavailableReason()) === null;
}

describe('typescript symbol lines', () => {
  const source = [
    "import { Router } from 'express';", // 1
    '',                                  // 2
    'export interface Article { id: number }', // 3
    '',                                  // 4
    'export class ArticleService {',      // 5
    '  async getArticles() { return []; }', // 6
    '}',                                 // 7
    '',                                  // 8
    'export function helper() {}',        // 9
    '',                                  // 10
    'const toSlug = (t: string) => t;',   // 11
    '',                                  // 12
    "router.get('/articles/:slug', async (req, res) => {});", // 13
  ].join('\n');

  it('locates classes, methods, functions and interfaces', async () => {
    const parsed = await ts.parse(source, 'article.controller.ts');
    expect(parsed.symbolLines).toMatchObject({
      Article: 3,
      ArticleService: 5,
      'ArticleService.getArticles': 6,
      helper: 9,
      toSlug: 11,
    });
  });

  it('locates the synthesised names too', async () => {
    // A route callback and a module-named default export are declarations we invent a name
    // for; they are no use to a reader without a position.
    const parsed = await ts.parse(source, 'article.controller.ts');
    expect(parsed.symbolLines!['get(/articles/:slug)']).toBe(13);

    const reducer = await ts.parse('\n\nexport default (state = {}) => state;\n', 'reducers/home.js');
    expect(reducer.symbolLines!.home).toBe(3);
  });

  it('keeps the first of two declarations of the same name', async () => {
    // A redeclaration must not drag the definition site down the file.
    const parsed = await ts.parse('var f = () => 1;\nvar f = () => 2;\n', 'redecl.ts');
    expect(parsed.symbolLines!.f).toBe(1);
  });

  it('points an overload at its implementation, not at a bare signature', async () => {
    // Babel reports the signatures of an overload as TSDeclareFunction and only visits the
    // implementation, so line 3 is what comes out. That is also the right answer: the
    // implementation is where the code a reader wants actually lives.
    const parsed = await ts.parse(
      'function f(): void;\nfunction f(a: number): void;\nfunction f(a?: number) {}\n',
      'over.ts'
    );
    expect(parsed.symbolLines!.f).toBe(3);
  });

  it('records nothing rather than 1 for a file with no declarations', async () => {
    const parsed = await ts.parse("import x from './x';\nexport { x };\n", 'barrel.ts');
    expect(Object.keys(parsed.symbolLines ?? {})).toHaveLength(0);
  });
});

describe('python symbol lines', () => {
  const source = [
    'import os',                    // 1
    '',                             // 2
    'class Profile(Model):',        // 3
    '    def follow(self, p):',     // 4
    '        pass',                 // 5
    '',                             // 6
    '    async def unfollow(self, p):', // 7
    '        pass',                 // 8
    '',                             // 9
    'def helper():',                // 10
    '    pass',                     // 11
  ].join('\n');

  it('locates a class, its methods and a module-level function', async () => {
    if (!(await pythonAstAvailable())) return;
    const parsed = await py.parse(source, 'models.py');
    expect(parsed.symbolLines).toMatchObject({
      Profile: 3,
      'Profile.follow': 4,
      'Profile.unfollow': 7,
      helper: 10,
    });
  });

  it('does not also report a method as a standalone function', async () => {
    // `descendantsOfType` reaches into class bodies, so every method was reported twice and
    // the indexer built two graph nodes for it — 51 of 117 function nodes on the Django
    // corpus were a bare method name duplicating its own `Class.method`.
    if (!(await pythonAstAvailable())) return;
    const parsed = await py.parse(source, 'models.py');
    const names = parsed.functions.map(f => f.name);
    expect(names).toContain('helper');
    expect(names).not.toContain('follow');
    expect(names).not.toContain('unfollow');
  });

  it('still finds an async method the regex chunker misses entirely', async () => {
    if (!(await pythonAstAvailable())) return;
    const parsed = await py.parse(source, 'models.py');
    expect(parsed.classes.find(c => c.name === 'Profile')!.methods).toContain('unfollow');
  });
});
