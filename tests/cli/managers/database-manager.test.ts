/**
 * DatabaseManager Test Suite
 */

import { DatabaseManager } from './database-manager';
import { DatabaseConnections } from '../../config/database-config';

jest.mock('../../config/database-config');

describe('DatabaseManager', () => {
  let databaseManager: DatabaseManager;
  let mockDbConnections: jest.Mocked<DatabaseConnections>;

  beforeEach(() => {
    // Create mock database connections
    mockDbConnections = {
      getPostgresConnection: jest.fn(),
      getPostgresPool: jest.fn(),
      closeAll: jest.fn()
    } as any;

    // Mock the constructor
    (DatabaseConnections as jest.MockedClass<typeof DatabaseConnections>)
      .mockImplementation(() => mockDbConnections);

    databaseManager = new DatabaseManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkSystemHealth', () => {
    it('should return healthy status when all databases are connected', async () => {
      // Mock PostgreSQL connection
      const mockPgClient = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn()
      };
      mockDbConnections.getPostgresConnection.mockResolvedValue(mockPgClient as any);

      const health = await databaseManager.checkSystemHealth();

      expect(health).toMatchObject({
        postgresql: true,
        redis: true,  // Mocked as always true for now
        neo4j: true   // Mocked as always true for now
      });

      expect(mockPgClient.query).toHaveBeenCalledWith('SELECT 1');
      expect(mockDbConnections.closeAll).toHaveBeenCalled();
    });

    it('should return unhealthy PostgreSQL when connection fails', async () => {
      mockDbConnections.getPostgresConnection.mockRejectedValue(
        new Error('Connection failed')
      );

      const health = await databaseManager.checkSystemHealth();

      expect(health.postgresql).toBe(false);
      expect(health.redis).toBe(true);  // Still mocked as true
      expect(health.neo4j).toBe(true);  // Still mocked as true
      expect(mockDbConnections.closeAll).toHaveBeenCalled();
    });

    it('should handle all databases being down', async () => {
      mockDbConnections.getPostgresConnection.mockRejectedValue(
        new Error('Connection failed')
      );

      const health = await databaseManager.checkSystemHealth();

      expect(health.postgresql).toBe(false);
      // In real implementation, would test redis and neo4j too
    });
  });

  describe('initializeSchemas', () => {
    it('should successfully initialize database schemas', async () => {
      const mockPgPool = {
        query: jest.fn().mockResolvedValue({ rows: [] })
      };
      mockDbConnections.getPostgresPool.mockReturnValue(mockPgPool);

      const result = await databaseManager.initializeSchemas();

      expect(result).toMatchObject({
        success: true
      });
      expect(mockPgPool.query).toHaveBeenCalled();
    });

    it('should handle schema initialization errors', async () => {
      const mockPgPool = {
        query: jest.fn().mockRejectedValue(new Error('Schema error'))
      };
      mockDbConnections.getPostgresPool.mockReturnValue(mockPgPool);

      const result = await databaseManager.initializeSchemas();

      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining('error')
      });
    });
  });

  describe('storeProjectData', () => {
    it('should store project data successfully', async () => {
      const mockPgPool = {
        query: jest.fn().mockResolvedValue({ rows: [] })
      };
      mockDbConnections.getPostgresPool.mockReturnValue(mockPgPool);

      const projectId = 'test-project-id';
      const data = {
        name: 'Test Project',
        description: 'Test Description'
      };

      await expect(
        databaseManager.storeProjectData(projectId, data)
      ).resolves.not.toThrow();

      expect(mockPgPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT'),
        expect.arrayContaining([projectId])
      );
    });

    it('should handle storage errors', async () => {
      const mockPgPool = {
        query: jest.fn().mockRejectedValue(new Error('Storage error'))
      };
      mockDbConnections.getPostgresPool.mockReturnValue(mockPgPool);

      await expect(
        databaseManager.storeProjectData('test-id', {})
      ).rejects.toThrow('Storage error');
    });
  });

  describe('getProjectStats', () => {
    it('should retrieve project statistics', async () => {
      const expectedStats = {
        total_files: 100,
        file_types: 5,
        last_analysis: new Date().toISOString()
      };

      const mockPgPool = {
        query: jest.fn().mockResolvedValue({
          rows: [expectedStats]
        })
      };
      mockDbConnections.getPostgresPool.mockReturnValue(mockPgPool);

      const stats = await databaseManager.getProjectStats('test-project-id');

      expect(stats).toEqual(expectedStats);
      expect(mockPgPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['test-project-id']
      );
    });

    it('should return null for non-existent project', async () => {
      const mockPgPool = {
        query: jest.fn().mockResolvedValue({
          rows: []
        })
      };
      mockDbConnections.getPostgresPool.mockReturnValue(mockPgPool);

      const stats = await databaseManager.getProjectStats('non-existent');

      expect(stats).toBeNull();
    });
  });

  describe('getPostgresConnection', () => {
    it('should return a PostgreSQL connection', async () => {
      const mockConnection = {
        query: jest.fn(),
        release: jest.fn()
      };
      mockDbConnections.getPostgresConnection.mockResolvedValue(mockConnection as any);

      const connection = await databaseManager.getPostgresConnection();

      expect(connection).toBe(mockConnection);
      expect(mockDbConnections.getPostgresConnection).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      mockDbConnections.getPostgresConnection.mockRejectedValue(
        new Error('Connection failed')
      );

      await expect(
        databaseManager.getPostgresConnection()
      ).rejects.toThrow('Connection failed');
    });
  });

  describe('cleanup', () => {
    it('should close all database connections', async () => {
      await databaseManager.cleanup();

      expect(mockDbConnections.closeAll).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      mockDbConnections.closeAll.mockRejectedValue(
        new Error('Cleanup error')
      );

      // Should not throw
      await expect(databaseManager.cleanup()).resolves.not.toThrow();
    });
  });
});