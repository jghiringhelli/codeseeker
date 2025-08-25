// Project Management Knowledge Base

import { EventEmitter } from 'events';
import { Logger } from '../shared/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

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
  dependencies: string[]; // Phase IDs
  progress: number; // 0-100
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
  effort: number; // Story points
  status: 'backlog' | 'in_progress' | 'testing' | 'done';
  assignedTo?: string;
  completedDate?: Date;
}

export interface RoadmapItem {
  id: string;
  quarter: string; // e.g., "Q1 2024"
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
  celebration?: string; // How to celebrate completion
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
  velocity: number; // Average story points per sprint
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

export class ProjectManagementKB extends EventEmitter {
  private logger: Logger;
  private projectPlan: ProjectPlan | null = null;
  private accomplishments: Map<string, WorkAccomplishment> = new Map();
  private kbPath: string;
  private updateHistory: any[] = [];

  constructor(logger: Logger, kbPath: string = './project-kb') {
    super();
    this.logger = logger;
    this.kbPath = kbPath;
    this?.loadKnowledgeBase();
  }

  async initializeProject(
    name: string,
    vision: string,
    mission: string
  ): Promise<ProjectPlan> {
    this.projectPlan = {
      id: `proj-${Date?.now()}`,
      name,
      vision,
      mission,
      objectives: [],
      phases: [],
      mvps: [],
      roadmap: [],
      milestones: [],
      risks: [],
      stakeholders: [],
      budget: {
        total: 0,
        allocated: 0,
        spent: 0,
        currency: 'USD',
        breakdown: []
      },
      timeline: {
        projectStart: new Date(),
        projectEnd: new Date(Date?.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        currentPhase: '',
        criticalPath: [],
        bufferDays: 30,
        velocity: 0
      },
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: '1.0.0'
      }
    };

    await this?.saveKnowledgeBase();
    this.logger.info(`Project initialized: ${name}`);
    
    return this.projectPlan;
  }

  async addPhase(phase: Omit<Phase, 'id' | 'progress'>): Promise<Phase> {
    if (!this.projectPlan) {
      throw new Error('Project not initialized');
    }

    const newPhase: Phase = {
      ...phase,
      id: `phase-${Date?.now()}`,
      progress: 0
    };

    this.projectPlan.phases?.push(newPhase);
    this.projectPlan.phases?.sort((a, b) => a?.number - b.number);

    await this?.saveKnowledgeBase();
    this?.emit('phase-added', newPhase);
    
    return newPhase;
  }

  async addMVP(mvp: Omit<MVP, 'id'>): Promise<MVP> {
    if (!this.projectPlan) {
      throw new Error('Project not initialized');
    }

    const newMVP: MVP = {
      ...mvp,
      id: `mvp-${Date?.now()}`
    };

    this.projectPlan.mvps?.push(newMVP);
    
    await this?.saveKnowledgeBase();
    this?.emit('mvp-added', newMVP);
    
    return newMVP;
  }

  async addMilestone(milestone: Omit<Milestone, 'id'>): Promise<Milestone> {
    if (!this.projectPlan) {
      throw new Error('Project not initialized');
    }

    const newMilestone: Milestone = {
      ...milestone,
      id: `milestone-${Date?.now()}`
    };

    this.projectPlan.milestones?.push(newMilestone);
    this.projectPlan.milestones?.sort((a, b) => 
      a.targetDate?.getTime() - b.targetDate?.getTime()
    );

    await this?.saveKnowledgeBase();
    this?.emit('milestone-added', newMilestone);
    
    return newMilestone;
  }

  async recordAccomplishment(accomplishment: Omit<WorkAccomplishment, 'id'>): Promise<void> {
    const newAccomplishment: WorkAccomplishment = {
      ...accomplishment,
      id: `acc-${Date?.now()}`
    };

    this.accomplishments?.set(newAccomplishment.id, newAccomplishment);
    
    // Update related phase progress
    if (this.projectPlan) {
      const phase = this.projectPlan.phases?.find(p => p?.id === accomplishment.phaseId);
      if (phase) {
        await this?.updatePhaseProgress(phase.id);
      }
      
      // Update milestone if applicable
      if (accomplishment.milestoneId) {
        await this?.checkMilestoneCompletion(accomplishment.milestoneId);
      }
    }

    await this?.saveKnowledgeBase();
    this?.emit('accomplishment-recorded', newAccomplishment);
  }

