/**
 * Dashboard API methods using normalized database schema
 * Optimized for performance with proper SQL queries and joins
 */

class NormalizedDashboardAPI {
    constructor(db) {
        this.db = db;
    }

    // ==========================================
    // PROJECT OVERVIEW
    // ==========================================

    async getProjectOverview(projectId) {
        const result = await this.db.query(`
            SELECT 
                p.*,
                po.actual_files_count,
                po.entities_count,
                po.classes_count,
                po.interfaces_count,
                po.functions_count,
                po.avg_maintainability,
                po.avg_complexity,
                po.total_tech_debt_minutes
            FROM projects p
            LEFT JOIN project_overview po ON p.id = po.id
            WHERE p.id = $1
        `, [projectId]);

        if (result.rows.length === 0) {
            throw new Error('Project not found');
        }

        const project = result.rows[0];

        // Get language statistics
        const languageStats = await this.db.query(`
            SELECT 
                language,
                COUNT(*) as file_count,
                SUM(lines_count) as total_lines,
                AVG(lines_count) as avg_lines_per_file
            FROM project_files 
            WHERE project_id = $1 AND language IS NOT NULL
            GROUP BY language
            ORDER BY file_count DESC
        `, [projectId]);

        return {
            ...project,
            languageStats: languageStats.rows,
            summary: {
                totalFiles: project.actual_files_count || 0,
                totalLines: project.total_lines || 0,
                totalClasses: project.classes_count || 0,
                totalInterfaces: project.interfaces_count || 0,
                totalFunctions: project.functions_count || 0,
                avgMaintainability: Math.round((project.avg_maintainability || 0) * 100) / 100,
                avgComplexity: Math.round((project.avg_complexity || 0) * 100) / 100,
                techDebtHours: Math.round((project.total_tech_debt_minutes || 0) / 60)
            }
        };
    }

    // ==========================================
    // FILE TREE
    // ==========================================

    async getProjectTree(projectId) {
        const result = await this.db.query(`
            SELECT 
                file_path,
                file_name,
                file_extension,
                file_size,
                lines_count,
                language,
                last_modified
            FROM project_files 
            WHERE project_id = $1
            ORDER BY file_path
        `, [projectId]);

        // Build hierarchical tree
        const tree = this.buildFileTree(result.rows);

        return {
            tree,
            totalFiles: result.rows.length,
            filesByLanguage: this.groupFilesByLanguage(result.rows),
            sizeDistribution: this.calculateSizeDistribution(result.rows)
        };
    }

    buildFileTree(files) {
        const tree = {};
        
        files.forEach(file => {
            const parts = file.file_path.split('/');
            let current = tree;
            
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (i === parts.length - 1) {
                    // This is a file
                    current[part] = {
                        type: 'file',
                        file_path: file.file_path,
                        file_extension: file.file_extension,
                        file_size: file.file_size,
                        lines_count: file.lines_count,
                        language: file.language,
                        last_modified: file.last_modified
                    };
                } else {
                    // This is a directory
                    if (!current[part] || current[part].type === 'file') {
                        current[part] = { type: 'directory' };
                    }
                    current = current[part];
                }
            }
        });
        
