import { TreeNavigator, NodeType, DependencyType } from '../../../src/features/tree-navigation/navigator';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('TreeNavigator', () => {
  let navigator: TreeNavigator;
  const testProjectPath = path.join(__dirname, '..', '..', 'fixtures', 'tree-test');

  beforeAll(async () => {
    navigator = new TreeNavigator();
    await createTreeTestFixtures();
  });

  afterAll(async () => {
    await cleanupTestFixtures();
  });

  describe('buildTree', () => {
    test('should build dependency tree for project', async () => {
      const tree = await navigator.buildTree({
        projectPath: testProjectPath,
        showDependencies: true,
        includeExternal: false
      });

      expect(tree.root).toBeDefined();
      expect(tree.nodes.size).toBeGreaterThan(0);
      expect(tree.edges.length).toBeGreaterThanOrEqual(0);
      expect(tree.statistics).toHaveProperty('totalNodes');
      expect(tree.statistics).toHaveProperty('totalEdges');
      expect(tree.statistics.totalNodes).toBe(tree.nodes.size);
    });

    test('should include external dependencies when requested', async () => {
      const tree = await navigator.buildTree({
        projectPath: testProjectPath,
        showDependencies: true,
        includeExternal: true
      });

      const externalNodes = Array.from(tree.nodes.values()).filter(
        node => node.type === NodeType.EXTERNAL
      );
      
      if (externalNodes.length > 0) {
        expect(externalNodes[0].name).toMatch(/^(react|express|lodash)/); // Common external deps
        expect(externalNodes[0].language).toBe('external');
        expect(externalNodes[0].size).toBe(0);
      }
    });

    test('should filter by file pattern', async () => {
      const tree = await navigator.buildTree({
        projectPath: testProjectPath,
        filePattern: '**/*.ts',
        showDependencies: true
      });

      for (const [nodeId, node] of tree.nodes) {
        if (node.type === NodeType.FILE) {
          expect(node.path).toMatch(/\.ts$/);
        }
      }
    });

    test('should detect circular dependencies', async () => {
      const tree = await navigator.buildTree({
        projectPath: testProjectPath,
        showDependencies: true,
        circularOnly: false
      });

      expect(tree.circularDependencies).toBeInstanceOf(Array);
      
      // Check if our test fixtures created any circular dependencies
      if (tree.circularDependencies.length > 0) {
        const cycle = tree.circularDependencies[0];
        expect(cycle.path).toBeInstanceOf(Array);
        expect(cycle.path.length).toBeGreaterThanOrEqual(2);
        expect(cycle.severity).toBeOneOf(['low', 'medium', 'high', 'critical']);
        expect(cycle.description).toBeTruthy();
        expect(cycle.suggestions).toBeInstanceOf(Array);
        expect(cycle.suggestions.length).toBeGreaterThan(0);
      }
    });

    test('should show only circular dependencies when requested', async () => {
      const tree = await navigator.buildTree({
        projectPath: testProjectPath,
        showDependencies: true,
        circularOnly: true
      });

      // If circular dependencies exist, edges should only include those in cycles
      if (tree.circularDependencies.length > 0) {
        for (const edge of tree.edges) {
          const isPartOfCycle = tree.circularDependencies.some(cycle =>
            cycle.path.includes(edge.from) && cycle.path.includes(edge.to)
          );
          expect(isPartOfCycle).toBe(true);
        }
      }
    });

    test('should calculate accurate statistics', async () => {
      const tree = await navigator.buildTree({
        projectPath: testProjectPath,
        showDependencies: true
      });

      const stats = tree.statistics;
      
      expect(stats.totalNodes).toBe(tree.nodes.size);
      expect(stats.totalEdges).toBe(tree.edges.length);
      expect(stats.maxDepth).toBeGreaterThanOrEqual(0);
      expect(stats.averageDependencies).toBeGreaterThanOrEqual(0);
      expect(stats.circularDependencyCount).toBe(tree.circularDependencies.length);
      
      const externalEdges = tree.edges.filter(edge => edge.isExternal);
      expect(stats.externalDependencyCount).toBe(externalEdges.length);
    });

    test('should create proper tree structure', async () => {
      const tree = await navigator.buildTree({
        projectPath: testProjectPath,
        showDependencies: true
      });

      expect(tree.root).toBeDefined();
      expect(tree.root.type).toBeOneOf([NodeType.FILE, NodeType.VIRTUAL]);
      
      // Root should have children or be the only node
      if (tree.nodes.size > 1) {
        expect(tree.root.children.length).toBeGreaterThan(0);
      }

      // Verify parent-child relationships
      for (const [nodeId, node] of tree.nodes) {
        for (const child of node.children) {
          expect(child.parents).toContain(node);
        }
        
        for (const parent of node.parents) {
          expect(parent.children).toContain(node);
        }
      }
    });

    test('should handle empty project gracefully', async () => {
      const emptyProjectPath = path.join(__dirname, '..', '..', 'fixtures', 'empty-tree-project');
      await fs.mkdir(emptyProjectPath, { recursive: true });

      const tree = await navigator.buildTree({
        projectPath: emptyProjectPath,
        showDependencies: true
      });

      expect(tree.nodes.size).toBe(0);
      expect(tree.edges.length).toBe(0);
      expect(tree.statistics.totalNodes).toBe(0);
      expect(tree.statistics.totalEdges).toBe(0);

      await fs.rm(emptyProjectPath, { recursive: true, force: true });
    });
  });

  describe('Node Analysis', () => {
    test('should correctly identify entry points', async () => {
      const tree = await navigator.buildTree({
        projectPath: testProjectPath,
        showDependencies: true
      });

      const entryPoints = Array.from(tree.nodes.values()).filter(
        node => node.metadata.isEntryPoint
      );

      for (const entryPoint of entryPoints) {
        expect(['index', 'main', 'app', 'server', 'cli']).toContain(
          path.parse(entryPoint.name).name.toLowerCase()
        );
      }
    });

    test('should correctly identify leaf nodes', async () => {
      const tree = await navigator.buildTree({
        projectPath: testProjectPath,
        showDependencies: true
      });

      for (const [nodeId, node] of tree.nodes) {
        if (node.metadata.isLeaf) {
          expect(node.children.length).toBe(0);
        } else {
          expect(node.children.length).toBeGreaterThan(0);
        }
      }
    });

    test('should calculate node metadata correctly', async () => {
      const tree = await navigator.buildTree({
        projectPath: testProjectPath,
        showDependencies: true
      });

      for (const [nodeId, node] of tree.nodes) {
        if (node.type === NodeType.FILE) {
          expect(node.metadata.linesOfCode).toBeGreaterThanOrEqual(0);
          expect(node.metadata.maintainabilityIndex).toBeGreaterThanOrEqual(0);
          expect(node.metadata.maintainabilityIndex).toBeLessThanOrEqual(171); // Max maintainability index
          expect(node.metadata.lastModified).toBeInstanceOf(Date);
          expect(node.metadata.imports).toBeInstanceOf(Array);
          expect(node.metadata.exports).toBeInstanceOf(Array);
        }
      }
    });

    test('should detect correct programming languages', async () => {
      const tree = await navigator.buildTree({
        projectPath: testProjectPath,
        showDependencies: true
      });

      for (const [nodeId, node] of tree.nodes) {
        if (node.type === NodeType.FILE) {
          const ext = path.extname(node.path);
          switch (ext) {
            case '.ts':
            case '.tsx':
              expect(node.language).toBe('typescript');
              break;
            case '.js':
            case '.jsx':
              expect(node.language).toBe('javascript');
              break;
            case '.py':
              expect(node.language).toBe('python');
              break;
          }
        }
      }
    });
  });

  describe('Dependency Analysis', () => {
    test('should create correct dependency edges', async () => {
      const tree = await navigator.buildTree({
        projectPath: testProjectPath,
        showDependencies: true
      });

      for (const edge of tree.edges) {
        expect(tree.nodes.has(edge.from)).toBe(true);
        expect(tree.nodes.has(edge.to)).toBe(true);
        expect(edge.type).toBeOneOf(Object.values(DependencyType));
        expect(edge.weight).toBeGreaterThanOrEqual(1);
        expect(typeof edge.isExternal).toBe('boolean');
        
        if (edge.line) {
          expect(edge.line).toBeGreaterThan(0);
        }
      }
    });

    test('should distinguish between internal and external dependencies', async () => {
      const tree = await navigator.buildTree({
        projectPath: testProjectPath,
        showDependencies: true,
        includeExternal: true
      });

      const internalEdges = tree.edges.filter(edge => !edge.isExternal);
      const externalEdges = tree.edges.filter(edge => edge.isExternal);

      // Internal edges should connect nodes within the project
      for (const edge of internalEdges) {
        const fromNode = tree.nodes.get(edge.from)!;
        const toNode = tree.nodes.get(edge.to)!;
        
        expect(fromNode.type).toBe(NodeType.FILE);
        expect([NodeType.FILE, NodeType.MODULE].includes(toNode.type)).toBe(true);
      }

      // External edges should connect to external nodes
      for (const edge of externalEdges) {
        const toNode = tree.nodes.get(edge.to);
        if (toNode) {
          expect(toNode.type).toBe(NodeType.EXTERNAL);
        }
      }
    });

    test('should calculate edge weights appropriately', async () => {
      const tree = await navigator.buildTree({
        projectPath: testProjectPath,
        showDependencies: true
      });

      // Export edges should have higher weight than import edges
      const importEdges = tree.edges.filter(edge => edge.type === DependencyType.IMPORT);
      const exportEdges = tree.edges.filter(edge => edge.type === DependencyType.EXPORT);

      if (importEdges.length > 0 && exportEdges.length > 0) {
        const avgImportWeight = importEdges.reduce((sum, edge) => sum + edge.weight, 0) / importEdges.length;
        const avgExportWeight = exportEdges.reduce((sum, edge) => sum + edge.weight, 0) / exportEdges.length;
        
        expect(avgExportWeight).toBeGreaterThanOrEqual(avgImportWeight);
      }
    });
  });

  describe('Circular Dependency Detection', () => {
    test('should provide meaningful descriptions for circular dependencies', async () => {
      const tree = await navigator.buildTree({
        projectPath: testProjectPath,
        showDependencies: true
      });

      for (const cycle of tree.circularDependencies) {
        expect(cycle.description).toContain('Circular dependency');
        expect(cycle.description).toContain(cycle.path.length.toString());
        expect(cycle.description).toMatch(/\b(files?|modules?)\b/);
      }
    });

    test('should provide helpful suggestions for circular dependencies', async () => {
      const tree = await navigator.buildTree({
        projectPath: testProjectPath,
        showDependencies: true
      });

      for (const cycle of tree.circularDependencies) {
        expect(cycle.suggestions.length).toBeGreaterThan(0);
        
        const suggestionText = cycle.suggestions.join(' ').toLowerCase();
        expect(suggestionText).toMatch(/(extract|inject|decouple|merge|separate)/);
      }
    });

    test('should calculate appropriate severity for circular dependencies', async () => {
      const tree = await navigator.buildTree({
        projectPath: testProjectPath,
        showDependencies: true
      });

      for (const cycle of tree.circularDependencies) {
        // Longer cycles should generally have higher severity
        if (cycle.path.length > 5) {
          expect(['high', 'critical']).toContain(cycle.severity);
        } else if (cycle.path.length <= 2) {
          expect(['low', 'medium']).toContain(cycle.severity);
        }
      }
    });
  });

  describe('Module Clustering', () => {
    test('should create meaningful clusters', async () => {
      const tree = await navigator.buildTree({
        projectPath: testProjectPath,
        showDependencies: true
      });

      expect(tree.clusters).toBeInstanceOf(Array);
      
      for (const cluster of tree.clusters) {
        expect(cluster.id).toBeTruthy();
        expect(cluster.name).toBeTruthy();
        expect(cluster.nodes).toBeInstanceOf(Array);
        expect(cluster.nodes.length).toBeGreaterThan(1); // Clusters should have multiple nodes
        expect(cluster.cohesion).toBeGreaterThanOrEqual(0);
        expect(cluster.cohesion).toBeLessThanOrEqual(1);
        expect(cluster.coupling).toBeGreaterThanOrEqual(0);
        expect(cluster.description).toBeTruthy();
      }
    });

    test('should calculate cohesion and coupling correctly', async () => {
      const tree = await navigator.buildTree({
        projectPath: testProjectPath,
        showDependencies: true
      });

      for (const cluster of tree.clusters) {
        // High cohesion clusters should have many internal connections
        if (cluster.cohesion > 0.5) {
          const internalEdges = tree.edges.filter(edge =>
            cluster.nodes.includes(edge.from) && cluster.nodes.includes(edge.to)
          );
          expect(internalEdges.length).toBeGreaterThan(0);
        }

        // High coupling clusters should have many external connections
        if (cluster.coupling > 1.0) {
          const externalEdges = tree.edges.filter(edge =>
            (cluster.nodes.includes(edge.from) && !cluster.nodes.includes(edge.to)) ||
            (!cluster.nodes.includes(edge.from) && cluster.nodes.includes(edge.to))
          );
          expect(externalEdges.length).toBeGreaterThan(cluster.nodes.length);
        }
      }
    });
  });

  describe('Tree Printing', () => {
    test('should print tree structure without errors', () => {
      const mockTree = {
        root: {
          id: 'root',
          name: 'Root',
          type: NodeType.VIRTUAL,
          language: 'virtual',
          path: '/',
          size: 0,
          complexity: 0,
          children: [],
          parents: [],
          metadata: {
            exports: [],
            imports: [],
            lastModified: new Date(),
            linesOfCode: 0,
            maintainabilityIndex: 100,
            isEntryPoint: true,
            isLeaf: true
          }
        },
        nodes: new Map(),
        edges: [],
        circularDependencies: [],
        clusters: [],
        statistics: {
          totalNodes: 1,
          totalEdges: 0,
          maxDepth: 0,
          averageDependencies: 0,
          circularDependencyCount: 0,
          externalDependencyCount: 0,
          clustersCount: 0
        }
      };

      // Should not throw when printing
      expect(() => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        navigator.printTree(mockTree, 3);
        consoleSpy.mockRestore();
      }).not.toThrow();
    });
  });

  // Helper functions
  async function createTreeTestFixtures(): Promise<void> {
    await fs.mkdir(testProjectPath, { recursive: true });

    // Create package.json with dependencies
    await fs.writeFile(
      path.join(testProjectPath, 'package.json'),
      JSON.stringify({
        name: 'tree-test-project',
        version: '1.0.0',
        dependencies: {
          'react': '^18.0.0',
          'express': '^4.18.0',
          'lodash': '^4.17.0'
        }
      }, null, 2)
    );

    // Create src directory
    const srcPath = path.join(testProjectPath, 'src');
    await fs.mkdir(srcPath, { recursive: true });

    // Create index.ts (entry point)
    await fs.writeFile(
      path.join(srcPath, 'index.ts'),
      `
import { UserService } from './services/user-service';
import { AuthService } from './services/auth-service';
import { logger } from './utils/logger';
import express from 'express';

const app = express();
const userService = new UserService();
const authService = new AuthService();

export { app, userService, authService };
      `.trim()
    );

    // Create services directory
    const servicesPath = path.join(srcPath, 'services');
    await fs.mkdir(servicesPath, { recursive: true });

    // Create user-service.ts
    await fs.writeFile(
      path.join(servicesPath, 'user-service.ts'),
      `
import { DatabaseService } from './database-service';
import { logger } from '../utils/logger';
import { ValidationError } from '../utils/errors';

export class UserService {
  private db: DatabaseService;
  
  constructor() {
    this.db = new DatabaseService();
  }
  
  async getUser(id: string): Promise<any> {
    logger.info(\`Getting user \${id}\`);
    return this.db.findById('users', id);
  }
  
  async createUser(data: any): Promise<any> {
    if (!data.email) {
      throw new ValidationError('Email is required');
    }
    return this.db.create('users', data);
  }
}
      `.trim()
    );

    // Create auth-service.ts
    await fs.writeFile(
      path.join(servicesPath, 'auth-service.ts'),
      `
import { UserService } from './user-service';
import { logger } from '../utils/logger';
import { hashPassword, verifyPassword } from '../utils/crypto';

export class AuthService {
  private userService: UserService;
  
  constructor() {
    this.userService = new UserService();
  }
  
  async login(email: string, password: string): Promise<boolean> {
    logger.info(\`Login attempt for \${email}\`);
    const user = await this.userService.getUser(email);
    
    if (!user) {
      return false;
    }
    
    return verifyPassword(password, user.passwordHash);
  }
  
  async register(email: string, password: string): Promise<any> {
    const passwordHash = await hashPassword(password);
    return this.userService.createUser({ email, passwordHash });
  }
}
      `.trim()
    );

    // Create database-service.ts
    await fs.writeFile(
      path.join(servicesPath, 'database-service.ts'),
      `
import { logger } from '../utils/logger';

export class DatabaseService {
  private connection: any;
  
  constructor() {
    this.connection = null; // Mock connection
  }
  
  async findById(collection: string, id: string): Promise<any> {
    logger.debug(\`Finding \${id} in \${collection}\`);
    return { id, collection };
  }
  
  async create(collection: string, data: any): Promise<any> {
    logger.debug(\`Creating in \${collection}\`);
    return { id: 'new-id', ...data };
  }
}
      `.trim()
    );

    // Create utils directory
    const utilsPath = path.join(srcPath, 'utils');
    await fs.mkdir(utilsPath, { recursive: true });

    // Create logger.ts
    await fs.writeFile(
      path.join(utilsPath, 'logger.ts'),
      `
export const logger = {
  info: (message: string) => console.log(\`[INFO] \${message}\`),
  debug: (message: string) => console.log(\`[DEBUG] \${message}\`),
  error: (message: string) => console.error(\`[ERROR] \${message}\`)
};
      `.trim()
    );

    // Create errors.ts
    await fs.writeFile(
      path.join(utilsPath, 'errors.ts'),
      `
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}
      `.trim()
    );

    // Create crypto.ts
    await fs.writeFile(
      path.join(utilsPath, 'crypto.ts'),
      `
export async function hashPassword(password: string): Promise<string> {
  // Mock implementation
  return \`hashed_\${password}\`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return hash === \`hashed_\${password}\`;
}
      `.trim()
    );

    // Create a potential circular dependency
    // Make UserService import something from AuthService indirectly
    await fs.writeFile(
      path.join(utilsPath, 'auth-helpers.ts'),
      `
import { AuthService } from '../services/auth-service';

export function isAuthenticated(token: string): boolean {
  // This creates a potential circular dependency
  return token.length > 10;
}
      `.trim()
    );

    // Update user-service to create circular dependency
    await fs.writeFile(
      path.join(servicesPath, 'user-service.ts'),
      `
import { DatabaseService } from './database-service';
import { logger } from '../utils/logger';
import { ValidationError } from '../utils/errors';
import { isAuthenticated } from '../utils/auth-helpers';

export class UserService {
  private db: DatabaseService;
  
  constructor() {
    this.db = new DatabaseService();
  }
  
  async getUser(id: string): Promise<any> {
    logger.info(\`Getting user \${id}\`);
    return this.db.findById('users', id);
  }
  
  async createUser(data: any): Promise<any> {
    if (!data.email) {
      throw new ValidationError('Email is required');
    }
    return this.db.create('users', data);
  }
  
  async isUserAuthenticated(token: string): Promise<boolean> {
    return isAuthenticated(token);
  }
}
      `.trim()
    );
  }

  async function cleanupTestFixtures(): Promise<void> {
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
});