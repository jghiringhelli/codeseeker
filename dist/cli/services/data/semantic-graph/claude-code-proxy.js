"use strict";
/**
 * Claude Code CLI Proxy - Dependency Inversion Principle
 * Uses Claude Code CLI as external semantic analysis service for unsupported languages
 * or when Tree-sitter parsing fails
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeCodeProxy = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const path = __importStar(require("path"));
const command_processor_1 = require("../../../managers/command-processor");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class ClaudeCodeProxy {
    claudeCommand;
    maxRetries;
    timeout = 30000; // 30 seconds
    entityIdCounter = 0;
    relationshipIdCounter = 0;
    constructor(claudeCommand = 'claude-code', maxRetries = 2) {
        this.claudeCommand = claudeCommand;
        this.maxRetries = maxRetries;
    }
    /**
     * Analyze file using Claude Code CLI
     */
    async analyzeFile(file) {
        const startTime = Date.now();
        try {
            // Create analysis prompt for Claude Code
            const analysisPrompt = this.createAnalysisPrompt(file);
            // Execute Claude Code CLI with the analysis prompt using centralized method
            const result = await this.executeClaudeCodeCentralized(analysisPrompt, file.path);
            // Parse Claude's response into structured data
            const analysis = this.parseClaudeResponse(result, file);
            return {
                ...analysis,
                processingTime: Date.now() - startTime
            };
        }
        catch (error) {
            console.warn(`Claude Code proxy failed for ${file.path}: ${error.message}`);
            // Return fallback analysis
            return this.createFallbackAnalysis(file, Date.now() - startTime);
        }
    }
    /**
     * Batch analyze multiple files using Claude Code
     */
    async analyzeFiles(files) {
        const results = new Map();
        const batchSize = 5; // Process files in small batches to avoid overwhelming Claude
        console.log(`🤖 Analyzing ${files.length} files with Claude Code CLI...`);
        for (let i = 0; i < files.length; i += batchSize) {
            const batch = files.slice(i, i + batchSize);
            const batchPromises = batch.map(file => this.analyzeFile(file).then(result => ({ file, result })));
            try {
                const batchResults = await Promise.allSettled(batchPromises);
                for (const result of batchResults) {
                    if (result.status === 'fulfilled') {
                        results.set(result.value.file.path, result.value.result);
                    }
                }
                // Rate limiting - avoid overwhelming Claude Code
                if (i + batchSize < files.length) {
                    await this.delay(1000); // 1 second between batches
                }
            }
            catch (error) {
                console.warn(`Batch analysis failed: ${error.message}`);
            }
        }
        return results;
    }
    createAnalysisPrompt(file) {
        return `Analyze this ${file.language || 'source'} file for semantic relationships and code entities.

File: ${file.relativePath}
Language: ${file.language || 'unknown'}
Size: ${file.size} bytes

Please identify:
1. Classes, functions, methods, and variables defined in this file
2. Import statements and dependencies
3. Function calls and method invocations
4. Inheritance relationships (extends, implements)
5. Key semantic relationships between code elements

Respond in the following JSON format:
{
  "entities": [
    {
      "name": "EntityName",
      "type": "class|function|method|variable|interface",
      "startLine": 10,
      "endLine": 25,
      "signature": "function signature or declaration",
      "modifiers": ["public", "static"]
    }
  ],
  "relationships": [
    {
      "sourceEntity": "SourceName",
      "targetEntity": "TargetName",
      "relationshipType": "IMPORTS|EXTENDS|CALLS|DEFINES",
      "lineNumber": 15,
      "confidence": 0.9
    }
  ],
  "summary": "Brief analysis summary",
  "confidence": 0.85
}

Focus on accuracy and only include relationships you're confident about.`;
    }
    async executeClaudeCodeCentralized(prompt, filePath) {
        try {
            // Use the centralized command processor
            const result = await command_processor_1.CommandProcessor.executeClaudeCode(prompt, {
                maxTokens: 8000,
                outputFormat: 'text',
                timeout: this.timeout
            });
            if (!result.success) {
                throw new Error(result.error || 'Claude Code execution failed');
            }
            return result.data || '';
        }
        catch (error) {
            console.warn(`Claude Code analysis failed for ${filePath}: ${error.message}`);
            throw new Error(`Claude Code analysis failed: ${error.message}`);
        }
    }
    parseClaudeResponse(response, file) {
        try {
            // Try to extract JSON from Claude's response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in Claude response');
            }
            const parsed = JSON.parse(jsonMatch[0]);
            // Validate and transform the response
            const entities = this.transformEntities(parsed.entities || [], file);
            const relationships = this.transformRelationships(parsed.relationships || [], file);
            return {
                entities,
                relationships,
                summary: parsed.summary || 'Analysis completed',
                confidence: Math.min(1.0, Math.max(0.0, parsed.confidence || 0.7))
            };
        }
        catch (error) {
            console.warn(`Failed to parse Claude response: ${error.message}`);
            // Try to extract useful information with regex as fallback
            return this.extractWithRegex(response, file);
        }
    }
    transformEntities(rawEntities, file) {
        return rawEntities.map(entity => ({
            id: this.generateEntityId(),
            name: entity.name || 'unknown',
            type: this.validateEntityType(entity.type),
            filePath: file.path,
            startLine: entity.startLine || 1,
            endLine: entity.endLine || entity.startLine || 1,
            signature: entity.signature,
            modifiers: Array.isArray(entity.modifiers) ? entity.modifiers : [],
            metadata: {
                processedBy: 'claude-proxy',
                language: file.language,
                confidence: entity.confidence || 0.7
            }
        }));
    }
    transformRelationships(rawRelationships, file) {
        return rawRelationships.map(rel => ({
            id: this.generateRelationshipId(),
            sourceFile: file.path,
            sourceEntity: rel.sourceEntity || 'unknown',
            targetEntity: rel.targetEntity || 'unknown',
            relationshipType: this.validateRelationshipType(rel.relationshipType),
            confidence: Math.min(1.0, Math.max(0.0, rel.confidence || 0.7)),
            lineNumber: rel.lineNumber || 1,
            metadata: {
                processedBy: 'claude-proxy',
                originalType: rel.relationshipType
            }
        }));
    }
    extractWithRegex(response, file) {
        // Fallback regex-based extraction when JSON parsing fails
        console.log('Falling back to regex extraction for Claude response');
        const entities = [];
        const relationships = [];
        // Try to extract mentioned functions, classes, etc.
        const classMatches = response.match(/class\s+(\w+)/gi) || [];
        const functionMatches = response.match(/function\s+(\w+)/gi) || [];
        classMatches.forEach((match, index) => {
            const className = String(match).split(' ')[1];
            if (className) {
                entities.push({
                    id: this.generateEntityId(),
                    name: className,
                    type: 'class',
                    filePath: file.path,
                    startLine: 1,
                    endLine: 1,
                    modifiers: [],
                    metadata: {
                        processedBy: 'claude-proxy-regex',
                        extractedFrom: 'text-analysis'
                    }
                });
            }
        });
        return {
            entities,
            relationships,
            summary: 'Regex-based extraction from Claude response',
            confidence: 0.5
        };
    }
    createFallbackAnalysis(file, processingTime) {
        return {
            entities: [{
                    id: this.generateEntityId(),
                    name: path.basename(file.path, path.extname(file.path)),
                    type: 'module',
                    filePath: file.path,
                    startLine: 1,
                    endLine: 1,
                    modifiers: [],
                    metadata: {
                        processedBy: 'fallback',
                        reason: 'claude-proxy-failed'
                    }
                }],
            relationships: [],
            summary: 'Fallback analysis - Claude Code CLI unavailable',
            confidence: 0.3,
            processingTime
        };
    }
    validateEntityType(type) {
        const validTypes = ['module', 'class', 'function', 'method', 'variable', 'interface', 'type'];
        return validTypes.includes(type) ? type : 'module';
    }
    validateRelationshipType(type) {
        const validTypes = ['IMPORTS', 'EXTENDS', 'IMPLEMENTS', 'CALLS', 'DEFINES', 'USES', 'CONTAINS'];
        return validTypes.includes(type) ? type : 'USES';
    }
    generateEntityId() {
        return `claude_entity_${++this.entityIdCounter}`;
    }
    generateRelationshipId() {
        return `claude_rel_${++this.relationshipIdCounter}`;
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.ClaudeCodeProxy = ClaudeCodeProxy;
//# sourceMappingURL=claude-code-proxy.js.map