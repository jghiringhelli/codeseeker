/**
 * Search Command Handler
 * Single Responsibility: Handle search commands including semantic search
 */
import { BaseCommandHandler } from '../base-command-handler';
import { CommandResult } from '../command-context';
export declare class SearchCommandHandler extends BaseCommandHandler {
    private logger;
    handle(args: string): Promise<CommandResult>;
    /**
     * Index the current project for semantic search
     */
    private indexProject;
    /**
     * Search for code using semantic similarity
     */
    private searchCode;
    /**
     * Calculate simple text-based similarity for MVP
     */
    private calculateTextSimilarity;
    /**
     * Get existing project ID from database
     */
    private generateProjectId;
}
//# sourceMappingURL=search-command-handler.d.ts.map