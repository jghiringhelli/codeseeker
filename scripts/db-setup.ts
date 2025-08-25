#!/usr/bin/env tsx
/**
 * Database setup script for CodeMind
 * Creates database, runs migrations, and seeds initial data
 */

import { DatabaseFactory } from '../src/database/factory';
import { Logger, LogLevel } from '../src/utils/logger';
import { PostgreSQLAdapter } from '../src/database/adapters/postgresql';

async function setupDatabase() {
  const logger = new Logger(LogLevel.INFO, 'DB-Setup');
  
  try {
    logger.info('🚀 Starting database setup...');

    // Parse configuration from environment
    const config = DatabaseFactory.parseConfigFromEnv();
    logger.info(`Database type: ${config.type}`);

    logger.info(`Connecting to PostgreSQL at ${config.host || 'via connection string'}`);

    // Create database adapter
    const db = DatabaseFactory.create(config, logger);

    // Initialize and migrate
    logger.info('📊 Initializing database connection...');
    await db.initialize();

    logger.info('🔄 Running migrations...');
    await db.migrate();

    // Seed initial data
    logger.info('🌱 Seeding initial data...');
    await seedInitialData(db as PostgreSQLAdapter);

    // Verify setup
    logger.info('✅ Verifying database health...');
    const isHealthy = await db.isHealthy();
    if (!isHealthy) {
      throw new Error('Database health check failed');
    }

    const stats = await db.getDatabaseStats();
    logger.info('📈 Database statistics:', stats);

    await db.close();
    logger.info('🎉 Database setup completed successfully!');

  } catch (error) {
    logger.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

async function seedInitialData(db: PostgreSQLAdapter) {
  // Create a sample project for testing
  const sampleProject = await db.createProject({
    projectPath: '/workspace/sample-project',
    projectName: 'Sample Project',
    projectType: 'web_application' as any,
    languages: ['TypeScript', 'JavaScript'],
    frameworks: ['React', 'Node.js'],
    projectSize: 'medium' as any,
    domain: 'web-development',
    totalFiles: 150,
    totalLines: 15000,
    status: 'active',
    metadata: {
      description: 'Sample project for testing CodeMind functionality',
      created_by: 'system',
      tags: ['sample', 'test']
    }
  });

  console.log('✅ Created sample project:', sampleProject.id);

  // Add some sample patterns
  await db.saveDetectedPattern({
    projectPath: '/workspace/sample-project',
    patternType: 'architecture' as any,
    patternName: 'Clean Architecture',
    confidence: 0.85,
    evidence: [
      {
        type: 'DIRECTORY_STRUCTURE' as any,
        location: { filePath: '/src', lineNumber: 0, columnNumber: 0 },
        description: 'Clean separation of concerns in directory structure',
        confidence: 0.9
      }
    ]
  });

  await db.saveDetectedPattern({
    projectPath: '/workspace/sample-project',
    patternType: 'design_pattern' as any,
    patternName: 'Repository Pattern',
    confidence: 0.78,
    evidence: [
      {
        type: 'CODE_PATTERN' as any,
        location: { filePath: '/src/repositories', lineNumber: 0, columnNumber: 0 },
        description: 'Repository interfaces and implementations found',
        confidence: 0.8
      }
    ]
  });

  console.log('✅ Added sample patterns');

  // Add sample questionnaire responses
  await db.saveQuestionnaireResponse({
    projectPath: '/workspace/sample-project',
    category: 'architecture' as any,
    questionId: 'preferred_architecture',
    response: 'clean_architecture',
    metadata: {
      question: 'What architectural pattern do you prefer?',
      options: ['clean_architecture', 'mvc', 'mvvm', 'hexagonal']
    }
  });

  console.log('✅ Added sample questionnaire responses');
}

// Command line interface
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'setup':
    case undefined:
      await setupDatabase();
      break;
    
    case 'verify':
      await verifyDatabase();
      break;
      
    case 'reset':
      console.log('⚠️  Database reset not implemented yet. Use teardown + setup.');
      break;
      
    default:
      console.log(`
CodeMind Database Setup

Usage: tsx scripts/db-setup.ts [command]

Commands:
  setup   - Initialize database, run migrations, seed data (default)
  verify  - Check database health and show statistics
  reset   - Reset database (not implemented)

Environment Variables:
  DATABASE_URL      - PostgreSQL connection string
  DB_HOST           - PostgreSQL host (default: localhost)
  DB_PORT           - PostgreSQL port (default: 5432)
  DB_NAME           - Database name (default: codemind)
  DB_USER           - Database user (default: codemind)
  DB_PASSWORD       - Database password (default: codemind123)
      `);
      break;
  }
}

async function verifyDatabase() {
  const logger = new Logger(LogLevel.INFO, 'DB-Verify');
  
  try {
    logger.info('🔍 Verifying database...');
    
    const config = DatabaseFactory.parseConfigFromEnv();
    const db = DatabaseFactory.create(config, logger);
    
    await db.initialize();
    
    const isHealthy = await db.isHealthy();
    logger.info(`Health status: ${isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    
    const stats = await db.getDatabaseStats();
    logger.info('📊 Database Statistics:');
    Object.entries(stats).forEach(([key, value]) => {
      logger.info(`  ${key}: ${value}`);
    });
    
    const pgDb = db as PostgreSQLAdapter;
    const projects = await pgDb.listProjects('active', 5);
    logger.info(`📁 Active projects: ${projects.length}`);
    
    projects.forEach((project, index) => {
      logger.info(`  ${index + 1}. ${project.projectName} (${project.projectPath})`);
    });
    
    await db.close();
    logger.info('✅ Database verification completed');
    
  } catch (error) {
    logger.error('❌ Database verification failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}