"use strict";
/**
 * Duplication Detector (SOLID Refactored)
 * SOLID Principles: Dependency Inversion - Coordinator depends on abstractions
 * Coordinates all duplication detection operations using service abstractions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DuplicationDetector = exports.EffortEstimate = exports.RefactoringApproach = exports.DuplicationType = void 0;
const logger_1 = require("../../../utils/logger");
const file_analysis_service_1 = require("./services/file-analysis-service");
const duplication_detection_service_1 = require("./services/duplication-detection-service");
const refactoring_advisor_service_1 = require("./services/refactoring-advisor-service");
const statistics_service_1 = require("./services/statistics-service");
// Re-export interfaces and types for backward compatibility
var index_1 = require("./interfaces/index");
Object.defineProperty(exports, "DuplicationType", { enumerable: true, get: function () { return index_1.DuplicationType; } });
Object.defineProperty(exports, "RefactoringApproach", { enumerable: true, get: function () { return index_1.RefactoringApproach; } });
Object.defineProperty(exports, "EffortEstimate", { enumerable: true, get: function () { return index_1.EffortEstimate; } });
class DuplicationDetector {
    fileAnalysisService;
    detectionService;
    advisorService;
    statisticsService;
    logger = logger_1.Logger.getInstance();
    constructor(fileAnalysisService, detectionService, advisorService, statisticsService) {
        this.fileAnalysisService = fileAnalysisService;
        this.detectionService = detectionService;
        this.advisorService = advisorService;
        this.statisticsService = statisticsService;
        // Initialize services with dependency injection
        this.fileAnalysisService = this.fileAnalysisService || new file_analysis_service_1.FileAnalysisService();
        this.detectionService = this.detectionService || new duplication_detection_service_1.DuplicationDetectionService();
        this.advisorService = this.advisorService || new refactoring_advisor_service_1.RefactoringAdvisorService();
        this.statisticsService = this.statisticsService || new statistics_service_1.StatisticsService();
    }
    async findDuplicates(request) {
        const startTime = Date.now();
        this.logger.info(`🔍 Starting duplication detection in ${request.projectPath}`);
        const scanInfo = {
            totalFiles: 0,
            analyzedFiles: 0,
            skippedFiles: 0,
            processingTime: 0,
            timestamp: new Date()
        };
        try {
            // Step 1: Get all files to analyze
            this.logger.debug('📂 Discovering project files...');
            const files = await this.fileAnalysisService.getProjectFiles(request.projectPath, request.filePatterns, request.excludePatterns);
            scanInfo.totalFiles = files.length;
            // Step 2: Extract code blocks from all files
            this.logger.debug('🧩 Extracting code blocks...');
            const allCodeBlocks = [];
            for (const file of files) {
                try {
                    const filePath = require('path').join(request.projectPath, file);
                    const blocks = await this.fileAnalysisService.extractCodeBlocks(filePath);
                    allCodeBlocks.push(...blocks);
                    scanInfo.analyzedFiles++;
                }
                catch (error) {
                    this.logger.debug(`⚠️ Failed to process ${file}:`, error);
                    scanInfo.skippedFiles++;
                }
            }
            // Step 3: Find different types of duplicates
            this.logger.debug('🔄 Analyzing duplicates...');
            const duplicateGroups = await this.findAllDuplicateTypes(allCodeBlocks, request);
            // Step 4: Generate refactoring advice if requested
            if (request.includeRefactoringSuggestions) {
                this.logger.debug('💡 Generating refactoring advice...');
                for (const group of duplicateGroups) {
                    group.refactoring = this.advisorService.generateRefactoringAdvice(group);
                }
            }
            // Step 5: Calculate statistics
            this.logger.debug('📊 Calculating statistics...');
            const statistics = this.statisticsService.calculateStatistics(duplicateGroups);
            // Complete scan info
            scanInfo.processingTime = Date.now() - startTime;
            const result = {
                duplicates: duplicateGroups,
                scanInfo,
                statistics
            };
            this.logger.info(`✅ Duplication detection completed: found ${duplicateGroups.length} duplicate groups in ${scanInfo.processingTime}ms`);
            return result;
        }
        catch (error) {
            this.logger.error('❌ Duplication detection failed:', error);
            scanInfo.processingTime = Date.now() - startTime;
            return {
                duplicates: [],
                scanInfo,
                statistics: this.statisticsService.calculateStatistics([])
            };
        }
    }
    async quickScan(projectPath) {
        const quickRequest = {
            projectPath,
            includeSemantic: false, // Skip semantic analysis for speed
            similarityThreshold: 0.8,
            includeRefactoringSuggestions: false,
            filePatterns: ['**/*.ts', '**/*.js'], // Limited file types
            excludePatterns: ['node_modules/**', 'dist/**', '**/*.test.*']
        };
        return this.findDuplicates(quickRequest);
    }
    async deepScan(projectPath) {
        const deepRequest = {
            projectPath,
            includeSemantic: true, // Include semantic analysis
            similarityThreshold: 0.7, // Lower threshold for more matches
            includeRefactoringSuggestions: true,
            filePatterns: ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx', '**/*.py', '**/*.java']
        };
        return this.findDuplicates(deepRequest);
    }
    async generateReport(result) {
        return this.statisticsService.generateSummaryReport(result.duplicates);
    }
    async getPriorityGroups(result, topN = 10) {
        return this.statisticsService.identifyPriorityGroups(result.duplicates, topN);
    }
    // Helper method for finding all duplicate types
    async findAllDuplicateTypes(codeBlocks, request) {
        const allGroups = [];
        // Find exact duplicates
        const exactGroups = this.detectionService.findExactDuplicates(codeBlocks);
        allGroups.push(...exactGroups);
        // Find structural duplicates
        const structuralGroups = this.detectionService.findStructuralDuplicates(codeBlocks, request.similarityThreshold);
        allGroups.push(...structuralGroups);
        // Find renamed duplicates
        const renamedGroups = this.detectionService.findRenamedDuplicates(codeBlocks, request.similarityThreshold);
        allGroups.push(...renamedGroups);
        // Find semantic duplicates (if enabled)
        if (request.includeSemantic) {
            const semanticGroups = await this.detectionService.findSemanticDuplicates(codeBlocks, request.similarityThreshold);
            allGroups.push(...semanticGroups);
        }
        // Remove overlapping groups and sort by priority
        return this.deduplicateAndPrioritize(allGroups);
    }
    deduplicateAndPrioritize(groups) {
        // Remove groups where locations significantly overlap
        const uniqueGroups = [];
        for (const group of groups) {
            const hasSignificantOverlap = uniqueGroups.some(existing => this.hasSignificantLocationOverlap(group, existing));
            if (!hasSignificantOverlap) {
                uniqueGroups.push(group);
            }
        }
        // Sort by a priority score (higher is more important)
        return uniqueGroups.sort((a, b) => {
            const scoreA = this.calculateGroupPriority(a);
            const scoreB = this.calculateGroupPriority(b);
            return scoreB - scoreA;
        });
    }
    hasSignificantLocationOverlap(group1, group2) {
        const locations1 = group1.locations;
        const locations2 = group2.locations;
        let overlappingCount = 0;
        for (const loc1 of locations1) {
            for (const loc2 of locations2) {
                if (this.locationsOverlap(loc1, loc2)) {
                    overlappingCount++;
                }
            }
        }
        // Consider it significant overlap if more than 50% of locations overlap
        const minLocations = Math.min(locations1.length, locations2.length);
        return overlappingCount / minLocations > 0.5;
    }
    locationsOverlap(loc1, loc2) {
        // Check if two locations overlap significantly
        if (loc1.file !== loc2.file)
            return false;
        const range1 = { start: loc1.startLine, end: loc1.endLine };
        const range2 = { start: loc2.startLine, end: loc2.endLine };
        const overlapStart = Math.max(range1.start, range2.start);
        const overlapEnd = Math.min(range1.end, range2.end);
        if (overlapStart > overlapEnd)
            return false; // No overlap
        const overlapSize = overlapEnd - overlapStart + 1;
        const size1 = range1.end - range1.start + 1;
        const size2 = range2.end - range2.start + 1;
        const minSize = Math.min(size1, size2);
        // Consider overlap significant if it's more than 70% of the smaller range
        return overlapSize / minSize > 0.7;
    }
    calculateGroupPriority(group) {
        let priority = 0;
        // Higher priority for exact duplicates
        switch (group.type) {
            case 'exact':
                priority += 100;
                break;
            case 'renamed':
                priority += 80;
                break;
            case 'structural':
                priority += 60;
                break;
            case 'semantic':
                priority += 40;
                break;
        }
        // Higher priority for more locations
        priority += group.locations.length * 20;
        // Higher priority for more lines of code
        priority += group.metadata.linesOfCode * 0.5;
        // Higher priority for higher complexity
        priority += group.metadata.complexity * 10;
        return priority;
    }
    // Factory methods for testing and dependency injection
    static createWithServices(fileAnalysisService, detectionService, advisorService, statisticsService) {
        return new DuplicationDetector(fileAnalysisService, detectionService, advisorService, statisticsService);
    }
    static createDefault() {
        return new DuplicationDetector();
    }
}
exports.DuplicationDetector = DuplicationDetector;
//# sourceMappingURL=detector.js.map