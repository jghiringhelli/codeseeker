// MongoDB Initialization Script for CodeMind
// Creates database, collections, indexes, and initial data

// Switch to the codemind database
db = db.getSiblingDB('codemind');

// Create collections with validation schemas
print('Creating MongoDB collections...');

// 1. Tool Configurations Collection
db.createCollection('tool_configs', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['projectId', 'toolName', 'config', 'updatedAt'],
      properties: {
        projectId: {
          bsonType: 'string',
          description: 'Project UUID'
        },
        toolName: {
          bsonType: 'string',
          description: 'Tool identifier'
        },
        config: {
          bsonType: 'object',
          description: 'Tool configuration object'
        },
        version: {
          bsonType: 'string',
          description: 'Configuration version'
        },
        updatedAt: {
          bsonType: 'date',
          description: 'Last update timestamp'
        }
      }
    }
  }
});

// 2. Analysis Results Collection
db.createCollection('analysis_results', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['projectId', 'toolName', 'timestamp', 'analysis'],
      properties: {
        projectId: {
          bsonType: 'string',
          description: 'Project UUID'
        },
        toolName: {
          bsonType: 'string',
          description: 'Tool that generated the analysis'
        },
        timestamp: {
          bsonType: 'date',
          description: 'Analysis timestamp'
        },
        analysis: {
          bsonType: 'object',
          description: 'Analysis data'
        },
        summary: {
          bsonType: 'string',
          description: 'Analysis summary for search'
        },
        fileCount: {
          bsonType: 'int',
          description: 'Number of files analyzed'
        },
        hasIssues: {
          bsonType: 'bool',
          description: 'Whether issues were found'
        },
        tags: {
          bsonType: 'array',
          description: 'Searchable tags'
        }
      }
    }
  }
});

// 3. Project Intelligence Collection
db.createCollection('project_intelligence', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['projectId', 'context', 'lastUpdated'],
      properties: {
        projectId: {
          bsonType: 'string',
          description: 'Project UUID'
        },
        context: {
          bsonType: 'object',
          required: ['languages', 'frameworks', 'projectType'],
          properties: {
            languages: {
              bsonType: 'array',
              description: 'Programming languages used'
            },
            frameworks: {
              bsonType: 'array',
              description: 'Frameworks detected'
            },
            projectType: {
              bsonType: 'string',
              description: 'Type of project'
            },
            fileStructure: {
              bsonType: 'object',
              description: 'Project file structure'
            },
            patterns: {
              bsonType: 'object',
              description: 'Detected patterns'
            },
            complexity: {
              enum: ['low', 'medium', 'high'],
              description: 'Project complexity'
            },
            recommendedTools: {
              bsonType: 'array',
              description: 'Recommended tools for this project'
            }
          }
        },
        lastUpdated: {
          bsonType: 'date',
          description: 'Last update timestamp'
        },
        version: {
          bsonType: 'int',
          description: 'Context version'
        }
      }
    }
  }
});

// 4. Knowledge Repository Collection
db.createCollection('knowledge_repository', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['projectId', 'type', 'title', 'content', 'createdAt'],
      properties: {
        projectId: {
          bsonType: 'string',
          description: 'Project UUID'
        },
        type: {
          enum: ['readme', 'documentation', 'comment', 'guide', 'api', 'tutorial'],
          description: 'Document type'
        },
        title: {
          bsonType: 'string',
          description: 'Document title'
        },
        content: {
          bsonType: 'string',
          description: 'Document content'
        },
        metadata: {
          bsonType: 'object',
          description: 'Additional metadata'
        },
        searchableText: {
          bsonType: 'string',
          description: 'Plain text for full-text search'
        },
        relatedFiles: {
          bsonType: 'array',
          description: 'Related file paths'
        },
        tags: {
          bsonType: 'array',
          description: 'Document tags'
        },
        createdAt: {
          bsonType: 'date',
          description: 'Creation timestamp'
        },
        updatedAt: {
          bsonType: 'date',
          description: 'Last update timestamp'
        }
      }
    }
  }
});

// 5. Workflow States Collection (for complex workflow tracking)
db.createCollection('workflow_states', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['workflowId', 'projectId', 'status', 'currentStep'],
      properties: {
        workflowId: {
          bsonType: 'string',
          description: 'Workflow execution ID'
        },
        projectId: {
          bsonType: 'string',
          description: 'Project UUID'
        },
        status: {
          enum: ['pending', 'running', 'completed', 'failed', 'paused'],
          description: 'Workflow status'
        },
        currentStep: {
          bsonType: 'int',
          description: 'Current step number'
        },
        steps: {
          bsonType: 'array',
          description: 'Workflow steps with status and output'
        },
        dynamicContext: {
          bsonType: 'object',
          description: 'Dynamic workflow context'
        },
        startTime: {
          bsonType: 'date',
          description: 'Workflow start time'
        },
        endTime: {
          bsonType: 'date',
          description: 'Workflow end time'
        }
      }
    }
  }
});

// 6. Templates Collection (for code generation)
db.createCollection('templates', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'category', 'template'],
      properties: {
        name: {
          bsonType: 'string',
          description: 'Template name'
        },
        category: {
          bsonType: 'string',
          description: 'Template category'
        },
        framework: {
          bsonType: 'string',
          description: 'Target framework'
        },
        language: {
          bsonType: 'string',
          description: 'Programming language'
        },
        template: {
          bsonType: 'object',
          description: 'Template definition'
        },
        variables: {
          bsonType: 'array',
          description: 'Template variables'
        },
        tags: {
          bsonType: 'array',
          description: 'Template tags'
        }
      }
    }
  }
});

print('Collections created successfully');

// Create indexes for optimal query performance
print('Creating indexes...');

