/**
 * Enhanced CLI Logger with Colors for Semantic Graph Integration
 * Provides visual feedback about semantic graph usage and status
 */

import chalk from 'chalk';

export interface SemanticStatus {
  enabled: boolean;
  connected: boolean;
  nodesCount?: number;
  relationshipsCount?: number;
  searchResultsCount?: number;
  relevantConceptsCount?: number;
}

export class CLILogger {
  private static instance: CLILogger;
  
  public static getInstance(): CLILogger {
    if (!CLILogger.instance) {
      CLILogger.instance = new CLILogger();
    }
    return CLILogger.instance;
  }

  // Standard logging methods with semantic awareness
  info(message: string, semanticStatus?: SemanticStatus): void {
    const prefix = this.getSemanticPrefix(semanticStatus);
    console.log(`${prefix}${chalk.cyan('ℹ')} ${message}`);
  }

  success(message: string, semanticStatus?: SemanticStatus): void {
    const prefix = this.getSemanticPrefix(semanticStatus);
    console.log(`${prefix}${chalk.green('✅')} ${chalk.green(message)}`);
  }

  warning(message: string, semanticStatus?: SemanticStatus): void {
    const prefix = this.getSemanticPrefix(semanticStatus);
    console.log(`${prefix}${chalk.yellow('⚠️')} ${chalk.yellow(message)}`);
  }

  error(message: string, details?: string): void {
    console.log(`${chalk.red('❌')} ${chalk.red(message)}`);
    if (details) {
      console.log(`   ${chalk.gray(details)}`);
    }
  }

  // Semantic-specific logging methods
  semanticInitializing(): void {
    console.log(`${chalk.blue('🧠')} ${chalk.blue('Initializing semantic graph...')}`);
  }

  semanticConnected(stats?: { nodes: number; relationships: number }): void {
    const statsText = stats ? chalk.gray(` (${stats.nodes} nodes, ${stats.relationships} relationships)`) : '';
    console.log(`${chalk.green('🧠')} ${chalk.green('Semantic graph connected')}${statsText}`);
  }

  semanticDisconnected(): void {
    console.log(`${chalk.red('🧠')} ${chalk.red('Semantic graph not available - using fallback mode')}`);
  }

  semanticSearching(query: string, intent?: string): void {
    const intentText = intent ? chalk.gray(` [${intent}]`) : '';
    console.log(`${chalk.magenta('🔍')} ${chalk.magenta('Semantic search:')} "${chalk.white(query)}"${intentText}`);
  }

  semanticResults(results: {
    primaryResults: number;
    relatedConcepts: number;
    crossDomainInsights: number;
    duration: number;
  }): void {
    const { primaryResults, relatedConcepts, crossDomainInsights, duration } = results;
    
    console.log(`${chalk.green('🔍')} ${chalk.green('Search completed')} ${chalk.gray(`(${duration}ms)`)}`);
    
    if (primaryResults > 0) {
      console.log(`   ${chalk.cyan('📋')} Primary results: ${chalk.white(primaryResults)}`);
    }
    
    if (relatedConcepts > 0) {
      console.log(`   ${chalk.yellow('🔗')} Related concepts: ${chalk.white(relatedConcepts)}`);
    }
    
    if (crossDomainInsights > 0) {
      console.log(`   ${chalk.magenta('🌐')} Cross-domain insights: ${chalk.white(crossDomainInsights)}`);
    }
    
    if (primaryResults === 0 && relatedConcepts === 0) {
      console.log(`   ${chalk.gray('💭')} No semantic matches found`);
    }
  }

  contextOptimizing(query: string, tokenBudget: number, semanticEnabled: boolean): void {
    const semanticIndicator = semanticEnabled ? 
      chalk.green('[🧠 Semantic]') : 
      chalk.gray('[📁 Standard]');
    
    console.log(`${chalk.blue('🎯')} ${chalk.blue('Context optimization:')} "${chalk.white(query)}" ${semanticIndicator}`);
    console.log(`   ${chalk.gray('Token budget:')} ${chalk.white(tokenBudget)}`);
  }

  contextResults(results: {
    strategy: string;
    estimatedTokens: number;
    tokenBudget: number;
    priorityFiles: number;
    semanticBoosts?: number;
  }): void {
    const { strategy, estimatedTokens, tokenBudget, priorityFiles, semanticBoosts } = results;
    
    console.log(`${chalk.green('🎯')} ${chalk.green('Optimization completed')}`);
    console.log(`   ${chalk.cyan('Strategy:')} ${chalk.white(strategy)}`);
    console.log(`   ${chalk.cyan('Tokens:')} ${chalk.white(estimatedTokens)}/${chalk.white(tokenBudget)}`);
    console.log(`   ${chalk.cyan('Priority files:')} ${chalk.white(priorityFiles)}`);
    
    if (semanticBoosts && semanticBoosts > 0) {
      console.log(`   ${chalk.green('🧠 Semantic boosts applied:')} ${chalk.white(semanticBoosts)} files`);
    }
  }

