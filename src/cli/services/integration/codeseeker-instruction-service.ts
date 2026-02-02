/**
 * CodeSeeker Instruction Service
 * Reads and processes CODESEEKER.md files for project-specific instructions
 * Mirrors Claude Code's CLAUDE.md functionality with cascading instruction system
 */

import { Logger } from '../../../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export interface ProjectInstruction {
  source: 'global' | 'project' | 'directory' | 'local' | 'agents';
  path: string;
  content: string;
  priority: number;
}

export interface ProjectInstructions {
  instructions: ProjectInstruction[];
  combinedContent: string;
  hasInstructions: boolean;
}

export class CodeSeekerInstructionService {
  private logger: Logger;
  private cachedInstructions: Map<string, ProjectInstructions> = new Map();

  constructor() {
    this.logger = Logger.getInstance();
  }

  /**
   * Load project instructions with cascading priority
   * Mirrors Claude Code's CLAUDE.md hierarchy:
   * 1. Global (~/.codeseeker/CODESEEKER.md) - Priority 1
   * 2. Project root (CODESEEKER.md) - Priority 2
   * 3. Current directory (CODESEEKER.md) - Priority 3
   * 4. Local overrides (.codeseeker/CODESEEKER.local.md) - Priority 4
   * 5. AGENTS.md (project root or .agents/AGENTS.md) - Priority 5
   */
  async loadProjectInstructions(projectPath: string): Promise<ProjectInstructions> {
    const cacheKey = projectPath;

    // Return cached if available
    if (this.cachedInstructions.has(cacheKey)) {
      return this.cachedInstructions.get(cacheKey);
    }

    this.logger.info(`📋 Loading CODESEEKER.md instructions for: ${projectPath}`);

    const instructions: ProjectInstruction[] = [];

    // 1. Global instructions (~/.codeseeker/CODESEEKER.md)
    await this.loadGlobalInstructions(instructions);

    // 2. Project root instructions (CODESEEKER.md)
    await this.loadProjectRootInstructions(projectPath, instructions);

    // 3. Current directory instructions (if different from project root)
    await this.loadDirectoryInstructions(process.cwd(), instructions);

    // 4. Local override instructions (.codeseeker/CODESEEKER.local.md)
    await this.loadLocalInstructions(projectPath, instructions);

    // 5. AGENTS.md instructions (common AI agent instruction file)
    await this.loadAgentsInstructions(projectPath, instructions);

    // Combine instructions by priority
    const combinedContent = this.combineInstructions(instructions);

    const result: ProjectInstructions = {
      instructions,
      combinedContent,
      hasInstructions: instructions.length > 0
    };

    // Cache the result
    this.cachedInstructions.set(cacheKey, result);

    this.logger.info(`📋 Loaded ${instructions.length} instruction files`);

    return result;
  }

  /**
   * Load global instructions from user's home directory
   */
  private async loadGlobalInstructions(instructions: ProjectInstruction[]): Promise<void> {
    const globalPath = path.join(os.homedir(), '.codeseeker', 'CODESEEKER.md');

    try {
      const content = await fs.readFile(globalPath, 'utf-8');
      instructions.push({
        source: 'global',
        path: globalPath,
        content,
        priority: 1
      });
      this.logger.debug(`✓ Loaded global instructions: ${globalPath}`);
    } catch (error) {
      // Global instructions are optional
      this.logger.debug(`No global instructions found: ${globalPath}`);
    }
  }

  /**
   * Load project root instructions
   */
  private async loadProjectRootInstructions(projectPath: string, instructions: ProjectInstruction[]): Promise<void> {
    const projectMdPath = path.join(projectPath, 'CODESEEKER.md');

    try {
      const content = await fs.readFile(projectMdPath, 'utf-8');
      instructions.push({
        source: 'project',
        path: projectMdPath,
        content,
        priority: 2
      });
      this.logger.debug(`✓ Loaded project instructions: ${projectMdPath}`);
    } catch (error) {
      this.logger.debug(`No project instructions found: ${projectMdPath}`);
    }
  }

  /**
   * Load directory-specific instructions (if different from project root)
   */
  private async loadDirectoryInstructions(currentDir: string, instructions: ProjectInstruction[]): Promise<void> {
    const dirMdPath = path.join(currentDir, 'CODESEEKER.md');

    // Skip if it's the same as project root (already loaded)
    if (instructions.some(inst => inst.path === dirMdPath)) {
      return;
    }

    try {
      const content = await fs.readFile(dirMdPath, 'utf-8');
      instructions.push({
        source: 'directory',
        path: dirMdPath,
        content,
        priority: 3
      });
      this.logger.debug(`✓ Loaded directory instructions: ${dirMdPath}`);
    } catch (error) {
      this.logger.debug(`No directory instructions found: ${dirMdPath}`);
    }
  }

  /**
   * Load local override instructions (git-ignored personal settings)
   */
  private async loadLocalInstructions(projectPath: string, instructions: ProjectInstruction[]): Promise<void> {
    const localPath = path.join(projectPath, '.codeseeker', 'CODESEEKER.local.md');

    try {
      const content = await fs.readFile(localPath, 'utf-8');
      instructions.push({
        source: 'local',
        path: localPath,
        content,
        priority: 4
      });
      this.logger.debug(`✓ Loaded local instructions: ${localPath}`);
    } catch (error) {
      this.logger.debug(`No local instructions found: ${localPath}`);
    }
  }

