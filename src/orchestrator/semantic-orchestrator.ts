/**
 * Semantic Orchestrator - Enhanced with Graph Intelligence
 * Integrates semantic graph queries into every analysis request
 */

import SemanticGraphService from '../cli/services/semantic-graph';
import { DocumentMapAnalyzer } from '../cli/features/documentation/map-analyzer';
import { UseCasesAnalyzer } from '../cli/features/use-cases/analyzer';
import { TreeNavigator } from '../cli/features/tree-navigation/navigator';
import { Logger } from '../utils/logger';

export interface SemanticContextRequest {
  query: string;
  projectPath: string;
  intent?: 'overview' | 'coding' | 'architecture' | 'debugging' | 'research';
  maxResults?: number;
  includeRelated?: boolean;
}

export interface SemanticContextResult {
  query: string;
  intent: string;
  primaryResults: any[];
  relatedConcepts: any[];
  crossDomainInsights: any[];
  graphContext: {
    totalNodes: number;
    totalRelationships: number;
    relevantClusters: string[];
  };
  recommendations: string[];
  mermaidDiagram?: string;
}

export class SemanticOrchestrator {
  private semanticGraph: SemanticGraphService;
  private docAnalyzer: DocumentMapAnalyzer;
  private useCasesAnalyzer: UseCasesAnalyzer;
  private treeNavigator: TreeNavigator;
  private logger = Logger.getInstance();

  constructor() {
    this.semanticGraph = new SemanticGraphService();
    this.docAnalyzer = new DocumentMapAnalyzer();
    this.useCasesAnalyzer = new UseCasesAnalyzer();
    this.treeNavigator = new TreeNavigator();
  }

  async initialize(): Promise<void> {
    try {
      await this.semanticGraph.initialize();
      this.logger.debug('🧠 Semantic Orchestrator: Neo4j connection established');
    } catch (error) {
      this.logger.error('❌ Failed to connect to Neo4j database:', error);
      throw error;
    }
  }