  async updatePhaseProgress(phaseId: string): Promise<void> {
    if (!this.projectPlan) return;

    const phase = this.projectPlan.phases?.find(p => p?.id === phaseId);
    if (!phase) return;

    // Calculate progress based on deliverables
    const completedDeliverables = phase.deliverables?.filter(d => d?.status === 'completed').length;
    const totalDeliverables = phase.deliverables?.length;
    
    if (totalDeliverables > 0) {
      phase.progress = Math.round((completedDeliverables / totalDeliverables) * 100);
    }

    // Update status
    if (phase?.progress === 100) {
      phase.status = 'completed';
    } else if (phase.progress > 0) {
      phase.status = 'in_progress';
    }

    await this?.saveKnowledgeBase();
    this?.emit('phase-progress-updated', { phaseId, progress: phase.progress });
  }

  async checkMilestoneCompletion(milestoneId: string): Promise<void> {
    if (!this.projectPlan) return;

    const milestone = this.projectPlan.milestones?.find(m => m?.id === milestoneId);
    if (!milestone) return;

    // Check if all deliverables are completed
    const allCompleted = milestone.deliverables?.every(d => {
      // Check if deliverable exists in accomplishments
      return Array.from(this.accomplishments?.values()).some(
        acc => acc?.title === d && acc?.completionDate != null
      );
    });

    if (allCompleted && milestone?.status !== 'completed') {
      milestone.status = 'completed';
      milestone.actualDate = new Date();
      
      await this?.saveKnowledgeBase();
      this?.emit('milestone-completed', milestone);
      
      // Trigger celebration if defined
      if (milestone.celebration) {
        this?.emit('celebration', { milestone, message: milestone.celebration });
      }
    }
  }

  async getStrategicContext(): Promise<any> {
    if (!this.projectPlan) {
      return { error: 'No project plan available' };
    }

    const currentPhase = this.projectPlan.phases?.find(
      p => p?.status === 'in_progress'
    );
    
    const upcomingMilestones = this.projectPlan.milestones
      .filter(m => m?.status === 'pending' || m?.status === 'at_risk')
      .slice(0, 3);
    
    const activeObjectives = this.projectPlan.objectives
      .filter(o => o?.status === 'active')
      .slice(0, 5);
    
    const highRisks = this.projectPlan.risks
      .filter(r => r?.impact === 'high' || r?.impact === 'critical')
      .filter(r => r?.status !== 'resolved');

    return {
      project: {
        name: this.projectPlan.name,
        vision: this.projectPlan.vision,
        mission: this.projectPlan.mission
      },
      currentPhase: currentPhase ? {
        name: currentPhase.name,
        progress: currentPhase.progress,
        endDate: currentPhase.endDate,
        blockers: currentPhase?.status === 'blocked' ? 'Yes' : 'No'
      } : null,
      upcomingMilestones,
      activeObjectives,
      highRisks,
      metrics: this?.calculateProjectMetrics(),
      recommendations: this?.generateRecommendations()
    };
  }

  private calculateProjectMetrics(): any {
    if (!this.projectPlan) return {};

    const totalPhases = this.projectPlan.phases?.length;
    const completedPhases = this.projectPlan.phases?.filter(p => p?.status === 'completed').length;
    const overallProgress = totalPhases > 0 ? (completedPhases / totalPhases) * 100 : 0;

    const totalMilestones = this.projectPlan.milestones?.length;
    const completedMilestones = this.projectPlan.milestones?.filter(m => m?.status === 'completed').length;
    const milestonesOnTrack = this.projectPlan.milestones?.filter(m => m?.status === 'on_track').length;

    const budgetUtilization = this.projectPlan.budget.total > 0
      ? (this.projectPlan.budget?.spent / this.projectPlan.budget.total) * 100
      : 0;

    // Calculate velocity from accomplishments
    const recentAccomplishments = Array.from(this.accomplishments?.values())
      .filter(a => a.completionDate > new Date(Date?.now() - 30 * 24 * 60 * 60 * 1000)); // Last 30 days
    
    const velocity = recentAccomplishments?.reduce((sum, a) => sum + a.effort, 0) / 30;

    return {
      overallProgress,
      phasesCompleted: `${completedPhases}/${totalPhases}`,
      milestonesCompleted: `${completedMilestones}/${totalMilestones}`,
      milestonesOnTrack,
      budgetUtilization: `${budgetUtilization?.toFixed(1)}%`,
      velocity: velocity?.toFixed(1),
      qualityTrend: this?.calculateQualityTrend(),
      riskLevel: this?.calculateOverallRiskLevel()
    };
  }

