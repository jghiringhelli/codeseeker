"use strict";
/**
 * Command Service Factory - Dependency Injection
 * Creates command services that implement proper interfaces
 * Now includes error handling for SOLID compliance
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandServiceFactory = void 0;
const database_manager_1 = require("../../cli/managers/database-manager");
const user_interface_1 = require("../../cli/managers/user-interface");
const codemind_instruction_service_1 = require("../../cli/services/integration/codemind-instruction-service");
const interrupt_manager_1 = require("../../cli/managers/interrupt-manager");
const claude_code_forwarder_1 = require("../../cli/managers/claude-code-forwarder");
const workflow_orchestration_adapter_1 = require("../../cli/managers/workflow-orchestration-adapter");
const project_service_factory_1 = require("./project-service-factory");
const error_handling_factory_1 = require("./error-handling-factory");
class CommandServiceFactory {
    static instance;
    constructor() { }
    static getInstance() {
        if (!CommandServiceFactory.instance) {
            CommandServiceFactory.instance = new CommandServiceFactory();
        }
        return CommandServiceFactory.instance;
    }
    /**
     * Create a complete command context with all services properly injected
     * Now includes error handling for SOLID compliance
     */
    createCommandContext() {
        // Use project service factory for proper dependency injection
        const projectServiceFactory = project_service_factory_1.ProjectServiceFactory.getInstance();
        const projectManager = projectServiceFactory.createProjectManager();
        // Create error handler
        const errorHandler = error_handling_factory_1.errorHandlingFactory.createErrorHandler();
        // Create other services
        const databaseManager = new database_manager_1.DatabaseManager();
        const userInterface = new user_interface_1.UserInterface();
        const instructionService = new codemind_instruction_service_1.CodeMindInstructionService();
        const interruptManager = interrupt_manager_1.InterruptManager.getInstance();
        const claudeForwarder = new claude_code_forwarder_1.ClaudeCodeForwarder({
            showTimestamps: false,
            prefixLines: true
        });
        const requestProcessor = new workflow_orchestration_adapter_1.WorkflowOrchestrationAdapter();
        return {
            projectManager,
            requestProcessor,
            databaseManager,
            userInterface,
            instructionService,
            interruptManager,
            claudeForwarder,
            errorHandler
        };
    }
    /**
     * Create error handler service
     */
    createErrorHandler() {
        return error_handling_factory_1.errorHandlingFactory.createErrorHandler();
    }
    /**
     * Create command context with custom implementations (for testing)
     */
    createCommandContextWithCustomServices(services) {
        const defaultContext = this.createCommandContext();
        return { ...defaultContext, ...services };
    }
}
exports.CommandServiceFactory = CommandServiceFactory;
//# sourceMappingURL=command-service-factory.js.map