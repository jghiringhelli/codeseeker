import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { BusinessPlanGenerator } from '../../../src/planner/business-plan-generator';
import { testDb } from '../../setup-test-database';

describe('BusinessPlanGenerator', () => {
  let generator: BusinessPlanGenerator;
  let db: any;

  beforeEach(async () => {
    db = await testDb.initialize();
    await testDb.insertTestData();
    generator = new BusinessPlanGenerator(db);
  });

  afterEach(async () => {
    await testDb.cleanup();
  });

  describe('generateExecutiveSummary', () => {
    it('should create a compelling executive summary', async () => {
      const idea = {
        title: 'Smart Home Security System',
        description: 'IoT-based home security with AI threat detection',
        targetMarket: 'homeowners',
        uniqueValue: 'AI-powered threat prediction and prevention'
      };

      const summary = await generator.generateExecutiveSummary(idea);

      expect(summary).toHaveProperty('vision');
      expect(summary).toHaveProperty('mission');
      expect(summary).toHaveProperty('keyValue');
      expect(summary).toHaveProperty('marketOpportunity');
      expect(summary).toHaveProperty('competitiveAdvantage');
      expect(summary).toHaveProperty('financialHighlights');
      expect(summary).toHaveProperty('fundingRequirements');

      expect(summary.vision).toContain('Smart Home');
      expect(summary.keyValue).toContain('AI-powered');
    });

    it('should adapt tone for different business types', async () => {
      const b2bIdea = {
        title: 'Enterprise Analytics Platform',
        description: 'Advanced data analytics for large corporations',
        targetMarket: 'enterprise',
        businessModel: 'b2b-saas'
      };

      const b2cIdea = {
        title: 'Personal Fitness App',
        description: 'Gamified fitness tracking for individuals',
        targetMarket: 'fitness-enthusiasts',
        businessModel: 'b2c-freemium'
      };

      const b2bSummary = await generator.generateExecutiveSummary(b2bIdea);
      const b2cSummary = await generator.generateExecutiveSummary(b2cIdea);

      expect(b2bSummary.tone).toBe('professional');
      expect(b2cSummary.tone).toBe('consumer-friendly');
      expect(b2bSummary.marketOpportunity).toContain('enterprise');
      expect(b2cSummary.marketOpportunity).toContain('consumer');
    });
  });

  describe('analyzeMarket', () => {
    it('should provide comprehensive market analysis', async () => {
      const domain = 'e-commerce';
      const targetMarket = 'small-businesses';

      const analysis = await generator.analyzeMarket(domain, targetMarket);

      expect(analysis).toHaveProperty('marketSize');
      expect(analysis).toHaveProperty('growthRate');
      expect(analysis).toHaveProperty('trends');
      expect(analysis).toHaveProperty('demographics');
      expect(analysis).toHaveProperty('segments');
      expect(analysis).toHaveProperty('opportunities');
      expect(analysis).toHaveProperty('threats');

      expect(analysis.marketSize.tam).toBeGreaterThan(0);
      expect(analysis.marketSize.sam).toBeGreaterThan(0);
      expect(analysis.marketSize.som).toBeGreaterThan(0);
      expect(analysis.trends).toHaveLength(greaterThan(0));
    });

    it('should identify emerging market opportunities', async () => {
      const emergingDomain = 'sustainability-tech';
      const nicheTarge = 'eco-conscious-millennials';

      const analysis = await generator.analyzeMarket(emergingDomain, nicheTarge);

      expect(analysis.opportunities.some(o => o.type === 'emerging-trend')).toBe(true);
      expect(analysis.growthPotential).toBe('high');
      expect(analysis.trends.some(t => t.includes('sustainability'))).toBe(true);
    });

    it('should assess market maturity and competition', async () => {
      const matureDomain = 'social-media';
      const broadTarget = 'general-users';

      const analysis = await generator.analyzeMarket(matureDomain, broadTarget);

      expect(analysis.maturity).toBe('mature');
      expect(analysis.competitionLevel).toBe('high');
      expect(analysis.barrierToEntry).toBe('high');
      expect(analysis.threats.some(t => t.type === 'established-competitors')).toBe(true);
    });
  });

  describe('generateRevenueModel', () => {
    it('should suggest appropriate revenue models', async () => {
      const saasIdea = {
        businessType: 'software',
        targetMarket: 'businesses',
        deliveryModel: 'cloud-based'
      };

      const revenueModel = await generator.generateRevenueModel(saasIdea);

      expect(revenueModel.primaryModel).toBe('subscription');
      expect(revenueModel.pricingStrategy).toBeDefined();
      expect(revenueModel.pricingTiers).toHaveLength(greaterThan(0));
      expect(revenueModel.monthlyRecurringRevenue).toBeDefined();
    });

    it('should calculate realistic pricing tiers', async () => {
      const productivityApp = {
        businessType: 'software',
        targetMarket: 'professionals',
        complexity: 'medium',
        competitorPricing: { low: 9.99, high: 49.99 }
      };

      const revenueModel = await generator.generateRevenueModel(productivityApp);

      expect(revenueModel.pricingTiers).toHaveLength(3); // Basic, Pro, Enterprise
      expect(revenueModel.pricingTiers[0].price).toBeGreaterThan(5);
      expect(revenueModel.pricingTiers[0].price).toBeLessThan(60);
      
      // Should be within competitive range
      const midTierPrice = revenueModel.pricingTiers[1].price;
      expect(midTierPrice).toBeGreaterThanOrEqual(9.99);
      expect(midTierPrice).toBeLessThanOrEqual(49.99);
    });

    it('should include multiple revenue streams', async () => {
      const marketplaceIdea = {
        businessType: 'platform',
        targetMarket: 'buyers-and-sellers',
        networkEffects: true
      };

      const revenueModel = await generator.generateRevenueModel(marketplaceIdea);

      expect(revenueModel.revenueStreams).toHaveLength(greaterThan(1));
      expect(revenueModel.revenueStreams.some(s => s.type === 'transaction-fee')).toBe(true);
      expect(revenueModel.revenueStreams.some(s => s.type === 'listing-fee')).toBe(true);
    });
  });

  describe('createFinancialProjections', () => {
    it('should generate 5-year financial projections', async () => {
      const businessParams = {
        revenueModel: 'subscription',
        initialUsers: 100,
        monthlyGrowthRate: 0.15,
        averageRevenue: 29.99,
        initialTeamSize: 3,
        burnRate: 15000
      };

      const projections = await generator.createFinancialProjections(businessParams);

      expect(projections).toHaveProperty('year1');
      expect(projections).toHaveProperty('year2');
      expect(projections).toHaveProperty('year3');
      expect(projections).toHaveProperty('year4');
      expect(projections).toHaveProperty('year5');

      // Revenue should grow over time
      expect(projections.year5.revenue).toBeGreaterThan(projections.year1.revenue);
      
      // Should include key metrics
      expect(projections.year1).toHaveProperty('revenue');
      expect(projections.year1).toHaveProperty('expenses');
      expect(projections.year1).toHaveProperty('profit');
      expect(projections.year1).toHaveProperty('cashFlow');
      expect(projections.year1).toHaveProperty('users');
    });

    it('should model different growth scenarios', async () => {
      const conservativeParams = {
        revenueModel: 'subscription',
        monthlyGrowthRate: 0.05,
        churnRate: 0.08
      };

      const aggressiveParams = {
        revenueModel: 'subscription',
        monthlyGrowthRate: 0.25,
        churnRate: 0.03
      };

      const conservative = await generator.createFinancialProjections(conservativeParams);
      const aggressive = await generator.createFinancialProjections(aggressiveParams);

      expect(aggressive.year3.revenue).toBeGreaterThan(conservative.year3.revenue);
      expect(aggressive.year3.users).toBeGreaterThan(conservative.year3.users);
    });

    it('should include break-even analysis', async () => {
      const businessParams = {
        revenueModel: 'subscription',
        fixedCosts: 25000,
        variableCostPerUser: 2.50,
        averageRevenue: 19.99
      };

      const projections = await generator.createFinancialProjections(businessParams);

      expect(projections.breakEvenAnalysis).toBeDefined();
      expect(projections.breakEvenAnalysis.monthsToBreakEven).toBeGreaterThan(0);
      expect(projections.breakEvenAnalysis.usersNeeded).toBeGreaterThan(0);
      expect(projections.breakEvenAnalysis.revenueNeeded).toBeGreaterThan(0);
    });
  });

  describe('analyzeCompetition', () => {
    it('should identify direct and indirect competitors', async () => {
      const domain = 'project-management';
      const features = ['task-tracking', 'team-collaboration', 'reporting'];

      const analysis = await generator.analyzeCompetition(domain, features);

      expect(analysis).toHaveProperty('directCompetitors');
      expect(analysis).toHaveProperty('indirectCompetitors');
      expect(analysis).toHaveProperty('competitiveMatrix');
      expect(analysis).toHaveProperty('marketLeaders');
      expect(analysis).toHaveProperty('gaps');

      expect(analysis.directCompetitors).toHaveLength(greaterThan(0));
      expect(analysis.competitiveMatrix).toHaveProperty('features');
      expect(analysis.competitiveMatrix).toHaveProperty('pricing');
    });

    it('should identify competitive advantages and gaps', async () => {
      const uniqueFeatures = ['ai-scheduling', 'voice-commands', 'predictive-analytics'];
      const domain = 'productivity';

      const analysis = await generator.analyzeCompetition(domain, uniqueFeatures);

      expect(analysis.gaps).toHaveLength(greaterThan(0));
      expect(analysis.advantages).toHaveLength(greaterThan(0));
      expect(analysis.advantages.some(a => a.includes('ai-scheduling'))).toBe(true);
    });

    it('should provide SWOT analysis', async () => {
      const domain = 'fintech';
      const context = {
        teamExpertise: ['blockchain', 'security'],
        funding: 'seed',
        marketTiming: 'early'
      };

      const analysis = await generator.analyzeCompetition(domain, [], context);

      expect(analysis.swot).toBeDefined();
      expect(analysis.swot).toHaveProperty('strengths');
      expect(analysis.swot).toHaveProperty('weaknesses');
      expect(analysis.swot).toHaveProperty('opportunities');
      expect(analysis.swot).toHaveProperty('threats');

      expect(analysis.swot.strengths).toHaveLength(greaterThan(0));
      expect(analysis.swot.opportunities).toHaveLength(greaterThan(0));
    });
  });

  describe('generateMarketingStrategy', () => {
    it('should create comprehensive marketing strategy', async () => {
      const business = {
        targetMarket: 'small-business-owners',
        budget: 50000,
        timeline: 12,
        goals: ['brand-awareness', 'lead-generation']
      };

      const strategy = await generator.generateMarketingStrategy(business);

      expect(strategy).toHaveProperty('positioning');
      expect(strategy).toHaveProperty('channels');
      expect(strategy).toHaveProperty('budget');
      expect(strategy).toHaveProperty('timeline');
      expect(strategy).toHaveProperty('metrics');
      expect(strategy).toHaveProperty('campaigns');

      expect(strategy.channels).toHaveLength(greaterThan(0));
      expect(strategy.budget.total).toBeLessThanOrEqual(50000);
    });

    it('should optimize channel mix for target audience', async () => {
      const b2bBusiness = {
        targetMarket: 'enterprise-ctos',
        budget: 100000,
        goals: ['lead-generation', 'thought-leadership']
      };

      const b2cBusiness = {
        targetMarket: 'millennials',
        budget: 100000,
        goals: ['brand-awareness', 'user-acquisition']
      };

      const b2bStrategy = await generator.generateMarketingStrategy(b2bBusiness);
      const b2cStrategy = await generator.generateMarketingStrategy(b2cBusiness);

      expect(b2bStrategy.channels.some(c => c.name === 'linkedin')).toBe(true);
      expect(b2bStrategy.channels.some(c => c.name === 'content-marketing')).toBe(true);
      
      expect(b2cStrategy.channels.some(c => c.name === 'instagram')).toBe(true);
      expect(b2cStrategy.channels.some(c => c.name === 'tiktok')).toBe(true);
    });

    it('should include customer acquisition cost projections', async () => {
      const business = {
        targetMarket: 'saas-users',
        averageLifetimeValue: 500,
        budget: 75000
      };

      const strategy = await generator.generateMarketingStrategy(business);

      expect(strategy.metrics).toHaveProperty('targetCAC');
      expect(strategy.metrics).toHaveProperty('ltv');
      expect(strategy.metrics).toHaveProperty('ltvCacRatio');
      
      expect(strategy.metrics.ltvCacRatio).toBeGreaterThan(3); // Healthy ratio
      expect(strategy.metrics.targetCAC).toBeLessThan(strategy.metrics.ltv / 3);
    });
  });
});