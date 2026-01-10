// Orchestrator Service - Integration between Dashboard and WorkflowOrchestrator
const { Pool } = require('pg');
const { EventEmitter } = require('events');

class OrchestratorService extends EventEmitter {
    constructor() {
        super();
        this.db = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'codeseeker',
            user: process.env.DB_USER || 'codeseeker',
            password: process.env.DB_PASSWORD || 'codeseeker123'
        });
        
        this.activeWorkflows = new Map(); // executionId -> WorkflowOrchestrator instance
        this.workflowOrchestrator = null; // Will be injected when TypeScript orchestrator is available
        
        console.log('🎯 OrchestratorService initialized');
    }

    // Initialize with WorkflowOrchestrator instance (when available)
    setWorkflowOrchestrator(workflowOrchestrator) {
        this.workflowOrchestrator = workflowOrchestrator;
        console.log('✅ WorkflowOrchestrator instance connected');
    }

    // Start a new workflow execution
    async startWorkflow(workflowId, workItemId, metadata = {}) {
        try {
            const executionId = `exec-${workItemId}-${Date.now()}`;
            
            console.log(`🚀 Starting workflow: ${workflowId} for work item: ${workItemId}`);
            
            // Get project ID (try to find existing or create new)
            let projectId = null;
            if (metadata.projectPath) {
                const projectResult = await this.db.query(
                    'SELECT id FROM projects WHERE project_path = $1 LIMIT 1',
                    [metadata.projectPath]
                );
                
                if (projectResult.rows.length > 0) {
                    projectId = projectResult.rows[0].id;
                } else {
                    // Create new project
                    const newProjectResult = await this.db.query(`
                        INSERT INTO projects (project_name, project_path, project_type, status)
                        VALUES ($1, $2, $3, 'active')
                        RETURNING id
                    `, [
                        metadata.projectName || workItemId,
                        metadata.projectPath,
                        metadata.projectType || 'unknown'
                    ]);
                    projectId = newProjectResult.rows[0].id;
                }
            }

            // Insert workflow execution record
            const processResult = await this.db.query(`
                INSERT INTO orchestration_processes (
                    execution_id, work_item_id, project_id, process_name, process_type, 
                    status, priority, total_phases, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING id
            `, [
                executionId,
                workItemId,
                projectId,
                workflowId,
                'WORKFLOW',
                'pending',
                metadata.priority || 1,
                this.getWorkflowPhaseCount(workflowId),
                JSON.stringify(metadata)
            ]);

            const processId = processResult.rows[0].id;

            // Log workflow start
            await this.logProcess(processId, 'info', `Workflow ${workflowId} started for work item ${workItemId}`, 'orchestrator');

            // If WorkflowOrchestrator is available, start actual execution
            if (this.workflowOrchestrator) {
                try {
                    const actualExecutionId = await this.workflowOrchestrator.startWorkflow(
                        workItemId,
                        workflowId,
                        metadata.inputs || {},
                        metadata
                    );
                    
                    // Store the mapping
                    this.activeWorkflows.set(executionId, {
                        actualExecutionId,
                        workflowOrchestrator: this.workflowOrchestrator,
                        processId,
                        status: 'running'
                    });

                    // Update status to running
                    await this.updateProcessStatus(processId, 'running', 1);
                    await this.logProcess(processId, 'info', `Workflow engine started execution: ${actualExecutionId}`, 'workflow-engine');
                    
                } catch (orchestratorError) {
                    console.error('❌ WorkflowOrchestrator error:', orchestratorError);
                    await this.updateProcessStatus(processId, 'failed', null, orchestratorError.message);
                    await this.logProcess(processId, 'error', `Workflow engine failed: ${orchestratorError.message}`, 'workflow-engine');
                    throw orchestratorError;
                }
            } else {
                // Simulate workflow execution without actual orchestrator
                console.log('⚠️ No WorkflowOrchestrator available, simulating execution');
                await this.simulateWorkflowExecution(executionId, processId, workflowId);
            }

            this.emit('workflow-started', { executionId, workItemId, workflowId, processId });
            
            return {
                success: true,
                executionId,
                processId,
                message: 'Workflow started successfully'
            };
            
        } catch (error) {
            console.error('❌ Failed to start workflow:', error);
            throw new Error(`Failed to start workflow: ${error.message}`);
        }
    }

    // Pause a workflow
    async pauseWorkflow(executionId) {
        try {
            const workflow = this.activeWorkflows.get(executionId);
            
            if (workflow && workflow.workflowOrchestrator) {
                // Pause actual workflow
                await workflow.workflowOrchestrator.pauseExecution?.(workflow.actualExecutionId);
            }

            // Update database status
            const result = await this.db.query(`
                UPDATE orchestration_processes 
                SET status = 'paused', updated_at = NOW()
                WHERE execution_id = $1
                RETURNING id
            `, [executionId]);

            if (result.rows.length > 0) {
                const processId = result.rows[0].id;
                await this.logProcess(processId, 'info', 'Workflow paused via dashboard', 'dashboard');
                this.emit('workflow-paused', { executionId });
                return { success: true, message: 'Workflow paused successfully' };
            }

            return { success: false, message: 'Workflow not found' };
            
        } catch (error) {
            console.error('❌ Failed to pause workflow:', error);
            throw new Error(`Failed to pause workflow: ${error.message}`);
        }
    }

    // Resume a workflow
    async resumeWorkflow(executionId) {
        try {
            const workflow = this.activeWorkflows.get(executionId);
            
            if (workflow && workflow.workflowOrchestrator) {
                // Resume actual workflow
                await workflow.workflowOrchestrator.resumeExecution?.(workflow.actualExecutionId);
            }

            // Update database status
            const result = await this.db.query(`
                UPDATE orchestration_processes 
                SET status = 'running', updated_at = NOW()
                WHERE execution_id = $1
                RETURNING id
            `, [executionId]);

            if (result.rows.length > 0) {
                const processId = result.rows[0].id;
                await this.logProcess(processId, 'info', 'Workflow resumed via dashboard', 'dashboard');
                this.emit('workflow-resumed', { executionId });
                return { success: true, message: 'Workflow resumed successfully' };
            }

            return { success: false, message: 'Workflow not found' };
            
        } catch (error) {
            console.error('❌ Failed to resume workflow:', error);
            throw new Error(`Failed to resume workflow: ${error.message}`);
        }
    }

    // Stop/cancel a workflow
    async stopWorkflow(executionId) {
        try {
            const workflow = this.activeWorkflows.get(executionId);
            
            if (workflow && workflow.workflowOrchestrator) {
                // Cancel actual workflow
                await workflow.workflowOrchestrator.cancelExecution?.(workflow.actualExecutionId);
                this.activeWorkflows.delete(executionId);
            }

            // Update database status
            const result = await this.db.query(`
                UPDATE orchestration_processes 
                SET status = 'cancelled', completed_at = NOW(), updated_at = NOW()
                WHERE execution_id = $1
                RETURNING id
            `, [executionId]);

            if (result.rows.length > 0) {
                const processId = result.rows[0].id;
                await this.logProcess(processId, 'info', 'Workflow cancelled via dashboard', 'dashboard');
                this.emit('workflow-stopped', { executionId });
                return { success: true, message: 'Workflow stopped successfully' };
            }

            return { success: false, message: 'Workflow not found' };
            
        } catch (error) {
            console.error('❌ Failed to stop workflow:', error);
            throw new Error(`Failed to stop workflow: ${error.message}`);
        }
    }

    // Bulk operations
    async pauseAllWorkflows() {
        try {
            // Pause all active workflows in orchestrator
            for (const [executionId, workflow] of this.activeWorkflows) {
                if (workflow.workflowOrchestrator && workflow.status === 'running') {
                    try {
                        await workflow.workflowOrchestrator.pauseExecution?.(workflow.actualExecutionId);
                    } catch (error) {
                        console.error(`Failed to pause workflow ${executionId}:`, error);
                    }
                }
            }

            // Update all running workflows in database
            const result = await this.db.query(`
                UPDATE orchestration_processes 
                SET status = 'paused', updated_at = NOW()
                WHERE status = 'running'
            `);

            // Log bulk operation
            if (result.rowCount > 0) {
                const processIds = await this.db.query(`
                    SELECT id FROM orchestration_processes WHERE status = 'paused'
                `);
                
                for (const row of processIds.rows) {
                    await this.logProcess(row.id, 'info', 'Workflow paused via bulk operation', 'dashboard');
                }
            }

            this.emit('workflows-bulk-paused', { count: result.rowCount });
            return { success: true, count: result.rowCount, message: `Paused ${result.rowCount} workflows` };
            
        } catch (error) {
            console.error('❌ Failed to pause all workflows:', error);
            throw new Error(`Failed to pause workflows: ${error.message}`);
        }
    }

    async stopAllWorkflows() {
        try {
            // Stop all active workflows in orchestrator
            for (const [executionId, workflow] of this.activeWorkflows) {
                if (workflow.workflowOrchestrator) {
                    try {
                        await workflow.workflowOrchestrator.cancelExecution?.(workflow.actualExecutionId);
                    } catch (error) {
                        console.error(`Failed to stop workflow ${executionId}:`, error);
                    }
                }
            }

            // Clear active workflows map
            this.activeWorkflows.clear();

            // Update all active workflows in database
            const result = await this.db.query(`
                UPDATE orchestration_processes 
                SET status = 'cancelled', completed_at = NOW(), updated_at = NOW()
                WHERE status IN ('running', 'paused')
            `);

            // Log bulk operation
            if (result.rowCount > 0) {
                const processIds = await this.db.query(`
                    SELECT id FROM orchestration_processes WHERE status = 'cancelled'
                `);
                
                for (const row of processIds.rows) {
                    await this.logProcess(row.id, 'info', 'Workflow cancelled via bulk operation', 'dashboard');
                }
            }

            this.emit('workflows-bulk-stopped', { count: result.rowCount });
            return { success: true, count: result.rowCount, message: `Stopped ${result.rowCount} workflows` };
            
        } catch (error) {
            console.error('❌ Failed to stop all workflows:', error);
            throw new Error(`Failed to stop workflows: ${error.message}`);
        }
    }

    // Simulate workflow execution (when actual orchestrator is not available)
    async simulateWorkflowExecution(executionId, processId, workflowId) {
        console.log(`🎭 Simulating workflow execution: ${executionId}`);
        
        const phaseCount = this.getWorkflowPhaseCount(workflowId);
        const phaseDuration = 10000; // 10 seconds per phase for demo
        
        // Start simulation
        await this.updateProcessStatus(processId, 'running', 1);
        
        // Simulate phases
        for (let phase = 1; phase <= phaseCount; phase++) {
            await new Promise(resolve => setTimeout(resolve, phaseDuration));
            
            const progress = (phase / phaseCount) * 100;
            await this.updateProcessStatus(processId, 'running', phase, null, progress);
            await this.logProcess(processId, 'info', `Completed phase ${phase}/${phaseCount}`, 'simulator');
            
            this.emit('workflow-progress', { executionId, phase, totalPhases: phaseCount, progress });
        }
        
        // Complete workflow
        await this.updateProcessStatus(processId, 'completed', phaseCount, null, 100);
        await this.logProcess(processId, 'info', 'Workflow simulation completed successfully', 'simulator');
        
        // Add accomplishment
        await this.addAccomplishment(processId, 'Workflow Completed', `Successfully completed ${workflowId} workflow simulation`, 'moderate');
        
        this.emit('workflow-completed', { executionId });
    }

    // Helper methods
    async updateProcessStatus(processId, status, currentPhase = null, errorDetails = null, progress = null) {
        const updates = ['status = $2', 'updated_at = NOW()'];
        const params = [processId, status];
        let paramIndex = 3;

        if (currentPhase !== null) {
            updates.push(`current_phase = $${paramIndex}`);
            params.push(currentPhase);
            paramIndex++;
        }

        if (progress !== null) {
            updates.push(`progress_percent = $${paramIndex}`);
            params.push(progress);
            paramIndex++;
        }

        if (errorDetails) {
            updates.push(`error_details = $${paramIndex}`);
            params.push(errorDetails);
            paramIndex++;
        }

        if (status === 'completed' || status === 'failed' || status === 'cancelled') {
            updates.push('completed_at = NOW()');
        }

        const query = `UPDATE orchestration_processes SET ${updates.join(', ')} WHERE id = $1`;
        await this.db.query(query, params);
    }

    async logProcess(processId, level, message, source = 'orchestrator') {
        await this.db.query(`
            INSERT INTO process_logs (process_id, log_level, message, source, timestamp)
            VALUES ($1, $2, $3, $4, NOW())
        `, [processId, level, message, source]);
    }

    async addAccomplishment(processId, title, description, impactLevel) {
        // Get project ID from process
        const processResult = await this.db.query('SELECT project_id FROM orchestration_processes WHERE id = $1', [processId]);
        const projectId = processResult.rows[0]?.project_id;

        await this.db.query(`
            INSERT INTO accomplishments (project_id, process_id, title, description, impact_level)
            VALUES ($1, $2, $3, $4, $5)
        `, [projectId, processId, title, description, impactLevel]);
    }

    getWorkflowPhaseCount(workflowId) {
        const phaseCounts = {
            'feature-development-v1': 16,
            'defect-resolution-v1': 8,
            'simple-development-v1': 5,
            'prototype-development-v1': 6,
            'nonfunctional-improvements-v1': 10,
            'tech-debt-v1': 8,
            'hotfix-v1': 6
        };
        return phaseCounts[workflowId] || 8;
    }

    // Get system status
    async getSystemStatus() {
        try {
            const [healthResult, processesResult, templatesResult] = await Promise.all([
                this.db.query('SELECT * FROM dashboard_system_health'),
                this.db.query(`
                    SELECT 
                        COUNT(CASE WHEN status IN ('running', 'paused') THEN 1 END) as active_workflows,
                        COUNT(CASE WHEN status = 'pending' THEN 1 END) as queued_workflows,
                        COUNT(*) as total_executions
                    FROM orchestration_processes 
                    WHERE started_at >= NOW() - INTERVAL '24 hours'
                `),
                this.db.query('SELECT COUNT(*) as total_flows FROM workflow_templates WHERE enabled = true')
            ]);

            return {
                status: 'healthy',
                activeWorkflows: parseInt(processesResult.rows[0]?.active_workflows || 0),
                queuedWorkflows: parseInt(processesResult.rows[0]?.queued_workflows || 0),
                totalFlows: parseInt(templatesResult.rows[0]?.total_flows || 0),
                systemHealth: healthResult.rows[0] || {},
                timestamp: new Date().toISOString(),
                orchestratorConnected: !!this.workflowOrchestrator
            };
        } catch (error) {
            console.error('❌ Failed to get system status:', error);
            return {
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Cleanup method
    async shutdown() {
        console.log('🛑 Shutting down OrchestratorService...');
        
        // Stop all active workflows
        for (const [executionId, workflow] of this.activeWorkflows) {
            try {
                if (workflow.workflowOrchestrator) {
                    await workflow.workflowOrchestrator.cancelExecution?.(workflow.actualExecutionId);
                }
            } catch (error) {
                console.error(`Failed to stop workflow ${executionId} during shutdown:`, error);
            }
        }
        
        await this.db.end();
        console.log('✅ OrchestratorService shutdown complete');
    }
}

module.exports = { OrchestratorService };