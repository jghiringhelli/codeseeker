"use strict";
/**
 * Setup Service Factory
 * Dependency Inversion: Creates and wires setup services with proper dependencies
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetupServiceFactory = void 0;
const setup_orchestrator_1 = require("./setup-orchestrator");
const prerequisite_checker_1 = require("./prerequisite-checker");
const container_detector_1 = require("./container-detector");
const container_manager_1 = require("./container-manager");
const database_initializer_1 = require("./database-initializer");
const setup_reporter_1 = require("./setup-reporter");
class SetupServiceFactory {
    static createSetupOrchestrator() {
        // Create all service instances
        const prerequisiteChecker = new prerequisite_checker_1.PrerequisiteChecker();
        const containerDetector = new container_detector_1.ContainerDetector();
        const containerManager = new container_manager_1.ContainerManager();
        const databaseInitializer = new database_initializer_1.DatabaseInitializer();
        const reporter = new setup_reporter_1.SetupReporter();
        // Wire dependencies through constructor injection
        return new setup_orchestrator_1.SetupOrchestrator(prerequisiteChecker, containerDetector, containerManager, databaseInitializer, reporter);
    }
    // Factory methods for individual services (for testing or standalone use)
    static createPrerequisiteChecker() {
        return new prerequisite_checker_1.PrerequisiteChecker();
    }
    static createContainerDetector() {
        return new container_detector_1.ContainerDetector();
    }
    static createContainerManager() {
        return new container_manager_1.ContainerManager();
    }
    static createDatabaseInitializer() {
        return new database_initializer_1.DatabaseInitializer();
    }
    static createReporter() {
        return new setup_reporter_1.SetupReporter();
    }
}
exports.SetupServiceFactory = SetupServiceFactory;
//# sourceMappingURL=setup-service-factory.js.map