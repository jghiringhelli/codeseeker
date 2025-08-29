import { test, expect } from '@playwright/test';

test.describe('CodeMind Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load dashboard homepage', async ({ page }) => {
    await expect(page).toHaveTitle(/CodeMind/);
    await expect(page.locator('h1')).toContainText('CodeMind');
  });

  test('should display three-layer architecture overview', async ({ page }) => {
    await expect(page.locator('[data-testid="layer-1-smart-cli"]')).toBeVisible();
    await expect(page.locator('[data-testid="layer-2-orchestrator"]')).toBeVisible();
    await expect(page.locator('[data-testid="layer-3-planner"]')).toBeVisible();
  });

  test('should show system status indicators', async ({ page }) => {
    await expect(page.locator('[data-testid="system-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="api-status"]')).toContainText('Online');
    await expect(page.locator('[data-testid="database-status"]')).toContainText('Connected');
  });

  test('should navigate to layer-specific views', async ({ page }) => {
    // Test Smart CLI navigation
    await page.click('[data-testid="nav-smart-cli"]');
    await expect(page).toHaveURL(/.*smart-cli/);
    await expect(page.locator('h1')).toContainText('Smart CLI');

    // Test Orchestrator navigation
    await page.click('[data-testid="nav-orchestrator"]');
    await expect(page).toHaveURL(/.*orchestrator/);
    await expect(page.locator('h1')).toContainText('Workflow Orchestrator');

    // Test Planner navigation
    await page.click('[data-testid="nav-planner"]');
    await expect(page).toHaveURL(/.*planner/);
    await expect(page.locator('h1')).toContainText('Idea Planner');
  });

  test('should display real-time metrics', async ({ page }) => {
    await expect(page.locator('[data-testid="token-efficiency-metric"]')).toBeVisible();
    await expect(page.locator('[data-testid="workflow-success-rate"]')).toBeVisible();
    await expect(page.locator('[data-testid="active-plans-count"]')).toBeVisible();
    
    // Check that metrics show actual values
    const tokenEfficiency = page.locator('[data-testid="token-efficiency-metric"] .metric-value');
    await expect(tokenEfficiency).toContainText(/%/);
  });

  test('should respond to responsive design breakpoints', async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    await expect(page.locator('[data-testid="main-content"]')).toHaveCSS('margin-left', /250px/);

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="sidebar"]')).toBeHidden();
  });
});

test.describe('Smart CLI Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/smart-cli');
  });

  test('should display CLI project overview', async ({ page }) => {
    await expect(page.locator('[data-testid="projects-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="project-card"]').first()).toBeVisible();
  });

  test('should show tool usage statistics', async ({ page }) => {
    await expect(page.locator('[data-testid="tool-usage-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="most-used-tools"]')).toBeVisible();
    await expect(page.locator('[data-testid="token-savings"]')).toBeVisible();
  });

  test('should allow creating new project analysis', async ({ page }) => {
    await page.click('[data-testid="new-analysis-button"]');
    await expect(page.locator('[data-testid="analysis-form"]')).toBeVisible();
    
    await page.fill('[data-testid="project-path-input"]', '/test/project');
    await page.click('[data-testid="start-analysis-button"]');
    
    await expect(page.locator('[data-testid="analysis-progress"]')).toBeVisible();
  });

  test('should display quality metrics dashboard', async ({ page }) => {
    await page.click('[data-testid="quality-metrics-tab"]');
    
    await expect(page.locator('[data-testid="code-quality-score"]')).toBeVisible();
    await expect(page.locator('[data-testid="quality-trends-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="improvement-suggestions"]')).toBeVisible();
  });
});

test.describe('Workflow Orchestrator Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/orchestrator');
  });

  test('should display active workflows', async ({ page }) => {
    await expect(page.locator('[data-testid="active-workflows"]')).toBeVisible();
    await expect(page.locator('[data-testid="workflow-card"]').first()).toBeVisible();
  });

  test('should show role coordination status', async ({ page }) => {
    await expect(page.locator('[data-testid="role-coordination-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="architect-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="security-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="quality-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="performance-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="coordinator-status"]')).toBeVisible();
  });

  test('should allow starting new workflow', async ({ page }) => {
    await page.click('[data-testid="new-workflow-button"]');
    await expect(page.locator('[data-testid="workflow-template-selector"]')).toBeVisible();
    
    await page.selectOption('[data-testid="template-select"]', 'development');
    await page.fill('[data-testid="workflow-name"]', 'Test Workflow');
    await page.fill('[data-testid="project-requirements"]', 'Build a test feature');
    
    await page.click('[data-testid="start-workflow-button"]');
    await expect(page.locator('[data-testid="workflow-started-notification"]')).toBeVisible();
  });

  test('should display workflow execution timeline', async ({ page }) => {
    await page.click('[data-testid="workflow-card"]').first();
    
    await expect(page.locator('[data-testid="workflow-timeline"]')).toBeVisible();
    await expect(page.locator('[data-testid="role-execution-step"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="convergence-indicator"]')).toBeVisible();
  });
});

test.describe('Idea Planner Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/planner');
  });

  test('should display planning sessions', async ({ page }) => {
    await expect(page.locator('[data-testid="planning-sessions"]')).toBeVisible();
    await expect(page.locator('[data-testid="session-card"]').first()).toBeVisible();
  });

  test('should show business plan overview', async ({ page }) => {
    await expect(page.locator('[data-testid="business-plans"]')).toBeVisible();
    await expect(page.locator('[data-testid="revenue-projections-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="market-analysis-summary"]')).toBeVisible();
  });

  test('should allow creating new idea plan', async ({ page }) => {
    await page.click('[data-testid="new-plan-button"]');
    await expect(page.locator('[data-testid="idea-form"]')).toBeVisible();
    
    await page.fill('[data-testid="idea-title"]', 'AI-Powered Productivity App');
    await page.fill('[data-testid="idea-description"]', 'An app that uses AI to optimize daily tasks');
    await page.selectOption('[data-testid="domain-select"]', 'productivity');
    await page.selectOption('[data-testid="complexity-select"]', 'medium');
    
    await page.click('[data-testid="generate-plan-button"]');
    await expect(page.locator('[data-testid="plan-generation-progress"]')).toBeVisible();
  });

  test('should display roadmap visualization', async ({ page }) => {
    await page.click('[data-testid="session-card"]').first();
    await page.click('[data-testid="roadmap-tab"]');
    
    await expect(page.locator('[data-testid="roadmap-timeline"]')).toBeVisible();
    await expect(page.locator('[data-testid="milestone-marker"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="phase-progress-bar"]').first()).toBeVisible();
  });

  test('should show financial projections', async ({ page }) => {
    await page.click('[data-testid="session-card"]').first();
    await page.click('[data-testid="financials-tab"]');
    
    await expect(page.locator('[data-testid="revenue-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="break-even-analysis"]')).toBeVisible();
    await expect(page.locator('[data-testid="funding-requirements"]')).toBeVisible();
  });
});