import { EventEmitter } from 'events';
import { Logger } from '../shared/logger';
import { ProjectManagementKB } from './project-management-kb';
import { KnowledgeRepository } from '../knowledge/repository/knowledge-repository';
export interface VoiceSession {
    id: string;
    userId: string;
    startTime: Date;
    endTime?: Date;
    topic: string;
    conversationHistory: ConversationTurn[];
    insights: StrategicInsight[];
    decisions: StrategicDecision[];
    actionItems: ActionItem[];
    mood: 'exploratory' | 'decisive' | 'reflective' | 'urgent';
}
export interface ConversationTurn {
    id: string;
    timestamp: Date;
    speaker: 'user' | 'orchestrator';
    content: string;
    audioPath?: string;
    transcription?: string;
    sentiment: 'positive' | 'neutral' | 'negative' | 'concerned' | 'excited';
    intent: ConversationIntent;
    context: string[];
}
export interface ConversationIntent {
    type: 'question' | 'statement' | 'decision' | 'concern' | 'idea' | 'reflection';
    category: 'strategy' | 'technical' | 'process' | 'people' | 'timeline' | 'quality' | 'risks';
    entities: string[];
    confidence: number;
}
export interface StrategicInsight {
    id: string;
    type: 'opportunity' | 'risk' | 'trend' | 'pattern' | 'assumption';
    description: string;
    evidence: string[];
    implications: string[];
    priority: 'critical' | 'high' | 'medium' | 'low';
    createdAt: Date;
}
export interface StrategicDecision {
    id: string;
    title: string;
    description: string;
    options: DecisionOption[];
    criteria: string[];
    recommendation: string;
    rationale: string;
    impact: 'transformational' | 'significant' | 'moderate' | 'minor';
    urgency: 'immediate' | 'weeks' | 'months' | 'future';
    stakeholders: string[];
    dependencies: string[];
    createdAt: Date;
}
export interface DecisionOption {
    id: string;
    name: string;
    description: string;
    pros: string[];
    cons: string[];
    effort: 'high' | 'medium' | 'low';
    risk: 'high' | 'medium' | 'low';
    score: number;
}
export interface ActionItem {
    id: string;
    description: string;
    assignee?: string;
    dueDate?: Date;
    priority: 'urgent' | 'high' | 'medium' | 'low';
    status: 'pending' | 'in_progress' | 'blocked' | 'completed';
    context: string;
}
export interface VoiceSettings {
    language: 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh';
    voice: 'professional' | 'conversational' | 'thoughtful' | 'energetic';
    pace: 'slow' | 'normal' | 'fast';
    enableTranscription: boolean;
    enableSentimentAnalysis: boolean;
    enableRealTimeInsights: boolean;
}
export declare class VoiceStrategyInterface extends EventEmitter {
    private logger;
    private projectKB;
    private knowledgeRepo;
    private activeSessions;
    private voiceSettings;
    private speechRecognition;
    private speechSynthesis;
    private nlpProcessor;
    private sessionsPath;
    constructor(logger: Logger, projectKB: ProjectManagementKB, knowledgeRepo: KnowledgeRepository, sessionsPath?: string);
    private initializeVoiceServices;
    startStrategicConversation(userId: string, topic?: string): Promise<string>;
    processUserInput(sessionId: string, input: string, isVoice?: boolean): Promise<string>;
    private addUserInput;
    private addOrchestratorResponse;
    private generateOrchestratorResponse;
    private handleStrategicQuestion;
    private handleStrategicConcern;
    private handleStrategicIdea;
    private handleDecisionMaking;
    private handleGeneralDiscussion;
    private generateGreeting;
    private analyzeIntent;
    private analyzeSentiment;
    private extractContext;
    private assessConcernPriority;
    private assessIdeaImpact;
    private extractDecisionTitle;
    private speakResponse;
    private handleSpeechResult;
    private handleSpeechError;
    private saveSession;
    private processForInsights;
    endConversation(sessionId: string): Promise<VoiceSession>;
    getConversationSummary(sessionId: string): Promise<string>;
    getActiveSessionIds(): string[];
    updateVoiceSettings(settings: Partial<VoiceSettings>): void;
}
//# sourceMappingURL=voice-strategy-interface.d.ts.map