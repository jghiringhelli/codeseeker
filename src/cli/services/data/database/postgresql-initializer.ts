/**
 * PostgreSQL Initializer for /init workflow
 * Populates all required tables during project initialization
 */

import { Logger } from '../../../../utils/logger';
import { DatabaseConnections } from '../../../../config/database-config';
import { LanguageSetupResult } from '../../data/semantic-graph/language-detector';
import { EmbeddingService } from '../../data/embedding/embedding-service';
import glob from 'fast-glob';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';

export interface PostgreSQLInitResult {
  embeddings: {
    created: number;
    updated: number;
    errors: number;
  };
  analysisResults: {
    created: number;
    errors: number;
  };
  techStack: {
    detected: boolean;
    languages: string[];
    frameworks: string[];
    dependencies: Record<string, string>;
  };
  progress: {
    phase: string;
    percentage: number;
    resumeToken?: string;
  };
}

export class PostgreSQLInitializer {
  private logger = Logger.getInstance();
  private dbConnections: DatabaseConnections;
  private embeddingService: EmbeddingService;

  constructor() {
    this.dbConnections = new DatabaseConnections();
    // Use TensorFlow.js for high-quality semantic embeddings
    this.embeddingService = new EmbeddingService({
      batchSize: 25, // Slightly smaller batches for TensorFlow processing
      maxTokens: 6000 // Optimal for Universal Sentence Encoder
    });
  }

  /**
   * Complete PostgreSQL initialization for a project
   */
  async initializeProject(
    projectId: string,
    projectPath: string,
    languageSetup: LanguageSetupResult
  ): Promise<PostgreSQLInitResult> {
    
    this.logger.info('📊 Initializing PostgreSQL data for project...');
    
    const result: PostgreSQLInitResult = {
      embeddings: { created: 0, updated: 0, errors: 0 },
      analysisResults: { created: 0, errors: 0 },
      techStack: { detected: false, languages: [], frameworks: [], dependencies: {} },
      progress: { phase: 'starting', percentage: 0 }
    };

    try {
      // Step 1: Initialize progress tracking
      await this.initializeProgressTracking(projectId, result);
      
      // Step 2: Detect and store tech stack
      await this.detectTechStack(projectId, projectPath, languageSetup, result);
      
      // Step 3: Generate semantic embeddings  
      await this.generateSemanticEmbeddings(projectId, projectPath, result);
      
      // Step 4: Run file analysis
      await this.runFileAnalysis(projectId, projectPath, result);
      
      // Step 5: Complete initialization
      await this.completeInitialization(projectId, result);
      
      this.logger.info(`✅ PostgreSQL initialization complete for project ${projectId}`);
      this.logger.info(`📊 Stats: ${result.embeddings.created} embeddings, ${result.analysisResults.created} analyses`);
      
    } catch (error) {
      this.logger.error(`❌ PostgreSQL initialization failed: ${error.message}`);
      await this.markInitializationFailed(projectId, error.message);
      throw error;
    }

    return result;
  }

  /**
   * Initialize progress tracking for resumable processing
   */
  private async initializeProgressTracking(
    projectId: string, 
    result: PostgreSQLInitResult
  ): Promise<void> {
    
    const pgClient = await this.dbConnections.getPostgresConnection();
    
    // Generate unique resume token for this initialization
    const resumeToken = `init_${projectId}_${Date.now()}`;
    
    await pgClient.query(`
      INSERT INTO initialization_progress (
        project_id, phase, resume_token, progress_data, tech_stack_data
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (project_id) DO UPDATE SET
        phase = EXCLUDED.phase,
        resume_token = EXCLUDED.resume_token,
        progress_data = EXCLUDED.progress_data,
        tech_stack_data = EXCLUDED.tech_stack_data,
        updated_at = NOW()
    `, [
      projectId,
      'deep_analysis',
      resumeToken,
      JSON.stringify({ 
        phase: 'initialization',
        percentage: 0,
        step: 'tech_stack_detection',
        startTime: new Date().toISOString() 
      }),
      JSON.stringify({})
    ]);

    result.progress = { phase: 'initialization', percentage: 0, resumeToken };
  }

