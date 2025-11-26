/**
 * Pattern Detection Service
 * SOLID Principles: Single Responsibility - Handle semantic pattern detection
 */

import { KnowledgeNode, KnowledgeTriad, NodeType, RelationType, TriadSource } from '../../graph/types';
import { Logger } from '../../../../utils/logger';
import { IPatternDetectionService, SemanticPattern, SemanticAnalysisConfig } from '../interfaces';

export class PatternDetectionService implements IPatternDetectionService {
  private logger = Logger.getInstance();

  constructor(private config: SemanticAnalysisConfig) {}

  async detectSemanticSimilarities(nodes: KnowledgeNode[]): Promise<KnowledgeTriad[]> {
    this.logger.info('Detecting semantic similarities...');

    const similarities: KnowledgeTriad[] = [];

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const similarity = this.calculateSimilarity(nodes[i], nodes[j]);

        if (similarity >= this.config.minConfidence) {
          similarities.push({
            id: `similarity_${nodes[i].id}_${nodes[j].id}`,
            subject: nodes[i].id,
            predicate: RelationType.IS_SIMILAR_TO,
            object: nodes[j].id,
            confidence: similarity,
            source: TriadSource.SEMANTIC_ANALYZER,
            evidenceType: 'semantic_similarity',
            metadata: {
              similarityScore: similarity,
              algorithm: 'lexical_semantic'
            },
            createdAt: new Date()
          });
        }
      }
    }

    this.logger.info(`Found ${similarities.length} semantic similarities`);
    return similarities;
  }

  async detectSemanticPatterns(nodes: KnowledgeNode[], triads: KnowledgeTriad[]): Promise<SemanticPattern[]> {
    this.logger.info('Detecting semantic patterns...');

    const patterns: SemanticPattern[] = [];

    // Detect repository pattern
    const repositoryPattern = this.detectRepositoryPattern(nodes);
    if (repositoryPattern) patterns.push(repositoryPattern);

    // Detect service layer pattern
    const servicePattern = this.detectServicePattern(nodes);
    if (servicePattern) patterns.push(servicePattern);

    // Detect factory pattern
    const factoryPattern = this.detectFactoryPattern(nodes);
    if (factoryPattern) patterns.push(factoryPattern);

    // Detect observer pattern
    const observerPattern = this.detectObserverPattern(nodes);
    if (observerPattern) patterns.push(observerPattern);

    // Detect MVC pattern
    const mvcPattern = this.detectMVCPattern(nodes);
    if (mvcPattern) patterns.push(mvcPattern);

    this.logger.info(`Detected ${patterns.length} semantic patterns`);
    return patterns;
  }

  private calculateSimilarity(node1: KnowledgeNode, node2: KnowledgeNode): number {
    // Simple semantic similarity based on node type and metadata
    if (node1.type !== node2.type) {
      return 0;
    }

    let similarity = 0.5; // Base similarity for same type

    // Check name similarity
    if (node1.name && node2.name) {
      const name1 = node1.name.toLowerCase();
      const name2 = node2.name.toLowerCase();

      if (name1.includes(name2) || name2.includes(name1)) {
        similarity += 0.2;
      }

      // Check for similar naming patterns
      if (this.hasSimilarNaming(name1, name2)) {
        similarity += 0.1;
      }
    }

    // Check namespace similarity
    if (node1.namespace === node2.namespace) {
      similarity += 0.2;
    }

    return Math.min(1.0, similarity);
  }

  private hasSimilarNaming(name1: string, name2: string): boolean {
    // Check for common prefixes/suffixes
    const commonPrefixes = ['get', 'set', 'create', 'delete', 'update', 'find'];
    const commonSuffixes = ['service', 'manager', 'handler', 'controller', 'repository'];

    for (const prefix of commonPrefixes) {
      if (name1.startsWith(prefix) && name2.startsWith(prefix)) {
        return true;
      }
    }

    for (const suffix of commonSuffixes) {
      if (name1.endsWith(suffix) && name2.endsWith(suffix)) {
        return true;
      }
    }

    return false;
  }

  private detectRepositoryPattern(nodes: KnowledgeNode[]): SemanticPattern | null {
    const repositoryNodes = nodes.filter(node =>
      node.name?.toLowerCase().includes('repository') ||
      node.name?.toLowerCase().includes('repo') ||
      (node.type === NodeType.CLASS &&
       node.metadata?.tags?.includes('data_access'))
    );

    if (repositoryNodes.length >= 2) {
      return {
        name: 'Repository Pattern',
        type: 'data_access',
        confidence: 0.8,
        nodes: repositoryNodes.map(n => n.id),
        description: `Found ${repositoryNodes.length} repository classes implementing data access layer`
      };
    }

    return null;
  }

  private detectServicePattern(nodes: KnowledgeNode[]): SemanticPattern | null {
    const serviceNodes = nodes.filter(node =>
      node.name?.toLowerCase().includes('service') ||
      (node.type === NodeType.CLASS &&
       node.metadata?.tags?.includes('business_logic'))
    );

    if (serviceNodes.length >= 3) {
      return {
        name: 'Service Layer Pattern',
        type: 'business_logic',
        confidence: 0.75,
        nodes: serviceNodes.map(n => n.id),
        description: `Found ${serviceNodes.length} service classes implementing business logic layer`
      };
    }

    return null;
  }

  private detectFactoryPattern(nodes: KnowledgeNode[]): SemanticPattern | null {
    const factoryNodes = nodes.filter(node =>
      node.name?.toLowerCase().includes('factory') ||
      node.name?.toLowerCase().includes('builder') ||
      (node.type === NodeType.CLASS &&
       node.metadata?.tags?.includes('creation'))
    );

    if (factoryNodes.length >= 1) {
      return {
        name: 'Factory Pattern',
        type: 'creation',
        confidence: 0.7,
        nodes: factoryNodes.map(n => n.id),
        description: `Found ${factoryNodes.length} factory classes implementing object creation`
      };
    }

    return null;
  }

  private detectObserverPattern(nodes: KnowledgeNode[]): SemanticPattern | null {
    const observerNodes = nodes.filter(node =>
      node.name?.toLowerCase().includes('observer') ||
      node.name?.toLowerCase().includes('listener') ||
      node.name?.toLowerCase().includes('handler') ||
      (node.type === NodeType.CLASS &&
       node.metadata?.tags?.includes('event_handling'))
    );

    if (observerNodes.length >= 2) {
      return {
        name: 'Observer Pattern',
        type: 'behavioral',
        confidence: 0.65,
        nodes: observerNodes.map(n => n.id),
        description: `Found ${observerNodes.length} observer/listener classes implementing event handling`
      };
    }

    return null;
  }

  private detectMVCPattern(nodes: KnowledgeNode[]): SemanticPattern | null {
    const controllers = nodes.filter(n => n.name?.toLowerCase().includes('controller'));
    const models = nodes.filter(n => n.name?.toLowerCase().includes('model'));
    const views = nodes.filter(n => n.name?.toLowerCase().includes('view'));

    if (controllers.length >= 1 && models.length >= 1 && views.length >= 1) {
      return {
        name: 'MVC Pattern',
        type: 'architectural',
        confidence: 0.8,
        nodes: [...controllers, ...models, ...views].map(n => n.id),
        description: `Found MVC pattern with ${controllers.length} controllers, ${models.length} models, ${views.length} views`
      };
    }

    return null;
  }
}