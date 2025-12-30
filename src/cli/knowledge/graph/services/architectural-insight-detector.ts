/**
 * Architectural Insight Detector
 * Detects design patterns, anti-patterns, and architectural issues
 */

import { KnowledgeNode, KnowledgeTriad, ArchitecturalInsight, NodeType, RelationType } from '../types';
import { Logger } from '../../../../utils/logger';

export interface IArchitecturalInsightDetector {
  detectArchitecturalInsights(nodes: Map<string, KnowledgeNode>, triads: Map<string, KnowledgeTriad>): Promise<ArchitecturalInsight[]>;
  detectDesignPatterns(nodes: Map<string, KnowledgeNode>, triads: Map<string, KnowledgeTriad>): Promise<ArchitecturalInsight[]>;
  detectAntiPatterns(nodes: Map<string, KnowledgeNode>, triads: Map<string, KnowledgeTriad>): Promise<ArchitecturalInsight[]>;
  detectCouplingIssues(nodes: Map<string, KnowledgeNode>, triads: Map<string, KnowledgeTriad>): Promise<ArchitecturalInsight[]>;
  detectRefactoringOpportunities(nodes: Map<string, KnowledgeNode>, triads: Map<string, KnowledgeTriad>): Promise<ArchitecturalInsight[]>;
}

export class ArchitecturalInsightDetector implements IArchitecturalInsightDetector {
  private logger = Logger.getInstance().child('ArchitecturalInsightDetector');

  async detectArchitecturalInsights(
    nodes: Map<string, KnowledgeNode>,
    triads: Map<string, KnowledgeTriad>
  ): Promise<ArchitecturalInsight[]> {
    const insights: ArchitecturalInsight[] = [];

    // Detect design patterns
    insights.push(...await this.detectDesignPatterns(nodes, triads));

    // Detect anti-patterns
    insights.push(...await this.detectAntiPatterns(nodes, triads));

    // Detect coupling issues
    insights.push(...await this.detectCouplingIssues(nodes, triads));

    // Detect refactoring opportunities
    insights.push(...await this.detectRefactoringOpportunities(nodes, triads));

    return insights;
  }

  async detectDesignPatterns(
    nodes: Map<string, KnowledgeNode>,
    triads: Map<string, KnowledgeTriad>
  ): Promise<ArchitecturalInsight[]> {
    const patterns: ArchitecturalInsight[] = [];

    // Detect Singleton Pattern
    patterns.push(...this.detectSingletonPattern(nodes, triads));

    // Detect Factory Pattern
    patterns.push(...this.detectFactoryPattern(nodes, triads));

    // Detect Observer Pattern
    patterns.push(...this.detectObserverPattern(nodes, triads));

    // Detect Strategy Pattern
    patterns.push(...this.detectStrategyPattern(nodes, triads));

    return patterns;
  }

  async detectAntiPatterns(
    nodes: Map<string, KnowledgeNode>,
    triads: Map<string, KnowledgeTriad>
  ): Promise<ArchitecturalInsight[]> {
    const antiPatterns: ArchitecturalInsight[] = [];

    // God Class - classes with too many responsibilities
    antiPatterns.push(...this.detectGodClassAntiPattern(nodes, triads));

    // Circular Dependencies
    antiPatterns.push(...this.detectCircularDependencies(nodes, triads));

    // Dead Code - unused classes/functions
    antiPatterns.push(...this.detectDeadCode(nodes, triads));

    // Feature Envy - classes that use other classes' data excessively
    antiPatterns.push(...this.detectFeatureEnvy(nodes, triads));

    return antiPatterns;
  }

  async detectCouplingIssues(
    nodes: Map<string, KnowledgeNode>,
    triads: Map<string, KnowledgeTriad>
  ): Promise<ArchitecturalInsight[]> {
    const couplingIssues: ArchitecturalInsight[] = [];

    // High Coupling - excessive dependencies
    couplingIssues.push(...this.detectHighCoupling(nodes, triads));

    // Inappropriate Intimacy - classes that know too much about each other
    couplingIssues.push(...this.detectInappropriateIntimacy(nodes, triads));

    return couplingIssues;
  }

