/**
 * Project Detection Service - Single Responsibility
 * Handles project type detection and configuration reading
 */
import { IProjectDetector, ProjectConfig } from '../../../core/interfaces/project-interfaces';
export declare class ProjectDetector implements IProjectDetector {
    detectProjectType(projectPath: string): Promise<string>;
    getProjectConfig(projectPath: string): Promise<ProjectConfig | null>;
}
//# sourceMappingURL=project-detector.d.ts.map