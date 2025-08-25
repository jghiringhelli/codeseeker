import { ContextOptimizer, ContextOptimization, ProjectInfo } from '../../../src/cli/context-optimizer';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('ContextOptimizer', () => {
  let optimizer: ContextOptimizer;
  const testProjectPath = path.join(__dirname, '..', '..', 'fixtures', 'context-test');

  beforeAll(async () => {
    optimizer = new ContextOptimizer();
    await createContextTestFixtures();
  });

  afterAll(async () => {
    await cleanupTestFixtures();
  });

  describe('optimizeContext', () => {
    test('should optimize context for simple query', async () => {
      const result = await optimizer.optimizeContext({
        projectPath: testProjectPath,
        query: 'How do I add authentication?',
        tokenBudget: 8000,
        contextType: 'smart'
      });

      expect(result).toHaveProperty('projectPath', testProjectPath);
      expect(result).toHaveProperty('tokenBudget', 8000);
      expect(result).toHaveProperty('strategy', 'smart');
      expect(result).toHaveProperty('estimatedTokens');
      expect(result).toHaveProperty('priorityFiles');
      expect(result).toHaveProperty('projectInfo');

      expect(result.priorityFiles).toBeInstanceOf(Array);
      expect(result.estimatedTokens).toBeGreaterThanOrEqual(0);
      expect(result.estimatedTokens).toBeLessThanOrEqual(result.tokenBudget * 1.2); // Allow some overhead
    });

    test('should prioritize relevant files based on query', async () => {
      const result = await optimizer.optimizeContext({
        projectPath: testProjectPath,
        query: 'authentication login user',
        tokenBudget: 6000,
        contextType: 'smart'
      });

      const authRelevantFiles = result.priorityFiles.filter(file => 
        file.path.toLowerCase().includes('auth') || 
        file.path.toLowerCase().includes('user') ||
        file.path.toLowerCase().includes('login')
      );

      expect(authRelevantFiles.length).toBeGreaterThan(0);
      
      // Auth-related files should have higher scores
      const authScores = authRelevantFiles.map(f => f.score);
      const otherScores = result.priorityFiles
        .filter(f => !authRelevantFiles.includes(f))
        .map(f => f.score);

      if (otherScores.length > 0) {
        const avgAuthScore = authScores.reduce((a, b) => a + b, 0) / authScores.length;
        const avgOtherScore = otherScores.reduce((a, b) => a + b, 0) / otherScores.length;
        expect(avgAuthScore).toBeGreaterThanOrEqual(avgOtherScore);
      }
    });

    test('should respect token budget in smart mode', async () => {
      const smallBudget = 2000;
      const largeBudget = 10000;

      const smallResult = await optimizer.optimizeContext({
        projectPath: testProjectPath,
        query: 'general question',
        tokenBudget: smallBudget,
        contextType: 'smart'
      });

      const largeResult = await optimizer.optimizeContext({
        projectPath: testProjectPath,
        query: 'general question',
        tokenBudget: largeBudget,
        contextType: 'smart'
      });

      expect(smallResult.priorityFiles.length).toBeLessThanOrEqual(largeResult.priorityFiles.length);
      expect(smallResult.estimatedTokens).toBeLessThanOrEqual(smallResult.tokenBudget * 0.9);
      expect(largeResult.estimatedTokens).toBeLessThanOrEqual(largeResult.tokenBudget * 0.9);
    });

    test('should handle focus area filtering', async () => {
      const result = await optimizer.optimizeContext({
        projectPath: testProjectPath,
        query: 'fix bugs',
        tokenBudget: 8000,
        contextType: 'smart',
        focusArea: 'services'
      });

      const serviceFiles = result.priorityFiles.filter(file => 
        file.path.includes('services')
      );

      expect(serviceFiles.length).toBeGreaterThan(0);
      
      // Service files should be prioritized
      const maxServiceScore = Math.max(...serviceFiles.map(f => f.score));
      const maxOtherScore = Math.max(...result.priorityFiles
        .filter(f => !serviceFiles.includes(f))
        .map(f => f.score), 0);

      expect(maxServiceScore).toBeGreaterThanOrEqual(maxOtherScore);
    });

    test('should use different strategies based on context type', async () => {
      const minimalResult = await optimizer.optimizeContext({
        projectPath: testProjectPath,
        query: 'test question',
        tokenBudget: 8000,
        contextType: 'minimal'
      });

      const fullResult = await optimizer.optimizeContext({
        projectPath: testProjectPath,
        query: 'test question',
        tokenBudget: 8000,
        contextType: 'full'
      });

      expect(minimalResult.strategy).toBe('minimal');
      expect(fullResult.strategy).toBe('full');
      expect(minimalResult.priorityFiles.length).toBeLessThan(fullResult.priorityFiles.length);
    });

    test('should auto-determine strategy based on project size', async () => {
      const result = await optimizer.optimizeContext({
        projectPath: testProjectPath,
        query: 'test question',
        tokenBudget: 8000,
        contextType: 'auto'
      });

      expect(['minimal', 'smart', 'full']).toContain(result.strategy);
      
      // Strategy should be based on project info
      if (result.projectInfo) {
        if (result.projectInfo.totalFiles > 1000) {
          expect(result.strategy).toBe('minimal');
        } else if (result.projectInfo.totalFiles > 100) {
          expect(result.strategy).toBe('smart');
        } else {
          expect(result.strategy).toBe('full');
        }
      }
    });
  });

  describe('analyzeProject', () => {
    test('should analyze project structure correctly', async () => {
      const result = await optimizer.analyzeProject({
        projectPath: testProjectPath,
        tokenBudget: 8000
      });

      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('primaryLanguage');
      expect(result).toHaveProperty('totalFiles');
      expect(result).toHaveProperty('totalLinesOfCode');

      expect(result.totalFiles).toBeGreaterThan(0);
      expect(result.totalLinesOfCode).toBeGreaterThan(0);
      expect(['web-app', 'api', 'library', 'cli', 'mobile', 'desktop', 'other']).toContain(result.type);
      expect(result.primaryLanguage).toBeTruthy();
    });

    test('should detect project type correctly', async () => {
      const result = await optimizer.analyzeProject({
        projectPath: testProjectPath,
        tokenBudget: 8000
      });

      // Our test fixture has a package.json with React and Express
      expect(['web-app', 'api']).toContain(result.type);
      expect(result.framework).toBeTruthy();
      expect(['React', 'Express.js', 'Next.js']).toContain(result.framework!);
    });

    test('should detect primary language correctly', async () => {
      const result = await optimizer.analyzeProject({
        projectPath: testProjectPath,
        tokenBudget: 8000
      });

      // Our test fixture is primarily TypeScript
      expect(result.primaryLanguage).toBe('typescript');
    });

    test('should detect package manager', async () => {
      const result = await optimizer.analyzeProject({
        projectPath: testProjectPath,
        tokenBudget: 8000
      });

      expect(result.packageManager).toBeTruthy();
      expect(['npm', 'yarn', 'pnpm']).toContain(result.packageManager!);
    });

    test('should provide recommendations', async () => {
      const result = await optimizer.analyzeProject({
        projectPath: testProjectPath,
        tokenBudget: 4000,
        focusArea: 'authentication'
      }) as ProjectInfo & { recommendations: string[] };

      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.recommendations.length).toBeGreaterThan(0);
      
      const recommendationText = result.recommendations.join(' ').toLowerCase();
      expect(recommendationText).toContain('authentication');
    });
  });

  describe('Priority File Selection', () => {
    test('should assign higher importance to critical files', async () => {
      const result = await optimizer.optimizeContext({
        projectPath: testProjectPath,
        query: 'project overview',
        tokenBudget: 8000,
        contextType: 'smart'
      });

      const criticalFiles = result.priorityFiles.filter(f => f.importance === 'critical');
      const lowImportanceFiles = result.priorityFiles.filter(f => f.importance === 'low');

      if (criticalFiles.length > 0 && lowImportanceFiles.length > 0) {
        const avgCriticalScore = criticalFiles.reduce((sum, f) => sum + f.score, 0) / criticalFiles.length;
        const avgLowScore = lowImportanceFiles.reduce((sum, f) => sum + f.score, 0) / lowImportanceFiles.length;
        
        expect(avgCriticalScore).toBeGreaterThan(avgLowScore);
      }
    });

    test('should extract relevant code sections', async () => {
      const result = await optimizer.optimizeContext({
        projectPath: testProjectPath,
        query: 'authentication functions',
        tokenBudget: 8000,
        contextType: 'smart'
      });

      const filesWithSections = result.priorityFiles.filter(f => 
        f.relevantSections && f.relevantSections.length > 0
      );

      expect(filesWithSections.length).toBeGreaterThan(0);

      for (const file of filesWithSections) {
        for (const section of file.relevantSections!) {
          expect(section.startLine).toBeGreaterThan(0);
          expect(section.endLine).toBeGreaterThanOrEqual(section.startLine);
          expect(section.content).toBeTruthy();
          expect(['function', 'class', 'interface', 'import', 'export', 'other']).toContain(section.type);
          expect(section.relevanceScore).toBeGreaterThanOrEqual(0);
        }
      }
    });

    test('should generate meaningful file summaries', async () => {
      const result = await optimizer.optimizeContext({
        projectPath: testProjectPath,
        query: 'understand the code',
        tokenBudget: 8000,
        contextType: 'smart'
      });

      const filesWithSummaries = result.priorityFiles.filter(f => f.summary);
      
      expect(filesWithSummaries.length).toBeGreaterThan(0);

      for (const file of filesWithSummaries) {
        expect(file.summary).toBeTruthy();
        expect(file.summary!.length).toBeGreaterThan(10);
        expect(file.summary!).toMatch(/\w+/); // Should contain words
      }
    });

    test('should detect programming languages correctly', async () => {
      const result = await optimizer.optimizeContext({
        projectPath: testProjectPath,
        query: 'code review',
        tokenBudget: 8000,
        contextType: 'smart'
      });

      for (const file of result.priorityFiles) {
        const ext = path.extname(file.path);
        
        switch (ext) {
          case '.ts':
          case '.tsx':
            expect(file.language).toBe('typescript');
            break;
          case '.js':
          case '.jsx':
            expect(file.language).toBe('javascript');
            break;
          case '.py':
            expect(file.language).toBe('python');
            break;
          case '.json':
          case '.yaml':
          case '.yml':
            expect(file.language).toBeOneOf(['other', 'json', 'yaml']);
            break;
        }
      }
    });
  });

  describe('Pattern Detection', () => {
    test('should detect architectural patterns', async () => {
      const result = await optimizer.optimizeContext({
        projectPath: testProjectPath,
        query: 'architecture review',
        tokenBudget: 8000,
        contextType: 'smart'
      });

      if (result.detectedPatterns && result.detectedPatterns.length > 0) {
        for (const pattern of result.detectedPatterns) {
          expect(pattern.name).toBeTruthy();
          expect(pattern.description).toBeTruthy();
          expect(pattern.confidence).toBeGreaterThanOrEqual(0);
          expect(pattern.confidence).toBeLessThanOrEqual(1);
          expect(pattern.files).toBeInstanceOf(Array);
        }

        // Should detect TypeScript and React patterns from our fixtures
        const patternNames = result.detectedPatterns.map(p => p.name);
        expect(patternNames).toContain('TypeScript Project');
      }
    });

    test('should detect React patterns when React files are present', async () => {
      const result = await optimizer.optimizeContext({
        projectPath: testProjectPath,
        query: 'React components',
        tokenBudget: 8000,
        contextType: 'smart'
      });

      if (result.detectedPatterns) {
        const reactPattern = result.detectedPatterns.find(p => 
          p.name.toLowerCase().includes('react')
        );

        if (reactPattern) {
          expect(reactPattern.confidence).toBeGreaterThan(0.5);
          expect(reactPattern.files.some(f => f.includes('component'))).toBeTruthy();
        }
      }
    });
  });

  describe('Caching', () => {
    test('should use cache for repeated requests', async () => {
      const request = {
        projectPath: testProjectPath,
        query: 'cached query test',
        tokenBudget: 8000,
        contextType: 'smart' as const
      };

      const startTime1 = Date.now();
      const result1 = await optimizer.optimizeContext(request);
      const time1 = Date.now() - startTime1;

      const startTime2 = Date.now();
      const result2 = await optimizer.optimizeContext(request);
      const time2 = Date.now() - startTime2;

      // Second request should be faster (cached)
      expect(time2).toBeLessThan(time1);
      
      // Results should be identical
      expect(result2.priorityFiles.length).toBe(result1.priorityFiles.length);
      expect(result2.estimatedTokens).toBe(result1.estimatedTokens);
      expect(result2.strategy).toBe(result1.strategy);
    });

    test('should clear cache when requested', async () => {
      const request = {
        projectPath: testProjectPath,
        query: 'clear cache test',
        tokenBudget: 8000,
        contextType: 'smart' as const
      };

      // First request
      await optimizer.optimizeContext(request);

      // Clear cache
      optimizer.clearCache();

      // Second request should not be cached
      const startTime = Date.now();
      await optimizer.optimizeContext(request);
      const time = Date.now() - startTime;

      // Should take reasonable time (not instantaneous from cache)
      expect(time).toBeGreaterThan(10);
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent project path', async () => {
      await expect(optimizer.optimizeContext({
        projectPath: '/non/existent/path',
        query: 'test',
        tokenBudget: 8000,
        contextType: 'smart'
      })).rejects.toThrow();
    });

    test('should handle invalid token budget gracefully', async () => {
      const result = await optimizer.optimizeContext({
        projectPath: testProjectPath,
        query: 'test with zero budget',
        tokenBudget: 0,
        contextType: 'smart'
      });

      expect(result.priorityFiles.length).toBe(0);
      expect(result.estimatedTokens).toBe(0);
    });

    test('should handle empty query', async () => {
      const result = await optimizer.optimizeContext({
        projectPath: testProjectPath,
        query: '',
        tokenBudget: 8000,
        contextType: 'smart'
      });

      expect(result.priorityFiles).toBeInstanceOf(Array);
      expect(result.estimatedTokens).toBeGreaterThanOrEqual(0);
    });
  });

  // Helper functions
  async function createContextTestFixtures(): Promise<void> {
    await fs.mkdir(testProjectPath, { recursive: true });

    // Create package.json
    await fs.writeFile(
      path.join(testProjectPath, 'package.json'),
      JSON.stringify({
        name: 'context-test-project',
        version: '1.0.0',
        dependencies: {
          'react': '^18.0.0',
          'express': '^4.18.0',
          '@types/node': '^20.0.0'
        },
        devDependencies: {
          'typescript': '^5.0.0',
          'jest': '^29.0.0'
        }
      }, null, 2)
    );

    // Create package-lock.json to indicate npm usage
    await fs.writeFile(
      path.join(testProjectPath, 'package-lock.json'),
      JSON.stringify({ name: 'context-test-project', version: '1.0.0' }, null, 2)
    );

    // Create src directory
    const srcPath = path.join(testProjectPath, 'src');
    await fs.mkdir(srcPath, { recursive: true });

    // Create index.ts (main entry point)
    await fs.writeFile(
      path.join(srcPath, 'index.ts'),
      `
import express from 'express';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { logger } from './utils/logger';

const app = express();

app.use('/auth', authRoutes);
app.use('/users', userRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(\`Server running on port \${PORT}\`);
});

export default app;
      `.trim()
    );

    // Create routes directory
    const routesPath = path.join(srcPath, 'routes');
    await fs.mkdir(routesPath, { recursive: true });

    // Create auth routes
    await fs.writeFile(
      path.join(routesPath, 'auth.ts'),
      `
import { Router } from 'express';
import { AuthService } from '../services/auth-service';
import { validateEmail, validatePassword } from '../utils/validation';

const router = Router();
const authService = new AuthService();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    if (!validatePassword(password)) {
      return res.status(400).json({ error: 'Invalid password format' });
    }
    
    const result = await authService.authenticate(email, password);
    
    if (result.success) {
      res.json({ token: result.token });
    } else {
      res.status(401).json({ error: 'Authentication failed' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const user = await authService.register({ email, password, name });
    res.status(201).json({ user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export { router as authRoutes };
      `.trim()
    );

    // Create user routes
    await fs.writeFile(
      path.join(routesPath, 'users.ts'),
      `
import { Router } from 'express';
import { UserService } from '../services/user-service';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const userService = new UserService();

router.use(authMiddleware);

router.get('/profile', async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await userService.getUser(userId);
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

router.put('/profile', async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body;
    const user = await userService.updateUser(userId, updates);
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

export { router as userRoutes };
      `.trim()
    );

    // Create services directory
    const servicesPath = path.join(srcPath, 'services');
    await fs.mkdir(servicesPath, { recursive: true });

    // Create auth service
    await fs.writeFile(
      path.join(servicesPath, 'auth-service.ts'),
      `
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserService } from './user-service';
import { logger } from '../utils/logger';

interface AuthResult {
  success: boolean;
  token?: string;
  user?: any;
}

export class AuthService {
  private userService: UserService;
  private jwtSecret: string;
  
  constructor() {
    this.userService = new UserService();
    this.jwtSecret = process.env.JWT_SECRET || 'default-secret';
  }
  
  async authenticate(email: string, password: string): Promise<AuthResult> {
    try {
      const user = await this.userService.findByEmail(email);
      
      if (!user) {
        logger.warn(\`Authentication failed for email: \${email}\`);
        return { success: false };
      }
      
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      
      if (!isValidPassword) {
        logger.warn(\`Invalid password for user: \${email}\`);
        return { success: false };
      }
      
      const token = jwt.sign(
        { userId: user.id, email: user.email },
        this.jwtSecret,
        { expiresIn: '24h' }
      );
      
      logger.info(\`User authenticated successfully: \${email}\`);
      
      return {
        success: true,
        token,
        user: { id: user.id, email: user.email, name: user.name }
      };
    } catch (error) {
      logger.error(\`Authentication error: \${error.message}\`);
      return { success: false };
    }
  }
  
  async register(userData: { email: string; password: string; name: string }): Promise<any> {
    const { email, password, name } = userData;
    
    // Check if user already exists
    const existingUser = await this.userService.findByEmail(email);
    if (existingUser) {
      throw new Error('User already exists');
    }
    
    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Create user
    const user = await this.userService.createUser({
      email,
      passwordHash,
      name
    });
    
    logger.info(\`New user registered: \${email}\`);
    
    return user;
  }
  
  verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      logger.warn(\`Invalid token: \${error.message}\`);
      return null;
    }
  }
}
      `.trim()
    );

    // Create user service
    await fs.writeFile(
      path.join(servicesPath, 'user-service.ts'),
      `
import { logger } from '../utils/logger';

interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UserService {
  private users: Map<string, User> = new Map();
  
  async createUser(userData: { email: string; passwordHash: string; name: string }): Promise<User> {
    const user: User = {
      id: this.generateId(),
      ...userData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.users.set(user.id, user);
    logger.info(\`User created: \${user.email}\`);
    
    return user;
  }
  
  async getUser(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }
  
  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }
  
  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const user = this.users.get(id);
    if (!user) {
      return null;
    }
    
    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: new Date()
    };
    
    this.users.set(id, updatedUser);
    logger.info(\`User updated: \${updatedUser.email}\`);
    
    return updatedUser;
  }
  
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}
      `.trim()
    );

    // Create utils directory
    const utilsPath = path.join(srcPath, 'utils');
    await fs.mkdir(utilsPath, { recursive: true });

    // Create logger utility
    await fs.writeFile(
      path.join(utilsPath, 'logger.ts'),
      `
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

class Logger {
  private logLevel: LogLevel;
  
  constructor() {
    this.logLevel = process.env.LOG_LEVEL === 'debug' ? LogLevel.DEBUG : LogLevel.INFO;
  }
  
  debug(message: string): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.log(\`[DEBUG] \${new Date().toISOString()} - \${message}\`);
    }
  }
  
  info(message: string): void {
    if (this.logLevel <= LogLevel.INFO) {
      console.log(\`[INFO] \${new Date().toISOString()} - \${message}\`);
    }
  }
  
  warn(message: string): void {
    if (this.logLevel <= LogLevel.WARN) {
      console.warn(\`[WARN] \${new Date().toISOString()} - \${message}\`);
    }
  }
  
  error(message: string): void {
    if (this.logLevel <= LogLevel.ERROR) {
      console.error(\`[ERROR] \${new Date().toISOString()} - \${message}\`);
    }
  }
}

export const logger = new Logger();
      `.trim()
    );

    // Create validation utility
    await fs.writeFile(
      path.join(utilsPath, 'validation.ts'),
      `
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
}

export function validatePassword(password: string): boolean {
  // Minimum 8 characters, at least one letter and one number
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\\d)[A-Za-z\\d@$!%*#?&]{8,}$/;
  return passwordRegex.test(password);
}

export function validateName(name: string): boolean {
  return name && name.trim().length >= 2;
}

export function sanitizeString(input: string): string {
  return input.trim().replace(/[<>\"'&]/g, '');
}
      `.trim()
    );

    // Create middleware directory
    const middlewarePath = path.join(srcPath, 'middleware');
    await fs.mkdir(middlewarePath, { recursive: true });

    // Create auth middleware
    await fs.writeFile(
      path.join(middlewarePath, 'auth.ts'),
      `
import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth-service';

const authService = new AuthService();

interface AuthenticatedRequest extends Request {
  user?: any;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    res.status(401).json({ error: 'Access denied. No token provided.' });
    return;
  }
  
  const decoded = authService.verifyToken(token);
  
  if (!decoded) {
    res.status(401).json({ error: 'Access denied. Invalid token.' });
    return;
  }
  
  req.user = decoded;
  next();
}
      `.trim()
    );

    // Create components directory for React components
    const componentsPath = path.join(srcPath, 'components');
    await fs.mkdir(componentsPath, { recursive: true });

    // Create a React component
    await fs.writeFile(
      path.join(componentsPath, 'LoginForm.tsx'),
      `
import React, { useState } from 'react';

interface LoginFormProps {
  onLogin: (email: string, password: string) => void;
  loading?: boolean;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLogin, loading = false }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  
  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};
    
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
      newErrors.email = 'Invalid email format';
    }
    
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      onLogin(email, password);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="login-form">
      <div className="form-group">
        <label htmlFor="email">Email:</label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
        {errors.email && <span className="error">{errors.email}</span>}
      </div>
      
      <div className="form-group">
        <label htmlFor="password">Password:</label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />
        {errors.password && <span className="error">{errors.password}</span>}
      </div>
      
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
};
      `.trim()
    );

    // Create TypeScript config
    await fs.writeFile(
      path.join(testProjectPath, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'es2020',
          module: 'commonjs',
          lib: ['es2020'],
          outDir: './dist',
          rootDir: './src',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true
        },
        include: ['src/**/*'],
        exclude: ['node_modules', 'dist']
      }, null, 2)
    );

    // Create some configuration files
    await fs.writeFile(
      path.join(testProjectPath, '.env.example'),
      `
PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key-here
DATABASE_URL=postgresql://localhost:5432/myapp
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
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