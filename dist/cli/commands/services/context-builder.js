"use strict";
/**
 * Context Builder Service
 * Single Responsibility: Build enhanced context for Claude Code prompts
 * Combines semantic search results, graph analysis, and user clarifications
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextBuilder = void 0;
class ContextBuilder {
    /**
     * Build enhanced context from all analysis results
     */
    buildEnhancedContext(originalQuery, queryAnalysis, userClarifications, semanticResults, graphContext) {
        const intent = queryAnalysis.intent;
        // Map relevant files and find their line numbers from graphContext classes
        const relevantFiles = semanticResults.map(result => {
            // Try to find corresponding class info with line numbers
            const classInfo = graphContext.classes?.find(c => c.filePath === result.file ||
                result.file.includes(c.name.toLowerCase().replace(/([A-Z])/g, '-$1').toLowerCase()));
            return {
                path: result.file,
                type: result.type,
                similarity: result.similarity,
                preview: this.createFilePreview(result, intent),
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
        const enhancedPrompt = this.createEnhancedPrompt(originalQuery, queryAnalysis, userClarifications, relevantFiles, graphContext);
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
    extractLineFromMetadata(classInfo) {
        // Check various locations where line number might be stored
        if (classInfo.metadata?.startLine)
            return classInfo.metadata.startLine;
        if (classInfo.sourceLocation?.startLine)
            return classInfo.sourceLocation.startLine;
        return undefined;
    }
    /**
     * Extract end line number from class metadata
     */
    extractEndLineFromMetadata(classInfo) {
        if (classInfo.metadata?.endLine)
            return classInfo.metadata.endLine;
        if (classInfo.sourceLocation?.endLine)
            return classInfo.sourceLocation.endLine;
        return undefined;
    }
    /**
     * Format location as file:line for Claude Code navigation
     */
    formatLocation(filePath, classInfo) {
        if (!filePath)
            return undefined;
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
    createEnhancedPrompt(originalQuery, queryAnalysis, userClarifications, relevantFiles, graphContext) {
        const sections = [];
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
- Code snippets are sized based on task complexity - they show key patterns and signatures
- **When to use Read tool**: Use Read when you need to see implementation details, understand full context, or work with code not shown in snippets
- **Why snippets help**: They provide enough context to understand structure and patterns without bloating token usage
- Focus on analyzing and working with the discovered files rather than searching from scratch`);
        // ===========================================
        // ROLE: Task-specific role based on intent
        // ===========================================
        const role = this.getRoleForIntent(queryAnalysis.intent);
        sections.push(`# Role\n${role}`);
        // ===========================================
        // FILE READING GUIDANCE: Intent-specific pitch
        // ===========================================
        const readGuidance = this.getReadGuidanceForIntent(queryAnalysis.intent);
        if (readGuidance) {
            sections.push(`# When to Read Files\n${readGuidance}`);
        }
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
            // Files with intent-based previews
            if (relevantFiles.length > 0) {
                const fileEntries = relevantFiles
                    .slice(0, 5)
                    .map(file => {
                    const location = file.startLine
                        ? `${file.path}:${file.startLine}${file.endLine ? `-${file.endLine}` : ''}`
                        : file.path;
                    let entry = `**${location}** (${file.type}, ${(file.similarity * 100).toFixed(0)}% match)`;
                    // Include intent-based code snippet if available
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
                    const startLine = c.metadata?.startLine || c.sourceLocation?.startLine;
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
     * Get intent-specific guidance on when Claude should read files
     * This "pitches" Claude on why and when to use the Read tool
     */
    getReadGuidanceForIntent(intent) {
        const guidance = {
            'fix': `**Read files when**: You need to trace the bug through the full call stack or see error handling logic not shown in snippets. The snippets show the relevant code area, but bugs often span multiple functions.`,
            'analyze': `**Read files when**: You need to understand implementation details, measure complexity, or trace data flow. The snippets provide structure overview - use Read for deep analysis.`,
            'explain': `**Read files when**: The user asks about specific implementation details or you need to trace execution flow. Snippets show signatures and patterns, but full explanation may require seeing the logic.`,
            'modify': `**Read files when**: You need to understand the current implementation before making changes. The snippets show signatures - read full code to ensure your changes integrate properly.`,
            'create': `**Read files when**: You need to see complete examples of similar functionality to match the project's patterns. Snippets show structure, but you may need full implementations as templates.`,
            'refactor': `**Read files when**: You need to understand the full scope of what you're refactoring. Snippets show structure, but refactoring requires seeing all usages and dependencies.`,
            'test': `**Read files when**: You need to understand the full behavior you're testing. The snippets show what to test, but you need implementation details to write comprehensive tests.`
        };
        return guidance[intent] || null;
    }
    /**
     * Get role description based on detected intent
     */
    getRoleForIntent(intent) {
        const roles = {
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
    getFormatForIntent(intent) {
        const formats = {
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
     * Create intent-based file preview optimized for GraphRAG
     * Adaptive chunk sizing based on task complexity and file size
     *
     * Strategy:
     * - Complex tasks (fix, analyze, explain) need more context
     * - Simple tasks (create, modify) need pattern examples only
     * - Large files (>1000 lines) get no preview to avoid token bloat
     */
    createFilePreview(result, intent) {
        const lines = result.content.split('\n');
        // Adaptive chunk sizing based on intent (following RAG best practices)
        const CHUNK_SIZES = {
            'fix': 80, // Bug fixes need more context (512-1024 tokens ≈ 80 lines)
            'analyze': 40, // Analysis needs decent context (256-512 tokens ≈ 40 lines)
            'explain': 40, // Explanation needs decent context (256-512 tokens ≈ 40 lines)
            'refactor': 30, // Refactoring needs structure (256 tokens ≈ 30 lines)
            'modify': 20, // Modifications need signatures (128-256 tokens ≈ 20 lines)
            'create': 20, // Creation needs pattern examples (128-256 tokens ≈ 20 lines)
            'test': 25, // Tests need example patterns (256 tokens ≈ 25 lines)
            'document': 15, // Documentation needs minimal context (128 tokens ≈ 15 lines)
            'general': 0 // General queries: no snippets (Claude decides what to read)
        };
        const chunkLines = CHUNK_SIZES[intent] || 0;
        // Large files or general queries: no preview to save tokens
        if (chunkLines === 0 || lines.length > 1000) {
            return '';
        }
        const previewLines = lines.slice(0, chunkLines);
        const suffix = lines.length > chunkLines
            ? `\n... (${lines.length - chunkLines} more lines - use Read tool for full content)`
            : '';
        return previewLines.join('\n') + suffix;
    }
    /**
     * Generate context statistics for logging
     */
    getContextStats(context) {
        return {
            filesFound: context.relevantFiles.length,
            relationshipsFound: context.codeRelationships.length,
            assumptionsDetected: context.assumptions.length,
            clarificationsProvided: context.clarifications.length,
            promptLength: context.enhancedPrompt.length
        };
    }
}
exports.ContextBuilder = ContextBuilder;
//# sourceMappingURL=context-builder.js.map