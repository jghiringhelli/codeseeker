/**
 * API Layer for Three High-Impact Tools
 * Centralization Detector, Code-Docs Reconciler, Workflow Orchestrator
 */

const { Pool } = require('pg');

class ThreeToolsAPI {
    constructor(db) {
        this.db = db || new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'codemind',
            user: process.env.DB_USER || 'codemind',
            password: process.env.DB_PASSWORD || 'codemind123',
        });
    }

    // ===== CENTRALIZATION DETECTOR METHODS =====

    async getCentralizationData(projectId) {
        console.log(`🔍 Loading centralization data for project ${projectId}`);
        
        try {
            // Get latest scan results
            const scanResult = await this.db.query(`
                SELECT cs.*, COUNT(co.id) as opportunity_count
                FROM centralization_scans cs
                LEFT JOIN centralization_opportunities co ON cs.id = co.scan_id
                WHERE cs.project_id = $1
                GROUP BY cs.id
                ORDER BY cs.scan_timestamp DESC
                LIMIT 1
            `, [projectId]);

            if (scanResult.rows.length === 0) {
                return {
                    hasData: false,
                    message: 'No centralization analysis available',
                    suggestions: 'Run centralization detector to identify scattered configuration'
                };
            }

            const scan = scanResult.rows[0];
            
            // Get top opportunities
            const opportunitiesResult = await this.db.query(`
                SELECT co.*, COUNT(sc.id) as location_count,
                       cm.migration_approach, cm.estimated_effort, cm.risk_level
                FROM centralization_opportunities co
                LEFT JOIN scattered_configs sc ON co.id = sc.opportunity_id
                LEFT JOIN centralization_migrations cm ON co.id = cm.opportunity_id
                WHERE co.scan_id = $1
                GROUP BY co.id, cm.migration_approach, cm.estimated_effort, cm.risk_level
                ORDER BY co.benefit_score DESC
                LIMIT 10
            `, [scan.id]);

            // Get scattered locations for top opportunities
            const locations = {};
            for (const opp of opportunitiesResult.rows) {
                const locationResult = await this.db.query(`
                    SELECT file_path, line_number, config_value, usage_context, code_snippet
                    FROM scattered_configs
                    WHERE opportunity_id = $1
                    ORDER BY file_path, line_number
                `, [opp.id]);
                
                locations[opp.opportunity_id] = locationResult.rows;
            }

            // Calculate summary statistics
            const statsResult = await this.db.query(`
                SELECT 
                    config_type,
                    COUNT(*) as type_count,
                    AVG(benefit_score) as avg_benefit,
                    SUM(occurrences) as total_occurrences
                FROM centralization_opportunities
                WHERE scan_id = $1
                GROUP BY config_type
                ORDER BY avg_benefit DESC
            `, [scan.id]);

            return {
                hasData: true,
                scanInfo: {
                    scanDate: scan.scan_timestamp,
                    totalFiles: scan.total_files,
                    analyzedFiles: scan.analyzed_files,
                    configItemsFound: scan.config_items_found,
                    opportunitiesFound: scan.opportunities_found,
                    totalBenefitScore: scan.total_benefit_score,
                    scanDuration: scan.scan_duration_ms
                },
                opportunities: opportunitiesResult.rows.map(opp => ({
                    id: opp.opportunity_id,
                    configType: opp.config_type,
                    configName: opp.config_name,
                    occurrences: opp.occurrences,
                    benefitScore: opp.benefit_score,
                    complexityScore: opp.complexity_score,
                    consolidationType: opp.consolidation_type,
                    suggestedLocation: opp.suggested_location,
                    locationCount: opp.location_count,
                    migrationApproach: opp.migration_approach,
                    estimatedEffort: opp.estimated_effort,
                    riskLevel: opp.risk_level,
                    locations: locations[opp.opportunity_id] || []
                })),
                statistics: {
                    byType: statsResult.rows,
                    totalOpportunities: opportunitiesResult.rows.length,
                    highBenefitCount: opportunitiesResult.rows.filter(o => o.benefit_score >= 75).length,
                    lowRiskCount: opportunitiesResult.rows.filter(o => o.risk_level === 'low').length
                }
            };

        } catch (error) {
            console.error('❌ Error loading centralization data:', error);
            throw error;
        }
    }

    // ===== CODE-DOCS RECONCILER METHODS =====

    async getReconciliationData(projectId) {
        console.log(`📚 Loading reconciliation data for project ${projectId}`);
        
        try {
            // Get latest analysis
            const analysisResult = await this.db.query(`
                SELECT ra.*, COUNT(tf.id) as feature_count
                FROM reconciliation_analyses ra
                LEFT JOIN tracked_features tf ON ra.id = tf.analysis_id
                WHERE ra.project_id = $1
                GROUP BY ra.id
                ORDER BY ra.analysis_timestamp DESC
                LIMIT 1
            `, [projectId]);

            if (analysisResult.rows.length === 0) {
                return {
                    hasData: false,
                    message: 'No code-documentation analysis available',
                    suggestions: 'Run reconciliation analyzer to sync code with documentation'
                };
            }

            const analysis = analysisResult.rows[0];

            // Get feature breakdown by status
            const featuresResult = await this.db.query(`
                SELECT 
                    status,
                    feature_type,
                    priority,
                    COUNT(*) as count
                FROM tracked_features
                WHERE analysis_id = $1
                GROUP BY status, feature_type, priority
                ORDER BY 
                    CASE priority 
                        WHEN 'critical' THEN 1 
                        WHEN 'high' THEN 2 
                        WHEN 'medium' THEN 3 
                        ELSE 4 
                    END,
                    count DESC
            `, [analysis.id]);

            // Get top discrepancies
            const discrepanciesResult = await this.db.query(`
                SELECT 
                    rd.discrepancy_type,
                    rd.severity,
                    rd.description,
                    rd.code_location,
                    rd.doc_location,
                    rd.suggested_fix,
                    rd.auto_fixable,
                    tf.feature_name,
                    tf.feature_type
                FROM reconciliation_discrepancies rd
                JOIN tracked_features tf ON rd.feature_id = tf.id
                WHERE tf.analysis_id = $1
                ORDER BY 
                    CASE rd.severity 
                        WHEN 'critical' THEN 1 
                        WHEN 'high' THEN 2 
                        WHEN 'medium' THEN 3 
                        ELSE 4 
                    END,
                    rd.created_at DESC
                LIMIT 15
            `, [analysis.id]);

            // Get sync recommendations
            const recommendationsResult = await this.db.query(`
                SELECT 
                    recommendation_type,
                    priority,
                    description,
                    effort_estimate,
                    impact_assessment,
                    acceptance_status,
                    generated_code IS NOT NULL as has_generated_code,
                    generated_docs IS NOT NULL as has_generated_docs
                FROM sync_recommendations
                WHERE analysis_id = $1
                ORDER BY 
                    CASE priority 
                        WHEN 'critical' THEN 1 
                        WHEN 'high' THEN 2 
                        WHEN 'medium' THEN 3 
                        ELSE 4 
                    END,
                    created_at DESC
                LIMIT 10
            `, [analysis.id]);

            // Calculate sync statistics
            const syncStats = {
                totalFeatures: analysis.total_features,
                documentedFeatures: analysis.documented_features,
                implementedFeatures: analysis.implemented_features,
                synchronizedFeatures: analysis.synchronized_features,
                syncPercentage: analysis.total_features > 0 ? 
                    Math.round((analysis.synchronized_features / analysis.total_features) * 100) : 0,
                discrepancyCount: analysis.discrepancy_count
            };

            return {
                hasData: true,
                analysisInfo: {
                    analysisDate: analysis.analysis_timestamp,
                    analysisDuration: analysis.analysis_duration_ms,
                    analysisParams: analysis.analysis_params
                },
                syncStatistics: syncStats,
                featureBreakdown: featuresResult.rows,
                discrepancies: discrepanciesResult.rows,
                recommendations: recommendationsResult.rows,
                healthScore: Math.max(0, Math.min(100, 
                    syncStats.syncPercentage - (analysis.discrepancy_count * 2)
                ))
            };

        } catch (error) {
            console.error('❌ Error loading reconciliation data:', error);
            throw error;
        }
    }

    // ===== WORKFLOW ORCHESTRATOR METHODS =====

    async getWorkflowData(projectId) {
        console.log(`🔄 Loading workflow data for project ${projectId}`);
        
        try {
            // Get recent workflow executions
            const executionsResult = await this.db.query(`
                SELECT 
                    we.execution_id,
                    wd.workflow_name,
                    wd.workflow_type,
                    we.status,
                    we.started_at,
                    we.completed_at,
                    we.total_duration_ms,
                    COUNT(wte.id) as tool_count,
                    COUNT(CASE WHEN wte.status = 'completed' THEN 1 END) as completed_tools,
                    COUNT(CASE WHEN wte.status = 'failed' THEN 1 END) as failed_tools
                FROM workflow_executions we
                LEFT JOIN workflow_definitions wd ON we.definition_id = wd.id
                LEFT JOIN workflow_tool_executions wte ON we.id = wte.workflow_execution_id
                WHERE we.project_id = $1
                GROUP BY we.id, wd.workflow_name, wd.workflow_type, we.status, we.started_at, we.completed_at, we.total_duration_ms, we.execution_id
                ORDER BY we.started_at DESC
                LIMIT 10
            `, [projectId]);

            // Get workflow templates and popularity
            const templatesResult = await this.db.query(`
                SELECT 
                    template_name,
                    category,
                    description,
                    tool_sequence,
                    expected_duration_ms,
                    popularity_score
                FROM workflow_templates
                ORDER BY popularity_score DESC
            `);

            // Get performance metrics for workflows
            const performanceResult = await this.db.query(`
                SELECT 
                    wd.workflow_name,
                    wl.execution_count,
                    wl.success_count,
                    wl.failure_count,
                    wl.avg_duration_ms,
                    wl.avg_tokens_used,
                    wl.user_satisfaction_score,
                    CASE 
                        WHEN wl.execution_count > 0 THEN 
                            ROUND((wl.success_count::DECIMAL / wl.execution_count) * 100, 2)
                        ELSE 0 
                    END as success_rate
                FROM workflow_learning wl
                JOIN workflow_definitions wd ON wl.definition_id = wd.id
                ORDER BY wl.execution_count DESC
            `);

            // Get latest execution details
            let latestExecution = null;
            if (executionsResult.rows.length > 0) {
                const latest = executionsResult.rows[0];
                const toolExecutionsResult = await this.db.query(`
                    SELECT 
                        tool_name,
                        execution_order,
                        status,
                        duration_ms,
                        tokens_used,
                        error_message
                    FROM workflow_tool_executions
                    WHERE workflow_execution_id = (
                        SELECT id FROM workflow_executions 
                        WHERE execution_id = $1
                    )
                    ORDER BY execution_order
                `, [latest.execution_id]);

                latestExecution = {
                    ...latest,
                    toolExecutions: toolExecutionsResult.rows
                };
            }

            return {
                hasData: executionsResult.rows.length > 0,
                recentExecutions: executionsResult.rows,
                latestExecution,
                availableTemplates: templatesResult.rows,
                performanceMetrics: performanceResult.rows,
                summary: {
                    totalExecutions: executionsResult.rows.length,
                    activeExecutions: executionsResult.rows.filter(e => e.status === 'running').length,
                    successfulExecutions: executionsResult.rows.filter(e => e.status === 'completed').length,
                    failedExecutions: executionsResult.rows.filter(e => e.status === 'failed').length,
                    avgDuration: Math.round(
                        executionsResult.rows
                            .filter(e => e.total_duration_ms)
                            .reduce((acc, e) => acc + e.total_duration_ms, 0) / 
                        Math.max(1, executionsResult.rows.filter(e => e.total_duration_ms).length)
                    )
                }
            };

        } catch (error) {
            console.error('❌ Error loading workflow data:', error);
            throw error;
        }
    }

    async executeWorkflow(projectId, templateName, params = {}) {
        console.log(`🚀 Starting workflow execution: ${templateName} for project ${projectId}`);
        
        try {
            // Get workflow template
            const templateResult = await this.db.query(`
                SELECT * FROM workflow_templates WHERE template_name = $1
            `, [templateName]);

            if (templateResult.rows.length === 0) {
                throw new Error(`Workflow template not found: ${templateName}`);
            }

            const template = templateResult.rows[0];

            // Get or create workflow definition
            let definitionResult = await this.db.query(`
                SELECT * FROM workflow_definitions WHERE workflow_name = $1
            `, [template.template_name]);

            let definitionId;
            if (definitionResult.rows.length === 0) {
                // Create new definition from template
                const createResult = await this.db.query(`
                    INSERT INTO workflow_definitions (
                        workflow_name, workflow_type, description, 
                        tool_sequence, default_params
                    ) VALUES ($1, $2, $3, $4, $5)
                    RETURNING id
                `, [
                    template.template_name,
                    template.category,
                    template.description,
                    template.tool_sequence,
                    params
                ]);
                definitionId = createResult.rows[0].id;
            } else {
                definitionId = definitionResult.rows[0].id;
            }

            // Create workflow execution record
            const executionResult = await this.db.query(`
                INSERT INTO workflow_executions (
                    project_id, definition_id, trigger_source, input_params, status
                ) VALUES ($1, $2, 'api', $3, 'pending')
                RETURNING id, execution_id
            `, [projectId, definitionId, params]);

            const { id: executionDbId, execution_id } = executionResult.rows[0];

            // Create tool execution records
            for (let i = 0; i < template.tool_sequence.length; i++) {
                const toolName = template.tool_sequence[i];
                await this.db.query(`
                    INSERT INTO workflow_tool_executions (
                        workflow_execution_id, tool_name, execution_order, status
                    ) VALUES ($1, $2, $3, 'pending')
                `, [executionDbId, toolName, i + 1]);
            }

            // Mark execution as running
            await this.db.query(`
                UPDATE workflow_executions 
                SET status = 'running', started_at = NOW()
                WHERE id = $1
            `, [executionDbId]);

            return {
                success: true,
                executionId: execution_id,
                workflowName: template.template_name,
                toolCount: template.tool_sequence.length,
                expectedDuration: template.expected_duration_ms,
                status: 'running',
                message: `Workflow ${template.template_name} started successfully`
            };

        } catch (error) {
            console.error('❌ Error executing workflow:', error);
            throw error;
        }
    }

    async getWorkflowStatus(executionId) {
        console.log(`📊 Getting workflow status for execution ${executionId}`);
        
        try {
            const result = await this.db.query(`
                SELECT 
                    we.execution_id,
                    wd.workflow_name,
                    we.status,
                    we.started_at,
                    we.completed_at,
                    we.total_duration_ms,
                    COUNT(wte.id) as total_tools,
                    COUNT(CASE WHEN wte.status = 'completed' THEN 1 END) as completed_tools,
                    COUNT(CASE WHEN wte.status = 'failed' THEN 1 END) as failed_tools,
                    COUNT(CASE WHEN wte.status = 'running' THEN 1 END) as running_tools
                FROM workflow_executions we
                JOIN workflow_definitions wd ON we.definition_id = wd.id
                LEFT JOIN workflow_tool_executions wte ON we.id = wte.workflow_execution_id
                WHERE we.execution_id = $1
                GROUP BY we.execution_id, wd.workflow_name, we.status, we.started_at, we.completed_at, we.total_duration_ms
            `, [executionId]);

            if (result.rows.length === 0) {
                return { error: 'Workflow execution not found' };
            }

            const workflow = result.rows[0];
            const progress = workflow.total_tools > 0 ? 
                Math.round((workflow.completed_tools / workflow.total_tools) * 100) : 0;

            return {
                executionId: workflow.execution_id,
                workflowName: workflow.workflow_name,
                status: workflow.status,
                progress,
                startedAt: workflow.started_at,
                completedAt: workflow.completed_at,
                duration: workflow.total_duration_ms,
                toolSummary: {
                    total: workflow.total_tools,
                    completed: workflow.completed_tools,
                    failed: workflow.failed_tools,
                    running: workflow.running_tools,
                    pending: workflow.total_tools - workflow.completed_tools - workflow.failed_tools - workflow.running_tools
                }
            };

        } catch (error) {
            console.error('❌ Error getting workflow status:', error);
            throw error;
        }
    }

    // ===== CROSS-TOOL INSIGHTS =====

    async getCrossToolInsights(projectId) {
        console.log(`💡 Loading cross-tool insights for project ${projectId}`);
        
        try {
            // Get insights that combine data from multiple tools
            const insightsResult = await this.db.query(`
                SELECT 
                    insight_type,
                    severity,
                    description,
                    affected_tools,
                    recommendations,
                    created_at
                FROM cross_tool_insights
                WHERE project_id = $1
                ORDER BY 
                    CASE severity 
                        WHEN 'critical' THEN 1 
                        WHEN 'high' THEN 2 
                        WHEN 'medium' THEN 3 
                        ELSE 4 
                    END,
                    created_at DESC
                LIMIT 10
            `, [projectId]);

            return {
                insights: insightsResult.rows,
                count: insightsResult.rows.length,
                highPriority: insightsResult.rows.filter(i => ['critical', 'high'].includes(i.severity)).length
            };

        } catch (error) {
            console.error('❌ Error loading cross-tool insights:', error);
            return { insights: [], count: 0, highPriority: 0 };
        }
    }
}

module.exports = { ThreeToolsAPI };