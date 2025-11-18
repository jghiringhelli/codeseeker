"use strict";
/**
 * Claude Code Integration Service
 * Provides direct integration with Claude Code for AI-powered analysis
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
exports.ClaudeCodeIntegration = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const prompt_chunking_system_1 = require("../shared/prompt-chunking-system");
const database_config_1 = require("../config/database-config");
const claude_conversation_manager_1 = require("./claude-conversation-manager");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class ClaudeCodeIntegration {
    dbConnections;
    conversationManager;
    activeSessions = new Map(); // projectPath -> sessionId
    constructor() {
        this.dbConnections = new database_config_1.DatabaseConnections();
        this.conversationManager = new claude_conversation_manager_1.ClaudeConversationManager();
    }
    /**
     * Execute Claude Code with a specific prompt and context using conversation management
     */
    async executeClaudeCode(prompt, context, options = { projectPath: '.' }) {
        try {
            console.log(`🤖 Executing Claude Code with conversation management...`);
            // Get or create session for this project
            const sessionId = await this.getSessionForProject(options.projectPath);
            // Combine prompt and context for the conversation
            const fullPrompt = context ? `${context}\n\n${prompt}` : prompt;
            // Use PromptChunkingSystem to handle large prompts (25K+ character limit)
            console.log(`📏 Checking prompt size: ${fullPrompt.length} characters`);
            const chunkResult = await prompt_chunking_system_1.PromptChunkingSystem.processLargePrompt(fullPrompt, options.projectPath, prompt // Original request for compression context
            );
            if (!chunkResult.success) {
                console.error(`❌ Prompt chunking failed: ${chunkResult.error}`);
                throw new Error(`Prompt too large and compression failed: ${chunkResult.error}`);
            }
            const processedPrompt = chunkResult.finalPrompt;
            console.log(`✅ Using processed prompt: ${processedPrompt.length} characters (${chunkResult.chunksProcessed} chunks processed)`);
            // Send message through conversation manager
            const result = await this.conversationManager.sendMessage(sessionId, processedPrompt, context);
            return {
                success: true,
                data: result.response,
                tokensUsed: result.tokensUsed + chunkResult.tokensUsed,
                resumeToken: sessionId
            };
        }
        catch (error) {
            console.error(`❌ Claude Code execution failed: ${error instanceof Error ? error.message : error}`);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Get or create a conversation session for a project
     */
    async getSessionForProject(projectPath) {
        let sessionId = this.activeSessions.get(projectPath);
        if (!sessionId) {
            sessionId = await this.conversationManager.startSession(projectPath);
            this.activeSessions.set(projectPath, sessionId);
        }
        return sessionId;
    }
    /**
     * Perform comprehensive project analysis using Claude Code
     */
    async analyzeProject(projectPath, resumeToken) {
        console.log('🔍 Starting AI-powered project analysis...');
        // Build comprehensive context for Claude Code
        const context = await this.buildProjectContext(projectPath);
        const analysisPrompt = `
You are an expert software architect analyzing a codebase. Provide a comprehensive analysis including:

1. **Architecture Analysis**:
   - Identify the architectural pattern (MVC, microservices, layered, etc.)
   - List design patterns used
   - Identify frameworks and technologies
   - Assess adherence to SOLID principles

2. **Dependency Analysis**:
   - Map file-to-file dependencies
   - Identify circular dependencies
   - Rate relationship strength (1-10)
   - Categorize dependency types

3. **Use Case Inference**:
   - Infer business use cases from code structure
   - Identify key user journeys
   - Map actors and their interactions
   - Assess business value of each use case

4. **Code Quality Assessment**:
   - Overall quality score (1-10)
   - Identify technical debt
   - Security concerns
   - Performance bottlenecks
   - Recommendations for improvement

Return your analysis as structured JSON with the exact schema provided.
`;
        const response = await this.executeClaudeCode(analysisPrompt, context, {
            projectPath,
            maxTokens: 12000, // Increased for comprehensive intent analysis
            resumeToken
        });
        if (!response.success) {
            throw new Error(`Analysis failed: ${response.error}`);
        }
        // Parse and validate the response
        const analysisData = this.parseAnalysisResponse(response.data);
        // Store results in databases
        await this.storeAnalysisResults(projectPath, analysisData);
        return analysisData;
    }
    /**
     * Process user requests through the complete AI pipeline
     */
    async processRequest(userRequest, projectPath, options = {}) {
        console.log('🎯 Processing request through AI pipeline...');
        try {
            // Step 1: Simple Intent Detection (more reliable)
            const simpleIntent = await this.detectUserIntentSimple(userRequest);
            console.log(`📋 Detected intent: ${simpleIntent.category} (confidence: ${simpleIntent.confidence}) - ${simpleIntent.reasoning}`);
            // Convert to legacy format for compatibility
            const intent = {
                category: simpleIntent.category,
                confidence: simpleIntent.confidence,
                params: {
                    requiresModifications: simpleIntent.requiresModifications,
                    reasoning: simpleIntent.reasoning
                }
            };
            // Step 2: Semantic Search for relevant context
            const relevantFiles = await this.performSemanticSearch(userRequest, projectPath);
            console.log(`📁 Found ${relevantFiles.length} relevant files`);
            // Step 3: Build Enhanced Context
            const fileNames = relevantFiles.map(f => typeof f === 'string' ? f : f.file);
            const enhancedContext = await this.buildEnhancedContext(userRequest, projectPath, fileNames, intent);
            // Step 4: Task Decomposition
            const tasks = await this.decomposeIntoTasks(userRequest, intent);
            console.log(`🔄 Decomposed into ${tasks.length} tasks`);
            // Step 5: Execute tasks with Claude Code
            const results = [];
            for (const task of tasks) {
                console.log(`⚡ Executing: ${task.description}`);
                const result = await this.executeTask(task, enhancedContext);
                results.push(result);
                // Quality check after each task
                const qualityCheck = await this.performQualityCheck(result);
                if (!qualityCheck.passed) {
                    console.log(`⚠️  Quality check failed: ${qualityCheck.suggestions.join(', ')}`);
                    // Retry with improvements
                    const improved = await this.improveTaskResult(result, qualityCheck);
                    results[results.length - 1] = improved;
                }
            }
            // Step 6: Final integration and validation
            const finalResult = await this.integrateResults(results);
            // Step 7: Update knowledge base
            await this.updateKnowledgeBase({
                ...finalResult,
                projectPath,
                projectId: options?.projectId || 'unknown',
                userRequest
            });
            return {
                success: true,
                data: finalResult,
                tokensUsed: results.reduce((sum, r) => sum + (r.tokensUsed || 0), 0)
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Request processing failed'
            };
        }
    }
    /**
     * Build comprehensive project context for Claude Code
     */
    async buildProjectContext(projectPath) {
        console.log('📋 Building project context...');
        const context = [];
        // Get project structure
        const structure = await this.getProjectStructure(projectPath);
        context.push(`PROJECT STRUCTURE:\n${structure}\n`);
        // Get key configuration files
        const configs = await this.getKeyConfigurations(projectPath);
        context.push(`CONFIGURATIONS:\n${configs}\n`);
        // Get recent changes (if git available)
        const changes = await this.getRecentChanges(projectPath);
        if (changes) {
            context.push(`RECENT CHANGES:\n${changes}\n`);
        }
        // Get existing documentation
        const docs = await this.getProjectDocumentation(projectPath);
        if (docs) {
            context.push(`DOCUMENTATION:\n${docs}\n`);
        }
        return context.join('\n---\n');
    }
    /**
     * Simple, reliable intent detection (primary method)
     */
    async detectUserIntentSimple(userRequest) {
        const intentPrompt = `
INTENT ANALYSIS:

Analyze this user request: "${userRequest}"

TASK: Determine the primary intent category with high confidence.

INTENT CATEGORIES:
- report: Informational queries, explanations, documentation requests (no code changes)
- feature_request: Adding new functionality or capabilities
- bug_fix: Fixing existing issues or errors
- refactoring: Improving code structure without changing functionality
- documentation: Adding/updating documentation files
- testing: Adding/improving tests
- optimization: Performance improvements

ANALYSIS CRITERIA:
- Focus on what the user is asking for, not how to implement it
- Consider whether the request requires code modifications
- Identify the primary goal (users often have mixed requests)

RESPOND WITH ONLY THIS EXACT JSON FORMAT (no markdown, no explanations):
{
  "category": "report",
  "confidence": 0.95,
  "requiresModifications": false,
  "reasoning": "Brief explanation of why this category was chosen"
}

Response:`;
        try {
            const response = await this.executeClaudeCode(intentPrompt, '', {
                projectPath: '',
                maxTokens: 4000 // Much smaller response needed
            });
            if (!response.success) {
                throw new Error(`Intent detection failed: ${response.error}`);
            }
            // Parse the simple JSON response
            const cleanedResponse = response.data
                .replace(/```json/g, '')
                .replace(/```/g, '')
                .replace(/^[^{]*/, '')
                .replace(/[^}]*$/, '')
                .trim();
            try {
                const parsed = JSON.parse(cleanedResponse);
                console.log(`✅ Simple intent detection successful: ${parsed.category} (${parsed.confidence})`);
                return parsed;
            }
            catch (parseError) {
                console.log(`❌ Simple JSON parsing failed: ${parseError.message}`);
                // Enhanced fallback with user request analysis
                const userRequestLower = userRequest.toLowerCase();
                if (userRequestLower.includes('what is') ||
                    userRequestLower.includes('describe') ||
                    userRequestLower.includes('explain') ||
                    userRequestLower.includes('about') ||
                    userRequestLower.includes('how does') ||
                    userRequestLower.includes('show me')) {
                    return {
                        category: 'report',
                        confidence: 0.8,
                        requiresModifications: false,
                        reasoning: 'Detected informational query via fallback analysis'
                    };
                }
                if (userRequestLower.includes('add') ||
                    userRequestLower.includes('implement') ||
                    userRequestLower.includes('create') ||
                    userRequestLower.includes('build')) {
                    return {
                        category: 'feature_request',
                        confidence: 0.7,
                        requiresModifications: true,
                        reasoning: 'Detected feature request via fallback analysis'
                    };
                }
                if (userRequestLower.includes('fix') ||
                    userRequestLower.includes('bug') ||
                    userRequestLower.includes('error') ||
                    userRequestLower.includes('issue')) {
                    return {
                        category: 'bug_fix',
                        confidence: 0.7,
                        requiresModifications: true,
                        reasoning: 'Detected bug fix via fallback analysis'
                    };
                }
                // Default fallback
                return {
                    category: 'report',
                    confidence: 0.5,
                    requiresModifications: false,
                    reasoning: 'Default fallback - treating as informational request'
                };
            }
        }
        catch (error) {
            console.log(`⚠️ Intent detection error: ${error.message}`);
            // Final fallback
            return {
                category: 'report',
                confidence: 0.5,
                requiresModifications: false,
                reasoning: 'Error fallback - treating as informational request'
            };
        }
    }
    /**
     * Comprehensive intent detection with task breakdown (legacy method)
     */
    async detectUserIntent(userRequest) {
        const intentPrompt = `
COMPREHENSIVE REQUEST ANALYSIS:

Analyze this user request and provide complete workflow planning: "${userRequest}"

TASK: Determine intent category AND break down into logical task groups.

INTENT CATEGORIES:
- report: Informational queries (no code changes needed)
- feature_request: Adding new functionality
- bug_fix: Fixing existing issues
- refactoring: Improving code structure
- documentation: Adding/updating docs
- testing: Adding/improving tests
- optimization: Performance improvements

INSTRUCTIONS:
1. Identify the primary intent category
2. Break request into logical task groups (related tasks that should be processed together)
3. For each task group, specify if it requires code modifications or is informational
4. Estimate complexity and risk level for each group

CRITICAL: You MUST return COMPLETE valid JSON with ALL task groups. DO NOT truncate or abbreviate.

REQUIRED JSON FORMAT (respond with ONLY this JSON, no explanations, no markdown):
{
  "intent": {
    "category": "report|feature_request|bug_fix|refactoring|documentation|testing|optimization",
    "confidence": 0.95,
    "requiresModifications": false
  },
  "taskGroups": [
    {
      "groupId": "group_1",
      "description": "Brief description of what this group accomplishes",
      "tasks": ["task 1", "task 2", "task 3"],
      "requiresModifications": false,
      "complexity": "simple|medium|complex",
      "riskLevel": "low|medium|high",
      "estimatedMinutes": 15,
      "primaryDomains": ["domain1", "domain2"]
    },
    {
      "groupId": "group_2",
      "description": "Second group if needed",
      "tasks": ["task 4", "task 5"],
      "requiresModifications": true,
      "complexity": "medium",
      "riskLevel": "medium",
      "estimatedMinutes": 30,
      "primaryDomains": ["domain3"]
    }
  ],
  "workflow": "reporting|development",
  "reasoning": "Brief explanation of the analysis"
}

IMPORTANT: Return the COMPLETE JSON object with all closing braces and brackets.

Response:`;
        const response = await this.executeClaudeCode(intentPrompt, `User Request: ${userRequest}`, { projectPath: '.' });
        if (response.success) {
            try {
                console.log(`🔍 Raw Claude Code response (${response.data.length} chars): ${response.data.substring(0, 200)}...`);
                // First, try to clean the response and extract just JSON
                let cleanedResponse = response.data.trim();
                // Remove any markdown code blocks
                cleanedResponse = cleanedResponse.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1');
                // Enhanced JSON extraction with more robust patterns
                const patterns = [
                    // Complete comprehensive format - more flexible brace matching
                    /\{[\s\S]*?"intent"[\s\S]*?"category"[\s\S]*?"taskGroups"[\s\S]*?\]/,
                    // Legacy category format (fallback)
                    /\{[^{}]*"category"[^{}]*"confidence"[^{}]*\}/,
                    // Simple intent format without taskGroups
                    /\{[^{}]*"intent"[^{}]*"category"[^{}]*\}/,
                    // Minimal JSON with category
                    /\{[^}]*"category"[^}]*\}/
                ];
                for (let i = 0; i < patterns.length; i++) {
                    const jsonMatch = cleanedResponse.match(patterns[i]);
                    if (jsonMatch) {
                        try {
                            console.log(`✅ Found JSON pattern ${i + 1}: ${jsonMatch[0]}`);
                            const parsed = JSON.parse(jsonMatch[0]);
                            // Handle new comprehensive format
                            if (parsed.intent && parsed.taskGroups) {
                                console.log(`✅ Parsed comprehensive workflow response`);
                                return this.transformComprehensiveResponse(parsed);
                            }
                            // Handle legacy category format
                            if (parsed.category) {
                                console.log(`✅ Parsed legacy category response`);
                                return parsed;
                            }
                        }
                        catch (parseError) {
                            console.log(`❌ Pattern ${i + 1} failed to parse: ${parseError.message}`);
                            continue;
                        }
                    }
                }
                // Advanced brace matching with truncation handling
                const jsonStart = cleanedResponse.indexOf('{');
                if (jsonStart >= 0) {
                    let braceCount = 0;
                    let inString = false;
                    let escapeNext = false;
                    let jsonEnd = jsonStart;
                    let hasClosedProperly = false;
                    for (let i = jsonStart; i < cleanedResponse.length; i++) {
                        const char = cleanedResponse[i];
                        if (escapeNext) {
                            escapeNext = false;
                            continue;
                        }
                        if (char === '\\') {
                            escapeNext = true;
                            continue;
                        }
                        if (char === '"' && !escapeNext) {
                            inString = !inString;
                            continue;
                        }
                        if (!inString) {
                            if (char === '{')
                                braceCount++;
                            if (char === '}') {
                                braceCount--;
                                if (braceCount === 0) {
                                    jsonEnd = i + 1;
                                    hasClosedProperly = true;
                                    break;
                                }
                            }
                        }
                    }
                    // If JSON appears truncated, try to complete it
                    if (!hasClosedProperly && braceCount > 0) {
                        console.log(`⚠️ JSON appears truncated (${braceCount} unclosed braces), attempting repair...`);
                        // Try to find a reasonable stopping point for partial JSON
                        let lastValidPosition = jsonStart;
                        let tempBraceCount = 0;
                        for (let i = jsonStart; i < cleanedResponse.length; i++) {
                            const char = cleanedResponse[i];
                            if (char === '{')
                                tempBraceCount++;
                            else if (char === '}')
                                tempBraceCount--;
                            // Look for complete property definitions
                            if (char === ',' && tempBraceCount === 1) {
                                lastValidPosition = i;
                            }
                        }
                        // Construct a completed JSON by closing at the last valid position
                        if (lastValidPosition > jsonStart) {
                            jsonEnd = lastValidPosition;
                            const partialJson = cleanedResponse.substring(jsonStart, jsonEnd);
                            const repairedJson = partialJson + '}'; // Close the main object
                            console.log(`🔧 Attempting to parse repaired JSON (${repairedJson.length} chars)`);
                            try {
                                const parsed = JSON.parse(repairedJson);
                                if (parsed.intent || parsed.category) {
                                    console.log(`✅ Successfully parsed repaired JSON`);
                                    return parsed.intent ? this.transformComprehensiveResponse(parsed) : parsed;
                                }
                            }
                            catch (repairError) {
                                console.log(`❌ Repaired JSON also failed: ${repairError.message}`);
                            }
                        }
                    }
                    if (jsonEnd > jsonStart) {
                        const jsonStr = cleanedResponse.substring(jsonStart, jsonEnd);
                        console.log(`✅ Found JSON via advanced brace matching (${jsonStr.length} chars)`);
                        try {
                            const parsed = JSON.parse(jsonStr);
                            // Handle comprehensive format first
                            if (parsed.intent && parsed.taskGroups) {
                                console.log(`✅ Parsed comprehensive workflow response via brace matching`);
                                return this.transformComprehensiveResponse(parsed);
                            }
                            // Handle legacy format
                            if (parsed.category) {
                                console.log(`✅ Parsed legacy category response via brace matching`);
                                return parsed;
                            }
                        }
                        catch (parseError) {
                            console.log(`❌ Advanced brace matching failed to parse: ${parseError.message}`);
                        }
                    }
                }
                // Try parsing the entire response as JSON
                return JSON.parse(cleanedResponse);
            }
            catch (error) {
                console.log(`⚠️ JSON parsing failed: ${error.message}`);
                console.log(`🔍 Raw Claude Code response: ${response.data}`);
                // Enhanced text analysis for intent detection
                const responseText = response.data.toLowerCase();
                // Look for specific intent indicators in the response and original request
                const userRequestLower = userRequest.toLowerCase();
                if (responseText.includes('report') ||
                    responseText.includes('what is') ||
                    responseText.includes('describe') ||
                    responseText.includes('about') ||
                    responseText.includes('explain') ||
                    userRequestLower.includes('what is this project about') ||
                    userRequestLower.includes('what is') ||
                    userRequestLower.includes('describe') ||
                    userRequestLower.includes('about')) {
                    console.log('📋 Detected report intent from text analysis');
                    return { category: 'report', confidence: 0.8, params: {} };
                }
                if (responseText.includes('feature') || responseText.includes('add') || responseText.includes('implement')) {
                    console.log('🔨 Detected feature_request intent from text analysis');
                    return { category: 'feature_request', confidence: 0.7, params: {} };
                }
                if (responseText.includes('fix') || responseText.includes('bug') || responseText.includes('error')) {
                    console.log('🐛 Detected bug_fix intent from text analysis');
                    return { category: 'bug_fix', confidence: 0.7, params: {} };
                }
                // Fallback to default intent
                console.log('❌ Using fallback intent: analysis');
            }
        }
        return { category: 'analysis', confidence: 0.5, params: {} };
    }
    /**
     * Transform comprehensive workflow response to legacy format for backwards compatibility
     */
    transformComprehensiveResponse(parsed) {
        return {
            category: parsed.intent.category,
            confidence: parsed.intent.confidence,
            params: {
                taskGroups: parsed.taskGroups,
                workflow: parsed.workflow,
                reasoning: parsed.reasoning,
                requiresModifications: parsed.intent.requiresModifications
            }
        };
    }
    /**
     * Analyze user request with comprehensive task breakdown (new optimized approach)
     */
    async analyzeRequestWithTaskBreakdown(userRequest) {
        const result = await this.detectUserIntent(userRequest);
        // If we got comprehensive format, extract it
        if (result.params && result.params.taskGroups) {
            return {
                intent: {
                    category: result.category,
                    confidence: result.confidence,
                    requiresModifications: result.params.requiresModifications || false
                },
                taskGroups: result.params.taskGroups,
                workflow: result.params.workflow || 'development',
                reasoning: result.params.reasoning || 'Analysis based on request content'
            };
        }
        // Fallback: Create single task group from legacy format
        const isModification = !['report', 'analysis'].includes(result.category);
        return {
            intent: {
                category: result.category,
                confidence: result.confidence,
                requiresModifications: isModification
            },
            taskGroups: [{
                    groupId: 'main_group',
                    description: `${result.category} task`,
                    tasks: [userRequest],
                    requiresModifications: isModification,
                    complexity: result.confidence > 0.8 ? 'simple' : 'medium',
                    riskLevel: isModification ? 'medium' : 'low',
                    estimatedMinutes: isModification ? 30 : 10,
                    primaryDomains: [result.category]
                }],
            workflow: isModification ? 'development' : 'reporting',
            reasoning: 'Fallback analysis from legacy format'
        };
    }
    /**
     * Perform semantic search to find relevant files
     */
    async performSemanticSearch(query, projectPath) {
        try {
            const pgClient = await this.dbConnections.getPostgresConnection();
            // Use PostgreSQL's full-text search with embeddings
            const searchQuery = `
        SELECT
          file_path,
          content_summary,
          ts_rank(search_vector, plainto_tsquery($1)) as relevance
        FROM semantic_search_embeddings
        WHERE project_path = $2
          AND search_vector @@ plainto_tsquery($1)
        ORDER BY relevance DESC
        LIMIT 10;
      `;
            const result = await pgClient.query(searchQuery, [query, projectPath]);
            const searchResults = result.rows.map(row => ({
                file: row.file_path,
                relevance: parseFloat(row.relevance),
                summary: row.content_summary
            }));
            // If no semantic search results, use fallback file discovery
            if (searchResults.length === 0) {
                console.log('📋 No semantic search results, using fallback file discovery...');
                return await this.fallbackFileDiscovery(query, projectPath);
            }
            return searchResults;
        }
        catch (error) {
            console.warn('Semantic search failed, using fallback');
            return await this.fallbackFileDiscovery(query, projectPath);
        }
    }
    /**
     * Fallback file discovery when semantic search fails or returns no results
     */
    async fallbackFileDiscovery(query, projectPath) {
        const { glob } = await Promise.resolve().then(() => __importStar(require('glob')));
        const path = await Promise.resolve().then(() => __importStar(require('path')));
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const results = [];
        // For project overview queries OR file creation requests, prioritize key project files
        if (query.toLowerCase().includes('project') || query.toLowerCase().includes('about') ||
            query.toLowerCase().includes('what') || query.toLowerCase().includes('describe') ||
            query.toLowerCase().includes('create') || query.toLowerCase().includes('generate') ||
            query.toLowerCase().includes('add') || query.toLowerCase().includes('build')) {
            const keyFiles = [
                'README.md', 'README.txt', 'readme.md',
                'package.json', 'package-lock.json',
                'tsconfig.json', 'jsconfig.json',
                'src/index.ts', 'src/index.js', 'index.ts', 'index.js',
                'src/main.ts', 'src/main.js', 'main.ts', 'main.js',
                'src/app.ts', 'src/app.js', 'app.ts', 'app.js',
                'client/src/index.tsx', 'client/src/App.tsx', 'client/src/App.js',
                'server/index.js', 'server/app.js', 'server/server.js',
                'client/package.json', 'server/package.json',
                '.codemind/codemind.md', '.codemind/project.json'
            ];
            for (const fileName of keyFiles) {
                const filePath = path.join(projectPath, fileName);
                try {
                    const stats = await fs.stat(filePath);
                    if (stats.isFile()) {
                        results.push({
                            file: fileName,
                            relevance: 0.9,
                            summary: `Key project file: ${fileName}`
                        });
                    }
                }
                catch {
                    // File doesn't exist, continue
                }
            }
            // Also find main TypeScript/JavaScript files
            try {
                const sourceFiles = await glob('src/**/*.{ts,js}', { cwd: projectPath });
                sourceFiles.slice(0, 5).forEach((file, index) => {
                    results.push({
                        file,
                        relevance: 0.7 - (index * 0.1),
                        summary: `Source file: ${file}`
                    });
                });
            }
            catch (error) {
                console.warn('Failed to discover source files:', error.message);
            }
        }
        return results.slice(0, 10); // Limit to 10 results
    }
    // ... Additional helper methods would be implemented here
    buildClaudeCodeCommand(prompt, context, options) {
        // Build actual Claude Code CLI command
        // Create a combined prompt that includes context
        const fullPrompt = `${prompt}\n\nContext:\n${context}`;
        // Return just the prompt text - we'll handle piping in executeWithTokenManagement
        return fullPrompt;
    }
    /**
     * Extract the original user request from a complex prompt for compression context
     */
    extractOriginalRequest(prompt) {
        // Look for common patterns that indicate the original request
        const patterns = [
            /user request[:\s]*["']([^"']+)["']/i,
            /analyze this user request[:\s]*["']([^"']+)["']/i,
            /request[:\s]*["']([^"']+)["']/i,
            /query[:\s]*["']([^"']+)["']/i,
            /"([^"]+)"/g // Last resort: find quoted strings
        ];
        for (const pattern of patterns) {
            const match = prompt.match(pattern);
            if (match && match[1] && match[1].length > 10) {
                return match[1];
            }
        }
        // Fallback: use first line or first 200 characters
        const lines = prompt.split('\n');
        for (const line of lines) {
            if (line.trim().length > 10 && !line.includes('Analyze') && !line.includes('Generate')) {
                return line.trim().substring(0, 200);
            }
        }
        return prompt.substring(0, 200) + '...';
    }
    parseAnalysisResponse(rawResponse) {
        // Parse and validate Claude Code response
        try {
            return JSON.parse(rawResponse);
        }
        catch {
            // Fallback parsing or error handling
            throw new Error('Failed to parse analysis response');
        }
    }
    async storeAnalysisResults(projectPath, analysis) {
        // Store results in PostgreSQL, Neo4j, Redis
        console.log('💾 Storing analysis results in databases...');
        // Implementation would store in all relevant databases
    }
    // SOLID: Delegate to specialized classes with single responsibilities
    async buildEnhancedContext(userRequest, projectPath, relevantFiles, intent) {
        const { ContextBuilder } = await Promise.resolve().then(() => __importStar(require('./integration/context-builder')));
        const contextBuilder = new ContextBuilder();
        return await contextBuilder.build(userRequest, projectPath, relevantFiles, intent);
    }
    async decomposeIntoTasks(userRequest, intent) {
        const { TaskDecomposer } = await Promise.resolve().then(() => __importStar(require('./integration/task-decomposer')));
        const taskDecomposer = new TaskDecomposer();
        return await taskDecomposer.decompose(userRequest, intent);
    }
    async executeTask(task, context) {
        const { TaskExecutor } = await Promise.resolve().then(() => __importStar(require('./integration/task-executor')));
        const taskExecutor = new TaskExecutor();
        return await taskExecutor.execute(task, context);
    }
    async performQualityCheck(result) {
        const { QualityChecker } = await Promise.resolve().then(() => __importStar(require('./quality-checker')));
        const qualityChecker = new QualityChecker();
        return await qualityChecker.check(result);
    }
    async improveTaskResult(result, qualityCheck) {
        const { ResultImprover } = await Promise.resolve().then(() => __importStar(require('./integration/result-improver')));
        const resultImprover = new ResultImprover();
        return await resultImprover.improve(result, qualityCheck);
    }
    async integrateResults(results) {
        const { ResultIntegrator } = await Promise.resolve().then(() => __importStar(require('./integration/result-integrator')));
        const resultIntegrator = new ResultIntegrator();
        return await resultIntegrator.integrate(results);
    }
    async updateKnowledgeBase(analysis) {
        const { KnowledgeBaseUpdater } = await Promise.resolve().then(() => __importStar(require('./integration/knowledge-base-updater')));
        const knowledgeBaseUpdater = new KnowledgeBaseUpdater();
        await knowledgeBaseUpdater.update(analysis);
    }
    async getProjectStructure(projectPath) {
        const { ProjectStructureAnalyzer } = await Promise.resolve().then(() => __importStar(require('./analyzers/project-structure-analyzer')));
        const structureAnalyzer = new ProjectStructureAnalyzer();
        return await structureAnalyzer.analyze(projectPath);
    }
    async getKeyConfigurations(projectPath) {
        const { ConfigurationAnalyzer } = await Promise.resolve().then(() => __importStar(require('./analyzers/configuration-analyzer')));
        const configAnalyzer = new ConfigurationAnalyzer();
        return await configAnalyzer.analyze(projectPath);
    }
    async getRecentChanges(projectPath) {
        const { ChangeAnalyzer } = await Promise.resolve().then(() => __importStar(require('./analyzers/change-analyzer')));
        const changeAnalyzer = new ChangeAnalyzer();
        return await changeAnalyzer.getRecentChanges(projectPath);
    }
    async getProjectDocumentation(projectPath) {
        const { DocumentationAnalyzer } = await Promise.resolve().then(() => __importStar(require('./analyzers/documentation-analyzer')));
        const docAnalyzer = new DocumentationAnalyzer();
        return await docAnalyzer.analyze(projectPath);
    }
}
exports.ClaudeCodeIntegration = ClaudeCodeIntegration;
//# sourceMappingURL=claude-code-integration.js.map