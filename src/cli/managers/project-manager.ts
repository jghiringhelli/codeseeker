/**
 * ProjectManager - Handles all project-related operations
 * Single Responsibility: Project initialization, detection, configuration
 */

import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseConnections } from '../../config/database-config';
import { Theme } from '../ui/theme';
import SemanticSearchManager from '../../shared/semantic-search-manager';

export interface ProjectConfig {
  projectId: string;
  projectName: string;
  projectPath: string;
  projectType?: string;
  languages: string[];
  primaryLanguage?: string;
  installedParsers?: string[];
  frameworks?: string[];
  features?: string[];
  createdAt: string;
  lastUpdated?: string;
}

export interface ProjectInitOptions {
  projectName: string;
  projectType: string;
  features: string[];
  resumeToken?: string;
}

export interface LanguageSetupResult {
  detectedLanguages: string[];
  selectedLanguages: string[];
  installedPackages: string[];
  errors: string[];
}

export class ProjectManager {
  private dbConnections: DatabaseConnections;
  private currentProjectPath: string;

  constructor() {
    this.dbConnections = new DatabaseConnections();
    // Use user's original working directory (set by bin/codemind.js)
    this.currentProjectPath = process.env.CODEMIND_USER_CWD || process.cwd();
  }

  /**
   * Set the current project path
   */
  setProjectPath(projectPath: string): void {
    this.currentProjectPath = path.resolve(projectPath);
  }

