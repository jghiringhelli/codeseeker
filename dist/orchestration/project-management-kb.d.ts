import { EventEmitter } from 'events';
import { Logger } from '../shared/logger';
export interface ProjectPlan {
    id: string;
    name: string;
    vision: string;
    mission: string;
    objectives: Objective[];
    phases: Phase[];
    mvps: MVP[];
    roadmap: RoadmapItem[];
    milestones: Milestone[];
    risks: Risk[];
    stakeholders: Stakeholder[];
    budget: Budget;
    timeline: Timeline;
    metadata: PlanMetadata;
}
export interface Phase {
    id: string;
    number: number;
    name: string;
    description: string;
    startDate: Date;
    endDate: Date;
    status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
    deliverables: Deliverable[];
    successCriteria: string[];
    dependencies: string[];
    progress: number;
}
export interface MVP {
    id: string;
    version: string;
    name: string;
    description: string;
    features: Feature[];
    targetDate: Date;
    actualDate?: Date;
    status: 'planned' | 'in_development' | 'testing' | 'released' | 'deprecated';
    metrics: MVPMetrics;
}
export interface Feature {
    id: string;
    name: string;
    description: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    effort: number;
    status: 'backlog' | 'in_progress' | 'testing' | 'done';
    assignedTo?: string;
    completedDate?: Date;
}
export interface RoadmapItem {
    id: string;
    quarter: string;
    theme: string;
    initiatives: Initiative[];
    goals: string[];
    keyResults: KeyResult[];
    status: 'future' | 'current' | 'completed';
}
export interface Initiative {
    id: string;
    name: string;
    description: string;
    impact: 'transformational' | 'high' | 'medium' | 'low';
    effort: 'xl' | 'l' | 'm' | 's';
    owner: string;
    status: string;
}
export interface Milestone {
    id: string;
    name: string;
    description: string;
    targetDate: Date;
    actualDate?: Date;
    status: 'pending' | 'at_risk' | 'on_track' | 'completed' | 'missed';
    blockers: string[];
    dependencies: string[];
    deliverables: string[];
    celebration?: string;
}
export interface Objective {
    id: string;
    category: 'business' | 'technical' | 'user' | 'team';
    description: string;
    keyResults: KeyResult[];
    priority: number;
    status: 'active' | 'completed' | 'cancelled';
}
export interface KeyResult {
    id: string;
    description: string;
    metric: string;
    target: number;
    current: number;
    unit: string;
    status: 'on_track' | 'at_risk' | 'off_track' | 'completed';
}
export interface Risk {
    id: string;
    category: 'technical' | 'business' | 'resource' | 'external';
    description: string;
    probability: 'low' | 'medium' | 'high';
    impact: 'low' | 'medium' | 'high' | 'critical';
    mitigation: string;
    owner: string;
    status: 'identified' | 'mitigating' | 'accepted' | 'resolved';
}
export interface Stakeholder {
    id: string;
    name: string;
    role: string;
    interest: 'high' | 'medium' | 'low';
    influence: 'high' | 'medium' | 'low';
    communicationPlan: string;
}
export interface Budget {
    total: number;
    allocated: number;
    spent: number;
    currency: string;
    breakdown: BudgetItem[];
}
export interface BudgetItem {
    category: string;
    allocated: number;
    spent: number;
    remaining: number;
}
export interface Timeline {
    projectStart: Date;
    projectEnd: Date;
    currentPhase: string;
    criticalPath: string[];
    bufferDays: number;
    velocity: number;
}
export interface Deliverable {
    id: string;
    name: string;
    description: string;
    type: 'document' | 'code' | 'service' | 'feature' | 'report';
    status: 'pending' | 'in_progress' | 'review' | 'completed';
    owner: string;
    dueDate: Date;
    completedDate?: Date;
}
export interface MVPMetrics {
    userSatisfaction?: number;
    adoptionRate?: number;
    performanceScore?: number;
    bugCount?: number;
    techDebt?: number;
}
export interface PlanMetadata {
    createdAt: Date;
    updatedAt: Date;
    version: string;
    approvedBy?: string;
    lastReviewDate?: Date;
    nextReviewDate?: Date;
}
export interface WorkAccomplishment {
    id: string;
    workItemId: string;
    type: 'feature' | 'bug' | 'task' | 'story';
    title: string;
    description: string;
    phaseId: string;
    milestoneId?: string;
    startDate: Date;
    completionDate: Date;
    effort: number;
    quality: QualityMetrics;
    impact: ImpactMetrics;
    lessons: string[];
}
export interface QualityMetrics {
    codeQuality: number;
    testCoverage: number;
    bugDensity: number;
    performanceScore: number;
    securityScore: number;
}
export interface ImpactMetrics {
    businessValue: number;
    userImpact: number;
    technicalDebt: number;
    teamLearning: number;
}
export declare class ProjectManagementKB extends EventEmitter {
    private logger;
    private projectPlan;
    private accomplishments;
    private kbPath;
    private updateHistory;
    constructor(logger: Logger, kbPath?: string);
    initializeProject(name: string, vision: string, mission: string): Promise<ProjectPlan>;
    addPhase(phase: Omit<Phase, 'id' | 'progress'>): Promise<Phase>;
    addMVP(mvp: Omit<MVP, 'id'>): Promise<MVP>;
    addMilestone(milestone: Omit<Milestone, 'id'>): Promise<Milestone>;
    recordAccomplishment(accomplishment: Omit<WorkAccomplishment, 'id'>): Promise<void>;
    updatePhaseProgress(phaseId: string): Promise<void>;
    checkMilestoneCompletion(milestoneId: string): Promise<void>;
    getStrategicContext(): Promise<any>;
    private calculateProjectMetrics;
    private calculateQualityTrend;
    private calculateOverallRiskLevel;
    private generateRecommendations;
    generateStatusReport(): Promise<string>;
    private saveKnowledgeBase;
    private loadKnowledgeBase;
    private convertDates;
    private isDateString;
    getProjectPlan(): ProjectPlan | null;
    getAccomplishments(): WorkAccomplishment[];
    getPhaseById(phaseId: string): Promise<Phase | null>;
    getMilestoneById(milestoneId: string): Promise<Milestone | null>;
}
//# sourceMappingURL=project-management-kb.d.ts.map