  /**
   * Load AGENTS.md instructions (common AI agent instruction file)
   * Supports both AGENTS.md and .agents/AGENTS.md patterns
   */
  private async loadAgentsInstructions(projectPath: string, instructions: ProjectInstruction[]): Promise<void> {
    // Try project root AGENTS.md first
    const agentsPath = path.join(projectPath, 'AGENTS.md');

    try {
      const content = await fs.readFile(agentsPath, 'utf-8');
      instructions.push({
        source: 'agents',
        path: agentsPath,
        content,
        priority: 5
      });
      this.logger.debug(`✓ Loaded agents instructions: ${agentsPath}`);
      return; // Found at root, don't look further
    } catch (error) {
      this.logger.debug(`No AGENTS.md found at project root: ${agentsPath}`);
    }

    // Try .agents/AGENTS.md as fallback
    const dotAgentsPath = path.join(projectPath, '.agents', 'AGENTS.md');

    try {
      const content = await fs.readFile(dotAgentsPath, 'utf-8');
      instructions.push({
        source: 'agents',
        path: dotAgentsPath,
        content,
        priority: 5
      });
      this.logger.debug(`✓ Loaded agents instructions: ${dotAgentsPath}`);
    } catch (error) {
      this.logger.debug(`No .agents/AGENTS.md found: ${dotAgentsPath}`);
    }
  }

  /**
   * Combine instructions by priority into a single content string
   */
  private combineInstructions(instructions: ProjectInstruction[]): string {
    if (instructions.length === 0) {
      return '';
    }

    // Sort by priority (lower number = higher priority)
    const sortedInstructions = instructions.sort((a, b) => a.priority - b.priority);

    const sections = [
      '# CodeSeeker Project Instructions',
      '',
      '> These instructions are automatically loaded from CODESEEKER.md files',
      '> and provide context for CodeSeeker CLI operations.',
      ''
    ];

    for (const instruction of sortedInstructions) {
      sections.push(`## ${this.getSourceTitle(instruction.source)} Instructions`);
      sections.push(`*Source: ${instruction.path}*`);
      sections.push('');
      sections.push(instruction.content);
      sections.push('');
      sections.push('---');
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * Get user-friendly title for instruction source
   */
  private getSourceTitle(source: string): string {
    switch (source) {
      case 'global': return 'Global';
      case 'project': return 'Project';
      case 'directory': return 'Directory';
      case 'local': return 'Local Override';
      case 'agents': return 'Agents';
      default: return 'Unknown';
    }
  }

  /**
   * Check if project has any CODESEEKER.md instructions
   */
  async hasInstructions(projectPath: string): Promise<boolean> {
    const instructions = await this.loadProjectInstructions(projectPath);
    return instructions.hasInstructions;
  }

  /**
   * Get instructions summary for display
   */
  async getInstructionsSummary(projectPath: string): Promise<string[]> {
    const instructions = await this.loadProjectInstructions(projectPath);

    if (!instructions.hasInstructions) {
      return ['No CODESEEKER.md instructions found'];
    }

    return instructions.instructions.map(inst =>
      `• ${this.getSourceTitle(inst.source)}: ${path.basename(inst.path)}`
    );
  }

  /**
   * Create a sample CODESEEKER.md file for new projects
   */
  async createSampleInstructions(projectPath: string): Promise<void> {
    const samplePath = path.join(projectPath, 'CODESEEKER.md');

    // Check if file already exists
    try {
      await fs.access(samplePath);
      this.logger.info(`CODESEEKER.md already exists: ${samplePath}`);
      return;
    } catch {
      // File doesn't exist, create it
    }

    const sampleContent = `# CODESEEKER.md - Project Instructions

This file provides CodeSeeker CLI with project-specific guidance and context.

## Project Overview

**Description**: [Brief description of your project]
**Architecture**: [Your architecture pattern - e.g., layered, microservices, etc.]
**Tech Stack**: [Your main technologies and frameworks]

## Development Guidelines

### Coding Standards
- Follow existing code patterns in the project
- Maintain consistent naming conventions
- Add appropriate error handling and logging

### Testing Strategy
- Write unit tests for new functions
- Update integration tests when adding features
- Ensure all tests pass before committing

### Build & Deployment
\`\`\`bash
# Build command
npm run build

# Test command
npm test

# Development server
npm run dev
\`\`\`

## CodeSeeker CLI Preferences

### File Handling
- Focus on TypeScript/JavaScript files in /src
- Ignore generated files in /dist, /build
- Pay attention to configuration files in root

### Quality Standards
- Prioritize code readability and maintainability
- Suggest refactoring when complexity is high
- Recommend SOLID principles adherence

### Communication Style
- Provide concise, actionable feedback
- Include relevant code examples
- Explain reasoning behind suggestions

## Project-Specific Notes

### Important Patterns
- [Document any specific patterns unique to your project]
- [Include architectural decisions that should be followed]

### Common Issues
- [Note any common pitfalls or debugging approaches]
- [Document workarounds for known limitations]

---

*This file is read by CodeSeeker CLI to provide project-specific context.*
*Update it as your project evolves to maintain optimal AI assistance.*
`;

    try {
      await fs.writeFile(samplePath, sampleContent);
      this.logger.info(`✓ Created sample CODESEEKER.md: ${samplePath}`);
    } catch (error) {
      this.logger.error(`Failed to create sample CODESEEKER.md: ${error}`);
      throw error;
    }
  }

  /**
   * Clear instruction cache (useful when files change)
   */
  clearCache(): void {
    this.cachedInstructions.clear();
    this.logger.debug('Cleared instruction cache');
  }

  /**
   * Get the combined instructions content for a project
   */
  async getInstructionsContent(projectPath: string): Promise<string> {
    const instructions = await this.loadProjectInstructions(projectPath);
    return instructions.combinedContent;
  }
}

export default CodeSeekerInstructionService;