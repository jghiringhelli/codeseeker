/**
 * CodeMind Instruction Service
 * Reads and processes CODEMIND.md files for project-specific instructions
 * Mirrors Claude Code's CLAUDE.md functionality with cascading instruction system
 */
export interface ProjectInstruction {
    source: 'global' | 'project' | 'directory' | 'local';
    path: string;
    content: string;
    priority: number;
}
export interface ProjectInstructions {
    instructions: ProjectInstruction[];
    combinedContent: string;
    hasInstructions: boolean;
}
export declare class CodeMindInstructionService {
    private logger;
    private cachedInstructions;
    constructor();
    /**
     * Load project instructions with cascading priority
     * Mirrors Claude Code's CLAUDE.md hierarchy:
     * 1. Global (~/.codemind/CODEMIND.md) - Priority 1
     * 2. Project root (CODEMIND.md) - Priority 2
     * 3. Current directory (CODEMIND.md) - Priority 3
     * 4. Local overrides (.codemind/CODEMIND.local.md) - Priority 4
     */
    loadProjectInstructions(projectPath: string): Promise<ProjectInstructions>;
    /**
     * Load global instructions from user's home directory
     */
    private loadGlobalInstructions;
    /**
     * Load project root instructions
     */
    private loadProjectRootInstructions;
    /**
     * Load directory-specific instructions (if different from project root)
     */
    private loadDirectoryInstructions;
    /**
     * Load local override instructions (git-ignored personal settings)
     */
    private loadLocalInstructions;
    /**
     * Combine instructions by priority into a single content string
     */
    private combineInstructions;
    /**
     * Get user-friendly title for instruction source
     */
    private getSourceTitle;
    /**
     * Check if project has any CODEMIND.md instructions
     */
    hasInstructions(projectPath: string): Promise<boolean>;
    /**
     * Get instructions summary for display
     */
    getInstructionsSummary(projectPath: string): Promise<string[]>;
    /**
     * Create a sample CODEMIND.md file for new projects
     */
    createSampleInstructions(projectPath: string): Promise<void>;
    /**
     * Clear instruction cache (useful when files change)
     */
    clearCache(): void;
    /**
     * Get the combined instructions content for a project
     */
    getInstructionsContent(projectPath: string): Promise<string>;
}
export default CodeMindInstructionService;
//# sourceMappingURL=codemind-instruction-service.d.ts.map