  /**
   * Detect if current directory is a CodeMind project
   */
  detectProject(projectPath: string): ProjectConfig | null {
    const configPath = path.join(projectPath, '.codemind', 'project.json');
    
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return config as ProjectConfig;
      } catch (error) {
        console.warn(`Warning: Invalid project configuration: ${error.message}`);
      }
    }
    
    return null;
  }

  /**
   * Initialize a new CodeMind project with full AI analysis
   */
  async initializeProject(
    projectPath: string,
    options: ProjectInitOptions,
    syncMode: boolean = false
  ): Promise<{ success: boolean; config?: ProjectConfig; error?: string }> {
    if (syncMode) {
      console.log(Theme.colors.info(`\n🔄 Syncing CodeMind project data...`));
      console.log(Theme.colors.muted(`Path: ${projectPath}`));
      console.log(Theme.colors.muted(`Name: ${options.projectName}`));
    } else {
      console.log(Theme.colors.info(`\n📝 Initializing CodeMind project...`));
      console.log(Theme.colors.muted(`Path: ${projectPath}`));
      console.log(Theme.colors.muted(`Name: ${options.projectName}`));
    }

    try {
      // Step 1: Check infrastructure
      await this.verifyInfrastructure();

      // Step 2: Language Detection and Setup
      console.log('🌐 Detecting project languages and setup...');
      const languageSetup = await this.detectLanguagesAndSetup(projectPath);

      // Step 3: Complete project analysis
      console.log('🤖 Running complete project analysis...');
      const analysis = await this.performCompleteAnalysis(projectPath);

      // Step 4: Register in databases  
      const projectId = await this.registerInDatabases(projectPath, options, analysis, languageSetup);

      // Step 5: Populate databases with analysis data
      console.log('📊 Populating databases with analysis data...');
      const initResult = await this.populateDatabases(projectPath, projectId, analysis, languageSetup);

      // Step 6: Create local configuration
      const config = await this.createLocalConfig(projectPath, projectId, options, analysis, languageSetup);

      if (syncMode) {
        console.log(Theme.colors.success('\n✅ Project synchronization complete!'));
      } else {
        console.log(Theme.colors.success('\n✅ Enhanced project initialization complete!'));
      }
      console.log(Theme.colors.info(`📊 Architecture: ${analysis.architecture.type}`));
      console.log(Theme.colors.info(`🔗 Files discovered: ${analysis.dependencies.files.length}`));
      console.log(Theme.colors.info(`📋 Use Cases: ${analysis.useCases.length} identified`));
      console.log(Theme.colors.info(`🌐 Languages: ${languageSetup.selectedLanguages.join(', ')}`));
      console.log(Theme.colors.info(`📦 Parsers: ${languageSetup.installedPackages.length} installed`));

      // Enhanced analysis results
      if (analysis.processingStats) {
        console.log(Theme.colors.info(`🌳 Semantic entities: ${analysis.processingStats.semanticEntities}`));
        console.log(Theme.colors.info(`🔗 Semantic relationships: ${analysis.processingStats.semanticRelationships}`));
        console.log(Theme.colors.info(`📄 Content chunks: ${analysis.processingStats.contentChunks}`));
        console.log(Theme.colors.info(`🔍 Vector embeddings: ${analysis.processingStats.vectorEmbeddings}`));
        console.log(Theme.colors.info(`⏱️ Processing time: ${(analysis.processingStats.processingTime / 1000).toFixed(2)}s`));
      }

      // Database storage results
      console.log(Theme.colors.info(`🗄️ PostgreSQL: ${initResult.analysisResults.created} analyses, ${initResult.semanticEntities?.created || 0} entities, ${initResult.vectorEmbeddings?.created || 0} embeddings`));
      console.log(Theme.colors.info(`🔧 Tech Stack: ${initResult.techStack.languages.length} languages, ${initResult.techStack.frameworks.length} frameworks`));

      return { success: true, config };

    } catch (error) {
      console.error(Theme.colors.error(`❌ Project initialization failed: ${error.message}`));
      return { success: false, error: error.message };
    }
  }

  /**
   * Switch between projects
   */
  async switchProject(targetPath: string): Promise<ProjectConfig | null> {
    const config = this.detectProject(targetPath);
    
    if (config) {
      // Verify project still exists in database
      const exists = await this.verifyProjectInDatabase(config.projectId);
      if (!exists) {
        console.warn('⚠️  Project not found in database, may need re-initialization');
      }
    }
    
    return config;
  }

  /**
   * Get project information and statistics
   */
  async getProjectInfo(projectId: string): Promise<any> {
    try {
      const pgClient = await this.dbConnections.getPostgresConnection();
      
      const query = `
        SELECT 
          project_name,
          project_type,
          languages,
          frameworks,
          total_files,
          created_at,
          updated_at,
          metadata
        FROM projects 
        WHERE id = $1;
      `;
      
      const result = await pgClient.query(query, [projectId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      const project = result.rows[0];
      
      // Get additional statistics
      const statsQuery = `
        SELECT 
          COUNT(*) as embedding_count
        FROM semantic_search_embeddings 
        WHERE project_path = (SELECT project_path FROM projects WHERE id = $1);
      `;
      
      const stats = await pgClient.query(statsQuery, [projectId]);
      
      return {
        ...project,
        statistics: {
          embeddings: parseInt(stats.rows[0]?.embedding_count || '0'),
          lastAnalyzed: project.updated_at
        }
      };
      
    } catch (error) {
      console.error(`Failed to get project info: ${error.message}`);
      return null;
    }
  }

  // Private helper methods

  private async verifyInfrastructure(): Promise<void> {
    const dbConnections = new DatabaseConnections();
    
    try {
      const pgClient = await dbConnections.getPostgresConnection();
      await pgClient.query('SELECT 1');
    } catch (error) {
      throw new Error('PostgreSQL database not available. Run "/setup" first.');
    } finally {
      await dbConnections.closeAll();
    }
  }


  private async verifyProjectInDatabase(projectId: string): Promise<boolean> {
    try {
      const pgClient = await this.dbConnections.getPostgresConnection();
      const result = await pgClient.query('SELECT id FROM projects WHERE id = $1', [projectId]);
      return result.rows.length > 0;
    } catch (error) {
      return false;
    }
  }


  private async registerInDatabases(
    projectPath: string, 
    options: ProjectInitOptions, 
    analysis: any,
    languageSetup?: LanguageSetupResult
  ): Promise<string> {
    const projectId = uuidv4();
    
    try {
      const pgClient = await this.dbConnections.getPostgresConnection();
      
      const languages = languageSetup?.selectedLanguages || [];
      
      const result = await pgClient.query(`
        INSERT INTO projects (
          id, project_name, project_path, project_type, 
          languages, total_files, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (project_path) 
        DO UPDATE SET 
          project_name = EXCLUDED.project_name,
          project_type = EXCLUDED.project_type,
          languages = EXCLUDED.languages,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
        RETURNING id
      `, [
        projectId,
        options.projectName,
        projectPath,
        analysis.architecture?.type || 'api_service',
        JSON.stringify(languages),
        analysis.dependencies?.files?.length || 0,
        JSON.stringify({
          languageSetup,
          primaryLanguage: languages[0] || 'unknown',
          analysis: {
            architecture: analysis.architecture,
            useCases: analysis.useCases.length,
            dependencies: analysis.dependencies?.files?.length || 0
          }
        })
      ]);
      
      const actualProjectId = result.rows[0].id;
      console.log(`✅ Project registered in database: ${actualProjectId}`);
      return actualProjectId;
      
    } catch (error) {
      console.error(`❌ Database registration failed: ${error.message}`);
      throw error;
    }
  }

  private async createLocalConfig(
    projectPath: string, 
    projectId: string, 
    options: ProjectInitOptions, 
    analysis: any,
    languageSetup?: LanguageSetupResult
  ): Promise<ProjectConfig> {
    const config: ProjectConfig = {
      projectId,
      projectName: options.projectName,
      projectPath,
      createdAt: new Date().toISOString(),
      languages: languageSetup?.selectedLanguages || [],
      primaryLanguage: languageSetup?.selectedLanguages?.[0] || 'unknown',
      installedParsers: languageSetup?.installedPackages || []
    };

    const configPath = path.join(projectPath, '.codemind', 'project.json');
    await fs.promises.mkdir(path.dirname(configPath), { recursive: true });
    await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));

    return config;
  }

  /**
   * Detect languages and setup project environment
   */
  private async detectLanguagesAndSetup(projectPath: string): Promise<LanguageSetupResult> {
    console.log('  🔍 Scanning project files...');
    
    // Use glob to find all source files
    const fs = require('fs').promises;
    const path = require('path');
    
    const languageMap = new Map<string, number>();
    const fileExtensions = new Set<string>();
    
    // Scan project files recursively
    const scanDirectory = async (dir: string): Promise<void> => {
      try {
        const items = await fs.readdir(dir);
        
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = await fs.stat(fullPath);
          
          if (stat.isDirectory()) {
            // Skip common ignore directories
            if (!['node_modules', '.git', 'dist', 'build', '.next'].includes(item)) {
              await scanDirectory(fullPath);
            }
          } else if (stat.isFile()) {
            const ext = path.extname(item).toLowerCase();
            if (ext) {
              fileExtensions.add(ext);
              
              // Map extensions to languages
              const langMapping: Record<string, string> = {
                '.ts': 'typescript',
                '.tsx': 'typescript',
                '.js': 'javascript', 
                '.jsx': 'javascript',
                '.py': 'python',
                '.java': 'java',
                '.cs': 'csharp',
                '.go': 'go',
                '.rs': 'rust',
                '.cpp': 'cpp',
                '.c': 'c'
              };
              
              const language = langMapping[ext];
              if (language) {
                languageMap.set(language, (languageMap.get(language) || 0) + 1);
              }
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };
    
    await scanDirectory(projectPath);
    
    const detectedLanguages = Array.from(languageMap.keys()).sort((a, b) => 
      (languageMap.get(b) || 0) - (languageMap.get(a) || 0)
    );
    
    console.log(`  ✅ Found ${fileExtensions.size} file types, ${detectedLanguages.length} programming languages`);
    
    return {
      detectedLanguages,
      selectedLanguages: detectedLanguages,
      installedPackages: [],
      errors: []
    };
  }

  /**
   * Scan project files using SOLID file scanner
   */
  async scanProjectFiles(projectPath: string): Promise<any> {
    const { ProjectFileScanner } = await import('../services/file-scanner');
    const scanner = new ProjectFileScanner();
    return await scanner.scanProject(projectPath);
  }

  /**
   * Perform complete project analysis using SOLID file scanner
   */
  private async performCompleteAnalysis(projectPath: string): Promise<any> {
    console.log('  🧠 Initializing complete project analysis with data pipeline...');

    try {
      // Step 1: File Discovery with SOLID scanner
      const { ProjectFileScanner } = await import('../services/file-scanner/project-file-scanner');
      const scanner = new ProjectFileScanner();

      console.log('  📊 Scanning project files and structure...');
      const scanResult = await scanner.scanProject(projectPath);
      console.log(`  ✅ Discovered ${scanResult.files.length} files`);

      // Step 2: Semantic Graph Analysis
      console.log('  🌳 Building semantic graph with Tree-sitter and Claude proxy...');
      const { IntegratedSemanticGraphService } = await import('../services/semantic-graph/integrated-semantic-graph-service');
      const semanticService = new IntegratedSemanticGraphService();

      const semanticResult = await semanticService.buildGraph(scanResult.files);
      console.log(`  ✅ Extracted ${semanticResult.stats.totalEntities} entities, ${semanticResult.stats.totalRelationships} relationships`);

      // Step 3: Content Processing with Embeddings
      console.log('  📄 Processing content and generating embeddings...');
      const { ContentProcessor } = await import('../services/content-processing/content-processor');
      const contentProcessor = new ContentProcessor({
        embeddingModel: 'local', // Use 384-dimensional embeddings to match database schema
        chunkSize: 1000,
        preserveCodeStructure: true
      });

      // Process source files (limited for performance)
      const sourceFiles = scanResult.files
        .filter(f => f.type === 'source' && f.size > 0 && f.size < 500000)
        .slice(0, 100); // Limit to first 100 source files

      const contentResults = await contentProcessor.processFiles(sourceFiles);
      const totalChunks = contentResults.reduce((sum, result) => sum + result.chunks.length, 0);
      const totalEmbeddings = contentResults.reduce((sum, result) => sum + result.embeddings.length, 0);
      console.log(`  ✅ Generated ${totalChunks} content chunks and ${totalEmbeddings} vector embeddings`);

      // Step 4: Vector Search Index (prepare for database storage)
      console.log('  🔍 Preparing vector search capabilities...');

      return {
        architecture: {
          type: this.detectArchitectureType(scanResult),
          patterns: this.extractArchitecturePatterns(scanResult),
          frameworks: this.detectFrameworks(scanResult)
        },
        dependencies: {
          files: scanResult.files,
          totalFiles: scanResult.files.length
        },
        useCases: this.extractUseCases(scanResult),
        semanticData: scanResult,
        // New integrated analysis results
        semanticGraph: semanticResult,
        contentProcessing: contentResults,
        processingStats: {
          totalFiles: scanResult.files.length,
          sourceFilesProcessed: sourceFiles.length,
          semanticEntities: semanticResult.stats.totalEntities,
          semanticRelationships: semanticResult.stats.totalRelationships,
          contentChunks: totalChunks,
          vectorEmbeddings: totalEmbeddings,
          processingTime: semanticResult.stats.processingTime
        }
      };

    } catch (error) {
      console.log(`  ⚠️ Complete analysis failed, using basic analysis: ${error.message}`);

      // Fallback to basic file scanning
      try {
        const { ProjectFileScanner } = await import('../services/file-scanner/project-file-scanner');
        const scanner = new ProjectFileScanner();
        const scanResult = await scanner.scanProject(projectPath);

        return {
          architecture: { type: 'unknown' },
          dependencies: {
            files: scanResult.files,
            totalFiles: scanResult.files.length
          },
          useCases: [],
          semanticData: scanResult,
          processingStats: {
            totalFiles: scanResult.files.length,
            sourceFilesProcessed: 0,
            semanticEntities: 0,
            semanticRelationships: 0,
            contentChunks: 0,
            vectorEmbeddings: 0,
            processingTime: 0
          }
        };
      } catch (fallbackError) {
        return {
          architecture: { type: 'unknown' },
          dependencies: { files: [], totalFiles: 0 },
          useCases: [],
          semanticData: null,
          processingStats: {
            totalFiles: 0,
            sourceFilesProcessed: 0,
            semanticEntities: 0,
            semanticRelationships: 0,
            contentChunks: 0,
            vectorEmbeddings: 0,
            processingTime: 0
          }
        };
      }
    }
  }

  /**
   * Populate databases with complete analysis data using status tracking
   */
  private async populateDatabases(
    projectPath: string,
    projectId: string,
    analysis: any,
    languageSetup: LanguageSetupResult
  ): Promise<any> {
    console.log('  🗃️ Storing complete analysis data in databases with status tracking...');

    let embeddingsCreated = 0;
    let analysesCreated = 0;
    let semanticEntitiesStored = 0;
    let vectorEmbeddingsStored = 0;

    // Initialize status tracker
    const { InitializationStatusTracker } = await import('../services/initialization/initialization-status-tracker');
    const statusTracker = new InitializationStatusTracker(this.dbConnections);

    try {
      // Initialize status tracking
      await statusTracker.initializeProject(projectId, analysis.projectName || 'Unknown', projectPath);

      const pgClient = await this.dbConnections.getPostgresConnection();

      // 1. Store discovered files (basic file information)
      console.log('  📂 Stage 1: Storing file discovery data...');
      try {
        if (analysis.semanticData && analysis.semanticData.files) {
          for (const file of analysis.semanticData.files) {
            try {
              // Store basic file analysis
              await pgClient.query(`
                INSERT INTO analysis_results (
                  project_id, file_path, analysis_type, file_hash,
                  analysis_result, confidence_score, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
                ON CONFLICT (project_id, file_path, analysis_type) DO NOTHING
              `, [
                projectId,
                file.path || file.relativePath,
                'file_discovery',
                'pending',
                JSON.stringify({
                  fileType: file.type || 'other',
                  language: file.language || 'unknown',
                  size: file.size || 0,
                  extension: file.extension || '',
                  discoveryTimestamp: Date.now()
                }),
                1.0
              ]);

              analysesCreated++;

            } catch (fileError) {
              console.log(`    ⚠️ Failed to store file data for ${file.path}: ${fileError.message}`);
            }
          }
        }

        await statusTracker.updateStageStatus(projectId, {
          stage: 'file_discovery',
          success: true,
          stats: { totalFiles: analysis.semanticData?.files?.length || 0 }
        });

      } catch (error) {
        console.log(`  ❌ File discovery storage failed: ${error.message}`);
        await statusTracker.updateStageStatus(projectId, {
          stage: 'file_discovery',
          success: false,
          errorMessage: error.message
        });
        throw new Error(`File discovery stage failed: ${error.message}`);
      }

      // 2. Store semantic graph in Neo4j
      console.log('  🌳 Stage 2: Storing semantic entities in Neo4j...');
      try {
        if (analysis.semanticGraph) {
          const { Neo4jGraphStorage } = await import('../services/semantic-graph/neo4j-graph-storage');
          const graphStorage = new Neo4jGraphStorage(this.dbConnections);

          // Initialize project graph with root node
          await graphStorage.initializeProjectGraph(projectId, analysis.projectName || 'Unknown', projectPath);

          // Store semantic entities
          if (analysis.semanticGraph.entities && analysis.semanticGraph.entities.length > 0) {
            await graphStorage.storeSemanticEntities(projectId, analysis.semanticGraph.entities);
            semanticEntitiesStored = analysis.semanticGraph.entities.length;

            await statusTracker.updateStageStatus(projectId, {
              stage: 'semantic_entities',
              success: true,
              stats: { entitiesCount: semanticEntitiesStored }
            });
          } else {
            await statusTracker.updateStageStatus(projectId, {
              stage: 'semantic_entities',
              success: true,
              stats: { entitiesCount: 0 }
            });
          }

          // Store semantic relationships (separate stage)
          console.log('  🔗 Stage 3: Storing semantic relationships in Neo4j...');
          if (analysis.semanticGraph.relationships && analysis.semanticGraph.relationships.length > 0) {
            await graphStorage.storeSemanticRelationships(projectId, analysis.semanticGraph.relationships);
            console.log(`  ✅ Stored ${analysis.semanticGraph.relationships.length} semantic relationships`);

            await statusTracker.updateStageStatus(projectId, {
              stage: 'semantic_relationships',
              success: true,
              stats: { relationshipsCount: analysis.semanticGraph.relationships.length }
            });
          } else {
            await statusTracker.updateStageStatus(projectId, {
              stage: 'semantic_relationships',
              success: true,
              stats: { relationshipsCount: 0 }
            });
          }

          // Get final graph statistics
          const graphStats = await graphStorage.getProjectGraphStats(projectId);
          console.log(`  📊 Neo4j Graph Stats: ${graphStats.entityNodes} entities, ${graphStats.relationships} relationships, ${graphStats.files} files`);

        } else {
          // No semantic graph data
          await statusTracker.updateStageStatus(projectId, {
            stage: 'semantic_entities',
            success: true,
            stats: { entitiesCount: 0 }
          });
          await statusTracker.updateStageStatus(projectId, {
            stage: 'semantic_relationships',
            success: true,
            stats: { relationshipsCount: 0 }
          });
        }

      } catch (graphError) {
        console.log(`  ❌ Semantic graph storage failed: ${graphError.message}`);

        // Update status for both stages as failed
        await statusTracker.updateStageStatus(projectId, {
          stage: 'semantic_entities',
          success: false,
          errorMessage: graphError.message
        });
        await statusTracker.updateStageStatus(projectId, {
          stage: 'semantic_relationships',
          success: false,
          errorMessage: graphError.message
        });

        throw new Error(`Semantic graph stage failed: ${graphError.message}`);
      }

      // 3. Store semantic search embeddings using unified SemanticSearchManager
      console.log('  📄 Stage 4: Initializing semantic search with unified manager...');
      try {
        const semanticSearchManager = new SemanticSearchManager();

        // Extract file paths from analysis for semantic search initialization
        const allFiles: string[] = [];
        if (analysis.dependencies?.files) {
          allFiles.push(...analysis.dependencies.files.map((f: any) => f.filePath || f.path || f));
        }
        if (analysis.contentProcessing) {
          for (const contentResult of analysis.contentProcessing) {
            for (const chunk of contentResult.chunks) {
              if (chunk.filePath && !allFiles.includes(chunk.filePath)) {
                allFiles.push(chunk.filePath);
              }
            }
          }
        }

        // Filter to only source files (limit for performance)
        const sourceFiles = allFiles
          .filter(file => file && typeof file === 'string')
          .filter(file => /\.(ts|js|tsx|jsx|py|java|cpp|c|h|cs|php|rb|go|rs|kt|swift|scala|clj|fs|ml|hs|elm|ex|exs|dart|lua|r|m|sh|ps1|vb|pas|asm|sql|pl|pm|tcl|nim|cr|d|zig|odin|v|pony|hack|reason|ocaml|fsharp|erlang|elixir|julia|fortran|cobol|ada|pascal|delphi|verilog|vhdl|systemverilog)$/i.test(file))
          .slice(0, 100); // Limit to first 100 files for performance

        if (sourceFiles.length > 0) {
          console.log(`  🔍 Initializing semantic search for ${sourceFiles.length} source files...`);

          // Progress callback to show progress
          const progressCallback = (progress: number, current: string, detail: string) => {
            if (progress % 10 === 0 || progress === 100) { // Only show every 10% to avoid spam
              console.log(`    📈 Progress: ${progress}% - ${detail}`);
            }
          };

          // Initialize semantic search using unified manager
          const semanticResults = await semanticSearchManager.initializeProject(
            projectId,
            sourceFiles,
            progressCallback
          );

          vectorEmbeddingsStored = semanticResults.chunks;
          console.log(`  ✅ Semantic search initialized: ${semanticResults.success} successful, ${semanticResults.errors} errors, ${semanticResults.chunks} embeddings, ${semanticResults.skipped} skipped`);
        } else {
          console.log('  ℹ️ No suitable source files found for semantic search initialization');
        }

        await statusTracker.updateStageStatus(projectId, {
          stage: 'vector_embeddings',
          success: true,
          stats: { embeddingsCount: vectorEmbeddingsStored }
        });

      } catch (embeddingError) {
        console.log(`  ❌ Semantic search initialization failed: ${embeddingError.message}`);
        await statusTracker.updateStageStatus(projectId, {
          stage: 'vector_embeddings',
          success: false,
          errorMessage: embeddingError.message
        });
        throw new Error(`Semantic search initialization failed: ${embeddingError.message}`);
      }

      // 4. Store processing statistics
      if (analysis.processingStats) {
        await pgClient.query(`
          INSERT INTO analysis_results (
            project_id, file_path, analysis_type, file_hash,
            analysis_result, confidence_score, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
          ON CONFLICT (project_id, file_path, analysis_type) DO UPDATE SET
            analysis_result = EXCLUDED.analysis_result,
            updated_at = NOW()
        `, [
          projectId,
          projectPath,
          'processing_stats',
          'stats',
          JSON.stringify(analysis.processingStats),
          1.0
        ]);

        analysesCreated++;
      }

      // Mark initialization as complete
      await statusTracker.updateStageStatus(projectId, {
        stage: 'complete',
        success: true,
        stats: {
          totalFiles: analysis.semanticData?.files?.length || 0,
          entitiesCount: semanticEntitiesStored,
          embeddingsCount: vectorEmbeddingsStored,
          processingTimeMs: Date.now() - (analysis.startTime || Date.now())
        }
      });

      const totalRecords = analysesCreated + semanticEntitiesStored + vectorEmbeddingsStored;
      console.log(`  🎉 Database population complete: ${totalRecords} total records stored`);

      // Display final status
      await statusTracker.displayProgress(projectId);

    } catch (error) {
      console.log(`  ❌ Database population failed: ${error.message}`);

      // Mark as failed and display status
      await statusTracker.updateStageStatus(projectId, {
        stage: 'complete',
        success: false,
        errorMessage: error.message
      });

      await statusTracker.displayProgress(projectId);
      throw error; // Re-throw to stop the initialization process
    }
    
    return {
      embeddings: { created: embeddingsCreated },
      analysisResults: { created: analysesCreated },
      semanticEntities: { created: semanticEntitiesStored },
      vectorEmbeddings: { created: vectorEmbeddingsStored },
      techStack: {
        languages: languageSetup.selectedLanguages,
        frameworks: analysis.architecture?.frameworks || []
      },
      processingStats: analysis.processingStats || {}
    };
  }

  // Helper methods for analysis
  private detectArchitectureType(analysisResult: any): string {
    if (!analysisResult?.primaryFiles && !analysisResult?.relatedFiles) return 'unknown';
    
    const files = [...(analysisResult.primaryFiles || []), ...(analysisResult.relatedFiles || [])];
    const hasControllers = files.some((f: any) => f.filePath?.includes('controller'));
    const hasServices = files.some((f: any) => f.filePath?.includes('service'));
    const hasModels = files.some((f: any) => f.filePath?.includes('model'));
    const hasAPI = files.some((f: any) => f.filePath?.includes('api'));
    
    if (hasAPI || (hasControllers && hasServices)) return 'api_service';
    if (hasControllers || hasServices || hasModels) return 'web_app';
    return 'library';
  }

  private extractArchitecturePatterns(analysisResult: any): string[] {
    const patterns = [];
    const files = [...(analysisResult.primaryFiles || []), ...(analysisResult.relatedFiles || [])];
    if (files.some((f: any) => f.filePath?.includes('layer'))) {
      patterns.push('layered-architecture');
    }
    return patterns;
  }

  private detectFrameworks(analysisResult: any): string[] {
    const frameworks = [];
    const files = [...(analysisResult.primaryFiles || []), ...(analysisResult.relatedFiles || [])];
    if (files.some((f: any) => f.content?.includes('express'))) {
      frameworks.push('express');
    }
    if (files.some((f: any) => f.content?.includes('react'))) {
      frameworks.push('react');
    }
    return frameworks;
  }

  private extractUseCases(analysisResult: any): any[] {
    // Basic use case extraction - could be enhanced
    const useCases = [];
    const files = [...(analysisResult.primaryFiles || []), ...(analysisResult.relatedFiles || [])];
    if (files.length > 0) {
      const apiFiles = files.filter((f: any) => 
        f.filePath?.includes('api') || f.filePath?.includes('controller')
      );
      useCases.push(...apiFiles.map((f: any) => ({
        name: `API: ${require('path').basename(f.filePath, require('path').extname(f.filePath))}`,
        type: 'api_endpoint',
        file: f.filePath
      })));
    }
    return useCases;
  }
}