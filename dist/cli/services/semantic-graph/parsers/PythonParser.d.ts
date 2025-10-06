/**
 * Python Parser using Tree-sitter
 * Single Responsibility: Parse Python files only
 */
import { BaseLanguageParser, ParsedCodeStructure } from './ILanguageParser';
export declare class PythonParser extends BaseLanguageParser {
    parse(content: string, filePath: string): Promise<ParsedCodeStructure>;
    getSupportedExtensions(): string[];
    private parseWithRegex;
    private parseImports;
    private parseClasses;
    private parseFunctions;
    private getIndentLevel;
}
//# sourceMappingURL=PythonParser.d.ts.map