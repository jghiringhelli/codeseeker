/**
 * Prerequisite Checker Service
 * Single Responsibility: Validate project and environment prerequisites
 */
import { IPrerequisiteChecker, SetupResult } from './interfaces/setup-interfaces';
export declare class PrerequisiteChecker implements IPrerequisiteChecker {
    checkProject(projectPath?: string): Promise<SetupResult>;
    checkNodeVersion(): SetupResult;
}
//# sourceMappingURL=prerequisite-checker.d.ts.map