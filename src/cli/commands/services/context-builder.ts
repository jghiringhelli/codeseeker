/**
 * Context Builder Service
 * Single Responsibility: Build enhanced context for Claude Code prompts
 * Combines semantic search results, graph analysis, and user clarifications
 */

import { QueryAnalysis } from './natural-language-processor';
import { SemanticResult } from './semantic-search-orchestrator';
import { GraphContext } from './graph-analysis-service';

export interface EnhancedContext {
  originalQuery: string;
  clarifications: string[];
  assumptions: string[];
  relevantFiles: Array<{
    path: string;
    type: string;
    similarity: number;
    preview: string;
    startLine?: number;
    endLine?: number;
  }>;
  codeRelationships: Array<{
    from: string;
    to: string;
    type: string;
    fromLocation?: string; // file:line format
    toLocation?: string;   // file:line format
    fromMethod?: string;   // Method that makes the call
    toMethod?: string;     // Method being called
    line?: number;         // Line number of the call
  }>;
  packageStructure: string[];
  enhancedPrompt: string;
}

export class ContextBuilder {
  /**
   * Build enhanced context from all analysis results
   */
  buildEnhancedContext(
    originalQuery: string,
    queryAnalysis: QueryAnalysis,
    userClarifications: string[],
    semanticResults: SemanticResult[],
    graphContext: GraphContext
  ): EnhancedContext {
    // Map relevant files and find their line numbers from graphContext classes
    const relevantFiles = semanticResults.map(result => {
      // Try to find corresponding class info with line numbers
      const classInfo = graphContext.classes?.find(c =>
        c.filePath === result.file ||
        result.file.includes(c.name.toLowerCase().replace(/([A-Z])/g, '-$1').toLowerCase())
      );

      return {
        path: result.file,
        type: result.type,
        similarity: result.similarity,
        preview: this.createFilePreview(result),
        startLine: classInfo?.filePath ? this.extractLineFromMetadata(classInfo) : undefined,
        endLine: classInfo?.filePath ? this.extractEndLineFromMetadata(classInfo) : undefined
      };
    });

    // Build relationships with file:line format and method names
    const codeRelationships = graphContext.relationshipDetails.map(rel => ({
      from: rel.from,
      to: rel.to,
      type: rel.type,
      fromLocation: this.formatLocation(rel.fromPath, graphContext.classes?.find(c => c.name === rel.from)),
      toLocation: this.formatLocation(rel.toPath, graphContext.classes?.find(c => c.name === rel.to)),
      fromMethod: rel.fromMethod,
      toMethod: rel.toMethod,
      line: rel.line
    }));

    const enhancedPrompt = this.createEnhancedPrompt(
      originalQuery,
      queryAnalysis,
      userClarifications,
      relevantFiles,
      graphContext
    );

    return {
      originalQuery,
      clarifications: userClarifications,
      assumptions: queryAnalysis.assumptions,
      relevantFiles,
      codeRelationships,
      packageStructure: graphContext.packageStructure,
      enhancedPrompt
    };
  }

  /**
   * Extract start line number from class metadata
   */
  private extractLineFromMetadata(classInfo: any): number | undefined {
    // Check various locations where line number might be stored
    if (classInfo.metadata?.startLine) return classInfo.metadata.startLine;
    if (classInfo.sourceLocation?.startLine) return classInfo.sourceLocation.startLine;
    return undefined;
  }

  /**
   * Extract end line number from class metadata
   */
  private extractEndLineFromMetadata(classInfo: any): number | undefined {
    if (classInfo.metadata?.endLine) return classInfo.metadata.endLine;
    if (classInfo.sourceLocation?.endLine) return classInfo.sourceLocation.endLine;
    return undefined;
  }

  /**
   * Format location as file:line for Claude Code navigation
   */
  private formatLocation(filePath?: string, classInfo?: any): string | undefined {
    if (!filePath) return undefined;

    const startLine = classInfo ?
      (classInfo.metadata?.startLine || classInfo.sourceLocation?.startLine) :
      undefined;

    if (startLine) {
      return `${filePath}:${startLine}`;
    }
    return filePath;
  }

