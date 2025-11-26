/**
 * Refactoring Advisor Service
 * SOLID Principles: Single Responsibility - Handle refactoring advice generation only
 */

import { Logger } from '../../../../utils/logger';
import {
  IRefactoringAdvisorService,
  DuplicationGroup,
  RefactoringAdvice,
  RefactoringApproach,
  EffortEstimate,
  RefactoringImpact,
  DuplicationType
} from '../interfaces/index';

export class RefactoringAdvisorService implements IRefactoringAdvisorService {
  private logger = Logger.getInstance();

  generateRefactoringAdvice(group: DuplicationGroup): RefactoringAdvice {
    try {
      const approach = this.determineRefactoringApproach(group);
      const description = this.generateDescription(group, approach);
      const steps = this.generateRefactoringSteps(group, approach);
      const example = this.generateExample(group, approach);
      const estimatedEffort = this.estimateRefactoringEffort(group);
      const impact = this.calculateRefactoringImpact(group);

      const advice: RefactoringAdvice = {
        approach,
        description,
        estimatedEffort,
        steps,
        example,
        impact
      };

      this.logger.debug(`Generated refactoring advice for duplicate group ${group.id}: ${approach}`);
      return advice;

    } catch (error) {
      this.logger.error(`Failed to generate refactoring advice for group ${group.id}:`, error);
      return this.getDefaultAdvice();
    }
  }

  estimateRefactoringEffort(group: DuplicationGroup): EffortEstimate {
    try {
      const factors = this.analyzeEffortFactors(group);
      const baseEffort = this.calculateBaseEffort(group);
      const complexityMultiplier = this.getComplexityMultiplier(group);
      const riskMultiplier = this.getRiskMultiplier(group);

      const totalEffortScore = baseEffort * complexityMultiplier * riskMultiplier;

      if (totalEffortScore <= 1) return EffortEstimate.LOW;
      if (totalEffortScore <= 3) return EffortEstimate.MEDIUM;
      if (totalEffortScore <= 6) return EffortEstimate.HIGH;
      return EffortEstimate.VERY_HIGH;

    } catch (error) {
      this.logger.error(`Failed to estimate refactoring effort:`, error);
      return EffortEstimate.MEDIUM;
    }
  }

  calculateRefactoringImpact(group: DuplicationGroup): RefactoringImpact {
    try {
      const maintainability = this.calculateMaintainabilityImpact(group);
      const testability = this.calculateTestabilityImpact(group);
      const reusability = this.calculateReusabilityImpact(group);
      const riskLevel = this.calculateRiskLevel(group);

      return {
        maintainability,
        testability,
        reusability,
        riskLevel
      };

    } catch (error) {
      this.logger.error(`Failed to calculate refactoring impact:`, error);
      return {
        maintainability: 50,
        testability: 50,
        reusability: 50,
        riskLevel: 50
      };
    }
  }

  private determineRefactoringApproach(group: DuplicationGroup): RefactoringApproach {
    // Determine approach based on duplication type and characteristics
    const linesOfCode = group.metadata.linesOfCode;
    const complexity = group.metadata.complexity;
    const locationCount = group.locations.length;

    switch (group.type) {
      case DuplicationType.EXACT:
        if (linesOfCode < 50 && complexity < 3) {
          return RefactoringApproach.EXTRACT_FUNCTION;
        } else if (linesOfCode > 100 || complexity > 5) {
          return RefactoringApproach.EXTRACT_CLASS;
        } else {
          return RefactoringApproach.EXTRACT_UTILITY;
        }

      case DuplicationType.STRUCTURAL:
        if (this.hasClassStructure(group)) {
          return RefactoringApproach.USE_INHERITANCE;
        } else if (complexity > 4) {
          return RefactoringApproach.APPLY_STRATEGY_PATTERN;
        } else {
          return RefactoringApproach.EXTRACT_FUNCTION;
        }

      case DuplicationType.SEMANTIC:
        if (this.appearsToBeConfiguration(group)) {
          return RefactoringApproach.CONSOLIDATE_CONFIGURATION;
        } else if (complexity > 3) {
          return RefactoringApproach.APPLY_STRATEGY_PATTERN;
        } else {
          return RefactoringApproach.EXTRACT_FUNCTION;
        }

      case DuplicationType.RENAMED:
        if (linesOfCode > 100) {
          return RefactoringApproach.EXTRACT_CLASS;
        } else {
          return RefactoringApproach.EXTRACT_FUNCTION;
        }

      default:
        return RefactoringApproach.EXTRACT_FUNCTION;
    }
  }

  private generateDescription(group: DuplicationGroup, approach: RefactoringApproach): string {
    const typeDescription = this.getTypeDescription(group.type);
    const approachDescription = this.getApproachDescription(approach);

    return `This ${typeDescription} duplication can be resolved by ${approachDescription}. ` +
           `The duplicated code appears in ${group.locations.length} locations with ` +
           `${group.metadata.linesOfCode} total lines of code.`;
  }