  /**
   * Detect tech stack and store in database
   */
  private async detectTechStack(
    projectId: string,
    projectPath: string,
    languageSetup: LanguageSetupResult,
    result: PostgreSQLInitResult
  ): Promise<void> {
    
    this.logger.info('🔍 Detecting tech stack...');
    
    const detectedFrameworks = await this.detectFrameworks(projectPath);
    const detectedDependencies = await this.detectDependencies(projectPath);
    
    // Convert language array to JSONB object with percentages
    const languagesObject: Record<string, number> = {};
    for (const langStats of languageSetup.detectedLanguages) {
      languagesObject[langStats.language] = langStats.percentage;
    }
    
    // Convert frameworks array to JSONB object
    const frameworksObject: Record<string, string[]> = {};
    for (const framework of detectedFrameworks) {
      frameworksObject[framework] = []; // Will be populated with files that use this framework
    }

    const pgClient = await this.dbConnections.getPostgresConnection();
    
    // Check if tech stack already exists for this project
    const existingTechStack = await pgClient.query(
      'SELECT id FROM tech_stack_detections WHERE project_id = $1', 
      [projectId]
    );

    if (existingTechStack.rows.length > 0) {
      // Update existing record
      await pgClient.query(`
        UPDATE tech_stack_detections SET
          languages = $2,
          frameworks = $3,
          linters = $4,
          formatters = $5,
          dependencies = $6,
          detection_confidence = $7,
          file_count_analyzed = $8,
          last_scan = NOW()
        WHERE project_id = $1
      `, [
        projectId,
        JSON.stringify(languagesObject),
        JSON.stringify(frameworksObject),
        JSON.stringify(await this.detectLinters(projectPath)),
        JSON.stringify(await this.detectFormatters(projectPath)),
        JSON.stringify(detectedDependencies),
        0.9, // High confidence from language setup
        languageSetup.detectedLanguages.reduce((sum, lang) => sum + lang.fileCount, 0)
      ]);
    } else {
      // Insert new record
      await pgClient.query(`
        INSERT INTO tech_stack_detections (
          project_id, project_path, languages, frameworks, linters, formatters,
          dependencies, detection_confidence, file_count_analyzed
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        projectId,
        projectPath,
        JSON.stringify(languagesObject),
        JSON.stringify(frameworksObject),
        JSON.stringify(await this.detectLinters(projectPath)),
        JSON.stringify(await this.detectFormatters(projectPath)),
        JSON.stringify(detectedDependencies),
        0.9, // High confidence from language setup
        languageSetup.detectedLanguages.reduce((sum, lang) => sum + lang.fileCount, 0)
      ]);
    }

    result.techStack = {
      detected: true,
      languages: languageSetup.selectedLanguages,
      frameworks: detectedFrameworks,
      dependencies: detectedDependencies
    };

    // Update progress
    await this.updateProgress(projectId, 'tech_stack_detection', 25);
    result.progress.percentage = 25;
  }

  /**
   * Generate semantic embeddings for all code files using EmbeddingService
   */
  private async generateSemanticEmbeddings(
    projectId: string,
    projectPath: string,
    result: PostgreSQLInitResult
  ): Promise<void> {
    
    this.logger.info('🔍 Generating semantic embeddings with lightweight local algorithm...');
    
    const codeFiles = await this.discoverCodeFiles(projectPath);
    
    // Use EmbeddingService for efficient batch processing
    const embeddingResult = await this.embeddingService.generateProjectEmbeddings(
      projectId,
      codeFiles
    );

    // Update result with actual numbers from EmbeddingService
    result.embeddings.created = embeddingResult.embeddings;
    result.embeddings.errors = embeddingResult.errors;

    // Update progress
    const adjustedProgress = 75;
    this.updateProgress(projectId, 'semantic_embeddings', adjustedProgress).catch(() => {
      // Ignore progress update errors
    });
    result.progress.percentage = adjustedProgress;

    this.logger.info(`✅ Generated ${result.embeddings.created} semantic embeddings (${embeddingResult.errors} errors)`);
  }

  /**
   * Run file analysis for patterns, dependencies, quality
   */
  private async runFileAnalysis(
    projectId: string,
    projectPath: string,
    result: PostgreSQLInitResult
  ): Promise<void> {
    
    this.logger.info('🔍 Running file analysis...');
    
    const codeFiles = await this.discoverCodeFiles(projectPath);
    const pgClient = await this.dbConnections.getPostgresConnection();
    
    let processed = 0;
    
    for (const filePath of codeFiles) {
      try {
        await this.analyzeFile(projectId, projectPath, filePath, pgClient);
        result.analysisResults.created++;
        processed++;
        
        // Update progress
        if (processed % 5 === 0) {
          const progress = 75 + Math.round((processed / codeFiles.length) * 20);
          await this.updateProgress(projectId, 'file_analysis', progress);
          result.progress.percentage = progress;
        }
        
      } catch (error) {
        this.logger.warn(`Failed to analyze ${filePath}: ${error.message}`);
        result.analysisResults.errors++;
      }
    }

    this.logger.info(`✅ Analyzed ${result.analysisResults.created} files`);
  }

  /**
   * Complete initialization and update progress
   */
  private async completeInitialization(
    projectId: string,
    result: PostgreSQLInitResult
  ): Promise<void> {
    
    const pgClient = await this.dbConnections.getPostgresConnection();
    
    await pgClient.query(`
      UPDATE initialization_progress 
      SET 
        phase = 'completed',
        progress_data = jsonb_set(
          COALESCE(progress_data, '{}'), 
          '{completion_stats}', 
          $2::jsonb
        ),
        tech_stack_data = jsonb_set(
          COALESCE(tech_stack_data, '{}'),
          '{final_stats}',
          $3::jsonb
        ),
        updated_at = NOW()
      WHERE project_id = $1
    `, [
      projectId,
      JSON.stringify({
        phase: 'completed',
        percentage: 100,
        embeddings_created: result.embeddings.created,
        analysis_results: result.analysisResults.created,
        completion_time: new Date().toISOString()
      }),
      JSON.stringify({
        languages: result.techStack.languages,
        frameworks: result.techStack.frameworks,
        dependencies_count: Object.keys(result.techStack.dependencies).length
      })
    ]);

    result.progress = { phase: 'completed', percentage: 100 };
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  private async discoverCodeFiles(projectPath: string): Promise<string[]> {
    return await glob([
      '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx',
      '**/*.py', '**/*.java', '**/*.cpp', '**/*.c',
      '**/*.cs', '**/*.go', '**/*.rs'
    ], {
      cwd: projectPath,
      absolute: true,
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/coverage/**'
      ]
    });
  }


  private async analyzeFile(
    projectId: string,
    projectPath: string,
    filePath: string,
    pgClient: any
  ): Promise<void> {
    
    const content = await fs.readFile(filePath, 'utf-8');
    const relativePath = path.relative(projectPath, filePath);
    const fileHash = createHash('sha256').update(content).digest('hex');
    
    // Basic dependency analysis
    const dependencies = this.extractDependencies(content, relativePath);
    
    // Check if analysis already exists
    const existingAnalysis = await pgClient.query(
      'SELECT id FROM analysis_results WHERE project_id = $1 AND file_path = $2 AND analysis_type = $3',
      [projectId, relativePath, 'dependency']
    );

    if (existingAnalysis.rows.length > 0) {
      // Update existing record
      await pgClient.query(`
        UPDATE analysis_results SET
          file_hash = $4,
          analysis_result = $5,
          confidence_score = $6,
          created_at = NOW()
        WHERE project_id = $1 AND file_path = $2 AND analysis_type = $3
      `, [
        projectId,
        relativePath,
        'dependency',
        fileHash,
        JSON.stringify({
          imports: dependencies.imports,
          exports: dependencies.exports,
          dependencies: dependencies.dependencies
        }),
        0.8
      ]);
    } else {
      // Insert new record
      await pgClient.query(`
        INSERT INTO analysis_results (
          project_id, file_path, file_hash, analysis_type, 
          analysis_result, confidence_score
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        projectId,
        relativePath,
        fileHash,
        'dependency',
        JSON.stringify({
          imports: dependencies.imports,
          exports: dependencies.exports,
          dependencies: dependencies.dependencies
        }),
        0.8
      ]);
    }
  }

