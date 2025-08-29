"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IssuesDetector = void 0;
/**
 * Issues Detector for Claude integration
 */
class IssuesDetector {
    async detectIssues(params) {
        // Mock implementation for issues detection
        return {
            issues: [],
            summary: 'No critical issues detected',
            projectPath: params.projectPath
        };
    }
}
exports.IssuesDetector = IssuesDetector;
exports.default = IssuesDetector;
//# sourceMappingURL=claude-issues-detector.js.map