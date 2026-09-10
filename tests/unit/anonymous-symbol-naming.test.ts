/**
 * Naming the functions that have no name of their own.
 *
 * Two idioms dominate real JavaScript and TypeScript and yield nothing to a parser that
 * only harvests declarations:
 *
 *   export default (state, action) => {…}          every Redux reducer
 *   router.get('/articles', async (req, res) => {}) every Express route
 *
 * Measured on the RealWorld Conduit corpora before this: 19 of 39 Express files and 11 of
 * 38 React files contributed zero symbols, including a 244-line controller holding the
 * entire REST surface. `sym` could not name a single endpoint of that application.
 *
 * These tests pin the two names we synthesise and, just as importantly, the cases where
 * we must NOT invent one.
 */

import { TypeScriptParser } from '../../src/cli/services/data/semantic-graph/parsers/typescript-parser';

const parser = new TypeScriptParser();

async function functionNames(source: string, filePath = 'sample.ts'): Promise<string[]> {
  const parsed = await parser.parse(source, filePath);
  return parsed.functions.map(fn => fn.name);
}

describe('anonymous default export', () => {
  it('takes the name of its module', async () => {
    const names = await functionNames(
      'export default (state = {}, action) => state;',
      '/app/src/reducers/articleList.js'
    );
    expect(names).toContain('articleList');
  });

  it('camel-cases a hyphenated module name', async () => {
    // `article-list.js` is imported as `articleList` by convention, so that is the name a
    // reader searches for — not the literal basename.
    const names = await functionNames(
      'export default function () { return 1; }',
      '/app/src/reducers/article-list.js'
    );
    expect(names).toContain('articleList');
  });

  it('leaves a named default export under its own name', async () => {
    // The module name would be `home`; the function is called `reducer` and that wins.
    const names = await functionNames(
      'export default function reducer(state) { return state; }',
      '/app/src/reducers/home.js'
    );
    expect(names).toContain('reducer');
    expect(names).not.toContain('home');
  });

  it('invents nothing for a default export that is not callable', async () => {
    const names = await functionNames(
      'export default { a: 1 };',
      '/app/src/constants/actionTypes.js'
    );
    expect(names).toEqual([]);
  });
});

describe('callback labelled by a string literal', () => {
  it('names an express route after its method and path', async () => {
    const names = await functionNames(
      "router.get('/articles/:slug/comments', auth, async (req, res) => { res.end(); });",
      'article.controller.ts'
    );
    expect(names).toContain('get(/articles/:slug/comments)');
  });

  it('names a test block after its description', async () => {
    const names = await functionNames(
      "describe('TagService', () => { it('returns tags', () => {}); });",
      'tag.service.test.ts'
    );
    expect(names).toContain('describe(TagService)');
    expect(names).toContain('it(returns tags)');
  });

  it('requires the literal to be the first argument', async () => {
    // `setTimeout(fn, 100)` and `arr.map(fn)` must not acquire a name from an unrelated
    // string elsewhere in the call. Only the leading-literal shape is a label.
    const names = await functionNames(
      "setTimeout(() => {}, 100); emitter.on(handler, 'ready');",
      'sample.ts'
    );
    expect(names).toEqual([]);
  });

  it('ignores a callback that already has a name', async () => {
    const names = await functionNames(
      "router.get('/tags', function listTags(req, res) { res.end(); });",
      'tag.controller.ts'
    );
    expect(names).not.toContain('get(/tags)');
  });

  it('ignores a labelled call with no callback', async () => {
    const names = await functionNames("t('welcome.title');", 'i18n.ts');
    expect(names).toEqual([]);
  });

  it('truncates a label too long to be a name', async () => {
    const description = 'x'.repeat(200);
    const [name] = await functionNames(`it('${description}', () => {});`, 'long.test.ts');
    expect(name.length).toBeLessThan(description.length);
    expect(name.startsWith('it(xxx')).toBe(true);
  });
});

describe('what the parser already handled keeps working', () => {
  it('still finds declarations, classes and interfaces', async () => {
    const parsed = await parser.parse(
      `export class Article {\n  slug(): string { return ''; }\n}\n` +
        `export function getArticles() { return []; }\n` +
        `const toSlug = (title: string) => title;\n` +
        `export interface Comment { body: string }\n`,
      'article.ts'
    );
    expect(parsed.classes.map(c => c.name)).toContain('Article');
    expect(parsed.functions.map(f => f.name)).toEqual(
      expect.arrayContaining(['getArticles', 'toSlug'])
    );
    expect(parsed.interfaces).toContain('Comment');
  });
});