  async detectRefactoringOpportunities(
    nodes: Map<string, KnowledgeNode>,
    triads: Map<string, KnowledgeTriad>
  ): Promise<ArchitecturalInsight[]> {
    const opportunities: ArchitecturalInsight[] = [];

    // Extract Interface opportunities
    opportunities.push(...this.detectExtractInterfaceOpportunities(nodes, triads));

    // Extract Class opportunities
    opportunities.push(...this.detectExtractClassOpportunities(nodes, triads));

    // Move Method opportunities
    opportunities.push(...this.detectMoveMethodOpportunities(nodes, triads));

    return opportunities;
  }

  private detectSingletonPattern(
    nodes: Map<string, KnowledgeNode>,
    triads: Map<string, KnowledgeTriad>
  ): ArchitecturalInsight[] {
    const singletons: ArchitecturalInsight[] = [];

    for (const node of nodes.values()) {
      if (node.type === NodeType.CLASS) {
        const hasPrivateConstructor = this.hasRelation(node.id, RelationType.HAS_METHOD, 'constructor', triads, true);
        const hasStaticInstance = this.hasRelation(node.id, RelationType.HAS_FIELD, 'instance', triads, true);
        const hasGetInstanceMethod = this.hasRelation(node.id, RelationType.HAS_METHOD, 'getInstance', triads, false);

        if (hasPrivateConstructor && hasStaticInstance && hasGetInstanceMethod) {
          singletons.push({
            type: 'design_pattern',
            pattern: 'Singleton',
            description: `Singleton pattern detected in class ${node.metadata?.name}`,
            confidence: 0.9,
            nodes: [node.id],
            recommendation: 'Ensure thread-safety and consider dependency injection alternatives',
            impact: 'medium'
          });
        }
      }
    }

    return singletons;
  }

  private detectFactoryPattern(
    nodes: Map<string, KnowledgeNode>,
    triads: Map<string, KnowledgeTriad>
  ): ArchitecturalInsight[] {
    const factories: ArchitecturalInsight[] = [];

    for (const node of nodes.values()) {
      if (node.type === NodeType.CLASS && node.metadata?.name?.toLowerCase().includes('factory')) {
        const createMethods = this.getRelatedNodes(node.id, RelationType.HAS_METHOD, triads)
          .filter(methodId => {
            const method = nodes.get(methodId);
            return method?.metadata?.name?.toLowerCase().startsWith('create');
          });

        if (createMethods.length > 0) {
          factories.push({
            type: 'design_pattern',
            pattern: 'Factory',
            description: `Factory pattern detected in class ${node.metadata?.name}`,
            confidence: 0.8,
            nodes: [node.id, ...createMethods],
            recommendation: 'Consider using dependency injection for better testability',
            impact: 'low'
          });
        }
      }
    }

    return factories;
  }

  private detectObserverPattern(
    nodes: Map<string, KnowledgeNode>,
    triads: Map<string, KnowledgeTriad>
  ): ArchitecturalInsight[] {
    const observers: ArchitecturalInsight[] = [];

    for (const node of nodes.values()) {
      if (node.type === NodeType.CLASS) {
        const hasObserverList = this.hasRelation(node.id, RelationType.HAS_FIELD, 'observers', triads, false) ||
                               this.hasRelation(node.id, RelationType.HAS_FIELD, 'listeners', triads, false);
        const hasNotifyMethod = this.hasRelation(node.id, RelationType.HAS_METHOD, 'notify', triads, false) ||
                               this.hasRelation(node.id, RelationType.HAS_METHOD, 'notifyObservers', triads, false);
        const hasAddObserverMethod = this.hasRelation(node.id, RelationType.HAS_METHOD, 'addObserver', triads, false) ||
                                    this.hasRelation(node.id, RelationType.HAS_METHOD, 'subscribe', triads, false);

        if (hasObserverList && hasNotifyMethod && hasAddObserverMethod) {
          observers.push({
            type: 'design_pattern',
            pattern: 'Observer',
            description: `Observer pattern detected in class ${node.metadata?.name}`,
            confidence: 0.85,
            nodes: [node.id],
            recommendation: 'Consider using modern event systems or reactive programming',
            impact: 'low'
          });
        }
      }
    }

    return observers;
  }

