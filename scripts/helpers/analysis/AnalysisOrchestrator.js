const chalk = require('chalk');

/**
 * Analysis Orchestrator - coordinates multiple analyzers and persisters
 * Follows Open/Closed and Dependency Inversion Principles
 */
class AnalysisOrchestrator {
  constructor() {
    this.analyzers = new Map();
    this.persisters = new Map();
    this.results = {
      totalRecordsCreated: 0,
      analyzersRun: 0,
      errors: [],
      warnings: []
    };
  }

  /**
   * Register an analyzer (Open/Closed Principle)
   * @param {string} name Analyzer name
   * @param {IAnalyzer} analyzer Analyzer instance
   */
  registerAnalyzer(name, analyzer) {
    this.analyzers.set(name, analyzer);
    console.log(chalk.blue(`📋 Registered analyzer: ${name}`));
  }

  /**
   * Register a data persister (Open/Closed Principle)
   * @param {string} name Persister name
   * @param {IDataPersister} persister Persister instance
   */
  registerPersister(name, persister) {
    this.persisters.set(name, persister);
    console.log(chalk.blue(`💾 Registered persister: ${name}`));
  }

  /**
   * Initialize all registered components
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    console.log(chalk.blue('🚀 Initializing Analysis Orchestrator...'));
    
    let success = true;

    // Initialize analyzers
    for (const [name, analyzer] of this.analyzers) {
      try {
        const result = await analyzer.initialize();
        if (!result) {
          this.results.warnings.push(`Analyzer ${name} initialization failed`);
          success = false;
        }
      } catch (error) {
        this.results.errors.push({ analyzer: name, phase: 'initialization', error: error.message });
        success = false;
      }
    }

    // Initialize persisters
    for (const [name, persister] of this.persisters) {
      try {
        const result = await persister.initialize();
        if (!result) {
          this.results.warnings.push(`Persister ${name} initialization failed`);
          success = false;
        }
      } catch (error) {
        this.results.errors.push({ persister: name, phase: 'initialization', error: error.message });
        success = false;
      }
    }

    return success;
  }

  /**
   * Run comprehensive analysis
   * @param {Object} config Analysis configuration
   * @returns {Promise<Object>} Analysis results
   */
  async runAnalysis({ projectPath, projectId, projectName, analyzers = null }) {
    console.log(chalk.blue('🧠 Starting comprehensive analysis...'));

    const targetAnalyzers = analyzers ? 
      Array.from(this.analyzers.entries()).filter(([name]) => analyzers.includes(name)) :
      Array.from(this.analyzers.entries());

    const analysisResults = {};

    for (const [name, analyzer] of targetAnalyzers) {
      try {
        console.log(chalk.blue(`🔍 Running ${name} analysis...`));
        
        const startTime = Date.now();
        const result = await analyzer.analyze({
          projectPath,
          projectId,
          projectName,
          maxDepth: 4,
          includeExtensions: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs', '.cpp', '.c', '.cs']
        });
        const duration = Date.now() - startTime;

        analysisResults[name] = {
          ...result,
          duration,
          success: true
        };

        this.results.analyzersRun++;
        console.log(chalk.green(`✅ ${name} analysis completed in ${duration}ms`));

        // Auto-persist if corresponding persister exists
        await this._autoPersist(name, { projectId, treeData: result });

      } catch (error) {
        console.log(chalk.red(`❌ ${name} analysis failed: ${error.message}`));
        this.results.errors.push({ analyzer: name, phase: 'analysis', error: error.message });
        analysisResults[name] = {
          success: false,
          error: error.message
        };
      }
    }

    return {
      results: analysisResults,
      summary: this.results,
      totalRecordsCreated: this.results.totalRecordsCreated
    };
  }

  /**
   * Auto-persist analysis results using corresponding persister
   * @param {string} analyzerName Name of the analyzer
   * @param {Object} data Data to persist
   * @private
   */
  async _autoPersist(analyzerName, data) {
    // Map analyzer names to persister names
    const analyzerToPersisterMap = {
      'TreeNavigation': 'PostgreSQL',
      'SemanticGraph': 'Neo4j',
      'ToolAutoDiscovery': 'MongoDB'
    };

    const persisterName = analyzerToPersisterMap[analyzerName];
    if (!persisterName || !this.persisters.has(persisterName)) {
      console.log(chalk.yellow(`⚠️ No persister found for ${analyzerName} analyzer`));
      return;
    }

    const persister = this.persisters.get(persisterName);
    
    try {
      console.log(chalk.blue(`💾 Persisting ${analyzerName} results...`));
      
      const result = await persister.persist(data);
      if (result.success) {
        this.results.totalRecordsCreated += result.recordsInserted || 0;
        console.log(chalk.green(`✅ Persisted ${result.recordsInserted || 0} records from ${analyzerName}`));
      } else {
        this.results.warnings.push(`Persistence failed for ${analyzerName}: ${result.error}`);
      }
    } catch (error) {
      console.log(chalk.red(`❌ Persistence failed for ${analyzerName}: ${error.message}`));
      this.results.errors.push({ 
        persister: persisterName, 
        phase: 'persistence', 
        analyzer: analyzerName,
        error: error.message 
      });
    }
  }

  /**
   * Get comprehensive statistics from all components
   * @returns {Promise<Object>} Statistics
   */
  async getStatistics() {
    const stats = {
      analyzers: {},
      persisters: {},
      overall: this.results
    };

    // Get analyzer statistics
    for (const [name, analyzer] of this.analyzers) {
      try {
        stats.analyzers[name] = await analyzer.getStatistics();
      } catch (error) {
        stats.analyzers[name] = { error: error.message };
      }
    }

    // Get persister statistics (if they have this method)
    for (const [name, persister] of this.persisters) {
      try {
        if (typeof persister.getStatistics === 'function') {
          stats.persisters[name] = await persister.getStatistics();
        }
      } catch (error) {
        stats.persisters[name] = { error: error.message };
      }
    }

    return stats;
  }

  /**
   * Cleanup all resources
   * @returns {Promise<void>}
   */
  async cleanup() {
    console.log(chalk.blue('🧹 Cleaning up Analysis Orchestrator...'));

    // Cleanup analyzers
    for (const [name, analyzer] of this.analyzers) {
      try {
        await analyzer.cleanup();
      } catch (error) {
        console.log(chalk.yellow(`⚠️ Cleanup warning for ${name} analyzer: ${error.message}`));
      }
    }

    // Cleanup persisters
    for (const [name, persister] of this.persisters) {
      try {
        await persister.cleanup();
      } catch (error) {
        console.log(chalk.yellow(`⚠️ Cleanup warning for ${name} persister: ${error.message}`));
      }
    }

    console.log(chalk.green('✅ Analysis Orchestrator cleanup complete'));
  }

  /**
   * Get results summary
   * @returns {Object} Results summary
   */
  getResultsSummary() {
    return {
      ...this.results,
      analyzersRegistered: this.analyzers.size,
      persistersRegistered: this.persisters.size,
      success: this.results.errors.length === 0
    };
  }
}

module.exports = { AnalysisOrchestrator };