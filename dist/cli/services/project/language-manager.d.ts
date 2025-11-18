/**
 * Language Manager Service - Single Responsibility
 * Handles language detection and setup for projects
 */
import { ILanguageDetector, LanguageSetupResult } from '../../../core/interfaces/project-interfaces';
export declare class LanguageManager implements ILanguageDetector {
    private readonly languagePatterns;
    detectLanguages(projectPath: string): Promise<string[]>;
    setupLanguageSupport(languages: string[]): Promise<LanguageSetupResult>;
    private scanDirectoryForLanguages;
    private detectLanguageFromFile;
    private shouldSkipDirectory;
    private getTreeSitterPackage;
    private installTreeSitterParser;
}
//# sourceMappingURL=language-manager.d.ts.map