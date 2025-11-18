/**
 * Tree-sitter Java Parser - Excellent Quality AST Parsing
 * Single Responsibility: Parse Java files using proper AST
 */
import { BaseLanguageParser, ParsedCodeStructure } from './ilanguage-parser';
export declare class TreeSitterJavaParser extends BaseLanguageParser {
    private parser;
    private language;
    private initialized;
    constructor();
    parse(content: string, filePath: string): Promise<ParsedCodeStructure>;
    getSupportedExtensions(): string[];
    private initializeParser;
    private extractFromAST;
    private extractPackageFromAST;
    private extractImportsFromAST;
    private extractClassesFromAST;
    private extractEnumsFromAST;
    private extractAnnotationsFromAST;
    private extractClassMembers;
    private extractInterfaceMembers;
    private extractInterfaceList;
    private hasModifier;
    private parseWithRegex;
}
//# sourceMappingURL=tree-sitter-java-parser.d.ts.map