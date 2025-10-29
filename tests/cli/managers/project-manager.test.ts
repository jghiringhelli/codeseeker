/**
 * ProjectManager Test Suite
 * Tests for project lifecycle management
 */

import { ProjectManager } from './project-manager';
import { DatabaseConnections } from '../../config/database-config';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');
jest.mock('fs/promises');
jest.mock('../../config/database-config');

describe('ProjectManager', () => {
  let projectManager: ProjectManager;
  const mockFs = fs as jest.Mocked<typeof fs>;
  let mockDbConnections: jest.Mocked<DatabaseConnections>;

  beforeEach(() => {
    // Mock database connections
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
      connect: jest.fn(),
      end: jest.fn()
    };

    mockDbConnections = {
      getPostgresPool: jest.fn().mockReturnValue(mockPool),
      closeAll: jest.fn()
    } as any;

    (DatabaseConnections as jest.MockedClass<typeof DatabaseConnections>)
      .mockImplementation(() => mockDbConnections);

    projectManager = new ProjectManager();
    jest.clearAllMocks();

    // Setup default mocks
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify({
      name: 'test-project',
      version: '1.0.0'
    }));
    mockFs.statSync.mockReturnValue({
      isDirectory: () => true
    } as any);
  });

  describe('setProjectPath', () => {
    it('should set the project path', () => {
      const testPath = '/test/project/path';
      projectManager.setProjectPath(testPath);

      // Verify by checking internal state (if accessible) or through side effects
      expect(() => projectManager.setProjectPath(testPath)).not.toThrow();
    });
  });

  describe('detectProject', () => {
    it('should detect Node.js project', () => {
      const projectPath = '/test/project';
      mockFs.existsSync.mockImplementation((p) =>
        typeof p === 'string' && p.includes('package.json')
      );
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        description: 'Test project'
      }));

      const config = projectManager.detectProject(projectPath);

      expect(config).not.toBeNull();
      expect(config?.projectPath).toBe(projectPath);
      expect(config?.projectName).toBe('test-project');
    });

    it('should detect Python project', () => {
      const projectPath = '/test/python-project';
      mockFs.existsSync.mockImplementation((p) =>
        typeof p === 'string' && (p.includes('requirements.txt') || p.includes('pyproject.toml'))
      );
      mockFs.readFileSync.mockImplementation((p) => {
        if (typeof p === 'string' && p.includes('pyproject.toml')) {
          return '[tool.poetry]\nname = "python-project"';
        }
        return 'flask==2.0.0\nrequests==2.26.0';
      });

      const config = projectManager.detectProject(projectPath);

      expect(config).not.toBeNull();
      expect(config?.projectPath).toBe(projectPath);
    });

    it('should return null for non-existent path', () => {
      mockFs.existsSync.mockReturnValue(false);
      const config = projectManager.detectProject('/non-existent');
      expect(config).toBeNull();
    });
  });

  describe('initializeProject', () => {
    const mockProjectConfig = {
      projectPath: '/test/project',
      name: 'test-project',
      type: 'node' as const,
      description: 'Test project',
      createdAt: new Date().toISOString()
    };

    beforeEach(() => {
      // Mock database responses
      const mockPool = {
        query: jest.fn()
      };
      mockDbConnections.getPostgresPool.mockReturnValue(mockPool);
      mockPool.query.mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM projects')) {
          return { rows: [] }; // No existing project
        }
        if (query.includes('INSERT INTO projects')) {
          return {
            rows: [{
              id: 'test-project-id',
              project_name: 'test-project',
              project_path: '/test/project'
            }]
          };
        }
        return { rows: [] };
      });
    });

    it('should initialize a new project', async () => {
      const result = await projectManager.initializeProject(
        '/test/project',
        { resetProject: false },
        false // syncMode
      );

      expect(result).toMatchObject({
        success: true
    });

    it('should handle existing project with reset flag', async () => {
      // Mock existing project
      const mockPool = {
        query: jest.fn()
      };
      mockDbConnections.getPostgresPool.mockReturnValue(mockPool);
      mockPool.query.mockImplementation((query: string) => {
        if (query.includes('SELECT * FROM projects')) {
          return {
            rows: [{
              id: 'existing-id',
              project_name: 'existing-project'
            }]
          };
        }
        if (query.includes('DELETE FROM')) {
          return { rows: [] };
        }
        if (query.includes('INSERT INTO projects')) {
          return {
            rows: [{
              id: 'new-project-id',
              project_name: 'test-project'
            }]
          };
        }
        return { rows: [] };
      });

      const result = await projectManager.initializeProject(
        '/test/project',
        { resetProject: true },
        false
      );

      expect(result.success).toBe(true);
    });

    it('should handle initialization errors', async () => {
      const mockPool = {
        query: jest.fn().mockRejectedValue(new Error('Database error'))
      };
      mockDbConnections.getPostgresPool.mockReturnValue(mockPool);

      const result = await projectManager.initializeProject(
        '/test/project',
        { resetProject: false },
        false
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('error');
    });
  });

  describe('switchProject', () => {
    it('should switch to existing project', async () => {
      const targetPath = '/new/project';
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({
        name: 'new-project',
        version: '2.0.0'
      }));

      const mockPool = {
        query: jest.fn().mockResolvedValue({
        rows: [{
          id: 'project-id',
          project_name: 'new-project',
          project_path: targetPath
        }]
      })
      };
      mockDbConnections.getPostgresPool.mockReturnValue(mockPool);

      const result = await projectManager.switchProject(targetPath);

      expect(result).not.toBeNull();
      expect(result?.projectPath).toBe(targetPath);
    });

    it('should return null for non-existent project path', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await projectManager.switchProject('/non-existent');
      expect(result).toBeNull();
    });
  });

  describe('getProjectInfo', () => {
    it('should retrieve project information', async () => {
      const projectId = 'test-project-id';
      const expectedInfo = {
        id: projectId,
        name: 'Test Project',
        path: '/test/project',
        created_at: new Date().toISOString()
      };

      const mockPool = {
        query: jest.fn().mockResolvedValue({
        rows: [expectedInfo]
      })
      };
      mockDbConnections.getPostgresPool.mockReturnValue(mockPool);

      const info = await projectManager.getProjectInfo(projectId);

      expect(info).toEqual(expectedInfo);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [projectId]
      );
    });

    it('should return null for non-existent project', async () => {
      const mockPool = {
        query: jest.fn().mockResolvedValue({
        rows: []
      })
      };
      mockDbConnections.getPostgresPool.mockReturnValue(mockPool);

      const info = await projectManager.getProjectInfo('non-existent-id');
      expect(info).toBeNull();
    });
  });

  describe('scanProjectFiles', () => {
    it('should scan project files', async () => {
      const projectPath = '/test/project';

      // Mock fs operations
      mockFs.existsSync.mockReturnValue(true);
      mockFs.statSync.mockReturnValue({
        isDirectory: () => true,
        size: 1000,
        mtime: new Date()
      } as any);

      // Mock readdir with recursive option
      mockFs.readdirSync.mockReturnValue([
        { name: 'index.js', isDirectory: () => false },
        { name: 'src', isDirectory: () => true },
        { name: 'package.json', isDirectory: () => false }
      ] as any);

      const result = await projectManager.scanProjectFiles(projectPath);

      expect(result).toHaveProperty('files');
      expect(result).toHaveProperty('totalFiles');
      expect(result).toHaveProperty('totalSize');
      expect(result).toHaveProperty('fileTypes');
    });

    it('should handle scan errors gracefully', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = await projectManager.scanProjectFiles('/non-existent');

      expect(result).toHaveProperty('error');
      expect(result.files).toEqual([]);
    });

    it('should filter out ignored files', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readdirSync.mockReturnValue([
        { name: 'node_modules', isDirectory: () => true },
        { name: '.git', isDirectory: () => true },
        { name: 'src', isDirectory: () => true },
        { name: 'index.js', isDirectory: () => false }
      ] as any);

      const result = await projectManager.scanProjectFiles('/test/project');

      // Verify node_modules and .git are not processed
      const hasIgnoredDirs = result.files.some((f: any) =>
        f.path.includes('node_modules') || f.path.includes('.git')
      );
      expect(hasIgnoredDirs).toBe(false);
    });
  });

  describe('private methods', () => {
    it('should detect architecture type', () => {
      const analysisResult = {
        architectureType: 'microservices',
        patterns: ['api-gateway', 'service-discovery']
      };

      const architectureType = (projectManager as any).detectArchitectureType(analysisResult);
      expect(architectureType).toBe('microservices');
    });

    it('should extract architecture patterns', () => {
      const analysisResult = {
        patterns: ['mvc', 'repository', 'factory']
      };

      const patterns = (projectManager as any).extractArchitecturePatterns(analysisResult);
      expect(patterns).toContain('mvc');
      expect(patterns).toContain('repository');
    });

    it('should detect frameworks', () => {
      const analysisResult = {
        dependencies: {
          'express': '^4.0.0',
          'react': '^17.0.0',
          '@angular/core': '^12.0.0'
        }
      };

      const frameworks = (projectManager as any).detectFrameworks(analysisResult);
      expect(frameworks).toEqual(expect.arrayContaining(['express', 'react', '@angular/core']));
    });

    it('should extract use cases', () => {
      const analysisResult = {
        useCases: [
          { name: 'user-authentication', priority: 'high' },
          { name: 'data-processing', priority: 'medium' }
        ]
      };

      const useCases = (projectManager as any).extractUseCases(analysisResult);
      expect(useCases).toHaveLength(2);
      expect(useCases[0].name).toBe('user-authentication');
    });
  });
});