  private generateRefactoringSteps(group: DuplicationGroup, approach: RefactoringApproach): string[] {
    const baseSteps = this.getBaseSteps(approach);
    const specificSteps = this.getGroupSpecificSteps(group, approach);

    return [...baseSteps, ...specificSteps];
  }

  private generateExample(group: DuplicationGroup, approach: RefactoringApproach): string {
    const firstLocation = group.locations[0];
    const snippet = firstLocation.codeSnippet.substring(0, 150) + '...';

    switch (approach) {
      case RefactoringApproach.EXTRACT_FUNCTION:
        return `// Before:\n${snippet}\n\n// After:\nfunction extractedFunction() {\n  // Extracted common logic\n}`;

      case RefactoringApproach.EXTRACT_CLASS:
        return `// Before:\n${snippet}\n\n// After:\nclass ExtractedClass {\n  // Common functionality\n}`;

      case RefactoringApproach.EXTRACT_UTILITY:
        return `// Before:\n${snippet}\n\n// After:\nclass Utility {\n  static commonMethod() {\n    // Shared utility logic\n  }\n}`;

      case RefactoringApproach.USE_INHERITANCE:
        return `// Before:\n${snippet}\n\n// After:\nclass BaseClass {\n  // Common behavior\n}\nclass SpecificClass extends BaseClass {}`;

      case RefactoringApproach.APPLY_STRATEGY_PATTERN:
        return `// Before:\n${snippet}\n\n// After:\ninterface Strategy {\n  execute(): void;\n}\nclass ConcreteStrategy implements Strategy {}`;

      case RefactoringApproach.CONSOLIDATE_CONFIGURATION:
        return `// Before:\n${snippet}\n\n// After:\nconst CONFIG = {\n  // Consolidated configuration\n};`;

      default:
        return `// Refactor the duplicated code in ${firstLocation.file}`;
    }
  }

  private analyzeEffortFactors(group: DuplicationGroup): any {
    return {
      linesOfCode: group.metadata.linesOfCode,
      complexity: group.metadata.complexity,
      locationCount: group.locations.length,
      similarityScore: group.similarity,
      crossFileSpread: this.getCrossFileSpread(group)
    };
  }

  private calculateBaseEffort(group: DuplicationGroup): number {
    const linesOfCode = group.metadata.linesOfCode;
    const locations = group.locations.length;

    // Base effort increases with lines of code and number of locations
    let effort = 0.5; // Base minimum

    if (linesOfCode > 20) effort += 0.5;
    if (linesOfCode > 100) effort += 1;
    if (linesOfCode > 300) effort += 2;

    if (locations > 2) effort += 0.5;
    if (locations > 5) effort += 1;
    if (locations > 10) effort += 2;

    return effort;
  }

  private getComplexityMultiplier(group: DuplicationGroup): number {
    const complexity = group.metadata.complexity;

    if (complexity <= 2) return 1.0;
    if (complexity <= 4) return 1.3;
    if (complexity <= 6) return 1.7;
    return 2.0;
  }

  private getRiskMultiplier(group: DuplicationGroup): number {
    const crossFileSpread = this.getCrossFileSpread(group);
    const hasCriticalPaths = this.hasCriticalPaths(group);

    let multiplier = 1.0;

    if (crossFileSpread > 3) multiplier += 0.3;
    if (crossFileSpread > 7) multiplier += 0.5;

    if (hasCriticalPaths) multiplier += 0.4;

    return multiplier;
  }

  private calculateMaintainabilityImpact(group: DuplicationGroup): number {
    // Higher duplication = higher maintainability gain from refactoring
    const baseImpact = Math.min(90, 30 + group.metadata.linesOfCode * 0.3);
    const locationBonus = Math.min(30, group.locations.length * 5);

    return Math.round(baseImpact + locationBonus);
  }

  private calculateTestabilityImpact(group: DuplicationGroup): number {
    // Extracting functions/classes usually improves testability
    const baseImpact = 40;
    const complexityBonus = Math.min(30, group.metadata.complexity * 8);

    return Math.round(baseImpact + complexityBonus);
  }

  private calculateReusabilityImpact(group: DuplicationGroup): number {
    // More locations = higher reusability potential
    const baseImpact = 35;
    const locationBonus = Math.min(40, group.locations.length * 8);
    const similarityBonus = Math.round(group.similarity * 25);

    return Math.round(baseImpact + locationBonus + similarityBonus);
  }

  private calculateRiskLevel(group: DuplicationGroup): number {
    // Risk decreases with higher similarity and fewer cross-file dependencies
    let risk = 30; // Base risk

    if (group.similarity < 0.8) risk += 20;
    if (group.metadata.complexity > 5) risk += 15;
    if (this.getCrossFileSpread(group) > 5) risk += 20;
    if (this.hasCriticalPaths(group)) risk += 15;

    return Math.min(100, risk);
  }

  private hasClassStructure(group: DuplicationGroup): boolean {
    return group.locations.some(loc =>
      loc.codeSnippet.includes('class ') || loc.codeSnippet.includes('interface ')
    );
  }