  fileList(files: Array<{
    path: string;
    score: number;
    importance: string;
    language: string;
    semanticBoost?: boolean;
    summary?: string;
  }>): void {
    console.log(`\n${chalk.cyan('📁 Top Priority Files:')}`);
    
    files.forEach((file, index) => {
      const number = chalk.gray(`${index + 1}.`);
      const importance = this.getImportanceColor(file.importance);
      const semanticIcon = file.semanticBoost ? chalk.green(' 🧠') : '';
      const score = chalk.gray(`(${file.score.toFixed(3)})`);
      
      console.log(`${number} ${chalk.white(file.path)} ${importance}${semanticIcon} ${score}`);
      console.log(`   ${chalk.gray('Language:')} ${chalk.yellow(file.language)}`);
      
      if (file.summary) {
        const summary = file.summary.length > 80 ? 
          file.summary.substring(0, 80) + '...' : 
          file.summary;
        console.log(`   ${chalk.gray('Summary:')} ${chalk.dim(summary)}`);
      }
    });
  }

  conceptsList(concepts: Array<{
    name: string;
    domain?: string;
    strength?: number;
    relatedCode?: number;
    relatedDocs?: number;
  }>): void {
    console.log(`\n${chalk.yellow('🔗 Related Concepts:')}`);
    
    concepts.forEach((concept, index) => {
      const number = chalk.gray(`${index + 1}.`);
      const domain = concept.domain ? chalk.gray(` [${concept.domain}]`) : '';
      const strength = concept.strength ? chalk.gray(` (${(concept.strength * 100).toFixed(0)}%)`) : '';
      
      console.log(`${number} ${chalk.white(concept.name)}${domain}${strength}`);
      
      if (concept.relatedCode || concept.relatedDocs) {
        const codeText = concept.relatedCode ? `${concept.relatedCode} code files` : '';
        const docsText = concept.relatedDocs ? `${concept.relatedDocs} docs` : '';
        const related = [codeText, docsText].filter(Boolean).join(', ');
        
        if (related) {
          console.log(`   ${chalk.gray('Related:')} ${chalk.dim(related)}`);
        }
      }
    });
  }

  recommendationsList(recommendations: string[]): void {
    if (recommendations.length === 0) return;
    
    console.log(`\n${chalk.green('💡 Recommendations:')}`);
    recommendations.forEach(rec => {
      console.log(`   ${chalk.green('•')} ${chalk.white(rec)}`);
    });
  }

  // CLI command headers
  commandHeader(command: string, description: string): void {
    console.log(`\n${chalk.bold.blue('=')} ${chalk.bold.white(command)} ${chalk.bold.blue('=')}`);
    console.log(`${chalk.gray(description)}\n`);
  }

  // Status indicators
  statusLine(label: string, value: string | number, status: 'success' | 'warning' | 'error' | 'info' = 'info'): void {
    const statusColors = {
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red,
      info: chalk.cyan
    };
    
    const coloredValue = statusColors[status](value);
    console.log(`${chalk.gray(label + ':')} ${coloredValue}`);
  }

  // Progress indicator for long operations
  progress(message: string, current: number, total: number): void {
    const percentage = Math.round((current / total) * 100);
    const bar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));
    
    process.stdout.write(`\r${chalk.blue('⏳')} ${message} [${chalk.cyan(bar)}] ${chalk.white(percentage)}%`);
    
    if (current === total) {
      process.stdout.write('\n');
    }
  }

  // Helper methods
  private getSemanticPrefix(status?: SemanticStatus): string {
    if (!status) return '';
    
    if (!status.enabled) return '';
    
    if (status.connected) {
      return chalk.green('🧠 ');
    } else {
      return chalk.red('🧠 ');
    }
  }

  private getImportanceColor(importance: string): string {
    switch (importance) {
      case 'critical':
        return chalk.red('[CRITICAL]');
      case 'high':
        return chalk.yellow('[HIGH]');
      case 'medium':
        return chalk.blue('[MEDIUM]');
      case 'low':
        return chalk.gray('[LOW]');
      default:
        return chalk.gray('[UNKNOWN]');
    }
  }

  // Utility methods for formatting
  highlight(text: string): string {
    return chalk.yellow(text);
  }

  dim(text: string): string {
    return chalk.dim(text);
  }

  bold(text: string): string {
    return chalk.bold(text);
  }

  path(filePath: string): string {
    return chalk.cyan(filePath);
  }

  code(text: string): string {
    return chalk.green(text);
  }

  // Special methods for different CLI scenarios
  semanticFallback(reason: string): void {
    console.log(`${chalk.yellow('⚠️')} ${chalk.yellow('Semantic graph unavailable:')} ${chalk.gray(reason)}`);
    console.log(`${chalk.gray('   Falling back to standard file analysis')}`);
  }

  semanticHealthCheck(services: {
    neo4j: boolean;
    semanticGraph: boolean;
    orchestrator: boolean;
  }): void {
    console.log(`\n${chalk.bold.cyan('🔍 Semantic Services Health Check:')}`);
    
    this.statusLine('Neo4j Database', services.neo4j ? 'Connected' : 'Disconnected', services.neo4j ? 'success' : 'error');
    this.statusLine('Semantic Graph', services.semanticGraph ? 'Available' : 'Unavailable', services.semanticGraph ? 'success' : 'error');
    this.statusLine('Orchestrator API', services.orchestrator ? 'Running' : 'Stopped', services.orchestrator ? 'success' : 'error');
    
    if (services.neo4j && services.semanticGraph && services.orchestrator) {
      console.log(`\n${chalk.green('✅ All semantic services operational')}`);
    } else {
      console.log(`\n${chalk.yellow('⚠️ Some semantic services are unavailable - limited functionality')}`);
    }
  }
}

export default CLILogger;