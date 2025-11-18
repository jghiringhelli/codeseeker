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
        const relevantFiles = semanticResults.map(result => ({
            path: result.file,
            type: result.type,
            similarity: result.similarity,
            preview: this.createFilePreview(result)
        }));
        const enhancedPrompt = this.createEnhancedPrompt(originalQuery, queryAnalysis, userClarifications, relevantFiles, graphContext);
        return {
            originalQuery,
            clarifications: userClarifications,
            assumptions: queryAnalysis.assumptions,
            relevantFiles,
            codeRelationships: graphContext.relationshipDetails,
            packageStructure: graphContext.packageStructure,
            enhancedPrompt
        };
    }
    /**
     * Create enhanced prompt for Claude Code
     */
    createEnhancedPrompt(originalQuery, queryAnalysis, userClarifications, relevantFiles, graphContext) {
        const sections = [];
        // Original user request
        sections.push(`# Original Request\n${originalQuery}`);
        // User clarifications if any
        if (userClarifications.length > 0) {
            sections.push(`# User Clarifications\n${userClarifications.map(c => `- ${c}`).join('\n')}`);
        }
        // Detected assumptions
        if (queryAnalysis.assumptions.length > 0) {
            sections.push(`# Detected Assumptions\n${queryAnalysis.assumptions.map(a => `- ${a}`).join('\n')}`);
        }
        // Relevant files context
        if (relevantFiles.length > 0) {
            sections.push(`# Relevant Files (${relevantFiles.length} found)`);
            const fileList = relevantFiles
                .slice(0, 8) // Limit to top 8 files to avoid token overflow
                .map(file => `- **${file.path}** (${file.type}, similarity: ${(file.similarity * 100).toFixed(1)}%)`)
                .join('\n');
            sections.push(fileList);
        }
        // Code relationships
        if (graphContext.relationshipDetails.length > 0) {
            sections.push(`# Code Relationships`);
            const relationshipList = graphContext.relationshipDetails
                .slice(0, 10) // Limit relationships
                .map(rel => `- ${rel.from} → ${rel.to} (${rel.type})`)
                .join('\n');
            sections.push(relationshipList);
        }
        // Package structure
        if (graphContext.packageStructure.length > 0) {
            sections.push(`# Project Structure\nMain packages: ${graphContext.packageStructure.join(', ')}`);
        }
        // Intent and confidence
        sections.push(`# Analysis Summary\n- **Intent**: ${queryAnalysis.intent}\n- **Confidence**: ${(queryAnalysis.confidence * 100).toFixed(1)}%`);
        // Instructions for Claude
        sections.push(`# Instructions\nPlease implement the requested changes following the project's SOLID principles and architectural patterns. Use the relevant files as context for existing patterns and implementations.`);
        return sections.join('\n\n');
    }
    /**
     * Create a preview of file content
     */
    createFilePreview(result) {
        const lines = result.content.split('\n');
        const previewLines = lines.slice(0, 3); // First 3 lines
        return previewLines.join('\n') + (lines.length > 3 ? '\n...' : '');
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