/**
 * Tree-sitter Python Parser - Excellent Quality AST Parsing
 * Single Responsibility: Parse Python files using proper AST
 */
import { BaseLanguageParser, ParsedCodeStructure } from './ILanguageParser';
export declare class TreeSitterPythonParser extends BaseLanguageParser {
    private parser;
    private language;
    private initialized;
    constructor();
    parse(content: string, filePath: string): Promise<ParsedCodeStructure>;
    getSupportedExtensions(): string[];
    private initializeParser;
    private extractFromAST;
    private extractImportsFromAST;
    private extractClassesFromAST;
    private extractFunctionsFromAST;
    private extractDecoratorsFromAST;
    private extractImportedNames;
    private extractSuperclasses;
    private extractClassMembers;
    private extractParameters;
    private isAsyncFunction;
    private parseWithRegex;
    private parseImportsRegex;
    private parseClassesRegex;
    private parseFunctionsRegex;
}
//# sourceMappingURL=TreeSitterPythonParser.d.ts.map