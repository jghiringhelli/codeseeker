import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ClaudeIntegration } from '../../src/cli/claude-integration';
import { ContextOptimizer } from '../../src/cli/context-optimizer';
import { DuplicationDetector } from '../../src/features/duplication/detector';
import { TreeNavigator } from '../../src/features/tree-navigation/navigator';
import { VectorSearch } from '../../src/features/vector-search/search-engine';
import { CentralizationDetector } from '../../src/features/centralization/detector';

describe('CodeMind CLI Integration Tests', () => {
  const testProjectPath = path.join(__dirname, '..', 'fixtures', 'test-project');
  const cliPath = path.join(__dirname, '..', '..', 'src', 'cli', 'codemind.ts');

  beforeAll(async () => {
    // Create test project fixture
    await createTestProjectFixture();
  });

  afterAll(async () => {
    // Cleanup test fixtures
    await cleanupTestFixtures();
  });

  describe('CLI Command Execution', () => {
    test('should display help information', async () => {
      const result = await executeCLI(['--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Intelligent Code Auxiliary System CLI');
      expect(result.stdout).toContain('ask');
      expect(result.stdout).toContain('find-duplicates');
      expect(result.stdout).toContain('tree');
      expect(result.stdout).toContain('search');
      expect(result.stdout).toContain('centralize-config');
    });

    test('should handle invalid commands gracefully', async () => {
      const result = await executeCLI(['invalid-command']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Unknown command');
    });
  });

  describe('Ask Command with Context Optimization', () => {
    test('should process simple query with smart context', async () => {
      const result = await executeCLI([
        'ask',
        'How do I implement authentication?',
        '--context', 'smart',
        '--budget', '4000',
        '--project', testProjectPath
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Claude Response');
      expect(result.stdout).toContain('Context Info');
      expect(result.stdout).toContain('Tokens used');
    });

    test('should optimize context for focused queries', async () => {
      const result = await executeCLI([
        'ask',
        'Fix the login bug',
        '--context', 'smart',
        '--focus', 'auth',
        '--project', testProjectPath
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('optimization');
    });
  });

  describe('Duplication Detection', () => {
    test('should find code duplicates with basic settings', async () => {
      const result = await executeCLI([
        'find-duplicates',
        '--project', testProjectPath,
        '--threshold', '0.7'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Duplication Analysis Results');
      expect(result.stdout).toContain('Found');
      expect(result.stdout).toContain('duplication groups');
    });

    test('should include semantic duplicates when requested', async () => {
      const result = await executeCLI([
        'find-duplicates',
        '--semantic',
        '--threshold', '0.8',
        '--project', testProjectPath
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('semantic');
    });

    test('should provide refactoring suggestions', async () => {
      const result = await executeCLI([
        'find-duplicates',
        '--suggest-refactor',
        '--project', testProjectPath
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Suggestion');
      expect(result.stdout).toContain('Estimated effort');
    });

    test('should output JSON format when requested', async () => {
      const result = await executeCLI([
        'find-duplicates',
        '--output', 'json',
        '--project', testProjectPath
      ]);

      expect(result.exitCode).toBe(0);
      expect(() => JSON.parse(result.stdout)).not.toThrow();
      
      const output = JSON.parse(result.stdout);
      expect(output).toHaveProperty('duplicates');
      expect(output).toHaveProperty('scanInfo');
      expect(output).toHaveProperty('statistics');
    });
  });

  describe('Tree Navigation', () => {
    test('should build and display dependency tree', async () => {
      const result = await executeCLI([
        'tree',
        '--project', testProjectPath
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Project Dependency Tree');
      expect(result.stdout).toContain('📄'); // File icon
    });

    test('should show dependencies when requested', async () => {
      const result = await executeCLI([
        'tree',
        '--show-deps',
        '--project', testProjectPath
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('dependencies');
    });

    test('should filter by file patterns', async () => {
      const result = await executeCLI([
        'tree',
        '--filter', '*.ts',
        '--project', testProjectPath
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('typescript');
    });

    test('should detect circular dependencies', async () => {
      const result = await executeCLI([
        'tree',
        '--circular',
        '--project', testProjectPath
      ]);

      expect(result.exitCode).toBe(0);
      if (result.stdout.includes('Circular Dependencies')) {
        expect(result.stdout).toContain('→');
      }
    });
  });

  describe('Vector Search', () => {
    test('should search for code semantically', async () => {
      const result = await executeCLI([
        'search',
        'authentication function',
        '--project', testProjectPath,
        '--limit', '5'
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Search Results');
      expect(result.stdout).toContain('similarity');
    });

    test('should limit results as requested', async () => {
      const result = await executeCLI([
        'search',
        'helper function',
        '--limit', '3',
        '--project', testProjectPath
      ]);

      expect(result.exitCode).toBe(0);
      const resultLines = result.stdout.split('\n').filter(line => line.match(/^\d+\./));
      expect(resultLines.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Centralization Detection', () => {
    test('should scan for centralization opportunities', async () => {
      const result = await executeCLI([
        'centralize-config',
        '--scan',
        '--project', testProjectPath
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Centralization Opportunities');
      expect(result.stdout).toContain('Benefit score');
    });

    test('should include migration suggestions when requested', async () => {
      const result = await executeCLI([
        'centralize-config',
        '--suggest-migrations',
        '--project', testProjectPath
      ]);

      expect(result.exitCode).toBe(0);
      if (result.stdout.includes('Migration:')) {
        expect(result.stdout).toContain('Estimated effort');
      }
    });

    test('should include risk assessment when requested', async () => {
      const result = await executeCLI([
        'centralize-config',
        '--risk-assess',
        '--project', testProjectPath
      ]);

      expect(result.exitCode).toBe(0);
      if (result.stdout.includes('Migration:')) {
        expect(result.stdout).toContain('risk'); // Should include risk information
      }
    });

    test('should filter by configuration types', async () => {
      const result = await executeCLI([
        'centralize-config',
        '--type', 'api_endpoints,error_messages',
        '--project', testProjectPath
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Centralization Opportunities');
    });
  });

  describe('Context Optimization', () => {
    test('should analyze project for context optimization', async () => {
      const result = await executeCLI([
        'optimize-context',
        '--budget', '8000',
        '--project', testProjectPath
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Context Optimization Analysis');
      expect(result.stdout).toContain('Project type');
      expect(result.stdout).toContain('Total files');
      expect(result.stdout).toContain('Priority files');
    });

    test('should provide recommendations', async () => {
      const result = await executeCLI([
        'optimize-context',
        '--focus', 'authentication',
        '--project', testProjectPath
      ]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Recommendations');
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent project path', async () => {
      const result = await executeCLI([
        'ask',
        'test question',
        '--project', '/non/existent/path'
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Failed');
    });

    test('should handle invalid parameters gracefully', async () => {
      const result = await executeCLI([
        'find-duplicates',
        '--threshold', 'invalid',
        '--project', testProjectPath
      ]);

      expect(result.exitCode).toBe(1);
    });
  });

  // Helper functions
  async function executeCLI(args: string[]): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
  }> {
    return new Promise((resolve) => {
      const child = spawn('tsx', [cliPath, ...args], {
        stdio: 'pipe',
        cwd: path.join(__dirname, '..', '..')
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          exitCode: code || 0,
          stdout,
          stderr
        });
      });

      // Set timeout to prevent hanging tests
      setTimeout(() => {
        child.kill();
        resolve({
          exitCode: 1,
          stdout,
          stderr: stderr + 'Test timeout'
        });
      }, 30000);
    });
  }

  async function createTestProjectFixture(): Promise<void> {
    await fs.mkdir(testProjectPath, { recursive: true });
    
    // Create package.json
    await fs.writeFile(
      path.join(testProjectPath, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          'react': '^18.0.0',
          'express': '^4.18.0'
        }
      }, null, 2)
    );

    // Create src directory and test files
    const srcPath = path.join(testProjectPath, 'src');
    await fs.mkdir(srcPath, { recursive: true });

    // Create auth.ts with duplicated code
    await fs.writeFile(
      path.join(srcPath, 'auth.ts'),
      `
export function validateUser(username: string, password: string): boolean {
  if (!username || !password) {
    throw new Error('Username and password are required');
  }
  
  if (username.length < 3) {
    throw new Error('Username must be at least 3 characters');
  }
  
  return true;
}

export const API_URL = 'https://api.example.com/auth';
export const TIMEOUT = 5000;
      `.trim()
    );

    // Create user.ts with similar duplicated code
    await fs.writeFile(
      path.join(srcPath, 'user.ts'),
      `
export function validateUserData(name: string, email: string): boolean {
  if (!name || !email) {
    throw new Error('Name and email are required');
  }
  
  if (name.length < 3) {
    throw new Error('Name must be at least 3 characters');
  }
  
  return true;
}

export const API_BASE = 'https://api.example.com/users';
export const REQUEST_TIMEOUT = 5000;
      `.trim()
    );

    // Create utils.ts
    await fs.writeFile(
      path.join(srcPath, 'utils.ts'),
      `
import { validateUser } from './auth';
import { validateUserData } from './user';

export function formatError(message: string): string {
  return \`Error: \${message}\`;
}

export const colors = {
  primary: '#007bff',
  secondary: '#6c757d',
  success: '#28a745',
  danger: '#dc3545'
};
      `.trim()
    );

    // Create components directory
    const componentsPath = path.join(srcPath, 'components');
    await fs.mkdir(componentsPath, { recursive: true });

    // Create Button.tsx with styling constants
    await fs.writeFile(
      path.join(componentsPath, 'Button.tsx'),
      `
import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}

export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary' }) => {
  const primaryColor = '#007bff';
  const secondaryColor = '#6c757d';
  
  return (
    <button 
      style={{ 
        backgroundColor: variant === 'primary' ? primaryColor : secondaryColor,
        padding: '8px 16px',
        border: 'none',
        borderRadius: '4px'
      }}
    >
      {children}
    </button>
  );
};
      `.trim()
    );

    // Create Card.tsx with similar styling
    await fs.writeFile(
      path.join(componentsPath, 'Card.tsx'),
      `
import React from 'react';

interface CardProps {
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children }) => {
  const primaryColor = '#007bff';
  const backgroundColor = '#ffffff';
  
  return (
    <div 
      style={{ 
        backgroundColor,
        padding: '16px',
        border: \`1px solid \${primaryColor}\`,
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}
    >
      {children}
    </div>
  );
};
      `.trim()
    );

    // Create index.ts that imports everything
    await fs.writeFile(
      path.join(srcPath, 'index.ts'),
      `
export * from './auth';
export * from './user';
export * from './utils';
export * from './components/Button';
export * from './components/Card';
      `.trim()
    );

    // Create config files with scattered configuration
    await fs.writeFile(
      path.join(testProjectPath, '.env.example'),
      `
DATABASE_URL=postgresql://localhost/testdb
API_URL=https://api.example.com
REDIS_URL=redis://localhost:6379
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