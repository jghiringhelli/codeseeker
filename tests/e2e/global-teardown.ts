import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('Starting global teardown...');

  // Get server processes from global storage
  const getApiServer = (global as any).__API_SERVER__;
  const getDashboardServer = (global as any).__DASHBOARD_SERVER__;
  const getTestDb = (global as any).__TEST_DB__;

  // Stop API server
  if (getApiServer) {
    const apiServer = getApiServer();
    if (apiServer && !apiServer.killed) {
      console.log('Stopping API server...');
      apiServer.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await new Promise((resolve) => {
        apiServer.on('exit', resolve);
        setTimeout(() => {
          if (!apiServer.killed) {
            apiServer.kill('SIGKILL');
          }
          resolve(undefined);
        }, 5000);
      });
      console.log('API server stopped');
    }
  }

  // Stop dashboard server
  if (getDashboardServer) {
    const dashboardServer = getDashboardServer();
    if (dashboardServer && !dashboardServer.killed) {
      console.log('Stopping dashboard server...');
      dashboardServer.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await new Promise((resolve) => {
        dashboardServer.on('exit', resolve);
        setTimeout(() => {
          if (!dashboardServer.killed) {
            dashboardServer.kill('SIGKILL');
          }
          resolve(undefined);
        }, 5000);
      });
      console.log('Dashboard server stopped');
    }
  }

  // Cleanup test database
  if (getTestDb) {
    const testDb = getTestDb();
    await testDb.cleanup();
    console.log('Test database cleaned up');
  }

  console.log('Global teardown complete');
}

export default globalTeardown;