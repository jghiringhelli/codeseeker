"use strict";
/**
 * Change Analyzer - Single Responsibility: Analyzing recent changes via git
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangeAnalyzer = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class ChangeAnalyzer {
    async getRecentChanges(projectPath) {
        try {
            const { stdout } = await execAsync('git log --oneline -10', { cwd: projectPath });
            return `RECENT GIT CHANGES:\n${stdout}`;
        }
        catch (error) {
            return null;
        }
    }
}
exports.ChangeAnalyzer = ChangeAnalyzer;
//# sourceMappingURL=change-analyzer.js.map