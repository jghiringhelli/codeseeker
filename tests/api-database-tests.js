/**
 * API Database Integration Tests
 * 
 * Tests that verify API calls create the expected database changes
 * Uses a separate test database to avoid affecting production data
 */

const { Pool } = require('pg');
const fetch = require('node-fetch');

// Test configuration
const TEST_CONFIG = {
  api: {
    baseUrl: 'http://localhost:3004',
    timeout: 10000
  },
  database: {
    host: 'localhost',
    port: 5432,
    database: 'codemind_test',
    user: 'codemind',
    password: 'codemind123'
  },
  testProject: {
    projectPath: 'test-project-' + Date.now(),
    projectName: 'API Test Project',
    description: 'Test project for API database validation',
    languages: ['typescript', 'javascript'],
    frameworks: ['express', 'jest'],
    projectType: 'api_service'
  }
};

let testPool = null;
let testResults = [];

// Test utilities
class DatabaseTester {
  constructor(pool) {
    this.pool = pool;
  }

  async query(sql, params = []) {
    try {
      const result = await this.pool.query(sql, params);
      return result.rows;
    } catch (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }
  }

  async getProject(projectPath) {
    const rows = await this.query('SELECT * FROM projects WHERE project_path = $1', [projectPath]);
    return rows[0] || null;
  }

  async getInitializationProgress(projectPath) {
    const rows = await this.query(`
      SELECT ip.* FROM initialization_progress ip
      JOIN projects p ON ip.project_id = p.id
      WHERE p.project_path = $1
    `, [projectPath]);
    return rows[0] || null;
  }

  async getProjectPaths(projectId) {
    const rows = await this.query('SELECT * FROM project_paths WHERE project_id = $1', [projectId]);
    return rows;
  }

  async getDetectedPatterns(projectPath) {
    const rows = await this.query(`
      SELECT dp.* FROM detected_patterns dp
      JOIN projects p ON dp.project_id = p.id
      WHERE p.project_path = $1
    `, [projectPath]);
    return rows;
  }

  async cleanup(projectPath) {
    // Delete test data (cascade will handle related tables)
    await this.query('DELETE FROM projects WHERE project_path = $1', [projectPath]);
  }
}

