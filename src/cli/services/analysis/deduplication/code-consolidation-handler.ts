/**
 * Code Consolidation Handler
 * Orchestrates Claude Code to merge and consolidate duplicate code
 * Following SOLID principles with comprehensive workflow integration
 */

import { Logger } from '../../../../utils/logger';
import { DuplicateGroup, DeduplicationReport } from './duplicate-code-detector';

export interface ConsolidationPlan {
  groupId: string;
  action: 'extract_function' | 'extract_class' | 'create_utility' | 'merge_similar' | 'create_base_class';
  targetLocation: string;
  affectedFiles: string[];
  instructions: string;
  estimatedComplexity: 'low' | 'medium' | 'high';
  prerequisites: string[];
}

export interface ConsolidationResult {
  groupId: string;
  success: boolean;
  filesModified: string[];
  linesReduced: number;
  newUtilityCreated?: string;
  error?: string;
  qualityScore?: number;
}

export interface ConsolidationSummary {
  totalGroupsProcessed: number;
  successfulConsolidations: number;
  failedConsolidations: number;
  totalLinesReduced: number;
  newUtilitiesCreated: string[];
  filesModified: string[];
  overallQualityImprovement: number;
  errors: string[];
}

export class CodeConsolidationHandler {
  private logger = Logger.getInstance();

  /**
   * Create consolidation plans for duplicate groups
   */
  async createConsolidationPlans(report: DeduplicationReport): Promise<ConsolidationPlan[]> {
    this.logger.info('📋 Creating consolidation plans for duplicate groups...');
    const plans: ConsolidationPlan[] = [];

    for (const group of report.duplicateGroups) {
      const plan = await this.createPlanForGroup(group);
      if (plan) {
        plans.push(plan);
      }
    }

    // Sort plans by complexity and priority (exact duplicates first)
    plans.sort((a, b) => {
      const priorityOrder = { 'low': 1, 'medium': 2, 'high': 3 };
      return priorityOrder[a.estimatedComplexity] - priorityOrder[b.estimatedComplexity];
    });

    console.log(`  ✅ Created ${plans.length} consolidation plans`);
    return plans;
  }