  /**
   * Create enhanced prompt for Claude Code
   * Uses structured prompt engineering: Pre-Search Info → Role → Context → Task → Format → Constraints
   */
  private createEnhancedPrompt(
    originalQuery: string,
    queryAnalysis: QueryAnalysis,
    userClarifications: string[],
    relevantFiles: Array<{ path: string; type: string; similarity: number; preview: string; startLine?: number; endLine?: number }>,
    graphContext: GraphContext
  ): string {
    const sections: string[] = [];

    // ===========================================
    // PRE-SEARCH METHODOLOGY: Explain how we found the context
    // ===========================================
    const fileCount = relevantFiles.length;
    const componentCount = graphContext.classes?.length || 0;
    const relationshipCount = graphContext.relationshipDetails?.length || 0;

    sections.push(`# Enhanced Context from CodeMind Pre-Search

**IMPORTANT**: This prompt has been enhanced by CodeMind, a codebase analysis tool. The context below was gathered BEFORE this request reached you using:

1. **Semantic Vector Search** (PostgreSQL + pgvector): Found ${fileCount} relevant files by analyzing code embeddings for semantic similarity to the query
2. **Knowledge Graph Analysis** (Neo4j): Discovered ${componentCount} components and ${relationshipCount} relationships by traversing the project's dependency graph

**How to use this context**:
- The files and components listed below are the MOST RELEVANT to the user's query based on our analysis
- You can trust this as a reliable starting point - no need to re-search for the same information
- If you need additional context beyond what's provided, you may search further
- Focus on analyzing and working with the discovered files rather than searching from scratch`);

    // ===========================================
    // ROLE: Task-specific role based on intent
    // ===========================================
    const role = this.getRoleForIntent(queryAnalysis.intent);
    sections.push(`# Role\n${role}`);

    // ===========================================
    // TASK: The user's request with clarifications
    // ===========================================
    sections.push(`# Task\n${originalQuery}`);

    if (userClarifications.length > 0) {
      sections.push(`## Clarifications\n${userClarifications.map(c => `- ${c}`).join('\n')}`);
    }

    if (queryAnalysis.assumptions.length > 0) {
      sections.push(`## Assumptions (validate before proceeding)\n${queryAnalysis.assumptions.map(a => `- ${a}`).join('\n')}`);
    }

    // ===========================================
    // CONTEXT: Discovered files and relationships
    // ===========================================
    if (relevantFiles.length > 0 || (graphContext.classes && graphContext.classes.length > 0)) {
      sections.push(`# Pre-Discovered Context (Use This First)
The following files, components, and relationships were discovered through automated analysis. **Start here** rather than searching from scratch.`);

      // Files with previews
      if (relevantFiles.length > 0) {
        const fileEntries = relevantFiles
          .slice(0, 5)
          .map(file => {
            const location = file.startLine
              ? `${file.path}:${file.startLine}${file.endLine ? `-${file.endLine}` : ''}`
              : file.path;
            let entry = `**${location}** (${file.type}, ${(file.similarity * 100).toFixed(0)}% match)`;
            if (file.preview && file.preview.trim()) {
              entry += `\n\`\`\`\n${file.preview}\n\`\`\``;
            }
            return entry;
          });
        sections.push(`## Relevant Files\n${fileEntries.join('\n\n')}`);
      }

      // Components
      if (graphContext.classes && graphContext.classes.length > 0) {
        const classEntries = graphContext.classes
          .slice(0, 8)
          .map(c => {
            const startLine = (c as any).metadata?.startLine || (c as any).sourceLocation?.startLine;
            const location = c.filePath
              ? `${c.filePath}${startLine ? `:${startLine}` : ''}`
              : '';
            return `- **${c.name}** (${c.type})${location ? ` at ${location}` : ''}`;
          })
          .join('\n');
        sections.push(`## Components\n${classEntries}`);
      }

      // Relationships
      if (graphContext.relationshipDetails.length > 0) {
        const relationshipList = graphContext.relationshipDetails
          .slice(0, 8)
          .map(rel => {
            const fromDisplay = rel.fromMethod ? `${rel.from}.${rel.fromMethod}()` : rel.from;
            const toDisplay = rel.toMethod ? `${rel.to}.${rel.toMethod}()` : rel.to;
            return `- ${fromDisplay} → ${toDisplay} [${rel.type}]`;
          })
          .join('\n');
        sections.push(`## Dependencies\n${relationshipList}`);
      }
    }

    // ===========================================
    // FORMAT: Expected response structure
    // ===========================================
    const format = this.getFormatForIntent(queryAnalysis.intent);
    sections.push(`# Response Format\n${format}`);

    // ===========================================
    // QUALITY: Reference project standards
    // ===========================================
    sections.push(`# Quality Standards
Follow CLAUDE.md project guidelines:
- Apply SOLID principles (project enforces strict compliance)
- Match existing patterns in the relevant files above
- Maintain the project's layered architecture (CLI/Orchestrator/Shared)`);

    // ===========================================
    // EXECUTION MINDSET: Act decisively
    // ===========================================
    sections.push(`# Execution Mindset
- If the task is clear, execute it directly without asking questions
- If something is ambiguous, state your interpretation briefly then PROCEED
- Point out concerns or risks IN YOUR RESPONSE while still delivering the solution
- After ONE clarification (if any was asked earlier), assume reasonable defaults and execute
- Provide working code, not questions about what the user wants`);

    // ===========================================
    // CONSTRAINTS: What NOT to do
    // ===========================================
    sections.push(`# Constraints
- Do NOT mention permissions or approval - CodeMind handles this separately
- Do NOT create new files unless explicitly required - prefer editing existing
- Do NOT add comments to unchanged code
- Do NOT over-engineer - implement only what's requested`);

    return sections.join('\n\n');
  }

