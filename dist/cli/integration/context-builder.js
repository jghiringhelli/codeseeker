"use strict";
/**
 * Context Builder - Single Responsibility: Building enhanced context for Claude Code
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
exports.ContextBuilder = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ContextBuilder {
    async build(userRequest, projectPath, relevantFiles, intent) {
        const context = [];
        // Add user request with SOLID architectural guidance if needed
        context.push(`USER REQUEST: ${userRequest}`);
        // Check if architectural commands are needed (SOLID, patterns, etc.)
        if (this.requiresArchitecturalGuidance(userRequest)) {
            const { ContextOptimizer } = await Promise.resolve().then(() => __importStar(require('../context-optimizer')));
            const contextOptimizer = new ContextOptimizer();
            const optimizationRequest = {
                projectPath,
                query: userRequest,
                tokenBudget: 2000,
                strategy: 'smart',
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
                }
                catch (error) {
                    context.push(`\n--- ${file} --- (error reading file)`);
                }
            }
        }
        return context.join('\n');
    }
    requiresArchitecturalGuidance(userRequest) {
        const architecturalKeywords = [
            'solid', 'architecture', 'pattern', 'design', 'refactor', 'structure',
            'single responsibility', 'open closed', 'liskov', 'interface segregation',
            'dependency inversion', 'clean code', 'principles'
        ];
        return architecturalKeywords.some(keyword => userRequest.toLowerCase().includes(keyword));
    }
}
exports.ContextBuilder = ContextBuilder;
//# sourceMappingURL=context-builder.js.map