  private calculateQualityTrend(): string {
    const recentAccomplishments = Array.from(this.accomplishments?.values())
      .filter(a => a.completionDate > new Date(Date?.now() - 30 * 24 * 60 * 60 * 1000))
      .sort((a, b) => b.completionDate?.getTime() - a.completionDate?.getTime());

    if (recentAccomplishments?.length < 2) return 'stable';

    const recentQuality = recentAccomplishments?.slice(0, 5)
      .reduce((sum, a) => sum + a.quality.codeQuality, 0) / Math.min(5, recentAccomplishments?.length);
    
    const previousQuality = recentAccomplishments?.slice(5, 10)
      .reduce((sum, a) => sum + a.quality.codeQuality, 0) / Math.min(5, recentAccomplishments?.slice(5, 10).length);

    if (recentQuality > previousQuality * 1.05) return 'improving';
    if (recentQuality < previousQuality * 0.95) return 'declining';
    return 'stable';
  }

  private calculateOverallRiskLevel(): string {
    if (!this.projectPlan) return 'unknown';

    const activeRisks = this.projectPlan.risks?.filter(r => 
      r?.status === 'identified' || r?.status === 'mitigating'
    );

    const highImpactRisks = activeRisks?.filter(r => 
      r?.impact === 'critical' || (r?.impact === 'high' && r?.probability === 'high')
    );

    if (highImpactRisks?.length > 2) return 'critical';
    if (highImpactRisks?.length > 0) return 'high';
    if (activeRisks?.length > 5) return 'medium';
    return 'low';
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (!this.projectPlan) return recommendations;

    // Check for at-risk milestones
    const atRiskMilestones = this.projectPlan.milestones?.filter(m => m?.status === 'at_risk');
    if (atRiskMilestones?.length > 0) {
      recommendations?.push(`Focus on at-risk milestones: ${atRiskMilestones?.map(m => m.name).join(', ')}`);
    }

    // Check for blocked phases
    const blockedPhases = this.projectPlan.phases?.filter(p => p?.status === 'blocked');
    if (blockedPhases?.length > 0) {
      recommendations?.push(`Unblock phases: ${blockedPhases?.map(p => p.name).join(', ')}`);
    }

    // Check budget
    if (this.projectPlan.budget.spent > this.projectPlan.budget?.allocated * 0.9) {
      recommendations?.push('Review budget allocation - approaching limit');
    }

    // Check velocity
    if (this.projectPlan.timeline.velocity < 20) {
      recommendations?.push('Consider ways to improve development velocity');
    }

    // Check risks
    const criticalRisks = this.projectPlan.risks?.filter(r => 
      r?.impact === 'critical' && r?.status !== 'resolved'
    );
    if (criticalRisks?.length > 0) {
      recommendations?.push(`Address critical risks immediately: ${criticalRisks?.length} identified`);
    }

    return recommendations;
  }

  async generateStatusReport(): Promise<string> {
    const context = await this?.getStrategicContext();
    
    let report = `# Project Status Report\n\n`;
    report += `**Project**: ${context.project.name}\n`;
    report += `**Date**: ${new Date().toLocaleDateString()}\n\n`;
    
    report += `## Vision & Mission\n`;
    report += `**Vision**: ${context.project.vision}\n`;
    report += `**Mission**: ${context.project.mission}\n\n`;
    
    if (context.currentPhase) {
      report += `## Current Phase\n`;
      report += `**${context.currentPhase.name}**\n`;
      report += `- Progress: ${context.currentPhase.progress}%\n`;
      report += `- Target End: ${context.currentPhase.endDate?.toLocaleDateString()}\n`;
      report += `- Status: ${context.currentPhase?.blockers === 'Yes' ? '⚠️ Blocked' : '✅ Active'}\n\n`;
    }
    
    report += `## Key Metrics\n`;
    report += `- Overall Progress: ${context.metrics.overallProgress?.toFixed(1)}%\n`;
    report += `- Phases Completed: ${context.metrics.phasesCompleted}\n`;
    report += `- Milestones: ${context.metrics.milestonesCompleted} (${context.metrics.milestonesOnTrack} on track)\n`;
    report += `- Budget Utilization: ${context.metrics.budgetUtilization}\n`;
    report += `- Velocity: ${context.metrics.velocity} points/day\n`;
    report += `- Quality Trend: ${context.metrics.qualityTrend}\n`;
    report += `- Risk Level: ${context.metrics.riskLevel}\n\n`;
    
    if (context.upcomingMilestones?.length > 0) {
      report += `## Upcoming Milestones\n`;
      context.upcomingMilestones?.forEach((m: Milestone) => {
        report += `- **${m.name}** (${m.targetDate?.toLocaleDateString()}): ${m.status}\n`;
      });
      report += '\n';
    }
    
    if (context.recommendations?.length > 0) {
      report += `## Recommendations\n`;
      context.recommendations?.forEach((r: string) => {
        report += `- ${r}\n`;
      });
    }
    
    return report;
  }

