"use strict";
/**
 * Result Improver - Single Responsibility: Improving results based on quality feedback
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResultImprover = void 0;
class ResultImprover {
    async improve(result, qualityCheck) {
        if (qualityCheck.passed) {
            return result;
        }
        console.log('🔧 Improving task result based on quality feedback...');
        const improvedResult = { ...result };
        if (qualityCheck.suggestions.some(s => s.includes('detailed'))) {
            improvedResult.enhanced = true;
            improvedResult.additionalDetails = 'Enhanced with more comprehensive analysis';
        }
        if (qualityCheck.suggestions.some(s => s.includes('verify'))) {
            improvedResult.verified = true;
            improvedResult.confidence = Math.min((improvedResult.confidence || 0.8) + 0.1, 1.0);
        }
        return improvedResult;
    }
}
exports.ResultImprover = ResultImprover;
//# sourceMappingURL=result-improver.js.map