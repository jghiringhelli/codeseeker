import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { IdeaPlanner } from '../../../src/planner/idea-planner';
import { testDb } from '../../setup-test-database';

describe('IdeaPlanner', () => {
  let planner: IdeaPlanner;
  let db: any;

  beforeEach(async () => {
    db = await testDb.initialize();
    await testDb.insertTestData();
    planner = new IdeaPlanner(db);
  });

  afterEach(async () => {
    await testDb.cleanup();
  });

  describe('planIdea', () => {
    it('should create a comprehensive implementation plan', async () => {
      const idea = {
        title: 'AI-Powered Task Manager',
        description: 'A task management app with AI-powered prioritization and scheduling',
        domain: 'productivity',
        complexity: 'medium',
        targetAudience: 'professionals'
      };

      const plan = await planner.planIdea(idea);

      expect(plan).toHaveProperty('id');
      expect(plan).toHaveProperty('phases');
      expect(plan).toHaveProperty('timeline');
      expect(plan).toHaveProperty('resources');
      expect(plan).toHaveProperty('risks');
      expect(plan).toHaveProperty('successMetrics');
      
      expect(plan.phases).toHaveLength(greaterThan(0));
      expect(plan.timeline.totalDuration).toBeGreaterThan(0);
    });

    it('should adapt plan complexity based on idea scope', async () => {
      const simpleIdea = {
        title: 'Simple Calculator',
        description: 'Basic arithmetic calculator',
        domain: 'utility',
        complexity: 'low',
        targetAudience: 'general'
      };

      const complexIdea = {
        title: 'Enterprise CRM System',
        description: 'Full-featured customer relationship management platform',
        domain: 'business',
        complexity: 'high',
        targetAudience: 'enterprise'
      };

      const simplePlan = await planner.planIdea(simpleIdea);
      const complexPlan = await planner.planIdea(complexIdea);

      expect(complexPlan.phases.length).toBeGreaterThan(simplePlan.phases.length);
      expect(complexPlan.timeline.totalDuration).toBeGreaterThan(simplePlan.timeline.totalDuration);
      expect(complexPlan.resources.teamSize).toBeGreaterThan(simplePlan.resources.teamSize);
    });

    it('should include technology stack recommendations', async () => {
      const webAppIdea = {
        title: 'Social Media Dashboard',
        description: 'Dashboard for managing multiple social media accounts',
        domain: 'social-media',
        complexity: 'medium',
        targetAudience: 'content-creators',
        preferences: {
          platform: 'web',
          scalability: 'high',
          realtime: true
        }
      };

      const plan = await planner.planIdea(webAppIdea);

      expect(plan.technologyStack).toBeDefined();
      expect(plan.technologyStack).toHaveProperty('frontend');
      expect(plan.technologyStack).toHaveProperty('backend');
      expect(plan.technologyStack).toHaveProperty('database');
      expect(plan.technologyStack.realtime).toBe(true);
    });
  });

  describe('generateBusinessPlan', () => {
    it('should create a comprehensive business plan', async () => {
      const idea = {
        title: 'Sustainable Food Delivery',
        description: 'Eco-friendly food delivery platform using electric vehicles',
        domain: 'food-delivery',
        complexity: 'high',
        targetMarket: 'urban-millennials'
      };

      const businessPlan = await planner.generateBusinessPlan(idea);

      expect(businessPlan).toHaveProperty('executiveSummary');
      expect(businessPlan).toHaveProperty('marketAnalysis');
      expect(businessPlan).toHaveProperty('revenueModel');
      expect(businessPlan).toHaveProperty('financialProjections');
      expect(businessPlan).toHaveProperty('competitiveAnalysis');
      expect(businessPlan).toHaveProperty('marketingStrategy');
      expect(businessPlan).toHaveProperty('operationalPlan');
      expect(businessPlan).toHaveProperty('riskAssessment');
    });

    it('should include realistic financial projections', async () => {
      const saasIdea = {
        title: 'Project Management SaaS',
        description: 'Cloud-based project management tool for remote teams',
        domain: 'productivity',
        monetization: 'subscription',
        targetMarket: 'remote-teams'
      };

      const businessPlan = await planner.generateBusinessPlan(saasIdea);

      expect(businessPlan.financialProjections).toHaveProperty('year1');
      expect(businessPlan.financialProjections).toHaveProperty('year3');
      expect(businessPlan.financialProjections).toHaveProperty('year5');
      
      expect(businessPlan.financialProjections.year1.revenue).toBeGreaterThan(0);
      expect(businessPlan.financialProjections.year5.revenue).toBeGreaterThan(
        businessPlan.financialProjections.year1.revenue
      );
    });

    it('should identify market opportunities and threats', async () => {
      const finTechIdea = {
        title: 'Personal Finance AI',
        description: 'AI-powered personal finance assistant',
        domain: 'fintech',
        complexity: 'high',
        regulatoryRequirements: true
      };

      const businessPlan = await planner.generateBusinessPlan(finTechIdea);

      expect(businessPlan.marketAnalysis.opportunities).toHaveLength(greaterThan(0));
      expect(businessPlan.marketAnalysis.threats).toHaveLength(greaterThan(0));
      expect(businessPlan.riskAssessment.regulatory).toBeDefined();
      expect(businessPlan.riskAssessment.regulatory.impact).toBe('high');
    });
  });

  describe('generateRoadmap', () => {
    it('should create a detailed development roadmap', async () => {
      const planId = 'test-plan-1';
      const requirements = {
        targetLaunch: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 6 months
        budget: 100000,
        teamSize: 5,
        priorities: ['mvp', 'user-experience', 'scalability']
      };

      const roadmap = await planner.generateRoadmap(planId, requirements);

      expect(roadmap).toHaveProperty('milestones');
      expect(roadmap).toHaveProperty('sprints');
      expect(roadmap).toHaveProperty('dependencies');
      expect(roadmap).toHaveProperty('criticalPath');
      expect(roadmap).toHaveProperty('resourceAllocation');

      expect(roadmap.milestones).toHaveLength(greaterThan(0));
      expect(roadmap.sprints).toHaveLength(greaterThan(0));
    });

    it('should optimize roadmap for time constraints', async () => {
      const planId = 'urgent-plan';
      const urgentRequirements = {
        targetLaunch: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 2 months
        budget: 150000,
        teamSize: 8,
        priorities: ['mvp', 'speed']
      };

      const roadmap = await planner.generateRoadmap(planId, urgentRequirements);

      expect(roadmap.timeline.totalDuration).toBeLessThanOrEqual(60);
      expect(roadmap.parallelTasks).toHaveLength(greaterThan(0));
      expect(roadmap.resourceAllocation.peakTeamSize).toBe(8);
    });

    it('should handle budget constraints appropriately', async () => {
      const planId = 'budget-constrained-plan';
      const constrainedRequirements = {
        targetLaunch: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        budget: 25000, // Low budget
        teamSize: 2,
        priorities: ['cost-efficiency', 'mvp']
      };

      const roadmap = await planner.generateRoadmap(planId, constrainedRequirements);

      expect(roadmap.budgetBreakdown.total).toBeLessThanOrEqual(25000);
      expect(roadmap.costOptimizations).toHaveLength(greaterThan(0));
      expect(roadmap.phases.some(p => p.name.includes('MVP'))).toBe(true);
    });
  });

  describe('validatePlan', () => {
    it('should validate plan feasibility', async () => {
      const feasiblePlan = {
        id: 'feasible-plan',
        phases: [
          { name: 'Research', duration: 14, resources: { developers: 1 } },
          { name: 'Development', duration: 60, resources: { developers: 3 } },
          { name: 'Testing', duration: 14, resources: { testers: 2 } }
        ],
        budget: 80000,
        timeline: { totalDuration: 88 }
      };

      const validation = await planner.validatePlan(feasiblePlan);

      expect(validation.isValid).toBe(true);
      expect(validation.feasibilityScore).toBeGreaterThan(0.7);
      expect(validation.warnings).toEqual([]);
    });

    it('should identify unrealistic timelines', async () => {
      const unrealisticPlan = {
        id: 'unrealistic-plan',
        phases: [
          { name: 'Complex System', duration: 7, resources: { developers: 1 } } // Too ambitious
        ],
        budget: 10000, // Too low
        timeline: { totalDuration: 7 }
      };

      const validation = await planner.validatePlan(unrealisticPlan);

      expect(validation.isValid).toBe(false);
      expect(validation.feasibilityScore).toBeLessThan(0.5);
      expect(validation.errors).toHaveLength(greaterThan(0));
      expect(validation.errors.some(e => e.includes('timeline'))).toBe(true);
    });

    it('should suggest improvements for invalid plans', async () => {
      const improvablePlan = {
        id: 'improvable-plan',
        phases: [
          { name: 'Development', duration: 30, resources: { developers: 2 } }
        ],
        budget: 40000,
        timeline: { totalDuration: 30 }
      };

      const validation = await planner.validatePlan(improvablePlan);

      if (!validation.isValid) {
        expect(validation.suggestions).toHaveLength(greaterThan(0));
        expect(validation.suggestions.some(s => s.type === 'resource-allocation')).toBe(true);
      }
    });
  });

  describe('planTracking', () => {
    it('should track plan execution progress', async () => {
      const planId = 'tracked-plan';
      const progress = {
        completedPhases: ['Research', 'Design'],
        currentPhase: 'Development',
        progressPercentage: 0.35,
        budgetSpent: 28000,
        timeElapsed: 45,
        blockers: [],
        risks: ['technical-debt'],
        teamVelocity: 8.5
      };

      await planner.updatePlanProgress(planId, progress);

      const status = await planner.getPlanStatus(planId);

      expect(status.progress).toBe(0.35);
      expect(status.currentPhase).toBe('Development');
      expect(status.onTrack).toBeDefined();
      expect(status.projectedCompletion).toBeDefined();
    });

    it('should detect when plans are off track', async () => {
      const planId = 'off-track-plan';
      const problemProgress = {
        currentPhase: 'Development',
        progressPercentage: 0.20, // Behind schedule
        budgetSpent: 60000, // Over budget
        timeElapsed: 60, // Too much time
        blockers: ['technical-issue', 'resource-constraint'],
        risks: ['scope-creep', 'performance-issues']
      };

      await planner.updatePlanProgress(planId, problemProgress);

      const status = await planner.getPlanStatus(planId);

      expect(status.onTrack).toBe(false);
      expect(status.issues.budget).toBe('over-budget');
      expect(status.issues.timeline).toBe('behind-schedule');
      expect(status.recommendations).toHaveLength(greaterThan(0));
    });

    it('should generate progress reports', async () => {
      const planId = 'reporting-plan';
      
      const report = await planner.generateProgressReport(planId);

      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('milestones');
      expect(report).toHaveProperty('budget');
      expect(report).toHaveProperty('timeline');
      expect(report).toHaveProperty('team');
      expect(report).toHaveProperty('risks');
      expect(report).toHaveProperty('nextSteps');

      expect(report.summary.overallHealth).toMatch(/green|yellow|red/);
    });
  });
});