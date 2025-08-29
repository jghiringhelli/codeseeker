import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

export class TestDatabase {
  private db: Database.Database;
  
  constructor() {
    // Use in-memory SQLite database for tests
    this.db = new Database(':memory:');
  }

  async initialize() {
    try {
      // Read and execute the three-layer schema
      const schemaPath = join(__dirname, '..', 'database', 'three-layer-complete-schema.sql');
      const schema = readFileSync(schemaPath, 'utf8');
      
      // Split schema by statements and execute
      const statements = schema.split(';').filter(stmt => stmt.trim().length > 0);
      
      for (const statement of statements) {
        if (statement.trim()) {
          this.db.exec(statement);
        }
      }
      
      console.log('Test database initialized successfully');
      return this.db;
    } catch (error) {
      console.error('Failed to initialize test database:', error);
      throw error;
    }
  }

  async cleanup() {
    if (this.db) {
      this.db.close();
    }
  }

  getConnection() {
    return this.db;
  }

  async insertTestData() {
    // Insert sample test data for each layer
    
    // Layer 1 - CLI Projects
    this.db.exec(`
      INSERT INTO cli_projects (id, name, path, created_at) 
      VALUES 
        ('test-project-1', 'Test Project 1', '/test/path1', datetime('now')),
        ('test-project-2', 'Test Project 2', '/test/path2', datetime('now'))
    `);

    // Layer 2 - Orchestration Workflows
    this.db.exec(`
      INSERT INTO orchestration_workflows (id, name, description, status, created_at)
      VALUES
        ('workflow-1', 'Test Workflow', 'A test workflow', 'active', datetime('now'))
    `);

    // Layer 3 - Planning Sessions  
    this.db.exec(`
      INSERT INTO planning_sessions (id, name, goal, status, created_at)
      VALUES
        ('session-1', 'Test Planning Session', 'Test goal', 'active', datetime('now'))
    `);
  }
}

// Global test database instance
export const testDb = new TestDatabase();