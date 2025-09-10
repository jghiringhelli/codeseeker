/**
 * Task Splitter - Breaks complex requests into manageable sub-tasks
 * Analyzes user requests and semantic context to create optimal task breakdown
 */

import { Logger } from '../utils/logger';
import { ProcessedIntent } from './intent-analyzer';
import { EnhancementContext } from '../shared/semantic-enhancement-engine';

export interface UserFeatureRequest {
  query: string;
  userId?: string;
  projectId: string;
  timestamp: number;
}

export interface SubTask {
  id: string;
  description: string;
  files: string[];
  dependencies: string[];
  estimatedTime: number;
  priority: number;
  type: 'create' | 'modify' | 'test' | 'config' | 'cleanup';
  context: {
    primaryFiles: string[];
    relatedFiles: string[];
    domainKnowledge: string;
  };
}

export interface TaskSplitRequest {
  userRequest: UserFeatureRequest;
  intent: ProcessedIntent;
  context: EnhancementContext;
}

export interface TaskSplitResult {
  subTasks: SubTask[];
  estimatedDuration: number;
  complexity: 'simple' | 'medium' | 'complex';
  riskAssessment: string;
  dependencies: {
    external: string[];
    internal: string[];
  };
}

export class TaskSplitter {
  private logger = Logger.getInstance();

  async createSubTasks(
    request: UserFeatureRequest,
    intent: ProcessedIntent,
    context: EnhancementContext
  ): Promise<SubTask[]> {
    this.logger.info(`🔧 Splitting task: "${request.query}"`);

    try {
      // Build comprehensive analysis prompt for Claude
      const splitPrompt = this.buildTaskSplitPrompt({
        userRequest: request,
        intent,
        context
      });

      // Process with Claude to get intelligent task breakdown
      const claudeResponse = await this.processWithClaude(splitPrompt);
      
      // Parse and validate Claude's task breakdown
      const taskSplit = this.parseTaskSplitResponse(claudeResponse, request.query);
      
      // Optimize task order and dependencies
      const optimizedTasks = this.optimizeTaskOrder(taskSplit.subTasks, context);
      
      // Validate task feasibility
      const validatedTasks = this.validateTasks(optimizedTasks, intent, context);
      
      this.logger.info(`Created ${validatedTasks.length} sub-tasks (${taskSplit.complexity} complexity)`);
      return validatedTasks;
      
    } catch (error) {
      this.logger.error('Task splitting failed, using fallback breakdown:', error);
      return this.generateFallbackTasks(request, intent, context);
    }
  }

  private buildTaskSplitPrompt(splitRequest: TaskSplitRequest): string {
    const { userRequest, intent, context } = splitRequest;
    
    const filesList = context.primaryFiles.slice(0, 8).map(f => 
      `- ${f.filePath} (relevance: ${f.relevanceScore})`
    ).join('\n');
    
    const relatedFilesList = context.relatedFiles.slice(0, 12).map(f =>
      `- ${f.filePath} (${f.relationshipType})`
    ).join('\n');

    return `# Task Breakdown Analysis Request

## User Request
"${userRequest.query}"

## Intent Analysis Results
- **Intention**: ${intent.intention}
- **Complexity**: ${intent.complexity}
- **Estimated Files**: ${intent.estimatedFiles}
- **Risk Level**: ${intent.riskLevel}
- **Primary Domains**: ${intent.primaryDomains.join(', ')}
- **Time Estimate**: ${intent.timeEstimate} minutes
- **Suggested Tools**: ${intent.suggestedTools.join(', ')}

## Primary Files (Most Relevant)
${filesList}

## Related Files (Dependencies & Relationships)
${relatedFilesList}

## Task Breakdown Instructions
Analyze this request and break it down into optimal sub-tasks. Provide a JSON response with this structure:

{
  "subTasks": [
    {
      "id": "task_1",
      "description": "Clear, actionable description",
      "files": ["file1.ts", "file2.ts"],
      "dependencies": ["task_id_this_depends_on"],
      "estimatedTime": 25,
      "priority": 1,
      "type": "create|modify|test|config|cleanup",
      "context": {
        "primaryFiles": ["main files to work with"],
        "relatedFiles": ["files to check/consider"],
        "domainKnowledge": "Key domain concepts and patterns"
      }
    }
  ],
  "estimatedDuration": 90,
  "complexity": "simple|medium|complex",
  "riskAssessment": "Brief risk analysis",
  "dependencies": {
    "external": ["npm packages", "services"],
    "internal": ["modules", "components"]
  },
  "reasoning": "Why this breakdown approach was chosen"
}

## Task Breakdown Guidelines

### Task Types:
- **create**: New files, components, or modules
- **modify**: Changes to existing code
- **test**: Creating or updating tests
- **config**: Configuration changes
- **cleanup**: Refactoring or removing code

### Optimal Task Size:
- **Simple tasks**: 10-30 minutes each
- **Medium tasks**: 30-60 minutes each  
- **Complex tasks**: Split further if over 60 minutes

### Dependencies Management:
- Order tasks by logical dependencies
- Ensure foundation tasks come first
- Group related changes together
- Minimize cross-task file conflicts

### File Assignment Strategy:
- Each task should have 1-5 primary files to modify
- Include related files that need checking
- Avoid multiple tasks modifying the same file simultaneously
- Consider test files for each code change

### Context Optimization:
- Provide domain knowledge for each task
- Include relevant patterns and conventions
- Reference existing implementations to follow
- Highlight potential edge cases or complications

### Risk Considerations:
- Flag high-risk changes (security, core architecture)
- Identify breaking change potential
- Note areas requiring extra testing
- Highlight integration points with external systems

Provide only the JSON response, no additional text.`;
  }

