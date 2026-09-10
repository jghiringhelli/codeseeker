/**
 * Tree-sitter C# Parser
 *
 * `CSharpParser` finds declarations by their shape on a line, which C# defeats routinely.
 * On one 60-line MediatR handler from the RealWorld ASP.NET corpus it reported the class
 * `Delete` with methods `Handle`, `RestException`, `RestException` — inventing two methods
 * from `throw new RestException(...)`, attributing `Handle` to the wrong class, and
 * missing the `QueryHandler` class and the `Command` record entirely. Across that corpus
 * `RestException` appeared as a callable in 18 files. None of them declare it.
 *
 * Falls back to the regex parser when the native binding will not load, and says so
 * through `usingAst()` rather than degrading silently.
 */

import {
  BaseLanguageParser,
  ParsedCodeStructure,
  ClassInfo,
  FunctionInfo,
} from './ilanguage-parser';
import { CSharpParser } from './csharp-parser';

interface TreeSitterParser {
  setLanguage(language: unknown): void;
  parse(input: string): TreeSitterTree;
}

interface TreeSitterTree {
  rootNode: TreeSitterNode;
}

interface TreeSitterNode {
  type: string;
  text: string;
  children: TreeSitterNode[];
  namedChildren: TreeSitterNode[];
  startPosition: { row: number; column: number };
  childForFieldName(fieldName: string): TreeSitterNode | null;
  descendantsOfType(type: string): TreeSitterNode[];
}

/** Declarations that carry a name and a body of members. */
const TYPE_DECLARATIONS = [
  'class_declaration',
  'record_declaration',
  'struct_declaration',
  'interface_declaration',
];

export class TreeSitterCSharpParser extends BaseLanguageParser {
  private parser: TreeSitterParser | null = null;
  private language: unknown = null;
  private initialized = false;
  private initializing: Promise<void> | null = null;
  private loadFailure: string | null = null;
  private lastParseFailure: string | null = null;
  private readonly regexFallback = new CSharpParser();

  getSupportedExtensions(): string[] {
    return ['cs'];
  }

  /** Is this instance parsing an AST, or has it degraded to the regex parser? */
  async usingAst(): Promise<boolean> {
    await this.ensureInitialized();
    return this.parser !== null && this.language !== null;
  }

  /** Why the AST path is unavailable, or null while it is available. */
  async astUnavailableReason(): Promise<string | null> {
    await this.ensureInitialized();
    return this.loadFailure;
  }

  /** The most recent AST parse that threw and fell back, if any. */
  lastAstParseFailure(): string | null {
    return this.lastParseFailure;
  }

