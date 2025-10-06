/**
 * Java Parser using Regex-based parsing
 * Single Responsibility: Parse Java files only
 */
import { BaseLanguageParser, ParsedCodeStructure } from './ilanguage-parser';
export declare class JavaParser extends BaseLanguageParser {
    parse(content: string, filePath: string): Promise<ParsedCodeStructure>;
    getSupportedExtensions(): string[];
    private parseWithRegex;
    private removeComments;
    private parsePackage;
    private parseImports;
    private parseClassesAndInterfaces;
    private parseClassMembers;
    private parseMethods;
    private findMatchingBrace;
}
//# sourceMappingURL=java-parser.d.ts.map