  private async processWithClaude(prompt: string): Promise<string> {
    // Simulate Claude API call - in real implementation, this would call Claude
    this.logger.debug(`Sending ${Math.round(prompt.length/1000)}KB task split prompt to Claude...`);
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Generate intelligent mock response based on prompt analysis
    const mockResponse = this.generateMockClaudeTaskSplit(prompt);
    
    this.logger.debug('Received Claude task breakdown response');
    return mockResponse;
  }

  private generateMockClaudeTaskSplit(prompt: string): string {
    // Extract key information from prompt for intelligent response
    const queryMatch = prompt.match(/"([^"]+)"/);
    const query = queryMatch ? queryMatch[1].toLowerCase() : '';
    
    const intentMatch = prompt.match(/\*\*Intention\*\*: ([^\n]+)/);
    const intention = intentMatch ? intentMatch[1] : 'general_analysis';
    
    const complexityMatch = prompt.match(/\*\*Complexity\*\*: ([^\n]+)/);
    const complexity = complexityMatch ? complexityMatch[1] : 'medium';

    // Generate contextual task breakdown based on request patterns
    if (query.includes('auth') || query.includes('login') || query.includes('jwt') || query.includes('security')) {
      return JSON.stringify({
        subTasks: [
          {
            id: "auth_core",
            description: "Implement core authentication service with JWT token management",
            files: ["src/auth/auth-service.ts", "src/auth/jwt-manager.ts"],
            dependencies: [],
            estimatedTime: 45,
            priority: 1,
            type: "create",
            context: {
              primaryFiles: ["src/auth/auth-service.ts"],
              relatedFiles: ["src/models/user.ts", "src/config/auth-config.ts"],
              domainKnowledge: "JWT tokens, password hashing, session management patterns"
            }
          },
          {
            id: "auth_middleware",
            description: "Create authentication middleware for route protection",
            files: ["src/middleware/auth-middleware.ts"],
            dependencies: ["auth_core"],
            estimatedTime: 30,
            priority: 2,
            type: "create",
            context: {
              primaryFiles: ["src/middleware/auth-middleware.ts"],
              relatedFiles: ["src/auth/auth-service.ts", "src/routes/protected-routes.ts"],
              domainKnowledge: "Express middleware patterns, JWT verification"
            }
          },
          {
            id: "auth_routes",
            description: "Implement authentication routes (login, logout, refresh)",
            files: ["src/routes/auth-routes.ts"],
            dependencies: ["auth_core"],
            estimatedTime: 35,
            priority: 3,
            type: "create",
            context: {
              primaryFiles: ["src/routes/auth-routes.ts"],
              relatedFiles: ["src/auth/auth-service.ts", "src/controllers/auth-controller.ts"],
              domainKnowledge: "RESTful API design, error handling, input validation"
            }
          },
          {
            id: "auth_tests",
            description: "Create comprehensive tests for authentication system",
            files: ["tests/auth/auth-service.test.ts", "tests/auth/auth-middleware.test.ts"],
            dependencies: ["auth_core", "auth_middleware", "auth_routes"],
            estimatedTime: 40,
            priority: 4,
            type: "test",
            context: {
              primaryFiles: ["tests/auth/auth-service.test.ts"],
              relatedFiles: ["src/auth/auth-service.ts", "tests/helpers/test-helpers.ts"],
              domainKnowledge: "Unit testing, JWT mocking, security testing patterns"
            }
          }
        ],
        estimatedDuration: 150,
        complexity: "complex",
        riskAssessment: "High security impact - requires careful JWT implementation and secure password handling",
        dependencies: {
          external: ["jsonwebtoken", "bcrypt", "express"],
          internal: ["user models", "database connection", "error handlers"]
        },
        reasoning: "Authentication is security-critical and requires careful layered implementation with comprehensive testing"
      });
    }