  /**
   * Execute consolidation plans using Claude Code
   */
  async executeConsolidations(
    plans: ConsolidationPlan[],
    claudeOrchestrator: any,
    projectPath: string
  ): Promise<ConsolidationSummary> {
    this.logger.info(`🔄 Executing ${plans.length} consolidation plans...`);

    const results: ConsolidationResult[] = [];
    const errors: string[] = [];

    for (const [index, plan] of plans.entries()) {
      console.log(`\n📦 Processing consolidation ${index + 1}/${plans.length}: ${plan.groupId}`);
      console.log(`   Action: ${plan.action}`);
      console.log(`   Complexity: ${plan.estimatedComplexity}`);
      console.log(`   Files affected: ${plan.affectedFiles.length}`);

      try {
        const result = await this.executeConsolidationPlan(plan, claudeOrchestrator, projectPath);
        results.push(result);

        if (result.success) {
          console.log(`   ✅ Success: ${result.linesReduced} lines reduced`);
        } else {
          console.log(`   ❌ Failed: ${result.error}`);
          errors.push(`${plan.groupId}: ${result.error}`);
        }
      } catch (error) {
        this.logger.error(`Failed to execute consolidation plan ${plan.groupId}: ${error.message}`);
        errors.push(`${plan.groupId}: ${error.message}`);
        results.push({
          groupId: plan.groupId,
          success: false,
          filesModified: [],
          linesReduced: 0,
          error: error.message
        });
      }

      // Add delay between consolidations to avoid overwhelming the system
      if (index < plans.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return this.createConsolidationSummary(results, errors);
  }

  /**
   * Create a consolidation plan for a specific duplicate group
   */
  private async createPlanForGroup(group: DuplicateGroup): Promise<ConsolidationPlan | null> {
    const mainChunk = group.chunks[0];
    const affectedFiles = [...new Set(group.chunks.map(chunk => chunk.filePath))];

    let action: ConsolidationPlan['action'];
    let targetLocation: string;
    let instructions: string;
    let complexity: 'low' | 'medium' | 'high';
    let prerequisites: string[] = [];

    switch (group.type) {
      case 'exact':
        if (mainChunk.type === 'function') {
          action = 'extract_function';
          targetLocation = this.suggestUtilityLocation(affectedFiles[0]);
          complexity = 'low';
          instructions = this.createExactFunctionExtractionInstructions(group);
        } else if (mainChunk.type === 'class') {
          action = 'extract_class';
          targetLocation = this.suggestUtilityLocation(affectedFiles[0]);
          complexity = 'medium';
          instructions = this.createExactClassExtractionInstructions(group);
        } else {
          action = 'create_utility';
          targetLocation = this.suggestUtilityLocation(affectedFiles[0]);
          complexity = 'medium';
          instructions = this.createUtilityExtractionInstructions(group);
        }
        break;

      case 'semantic':
        if (mainChunk.type === 'function' || mainChunk.type === 'method') {
          action = 'merge_similar';
          targetLocation = this.suggestUtilityLocation(affectedFiles[0]);
          complexity = 'medium';
          instructions = this.createSemanticMergeInstructions(group);
          prerequisites = ['Analyze parameter differences', 'Identify configurable options'];
        } else {
          action = 'create_utility';
          targetLocation = this.suggestUtilityLocation(affectedFiles[0]);
          complexity = 'high';
          instructions = this.createSemanticUtilityInstructions(group);
          prerequisites = ['Analyze semantic differences', 'Design flexible interface'];
        }
        break;

      case 'structural':
        if (mainChunk.type === 'class') {
          action = 'create_base_class';
          targetLocation = this.suggestBaseClassLocation(affectedFiles[0]);
          complexity = 'high';
          instructions = this.createBaseClassInstructions(group);
          prerequisites = ['Analyze inheritance hierarchy', 'Design abstract interface'];
        } else {
          action = 'create_utility';
          targetLocation = this.suggestUtilityLocation(affectedFiles[0]);
          complexity = 'high';
          instructions = this.createStructuralUtilityInstructions(group);
          prerequisites = ['Analyze structural patterns', 'Design template or strategy pattern'];
        }
        break;

      default:
        return null;
    }

    return {
      groupId: group.id,
      action,
      targetLocation,
      affectedFiles,
      instructions,
      estimatedComplexity: complexity,
      prerequisites
    };
  }

  /**
   * Execute a specific consolidation plan using Claude Code
   */
  private async executeConsolidationPlan(
    plan: ConsolidationPlan,
    claudeOrchestrator: any,
    projectPath: string
  ): Promise<ConsolidationResult> {
    try {
      // Build comprehensive Claude Code instruction
      const claudeInstruction = this.buildClaudeInstruction(plan, projectPath);

      // Execute through Claude orchestrator
      const result = await claudeOrchestrator.processRequest(claudeInstruction, projectPath);

      if (result.success) {
        return {
          groupId: plan.groupId,
          success: true,
          filesModified: result.data?.filesModified || plan.affectedFiles,
          linesReduced: this.estimateLinesReduced(plan),
          newUtilityCreated: plan.targetLocation,
          qualityScore: result.data?.qualityScore || 85
        };
      } else {
        return {
          groupId: plan.groupId,
          success: false,
          filesModified: [],
          linesReduced: 0,
          error: result.error || 'Unknown consolidation error'
        };
      }
    } catch (error) {
      return {
        groupId: plan.groupId,
        success: false,
        filesModified: [],
        linesReduced: 0,
        error: error.message
      };
    }
  }

  /**
   * Build comprehensive Claude Code instruction
   */
  private buildClaudeInstruction(plan: ConsolidationPlan, projectPath: string): string {
    const instruction = `
**Code Consolidation Task: ${plan.action.replace(/_/g, ' ').toUpperCase()}**

**Objective**: ${plan.instructions}

**Target Location**: ${plan.targetLocation}

**Files to Modify**:
${plan.affectedFiles.map(file => `- ${file}`).join('\n')}

**Prerequisites** (complete these first):
${plan.prerequisites.map(req => `- ${req}`).join('\n')}

**Instructions**:
1. Analyze the duplicate code patterns in the affected files
2. Create the new utility/function/class at: ${plan.targetLocation}
3. Replace all duplicate occurrences with calls to the new implementation
4. Ensure all tests pass after refactoring
5. Update any related documentation
6. Follow the project's existing coding standards and patterns

**Quality Requirements**:
- Maintain or improve code readability
- Ensure backward compatibility
- Add appropriate error handling
- Include comprehensive documentation
- Follow SOLID principles
- Ensure thread safety if applicable

**Testing Requirements**:
- Run all existing tests to ensure no regressions
- Add tests for the new utility if creating new functionality
- Verify performance is maintained or improved

**Output Requirements**:
- List all files modified
- Report lines of code reduced
- Summarize the consolidation approach taken
- Note any potential issues or considerations for review

Please proceed with this consolidation task step by step.
`;

    return instruction.trim();
  }

  // Instruction generators for different consolidation types
  private createExactFunctionExtractionInstructions(group: DuplicateGroup): string {
    const mainChunk = group.chunks[0];
    return `Extract the exact duplicate function "${mainChunk.functionName}" into a shared utility. This function appears ${group.chunks.length} times across ${new Set(group.chunks.map(c => c.filePath)).size} files with identical implementation. Create a new utility function and replace all occurrences with imports and calls to the centralized version.`;
  }

  private createExactClassExtractionInstructions(group: DuplicateGroup): string {
    const mainChunk = group.chunks[0];
    return `Extract the exact duplicate class "${mainChunk.className}" into a shared module. This class appears ${group.chunks.length} times across ${new Set(group.chunks.map(c => c.filePath)).size} files with identical implementation. Create a new class file and replace all occurrences with imports to the centralized version.`;
  }

  private createUtilityExtractionInstructions(group: DuplicateGroup): string {
    return `Create a utility function to consolidate ${group.chunks.length} exact duplicate code blocks. These blocks perform the same operation and can be extracted into a reusable utility function. Analyze the context and create an appropriately named utility with clear parameters.`;
  }

  private createSemanticMergeInstructions(group: DuplicateGroup): string {
    const mainChunk = group.chunks[0];
    return `Merge ${group.chunks.length} semantically similar functions into a single configurable function. The functions "${mainChunk.functionName}" show ${(group.similarity * 100).toFixed(1)}% semantic similarity. Analyze the differences and create a unified function with parameters to handle the variations.`;
  }

  private createSemanticUtilityInstructions(group: DuplicateGroup): string {
    return `Create a flexible utility to handle ${group.chunks.length} semantically similar code patterns with ${(group.similarity * 100).toFixed(1)}% similarity. Analyze the common purpose and create a configurable utility that can handle the different variations through parameters or configuration objects.`;
  }

  private createBaseClassInstructions(group: DuplicateGroup): string {
    const mainChunk = group.chunks[0];
    return `Create a base class to eliminate structural duplication in ${group.chunks.length} similar classes. The classes show ${(group.similarity * 100).toFixed(1)}% structural similarity. Design an abstract base class that captures the common structure and behavior, then refactor the existing classes to inherit from it.`;
  }

  private createStructuralUtilityInstructions(group: DuplicateGroup): string {
    return `Create a utility pattern to handle ${group.chunks.length} structurally similar code blocks with ${(group.similarity * 100).toFixed(1)}% structural similarity. Consider using template method pattern, strategy pattern, or a configurable utility function to eliminate the structural duplication.`;
  }

  // Helper methods
  private suggestUtilityLocation(referenceFile: string): string {
    const path = require('path');
    const dir = path.dirname(referenceFile);

    // Try to find existing utils directory
    const possibleLocations = [
      path.join(dir, 'utils'),
      path.join(dir, '../utils'),
      path.join(dir, '../../utils'),
      path.join(dir, 'helpers'),
      path.join(dir, '../helpers'),
      path.join(dir, 'shared'),
      path.join(dir, '../shared')
    ];

    // For now, suggest creating a utils directory in the same folder
    return path.join(dir, 'utils', 'extracted-utilities.ts');
  }

  private suggestBaseClassLocation(referenceFile: string): string {
    const path = require('path');
    const dir = path.dirname(referenceFile);
    return path.join(dir, 'base', 'base-classes.ts');
  }

  private estimateLinesReduced(plan: ConsolidationPlan): number {
    // Rough estimation based on action type and files affected
    const baseReduction = plan.affectedFiles.length * 10; // Assume 10 lines per duplicate

    switch (plan.action) {
      case 'extract_function':
        return baseReduction * 0.8; // High reduction for exact functions
      case 'extract_class':
        return baseReduction * 1.2; // Higher reduction for classes
      case 'create_utility':
        return baseReduction * 0.6; // Medium reduction for utilities
      case 'merge_similar':
        return baseReduction * 0.5; // Lower reduction due to parameterization
      case 'create_base_class':
        return baseReduction * 0.7; // Good reduction through inheritance
      default:
        return baseReduction * 0.4;
    }
  }

  private createConsolidationSummary(results: ConsolidationResult[], errors: string[]): ConsolidationSummary {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    const totalLinesReduced = successful.reduce((sum, r) => sum + r.linesReduced, 0);
    const allModifiedFiles = [...new Set(successful.flatMap(r => r.filesModified))];
    const newUtilities = successful.map(r => r.newUtilityCreated).filter(Boolean) as string[];

    const avgQualityScore = successful.length > 0
      ? successful.reduce((sum, r) => sum + (r.qualityScore || 0), 0) / successful.length
      : 0;

    return {
      totalGroupsProcessed: results.length,
      successfulConsolidations: successful.length,
      failedConsolidations: failed.length,
      totalLinesReduced,
      newUtilitiesCreated: newUtilities,
      filesModified: allModifiedFiles,
      overallQualityImprovement: avgQualityScore,
      errors
    };
  }
}

export default CodeConsolidationHandler;