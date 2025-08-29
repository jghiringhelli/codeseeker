import { FullConfig } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';
import { testDb } from '../setup-test-database';

let apiServer: ChildProcess;
let dashboardServer: ChildProcess;

async function globalSetup(config: FullConfig) {
  console.log('Starting global setup...');
  
  // Initialize test database
  await testDb.initialize();
  await testDb.insertTestData();
  console.log('Test database initialized');

  // Start API server for E2E tests
  console.log('Starting API server...');
  apiServer = spawn('npm', ['run', 'start:dev'], {
    stdio: 'pipe',
    detached: false,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      API_PORT: '3004',
      DB_TYPE: 'sqlite',
      DB_FILE: ':memory:',
      LOG_LEVEL: 'error'
    }
  });

  // Wait for API server to be ready
  await waitForServer('http://localhost:3004/api/dashboard/health', 30000);
  console.log('API server ready');

  // Start dashboard server for E2E tests
  console.log('Starting dashboard server...');
  dashboardServer = spawn('npm', ['run', 'dashboard:dev'], {
    stdio: 'pipe',
    detached: false,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DASHBOARD_PORT: '3005',
      API_URL: 'http://localhost:3004',
      LOG_LEVEL: 'error'
    }
  });

  // Wait for dashboard server to be ready
  await waitForServer('http://localhost:3005', 30000);
  console.log('Dashboard server ready');

  console.log('Global setup complete');
}

async function waitForServer(url: string, timeout: number = 30000): Promise<void> {
  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch (error) {
      // Server not ready yet, continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error(`Server at ${url} did not start within ${timeout}ms`);
}

// Store server processes globally for cleanup
(global as any).__API_SERVER__ = () => apiServer;
(global as any).__DASHBOARD_SERVER__ = () => dashboardServer;
(global as any).__TEST_DB__ = () => testDb;

export default globalSetup;