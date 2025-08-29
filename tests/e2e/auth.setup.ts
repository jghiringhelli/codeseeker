import { test as setup, expect } from '@playwright/test';

const authFile = 'tests/e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to dashboard login page
  await page.goto('/');
  
  // Check if authentication is required
  // For now, we'll assume no auth is needed for E2E tests
  // This can be expanded when authentication is implemented
  
  await expect(page.locator('body')).toBeVisible();
  
  // Save signed-in state to 'authFile'
  await page.context().storageState({ path: authFile });
});