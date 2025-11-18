"use strict";
/**
 * Intent Analyzer - Claude-powered intention analysis
 * Analyzes user requests to determine intent, complexity, and required tools
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentAnalyzer = void 0;
const logger_1 = require("../../../../utils/logger");
class IntentAnalyzer {
    logger = logger_1.Logger.getInstance();
    async analyzeIntent(request) {
        this.logger.info(`🎯 Analyzing intent: "${request.query}"`);
        try {
            // Build context-aware prompt for Claude
            const analysisPrompt = this.buildIntentAnalysisPrompt(request);
            // Process with Claude (simulated for now, would use actual Claude API)
            const claudeResponse = await this.processWithClaude(analysisPrompt);
            // Parse and validate Claude's response
            const intent = this.parseIntentResponse(claudeResponse, request.query);
            // Add project-specific adjustments
            const adjustedIntent = this.adjustForProjectContext(intent, request.projectContext);
            this.logger.info(`Intent: ${adjustedIntent.intention} (${adjustedIntent.complexity}, ${adjustedIntent.suggestedTools.length} tools)`);
            return adjustedIntent;
        }
        catch (error) {
            this.logger.error('Intent analysis failed, using fallback:', error);
            return this.generateFallbackIntent(request.query);
        }
    }
    buildIntentAnalysisPrompt(request) {
        const projectInfo = request.projectContext ?
            `Project: ${request.projectContext.projectType}, Languages: ${request.projectContext.languages.join(', ')}, Frameworks: ${request.projectContext.frameworks.join(', ')}` :
            'Project context not available';
        return `# Intent Analysis Request

## User Query
"${request.query}"

## Project Context  
${projectInfo}

## Analysis Instructions
Analyze this user request and provide a JSON response with the following structure:

{
  "intention": "string", // Primary intention (add_feature, refactor_code, fix_bug, improve_performance, add_tests, etc.)
  "complexity": "simple|medium|complex", // Based on scope and effort required
  "estimatedFiles": number, // How many files likely to be affected (1-50)
  "suggestedTools": ["tool1", "tool2"], // Required tools from: semantic_search, code_graph, quality_checks, test_generation, security_scan, performance_analysis, documentation_gen
  "riskLevel": "low|medium|high", // Risk of breaking existing functionality
  "primaryDomains": ["domain1", "domain2"], // Code domains affected: authentication, database, ui, api, testing, configuration, etc.
  "timeEstimate": number, // Estimated minutes to complete (5-180)
  "confidence": number, // Confidence in this analysis (0.0-1.0)
  "reasoning": "string" // Brief explanation of the analysis
}

## Analysis Guidelines
- **Simple**: Single file changes, minimal dependencies (5-30 min)
- **Medium**: Multiple related files, some testing required (30-90 min)  
- **Complex**: Cross-cutting changes, extensive testing, architectural impact (90+ min)

- **Low Risk**: Isolated changes, well-tested areas
- **Medium Risk**: Core functionality changes, moderate dependencies
- **High Risk**: Architecture changes, security-critical areas, database schema

- **Tool Selection**:
  - semantic_search: Always needed for finding relevant files
  - code_graph: For understanding dependencies and relationships
  - quality_checks: For compilation, linting, testing
  - test_generation: When adding new features or fixing bugs
  - security_scan: For authentication, authorization, data handling
  - performance_analysis: For optimization requests
  - documentation_gen: For significant feature additions

Provide only the JSON response, no additional text.`;
    }
    async processWithClaude(prompt) {
        // Simulate Claude API call - in real implementation, this would call Claude
        this.logger.debug(`Sending ${Math.round(prompt.length / 1000)}KB prompt to Claude...`);
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Mock Claude response based on query patterns
        const mockResponse = this.generateMockClaudeResponse(prompt);
        this.logger.debug('Received Claude intent analysis response');
        return mockResponse;
    }
    generateMockClaudeResponse(prompt) {
        // Extract query from prompt for pattern matching
        const queryMatch = prompt.match(/"([^"]+)"/);
        const query = queryMatch ? queryMatch[1].toLowerCase() : '';
        // Pattern-based intent recognition
        if (query.includes('add') || query.includes('implement') || query.includes('create')) {
            if (query.includes('test')) {
                return JSON.stringify({
                    intention: 'add_tests',
                    complexity: 'medium',
                    estimatedFiles: 4,
                    suggestedTools: ['semantic_search', 'code_graph', 'test_generation', 'quality_checks'],
                    riskLevel: 'low',
                    primaryDomains: ['testing'],
                    timeEstimate: 45,
                    confidence: 0.9,
                    reasoning: 'Adding tests is typically straightforward with moderate file impact'
                });
            }
            else if (query.includes('auth') || query.includes('login') || query.includes('security')) {
                return JSON.stringify({
                    intention: 'add_feature',
                    complexity: 'complex',
                    estimatedFiles: 8,
                    suggestedTools: ['semantic_search', 'code_graph', 'security_scan', 'test_generation', 'quality_checks'],
                    riskLevel: 'high',
                    primaryDomains: ['authentication', 'security', 'api'],
                    timeEstimate: 120,
                    confidence: 0.85,
                    reasoning: 'Authentication features are complex and security-critical'
                });
            }
            else {
                return JSON.stringify({
                    intention: 'add_feature',
                    complexity: 'medium',
                    estimatedFiles: 5,
                    suggestedTools: ['semantic_search', 'code_graph', 'test_generation', 'quality_checks'],
                    riskLevel: 'medium',
                    primaryDomains: ['api', 'ui'],
                    timeEstimate: 60,
                    confidence: 0.8,
                    reasoning: 'Standard feature addition with moderate complexity'
                });
            }
        }
        else if (query.includes('refactor') || query.includes('improve') || query.includes('clean')) {
            return JSON.stringify({
                intention: 'refactor_code',
                complexity: 'medium',
                estimatedFiles: 6,
                suggestedTools: ['semantic_search', 'code_graph', 'quality_checks', 'test_generation'],
                riskLevel: 'medium',
                primaryDomains: ['architecture', 'code_quality'],
                timeEstimate: 75,
                confidence: 0.85,
                reasoning: 'Refactoring requires careful analysis of dependencies and testing'
            });
        }
        else if (query.includes('fix') || query.includes('bug') || query.includes('error')) {
            return JSON.stringify({
                intention: 'fix_bug',
                complexity: 'simple',
                estimatedFiles: 2,
                suggestedTools: ['semantic_search', 'code_graph', 'quality_checks'],
                riskLevel: 'low',
                primaryDomains: ['debugging'],
                timeEstimate: 30,
                confidence: 0.75,
                reasoning: 'Bug fixes are typically localized with limited scope'
            });
        }
        else if (query.includes('optimize') || query.includes('performance') || query.includes('speed')) {
            return JSON.stringify({
                intention: 'improve_performance',
                complexity: 'medium',
                estimatedFiles: 4,
                suggestedTools: ['semantic_search', 'code_graph', 'performance_analysis', 'quality_checks'],
                riskLevel: 'medium',
                primaryDomains: ['performance', 'optimization'],
                timeEstimate: 90,
                confidence: 0.8,
                reasoning: 'Performance optimization requires analysis and careful testing'
            });
        }
        // Default fallback
        return JSON.stringify({
            intention: 'general_analysis',
            complexity: 'simple',
            estimatedFiles: 3,
            suggestedTools: ['semantic_search', 'code_graph'],
            riskLevel: 'low',
            primaryDomains: ['analysis'],
            timeEstimate: 20,
            confidence: 0.6,
            reasoning: 'General query with standard analysis approach'
        });
    }
    parseIntentResponse(response, originalQuery) {
        try {
            const parsed = JSON.parse(response);
            // Validate required fields
            const intent = {
                intention: parsed.intention || 'general_analysis',
                complexity: this.validateComplexity(parsed.complexity),
                estimatedFiles: Math.max(1, Math.min(50, parsed.estimatedFiles || 3)),
                suggestedTools: this.validateTools(parsed.suggestedTools || ['semantic_search']),
                riskLevel: this.validateRiskLevel(parsed.riskLevel),
                primaryDomains: parsed.primaryDomains || ['general'],
                timeEstimate: Math.max(5, Math.min(180, parsed.timeEstimate || 30)),
                confidence: Math.max(0, Math.min(1, parsed.confidence || 0.7))
            };
            return intent;
        }
        catch (error) {
            this.logger.warn('Failed to parse Claude response, using fallback');
            return this.generateFallbackIntent(originalQuery);
        }
    }
    adjustForProjectContext(intent, context) {
        if (!context)
            return intent;
        // Adjust complexity based on project size and languages
        if (context.languages?.includes('TypeScript') || context.languages?.includes('JavaScript')) {
            // JS/TS projects tend to have more files affected
            intent.estimatedFiles = Math.min(50, Math.round(intent.estimatedFiles * 1.2));
        }
        if (context.projectType === 'api_service' && intent.primaryDomains.includes('api')) {
            // API services require more testing
            if (!intent.suggestedTools.includes('test_generation')) {
                intent.suggestedTools.push('test_generation');
            }
        }
        if (context.frameworks?.includes('React') && intent.primaryDomains.includes('ui')) {
            // React projects may need component updates
            intent.estimatedFiles = Math.min(50, intent.estimatedFiles + 2);
        }
        return intent;
    }
    generateFallbackIntent(query) {
        return {
            intention: 'general_analysis',
            complexity: 'simple',
            estimatedFiles: 3,
            suggestedTools: ['semantic_search', 'code_graph'],
            riskLevel: 'low',
            primaryDomains: ['general'],
            timeEstimate: 30,
            confidence: 0.5
        };
    }
    validateComplexity(complexity) {
        return ['simple', 'medium', 'complex'].includes(complexity) ? complexity : 'simple';
    }
    validateRiskLevel(risk) {
        return ['low', 'medium', 'high'].includes(risk) ? risk : 'low';
    }
    validateTools(tools) {
        const validTools = [
            'semantic_search', 'code_graph', 'quality_checks', 'test_generation',
            'security_scan', 'performance_analysis', 'documentation_gen'
        ];
        if (!Array.isArray(tools))
            return ['semantic_search'];
        const filtered = tools.filter(tool => validTools.includes(tool));
        return filtered.length > 0 ? filtered : ['semantic_search'];
    }
}
exports.IntentAnalyzer = IntentAnalyzer;
exports.default = IntentAnalyzer;
//# sourceMappingURL=intent-analyzer.js.map