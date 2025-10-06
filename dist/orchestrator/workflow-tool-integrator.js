"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowToolIntegrator = void 0;
const logger_1 = require("../utils/logger");
const types_1 = require("./types");
/**
 * Integrates external tool management with workflow orchestration.
 * Handles tool recommendations, installations, and executions within role contexts.
 */
class WorkflowToolIntegrator {
    logger = logger_1.Logger.getInstance();
    toolManager;
    db;
    eventListeners = [];
    constructor(toolManager, database) {
        this.toolManager = toolManager;
        this.db = database;
    }
    /**
     * Called when a role starts execution - proactively recommends tools
     */
    async onRoleStart(context) {
        this.logger.info(`Role ${context.roleType} starting - analyzing tool needs`, {
            workflowId: context.workflowId,
            projectPath: context.projectPath,
            purpose: context.purpose
        });
        try {
            // Get tool recommendations for this role and project
            const recommendations = await this.toolManager.getToolRecommendations(context.projectPath, context.roleType);
            // Filter recommendations by timing (project-setup, before-coding, now)
            const relevantRecommendations = this.filterRecommendationsByTiming(recommendations, context);
            // Log recommendations for monitoring
            await this.logToolRecommendations(context, relevantRecommendations);
            // Auto-install high-priority tools with permissions
            await this.handleAutoInstallations(context, relevantRecommendations);
            return relevantRecommendations;
        }
        catch (error) {
            this.logger.error(`Error analyzing tool needs for ${context.roleType}:`, error);
            return [];
        }
    }
    /**
     * Execute a tool within a role context
     */
    async executeTool(toolId, args, context) {
        const startTime = Date.now();
        this.logger.debug(`Executing tool ${toolId} for role ${context.roleType}`, {
            args,
            workflowId: context.workflowId,
            projectPath: context.projectPath
        });
        try {
            // Check if tool is available, install if needed and permitted
            const isAvailable = await this.toolManager.isToolAvailable(toolId, context.projectPath);
            if (!isAvailable) {
                const installResult = await this.handleToolInstallation(toolId, context);
                if (!installResult) {
                    return {
                        toolId,
                        success: false,
                        output: '',
                        duration: Date.now() - startTime,
                        error: 'Tool not available and installation failed or denied'
                    };
                }
            }
            // Execute the tool
            const result = await this.toolManager.executeTool(toolId, args, context.projectPath, context.roleType);
            const executionResult = {
                toolId,
                success: result.success,
                output: result.output,
                duration: Date.now() - startTime,
                error: result.error
            };
            // Log execution for analytics
            await this.logToolExecution(context, executionResult, args);
            // Emit event for monitoring
            this.emitEvent({
                type: 'tool-executed',
                workflowId: context.workflowId,
                roleType: context.roleType,
                toolId,
                context: { success: result.success, duration: executionResult.duration },
                timestamp: new Date()
            });
            return executionResult;
        }
        catch (error) {
            const executionResult = {
                toolId,
                success: false,
                output: '',
                duration: Date.now() - startTime,
                error: error.message
            };
            await this.logToolExecution(context, executionResult, args);
            return executionResult;
        }
    }
    /**
     * Handle tool installation with user permission flow
     */
    async handleToolInstallation(toolId, context) {
        this.logger.info(`Attempting to install tool ${toolId} for ${context.roleType}`, {
            workflowId: context.workflowId,
            projectPath: context.projectPath
        });
        // Check existing permissions
        const hasPermission = await this.checkRoleToolPermission(context.roleType, toolId);
        if (hasPermission === 'auto-approved') {
            // Auto-install approved tools
            const installed = await this.toolManager.installTool(toolId, context.projectPath, context.roleType, true);
            if (installed) {
                this.emitEvent({
                    type: 'tool-installed',
                    workflowId: context.workflowId,
                    roleType: context.roleType,
                    toolId,
                    context: { autoInstall: true },
                    timestamp: new Date()
                });
            }
            return installed;
        }
        if (hasPermission === 'denied') {
            this.logger.warn(`Tool installation denied: ${toolId} for ${context.roleType}`);
            return false;
        }
        // Request permission from user
        const userApproval = await this.requestUserPermission(toolId, context);
        if (userApproval) {
            const installed = await this.toolManager.installTool(toolId, context.projectPath, context.roleType, false);
            if (installed) {
                this.emitEvent({
                    type: 'tool-installed',
                    workflowId: context.workflowId,
                    roleType: context.roleType,
                    toolId,
                    context: { userApproved: true },
                    timestamp: new Date()
                });
            }
            return installed;
        }
        return false;
    }
    /**
     * Request user permission for tool installation
     */
    async requestUserPermission(toolId, context) {
        // Emit event for external handling (e.g., CLI prompts)
        this.emitEvent({
            type: 'permission-requested',
            workflowId: context.workflowId,
            roleType: context.roleType,
            toolId,
            context: {
                purpose: context.purpose,
                projectPath: context.projectPath
            },
            timestamp: new Date()
        });
        // In a real implementation, this would integrate with the CLI or web interface
        // For now, we'll implement a simple approval mechanism
        // This could be enhanced to show tool details, security info, etc.
        try {
            // Query database for any existing approval history
            const approvalHistory = await this.getToolApprovalHistory(context.projectPath, toolId, context.roleType);
            // If user previously approved "always", auto-approve
            if (approvalHistory?.user_decision === 'approve-always') {
                return true;
            }
            // Otherwise, default to requiring explicit approval
            // In practice, this would trigger a user prompt
            return false; // Conservative default
        }
        catch (error) {
            this.logger.error('Error checking approval history:', error);
            return false;
        }
    }
    /**
     * Filter recommendations by timing context
     */
    filterRecommendationsByTiming(recommendations, context) {
        // Determine current phase based on context
        let currentTiming = 'as-needed';
        if (context.stepNumber <= 2) {
            currentTiming = 'project-setup';
        }
        else if (context.purpose.toLowerCase().includes('implement') ||
            context.purpose.toLowerCase().includes('code')) {
            currentTiming = 'before-coding';
        }
        else if (context.roleType === types_1.RoleType.SECURITY_AUDITOR ||
            context.roleType === types_1.RoleType.QUALITY_AUDITOR) {
            currentTiming = 'now';
        }
        return recommendations.filter(rec => {
            // Always include critical and high urgency tools
            if (rec.urgency === 'critical' || rec.urgency === 'high') {
                return true;
            }
            // Include tools matching current timing
            if (rec.timing === currentTiming || rec.timing === 'now') {
                return true;
            }
            // Include high-confidence tools regardless of timing
            return rec.confidence > 0.8;
        });
    }
    /**
     * Handle auto-installations for approved tools
     */
    async handleAutoInstallations(context, recommendations) {
        const autoInstallCandidates = recommendations.filter(rec => rec.urgency === 'critical' &&
            rec.tool.trustLevel === 'safe' &&
            rec.confidence > 0.7);
        for (const candidate of autoInstallCandidates) {
            try {
                const hasPermission = await this.checkRoleToolPermission(context.roleType, candidate.tool.id);
                if (hasPermission === 'auto-approved') {
                    await this.toolManager.installTool(candidate.tool.id, context.projectPath, context.roleType, true);
                    this.logger.info(`Auto-installed critical tool: ${candidate.tool.name}`, {
                        workflowId: context.workflowId,
                        roleType: context.roleType
                    });
                }
            }
            catch (error) {
                this.logger.warn(`Failed to auto-install ${candidate.tool.name}:`, error);
            }
        }
    }
    /**
     * Check role-tool permission status
     */
    async checkRoleToolPermission(roleType, toolId) {
        try {
            // Query database for role permissions
            // In practice, this would use the Database class to query role_tool_permissions table
            return 'ask-permission'; // Conservative default
        }
        catch (error) {
            this.logger.error('Error checking role tool permission:', error);
            return 'ask-permission';
        }
    }
    /**
     * Get tool approval history for user decisions
     */
    async getToolApprovalHistory(projectPath, toolId, roleType) {
        try {
            // Query tool_approval_history table
            // This would be implemented using the Database class
            return null;
        }
        catch (error) {
            this.logger.error('Error getting approval history:', error);
            return null;
        }
    }
    /**
     * Log tool recommendations for analytics
     */
    async logToolRecommendations(context, recommendations) {
        try {
            for (const rec of recommendations) {
                // Insert into tool_recommendations table
                // This would use the Database class for persistence
                this.logger.debug(`Recommended tool ${rec.tool.name} with confidence ${rec.confidence}`, {
                    workflowId: context.workflowId,
                    roleType: context.roleType,
                    urgency: rec.urgency,
                    reasons: rec.reasons
                });
            }
        }
        catch (error) {
            this.logger.error('Error logging tool recommendations:', error);
        }
    }
    /**
     * Log tool execution for analytics
     */
    async logToolExecution(context, result, args) {
        try {
            // Insert into tool_usage_analytics table
            // This would use the Database class for persistence
            this.logger.debug(`Tool execution logged: ${result.toolId}`, {
                workflowId: context.workflowId,
                roleType: context.roleType,
                success: result.success,
                duration: result.duration
            });
        }
        catch (error) {
            this.logger.error('Error logging tool execution:', error);
        }
    }
    /**
     * Event system for monitoring and external integration
     */
    addEventListener(listener) {
        this.eventListeners.push(listener);
    }
    removeEventListener(listener) {
        const index = this.eventListeners.indexOf(listener);
        if (index > -1) {
            this.eventListeners.splice(index, 1);
        }
    }
    emitEvent(event) {
        this.eventListeners.forEach(listener => {
            try {
                listener(event);
            }
            catch (error) {
                this.logger.error('Error in tool event listener:', error);
            }
        });
    }
    /**
     * Get available tools for a role in current context
     */
    async getAvailableTools(context) {
        try {
            const recommendations = await this.toolManager.getToolRecommendations(context.projectPath, context.roleType);
            return recommendations.map(rec => rec.tool.id);
        }
        catch (error) {
            this.logger.error('Error getting available tools:', error);
            return [];
        }
    }
    /**
     * Pre-install recommended tools during workflow initialization
     */
    async preInstallWorkflowTools(projectPath, workflowId, roles) {
        const results = { installed: [], failed: [], pending: [] };
        this.logger.info(`Pre-installing tools for workflow ${workflowId}`, {
            projectPath,
            roles: roles.length
        });
        try {
            for (const roleType of roles) {
                const recommendations = await this.toolManager.getToolRecommendations(projectPath, roleType);
                const preInstallCandidates = recommendations.filter(rec => rec.timing === 'project-setup' &&
                    rec.urgency !== 'low' &&
                    rec.tool.trustLevel === 'safe');
                for (const candidate of preInstallCandidates) {
                    const permission = await this.checkRoleToolPermission(roleType, candidate.tool.id);
                    if (permission === 'auto-approved') {
                        const success = await this.toolManager.installTool(candidate.tool.id, projectPath, roleType, true);
                        if (success) {
                            results.installed.push(candidate.tool.id);
                        }
                        else {
                            results.failed.push(candidate.tool.id);
                        }
                    }
                    else {
                        results.pending.push(candidate.tool.id);
                    }
                }
            }
            this.logger.info(`Pre-installation complete for workflow ${workflowId}`, results);
            return results;
        }
        catch (error) {
            this.logger.error(`Error pre-installing workflow tools:`, error);
            return results;
        }
    }
}
exports.WorkflowToolIntegrator = WorkflowToolIntegrator;
//# sourceMappingURL=workflow-tool-integrator.js.map