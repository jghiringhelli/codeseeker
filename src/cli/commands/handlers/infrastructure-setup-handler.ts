/**
 * Infrastructure Setup Command Handler
 * Single Responsibility: Handle one-time infrastructure setup (Docker, databases, etc.)
 * Used when first cloning the project or setting up a new development environment
 *
 * Now uses SOLID-compliant setup architecture with proper dependency injection
 */

import { BaseCommandHandler } from '../base-command-handler';
import { CommandResult } from '../command-context';
import { Logger } from '../../../utils/logger';
import { SetupServiceFactory } from '../../services/setup/setup-service-factory';
import { SetupOptions } from '../../services/setup/interfaces/setup-interfaces';

export class InfrastructureSetupHandler extends BaseCommandHandler {
  private logger = Logger.getInstance().child('InfrastructureSetupHandler');

  /**
   * Handle infrastructure setup command using SOLID-compliant services
   */
  async handle(args: string): Promise<CommandResult> {
    try {
      // Parse command arguments
      const options = this.parseSetupOptions(args);

      // Create setup orchestrator using factory (Dependency Injection)
      const setupOrchestrator = SetupServiceFactory.createSetupOrchestrator();

      // Execute setup workflow
      const result = await setupOrchestrator.execute(options);

      return {
        success: result.success,
        message: result.message,
        data: result.data
      };

    } catch (error) {
      this.logger.error('Infrastructure setup failed:', error);

      return {
        success: false,
        message: `Infrastructure setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Parse setup command arguments into options
   */
  private parseSetupOptions(args: string): SetupOptions {
    const options: SetupOptions = {
      projectPath: process.cwd(),
      force: false,
      skipDocker: false,
      skipDatabases: false
    };

    // Parse flags
    if (args.includes('--force')) {
      options.force = true;
    }

    if (args.includes('--skip-docker')) {
      options.skipDocker = true;
    }

    if (args.includes('--skip-databases') || args.includes('--skip-db')) {
      options.skipDatabases = true;
    }

    // Parse project path
    const pathMatch = args.match(/--project-path[=\s]+([^\s]+)/);
    if (pathMatch && pathMatch[1]) {
      options.projectPath = pathMatch[1];
    }

    return options;
  }
}