  private async detectFrameworks(projectPath: string): Promise<string[]> {
    const frameworks: string[] = [];
    
    try {
      // Check package.json for frameworks
      const packagePath = path.join(projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
      
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      if (deps.react) frameworks.push('React');
      if (deps.vue) frameworks.push('Vue');
      if (deps.angular) frameworks.push('Angular');
      if (deps.express) frameworks.push('Express');
      if (deps.nextjs || deps.next) frameworks.push('Next.js');
      if (deps.typescript) frameworks.push('TypeScript');
      
    } catch (error) {
      // No package.json or parsing error
    }
    
    // TODO: Check for other framework indicators (Python requirements.txt, etc.)
    
    return frameworks;
  }

  private async detectLinters(projectPath: string): Promise<string[]> {
    const linters: string[] = [];

    try {
      // Check package.json for linter dependencies
      const packagePath = path.join(projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
      const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if (allDeps.eslint) linters.push('ESLint');
      if (allDeps.tslint) linters.push('TSLint');
      if (allDeps.jshint) linters.push('JSHint');
      if (allDeps.jslint) linters.push('JSLint');
      if (allDeps.stylelint) linters.push('StyleLint');
      if (allDeps.htmlhint) linters.push('HTMLHint');

    } catch (error) {
      // No package.json
    }

    // Check for config files
    const configFiles = [
      '.eslintrc.json', '.eslintrc.js', '.eslintrc.yml', '.eslintrc.yaml', '.eslintrc',
      'tslint.json', '.jshintrc', '.stylelintrc.json', '.stylelintrc.js'
    ];

    for (const configFile of configFiles) {
      try {
        await fs.access(path.join(projectPath, configFile));
        if (configFile.includes('eslint')) linters.push('ESLint');
        if (configFile.includes('tslint')) linters.push('TSLint');
        if (configFile.includes('jshint')) linters.push('JSHint');
        if (configFile.includes('stylelint')) linters.push('StyleLint');
      } catch (error) {
        // Config file doesn't exist
      }
    }

    // Check for Python linters
    try {
      const requirementsFiles = ['requirements.txt', 'requirements-dev.txt', 'pyproject.toml'];
      for (const reqFile of requirementsFiles) {
        const content = await fs.readFile(path.join(projectPath, reqFile), 'utf-8');
        if (content.includes('flake8')) linters.push('Flake8');
        if (content.includes('pylint')) linters.push('Pylint');
        if (content.includes('mypy')) linters.push('MyPy');
        if (content.includes('black')) linters.push('Black');
      }
    } catch (error) {
      // No Python requirements files
    }

    return [...new Set(linters)];
  }

  private async detectFormatters(projectPath: string): Promise<string[]> {
    const formatters: string[] = [];

    try {
      // Check package.json for formatter dependencies
      const packagePath = path.join(projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
      const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if (allDeps.prettier) formatters.push('Prettier');
      if (allDeps['js-beautify']) formatters.push('JS Beautify');
      if (allDeps['css-beautify']) formatters.push('CSS Beautify');

    } catch (error) {
      // No package.json
    }

    // Check for config files
    const configFiles = [
      '.prettierrc', '.prettierrc.json', '.prettierrc.js', '.prettierrc.yml', '.prettierrc.yaml',
      'prettier.config.js', '.prettierignore'
    ];

    for (const configFile of configFiles) {
      try {
        await fs.access(path.join(projectPath, configFile));
        formatters.push('Prettier');
        break;
      } catch (error) {
        // Config file doesn't exist
      }
    }

    // Check for Python formatters
    try {
      const requirementsFiles = ['requirements.txt', 'requirements-dev.txt', 'pyproject.toml'];
      for (const reqFile of requirementsFiles) {
        const content = await fs.readFile(path.join(projectPath, reqFile), 'utf-8');
        if (content.includes('black')) formatters.push('Black');
        if (content.includes('autopep8')) formatters.push('Autopep8');
        if (content.includes('yapf')) formatters.push('YAPF');
      }
    } catch (error) {
      // No Python requirements files
    }

    // Check for .editorconfig
    try {
      await fs.access(path.join(projectPath, '.editorconfig'));
      formatters.push('EditorConfig');
    } catch (error) {
      // No .editorconfig
    }

    return [...new Set(formatters)];
  }

  private async detectDependencies(projectPath: string): Promise<Record<string, string>> {
    const dependencies: Record<string, string> = {};

    try {
      // Node.js dependencies
      const packagePath = path.join(projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
      Object.assign(dependencies, packageJson.dependencies || {});

    } catch (error) {
      // No package.json
    }

    // Python dependencies
    try {
      const requirementsContent = await fs.readFile(path.join(projectPath, 'requirements.txt'), 'utf-8');
      const pythonDeps = requirementsContent.split('\n')
        .filter(line => line.trim() && !line.startsWith('#'))
        .reduce((deps, line) => {
          const [name, version] = line.split('==');
          if (name) {
            deps[name.trim()] = version ? version.trim() : 'latest';
          }
          return deps;
        }, {} as Record<string, string>);
      Object.assign(dependencies, pythonDeps);
    } catch (error) {
      // No requirements.txt
    }

    return dependencies;
  }


  private extractDependencies(content: string, filePath: string): {
    imports: string[];
    exports: string[];
    dependencies: string[];
  } {
    const lines = content.split('\n');
    const imports: string[] = [];
    const exports: string[] = [];
    const dependencies: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Extract imports
      const importMatch = trimmed.match(/^import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]/);
      if (importMatch) {
        imports.push(importMatch[1]);
        if (importMatch[1].startsWith('./') || importMatch[1].startsWith('../')) {
          dependencies.push(importMatch[1]);
        }
      }
      
      // Extract exports
      if (trimmed.startsWith('export')) {
        const exportMatch = trimmed.match(/export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/);
        if (exportMatch) {
          exports.push(exportMatch[1]);
        }
      }
    }
    
    return { imports, exports, dependencies };
  }

  private async updateProgress(projectId: string, step: string, percentage: number): Promise<void> {
    const pgClient = await this.dbConnections.getPostgresConnection();
    
    await pgClient.query(`
      UPDATE initialization_progress 
      SET 
        progress_data = jsonb_set(
          COALESCE(progress_data, '{}'),
          '{current_step}',
          $2::jsonb
        ) ||
        jsonb_set(
          COALESCE(progress_data, '{}'),
          '{percentage}',
          $3::jsonb
        ),
        updated_at = NOW()
      WHERE project_id = $1
    `, [projectId, JSON.stringify(step), JSON.stringify(percentage)]);
  }

  private async markInitializationFailed(projectId: string, errorMessage: string): Promise<void> {
    try {
      const pgClient = await this.dbConnections.getPostgresConnection();
      
      await pgClient.query(`
        UPDATE initialization_progress 
        SET 
          phase = 'deep_analysis',
          error_log = error_log || $2::jsonb,
          progress_data = jsonb_set(
            COALESCE(progress_data, '{}'),
            '{failed}',
            'true'::jsonb
          ) ||
          jsonb_set(
            COALESCE(progress_data, '{}'),
            '{error_message}',
            $3::jsonb
          ),
          updated_at = NOW()
        WHERE project_id = $1
      `, [
        projectId, 
        JSON.stringify([{
          error: errorMessage,
          timestamp: new Date().toISOString(),
          phase: 'initialization'
        }]),
        JSON.stringify(errorMessage)
      ]);
      
    } catch (error) {
      this.logger.error(`Failed to mark initialization as failed: ${error.message}`);
    }
  }
}