"use strict";
/**
 * Deduplication Service
 * Identifies and manages duplicate code at method and class level
 * Uses granular embeddings for intelligent similarity detection
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeduplicationService = void 0;
const logger_1 = require("../../../../utils/logger");
const embedding_service_1 = require("../../data/embedding/embedding-service");
const database_config_1 = require("../../../../config/database-config");
const code_relationship_parser_1 = require("../../data/code-relationship-parser");
const semantic_graph_1 = require("../../data/semantic-graph/semantic-graph");
const theme_1 = require("../../../ui/theme");
class DeduplicationService {
    logger;
    embeddingService;
    codeParser;
    semanticGraph;
    constructor() {
        this.logger = logger_1.Logger.getInstance();
        this.embeddingService = new embedding_service_1.EmbeddingService({ granularMode: true });
        this.codeParser = new code_relationship_parser_1.CodeRelationshipParser();
        this.semanticGraph = new semantic_graph_1.SemanticGraphService();
    }
    /**
     * Generate comprehensive deduplication report
     */
    async generateDeduplicationReport(projectId, progressCallback) {
        this.logger.info(`🔍 Starting deduplication analysis for project: ${projectId}`);
        progressCallback?.(0, 'Initializing analysis...');
        const duplicateGroups = [];
        let totalMethods = 0;
        let totalClasses = 0;
        try {
            // First, ensure we have granular embeddings
            progressCallback?.(10, 'Checking granular embeddings...');
            await this.ensureGranularEmbeddings(projectId);
            // Get all methods and classes from the project
            progressCallback?.(20, 'Retrieving methods and classes...');
            const { methods, classes } = await this.getAllMethodsAndClasses(projectId);
            totalMethods = methods.length;
            totalClasses = classes.length;
            this.logger.info(`Found ${totalMethods} methods and ${totalClasses} classes`);
            // Analyze method duplicates
            progressCallback?.(30, 'Analyzing method duplicates...');
            const methodDuplicates = await this.findMethodDuplicates(projectId, methods);
            duplicateGroups.push(...methodDuplicates);
            // Analyze class duplicates
            progressCallback?.(60, 'Analyzing class duplicates...');
            const classDuplicates = await this.findClassDuplicates(projectId, classes);
            duplicateGroups.push(...classDuplicates);
            // Calculate potential savings
            progressCallback?.(90, 'Calculating potential savings...');
            const potentialSavings = this.calculatePotentialSavings(duplicateGroups);
            progressCallback?.(100, 'Analysis complete');
            const report = {
                projectId,
                totalMethods,
                totalClasses,
                duplicateGroups,
                potentialSavings,
                summary: {
                    exactDuplicates: duplicateGroups.filter(g => g.confidence === 'high').length,
                    similarDuplicates: duplicateGroups.filter(g => g.confidence === 'medium').length,
                    refactorCandidates: duplicateGroups.filter(g => g.confidence === 'low').length
                }
            };
            this.logger.info(`✅ Deduplication analysis complete: found ${duplicateGroups.length} duplicate groups`);
            return report;
        }
        catch (error) {
            this.logger.error('❌ Deduplication analysis failed:', error);
            throw error;
        }
    }
    /**
     * Find method duplicates using similarity analysis
     */
    async findMethodDuplicates(projectId, methods) {
        const duplicateGroups = [];
        const processedMethods = new Set();
        for (const method of methods) {
            if (processedMethods.has(method.method_id))
                continue;
            // Find similar methods
            const similarMethods = await this.embeddingService.findSimilarMethods(method, 0.7 // Lower threshold to catch more potential duplicates
            );
            if (similarMethods.length > 0) {
                const group = await this.createDuplicateGroup('method', method, similarMethods);
                if (group) {
                    duplicateGroups.push(group);
                    // Mark all methods in this group as processed
                    processedMethods.add(method.method_id);
                    group.duplicates.forEach(dup => processedMethods.add(dup.id));
                }
            }
        }
        return duplicateGroups;
    }
    /**
     * Find class duplicates using similarity analysis
     */
    async findClassDuplicates(projectId, classes) {
        const duplicateGroups = [];
        const processedClasses = new Set();
        for (const classItem of classes) {
            if (processedClasses.has(classItem.class_id))
                continue;
            // Find similar classes
            const similarClasses = await this.embeddingService.findSimilarClasses(classItem, 0.7 // Lower threshold to catch more potential duplicates
            );
            if (similarClasses.length > 0) {
                const group = await this.createDuplicateGroup('class', classItem, similarClasses);
                if (group) {
                    duplicateGroups.push(group);
                    // Mark all classes in this group as processed
                    processedClasses.add(classItem.class_id);
                    group.duplicates.forEach(dup => processedClasses.add(dup.id));
                }
            }
        }
        return duplicateGroups;
    }
    /**
     * Create a duplicate group from similar items
     */
    async createDuplicateGroup(type, primary, similarItems) {
        try {
            // Filter out low-similarity items
            const highSimilarity = similarItems.filter(item => item.similarity >= 0.9);
            const mediumSimilarity = similarItems.filter(item => item.similarity >= 0.8 && item.similarity < 0.9);
            const lowSimilarity = similarItems.filter(item => item.similarity >= 0.7 && item.similarity < 0.8);
            let duplicates = [];
            let confidence;
            let mergeStrategy;
            let avgSimilarity;
            if (highSimilarity.length > 0) {
                duplicates = await this.convertToeDuplicateItems(highSimilarity);
                confidence = 'high';
                mergeStrategy = 'exact';
                avgSimilarity = highSimilarity.reduce((sum, item) => sum + item.similarity, 0) / highSimilarity.length;
            }
            else if (mediumSimilarity.length > 0) {
                duplicates = await this.convertToeDuplicateItems(mediumSimilarity);
                confidence = 'medium';
                mergeStrategy = 'similar';
                avgSimilarity = mediumSimilarity.reduce((sum, item) => sum + item.similarity, 0) / mediumSimilarity.length;
            }
            else if (lowSimilarity.length > 0) {
                duplicates = await this.convertToeDuplicateItems(lowSimilarity);
                confidence = 'low';
                mergeStrategy = 'refactor';
                avgSimilarity = lowSimilarity.reduce((sum, item) => sum + item.similarity, 0) / lowSimilarity.length;
            }
            else {
                return null; // No significant duplicates found
            }
            const primaryItem = {
                id: type === 'method' ? primary.method_id : primary.class_id,
                name: type === 'method' ? primary.method_name : primary.class_name,
                filePath: primary.file_path,
                content: primary.content,
                startLine: JSON.parse(primary.metadata).startLine || 1,
                endLine: JSON.parse(primary.metadata).endLine || 1,
                metadata: JSON.parse(primary.metadata)
            };
            return {
                type,
                primary: primaryItem,
                duplicates,
                similarityScore: avgSimilarity,
                confidence,
                mergeStrategy
            };
        }
        catch (error) {
            this.logger.error('Failed to create duplicate group:', error);
            return null;
        }
    }
    /**
     * Convert similarity results to duplicate items
     */
    async convertToeDuplicateItems(similarItems) {
        return similarItems.map(item => {
            return {
                id: item.id,
                name: 'Similar Item',
                filePath: '',
                content: item.content,
                startLine: 1,
                endLine: 1,
                metadata: {}
            };
        });
    }
    /**
     * Print detailed deduplication report
     */
    printDeduplicationReport(report) {
        console.log(theme_1.Theme.colors.primary('\n🔍 CODE DEDUPLICATION ANALYSIS REPORT'));
        console.log(theme_1.Theme.colors.secondary('═'.repeat(60)));
        // Summary statistics
        console.log(theme_1.Theme.colors.info(`\n📊 PROJECT SUMMARY:`));
        console.log(`   Project ID: ${report.projectId}`);
        console.log(`   Total Methods: ${theme_1.Theme.colors.accent(report.totalMethods.toString())}`);
        console.log(`   Total Classes: ${theme_1.Theme.colors.accent(report.totalClasses.toString())}`);
        // Duplicate summary
        console.log(theme_1.Theme.colors.info(`\n🎯 DUPLICATE SUMMARY:`));
        console.log(`   Exact Duplicates: ${theme_1.Theme.colors.success(report.summary.exactDuplicates.toString())}`);
        console.log(`   Similar Duplicates: ${theme_1.Theme.colors.warning(report.summary.similarDuplicates.toString())}`);
        console.log(`   Refactor Candidates: ${theme_1.Theme.colors.muted(report.summary.refactorCandidates.toString())}`);
        console.log(`   Total Groups: ${theme_1.Theme.colors.accent(report.duplicateGroups.length.toString())}`);
        // Potential savings
        console.log(theme_1.Theme.colors.info(`\n💰 POTENTIAL SAVINGS:`));
        console.log(`   Lines of Code: ${theme_1.Theme.colors.success(report.potentialSavings.linesOfCode.toString())}`);
        console.log(`   Files Affected: ${theme_1.Theme.colors.accent(report.potentialSavings.filesAffected.toString())}`);
        console.log(`   Estimated Effort: ${theme_1.Theme.colors.muted(report.potentialSavings.estimatedEffort)}`);
        // Detailed duplicate groups
        if (report.duplicateGroups.length > 0) {
            console.log(theme_1.Theme.colors.info(`\n📋 DETAILED DUPLICATE GROUPS:`));
            console.log(theme_1.Theme.colors.secondary('─'.repeat(60)));
            report.duplicateGroups.forEach((group, index) => {
                const confidenceColor = group.confidence === 'high' ? theme_1.Theme.colors.success :
                    group.confidence === 'medium' ? theme_1.Theme.colors.warning :
                        theme_1.Theme.colors.muted;
                console.log(`\n${index + 1}. ${theme_1.Theme.colors.accent(group.type.toUpperCase())} DUPLICATE GROUP`);
                console.log(`   Confidence: ${confidenceColor(group.confidence)} (${(group.similarityScore * 100).toFixed(1)}%)`);
                console.log(`   Strategy: ${theme_1.Theme.colors.muted(group.mergeStrategy)}`);
                // Primary item
                console.log(`   📍 Primary: ${theme_1.Theme.colors.primary(group.primary.name)}`);
                console.log(`      File: ${group.primary.filePath}:${group.primary.startLine}-${group.primary.endLine}`);
                // Duplicates
                group.duplicates.forEach((dup, dupIndex) => {
                    console.log(`   📄 Duplicate ${dupIndex + 1}: ${theme_1.Theme.colors.accent(dup.name)}`);
                    console.log(`      File: ${dup.filePath}:${dup.startLine}-${dup.endLine}`);
                });
            });
        }
        console.log(theme_1.Theme.colors.secondary('\n═'.repeat(60)));
        console.log(theme_1.Theme.colors.info('Use "/dedup merge" to start interactive merging process'));
    }
    /**
     * Interactive merge process for duplicate groups
     */
    async interactiveMerge(report, userInterface, workflowOrchestrator) {
        console.log(theme_1.Theme.colors.primary('\n🔧 INTERACTIVE DUPLICATE MERGING'));
        console.log(theme_1.Theme.colors.secondary('═'.repeat(60)));
        for (let i = 0; i < report.duplicateGroups.length; i++) {
            const group = report.duplicateGroups[i];
            console.log(`\n${theme_1.Theme.colors.info(`Processing Group ${i + 1}/${report.duplicateGroups.length}:`)}`);
            console.log(`${group.type}: ${theme_1.Theme.colors.accent(group.primary.name)} (${group.confidence} confidence)`);
            // Show code comparison
            await this.showCodeComparison(group);
            // Get user decision
            const action = await this.getUserMergeDecision(group, userInterface);
            if (action.action !== 'skip') {
                console.log(theme_1.Theme.colors.info('\n🔄 Executing merge through quality cycle...'));
                // Execute merge through workflow orchestrator (quality cycle)
                await this.executeMergeWithQualityCycle(group, action, workflowOrchestrator);
            }
        }
        console.log(theme_1.Theme.colors.success('\n✅ Interactive merging complete!'));
    }
    /**
     * Show side-by-side code comparison
     */
    async showCodeComparison(group) {
        console.log(theme_1.Theme.colors.info('\n📊 CODE COMPARISON:'));
        // Primary code
        console.log(theme_1.Theme.colors.primary(`\n🎯 Primary (${group.primary.name}):`));
        console.log(theme_1.Theme.colors.muted(`   File: ${group.primary.filePath}:${group.primary.startLine}-${group.primary.endLine}`));
        console.log(this.formatCodePreview(group.primary.content));
        // Duplicates
        group.duplicates.forEach((dup, index) => {
            console.log(theme_1.Theme.colors.accent(`\n📄 Duplicate ${index + 1} (${dup.name}):`));
            console.log(theme_1.Theme.colors.muted(`   File: ${dup.filePath}:${dup.startLine}-${dup.endLine}`));
            console.log(this.formatCodePreview(dup.content));
        });
    }
    /**
     * Get user decision for merge action
     */
    async getUserMergeDecision(group, userInterface) {
        console.log(theme_1.Theme.colors.info('\n🤔 What would you like to do?'));
        console.log('1. Merge duplicates into primary');
        console.log('2. Extract to common utility');
        console.log('3. Skip this group');
        // This would be implemented with actual user input in the CLI
        // For now, return a default action based on confidence
        if (group.confidence === 'high') {
            return {
                action: 'merge',
                sourceId: group.primary.id,
                targetId: group.duplicates[0].id
            };
        }
        else {
            return {
                action: 'skip',
                sourceId: group.primary.id,
                targetId: group.duplicates[0].id
            };
        }
    }
    /**
     * Execute merge through workflow orchestrator (quality cycle)
     */
    async executeMergeWithQualityCycle(group, action, workflowOrchestrator) {
        const mergeRequest = this.buildMergeRequest(group, action);
        try {
            // Execute through workflow orchestrator for quality checks
            const result = await workflowOrchestrator.processRequest(mergeRequest, process.cwd());
            if (result.success) {
                console.log(theme_1.Theme.colors.success(`✅ Merge completed successfully`));
            }
            else {
                console.log(theme_1.Theme.colors.error(`❌ Merge failed: ${result.error}`));
            }
        }
        catch (error) {
            console.log(theme_1.Theme.colors.error(`❌ Merge execution failed: ${error.message}`));
        }
    }
    /**
     * Build merge request for workflow orchestrator
     */
    buildMergeRequest(group, action) {
        const files = [group.primary.filePath, ...group.duplicates.map(d => d.filePath)];
        const uniqueFiles = [...new Set(files)];
        return `Merge duplicate ${group.type} "${group.primary.name}" with strategy "${group.mergeStrategy}".
            Files involved: ${uniqueFiles.join(', ')}.
            Action: ${action.action}.
            Ensure all tests pass and code quality is maintained.`;
    }
    // Helper methods
    async ensureGranularEmbeddings(projectId) {
        // This would check if granular embeddings exist and generate them if needed
        const dbConnections = new database_config_1.DatabaseConnections();
        await this.embeddingService.initializeDatabase(dbConnections);
        await dbConnections.closeAll();
    }
    async getAllMethodsAndClasses(projectId) {
        // This would query the database for all methods and classes
        // Placeholder implementation
        return { methods: [], classes: [] };
    }
    calculatePotentialSavings(groups) {
        let totalLines = 0;
        const affectedFiles = new Set();
        groups.forEach(group => {
            group.duplicates.forEach(dup => {
                totalLines += (dup.endLine - dup.startLine + 1);
                affectedFiles.add(dup.filePath);
            });
        });
        const estimatedEffort = totalLines < 100 ? '1-2 hours' :
            totalLines < 500 ? '2-5 hours' :
                totalLines < 1000 ? '1-2 days' : '2-5 days';
        return {
            linesOfCode: totalLines,
            filesAffected: affectedFiles.size,
            estimatedEffort
        };
    }
    formatCodePreview(content) {
        const lines = content.split('\n');
        const preview = lines.slice(0, 10); // Show first 10 lines
        const formatted = preview.map((line, index) => theme_1.Theme.colors.muted(`   ${(index + 1).toString().padStart(2)}: ${line}`)).join('\n');
        if (lines.length > 10) {
            return formatted + theme_1.Theme.colors.muted('\n   ... (truncated)');
        }
        return formatted;
    }
}
exports.DeduplicationService = DeduplicationService;
exports.default = DeduplicationService;
//# sourceMappingURL=deduplication-service.js.map