        return tree;
    }

    // ==========================================
    // CODE ENTITIES (Classes, Functions, etc.)
    // ==========================================

    async getProjectClasses(projectId) {
        const result = await this.db.query(`
            SELECT 
                ce.*,
                pf.file_path,
                pf.language,
                COUNT(child.id) as nested_count
            FROM code_entities ce
            JOIN project_files pf ON ce.file_id = pf.id
            LEFT JOIN code_entities child ON child.parent_entity_id = ce.id
            WHERE ce.project_id = $1
            GROUP BY ce.id, pf.file_path, pf.language
            ORDER BY ce.entity_type, ce.entity_name
        `, [projectId]);

        const entities = result.rows;

        // Group by type
        const groupedEntities = {
            classes: entities.filter(e => e.entity_type === 'class'),
            interfaces: entities.filter(e => e.entity_type === 'interface'),
            functions: entities.filter(e => e.entity_type === 'function'),
            enums: entities.filter(e => e.entity_type === 'enum'),
            types: entities.filter(e => e.entity_type === 'type')
        };

        // Get inheritance relationships
        const relationships = await this.db.query(`
            SELECT 
                source.entity_name as source_name,
                source.entity_type as source_type,
                target.entity_name as target_name,
                target.entity_type as target_type,
                er.relationship_type
            FROM entity_relationships er
            JOIN code_entities source ON er.source_entity_id = source.id
            LEFT JOIN code_entities target ON er.target_entity_id = target.id
            WHERE er.project_id = $1
        `, [projectId]);

        return {
            entities: groupedEntities,
            totalClasses: groupedEntities.classes.length,
            totalInterfaces: groupedEntities.interfaces.length,
            totalFunctions: groupedEntities.functions.length,
            relationships: relationships.rows,
            complexityDistribution: this.calculateComplexityDistribution(entities)
        };
    }

    // ==========================================
    // PROJECT METRICS
    // ==========================================

    async getProjectMetrics(projectId) {
        // Get all project metrics
        const metricsResult = await this.db.query(`
            SELECT 
                metric_category,
                metric_name,
                metric_value,
                metric_unit,
                metric_description,
                benchmark_value,
                trend_direction,
                last_calculated
            FROM project_metrics 
            WHERE project_id = $1
            ORDER BY metric_category, metric_name
        `, [projectId]);

        // Get file-level metrics aggregation
        const fileMetricsResult = await this.db.query(`
            SELECT 
                AVG(cyclomatic_complexity) as avg_complexity,
                AVG(maintainability_index) as avg_maintainability,
                SUM(lines_of_code) as total_loc,
                SUM(lines_of_comments) as total_comments,
                AVG(test_coverage_percentage) as avg_coverage,
                SUM(technical_debt_minutes) as total_tech_debt
            FROM file_metrics fm
            JOIN project_files pf ON fm.file_id = pf.id
            WHERE pf.project_id = $1
        `, [projectId]);

        // Group metrics by category
        const categorizedMetrics = {};
        for (const metric of metricsResult.rows) {
            if (!categorizedMetrics[metric.metric_category]) {
                categorizedMetrics[metric.metric_category] = {};
            }
            categorizedMetrics[metric.metric_category][metric.metric_name] = {
                value: parseFloat(metric.metric_value),
                unit: metric.metric_unit,
                description: metric.metric_description,
                benchmark: metric.benchmark_value ? parseFloat(metric.benchmark_value) : null,
                trend: metric.trend_direction,
                lastCalculated: metric.last_calculated
            };
        }

        const fileMetrics = fileMetricsResult.rows[0];

        return {
            categories: categorizedMetrics,
            aggregated: {
                avgComplexity: Math.round((fileMetrics.avg_complexity || 0) * 100) / 100,
                avgMaintainability: Math.round((fileMetrics.avg_maintainability || 0) * 100) / 100,
                totalLinesOfCode: parseInt(fileMetrics.total_loc || 0),
                totalComments: parseInt(fileMetrics.total_comments || 0),
                avgTestCoverage: Math.round((fileMetrics.avg_coverage || 0) * 100) / 100,
                totalTechDebtHours: Math.round((fileMetrics.total_tech_debt || 0) / 60)
            },
            overallScore: this.calculateOverallQualityScore(fileMetrics, categorizedMetrics)
        };
    }

    // ==========================================
    // NAVIGATION & ARCHITECTURE
    // ==========================================

    async getNavigationData(projectId) {
        // Get navigation flows
        const flowsResult = await this.db.query(`
            SELECT *
            FROM navigation_flows 
            WHERE project_id = $1
            ORDER BY flow_type, flow_name
        `, [projectId]);

        // Get architecture components
        const componentsResult = await this.db.query(`
            SELECT 
                ac.*,
                pf.file_path
            FROM architecture_components ac
            LEFT JOIN project_files pf ON ac.primary_file_id = pf.id
            WHERE ac.project_id = $1
            ORDER BY ac.component_type, ac.component_name
        `, [projectId]);

        // Get dependency analysis
        const dependencyResult = await this.db.query(`
            SELECT *
            FROM file_dependency_analysis
            WHERE project_id = $1
            ORDER BY dependencies_count DESC
        `, [projectId]);

        return {
            flows: flowsResult.rows.map(flow => ({
                ...flow,
                flow_steps: JSON.parse(flow.flow_steps || '[]')
            })),
            components: componentsResult.rows,
            dependencies: dependencyResult.rows,
            architectureHealth: await this.getArchitectureHealth(projectId)
        };
    }

    async getArchitectureHealth(projectId) {
        const result = await this.db.query(`
            SELECT * FROM architecture_health WHERE project_id = $1
        `, [projectId]);

        return result.rows[0] || {
            avg_coupling: 0,
            avg_cohesion: 0,
            avg_stability: 0,
            high_coupling_components: 0,
            low_cohesion_components: 0,
            total_components: 0
        };
    }

    // ==========================================
    // DEVELOPMENT ROADMAP
    // ==========================================

    async getProjectRoadmap(projectId) {
        // Get development phases
        const phasesResult = await this.db.query(`
            SELECT *
            FROM development_phases 
            WHERE project_id = $1
            ORDER BY phase_number
        `, [projectId]);

        // Get features for each phase
        const featuresResult = await this.db.query(`
            SELECT 
                df.*,
                dp.phase_name
            FROM development_features df
            JOIN development_phases dp ON df.phase_id = dp.id
            WHERE df.project_id = $1
            ORDER BY dp.phase_number, df.priority, df.feature_name
        `, [projectId]);

        // Group features by phase
        const featuresByPhase = {};
        for (const feature of featuresResult.rows) {
            if (!featuresByPhase[feature.phase_id]) {
                featuresByPhase[feature.phase_id] = [];
            }
            featuresByPhase[feature.phase_id].push(feature);
        }

        // Combine phases with their features
        const phases = phasesResult.rows.map(phase => ({
            ...phase,
            features: featuresByPhase[phase.id] || []
        }));

        // Calculate overall progress
        const totalFeatures = featuresResult.rows.length;
        const completedFeatures = featuresResult.rows.filter(f => f.status === 'completed').length;
        const inProgressFeatures = featuresResult.rows.filter(f => f.status === 'in_progress').length;

        return {
            phases,
            metrics: {
                totalFeatures,
                completedFeatures,
                inProgressFeatures,
                plannedFeatures: totalFeatures - completedFeatures - inProgressFeatures,
                overallProgress: totalFeatures > 0 ? Math.round((completedFeatures / totalFeatures) * 100) : 0
            },
            recommendations: await this.generateRoadmapRecommendations(projectId, phases)
        };
    }

    // ==========================================
    // SEARCH & RAG
    // ==========================================

    async getProjectSearch(projectId) {
        // Get search metrics
        const searchMetrics = await this.db.query(`
            SELECT metric_name, metric_value
            FROM project_metrics 
            WHERE project_id = $1 AND metric_category = 'search'
        `, [projectId]);

        const metrics = {};
        for (const metric of searchMetrics.rows) {
            metrics[metric.metric_name] = parseFloat(metric.metric_value);
        }

        // Get searchable content statistics
        const contentStats = await this.db.query(`
            SELECT 
                content_type,
                COUNT(*) as content_count,
                AVG(importance_score) as avg_importance
            FROM searchable_content 
            WHERE project_id = $1
            GROUP BY content_type
            ORDER BY content_count DESC
        `, [projectId]);

        return {
            searchEnabled: metrics.search_enabled > 0,
            indexedDocuments: metrics.indexed_documents || 0,
            indexedSections: metrics.indexed_sections || 0,
            contentTypes: contentStats.rows,
            capabilities: [
                'Full-text search',
                'Semantic code search', 
                'Natural language queries',
                'Cross-file references',
                'Documentation search'
            ]
        };
    }

    async performProjectSearch(query, projectId, options = {}) {
        const { searchType = 'full_text', limit = 50 } = options;

        let searchQuery;
        let params;

        if (searchType === 'full_text') {
            // Full-text search using PostgreSQL's built-in search
            searchQuery = `
                SELECT 
                    sc.*,
                    pf.file_path,
                    ce.entity_name,
                    ts_rank(to_tsvector('english', sc.content_text), plainto_tsquery('english', $1)) as relevance_score
                FROM searchable_content sc
                LEFT JOIN project_files pf ON sc.file_id = pf.id
                LEFT JOIN code_entities ce ON sc.entity_id = ce.id
                WHERE sc.project_id = $2 
                  AND to_tsvector('english', sc.content_text) @@ plainto_tsquery('english', $1)
                ORDER BY relevance_score DESC, sc.importance_score DESC
                LIMIT $3
            `;
            params = [query, projectId, limit];
        } else {
            // Simple pattern matching fallback
            searchQuery = `
                SELECT 
                    sc.*,
                    pf.file_path,
                    ce.entity_name,
                    sc.importance_score as relevance_score
                FROM searchable_content sc
                LEFT JOIN project_files pf ON sc.file_id = pf.id
                LEFT JOIN code_entities ce ON sc.entity_id = ce.id
                WHERE sc.project_id = $2 
                  AND (sc.content_text ILIKE $1 OR $1 = ANY(sc.tags))
                ORDER BY sc.importance_score DESC
                LIMIT $3
            `;
            params = [`%${query}%`, projectId, limit];
        }

        const result = await this.db.query(searchQuery, params);

        return {
            query,
            results: result.rows,
            totalResults: result.rows.length,
            searchType,
            executionTime: Date.now() // Would be calculated properly
        };
    }

    // ==========================================
    // HELPER METHODS
    // ==========================================

    groupFilesByLanguage(files) {
        const groups = {};
        for (const file of files) {
            const lang = file.language || 'Unknown';
            if (!groups[lang]) {
                groups[lang] = { count: 0, totalLines: 0, totalSize: 0 };
            }
            groups[lang].count++;
            groups[lang].totalLines += file.lines_count || 0;
            groups[lang].totalSize += file.file_size || 0;
        }
        return groups;
    }

    calculateSizeDistribution(files) {
        const distribution = { small: 0, medium: 0, large: 0, xlarge: 0 };
        for (const file of files) {
            const size = file.file_size || 0;
            if (size < 1000) distribution.small++;
            else if (size < 10000) distribution.medium++;
            else if (size < 100000) distribution.large++;
            else distribution.xlarge++;
        }
        return distribution;
    }

    calculateComplexityDistribution(entities) {
        const distribution = { low: 0, medium: 0, high: 0 };
        for (const entity of entities) {
            const complexity = entity.complexity_score || 0;
            if (complexity < 5) distribution.low++;
            else if (complexity < 10) distribution.medium++;
            else distribution.high++;
        }
        return distribution;
    }

    calculateOverallQualityScore(fileMetrics, categorizedMetrics) {
        let score = 100;
        
        // Reduce score based on complexity
        if (fileMetrics.avg_complexity > 10) score -= 20;
        else if (fileMetrics.avg_complexity > 5) score -= 10;
        
        // Reduce score based on maintainability
        if (fileMetrics.avg_maintainability < 60) score -= 20;
        else if (fileMetrics.avg_maintainability < 80) score -= 10;
        
        // Reduce score based on test coverage
        if (fileMetrics.avg_coverage < 50) score -= 15;
        else if (fileMetrics.avg_coverage < 80) score -= 5;
        
        // Reduce score based on technical debt
        const debtHours = (fileMetrics.total_tech_debt || 0) / 60;
        if (debtHours > 100) score -= 15;
        else if (debtHours > 50) score -= 10;
        else if (debtHours > 20) score -= 5;
        
        return Math.max(0, Math.min(100, score));
    }

    async generateRoadmapRecommendations(projectId, phases) {
        // Simple recommendation logic based on current state
        const recommendations = [];
        
        const inProgressPhase = phases.find(p => p.status === 'in_progress');
        if (inProgressPhase) {
            recommendations.push({
                title: `Complete ${inProgressPhase.phase_name}`,
                priority: 'high',
                description: `Focus on completing the current phase: ${inProgressPhase.phase_name}`,
                estimatedEffort: '1-2 weeks'
            });
        }
        
        const nextPhase = phases.find(p => p.status === 'planned');
        if (nextPhase) {
            recommendations.push({
                title: `Prepare for ${nextPhase.phase_name}`,
                priority: 'medium', 
                description: `Begin planning and preparation for ${nextPhase.phase_name}`,
                estimatedEffort: '3-5 days'
            });
        }
        
        return recommendations;
    }
}

module.exports = { NormalizedDashboardAPI };