    if (query.includes('test') || query.includes('testing')) {
      return JSON.stringify({
        subTasks: [
          {
            id: "test_structure",
            description: "Set up testing framework and directory structure",
            files: ["tests/setup.ts", "jest.config.js"],
            dependencies: [],
            estimatedTime: 20,
            priority: 1,
            type: "config",
            context: {
              primaryFiles: ["jest.config.js"],
              relatedFiles: ["package.json", "tsconfig.json"],
              domainKnowledge: "Jest configuration, TypeScript testing setup"
            }
          },
          {
            id: "unit_tests",
            description: "Create unit tests for core business logic",
            files: ["tests/unit/core-logic.test.ts"],
            dependencies: ["test_structure"],
            estimatedTime: 35,
            priority: 2,
            type: "test",
            context: {
              primaryFiles: ["tests/unit/core-logic.test.ts"],
              relatedFiles: ["src/core/business-logic.ts", "tests/helpers/mocks.ts"],
              domainKnowledge: "Unit testing patterns, mocking strategies"
            }
          },
          {
            id: "integration_tests",
            description: "Implement integration tests for API endpoints",
            files: ["tests/integration/api.test.ts"],
            dependencies: ["test_structure"],
            estimatedTime: 45,
            priority: 3,
            type: "test",
            context: {
              primaryFiles: ["tests/integration/api.test.ts"],
              relatedFiles: ["src/routes/api-routes.ts", "tests/helpers/test-server.ts"],
              domainKnowledge: "Integration testing, HTTP request testing, database mocking"
            }
          }
        ],
        estimatedDuration: 100,
        complexity: "medium",
        riskAssessment: "Low risk - testing improves code quality and catches regressions",
        dependencies: {
          external: ["jest", "supertest", "@types/jest"],
          internal: ["existing code modules", "test utilities"]
        },
        reasoning: "Test implementation should follow standard patterns with proper setup and comprehensive coverage"
      });
    }

    if (query.includes('refactor') || query.includes('improve') || query.includes('clean')) {
      return JSON.stringify({
        subTasks: [
          {
            id: "analyze_code",
            description: "Analyze current code structure and identify refactoring opportunities",
            files: [],
            dependencies: [],
            estimatedTime: 25,
            priority: 1,
            type: "cleanup",
            context: {
              primaryFiles: [],
              relatedFiles: ["src/**/*.ts"],
              domainKnowledge: "Code analysis, architectural patterns, SOLID principles"
            }
          },
          {
            id: "extract_common",
            description: "Extract common functionality into reusable utilities",
            files: ["src/utils/common-helpers.ts"],
            dependencies: ["analyze_code"],
            estimatedTime: 40,
            priority: 2,
            type: "create",
            context: {
              primaryFiles: ["src/utils/common-helpers.ts"],
              relatedFiles: ["src/services/*.ts", "src/controllers/*.ts"],
              domainKnowledge: "DRY principle, utility function design, module extraction"
            }
          },
          {
            id: "update_references",
            description: "Update all references to use refactored common utilities",
            files: ["src/services/user-service.ts", "src/controllers/user-controller.ts"],
            dependencies: ["extract_common"],
            estimatedTime: 30,
            priority: 3,
            type: "modify",
            context: {
              primaryFiles: ["src/services/user-service.ts"],
              relatedFiles: ["src/utils/common-helpers.ts"],
              domainKnowledge: "Import management, dependency injection, breaking change prevention"
            }
          }
        ],
        estimatedDuration: 95,
        complexity: "medium",
        riskAssessment: "Medium risk - refactoring can introduce bugs if not properly tested",
        dependencies: {
          external: [],
          internal: ["existing service modules", "controller files"]
        },
        reasoning: "Refactoring should be systematic with analysis first, then careful extraction and updating"
      });
    }

