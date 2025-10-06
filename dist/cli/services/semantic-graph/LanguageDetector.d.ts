/**
 * Language Detector and Package Installer
 * Detects project languages and installs required Tree-sitter parsers
 */
export interface LanguageInfo {
    name: string;
    extensions: string[];
    treeSitterPackage: string;
    parserClass: string;
    quality: 'excellent' | 'good' | 'basic';
    description: string;
}
export interface ProjectLanguageStats {
    language: string;
    fileCount: number;
    percentage: number;
    extensions: string[];
}
export interface LanguageSetupResult {
    detectedLanguages: ProjectLanguageStats[];
    selectedLanguages: string[];
    installedPackages: string[];
    errors: string[];
}
export declare class LanguageDetector {
    private logger;
    private readonly supportedLanguages;
    /**
     * Detect languages in project directory
     */
    detectProjectLanguages(projectPath: string): Promise<ProjectLanguageStats[]>;
    /**
     * Interactive language selection with user prompts
     */
    selectLanguagesInteractively(detectedLanguages: ProjectLanguageStats[]): Promise<string[]>;
    /**
     * Install Tree-sitter packages for selected languages
     */
    installLanguagePackages(selectedLanguages: string[]): Promise<LanguageSetupResult>;
    /**
     * Get parsing quality for a language
     */
    getLanguageQuality(languageName: string): 'excellent' | 'good' | 'basic';
    /**
     * Get recommended parser class for a language
     */
    getParserClass(languageName: string): string;
    /**
     * Check if enhanced parsing is available for languages
     */
    validateParsersAvailable(selectedLanguages: string[]): Promise<{
        available: string[];
        unavailable: string[];
    }>;
    private getFileExtension;
    private findLanguageByExtension;
    private getQualityEmoji;
    private isPackageInstalled;
}
//# sourceMappingURL=LanguageDetector.d.ts.map