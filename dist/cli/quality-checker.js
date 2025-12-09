"use strict";
/**
 * Quality Checker - Comprehensive quality validation for code changes
 * SOLID Principles: Dependency Inversion - Coordinator depends on abstractions
 * Runs compilation, tests, coverage, security, and architecture checks
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QualityChecker = void 0;
const logger_1 = require("../utils/logger");
const database_config_1 = require("../config/database-config");
const compilation_service_1 = require("./quality/services/compilation-service");
const testing_service_1 = require("./quality/services/testing-service");
const security_service_1 = require("./quality/services/security-service");
const architecture_service_1 = require("./quality/services/architecture-service");
const quality_score_calculator_1 = require("./quality/services/quality-score-calculator");
class QualityChecker {
    compilationService;
    testingService;
    securityService;
    architectureService;
    scoreCalculator;
    logger = logger_1.Logger.getInstance();
    projectRoot;
    db;
    qualityThresholds = {
        minimumScore: 80,
        testCoverage: 80,
        maxComplexity: 10,
        maxDuplication: 5
    };
    constructor(projectRoot, db, compilationService, testingService, securityService, architectureService, scoreCalculator) {
        this.compilationService = compilationService;
        this.testingService = testingService;
        this.securityService = securityService;
        this.architectureService = architectureService;
        this.scoreCalculator = scoreCalculator;
        this.projectRoot = projectRoot || process.cwd();
        this.db = db || new database_config_1.DatabaseConnections();
        // Initialize services with dependency injection
        this.compilationService = this.compilationService || new compilation_service_1.CompilationService(this.projectRoot);
        this.testingService = this.testingService || new testing_service_1.TestingService(this.projectRoot);
        this.securityService = this.securityService || new security_service_1.SecurityService(this.projectRoot);
        this.architectureService = this.architectureService || new architecture_service_1.ArchitectureService(this.projectRoot);
        this.scoreCalculator = this.scoreCalculator || new quality_score_calculator_1.QualityScoreCalculator();
    }
    /**
     * Main entry point for quality checking
     */
    async check(result) {
        this.logger.info('Starting comprehensive quality check...');
        try {
            // Convert input to SubTaskResult format if needed
            const subTaskResults = this.normalizeInput(result);
            // Run all quality checks
            const qualityResult = await this.runAllChecks(subTaskResults);
            // Log summary
            this.logQualitySummary(qualityResult);
            return qualityResult;
        }
        catch (error) {
            this.logger.error('Quality check failed:', error);
            return this.generateFailedResult(`Quality check failed: ${error.message}`);
        }
    }
    /**
     * Run comprehensive quality checks across all dimensions
     */
    async runAllChecks(subTaskResults) {
        this.logger.info('🔍 Running comprehensive quality validation...');
        try {
            // Run all checks in parallel for better performance
            const [compilation, tests, security, architecture] = await Promise.all([
                this.compilationService.runCompilationChecks(subTaskResults),
                this.testingService.runTestChecks(subTaskResults),
                this.securityService.runSecurityChecks(subTaskResults),
                this.architectureService.runArchitectureChecks(subTaskResults)
            ]);
            // Calculate overall score
            const overallScore = this.scoreCalculator.calculateOverallScore(compilation, tests, security, architecture);
            // Determine if quality passed
            const passed = this.scoreCalculator.determineQualityPassed(overallScore, compilation, tests, security, this.qualityThresholds);
            // Generate recommendations
            const recommendations = this.scoreCalculator.generateRecommendations(compilation, tests, security, architecture, this.qualityThresholds);
            // Separate blockers from recommendations
            const blockers = recommendations.filter(rec => rec.includes('Fix') && (rec.includes('before proceeding') || rec.includes('critical')));
            const filteredRecommendations = recommendations.filter(rec => !blockers.includes(rec));
            return {
                compilation,
                tests,
                security,
                architecture,
                overallScore,
                passed,
                recommendations: filteredRecommendations,
                blockers
            };
        }
        catch (error) {
            this.logger.error('Quality checks failed:', error);
            return this.generateFailedResult(`Quality validation failed: ${error.message}`);
        }
    }
    /**
     * Update quality thresholds
     */
    setThresholds(thresholds) {
        this.qualityThresholds = { ...this.qualityThresholds, ...thresholds };
    }
    /**
     * Get current quality thresholds
     */
    getThresholds() {
        return { ...this.qualityThresholds };
    }
    normalizeInput(result) {
        // If already in correct format, return as-is
        if (Array.isArray(result) && result[0]?.filesModified) {
            return result;
        }
        // Convert single result to array format
        if (result?.filesModified) {
            return [result];
        }
        // Fallback - create empty result
        return [{
                success: true,
                filesModified: [],
                summary: 'Quality check',
                changes: {
                    linesAdded: 0,
                    linesRemoved: 0,
                    linesModified: 0
                }
            }];
    }
    logQualitySummary(result) {
        this.logger.info('📊 Quality Check Summary:');
        this.logger.info(`Overall Score: ${result.overallScore}/100`);
        this.logger.info(`Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
        if (result.compilation.success) {
            this.logger.info(`✅ Compilation: SUCCESS (${result.compilation.duration}ms)`);
        }
        else {
            this.logger.warn(`❌ Compilation: ${result.compilation.errors.length} errors`);
        }
        if (result.tests.failed === 0) {
            this.logger.info(`✅ Tests: ${result.tests.passed} passed, ${result.tests.coverage}% coverage`);
        }
        else {
            this.logger.warn(`❌ Tests: ${result.tests.failed} failed, ${result.tests.passed} passed`);
        }
        if (result.security.vulnerabilities.length === 0) {
            this.logger.info(`✅ Security: No vulnerabilities (score: ${result.security.overallScore})`);
        }
        else {
            this.logger.warn(`⚠️ Security: ${result.security.vulnerabilities.length} vulnerabilities`);
        }
        this.logger.info(`📐 Architecture: SOLID score ${result.architecture.solidPrinciples.score}/100`);
        if (result.blockers.length > 0) {
            this.logger.warn(`🚫 ${result.blockers.length} blockers must be resolved`);
        }
        if (result.recommendations.length > 0) {
            this.logger.info(`💡 ${result.recommendations.length} recommendations available`);
        }
    }
    generateFailedResult(errorMessage) {
        return {
            compilation: {
                success: false,
                errors: [errorMessage],
                warnings: [],
                duration: 0
            },
            tests: {
                passed: 0,
                failed: 1,
                coverage: 0,
                duration: 0,
                failedTests: [errorMessage],
                coverageFiles: []
            },
            security: {
                vulnerabilities: [],
                overallScore: 0
            },
            architecture: {
                solidPrinciples: {
                    singleResponsibility: false,
                    openClosed: false,
                    liskovSubstitution: false,
                    interfaceSegregation: false,
                    dependencyInversion: false,
                    score: 0
                },
                codeQuality: {
                    maintainability: 0,
                    readability: 0,
                    complexity: 0,
                    duplication: 0
                },
                patterns: {
                    detectedPatterns: [],
                    antiPatterns: [],
                    recommendations: []
                }
            },
            overallScore: 0,
            passed: false,
            recommendations: [],
            blockers: [errorMessage]
        };
    }
}
exports.QualityChecker = QualityChecker;
exports.default = QualityChecker;
//# sourceMappingURL=quality-checker.js.map