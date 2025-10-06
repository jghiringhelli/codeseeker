"use strict";
/**
 * Assumption Detector Service
 * Analyzes user requests to identify potential assumptions and ambiguities
 * Provides structured feedback for Claude Code integration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssumptionDetector = void 0;
class AssumptionDetector {
    /**
     * Analyze user input for assumptions and ambiguities
     */
    analyzeRequest(userInput, projectContext) {
        const input = userInput.toLowerCase();
        const assumptions = [];
        const clarificationNeeded = [];
        const suggestedQuestions = [];
        // Bug fix scoping assumptions
        if (this.hasBugFixIntent(input)) {
            assumptions.push({
                category: 'bugfix',
                assumption: 'Will assume this is a single class/limited scope fix that can be resolved with minimal changes',
                alternatives: [
                    'Wider architectural changes may be needed',
                    'Multiple classes or modules might require updates',
                    'Root cause analysis might reveal deeper issues',
                    'Cross-cutting concerns may need attention'
                ],
                confidence: 'high'
            });
            clarificationNeeded.push('Bug fix scope and impact assessment');
            suggestedQuestions.push('Should I start with a minimal fix or do a broader impact analysis first?');
        }
        // Approach assumptions: Implementation vs Research
        if (this.hasApproachAmbiguity(input)) {
            assumptions.push({
                category: 'approach',
                assumption: 'Will implement a custom solution rather than researching existing libraries',
                alternatives: [
                    'Research and recommend existing libraries/tools first',
                    'Evaluate multiple approaches before implementing',
                    'Provide analysis of build vs buy options',
                    'Survey the ecosystem before writing code'
                ],
                confidence: 'high'
            });
            clarificationNeeded.push('Implementation vs research approach');
            suggestedQuestions.push('Should I implement a solution or first research existing libraries/tools?');
        }
        // Implementation approach assumptions
        if (this.hasImplementationAmbiguity(input)) {
            assumptions.push({
                category: 'implementation',
                assumption: 'Will use existing codebase patterns and architectural style',
                alternatives: [
                    'Create new utilities from scratch',
                    'Use external libraries/frameworks',
                    'Follow specific design patterns'
                ],
                confidence: 'high'
            });
            clarificationNeeded.push('Implementation approach preference');
            suggestedQuestions.push('Should I use existing code patterns or create new implementations?');
        }
        // Scope and completeness assumptions
        if (this.hasScopeAmbiguity(input)) {
            assumptions.push({
                category: 'scope',
                assumption: 'Will implement complete production-ready feature with error handling',
                alternatives: [
                    'Minimal working prototype',
                    'Basic functionality only',
                    'Full enterprise-grade implementation'
                ],
                confidence: 'high'
            });
            clarificationNeeded.push('Implementation scope and completeness level');
            suggestedQuestions.push('Do you want a complete feature or a minimal prototype?');
        }
        // Data/mock assumptions
        if (this.hasDataAmbiguity(input)) {
            assumptions.push({
                category: 'data',
                assumption: 'Will create realistic mock data and placeholder implementations',
                alternatives: [
                    'Use minimal placeholder data',
                    'Leave TODO comments for real data integration',
                    'Connect to actual data sources'
                ],
                confidence: 'medium'
            });
            clarificationNeeded.push('Data handling approach');
            suggestedQuestions.push('Should I use mock data, connect to real data, or leave integration TODOs?');
        }
        // Format and structure assumptions
        if (this.hasFormatAmbiguity(input)) {
            assumptions.push({
                category: 'format',
                assumption: 'Will match existing code style and project conventions',
                alternatives: [
                    'Use modern best practices',
                    'Follow specific style guide',
                    'Ask for detailed formatting preferences'
                ],
                confidence: 'medium'
            });
            clarificationNeeded.push('Code style and formatting preferences');
        }
        // Integration assumptions
        if (this.hasIntegrationAmbiguity(input)) {
            assumptions.push({
                category: 'integration',
                assumption: 'Will integrate with existing project structure and dependencies',
                alternatives: [
                    'Create standalone implementation',
                    'Add new dependencies as needed',
                    'Modify existing integrations'
                ],
                confidence: 'high'
            });
            clarificationNeeded.push('Integration approach with existing code');
            suggestedQuestions.push('Should this integrate with existing systems or be standalone?');
        }
        // Behavior assumptions
        if (this.hasBehaviorAmbiguity(input)) {
            assumptions.push({
                category: 'behavior',
                assumption: 'Will implement standard behavior patterns for this type of feature',
                alternatives: [
                    'Custom behavior specific to your needs',
                    'Configurable behavior options',
                    'Minimal behavior with extension points'
                ],
                confidence: 'medium'
            });
            clarificationNeeded.push('Expected behavior and interaction patterns');
            suggestedQuestions.push('Are there specific behaviors or interactions you want?');
        }
        return {
            hasAmbiguities: assumptions.length > 0,
            assumptions,
            clarificationNeeded,
            suggestedQuestions
        };
    }
    /**
     * Generate structured prompt enhancement for Claude Code
     */
    generatePromptEnhancement(analysis) {
        if (!analysis.hasAmbiguities) {
            return '';
        }
        let enhancement = '\n\n**ASSUMPTION DETECTION:**\n';
        enhancement += 'The following assumptions were detected in this request:\n\n';
        // Check for bug fix assumptions first and handle specially
        const bugFixAssumption = analysis.assumptions.find(a => a.category === 'bugfix');
        if (bugFixAssumption) {
            enhancement += `**BUG FIX SCOPING**: ${bugFixAssumption.assumption}\n`;
            enhancement += '**IMPORTANT**: If during analysis I discover the fix requires broader changes than a single class/limited scope, I will:\n';
            enhancement += '   1. Stop the current approach\n';
            enhancement += '   2. Explain why a wider fix is needed\n';
            enhancement += '   3. Describe the broader scope required\n';
            enhancement += '   4. Ask for confirmation before proceeding\n\n';
        }
        analysis.assumptions.forEach((assumption, index) => {
            if (assumption.category !== 'bugfix') { // Skip bugfix as it's handled above
                enhancement += `${index + 1}. **${assumption.category.toUpperCase()}**: ${assumption.assumption}\n`;
                if (assumption.alternatives) {
                    enhancement += '   Alternatives to consider:\n';
                    assumption.alternatives.forEach(alt => {
                        enhancement += `   - ${alt}\n`;
                    });
                }
                enhancement += '\n';
            }
        });
        if (analysis.clarificationNeeded.length > 0) {
            enhancement += '**CLARIFICATION NEEDED:**\n';
            analysis.clarificationNeeded.forEach(item => {
                enhancement += `- ${item}\n`;
            });
            enhancement += '\n';
        }
        enhancement += '**PLEASE:**\n';
        enhancement += '1. Acknowledge these assumptions in your response\n';
        enhancement += '2. Ask for clarification on ambiguous points BEFORE implementing\n';
        enhancement += '3. Provide alternatives when multiple approaches are possible\n';
        enhancement += '4. Include an "assumptions" field in your JSON response\n';
        if (bugFixAssumption) {
            enhancement += '5. **FOR BUG FIXES**: Start with minimal scope and escalate if broader changes are needed\n';
        }
        return enhancement;
    }
    // Detection methods for different types of ambiguities
    /**
     * Detect when user might want research vs immediate implementation
     */
    hasApproachAmbiguity(input) {
        const implementationKeywords = [
            'create', 'implement', 'build', 'add', 'make', 'develop',
            'write', 'code', 'setup', 'configure', 'install'
        ];
        const systemKeywords = [
            'system', 'service', 'component', 'feature', 'functionality',
            'solution', 'tool', 'utility', 'library', 'framework',
            'authentication', 'logging', 'validation', 'caching', 'testing',
            'monitoring', 'analytics', 'dashboard', 'api', 'database',
            'queue', 'scheduler', 'parser', 'generator', 'converter'
        ];
        const hasImplementationIntent = implementationKeywords.some(keyword => input.includes(keyword));
        const hasSystemKeyword = systemKeywords.some(keyword => input.includes(keyword));
        // Exclude research indicators
        const researchKeywords = [
            'research', 'find', 'recommend', 'suggest', 'compare', 'evaluate',
            'best', 'options', 'alternatives', 'libraries', 'tools', 'existing',
            'available', 'popular', 'which', 'what are', 'how do'
        ];
        const hasResearchIntent = researchKeywords.some(keyword => input.includes(keyword));
        // High chance of approach ambiguity if requesting to implement complex systems
        // without explicit research intent
        return hasImplementationIntent && hasSystemKeyword && !hasResearchIntent;
    }
    hasImplementationAmbiguity(input) {
        const keywords = [
            'create', 'implement', 'build', 'add', 'make', 'develop',
            'system', 'service', 'component', 'feature', 'function',
            'module', 'class', 'interface'
        ];
        return keywords.some(keyword => input.includes(keyword));
    }
    hasScopeAmbiguity(input) {
        const ambiguousScopes = [
            'complete', 'full', 'entire', 'comprehensive', 'robust',
            'system', 'solution', 'functionality', 'feature'
        ];
        const minimalIndicators = [
            'simple', 'basic', 'quick', 'minimal', 'prototype'
        ];
        return ambiguousScopes.some(scope => input.includes(scope)) &&
            !minimalIndicators.some(minimal => input.includes(minimal));
    }
    hasDataAmbiguity(input) {
        const dataKeywords = [
            'data', 'mock', 'sample', 'example', 'test data',
            'placeholder', 'dummy', 'fake', 'api', 'database'
        ];
        return dataKeywords.some(keyword => input.includes(keyword));
    }
    hasFormatAmbiguity(input) {
        const formatKeywords = [
            'format', 'style', 'structure', 'layout', 'design',
            'ui', 'interface', 'display', 'show', 'present'
        ];
        return formatKeywords.some(keyword => input.includes(keyword));
    }
    hasIntegrationAmbiguity(input) {
        const integrationKeywords = [
            'integrate', 'connect', 'link', 'combine', 'merge'
        ];
        const contextualKeywords = [
            'existing project', 'existing code', 'existing system',
            'current project', 'current system', 'current code',
            'with existing', 'using existing', 'extend existing'
        ];
        return integrationKeywords.some(keyword => input.includes(keyword)) ||
            contextualKeywords.some(phrase => input.includes(phrase));
    }
    hasBehaviorAmbiguity(input) {
        const behaviorKeywords = [
            'handle', 'manage', 'process', 'when', 'if', 'should',
            'behavior', 'action', 'response', 'react', 'trigger'
        ];
        return behaviorKeywords.some(keyword => input.includes(keyword));
    }
    /**
     * Detect when user is requesting bug fixes
     */
    hasBugFixIntent(input) {
        const bugKeywords = [
            'fix', 'bug', 'error', 'issue', 'problem', 'broken',
            'not working', 'failing', 'crash', 'exception',
            'incorrect', 'wrong', 'unexpected', 'debug'
        ];
        const fixActionKeywords = [
            'fix the', 'fix this', 'resolve', 'solve', 'repair',
            'correct', 'address', 'handle the issue', 'handle the error',
            'debug the', 'troubleshoot'
        ];
        const maintenanceKeywords = [
            'patch', 'hotfix', 'bugfix', 'maintenance'
        ];
        return bugKeywords.some(keyword => input.includes(keyword)) ||
            fixActionKeywords.some(keyword => input.includes(keyword)) ||
            maintenanceKeywords.some(keyword => input.includes(keyword));
    }
}
exports.AssumptionDetector = AssumptionDetector;
exports.default = AssumptionDetector;
//# sourceMappingURL=assumption-detector.js.map