/**
 * Migration 002: Phase 2 Feature Tables
 *
 * This migration adds all database tables required for Phase 2 features:
 * - CLI interaction tracking
 * - Advanced duplication detection
 * - Tree navigation cache
 * - Vector embeddings for semantic search
 * - Centralization analysis
 * - Performance metrics
 * - Self-improvement tracking
 */
export declare class Phase2Migration {
    private logger;
    private db;
    constructor(databasePath: string);
    up(): Promise<void>;
    down(): Promise<void>;
    private verifyTables;
    private recordMigration;
    close(): void;
}
export default Phase2Migration;
//# sourceMappingURL=002_phase2_features.d.ts.map