// Tool Configs indexes
db.tool_configs.createIndex({ projectId: 1, toolName: 1 }, { unique: true });
db.tool_configs.createIndex({ 'config.frameworks': 1 });
db.tool_configs.createIndex({ updatedAt: -1 });

// Analysis Results indexes
db.analysis_results.createIndex({ projectId: 1, toolName: 1, timestamp: -1 });
db.analysis_results.createIndex({ projectId: 1, hasIssues: 1 });
db.analysis_results.createIndex({ tags: 1 });
db.analysis_results.createIndex({ summary: 'text' }); // Full-text search

// Project Intelligence indexes
db.project_intelligence.createIndex({ projectId: 1 }, { unique: true });
db.project_intelligence.createIndex({ 'context.languages': 1 });
db.project_intelligence.createIndex({ 'context.frameworks': 1 });
db.project_intelligence.createIndex({ 'context.projectType': 1 });
db.project_intelligence.createIndex({ 'context.complexity': 1 });

// Knowledge Repository indexes
db.knowledge_repository.createIndex({ projectId: 1, type: 1 });
db.knowledge_repository.createIndex({ tags: 1 });
db.knowledge_repository.createIndex({ relatedFiles: 1 });
db.knowledge_repository.createIndex({ 
  title: 'text', 
  content: 'text', 
  searchableText: 'text' 
}, { 
  weights: { 
    title: 10, 
    searchableText: 5, 
    content: 1 
  } 
});

// Workflow States indexes
db.workflow_states.createIndex({ workflowId: 1 }, { unique: true });
db.workflow_states.createIndex({ projectId: 1, status: 1 });
db.workflow_states.createIndex({ startTime: -1 });

// Templates indexes
db.templates.createIndex({ name: 1, category: 1 }, { unique: true });
db.templates.createIndex({ framework: 1, language: 1 });
db.templates.createIndex({ tags: 1 });

print('Indexes created successfully');

// Create TTL indexes for automatic cleanup
print('Creating TTL indexes for data retention...');

// Remove analysis results older than 90 days
db.analysis_results.createIndex(
  { timestamp: 1 },
  { expireAfterSeconds: 7776000 } // 90 days
);

// Remove completed workflows older than 30 days
db.workflow_states.createIndex(
  { endTime: 1 },
  { 
    expireAfterSeconds: 2592000, // 30 days
    partialFilterExpression: { status: 'completed' }
  }
);

print('TTL indexes created successfully');

// Insert foundation data (tool configuration templates)
print('Inserting foundation data...');

// Default tool configuration templates
db.tool_configs.insertMany([
  {
    projectId: 'default',
    toolName: 'semantic-search',
    config: {
      embeddingModel: 'text-embedding-ada-002',
      chunkSize: 4000,
      overlapSize: 200,
      similarity: 'cosine',
      cacheEnabled: true,
      batchSize: 10
    },
    version: '1.0.0',
    updatedAt: new Date()
  },
  {
    projectId: 'default',
    toolName: 'solid-principles',
    config: {
      checkSRP: true,
      checkOCP: true,
      checkLSP: true,
      checkISP: true,
      checkDIP: true,
      severityThreshold: 'medium',
      maxClassComplexity: 10,
      maxMethodLength: 50
    },
    version: '1.0.0',
    updatedAt: new Date()
  },
  {
    projectId: 'default',
    toolName: 'compilation-verifier',
    config: {
      typescript: {
        strict: true,
        noImplicitAny: true,
        strictNullChecks: true
      },
      javascript: {
        useESLint: true,
        ecmaVersion: 2022
      },
      timeout: 30000
    },
    version: '1.0.0',
    updatedAt: new Date()
  }
]);

// Insert template configurations for common project types
db.project_intelligence.insertMany([
  {
    projectId: 'template-react',
    context: {
      languages: ['typescript', 'javascript'],
      frameworks: ['react'],
      projectType: 'web_application',
      fileStructure: {
        entryPoints: ['src/index.tsx', 'src/App.tsx'],
        configFiles: ['package.json', 'tsconfig.json', 'webpack.config.js'],
        testDirectories: ['src/__tests__', 'src/**/*.test.tsx']
      },
      patterns: {
        architectural: ['Component-Based', 'Flux/Redux'],
        design: ['Observer', 'Factory', 'Singleton']
      },
      complexity: 'medium',
      recommendedTools: [
        'semantic-search',
        'solid-principles',
        'compilation-verifier',
        'ui-navigation',
        'tree-navigation'
      ]
    },
    lastUpdated: new Date(),
    version: 1
  },
  {
    projectId: 'template-nodejs',
    context: {
      languages: ['javascript', 'typescript'],
      frameworks: ['express', 'nodejs'],
      projectType: 'api_service',
      fileStructure: {
        entryPoints: ['src/index.js', 'app.js', 'server.js'],
        configFiles: ['package.json', 'tsconfig.json', '.env'],
        testDirectories: ['test', 'tests', '__tests__']
      },
      patterns: {
        architectural: ['MVC', 'REST', 'Microservices'],
        design: ['Repository', 'Factory', 'Dependency Injection']
      },
      complexity: 'medium',
      recommendedTools: [
        'semantic-search',
        'solid-principles',
        'compilation-verifier',
        'use-cases'
      ]
    },
    lastUpdated: new Date(),
    version: 1
  }
]);

print('Foundation data inserted successfully');

// Create a user for application access (if not in Docker)
try {
  db.createUser({
    user: 'codemind_app',
    pwd: 'codemind123',
    roles: [
      { role: 'readWrite', db: 'codemind' }
    ]
  });
  print('Application user created');
} catch (e) {
  print('User already exists or running in Docker environment');
}

print('MongoDB initialization completed successfully!');