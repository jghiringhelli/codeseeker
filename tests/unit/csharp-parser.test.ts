/**
 * C# declarations, from an AST rather than from the shape of a line.
 *
 * `CSharpParser` finds declarations by regex, which C# defeats routinely. On one 60-line
 * MediatR handler from the RealWorld ASP.NET corpus it reported:
 *
 *     Delete[Handle, RestException, RestException]   CommandValidator[]
 *
 * Two methods invented from `throw new RestException(...)`, `Handle` attributed to the
 * wrong type, and the `QueryHandler` class and `Command` record missing entirely. Across
 * that corpus `RestException` appeared as a callable in 18 files; none declares it.
 *
 * With the AST: classes 81 -> 137, callables 265 -> 117, and the graph-quality heuristic
 * flags 0.0% of them rather than 1.5%.
 */

import { TreeSitterCSharpParser } from '../../src/cli/services/data/semantic-graph/parsers/tree-sitter-csharp-parser';

const parser = new TreeSitterCSharpParser();

/** The AST path is what these test; see scripts/parser-health.js for the decisive gate. */
async function astAvailable(): Promise<boolean> {
  return (await parser.usingAst()) && (await parser.astUnavailableReason()) === null;
}

const HANDLER = [
  'using System.Net;',                                            // 1
  'using Conduit.Infrastructure.Errors;',                         // 2
  '',                                                             // 3
  'namespace Conduit.Features.Articles;',                         // 4
  '',                                                             // 5
  'public class Delete',                                          // 6
  '{',                                                            // 7
  '    public record Command(string Slug) : IRequest;',           // 8
  '',                                                             // 9
  '    public class CommandValidator : AbstractValidator<Command>', // 10
  '    {',                                                        // 11
  '        public CommandValidator() => RuleFor(x => x.Slug).NotNull();', // 12
  '    }',                                                        // 13
  '',                                                             // 14
  '    public class QueryHandler : IRequestHandler<Command>',      // 15
  '    {',                                                        // 16
  '        public async ValueTask<Unit> Handle(Command message)',  // 17
  '        {',                                                    // 18
  '            throw new RestException(HttpStatusCode.NotFound, "article");', // 19
  '        }',                                                    // 20
  '    }',                                                        // 21
  '}',                                                            // 22
].join('\n');

describe('csharp parser', () => {
  it('knows, and can say, whether it is on the AST path', async () => {
    const usingAst = await parser.usingAst();
    expect(typeof usingAst).toBe('boolean');
    if (!usingAst) expect(await parser.astUnavailableReason()).not.toBeNull();
  });

  it('finds nested types and records the regex parser misses', async () => {
    if (!(await astAvailable())) return;
    const parsed = await parser.parse(HANDLER, 'Delete.cs');
    expect(parsed.classes.map(c => c.name)).toEqual(
      expect.arrayContaining(['Delete', 'Command', 'CommandValidator', 'QueryHandler'])
    );
  });

  it('never reads `throw new X(...)` as declaring a method', async () => {
    if (!(await astAvailable())) return;
    const parsed = await parser.parse(HANDLER, 'Delete.cs');
    for (const cls of parsed.classes) {
      expect(cls.methods).not.toContain('RestException');
    }
  });

  it('attributes a method to the type that declares it', async () => {
    // The regex parser put `Handle` on the outer `Delete` class.
    if (!(await astAvailable())) return;
    const parsed = await parser.parse(HANDLER, 'Delete.cs');
    expect(parsed.classes.find(c => c.name === 'QueryHandler')!.methods).toContain('Handle');
    expect(parsed.classes.find(c => c.name === 'Delete')!.methods).not.toContain('Handle');
  });

  it('does not list a nested type’s member on its enclosing type', async () => {
    if (!(await astAvailable())) return;
    const parsed = await parser.parse(HANDLER, 'Delete.cs');
    expect(parsed.classes.find(c => c.name === 'Delete')!.methods).toEqual([]);
  });

  it('records where each type and method was declared', async () => {
    if (!(await astAvailable())) return;
    const parsed = await parser.parse(HANDLER, 'Delete.cs');
    expect(parsed.symbolLines).toMatchObject({
      Delete: 6,
      Command: 8,
      CommandValidator: 10,
      QueryHandler: 15,
      'QueryHandler.Handle': 17,
    });
  });

  it('extracts using directives as imports', async () => {
    if (!(await astAvailable())) return;
    const parsed = await parser.parse(HANDLER, 'Delete.cs');
    expect(parsed.imports.map(i => i.from)).toEqual(
      expect.arrayContaining(['System.Net', 'Conduit.Infrastructure.Errors'])
    );
    // System.* is framework, not a project dependency worth a graph edge.
    expect(parsed.dependencies).toContain('Conduit.Infrastructure.Errors');
    expect(parsed.dependencies).not.toContain('System.Net');
  });

  it('records an interface under interfaces as well as classes', async () => {
    if (!(await astAvailable())) return;
    const parsed = await parser.parse(
      'public interface IProfileReader\n{\n    Task<Profile> ReadProfile(string username);\n}\n',
      'IProfileReader.cs'
    );
    expect(parsed.interfaces).toContain('IProfileReader');
    expect(parsed.classes.find(c => c.name === 'IProfileReader')!.methods).toContain('ReadProfile');
  });

  it('falls back rather than throwing on unparseable input', async () => {
    const parsed = await parser.parse('public class {{{ broken', 'Broken.cs');
    expect(parsed.filePath).toBe('Broken.cs');
    expect(Array.isArray(parsed.classes)).toBe(true);
  });
});
