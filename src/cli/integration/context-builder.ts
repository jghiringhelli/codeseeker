/**
 * Context Builder - Single Responsibility: Building enhanced context for Claude Code
 */

import * as fs from 'fs';
import * as path from 'path';

export class ContextBuilder {
  async build(userRequest: string, projectPath: string, relevantFiles: string[], intent: any): Promise<string> {
    const context = [];

    // Add user request with SOLID architectural guidance if needed
    context.push(`USER REQUEST: ${userRequest}`);

    // Check if architectural commands are needed (SOLID, patterns, etc.)
    if (this.requiresArchitecturalGuidance(userRequest)) {
      const { ContextOptimizer } = await import('../context-optimizer');
      const contextOptimizer = new ContextOptimizer();

      const optimizationRequest = {
        projectPath,
        query: userRequest,
        tokenBudget: 2000,
        strategy: 'smart' as const,
        contextType: 'architecture',
        focusArea: 'architectural-patterns'
      };

      const optimization = await contextOptimizer.optimizeContext(optimizationRequest);

      const architecturalGuidance = `
ARCHITECTURAL PATTERNS DETECTED:
${optimization.detectedPatterns?.map(p => `- ${p.name}: ${p.description}`).join('\n') || 'None detected'}

PRIORITY FILES FOR ARCHITECTURE:
${optimization.priorityFiles.slice(0, 3).map(f => `- ${f.path} (${f.importance})`).join('\n')}

SOLID PRINCIPLES GUIDANCE:
- Follow Single Responsibility Principle: Each class should have one reason to change
- Use Open/Closed Principle: Open for extension, closed for modification
- Apply Liskov Substitution: Derived classes must be substitutable for base classes
- Interface Segregation: Many specific interfaces better than one general
- Dependency Inversion: Depend on abstractions, not concretions
`;

      context.push(`ARCHITECTURAL GUIDANCE:\n${architecturalGuidance}`);
    }

    // Add intent information
    context.push(`INTENT: ${intent.category} (confidence: ${intent.confidence})`);

    // Add relevant files content (limited)
    if (relevantFiles.length > 0) {
      context.push(`RELEVANT FILES (${relevantFiles.length}):`);
      for (const file of relevantFiles.slice(0, 5)) {
        try {
          const content = await fs.promises.readFile(path.join(projectPath, file), 'utf-8');
          context.push(`\n--- ${file} ---\n${content.slice(0, 1000)}`);
        } catch (error) {
          context.push(`\n--- ${file} --- (error reading file)`);
        }
      }
    }

    return context.join('\n');
  }

  private requiresArchitecturalGuidance(userRequest: string): boolean {
    const architecturalKeywords = [
      'solid', 'architecture', 'pattern', 'design', 'refactor', 'structure',
      'single responsibility', 'open closed', 'liskov', 'interface segregation',
      'dependency inversion', 'clean code', 'principles'
    ];

    return architecturalKeywords.some(keyword =>
      userRequest.toLowerCase().includes(keyword)
    );
  }
}