  private async saveKnowledgeBase(): Promise<void> {
    try {
      await fs?.mkdir(this.kbPath, { recursive: true });
      
      // Save project plan
      if (this.projectPlan) {
        await fs?.writeFile(
          path?.join(this.kbPath, 'project-plan.json'),
          JSON.stringify(this.projectPlan, null, 2)
        );
      }
      
      // Save accomplishments
      const accomplishmentsArray = Array.from(this.accomplishments?.values());
      await fs?.writeFile(
        path?.join(this.kbPath, 'accomplishments.json'),
        JSON.stringify(accomplishmentsArray, null, 2)
      );
      
      // Record update
      this.updateHistory?.push({
        timestamp: new Date(),
        type: 'save',
        details: `Saved ${this.accomplishments.size} accomplishments`
      });
      
      this.logger.info('Project knowledge base saved');
    } catch (error) {
      this.logger.error('Failed to save knowledge base', error as Error);
    }
  }

  private async loadKnowledgeBase(): Promise<void> {
    try {
      // Load project plan
      const planPath = path?.join(this.kbPath, 'project-plan.json');
      const planExists = await fs?.access(planPath).then(() => true).catch(() => false);
      
      if (planExists) {
        const planContent = await fs?.readFile(planPath, 'utf-8');
        this.projectPlan = JSON.parse(planContent);
        
        // Convert date strings back to Date objects
        if (this.projectPlan) {
          this?.convertDates(this.projectPlan);
        }
      }
      
      // Load accomplishments
      const accPath = path?.join(this.kbPath, 'accomplishments.json');
      const accExists = await fs?.access(accPath).then(() => true).catch(() => false);
      
      if (accExists) {
        const accContent = await fs?.readFile(accPath, 'utf-8');
        const accomplishments = JSON.parse(accContent) as WorkAccomplishment[];
        
        accomplishments?.forEach(acc => {
          this.accomplishments?.set(acc.id, acc);
        });
      }
      
      this.logger.info(`Loaded project KB: ${this.accomplishments.size} accomplishments`);
    } catch (error) {
      this.logger.error('Failed to load knowledge base', error as Error);
    }
  }

  private convertDates(obj: any): void {
    // Recursively convert date strings to Date objects
    for (const key in obj) {
      if (obj[key]) {
        if (typeof obj[key] === 'string' && this?.isDateString(obj[key])) {
          obj[key] = new Date(obj[key]);
        } else if (typeof obj[key] === 'object') {
          this?.convertDates(obj[key]);
        }
      }
    }
  }

  private isDateString(str: string): boolean {
    return !isNaN(Date?.parse(str)) && str?.includes('-');
  }

  // Public API
  getProjectPlan(): ProjectPlan | null {
    return this.projectPlan;
  }

  getAccomplishments(): WorkAccomplishment[] {
    return Array.from(this.accomplishments?.values());
  }

  async getPhaseById(phaseId: string): Promise<Phase | null> {
    if (!this.projectPlan) return null;
    return this.projectPlan.phases?.find(p => p?.id === phaseId) || null;
  }

  async getMilestoneById(milestoneId: string): Promise<Milestone | null> {
    if (!this.projectPlan) return null;
    return this.projectPlan.milestones?.find(m => m?.id === milestoneId) || null;
  }
}