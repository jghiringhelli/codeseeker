/**
 * Generic Parser - Fallback for unsupported languages
 * Single Responsibility: Basic parsing for any file type
 */
import { BaseLanguageParser, ParsedCodeStructure } from './ILanguageParser';
export declare class GenericParser extends BaseLanguageParser {
    parse(content: string, filePath: string): Promise<ParsedCodeStructure>;
    getSupportedExtensions(): string[];
    canParse(filePath: string): boolean;
    private detectLanguage;
    private performBasicAnalysis;
    private extractBasicImports;
    private extractBasicFunctions;
    private extractBasicClasses;
    private extractKeywords;
    private extractNameFromPath;
    private extractExtends;
    private extractImplements;
}
//# sourceMappingURL=GenericParser.d.ts.map