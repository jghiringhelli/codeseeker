/**
 * Language Parser Interface - Interface Segregation Principle
 * Each language parser implements only what it needs
 */

export interface ImportInfo {
  name: string;
  from: string;
  isDefault?: boolean;
  alias?: string;
}

export interface ExportInfo {
  name: string;
  isDefault?: boolean;
  type: 'function' | 'class' | 'interface' | 'variable' | 'type';
}

export interface ClassInfo {
  name: string;
  extends?: string;
  implements?: string[];
  methods: string[];
  properties: string[];
  isAbstract?: boolean;
}

export interface FunctionInfo {
  name: string;
  parameters: string[];
  returnType?: string;
  isAsync?: boolean;
  isExported?: boolean;
}

export interface ParsedCodeStructure {
  filePath: string;
  language: string;
  imports: ImportInfo[];
  exports: ExportInfo[];
  classes: ClassInfo[];
  functions: FunctionInfo[];
  interfaces: string[];
  variables: string[];
  dependencies: string[];
  /**
   * 1-based source line for each declared symbol the parser could locate, keyed by the
   * name it reports elsewhere in this structure — a method under `Class.method`.
   *
   * Optional because the regex parsers do not all track position. A consumer that needs a
   * line must handle its absence; what it must not do is invent one. Every AST-derived
   * graph node used to be recorded at line 1, so `sym` pointed at the top of the file for
   * every TypeScript, Python and Java symbol in the index.
   */
  symbolLines?: Record<string, number>;
}

/**
 * Interface for language-specific parsers
 * Follows Interface Segregation Principle - only methods needed
 */
export interface ILanguageParser {
  /**
   * Parse file content and extract code structure
   */
  parse(content: string, filePath: string): Promise<ParsedCodeStructure>;
  
  /**
   * Check if this parser supports the given file
   */
  canParse(filePath: string): boolean;
  
  /**
   * Get supported file extensions
   */
  getSupportedExtensions(): string[];
}

/**
 * Base parser with common functionality
 * Follows Template Method pattern
 */
export abstract class BaseLanguageParser implements ILanguageParser {
  abstract parse(content: string, filePath: string): Promise<ParsedCodeStructure>;
  abstract getSupportedExtensions(): string[];
  
  canParse(filePath: string): boolean {
    const ext = this.getFileExtension(filePath);
    return this.getSupportedExtensions().includes(ext);
  }
  
  protected getFileExtension(filePath: string): string {
    return filePath.split('.').pop()?.toLowerCase() || '';
  }
  
  protected createBaseStructure(filePath: string, language: string): ParsedCodeStructure {
    return {
      filePath,
      language,
      imports: [],
      exports: [],
      classes: [],
      functions: [],
      interfaces: [],
      variables: [],
      dependencies: [],
      symbolLines: {}
    };
  }
}