/**
 * Database Manager for the Intelligent Code Auxiliary System
 * Handles SQLite database operations, migrations, and data access
 */
import { DatabaseManager as IDatabaseManager, Logger } from '../core/interfaces';
import { InitializationProgress, DetectedPattern, QuestionnaireResponse, AnalysisResult } from '../core/types';
export declare class DatabaseManager implements IDatabaseManager {
    private db;
    private logger;
    private dbPath;
    constructor(dbPath?: string, logger?: Logger);
    initialize(): Promise<void>;
    close(): Promise<void>;
    migrate(): Promise<void>;
    saveInitializationProgress(progress: InitializationProgress): Promise<InitializationProgress>;
    getInitializationProgress(projectPath: string): Promise<InitializationProgress | null>;
    updateInitializationProgress(progress: InitializationProgress): Promise<void>;
    deleteInitializationProgress(projectPath: string): Promise<void>;
    saveDetectedPattern(pattern: DetectedPattern): Promise<DetectedPattern>;
    getDetectedPatterns(projectPath: string): Promise<DetectedPattern[]>;
    deleteDetectedPatterns(projectPath: string): Promise<void>;
    saveQuestionnaireResponse(response: QuestionnaireResponse): Promise<QuestionnaireResponse>;
    getQuestionnaireResponses(projectPath: string): Promise<QuestionnaireResponse[]>;
    saveAnalysisResult(result: AnalysisResult): Promise<AnalysisResult>;
    getAnalysisResults(projectPath: string, analysisType?: string): Promise<AnalysisResult[]>;
    private createDatabaseError;
    executeQuery(query: string, params?: any[]): Promise<any>;
    getDatabaseStats(): Promise<Record<string, number>>;
}
//# sourceMappingURL=manager.d.ts.map