  private detectStrategyPattern(
    nodes: Map<string, KnowledgeNode>,
    triads: Map<string, KnowledgeTriad>
  ): ArchitecturalInsight[] {
    const strategies: ArchitecturalInsight[] = [];

    // Look for strategy interface/abstract class
    for (const node of nodes.values()) {
      if (node.type === NodeType.INTERFACE || node.type === NodeType.CLASS) {
        const implementations = this.getRelatedNodes(node.id, RelationType.IMPLEMENTS, triads, true);

        if (implementations.length >= 2) {
          // Check if there's a context class that uses this strategy
          const contexts = this.getNodesUsingStrategy(node.id, nodes, triads);

          if (contexts.length > 0) {
            strategies.push({
              type: 'design_pattern',
              pattern: 'Strategy',
              description: `Strategy pattern detected with ${implementations.length} implementations`,
              confidence: 0.8,
              nodes: [node.id, ...implementations, ...contexts],
              recommendation: 'Well-implemented strategy pattern promoting flexibility',
              impact: 'low'
            });
          }
        }
      }
    }

    return strategies;
  }

  private detectGodClassAntiPattern(
    nodes: Map<string, KnowledgeNode>,
    triads: Map<string, KnowledgeTriad>
  ): ArchitecturalInsight[] {
    const godClasses: ArchitecturalInsight[] = [];

    for (const node of nodes.values()) {
      if (node.type === NodeType.CLASS) {
        const methods = this.getRelatedNodes(node.id, RelationType.HAS_METHOD, triads);
        const fields = this.getRelatedNodes(node.id, RelationType.HAS_FIELD, triads);
        const dependencies = this.getRelatedNodes(node.id, RelationType.DEPENDS_ON, triads);

        // God class thresholds
        if (methods.length > 20 || fields.length > 15 || dependencies.length > 10) {
          godClasses.push({
            type: 'anti_pattern',
            pattern: 'God Class',
            description: `God class detected: ${node.metadata?.name} has ${methods.length} methods, ${fields.length} fields, ${dependencies.length} dependencies`,
            confidence: 0.9,
            nodes: [node.id],
            recommendation: 'Break down into smaller, more focused classes following Single Responsibility Principle',
            impact: 'high'
          });
        }
      }
    }

    return godClasses;
  }

  private detectCircularDependencies(
    nodes: Map<string, KnowledgeNode>,
    triads: Map<string, KnowledgeTriad>
  ): ArchitecturalInsight[] {
    const cycles: ArchitecturalInsight[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string, path: string[]): void => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId);
        const cycle = path.slice(cycleStart);