  private appearsToBeConfiguration(group: DuplicationGroup): boolean {
    return group.locations.some(loc => {
      const snippet = loc.codeSnippet.toLowerCase();
      return snippet.includes('config') || snippet.includes('setting') ||
             snippet.includes('option') || snippet.includes('constant');
    });
  }

  private getCrossFileSpread(group: DuplicationGroup): number {
    const uniqueFiles = new Set(group.locations.map(loc => loc.file));
    return uniqueFiles.size;
  }

  private hasCriticalPaths(group: DuplicationGroup): boolean {
    // Simple heuristic: files with 'main', 'index', 'app', or 'core' might be critical
    return group.locations.some(loc => {
      const fileName = loc.file.toLowerCase();
      return fileName.includes('main') || fileName.includes('index') ||
             fileName.includes('app') || fileName.includes('core');
    });
  }

  private getTypeDescription(type: DuplicationType): string {
    switch (type) {
      case DuplicationType.EXACT: return 'exact';
      case DuplicationType.STRUCTURAL: return 'structural';
      case DuplicationType.SEMANTIC: return 'semantic';
      case DuplicationType.RENAMED: return 'renamed variable';
      default: return 'unknown';
    }
  }

  private getApproachDescription(approach: RefactoringApproach): string {
    switch (approach) {
      case RefactoringApproach.EXTRACT_FUNCTION:
        return 'extracting the common code into a reusable function';
      case RefactoringApproach.EXTRACT_CLASS:
        return 'creating a new class to encapsulate the shared functionality';
      case RefactoringApproach.EXTRACT_UTILITY:
        return 'moving the code to a utility class or module';
      case RefactoringApproach.USE_INHERITANCE:
        return 'using inheritance to share common behavior';
      case RefactoringApproach.APPLY_STRATEGY_PATTERN:
        return 'applying the strategy pattern to handle variations';
      case RefactoringApproach.CONSOLIDATE_CONFIGURATION:
        return 'consolidating configuration values into a single location';
      default:
        return 'applying appropriate refactoring techniques';
    }
  }

  private getBaseSteps(approach: RefactoringApproach): string[] {
    switch (approach) {
      case RefactoringApproach.EXTRACT_FUNCTION:
        return [
          'Identify the common code logic across all duplicated locations',
          'Create a new function with appropriate parameters',
          'Replace each duplicate with a call to the new function',
          'Ensure all tests pass after the change'
        ];

      case RefactoringApproach.EXTRACT_CLASS:
        return [
          'Analyze the duplicated code to identify cohesive functionality',
          'Design a new class interface that captures the common behavior',
          'Implement the new class with the extracted logic',
          'Update all duplicate locations to use the new class',
          'Verify functionality and update tests'
        ];

      case RefactoringApproach.EXTRACT_UTILITY:
        return [
          'Create a utility class or module for the shared functionality',
          'Move the common code to static methods in the utility',
          'Replace duplicate code with utility method calls',
          'Update imports and dependencies'
        ];

      case RefactoringApproach.USE_INHERITANCE:
        return [
          'Design a base class that captures common behavior',
          'Identify what should remain specific to each subclass',
          'Implement the base class with common methods',
          'Refactor existing classes to extend the base class'
        ];

      case RefactoringApproach.APPLY_STRATEGY_PATTERN:
        return [
          'Define a strategy interface for the varying behavior',
          'Implement concrete strategies for each variation',
          'Create a context class that uses the strategy',
          'Replace duplicate code with strategy pattern usage'
        ];

      case RefactoringApproach.CONSOLIDATE_CONFIGURATION:
        return [
          'Identify all configuration values in the duplicated code',
          'Create a centralized configuration file or class',
          'Replace hardcoded values with configuration references',
          'Ensure consistency across all usage locations'
        ];

      default:
        return [
          'Analyze the duplicated code patterns',
          'Design an appropriate solution',
          'Implement the refactoring',
          'Test the changes thoroughly'
        ];
    }
  }

  private getGroupSpecificSteps(group: DuplicationGroup, approach: RefactoringApproach): string[] {
    const specificSteps: string[] = [];

    // Add steps based on the specific characteristics of this group
    if (this.getCrossFileSpread(group) > 3) {
      specificSteps.push('Consider the impact on multiple files and coordinate changes');
    }

    if (group.metadata.complexity > 5) {
      specificSteps.push('Pay special attention to complex logic during extraction');
    }

    if (group.locations.length > 5) {
      specificSteps.push('Update multiple locations carefully to avoid breaking functionality');
    }

    return specificSteps;
  }

  private getDefaultAdvice(): RefactoringAdvice {
    return {
      approach: RefactoringApproach.EXTRACT_FUNCTION,
      description: 'Consider extracting common functionality to reduce duplication.',
      estimatedEffort: EffortEstimate.MEDIUM,
      steps: [
        'Analyze the duplicated code',
        'Design an appropriate solution',
        'Implement the refactoring',
        'Test thoroughly'
      ],
      impact: {
        maintainability: 50,
        testability: 50,
        reusability: 50,
        riskLevel: 50
      }
    };
  }
}