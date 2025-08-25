"use strict";
// Project Management Knowledge Base
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectManagementKB = void 0;
const events_1 = require("events");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class ProjectManagementKB extends events_1.EventEmitter {
    logger;
    projectPlan = null;
    accomplishments = new Map();
    kbPath;
    updateHistory = [];
    constructor(logger, kbPath = './project-kb') {
        super();
        this.logger = logger;
        this.kbPath = kbPath;
        this?.loadKnowledgeBase();
    }
    async initializeProject(name, vision, mission) {
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
    async addPhase(phase) {
        if (!this.projectPlan) {
            throw new Error('Project not initialized');
        }
        const newPhase = {
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
    async addMVP(mvp) {
        if (!this.projectPlan) {
            throw new Error('Project not initialized');
        }
        const newMVP = {
            ...mvp,
            id: `mvp-${Date?.now()}`
        };
        this.projectPlan.mvps?.push(newMVP);
        await this?.saveKnowledgeBase();
        this?.emit('mvp-added', newMVP);
        return newMVP;
    }
    async addMilestone(milestone) {
        if (!this.projectPlan) {
            throw new Error('Project not initialized');
        }
        const newMilestone = {
            ...milestone,
            id: `milestone-${Date?.now()}`
        };
        this.projectPlan.milestones?.push(newMilestone);
        this.projectPlan.milestones?.sort((a, b) => a.targetDate?.getTime() - b.targetDate?.getTime());
        await this?.saveKnowledgeBase();
        this?.emit('milestone-added', newMilestone);
        return newMilestone;
    }
    async recordAccomplishment(accomplishment) {
        const newAccomplishment = {
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
    async updatePhaseProgress(phaseId) {
        if (!this.projectPlan)
            return;
        const phase = this.projectPlan.phases?.find(p => p?.id === phaseId);
        if (!phase)
            return;
        // Calculate progress based on deliverables
        const completedDeliverables = phase.deliverables?.filter(d => d?.status === 'completed').length;
        const totalDeliverables = phase.deliverables?.length;
        if (totalDeliverables > 0) {
            phase.progress = Math.round((completedDeliverables / totalDeliverables) * 100);
        }
        // Update status
        if (phase?.progress === 100) {
            phase.status = 'completed';
        }
        else if (phase.progress > 0) {
            phase.status = 'in_progress';
        }
        await this?.saveKnowledgeBase();
        this?.emit('phase-progress-updated', { phaseId, progress: phase.progress });
    }
    async checkMilestoneCompletion(milestoneId) {
        if (!this.projectPlan)
            return;
        const milestone = this.projectPlan.milestones?.find(m => m?.id === milestoneId);
        if (!milestone)
            return;
        // Check if all deliverables are completed
        const allCompleted = milestone.deliverables?.every(d => {
            // Check if deliverable exists in accomplishments
            return Array.from(this.accomplishments?.values()).some(acc => acc?.title === d && acc?.completionDate != null);
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
    async getStrategicContext() {
        if (!this.projectPlan) {
            return { error: 'No project plan available' };
        }
        const currentPhase = this.projectPlan.phases?.find(p => p?.status === 'in_progress');
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
    calculateProjectMetrics() {
        if (!this.projectPlan)
            return {};
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
    calculateQualityTrend() {
        const recentAccomplishments = Array.from(this.accomplishments?.values())
            .filter(a => a.completionDate > new Date(Date?.now() - 30 * 24 * 60 * 60 * 1000))
            .sort((a, b) => b.completionDate?.getTime() - a.completionDate?.getTime());
        if (recentAccomplishments?.length < 2)
            return 'stable';
        const recentQuality = recentAccomplishments?.slice(0, 5)
            .reduce((sum, a) => sum + a.quality.codeQuality, 0) / Math.min(5, recentAccomplishments?.length);
        const previousQuality = recentAccomplishments?.slice(5, 10)
            .reduce((sum, a) => sum + a.quality.codeQuality, 0) / Math.min(5, recentAccomplishments?.slice(5, 10).length);
        if (recentQuality > previousQuality * 1.05)
            return 'improving';
        if (recentQuality < previousQuality * 0.95)
            return 'declining';
        return 'stable';
    }
    calculateOverallRiskLevel() {
        if (!this.projectPlan)
            return 'unknown';
        const activeRisks = this.projectPlan.risks?.filter(r => r?.status === 'identified' || r?.status === 'mitigating');
        const highImpactRisks = activeRisks?.filter(r => r?.impact === 'critical' || (r?.impact === 'high' && r?.probability === 'high'));
        if (highImpactRisks?.length > 2)
            return 'critical';
        if (highImpactRisks?.length > 0)
            return 'high';
        if (activeRisks?.length > 5)
            return 'medium';
        return 'low';
    }
    generateRecommendations() {
        const recommendations = [];
        if (!this.projectPlan)
            return recommendations;
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
        const criticalRisks = this.projectPlan.risks?.filter(r => r?.impact === 'critical' && r?.status !== 'resolved');
        if (criticalRisks?.length > 0) {
            recommendations?.push(`Address critical risks immediately: ${criticalRisks?.length} identified`);
        }
        return recommendations;
    }
    async generateStatusReport() {
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
            context.upcomingMilestones?.forEach((m) => {
                report += `- **${m.name}** (${m.targetDate?.toLocaleDateString()}): ${m.status}\n`;
            });
            report += '\n';
        }
        if (context.recommendations?.length > 0) {
            report += `## Recommendations\n`;
            context.recommendations?.forEach((r) => {
                report += `- ${r}\n`;
            });
        }
        return report;
    }
    async saveKnowledgeBase() {
        try {
            await fs?.mkdir(this.kbPath, { recursive: true });
            // Save project plan
            if (this.projectPlan) {
                await fs?.writeFile(path?.join(this.kbPath, 'project-plan.json'), JSON.stringify(this.projectPlan, null, 2));
            }
            // Save accomplishments
            const accomplishmentsArray = Array.from(this.accomplishments?.values());
            await fs?.writeFile(path?.join(this.kbPath, 'accomplishments.json'), JSON.stringify(accomplishmentsArray, null, 2));
            // Record update
            this.updateHistory?.push({
                timestamp: new Date(),
                type: 'save',
                details: `Saved ${this.accomplishments.size} accomplishments`
            });
            this.logger.info('Project knowledge base saved');
        }
        catch (error) {
            this.logger.error('Failed to save knowledge base', error);
        }
    }
    async loadKnowledgeBase() {
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
                const accomplishments = JSON.parse(accContent);
                accomplishments?.forEach(acc => {
                    this.accomplishments?.set(acc.id, acc);
                });
            }
            this.logger.info(`Loaded project KB: ${this.accomplishments.size} accomplishments`);
        }
        catch (error) {
            this.logger.error('Failed to load knowledge base', error);
        }
    }
    convertDates(obj) {
        // Recursively convert date strings to Date objects
        for (const key in obj) {
            if (obj[key]) {
                if (typeof obj[key] === 'string' && this?.isDateString(obj[key])) {
                    obj[key] = new Date(obj[key]);
                }
                else if (typeof obj[key] === 'object') {
                    this?.convertDates(obj[key]);
                }
            }
        }
    }
    isDateString(str) {
        return !isNaN(Date?.parse(str)) && str?.includes('-');
    }
    // Public API
    getProjectPlan() {
        return this.projectPlan;
    }
    getAccomplishments() {
        return Array.from(this.accomplishments?.values());
    }
    async getPhaseById(phaseId) {
        if (!this.projectPlan)
            return null;
        return this.projectPlan.phases?.find(p => p?.id === phaseId) || null;
    }
    async getMilestoneById(milestoneId) {
        if (!this.projectPlan)
            return null;
        return this.projectPlan.milestones?.find(m => m?.id === milestoneId) || null;
    }
}
exports.ProjectManagementKB = ProjectManagementKB;
//# sourceMappingURL=project-management-kb.js.map