        cycles.push({
          type: 'anti_pattern',
          pattern: 'Circular Dependency',
          description: `Circular dependency detected: ${cycle.map(id => nodes.get(id)?.metadata?.name).join(' -> ')}`,
          confidence: 1.0,
          nodes: cycle,
          recommendation: 'Break the cycle using dependency inversion, interfaces, or restructuring',
          impact: 'high'
        });
        return;
      }

      if (visited.has(nodeId)) return;

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const dependencies = this.getRelatedNodes(nodeId, RelationType.DEPENDS_ON, triads);
      for (const depId of dependencies) {
        dfs(depId, [...path, depId]);
      }

      recursionStack.delete(nodeId);
    };

    for (const node of nodes.values()) {
      if (!visited.has(node.id)) {
        dfs(node.id, [node.id]);
      }
    }

    return cycles;
  }

  private detectDeadCode(
    nodes: Map<string, KnowledgeNode>,
    triads: Map<string, KnowledgeTriad>
  ): ArchitecturalInsight[] {
    const deadCode: ArchitecturalInsight[] = [];

    for (const node of nodes.values()) {
      if (node.type === NodeType.CLASS || node.type === NodeType.FUNCTION) {
        // Check if the node is used by others
        const usages = this.getNodesUsing(node.id, triads);

        if (usages.length === 0 && !this.isEntryPoint(node)) {
          deadCode.push({
            type: 'anti_pattern',
            pattern: 'Dead Code',
            description: `Unused ${node.type.toLowerCase()}: ${node.metadata?.name}`,
            confidence: 0.8,
            nodes: [node.id],
            recommendation: 'Remove unused code or verify if it should be used',
            impact: 'medium'
          });
        }
      }
    }

    return deadCode;
  }

  private detectFeatureEnvy(
    nodes: Map<string, KnowledgeNode>,
    triads: Map<string, KnowledgeTriad>
  ): ArchitecturalInsight[] {
    const featureEnvy: ArchitecturalInsight[] = [];

    for (const node of nodes.values()) {
      if (node.type === NodeType.METHOD) {
        const usedClasses = this.getUsedClasses(node.id, triads);
        const ownClass = this.getOwningClass(node.id, triads);

        // If method uses more external classes than its own class
        const externalUsage = usedClasses.filter(classId => classId !== ownClass).length;
        const ownUsage = usedClasses.filter(classId => classId === ownClass).length;

        if (externalUsage > ownUsage && externalUsage > 3) {
          featureEnvy.push({
            type: 'anti_pattern',
            pattern: 'Feature Envy',
            description: `Method ${node.metadata?.name} uses external classes more than its own`,
            confidence: 0.7,
            nodes: [node.id],
            recommendation: 'Consider moving method to the class it uses most or extracting shared behavior',
            impact: 'medium'
          });
        }
      }
    }

    return featureEnvy;
  }

  private detectHighCoupling(
    nodes: Map<string, KnowledgeNode>,
    triads: Map<string, KnowledgeTriad>
  ): ArchitecturalInsight[] {
    const highCoupling: ArchitecturalInsight[] = [];

    for (const node of nodes.values()) {
      if (node.type === NodeType.CLASS) {
        const dependencies = this.getRelatedNodes(node.id, RelationType.DEPENDS_ON, triads);

        if (dependencies.length > 8) {
          highCoupling.push({
            type: 'coupling_issue',
            pattern: 'High Coupling',
            description: `Class ${node.metadata?.name} has ${dependencies.length} dependencies`,
            confidence: 0.8,
            nodes: [node.id, ...dependencies],
            recommendation: 'Reduce dependencies using dependency injection, interfaces, or service locator pattern',
            impact: 'high'
          });
        }
      }
    }

    return highCoupling;
  }

  private detectInappropriateIntimacy(
    nodes: Map<string, KnowledgeNode>,
    triads: Map<string, KnowledgeTriad>
  ): ArchitecturalInsight[] {
    const intimacyIssues: ArchitecturalInsight[] = [];

    for (const node of nodes.values()) {
      if (node.type === NodeType.CLASS) {
        const accessedClasses = this.getAccessedClasses(node.id, triads);

        for (const [accessedClassId, accessCount] of accessedClasses.entries()) {
          if (accessCount > 5) {
            intimacyIssues.push({
              type: 'coupling_issue',
              pattern: 'Inappropriate Intimacy',
              description: `Class ${node.metadata?.name} accesses ${accessCount} members of ${nodes.get(accessedClassId)?.metadata?.name}`,
              confidence: 0.7,
              nodes: [node.id, accessedClassId],
              recommendation: 'Extract common behavior, use composition, or merge classes if appropriate',
              impact: 'medium'
            });
          }
        }
      }
    }

    return intimacyIssues;
  }

  private detectExtractInterfaceOpportunities(
    nodes: Map<string, KnowledgeNode>,
    triads: Map<string, KnowledgeTriad>
  ): ArchitecturalInsight[] {
    const opportunities: ArchitecturalInsight[] = [];

    // Find classes with similar method signatures
    const methodSignatures = new Map<string, string[]>();

    for (const node of nodes.values()) {
      if (node.type === NodeType.CLASS) {
        const methods = this.getRelatedNodes(node.id, RelationType.HAS_METHOD, triads);
        const signatures = methods.map(methodId => {
          const method = nodes.get(methodId);
          return method?.metadata?.signature || method?.metadata?.name || '';
        }).filter(sig => sig);

        methodSignatures.set(node.id, signatures);
      }
    }

    // Find classes with common method signatures
    for (const [classId1, signatures1] of methodSignatures.entries()) {
      for (const [classId2, signatures2] of methodSignatures.entries()) {
        if (classId1 !== classId2) {
          const commonSignatures = signatures1.filter(sig => signatures2.includes(sig));

          if (commonSignatures.length >= 3) {
            opportunities.push({
              type: 'refactoring_opportunity',
              pattern: 'Extract Interface',
              description: `Classes ${nodes.get(classId1)?.metadata?.name} and ${nodes.get(classId2)?.metadata?.name} share ${commonSignatures.length} method signatures`,
              confidence: 0.8,
              nodes: [classId1, classId2],
              recommendation: 'Extract common interface to improve polymorphism and testability',
              impact: 'medium'
            });
          }
        }
      }
    }

    return opportunities;
  }

  private detectExtractClassOpportunities(
    nodes: Map<string, KnowledgeNode>,
    triads: Map<string, KnowledgeTriad>
  ): ArchitecturalInsight[] {
    const opportunities: ArchitecturalInsight[] = [];

    for (const node of nodes.values()) {
      if (node.type === NodeType.CLASS) {
        const methods = this.getRelatedNodes(node.id, RelationType.HAS_METHOD, triads);
        const fields = this.getRelatedNodes(node.id, RelationType.HAS_FIELD, triads);

        // Look for groups of methods that work with specific fields
        const methodGroups = this.groupMethodsByFields(node.id, methods, fields, triads, nodes);

        for (const group of methodGroups) {
          if (group.methods.length >= 3 && group.fields.length >= 2) {
            opportunities.push({
              type: 'refactoring_opportunity',
              pattern: 'Extract Class',
              description: `Class ${node.metadata?.name} has a cohesive group of ${group.methods.length} methods working with ${group.fields.length} fields`,
              confidence: 0.7,
              nodes: [node.id, ...group.methods, ...group.fields],
              recommendation: 'Extract these related methods and fields into a separate class',
              impact: 'medium'
            });
          }
        }
      }
    }

    return opportunities;
  }

  private detectMoveMethodOpportunities(
    nodes: Map<string, KnowledgeNode>,
    triads: Map<string, KnowledgeTriad>
  ): ArchitecturalInsight[] {
    const opportunities: ArchitecturalInsight[] = [];

    for (const node of nodes.values()) {
      if (node.type === NodeType.METHOD) {
        const ownClass = this.getOwningClass(node.id, triads);
        const usedClasses = this.getUsedClasses(node.id, triads);

        // Find the most used external class
        const externalUsage = new Map<string, number>();
        for (const classId of usedClasses) {
          if (classId !== ownClass) {
            externalUsage.set(classId, (externalUsage.get(classId) || 0) + 1);
          }
        }

        const ownUsage = usedClasses.filter(classId => classId === ownClass).length;

        for (const [externalClassId, usage] of externalUsage.entries()) {
          if (usage > ownUsage && usage >= 3) {
            opportunities.push({
              type: 'refactoring_opportunity',
              pattern: 'Move Method',
              description: `Method ${node.metadata?.name} uses ${nodes.get(externalClassId)?.metadata?.name} more than its own class`,
              confidence: 0.7,
              nodes: [node.id, ownClass!, externalClassId],
              recommendation: 'Consider moving this method to the class it uses most',
              impact: 'low'
            });
          }
        }
      }
    }

    return opportunities;
  }

  // Helper methods
  private hasRelation(
    nodeId: string,
    relationType: RelationType,
    targetName: string,
    triads: Map<string, KnowledgeTriad>,
    isPrivate?: boolean
  ): boolean {
    for (const triad of triads.values()) {
      if (triad.subject === nodeId && triad.predicate === relationType) {
        const targetNode = triads.get(triad.object);
        if (targetNode?.metadata?.name?.toLowerCase().includes(targetName.toLowerCase())) {
          if (isPrivate === undefined) return true;
          return (targetNode.metadata?.visibility === 'private') === isPrivate;
        }
      }
    }
    return false;
  }

  private getRelatedNodes(
    nodeId: string,
    relationType: RelationType,
    triads: Map<string, KnowledgeTriad>,
    reverse = false
  ): string[] {
    const related: string[] = [];

    for (const triad of triads.values()) {
      if (reverse) {
        if (triad.object === nodeId && triad.predicate === relationType) {
          related.push(triad.subject);
        }
      } else {
        if (triad.subject === nodeId && triad.predicate === relationType) {
          related.push(triad.object);
        }
      }
    }

    return related;
  }

  private getNodesUsing(nodeId: string, triads: Map<string, KnowledgeTriad>): string[] {
    const using: string[] = [];

    for (const triad of triads.values()) {
      if (triad.object === nodeId &&
          (triad.predicate === RelationType.USES ||
           triad.predicate === RelationType.CALLS ||
           triad.predicate === RelationType.DEPENDS_ON)) {
        using.push(triad.subject);
      }
    }

    return using;
  }

  private getNodesUsingStrategy(
    strategyId: string,
    nodes: Map<string, KnowledgeNode>,
    triads: Map<string, KnowledgeTriad>
  ): string[] {
    const contexts: string[] = [];

    for (const node of nodes.values()) {
      if (node.type === NodeType.CLASS) {
        const dependencies = this.getRelatedNodes(node.id, RelationType.DEPENDS_ON, triads);
        if (dependencies.includes(strategyId)) {
          contexts.push(node.id);
        }
      }
    }

    return contexts;
  }

  private isEntryPoint(node: KnowledgeNode): boolean {
    // Check if this is a main method, public API, or similar entry point
    const name = node.metadata?.name?.toLowerCase() || '';
    return name.includes('main') ||
           name.includes('public') ||
           node.metadata?.isPublic === true ||
           node.metadata?.isExported === true;
  }

  private getUsedClasses(methodId: string, triads: Map<string, KnowledgeTriad>): string[] {
    const usedClasses = new Set<string>();

    for (const triad of triads.values()) {
      if (triad.subject === methodId && triad.predicate === RelationType.USES) {
        // Find the class that owns the used entity
        const owningClass = this.getOwningClass(triad.object, triads);
        if (owningClass) {
          usedClasses.add(owningClass);
        }
      }
    }

    return Array.from(usedClasses);
  }

  private getOwningClass(nodeId: string, triads: Map<string, KnowledgeTriad>): string | null {
    for (const triad of triads.values()) {
      if (triad.object === nodeId &&
          (triad.predicate === RelationType.HAS_METHOD ||
           triad.predicate === RelationType.HAS_FIELD)) {
        return triad.subject;
      }
    }
    return null;
  }

  private getAccessedClasses(classId: string, triads: Map<string, KnowledgeTriad>): Map<string, number> {
    const accessCounts = new Map<string, number>();

    const methods = this.getRelatedNodes(classId, RelationType.HAS_METHOD, triads);

    for (const methodId of methods) {
      const usedClasses = this.getUsedClasses(methodId, triads);
      for (const usedClassId of usedClasses) {
        if (usedClassId !== classId) {
          accessCounts.set(usedClassId, (accessCounts.get(usedClassId) || 0) + 1);
        }
      }
    }

    return accessCounts;
  }

  private groupMethodsByFields(
    classId: string,
    methods: string[],
    fields: string[],
    triads: Map<string, KnowledgeTriad>,
    nodes: Map<string, KnowledgeNode>
  ): Array<{ methods: string[], fields: string[] }> {
    const groups: Array<{ methods: string[], fields: string[] }> = [];
    const processedMethods = new Set<string>();

    for (const fieldId of fields) {
      const relatedMethods = methods.filter(methodId => {
        if (processedMethods.has(methodId)) return false;

        // Check if method uses this field
        for (const triad of triads.values()) {
          if (triad.subject === methodId && triad.object === fieldId &&
              triad.predicate === RelationType.USES) {
            return true;
          }
        }
        return false;
      });

      if (relatedMethods.length >= 2) {
        // Find other fields used by these methods
        const relatedFields = [fieldId];
        for (const methodId of relatedMethods) {
          for (const triad of triads.values()) {
            if (triad.subject === methodId && triad.predicate === RelationType.USES &&
                fields.includes(triad.object) && !relatedFields.includes(triad.object)) {
              relatedFields.push(triad.object);
            }
          }
        }

        groups.push({
          methods: relatedMethods,
          fields: relatedFields
        });

        relatedMethods.forEach(methodId => processedMethods.add(methodId));
      }
    }

    return groups;
  }
}