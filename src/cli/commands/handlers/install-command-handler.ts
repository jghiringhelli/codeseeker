/**
 * Install Command Handler
 * Single Responsibility: Handle MCP configuration installation for various IDEs
 *
 * Usage:
 *   codeseeker install --copilot          Configure VS Code + GitHub Copilot
 *   codeseeker install --cursor           Configure Cursor IDE
 *   codeseeker install --vscode           Configure VS Code (same as --copilot)
 *   codeseeker install --visual-studio    Configure Visual Studio
 *   codeseeker install --global           Install to global/user settings (default: workspace)
 *   codeseeker install --list             List current MCP configurations
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { BaseCommandHandler } from '../base-command-handler';
import { CommandResult } from '../command-context';
import { Theme } from '../../ui/theme';
import { Logger } from '../../../utils/logger';

interface McpConfig {
  mcpServers: {
    codeseeker: {
      command: string;
      args: string[];
      env?: Record<string, string>;
    };
  };
}

interface IdeConfig {
  name: string;
  configDir: string;
  configFile: string;
  globalConfigPath?: string;
  description: string;
}

export class InstallCommandHandler extends BaseCommandHandler {
  private logger = Logger.getInstance().child('InstallCommandHandler');

  // IDE configuration mappings
  private readonly ideConfigs: Record<string, IdeConfig> = {
    copilot: {
      name: 'VS Code + GitHub Copilot',
      configDir: '.vscode',
      configFile: 'mcp.json',
      globalConfigPath: this.getVSCodeGlobalConfigPath(),
      description: 'MCP configuration for GitHub Copilot in VS Code'
    },
    vscode: {
      name: 'VS Code + GitHub Copilot',
      configDir: '.vscode',
      configFile: 'mcp.json',
      globalConfigPath: this.getVSCodeGlobalConfigPath(),
      description: 'MCP configuration for GitHub Copilot in VS Code'
    },
    cursor: {
      name: 'Cursor',
      configDir: '.cursor',
      configFile: 'mcp.json',
      globalConfigPath: this.getCursorGlobalConfigPath(),
      description: 'MCP configuration for Cursor IDE'
    },
    'visual-studio': {
      name: 'Visual Studio',
      configDir: '.vs',
      configFile: 'mcp.json',
      globalConfigPath: this.getVisualStudioGlobalConfigPath(),
      description: 'MCP configuration for Visual Studio (full IDE)'
    },
    windsurf: {
      name: 'Windsurf',
      configDir: '.windsurf',
      configFile: 'mcp.json',
      globalConfigPath: this.getWindsurfGlobalConfigPath(),
      description: 'MCP configuration for Windsurf IDE'
    }
  };

  async handle(args: string): Promise<CommandResult> {
    const flags = this.parseInstallFlags(args);

    // Handle --list flag
    if (flags.list) {
      return this.listConfigurations();
    }

    // Handle --help flag
    if (flags.help) {
      return this.showHelp();
    }

    // Determine which IDE to configure
    const targetIde = this.determineTargetIde(flags);
    if (!targetIde) {
      return this.showHelp();
    }

    const ideConfig = this.ideConfigs[targetIde];
    if (!ideConfig) {
      return {
        success: false,
        message: `Unknown IDE: ${targetIde}. Use --help to see available options.`
      };
    }

    // Determine target path (global or workspace)
    const targetPath = flags.global
      ? ideConfig.globalConfigPath
      : this.getWorkspaceConfigPath(ideConfig);

    if (!targetPath) {
      return {
        success: false,
        message: `Cannot determine config path for ${ideConfig.name}. Try specifying --global or running from a project directory.`
      };
    }

    // Install the configuration
    return this.installMcpConfig(ideConfig, targetPath, flags.global);
  }

  /**
   * Parse install-specific flags
   */
  private parseInstallFlags(args: string): Record<string, boolean> {
    const argParts = args.toLowerCase().split(/\s+/).filter(Boolean);
    return {
      copilot: argParts.includes('--copilot') || argParts.includes('-c'),
      vscode: argParts.includes('--vscode') || argParts.includes('-v'),
      cursor: argParts.includes('--cursor'),
      'visual-studio': argParts.includes('--visual-studio') || argParts.includes('--vs'),
      windsurf: argParts.includes('--windsurf'),
      global: argParts.includes('--global') || argParts.includes('-g'),
      list: argParts.includes('--list') || argParts.includes('-l'),
      help: argParts.includes('--help') || argParts.includes('-h'),
      force: argParts.includes('--force') || argParts.includes('-f')
    };
  }

  /**
   * Determine which IDE the user wants to configure
   */
  private determineTargetIde(flags: Record<string, boolean>): string | null {
    if (flags.copilot || flags.vscode) return 'copilot';
    if (flags.cursor) return 'cursor';
    if (flags['visual-studio']) return 'visual-studio';
    if (flags.windsurf) return 'windsurf';
    return null;
  }

  /**
   * Get workspace-level config path
   */
  private getWorkspaceConfigPath(ideConfig: IdeConfig): string | null {
    const userCwd = process.env.CODESEEKER_USER_CWD || process.cwd();
    return path.join(userCwd, ideConfig.configDir, ideConfig.configFile);
  }

  /**
   * Get VS Code global config path
   */
  private getVSCodeGlobalConfigPath(): string {
    const platform = os.platform();
    const home = os.homedir();

    if (platform === 'win32') {
      return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Code', 'User', 'mcp.json');
    } else if (platform === 'darwin') {
      return path.join(home, 'Library', 'Application Support', 'Code', 'User', 'mcp.json');
    } else {
      return path.join(home, '.config', 'Code', 'User', 'mcp.json');
    }
  }

  /**
   * Get Cursor global config path
   */
  private getCursorGlobalConfigPath(): string {
    const platform = os.platform();
    const home = os.homedir();

    if (platform === 'win32') {
      return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Cursor', 'User', 'mcp.json');
    } else if (platform === 'darwin') {
      return path.join(home, 'Library', 'Application Support', 'Cursor', 'User', 'mcp.json');
    } else {
      return path.join(home, '.config', 'Cursor', 'User', 'mcp.json');
    }
  }

  /**
   * Get Visual Studio global config path
   */
  private getVisualStudioGlobalConfigPath(): string {
    const home = os.homedir();
    // Visual Studio stores user settings differently
    return path.join(home, '.vs', 'mcp.json');
  }

  /**
   * Get Windsurf global config path
   */
  private getWindsurfGlobalConfigPath(): string {
    const platform = os.platform();
    const home = os.homedir();

    if (platform === 'win32') {
      return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Windsurf', 'User', 'mcp.json');
    } else if (platform === 'darwin') {
      return path.join(home, 'Library', 'Application Support', 'Windsurf', 'User', 'mcp.json');
    } else {
      return path.join(home, '.config', 'Windsurf', 'User', 'mcp.json');
    }
  }

  /**
   * Generate the MCP configuration for CodeSeeker
   */
  private generateMcpConfig(): McpConfig {
    return {
      mcpServers: {
        codeseeker: {
          command: 'codeseeker',
          args: ['serve', '--mcp']
        }
      }
    };
  }

  /**
   * Install MCP configuration to the target path
   */
  private async installMcpConfig(
    ideConfig: IdeConfig,
    targetPath: string,
    isGlobal: boolean
  ): Promise<CommandResult> {
    try {
      console.log(Theme.colors.primary(`\n🔧 Installing CodeSeeker MCP configuration for ${ideConfig.name}...`));
      console.log(Theme.colors.muted(`   Target: ${targetPath}`));

      // Ensure directory exists
      const configDir = path.dirname(targetPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
        console.log(Theme.colors.muted(`   Created directory: ${configDir}`));
      }

      // Generate new config
      const newConfig = this.generateMcpConfig();

      // Check if file already exists
      let existingConfig: Record<string, unknown> = {};
      if (fs.existsSync(targetPath)) {
        try {
          const content = fs.readFileSync(targetPath, 'utf-8');
          existingConfig = JSON.parse(content);
          console.log(Theme.colors.muted('   Found existing configuration, merging...'));
        } catch (parseError) {
          console.log(Theme.colors.warning('   ⚠️ Existing config is invalid, will be overwritten'));
        }
      }

      // Merge configurations (preserve existing mcpServers, add/update codeseeker)
      const mergedConfig = this.mergeConfigs(existingConfig, newConfig);

      // Write the merged configuration
      fs.writeFileSync(targetPath, JSON.stringify(mergedConfig, null, 2) + '\n');

      // Success message with next steps
      console.log(Theme.colors.success(`\n✅ CodeSeeker MCP configuration installed successfully!`));
      console.log(Theme.colors.muted(`   Config file: ${targetPath}`));

      this.showPostInstallInstructions(ideConfig, isGlobal);

      return {
        success: true,
        message: `MCP configuration installed for ${ideConfig.name}`,
        data: { targetPath, ide: ideConfig.name, isGlobal }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(Theme.colors.error(`\n❌ Installation failed: ${errorMessage}`));

      return {
        success: false,
        message: `Failed to install MCP configuration: ${errorMessage}`
      };
    }
  }

  /**
   * Merge existing config with new CodeSeeker config
   */
  private mergeConfigs(
    existing: Record<string, unknown>,
    newConfig: McpConfig
  ): Record<string, unknown> {
    // Deep merge mcpServers
    const existingServers = (existing.mcpServers as Record<string, unknown>) || {};

    return {
      ...existing,
      mcpServers: {
        ...existingServers,
        ...newConfig.mcpServers
      }
    };
  }

  /**
   * Show post-installation instructions
   */
  private showPostInstallInstructions(ideConfig: IdeConfig, isGlobal: boolean): void {
    console.log(Theme.colors.primary('\n📋 Next steps:'));

    if (ideConfig.name.includes('VS Code') || ideConfig.name.includes('Copilot')) {
      console.log(Theme.colors.muted('   1. Restart VS Code or reload the window (Ctrl+Shift+P → "Reload Window")'));
      console.log(Theme.colors.muted('   2. GitHub Copilot will automatically detect the MCP server'));
      console.log(Theme.colors.muted('   3. Index your project: search_code("your query") will trigger indexing'));
    } else if (ideConfig.name === 'Cursor') {
      console.log(Theme.colors.muted('   1. Restart Cursor or reload the window'));
      console.log(Theme.colors.muted('   2. Cursor AI will automatically detect the MCP server'));
      console.log(Theme.colors.muted('   3. Start using semantic search in your conversations'));
    } else if (ideConfig.name === 'Visual Studio') {
      console.log(Theme.colors.muted('   1. Restart Visual Studio'));
      console.log(Theme.colors.muted('   2. The MCP server will be available to AI assistants'));
    }

    if (!isGlobal) {
      console.log(Theme.colors.muted('\n💡 Tip: Use --global to install for all projects'));
    }

    console.log(Theme.colors.info('\n🔍 Available MCP tools:'));
    console.log(Theme.colors.muted('   • search_code("query")           - Semantic code search'));
    console.log(Theme.colors.muted('   • find_and_read("query")         - Search + read in one call'));
    console.log(Theme.colors.muted('   • get_code_relationships(file)   - Show imports/dependencies'));
    console.log(Theme.colors.muted('   • get_coding_standards(project)  - Show detected patterns'));
    console.log(Theme.colors.muted('   • index_project(path)            - Index a project'));
  }

  /**
   * List current MCP configurations
   */
  private listConfigurations(): CommandResult {
    console.log(Theme.colors.primary('\n📋 Current MCP Configurations:\n'));

    const userCwd = process.env.CODESEEKER_USER_CWD || process.cwd();
    let foundAny = false;

    for (const [key, ideConfig] of Object.entries(this.ideConfigs)) {
      // Skip duplicates (vscode is alias for copilot)
      if (key === 'vscode') continue;

      // Check workspace config
      const workspacePath = path.join(userCwd, ideConfig.configDir, ideConfig.configFile);
      const globalPath = ideConfig.globalConfigPath;

      const workspaceExists = fs.existsSync(workspacePath);
      const globalExists = globalPath && fs.existsSync(globalPath);

      if (workspaceExists || globalExists) {
        foundAny = true;
        console.log(Theme.colors.success(`${ideConfig.name}:`));

        if (workspaceExists) {
          const hasCodeSeeker = this.configHasCodeSeeker(workspacePath);
          const status = hasCodeSeeker ? Theme.colors.success('✓ codeseeker') : Theme.colors.warning('(no codeseeker)');
          console.log(Theme.colors.muted(`   Workspace: ${workspacePath} ${status}`));
        }

        if (globalExists && globalPath) {
          const hasCodeSeeker = this.configHasCodeSeeker(globalPath);
          const status = hasCodeSeeker ? Theme.colors.success('✓ codeseeker') : Theme.colors.warning('(no codeseeker)');
          console.log(Theme.colors.muted(`   Global:    ${globalPath} ${status}`));
        }

        console.log('');
      }
    }

    if (!foundAny) {
      console.log(Theme.colors.muted('   No MCP configurations found.'));
      console.log(Theme.colors.muted('   Run "codeseeker install --copilot" to configure for GitHub Copilot.'));
    }

    return {
      success: true,
      message: 'Listed current configurations'
    };
  }

  /**
   * Check if a config file has CodeSeeker configured
   */
  private configHasCodeSeeker(configPath: string): boolean {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content);
      return !!(config.mcpServers?.codeseeker);
    } catch {
      return false;
    }
  }

  /**
   * Show help message
   */
  private showHelp(): CommandResult {
    const helpText = `
${Theme.colors.primary('CodeSeeker Install Command')}

Configure MCP (Model Context Protocol) for your IDE to enable semantic code search.

${Theme.colors.success('Usage:')}
  codeseeker install <ide> [options]

${Theme.colors.success('IDE Options:')}
  --copilot, -c         VS Code + GitHub Copilot (recommended)
  --vscode, -v          Same as --copilot
  --cursor              Cursor IDE
  --visual-studio, --vs Visual Studio (full IDE, not VS Code)
  --windsurf            Windsurf IDE

${Theme.colors.success('Options:')}
  --global, -g          Install to user/global settings (applies to all projects)
  --list, -l            List current MCP configurations
  --force, -f           Overwrite existing configuration
  --help, -h            Show this help message

${Theme.colors.success('Examples:')}
  codeseeker install --copilot          Configure current project for GitHub Copilot
  codeseeker install --cursor --global  Configure Cursor globally
  codeseeker install --list             Show existing MCP configurations

${Theme.colors.success('After Installation:')}
  1. Restart your IDE or reload the window
  2. The AI assistant will automatically use CodeSeeker for code search
  3. Try: "search_code('authentication logic')" in your AI chat
`;

    console.log(helpText);
    return {
      success: true,
      message: 'Help displayed'
    };
  }
}