    // Default fallback for general requests
    return JSON.stringify({
      subTasks: [
        {
          id: "main_task",
          description: `Implement core functionality for: ${query}`,
          files: ["src/main-feature.ts"],
          dependencies: [],
          estimatedTime: 45,
          priority: 1,
          type: "modify",
          context: {
            primaryFiles: ["src/main-feature.ts"],
            relatedFiles: ["src/related-modules.ts"],
            domainKnowledge: "General implementation patterns and best practices"
          }
        },
        {
          id: "add_tests",
          description: "Add tests for the new functionality",
          files: ["tests/main-feature.test.ts"],
          dependencies: ["main_task"],
          estimatedTime: 25,
          priority: 2,
          type: "test",
          context: {
            primaryFiles: ["tests/main-feature.test.ts"],
            relatedFiles: ["src/main-feature.ts"],
            domainKnowledge: "Testing patterns and coverage requirements"
          }
        }
      ],
      estimatedDuration: 70,
      complexity: complexity as any,
      riskAssessment: "Standard implementation risk - follow testing and code review practices",
      dependencies: {
        external: [],
        internal: ["core modules"]
      },
      reasoning: "General implementation approach with proper testing coverage"
    });
  }

  private parseTaskSplitResponse(response: string, originalQuery: string): TaskSplitResult {
    try {
      const parsed = JSON.parse(response);
      
      // Validate and normalize the response
      const taskSplit: TaskSplitResult = {
        subTasks: this.validateSubTasks(parsed.subTasks || []),
        estimatedDuration: Math.max(10, Math.min(300, parsed.estimatedDuration || 60)),
        complexity: this.validateComplexity(parsed.complexity),
        riskAssessment: parsed.riskAssessment || 'Standard implementation risk',
        dependencies: {
          external: Array.isArray(parsed.dependencies?.external) ? parsed.dependencies.external : [],
          internal: Array.isArray(parsed.dependencies?.internal) ? parsed.dependencies.internal : []
        }
      };
      
      return taskSplit;
    } catch (error) {
      this.logger.warn('Failed to parse Claude task split response, using fallback');
      return this.generateFallbackTaskSplit(originalQuery);
    }
  }

  private validateSubTasks(tasks: any[]): SubTask[] {
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return [];
    }

    return tasks.map((task, index) => ({
      id: task.id || `task_${index + 1}`,
      description: task.description || `Task ${index + 1}`,
      files: Array.isArray(task.files) ? task.files : [],
      dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
      estimatedTime: Math.max(5, Math.min(120, task.estimatedTime || 30)),
      priority: Math.max(1, Math.min(10, task.priority || index + 1)),
      type: this.validateTaskType(task.type),
      context: {
        primaryFiles: Array.isArray(task.context?.primaryFiles) ? task.context.primaryFiles : task.files || [],
        relatedFiles: Array.isArray(task.context?.relatedFiles) ? task.context.relatedFiles : [],
        domainKnowledge: task.context?.domainKnowledge || 'General implementation knowledge'
      }
    }));
  }

  private validateTaskType(type: any): 'create' | 'modify' | 'test' | 'config' | 'cleanup' {
    const validTypes = ['create', 'modify', 'test', 'config', 'cleanup'];
    return validTypes.includes(type) ? type : 'modify';
  }

  private validateComplexity(complexity: any): 'simple' | 'medium' | 'complex' {
    return ['simple', 'medium', 'complex'].includes(complexity) ? complexity : 'medium';
  }

  private optimizeTaskOrder(tasks: SubTask[], context: EnhancementContext): SubTask[] {
    // Sort by priority first, then by dependencies
    const sortedTasks = [...tasks].sort((a, b) => {
      // Handle dependencies first
      if (a.dependencies.includes(b.id)) return 1;
      if (b.dependencies.includes(a.id)) return -1;
      
      // Then by priority
      return a.priority - b.priority;
    });

    // Validate dependency order
    const taskIds = sortedTasks.map(t => t.id);
    for (const task of sortedTasks) {
      for (const depId of task.dependencies) {
        const depIndex = taskIds.indexOf(depId);
        const taskIndex = taskIds.indexOf(task.id);
        
        if (depIndex > taskIndex) {
          this.logger.warn(`Dependency order issue: ${task.id} depends on ${depId} but comes before it`);
        }
      }
    }

    return sortedTasks;
  }

  private validateTasks(tasks: SubTask[], intent: ProcessedIntent, context: EnhancementContext): SubTask[] {
    // Validate that tasks make sense given the context
    const validatedTasks = tasks.filter(task => {
      // Check if files exist in context or are reasonable new files
      const filesExistInContext = task.files.some(file => 
        context.primaryFiles.some(cf => cf.filePath.includes(file)) ||
        context.relatedFiles.some(rf => rf.filePath.includes(file)) ||
        file.includes('test') || // Test files are often new
        file.includes('config') || // Config files are often new
        file.startsWith('src/') // New source files are reasonable
      );

      if (!filesExistInContext && task.type !== 'create' && task.type !== 'test') {
        this.logger.warn(`Task ${task.id} references files not in context: ${task.files.join(', ')}`);
      }

      return task.files.length > 0 && task.description.length > 10;
    });

    // Ensure we have at least one task
    if (validatedTasks.length === 0) {
      this.logger.warn('No valid tasks after validation, creating fallback task');
      return [{
        id: 'fallback_task',
        description: 'Implement requested functionality',
        files: context.primaryFiles.slice(0, 2).map(f => f.filePath),
        dependencies: [],
        estimatedTime: intent.timeEstimate || 30,
        priority: 1,
        type: 'modify',
        context: {
          primaryFiles: context.primaryFiles.slice(0, 2).map(f => f.filePath),
          relatedFiles: context.relatedFiles.slice(0, 3).map(f => f.filePath),
          domainKnowledge: 'Follow existing patterns and conventions'
        }
      }];
    }

    return validatedTasks;
  }

  private generateFallbackTasks(
    request: UserFeatureRequest,
    intent: ProcessedIntent,
    context: EnhancementContext
  ): SubTask[] {
    const mainFiles = context.primaryFiles.slice(0, 3);
    const relatedFiles = context.relatedFiles.slice(0, 5);

    const tasks: SubTask[] = [{
      id: 'main_implementation',
      description: `Implement: ${request.query}`,
      files: mainFiles.map(f => f.filePath),
      dependencies: [],
      estimatedTime: Math.max(20, intent.timeEstimate * 0.7),
      priority: 1,
      type: intent.intention.includes('add') || intent.intention.includes('create') ? 'create' : 'modify',
      context: {
        primaryFiles: mainFiles.map(f => f.filePath),
        relatedFiles: relatedFiles.map(f => f.filePath),
        domainKnowledge: `Domain: ${intent.primaryDomains.join(', ')}`
      }
    }];

    // Add testing task if appropriate
    if (intent.suggestedTools.includes('test_generation') || intent.riskLevel !== 'low') {
      tasks.push({
        id: 'add_tests',
        description: 'Add tests for the implementation',
        files: mainFiles.map(f => f.filePath.replace('.ts', '.test.ts').replace('src/', 'tests/')),
        dependencies: ['main_implementation'],
        estimatedTime: Math.max(15, intent.timeEstimate * 0.3),
        priority: 2,
        type: 'test',
        context: {
          primaryFiles: tasks[0].files,
          relatedFiles: ['tests/helpers/test-utils.ts'],
          domainKnowledge: 'Testing patterns and coverage requirements'
        }
      });
    }

    return tasks;
  }

  private generateFallbackTaskSplit(query: string): TaskSplitResult {
    return {
      subTasks: [{
        id: 'fallback_task',
        description: `Implement: ${query}`,
        files: ['src/main.ts'],
        dependencies: [],
        estimatedTime: 30,
        priority: 1,
        type: 'modify',
        context: {
          primaryFiles: ['src/main.ts'],
          relatedFiles: [],
          domainKnowledge: 'General implementation approach'
        }
      }],
      estimatedDuration: 30,
      complexity: 'simple',
      riskAssessment: 'Standard implementation risk',
      dependencies: {
        external: [],
        internal: []
      }
    };
  }
}

export default TaskSplitter;