  async parse(content: string, filePath: string): Promise<ParsedCodeStructure> {
    await this.ensureInitialized();

    if (!this.parser || !this.language) {
      return this.regexFallback.parse(content, filePath);
    }

    const structure = this.createBaseStructure(filePath, 'csharp');
    try {
      const tree = this.parser.parse(content);
      this.extractUsings(tree.rootNode, structure);
      this.extractTypes(tree.rootNode, structure);
      this.extractEnums(tree.rootNode, structure);
      return structure;
    } catch (error) {
      // A loaded parser that throws is not the same as an absent one; record it so the
      // degradation is visible instead of looking like a thinner result.
      this.lastParseFailure = `${filePath}: ${(error as Error).message}`;
      console.warn(`Tree-sitter C# parsing failed for ${this.lastParseFailure} — falling back to regex`);
      return this.regexFallback.parse(content, filePath);
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (!this.initializing) this.initializing = this.initializeParser();
    await this.initializing;
  }

  private async initializeParser(): Promise<void> {
    try {
      let TreeSitter: new () => TreeSitterParser;
      let CSharp: unknown;
      try {
        const treeSitterModule = await import('tree-sitter' as string);
        const csharpModule = await import('tree-sitter-c-sharp' as string);
        TreeSitter = treeSitterModule.default || treeSitterModule;
        CSharp = csharpModule.default || csharpModule;
      } catch (importError) {
        this.loadFailure = `cannot load tree-sitter or tree-sitter-c-sharp: ${(importError as Error).message}`;
        console.warn(`Tree-sitter unavailable, falling back to regex parsing — ${this.loadFailure}`);
        this.initialized = true;
        return;
      }

      this.parser = new TreeSitter();
      this.language = CSharp;
      this.parser.setLanguage(this.language);

      // A binding can load, accept setLanguage, and still return a tree with no rootNode
      // when the addon and its grammar come from different module registries. Decide once.
      const probe = this.parser.parse('class A {}\n');
      if (!probe?.rootNode?.descendantsOfType) {
        throw new Error('loaded but produced no usable syntax tree');
      }

      this.initialized = true;
    } catch (error) {
      this.loadFailure = `tree-sitter C# failed to initialise: ${(error as Error).message}`;
      console.warn(`${this.loadFailure} — falling back to regex parsing`);
      this.parser = null;
      this.language = null;
      this.initialized = true;
    }
  }

  private noteLine(structure: ParsedCodeStructure, name: string, node: TreeSitterNode): void {
    const row = node?.startPosition?.row;
    if (!name || typeof row !== 'number') return;
    if (!structure.symbolLines) structure.symbolLines = {};
    if (structure.symbolLines[name] === undefined) structure.symbolLines[name] = row + 1;
  }

  private extractUsings(rootNode: TreeSitterNode, structure: ParsedCodeStructure): void {
    for (const directive of rootNode.descendantsOfType('using_directive')) {
      // `using_directive` has no `name` field; the namespace is an unnamed
      // qualified_name/identifier child, exactly as in the Java grammar.
      const target = directive.namedChildren.find(
        child => child.type === 'qualified_name' || child.type === 'identifier'
      );
      if (!target) continue;

      const from = target.text;
      structure.imports.push({
        name: from.split('.').pop() || from,
        from,
        isDefault: false,
      });
      if (!from.startsWith('System')) structure.dependencies.push(from);
    }
  }

  private extractTypes(rootNode: TreeSitterNode, structure: ParsedCodeStructure): void {
    for (const declarationType of TYPE_DECLARATIONS) {
      for (const node of rootNode.descendantsOfType(declarationType)) {
        const nameNode = node.childForFieldName('name');
        if (!nameNode) continue;

        const info: ClassInfo = {
          name: nameNode.text,
          methods: [],
          properties: [],
        };

        const bases = node.childForFieldName('bases');
        if (bases) {
          const types = bases.namedChildren.map(child => child.text).filter(Boolean);
          if (types.length > 0) {
            // C# does not distinguish a base class from an interface syntactically. The
            // convention that an interface starts with `I` is the only signal available,
            // and guessing wrong here would be worse than reporting them together.
            info.implements = types;
          }
        }

        const body = node.childForFieldName('body');
        if (body) this.extractMembers(body, info, structure);

        if (declarationType === 'interface_declaration') {
          structure.interfaces.push(info.name);
        }
        structure.classes.push(info);
        this.noteLine(structure, info.name, node);
      }
    }
  }

  /**
   * Members declared directly by this type.
   *
   * `descendantsOfType` reaches into nested types, so a method of an inner class would
   * also be listed on the outer one — the duplication that put `Profile.follow` and
   * `follow` in the Python graph as separate nodes. Collect the nested members first and
   * skip them.
   */
  private extractMembers(body: TreeSitterNode, info: ClassInfo, structure: ParsedCodeStructure): void {
    const nested = new Set<string>();
    for (const declarationType of TYPE_DECLARATIONS) {
      for (const inner of body.descendantsOfType(declarationType)) {
        const innerBody = inner.childForFieldName('body');
        if (!innerBody) continue;
        for (const memberType of ['method_declaration', 'constructor_declaration', 'property_declaration']) {
          for (const member of innerBody.descendantsOfType(memberType)) {
            nested.add(`${member.startPosition.row}:${member.startPosition.column}`);
          }
        }
      }
    }
    const isNested = (node: TreeSitterNode) =>
      nested.has(`${node.startPosition.row}:${node.startPosition.column}`);

    for (const memberType of ['method_declaration', 'constructor_declaration']) {
      for (const member of body.descendantsOfType(memberType)) {
        if (isNested(member)) continue;
        const nameNode = member.childForFieldName('name');
        if (!nameNode) continue;
        info.methods.push(nameNode.text);
        this.noteLine(structure, `${info.name}.${nameNode.text}`, member);
      }
    }

    for (const property of body.descendantsOfType('property_declaration')) {
      if (isNested(property)) continue;
      const nameNode = property.childForFieldName('name');
      if (nameNode) info.properties.push(nameNode.text);
    }
  }

  private extractEnums(rootNode: TreeSitterNode, structure: ParsedCodeStructure): void {
    for (const node of rootNode.descendantsOfType('enum_declaration')) {
      const nameNode = node.childForFieldName('name');
      if (!nameNode) continue;
      structure.classes.push({ name: nameNode.text, methods: [], properties: [] });
      this.noteLine(structure, nameNode.text, node);
    }
  }
}