  /**
   * Get role description based on detected intent
   */
  private getRoleForIntent(intent: string): string {
    const roles: Record<string, string> = {
      'create': 'You are implementing new functionality. Focus on following existing patterns from the discovered files.',
      'modify': 'You are modifying existing code. Preserve the current architecture while making targeted changes.',
      'refactor': 'You are refactoring code for better structure. Maintain behavior while improving design.',
      'fix': 'You are debugging and fixing issues. Identify root cause before applying minimal fixes.',
      'analyze': 'You are analyzing code to provide insights. Focus on patterns, quality, and architecture.',
      'explain': 'You are explaining code behavior. Trace through the discovered relationships.',
      'test': 'You are creating or improving tests. Follow existing test patterns in the project.',
      'document': 'You are improving documentation. Keep it concise and actionable.',
      'delete': 'You are removing code. Verify no dependencies before removal.',
      'general': 'You are assisting with a development task. Use the discovered context to inform your approach.'
    };
    return roles[intent] || roles['general'];
  }

  /**
   * Get expected response format based on intent
   */
  private getFormatForIntent(intent: string): string {
    const formats: Record<string, string> = {
      'create': `1. **Plan**: Which files to create/modify and why
2. **Implementation**: The actual code changes
3. **Integration**: How it connects to existing code`,
      'modify': `1. **Changes**: List specific modifications
2. **Impact**: Files affected by the change
3. **Implementation**: The code edits`,
      'refactor': `1. **Current Issues**: What's being improved
2. **Approach**: Refactoring strategy
3. **Changes**: Step-by-step modifications`,
      'fix': `1. **Root Cause**: What's causing the issue
2. **Fix**: Minimal change to resolve it
3. **Verification**: How to confirm the fix`,
      'analyze': `1. **Findings**: Key observations
2. **Patterns**: Architectural patterns found
3. **Recommendations**: Suggested improvements`,
      'explain': `1. **Overview**: High-level explanation
2. **Flow**: How components interact
3. **Key Points**: Important implementation details`,
      'test': `1. **Coverage**: What's being tested
2. **Approach**: Testing strategy
3. **Tests**: The actual test code`,
      'general': `1. **Approach**: How you'll address the request
2. **Implementation**: The code or changes
3. **Summary**: What was accomplished`
    };
    return formats[intent] || formats['general'];
  }

  /**
   * Create a meaningful preview of file content
   * Shows ~50 lines - enough to see class signatures, imports, and key methods
   * This reduces Claude's need to Read files, saving tool call tokens
   */
  private createFilePreview(result: SemanticResult): string {
    const lines = result.content.split('\n');
    const PREVIEW_LINES = 50; // Enough to see class structure and key methods
    const previewLines = lines.slice(0, PREVIEW_LINES);
    return previewLines.join('\n') + (lines.length > PREVIEW_LINES ? `\n... (${lines.length - PREVIEW_LINES} more lines)` : '');
  }

  /**
   * Generate context statistics for logging
   */
  getContextStats(context: EnhancedContext): {
    filesFound: number;
    relationshipsFound: number;
    assumptionsDetected: number;
    clarificationsProvided: number;
    promptLength: number;
  } {
    return {
      filesFound: context.relevantFiles.length,
      relationshipsFound: context.codeRelationships.length,
      assumptionsDetected: context.assumptions.length,
      clarificationsProvided: context.clarifications.length,
      promptLength: context.enhancedPrompt.length
    };
  }
}