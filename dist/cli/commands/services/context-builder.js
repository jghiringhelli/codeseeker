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
        // Map relevant files and find their line numbers from graphContext classes
        const relevantFiles = semanticResults.map(result => {
            // Try to find corresponding class info with line numbers
            const classInfo = graphContext.classes?.find(c => c.filePath === result.file ||
                result.file.includes(c.name.toLowerCase().replace(/([A-Z])/g, '-$1').toLowerCase()));
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
        // Relevant files context with content previews and line numbers
        if (relevantFiles.length > 0) {
            sections.push(`# Relevant Files (${relevantFiles.length} found)`);
            const fileEntries = relevantFiles
                .slice(0, 5) // Limit to top 5 files to avoid token overflow
                .map(file => {
                // Format location with line numbers if available
                const location = file.startLine
                    ? `${file.path}:${file.startLine}${file.endLine ? `-${file.endLine}` : ''}`
                    : file.path;
                let entry = `## ${location}\n- **Type**: ${file.type}\n- **Relevance**: ${(file.similarity * 100).toFixed(0)}%`;
                if (file.preview && file.preview.trim()) {
                    entry += `\n\n\`\`\`\n${file.preview}\n\`\`\``;
                }
                return entry;
            });
            sections.push(fileEntries.join('\n\n'));
        }
        // Classes and Components with file:line locations
        if (graphContext.classes && graphContext.classes.length > 0) {
            sections.push(`# Classes & Components`);
            const classEntries = graphContext.classes
                .slice(0, 8)
                .map(c => {
                // Format as file:line for Claude Code navigation
                const startLine = c.metadata?.startLine || c.sourceLocation?.startLine;
                const location = c.filePath
                    ? `[${c.filePath}${startLine ? `:${startLine}` : ''}]`
                    : '';
                return `- **${c.name}** (${c.type}) ${location}`;
            })
                .join('\n');
            sections.push(classEntries);
        }
        // Code relationships with method names and file:line context
        if (graphContext.relationshipDetails.length > 0) {
            sections.push(`# Code Relationships`);
            const relationshipList = graphContext.relationshipDetails
                .slice(0, 10)
                .map(rel => {
                // Format with method names: ClassName.methodName() → Target.targetMethod()
                const fromDisplay = rel.fromMethod
                    ? `${rel.from}.${rel.fromMethod}()`
                    : rel.from;
                const toDisplay = rel.toMethod
                    ? `${rel.to}.${rel.toMethod}()`
                    : rel.to;
                // Include file:line if available
                const lineLoc = rel.line ? `:${rel.line}` : '';
                const fromLoc = rel.fromPath
                    ? ` [${rel.fromPath}${lineLoc}]`
                    : '';
                return `- ${fromDisplay}${fromLoc} → ${toDisplay} (${rel.type})`;
            })
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