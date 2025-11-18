"use strict";
/**
 * LLM-based Intention Detection Service
 * Uses existing Claude Code integration to analyze user intentions and assumptions
 * Provides interactive clarification system for ambiguous requests
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMIntentionDetector = void 0;
const command_processor_1 = require("../../../managers/command-processor");
class LLMIntentionDetector {
    enableLLM;
    constructor(enableLLM = true) {
        this.enableLLM = enableLLM;
    }
    async analyzeIntention(userInput) {
        if (!this.enableLLM) {
            return null;
        }
        try {
            const prompt = this.buildAnalysisPrompt(userInput);
            const response = await command_processor_1.CommandProcessor.executeClaudeCode(prompt, {
                maxTokens: 12000, // Increased for comprehensive analysis
                outputFormat: 'text',
                timeout: 90000
            });
            if (!response.success) {
                throw new Error(`Claude Code request failed: ${response.error}`);
            }
            return this.parseResponse(response.data || '');
        }
        catch (error) {
            console.warn(`LLM intention detection failed: ${error.message}`);
            return null;
        }
    }
    /**
     * Get all possible intention types grouped by category
     */
    getIntentionCategories() {
        return {
            'Development': [
                'feature_implementation', 'feature_enhancement', 'new_component', 'new_service', 'new_utility',
                'api_development', 'ui_development', 'database_changes', 'integration_development'
            ],
            'Maintenance': [
                'bug_fix', 'hotfix', 'performance_optimization', 'security_fix', 'dependency_update',
                'code_cleanup', 'technical_debt_reduction', 'legacy_modernization'
            ],
            'Architecture & Design': [
                'refactoring', 'architectural_change', 'design_pattern_implementation',
                'scalability_improvement', 'modularity_improvement', 'abstraction_addition'
            ],
            'Quality & Testing': [
                'testing', 'test_automation', 'code_review', 'quality_assurance',
                'performance_testing', 'security_testing', 'integration_testing'
            ],
            'Research & Analysis': [
                'codebase_analysis', 'requirement_analysis', 'feasibility_study', 'research',
                'documentation_review', 'impact_analysis', 'technology_evaluation'
            ],
            'Documentation': [
                'documentation', 'code_documentation', 'api_documentation', 'user_documentation',
                'architecture_documentation', 'process_documentation', 'knowledge_transfer'
            ],
            'DevOps & Operations': [
                'deployment', 'configuration', 'monitoring_setup', 'ci_cd_setup',
                'infrastructure_setup', 'environment_setup', 'automation_script'
            ],
            'Learning & Exploration': [
                'learning', 'proof_of_concept', 'experimental_feature', 'technology_spike',
                'prototype_development', 'concept_validation'
            ],
            'Project Management': [
                'planning', 'estimation', 'task_breakdown', 'project_setup',
                'workflow_optimization', 'process_improvement'
            ]
        };
    }
    /**
     * Apply user clarifications to create final instructions
     */
    applyClarifications(analysis, clarifications) {
        const instructions = [];
        // Add primary intent
        instructions.push(`PRIMARY INTENTION: ${analysis.primaryIntent}`);
        // Add sub-intents if any
        if (analysis.subIntents.length > 0) {
            instructions.push(`SECONDARY INTENTIONS: ${analysis.subIntents.join(', ')}`);
        }
        // Process clarifications
        instructions.push('\nUSER CLARIFICATIONS:');
        for (const clarification of clarifications) {
            const ambiguity = analysis.ambiguities.find(a => a.id === clarification.ambiguityId);
            if (ambiguity) {
                if (clarification.selectedOption !== undefined) {
                    const selectedOption = ambiguity.options[clarification.selectedOption];
                    instructions.push(`- ${ambiguity.area}: ${selectedOption}`);
                }
                else if (clarification.customInput) {
                    instructions.push(`- ${ambiguity.area}: ${clarification.customInput}`);
                }
            }
        }
        // Add confirmed assumptions
        instructions.push('\nCONFIRMED ASSUMPTIONS:');
        analysis.assumptions.forEach(assumption => {
            instructions.push(`- ${assumption.category}: ${assumption.description}`);
        });
        // Add constraints
        instructions.push('\nCONSTRAINTS:');
        instructions.push(`- Urgency: ${analysis.urgency}`);
        instructions.push(`- Complexity: ${analysis.complexity}`);
        instructions.push(`- Estimated Duration: ${analysis.estimatedDuration}`);
        if (analysis.requiredSkills.length > 0) {
            instructions.push(`- Required Skills: ${analysis.requiredSkills.join(', ')}`);
        }
        if (analysis.potentialRisks.length > 0) {
            instructions.push(`- Potential Risks: ${analysis.potentialRisks.join(', ')}`);
        }
        return {
            ...analysis,
            userClarifications: clarifications,
            finalInstructions: instructions.join('\n')
        };
    }
    buildAnalysisPrompt(userInput) {
        const intentionTypes = Object.values(this.getIntentionCategories()).flat();
        return `
You are an expert software development analyst. Analyze the user request comprehensively and identify all intentions, assumptions, and ambiguities.

USER REQUEST: "${userInput}"

Note: Project context and session continuity are handled automatically by Claude Code CLI.

AVAILABLE INTENTION TYPES:
${intentionTypes.map(type => `- ${type}`).join('\n')}

ANALYSIS REQUIREMENTS:

1. **Primary Intent**: Select the most specific intention type from the list above
2. **Confidence**: How confident are you (0-1 scale)
3. **Sub-intents**: Additional secondary intentions (up to 3)
4. **Assumptions**: Identify assumptions in these categories:
   - scope, approach, technology, architecture, data, integration, behavior, format
   - timeline, quality, performance, security, testing, deployment, maintenance, compatibility, resources
5. **Ambiguities**: Create numbered options for user selection
6. **Urgency**: low/medium/high/critical
7. **Complexity**: trivial/simple/moderate/complex/very_complex/unknown
8. **Duration**: minutes/hours/days/weeks/unknown
9. **Skills**: Required technical skills
10. **Risks**: Potential implementation risks

FOR AMBIGUITIES: Create specific selectable options with IDs. Each ambiguity should have:
- Unique ID (amb_1, amb_2, etc.)
- 3-5 specific options user can choose from
- Allow custom input option

RESPOND WITH VALID JSON ONLY:

{
  "primaryIntent": "specific_intention_type_from_list",
  "confidence": 0.85,
  "subIntents": ["secondary_intention_1", "secondary_intention_2"],
  "assumptions": [
    {
      "category": "scope",
      "description": "Specific assumption description",
      "confidence": 0.8,
      "alternatives": ["alternative 1", "alternative 2", "alternative 3"],
      "impact": "medium",
      "userSelectable": true
    }
  ],
  "ambiguities": [
    {
      "id": "amb_1",
      "area": "Implementation Scope",
      "reason": "Request doesn't specify complete vs minimal implementation",
      "clarificationNeeded": "What level of implementation do you want?",
      "options": [
        "Minimal working prototype",
        "Basic functionality with error handling",
        "Production-ready with full features",
        "Enterprise-grade with comprehensive testing"
      ],
      "allowCustomInput": true,
      "priority": "high"
    }
  ],
  "urgency": "medium",
  "complexity": "moderate",
  "estimatedDuration": "hours",
  "requiredSkills": ["TypeScript", "Node.js", "Database Design"],
  "potentialRisks": ["Breaking changes to existing API", "Performance impact on large datasets"]
}

Remember: Use exact intention types from the provided list. Create actionable ambiguities with clear options.
`;
    }
    parseResponse(response) {
        try {
            // Clean the response to extract JSON
            let cleanedResponse = response.trim();
            // Remove markdown code blocks if present
            cleanedResponse = cleanedResponse.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1');
            // Find JSON object boundaries
            const jsonStart = cleanedResponse.indexOf('{');
            const jsonEnd = cleanedResponse.lastIndexOf('}') + 1;
            if (jsonStart >= 0 && jsonEnd > jsonStart) {
                cleanedResponse = cleanedResponse.substring(jsonStart, jsonEnd);
            }
            const parsed = JSON.parse(cleanedResponse);
            // Validate required fields
            if (!parsed.primaryIntent || typeof parsed.confidence !== 'number') {
                throw new Error('Invalid response structure from LLM - missing required fields');
            }
            // Ensure confidence is in valid range
            parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));
            // Ensure arrays exist
            parsed.subIntents = parsed.subIntents || [];
            parsed.assumptions = parsed.assumptions || [];
            parsed.ambiguities = parsed.ambiguities || [];
            parsed.requiredSkills = parsed.requiredSkills || [];
            parsed.potentialRisks = parsed.potentialRisks || [];
            // Validate and normalize assumptions
            parsed.assumptions = parsed.assumptions.map((assumption) => ({
                category: assumption.category || 'scope',
                description: assumption.description || '',
                confidence: Math.max(0, Math.min(1, assumption.confidence || 0.5)),
                alternatives: assumption.alternatives || [],
                impact: assumption.impact || 'medium',
                userSelectable: assumption.userSelectable || false
            }));
            // Validate and normalize ambiguities
            parsed.ambiguities = parsed.ambiguities.map((ambiguity, index) => ({
                id: ambiguity.id || `amb_${index + 1}`,
                area: ambiguity.area || 'Unspecified Area',
                reason: ambiguity.reason || '',
                clarificationNeeded: ambiguity.clarificationNeeded || '',
                options: ambiguity.options || [],
                allowCustomInput: ambiguity.allowCustomInput || true,
                priority: ambiguity.priority || 'medium'
            }));
            return {
                primaryIntent: parsed.primaryIntent,
                confidence: parsed.confidence,
                subIntents: parsed.subIntents,
                assumptions: parsed.assumptions,
                ambiguities: parsed.ambiguities,
                urgency: parsed.urgency || 'medium',
                complexity: parsed.complexity || 'unknown',
                estimatedDuration: parsed.estimatedDuration || 'unknown',
                requiredSkills: parsed.requiredSkills,
                potentialRisks: parsed.potentialRisks
            };
        }
        catch (error) {
            throw new Error(`Failed to parse LLM response: ${error.message}`);
        }
    }
    setEnabled(enabled) {
        this.enableLLM = enabled;
    }
    isEnabled() {
        return this.enableLLM;
    }
}
exports.LLMIntentionDetector = LLMIntentionDetector;
//# sourceMappingURL=llm-intention-detector.js.map