  async analyzeWithSemanticContext(request: SemanticContextRequest): Promise<SemanticContextResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`🧠 Starting semantic analysis for: "${request.query}"`);
      
      // 1. Semantic search in graph
      const searchResults = await this.semanticGraph.semanticSearch(request.query, {
        maxDepth: request.maxResults || 10
      });
      
      // 2. Extract relevant concepts
      const relatedConcepts = await this.extractRelatedConcepts(searchResults);
      
      // 3. Get cross-domain insights
      const crossDomainInsights = await this.findCrossDomainInsights(request.query);
      
      // 4. Intent-specific analysis
      const primaryResults = await this.performIntentSpecificAnalysis(request, searchResults);
      
      // 5. Generate recommendations
      const recommendations = this.generateSemanticRecommendations(
        searchResults, 
        relatedConcepts, 
        request.intent || 'overview'
      );
      
      // 6. Create visualization if requested
      let mermaidDiagram;
      if (request.includeRelated) {
        mermaidDiagram = await this.generateSemanticMermaid(searchResults, relatedConcepts);
      }
      
      // 7. Get graph context
      const graphStats = await this.semanticGraph.getGraphStatistics();
      const graphContext = {
        totalNodes: graphStats.total_nodes || 0,
        totalRelationships: graphStats.total_relationships || 0,
        relevantClusters: this.extractRelevantClusters(searchResults)
      };
      
      const duration = Date.now() - startTime;
      this.logger.info(`✅ Semantic analysis completed in ${duration}ms`, {
        primaryResults: primaryResults.length,
        relatedConcepts: relatedConcepts.length,
        crossDomainInsights: crossDomainInsights.length
      });
      
      return {
        query: request.query,
        intent: request.intent || 'overview',
        primaryResults,
        relatedConcepts,
        crossDomainInsights,
        graphContext,
        recommendations,
        mermaidDiagram
      };
      
    } catch (error) {
      this.logger.error('❌ Semantic analysis failed:', error);
      throw error;
    }
  }

  private async extractRelatedConcepts(searchResults: any[]): Promise<any[]> {
    const concepts: any[] = [];
    
    for (const result of searchResults.slice(0, 5)) { // Limit to top 5
      if (result.node.labels.includes('BusinessConcept')) {
        try {
          const crossRefs = await this.semanticGraph.findCrossReferences(result.node.properties.name);
          concepts.push({
            name: result.node.properties.name,
            domain: result.node.properties.domain,
            description: result.node.properties.description,
            relatedCode: crossRefs.relatedCode.length,
            relatedDocs: crossRefs.relatedDocs.length,
            relatedUI: crossRefs.relatedUI.length,
            strength: result.relevanceScore
          });
        } catch (error) {
          // Concept might not have cross-references yet
        }
      }
    }
    
    return concepts;
  }

  private async findCrossDomainInsights(query: string): Promise<any[]> {
    // Simple cross-domain analysis based on search results
    const insights: any[] = [];
    
    try {
      const results = await this.semanticGraph.semanticSearch(query);
      const domains = new Set<string>();
      
      results.forEach(result => {
        if (result.node.properties.domain) {
          domains.add(result.node.properties.domain);
        }
      });
      
      if (domains.size > 1) {
        insights.push({
          type: 'cross_domain_concept',
          query,
          domains: Array.from(domains),
          impact: 'Concept spans multiple domains - consider architectural alignment',
          strength: domains.size / 5 // Normalize to 0-1 scale
        });
      }
      
    } catch (error) {
      this.logger.debug('Could not analyze cross-domain insights:', error);
    }
    
    return insights;
  }

  private async performIntentSpecificAnalysis(
    request: SemanticContextRequest, 
    searchResults: any[]
  ): Promise<any[]> {
    const results: any[] = [];
    
    switch (request.intent) {
      case 'overview':
        // Provide high-level project understanding
        results.push(...searchResults.slice(0, 5).map(r => ({
          type: 'overview_item',
          name: r.node.properties.name,
          labels: r.node.labels,
          description: r.node.properties.description,
          relevance: r.relevanceScore
        })));
        break;
        
      case 'coding':
        // Focus on code-related items
        const codeResults = searchResults.filter(r => 
          r.node.labels.includes('Code') || 
          r.relatedNodes.some(rel => rel.node?.labels?.includes('Code'))
        );
        
        for (const codeResult of codeResults.slice(0, 3)) {
          if (codeResult.node.properties.path) {
            results.push({
              type: 'code_context',
              name: codeResult.node.properties.name,
              path: codeResult.node.properties.path,
              language: codeResult.node.properties.language,
              description: codeResult.node.properties.description,
              relevance: codeResult.relevanceScore
            });
          }
        }
        break;
        
      case 'architecture':
        // Focus on architectural insights
        try {
          const docResult = await this.docAnalyzer.analyzeDocumentation({
            projectPath: request.projectPath
          });
          
          results.push({
            type: 'architecture_overview',
            data: {
              documents: docResult.documents,
              topics: docResult.topics,
              mainClasses: docResult.mainClasses
            }
          });
        } catch (error) {
          this.logger.debug('Could not perform architecture analysis:', error);
        }
        break;
        
      case 'debugging':
        // Focus on impact analysis
        const impactNodes = searchResults.filter(r => r.node.labels.includes('Code'));
        
        for (const node of impactNodes.slice(0, 2)) {
          try {
            const impact = await this.semanticGraph.analyzeImpact(node.node.id);
            results.push({
              type: 'impact_analysis',
              target: node.node.properties.name,
              affectedFiles: impact.impact.codeFiles,
              affectedTests: impact.impact.tests,
              riskLevel: impact.riskLevel,
              recommendations: impact.riskLevel === 'high' ? 
                ['Proceed with caution - high impact change'] :
                ['Low impact change - safe to proceed']
            });
          } catch (error) {
            this.logger.debug('Could not analyze impact:', error);
          }
        }
        break;
        
      default:
        results.push(...searchResults.slice(0, 5));
    }
    
    return results;
  }

  private generateSemanticRecommendations(
    searchResults: any[], 
    relatedConcepts: any[], 
    intent: string
  ): string[] {
    const recommendations: string[] = [];
    
    if (searchResults.length === 0) {
      recommendations.push('No semantic matches found - consider adding relevant documentation or code comments');
      return recommendations;
    }
    
    // High relevance recommendations
    const highRelevanceCount = searchResults.filter(r => r.relevanceScore > 0.7).length;
    if (highRelevanceCount > 0) {
      recommendations.push(`Found ${highRelevanceCount} highly relevant matches - strong semantic understanding`);
    }
    
    // Cross-domain recommendations
    if (relatedConcepts.length > 1) {
      const domains = [...new Set(relatedConcepts.map(c => c.domain))];
      if (domains.length > 1) {
        recommendations.push(`Concept spans ${domains.length} domains (${domains.join(', ')}) - consider architectural alignment`);
      }
    }
    
    // Intent-specific recommendations
    switch (intent) {
      case 'coding':
        const codeMatches = searchResults.filter(r => r.node.labels.includes('Code')).length;
        if (codeMatches === 0) {
          recommendations.push('No direct code matches - check documentation for implementation guidance');
        }
        break;
        
      case 'architecture':
        if (relatedConcepts.length > 3) {
          recommendations.push('Complex concept with many relationships - review for potential refactoring opportunities');
        }
        break;
    }
    
    return recommendations;
  }

  private async generateSemanticMermaid(searchResults: any[], relatedConcepts: any[]): Promise<string> {
    const lines: string[] = ['graph TD'];
    
    // Add main search results
    searchResults.slice(0, 5).forEach(result => {
      const nodeId = `node_${result.node.id}`;
      const label = `${result.node.properties.name}\\n[${result.node.labels[0]}]`;
      lines.push(`    ${nodeId}["${label}"]`);
    });
    
    // Add related concepts
    relatedConcepts.slice(0, 3).forEach((concept, index) => {
      const conceptId = `concept_${index}`;
      lines.push(`    ${conceptId}("${concept.name}\\n${concept.domain}")`);
    });
    
    // Add some relationships (simplified)
    if (searchResults.length > 1) {
      lines.push(`    node_${searchResults[0].node.id} --> node_${searchResults[1].node.id}`);
    }
    
    return lines.join('\n');
  }

  private extractRelevantClusters(searchResults: any[]): string[] {
    const clusters = new Set<string>();
    
    searchResults.forEach(result => {
      if (result.node.properties.domain) {
        clusters.add(`${result.node.properties.domain}_cluster`);
      }
    });
    
    return Array.from(clusters);
  }

  async close(): Promise<void> {
    await this.semanticGraph.close();
  }
}

export default SemanticOrchestrator;