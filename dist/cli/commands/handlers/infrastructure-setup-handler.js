"use strict";
/**
 * Infrastructure Setup Command Handler
 * Single Responsibility: Handle one-time infrastructure setup (Docker, databases, etc.)
 * Used when first cloning the project or setting up a new development environment
 *
 * Now uses SOLID-compliant setup architecture with proper dependency injection
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InfrastructureSetupHandler = void 0;
const base_command_handler_1 = require("../base-command-handler");
const logger_1 = require("../../../utils/logger");
const setup_service_factory_1 = require("../../services/setup/setup-service-factory");
class InfrastructureSetupHandler extends base_command_handler_1.BaseCommandHandler {
    logger = logger_1.Logger.getInstance().child('InfrastructureSetupHandler');
    /**
     * Handle infrastructure setup command using SOLID-compliant services
     */
    async handle(args) {
        try {
            // Parse command arguments
            const options = this.parseSetupOptions(args);
            // Create setup orchestrator using factory (Dependency Injection)
            const setupOrchestrator = setup_service_factory_1.SetupServiceFactory.createSetupOrchestrator();
            // Execute setup workflow
            const result = await setupOrchestrator.execute(options);
            return {
                success: result.success,
                message: result.message,
                data: result.data
            };
        }
        catch (error) {
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
    parseSetupOptions(args) {
        const options = {
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
exports.InfrastructureSetupHandler = InfrastructureSetupHandler;
//# sourceMappingURL=infrastructure-setup-handler.js.map