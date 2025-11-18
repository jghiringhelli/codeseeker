/**
 * TypeScript/JavaScript Parser using Babel AST
 * Single Responsibility: Parse TS/JS files only
 */
import { BaseLanguageParser, ParsedCodeStructure } from './ilanguage-parser';
export declare class TypeScriptParser extends BaseLanguageParser {
    parse(content: string, filePath: string): Promise<ParsedCodeStructure>;
    getSupportedExtensions(): string[];
    private detectLanguage;
    private extractStructure;
    private extractImports;
    private extractNamedExports;
    private extractDefaultExport;
    private extractExportFromDeclaration;
    private extractClass;
    private extractFunction;
    private extractFunctionFromVariable;
}
//# sourceMappingURL=typescript-parser.d.ts.map