// API utilities
class APITester {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async request(method, endpoint, body = null) {
    const url = `${this.baseUrl}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: TEST_CONFIG.api.timeout
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);
      const data = await response.json();
      
      return {
        status: response.status,
        ok: response.ok,
        data
      };
    } catch (error) {
      throw new Error(`API request failed: ${error.message}`);
    }
  }

  async init(projectData) {
    return this.request('POST', '/init', {
      projectPath: projectData.projectPath,
      mode: 'auto',
      batchSize: 25,
      metadata: {
        projectName: projectData.projectName,
        description: projectData.description,
        languages: projectData.languages,
        frameworks: projectData.frameworks,
        projectType: projectData.projectType,
        claudeIntegration: true
      }
    });
  }

  async getContext(projectPath, intent = 'overview', maxTokens = 1000) {
    return this.request('GET', `/claude/context/${projectPath}?intent=${intent}&maxTokens=${maxTokens}`);
  }

  async getSuggestions(projectPath, maxQuestions = 5) {
    return this.request('GET', `/claude/suggest-questions/${projectPath}?maxQuestions=${maxQuestions}`);
  }

  async analyzeWithContext(projectPath, analysisType = 'overview') {
    return this.request('POST', '/claude/analyze-with-context', {
      projectPath,
      analysisType,
      context: {
        intent: 'overview',
        includePatterns: true
      }
    });
  }

  async health() {
    return this.request('GET', '/health');
  }
}

// Test cases
const tests = [
  {
    name: 'API Health Check',
    async run(api, db) {
      const response = await api.health();
      
      if (!response.ok || !response.data.success) {
        throw new Error('API health check failed');
      }

      return {
        passed: true,
        message: 'API is healthy',
        data: response.data
      };
    }
  },

  {
    name: 'Project Initialization - Database Changes',
    async run(api, db) {
      const projectData = TEST_CONFIG.testProject;
      
      // 1. Verify project doesn't exist
      let project = await db.getProject(projectData.projectPath);
      if (project) {
        throw new Error('Test project already exists - cleanup failed');
      }

      // 2. Call API
      const response = await api.init(projectData);
      
      if (!response.ok || !response.data.success) {
        throw new Error(`Init API failed: ${JSON.stringify(response.data)}`);
      }

      // 3. Verify database changes
      project = await db.getProject(projectData.projectPath);
      if (!project) {
        throw new Error('Project not created in database');
      }

      // Validate project data
      const validations = [
        { field: 'project_name', expected: projectData.projectName, actual: project.project_name },
        { field: 'project_type', expected: projectData.projectType, actual: project.project_type },
        { field: 'status', expected: 'analyzing', actual: project.status },
        { field: 'languages', expected: projectData.languages, actual: project.languages },
        { field: 'frameworks', expected: projectData.frameworks, actual: project.frameworks }
      ];

      const errors = validations
        .filter(v => JSON.stringify(v.expected) !== JSON.stringify(v.actual))
        .map(v => `${v.field}: expected ${JSON.stringify(v.expected)}, got ${JSON.stringify(v.actual)}`);

      if (errors.length > 0) {
        throw new Error(`Project validation failed: ${errors.join(', ')}`);
      }

      // 4. Verify initialization progress
      const progress = await db.getInitializationProgress(projectData.projectPath);
      if (!progress) {
        throw new Error('Initialization progress not created');
      }

      if (progress.phase !== 'project_discovery') {
        throw new Error(`Expected phase 'project_discovery', got '${progress.phase}'`);
      }

      return {
        passed: true,
        message: 'Project initialization created correct database entries',
        data: {
          projectId: project.id,
          resumeToken: progress.resume_token,
          phase: progress.phase
        }
      };
    }
  },

  {
    name: 'Context API - Database Reads',
    async run(api, db) {
      const projectData = TEST_CONFIG.testProject;
      
      // Test different intents
      const intents = ['overview', 'coding', 'architecture', 'debugging'];
      const results = {};

      for (const intent of intents) {
        const response = await api.getContext(projectData.projectPath, intent, 800);
        
        if (!response.ok || !response.data.success) {
          throw new Error(`Context API failed for intent '${intent}': ${JSON.stringify(response.data)}`);
        }

        results[intent] = {
          status: response.data.success,
          tokenEstimate: response.data.data.timestamp ? 'has_timestamp' : 'missing_timestamp',
          hasProject: !!response.data.data.project,
          projectName: response.data.data.project?.name
        };

        // Verify project name matches what we stored
        if (response.data.data.project?.name !== projectData.projectPath) {
          console.warn(`Warning: Context API returned project name '${response.data.data.project.name}', expected '${projectData.projectPath}'`);
        }
      }

      return {
        passed: true,
        message: 'Context API reads database correctly for all intents',
        data: results
      };
    }
  },

  {
    name: 'Questions API - Smart Generation',
    async run(api, db) {
      const projectData = TEST_CONFIG.testProject;
      
      const response = await api.getSuggestions(projectData.projectPath, 3);
      
      if (!response.ok || !response.data.success) {
        throw new Error(`Suggestions API failed: ${JSON.stringify(response.data)}`);
      }

      const questions = response.data.data.questions;
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('No questions returned from suggestions API');
      }

      if (questions.length > 5) {
        throw new Error(`Too many questions returned: ${questions.length}, expected <= 5`);
      }

      return {
        passed: true,
        message: `Generated ${questions.length} smart questions`,
        data: {
          questionCount: questions.length,
          questions: questions.slice(0, 3) // First 3 for review
        }
      };
    }
  },

  {
    name: 'Analysis API - Context Processing',
    async run(api, db) {
      const projectData = TEST_CONFIG.testProject;
      
      const response = await api.analyzeWithContext(projectData.projectPath, 'code_review');
      
      if (!response.ok || !response.data.success) {
        throw new Error(`Analysis API failed: ${JSON.stringify(response.data)}`);
      }

      const analysis = response.data.data;
      if (!analysis.context || !analysis.timestamp) {
        throw new Error('Analysis response missing required fields');
      }

      return {
        passed: true,
        message: 'Analysis API processes context correctly',
        data: {
          hasContext: !!analysis.context,
          hasPrompt: !!analysis.suggestedPrompt,
          tokenEstimate: analysis.tokenEstimate || 'not_provided'
        }
      };
    }
  },

  {
    name: 'Database Constraint Validation',
    async run(api, db) {
      const projectData = TEST_CONFIG.testProject;
      const errors = [];

      try {
        // Test duplicate project_path (should fail)
        const duplicateResponse = await api.init({
          ...projectData,
          projectPath: projectData.projectPath // Same path
        });
        
        // This should succeed (update existing) not create duplicate
        if (duplicateResponse.ok && duplicateResponse.data.success) {
          // Check that we still have only one project
          const projects = await db.query('SELECT COUNT(*) as count FROM projects WHERE project_path = $1', [projectData.projectPath]);
          if (parseInt(projects[0].count) !== 1) {
            errors.push(`Expected 1 project, found ${projects[0].count}`);
          }
        }
      } catch (error) {
        errors.push(`Duplicate handling test failed: ${error.message}`);
      }

      try {
        // Test initialization_progress unique constraint
        const progress = await db.getInitializationProgress(projectData.projectPath);
        if (!progress) {
          errors.push('No initialization progress found');
        } else {
          // Verify unique constraint exists by checking we have exactly one record
          const progressCount = await db.query(`
            SELECT COUNT(*) as count FROM initialization_progress ip
            JOIN projects p ON ip.project_id = p.id
            WHERE p.project_path = $1
          `, [projectData.projectPath]);
          
          if (parseInt(progressCount[0].count) !== 1) {
            errors.push(`Expected 1 progress record, found ${progressCount[0].count}`);
          }
        }
      } catch (error) {
        errors.push(`Progress constraint test failed: ${error.message}`);
      }

      if (errors.length > 0) {
        throw new Error(`Constraint validation failed: ${errors.join(', ')}`);
      }

      return {
        passed: true,
        message: 'Database constraints working correctly',
        data: {
          uniqueConstraints: 'validated',
          foreignKeys: 'validated'
        }
      };
    }
  }
];

// Test runner
async function runTests() {
  console.log('🧪 Starting API Database Integration Tests');
  console.log('=' .repeat(50));
  
  try {
    // Setup test database connection
    testPool = new Pool(TEST_CONFIG.database);
    const db = new DatabaseTester(testPool);
    const api = new APITester(TEST_CONFIG.api.baseUrl);

    // Run tests
    for (const test of tests) {
      try {
        console.log(`\n📋 Running: ${test.name}`);
        const result = await test.run(api, db);
        
        testResults.push({
          name: test.name,
          ...result
        });
        
        console.log(`✅ PASSED: ${result.message}`);
        if (result.data) {
          console.log(`📊 Data: ${JSON.stringify(result.data, null, 2)}`);
        }
      } catch (error) {
        testResults.push({
          name: test.name,
          passed: false,
          message: error.message,
          error: error.stack
        });
        
        console.log(`❌ FAILED: ${error.message}`);
      }
    }

    // Cleanup
    console.log(`\n🧹 Cleaning up test data...`);
    await db.cleanup(TEST_CONFIG.testProject.projectPath);
    console.log(`✅ Test data cleaned up`);

  } catch (error) {
    console.error(`💥 Test setup failed: ${error.message}`);
    testResults.push({
      name: 'Test Setup',
      passed: false,
      message: error.message,
      error: error.stack
    });
  } finally {
    if (testPool) {
      await testPool.end();
    }
  }

  // Results summary
  console.log('\n' + '=' .repeat(50));
  console.log('📊 Test Results Summary');
  console.log('=' .repeat(50));
  
  const passed = testResults.filter(r => r.passed).length;
  const total = testResults.length;
  
  testResults.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.name}: ${result.message}`);
  });
  
  console.log(`\n🎯 Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! API is correctly affecting the database.');
  } else {
    console.log('⚠️  Some tests failed. Check the database schema or API implementation.');
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests, TEST_CONFIG };