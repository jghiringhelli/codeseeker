/**
 * Tool Management Dashboard API
 * Handles all interactions with the tool management backend
 */

class ToolManagementAPI {
    constructor() {
        this.baseUrl = window.location.origin;
        this.currentProject = null;
        this.tools = new Map();
        this.bundles = new Map();
        
        this.initialize();
    }

    async initialize() {
        await this.loadTools();
        await this.loadBundles();
        await this.loadAnalytics();
        this.updateStats();
        this.renderTools();
        this.renderBundles();
    }

    // API Methods
    async loadTools() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tools/list`);
            const data = await response.json();
            
            this.tools.clear();
            data.tools?.forEach(tool => {
                this.tools.set(tool.name, tool);
            });
            
            console.log(`✅ Loaded ${this.tools.size} tools`);
        } catch (error) {
            console.error('❌ Failed to load tools:', error);
            this.loadMockTools(); // Fallback to mock data
        }
    }

    async loadBundles() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tools/bundles`);
            const data = await response.json();
            
            this.bundles.clear();
            data.bundles?.forEach(bundle => {
                this.bundles.set(bundle.id, bundle);
            });
            
            console.log(`✅ Loaded ${this.bundles.size} bundles`);
        } catch (error) {
            console.error('❌ Failed to load bundles:', error);
            this.loadMockBundles(); // Fallback to mock data
        }
    }

    async saveTool(toolData) {
        try {
            const response = await fetch(`${this.baseUrl}/api/tools/update/${toolData.name}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(toolData)
            });
            
            if (response.ok) {
                this.tools.set(toolData.name, toolData);
                this.showNotification('Tool updated successfully!', 'success');
                this.renderTools();
                return true;
            } else {
                throw new Error('Failed to save tool');
            }
        } catch (error) {
            console.error('❌ Failed to save tool:', error);
            this.showNotification('Failed to save tool', 'error');
            return false;
        }
    }

    async saveBundle(bundleData) {
        try {
            const response = await fetch(`${this.baseUrl}/api/tools/bundles/${bundleData.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bundleData)
            });
            
            if (response.ok) {
                this.bundles.set(bundleData.id, bundleData);
                this.showNotification('Bundle saved successfully!', 'success');
                this.renderBundles();
                return true;
            } else {
                throw new Error('Failed to save bundle');
            }
        } catch (error) {
            console.error('❌ Failed to save bundle:', error);
            this.showNotification('Failed to save bundle', 'error');
            return false;
        }
    }

    async loadAnalytics() {
        try {
            const response = await fetch(`${this.baseUrl}/api/tools/analytics`);
            const data = await response.json();
            
            this.analytics = data;
            this.renderAnalytics();
        } catch (error) {
            console.error('❌ Failed to load analytics:', error);
            this.loadMockAnalytics();
        }
    }

    // Mock Data for Development/Fallback
    loadMockTools() {
        const mockTools = [
            {
                name: 'context-optimizer',
                category: 'optimization',
                trustLevel: 9.5,
                version: '2.0.0',
                description: 'Intelligent context optimization for token-efficient Claude Code integration',
                capabilities: ['file-prioritization', 'semantic-weighting', 'token-optimization', 'relevance-scoring'],
                status: { health: 'healthy', initialized: true, lastAnalysis: new Date() }
            },
            {
                name: 'semantic-search',
                category: 'search',
                trustLevel: 9.0,
                version: '2.0.0',
                description: 'Advanced semantic search using graph-based understanding of code relationships',
                capabilities: ['semantic-code-search', 'concept-matching', 'cross-reference-analysis', 'intent-based-search'],
                status: { health: 'healthy', initialized: true, lastAnalysis: new Date() }
            },
            {
                name: 'centralization-detector',
                category: 'architecture',
                trustLevel: 8.5,
                version: '1.5.0',
                description: 'Identifies opportunities for code centralization and architectural improvements',
                capabilities: ['duplication-detection', 'centralization-opportunities', 'architectural-analysis'],
                status: { health: 'warning', initialized: true, lastAnalysis: new Date(Date.now() - 86400000) }
            },
            {
                name: 'duplication-detector',
                category: 'quality',
                trustLevel: 8.0,
                version: '1.8.0',
                description: 'Advanced code duplication detection with intelligent consolidation suggestions',
                capabilities: ['exact-duplication', 'semantic-duplication', 'refactoring-suggestions'],
                status: { health: 'healthy', initialized: true, lastAnalysis: new Date() }
            },
            {
                name: 'tree-navigator',
                category: 'navigation',
                trustLevel: 8.0,
                version: '1.6.0',
                description: 'Intelligent code tree navigation with context-aware traversal',
                capabilities: ['tree-traversal', 'dependency-mapping', 'code-relationships'],
                status: { health: 'error', initialized: false, lastAnalysis: null }
            }
        ];

        this.tools.clear();
        mockTools.forEach(tool => {
            this.tools.set(tool.name, tool);
        });
    }

    loadMockBundles() {
        const mockBundles = [
            {
                id: 'architecture-analysis',
                name: 'Architecture Analysis Bundle',
                description: 'Comprehensive architectural assessment and design guidance',
                requiredTools: ['context-optimizer', 'centralization-detector', 'semantic-search'],
                optionalTools: ['tree-navigator', 'solid-principles-analyzer'],
                activationKeywords: ['architecture', 'design', 'structure', 'refactor', 'organize'],
                priority: 9,
                useCase: 'When users need deep architectural insights and design recommendations'
            },
            {
                id: 'code-quality-audit',
                name: 'Code Quality Audit Bundle',
                description: 'Complete code quality assessment with improvement suggestions',
                requiredTools: ['duplication-detector', 'solid-principles-analyzer', 'compilation-verifier'],
                optionalTools: ['test-coverage-analyzer', 'documentation-analyzer'],
                activationKeywords: ['quality', 'audit', 'review', 'clean', 'improve', 'best practices'],
                priority: 8,
                useCase: 'For comprehensive code quality reviews and improvement guidance'
            },
            {
                id: 'performance-optimization',
                name: 'Performance Optimization Bundle',
                description: 'Tools focused on identifying and resolving performance issues',
                requiredTools: ['context-optimizer', 'duplication-detector'],
                optionalTools: ['centralization-detector', 'compilation-verifier'],
                activationKeywords: ['performance', 'optimize', 'slow', 'efficiency', 'speed'],
                priority: 8,
                useCase: 'When performance improvements are the primary concern'
            }
        ];

        this.bundles.clear();
        mockBundles.forEach(bundle => {
            this.bundles.set(bundle.id, bundle);
        });
    }

    loadMockAnalytics() {
        this.analytics = {
            toolUsage: [
                { tool: 'context-optimizer', uses: 45, lastUsed: '2 hours ago', avgConfidence: 0.92 },
                { tool: 'semantic-search', uses: 38, lastUsed: '1 hour ago', avgConfidence: 0.88 },
                { tool: 'duplication-detector', uses: 22, lastUsed: '4 hours ago', avgConfidence: 0.85 },
                { tool: 'centralization-detector', uses: 15, lastUsed: '1 day ago', avgConfidence: 0.78 }
            ],
            bundleActivations: [
                { bundle: 'architecture-analysis', activations: 12, effectiveness: 0.94 },
                { bundle: 'code-quality-audit', activations: 8, effectiveness: 0.91 },
                { bundle: 'performance-optimization', activations: 6, effectiveness: 0.87 }
            ],
            selectionAccuracy: 0.89,
            avgToolsPerRequest: 3.2
        };
    }

    // UI Rendering Methods
    updateStats() {
        const totalTools = this.tools.size;
        const healthyTools = Array.from(this.tools.values()).filter(tool => 
            tool.status?.health === 'healthy'
        ).length;
        const totalBundles = this.bundles.size;
        const avgTrust = totalTools > 0 ? 
            (Array.from(this.tools.values()).reduce((sum, tool) => sum + tool.trustLevel, 0) / totalTools).toFixed(1) : 
            0;

        document.getElementById('total-tools').textContent = totalTools;
        document.getElementById('healthy-tools').textContent = healthyTools;
        document.getElementById('total-bundles').textContent = totalBundles;
        document.getElementById('avg-trust').textContent = avgTrust;
    }

    renderTools() {
        const container = document.getElementById('tools-container');
        container.innerHTML = '';

        Array.from(this.tools.values()).forEach(tool => {
            const toolCard = this.createToolCard(tool);
            container.appendChild(toolCard);
        });
    }

    createToolCard(tool) {
        const card = document.createElement('div');
        card.className = 'tool-card';
        
        const statusClass = tool.status?.health === 'healthy' ? 'status-healthy' : 
                           tool.status?.health === 'warning' ? 'status-warning' : 'status-error';
        
        const trustPercent = (tool.trustLevel / 10) * 100;
        
        card.innerHTML = `
            <div class="tool-header">
                <div>
                    <div class="tool-name">
                        <span class="status-indicator ${statusClass}"></span>
                        ${tool.name}
                    </div>
                    <div class="tool-category">${tool.category}</div>
                </div>
            </div>
            <div class="trust-level">
                <span>Trust: ${tool.trustLevel}/10</span>
                <div class="trust-bar">
                    <div class="trust-fill" style="width: ${trustPercent}%"></div>
                </div>
            </div>
            <div class="tool-description">
                ${tool.description}
            </div>
            <div class="capabilities">
                ${tool.capabilities.map(cap => `<span class="capability">${cap}</span>`).join('')}
            </div>
            <div class="tool-actions">
                <button class="btn btn-primary" onclick="editTool('${tool.name}')">Edit</button>
                <button class="btn btn-secondary" onclick="testTool('${tool.name}')">Test</button>
                <button class="btn btn-success" onclick="viewAnalytics('${tool.name}')">Analytics</button>
            </div>
        `;
        
        return card;
    }

    renderBundles() {
        const container = document.getElementById('bundles-container');
        container.innerHTML = '';

        Array.from(this.bundles.values()).forEach(bundle => {
            const bundleCard = this.createBundleCard(bundle);
            container.appendChild(bundleCard);
        });
    }

    createBundleCard(bundle) {
        const card = document.createElement('div');
        card.className = 'bundle-card';
        
        card.innerHTML = `
            <div class="bundle-header">
                <div>
                    <div class="bundle-name">${bundle.name}</div>
                    <div class="bundle-priority">Priority: ${bundle.priority}</div>
                </div>
            </div>
            <div class="tool-description">
                ${bundle.description}
            </div>
            <div class="bundle-tools">
                <h4>Required Tools:</h4>
                <div class="tool-list">
                    ${bundle.requiredTools.map(tool => `<span class="tool-tag">${tool}</span>`).join('')}
                </div>
                <h4>Optional Tools:</h4>
                <div class="tool-list">
                    ${bundle.optionalTools.map(tool => `<span class="tool-tag optional">${tool}</span>`).join('')}
                </div>
            </div>
            <div class="keywords">
                <h4>Activation Keywords:</h4>
                ${bundle.activationKeywords.map(keyword => `<span class="keyword">${keyword}</span>`).join('')}
            </div>
            <div style="margin-top: 15px; color: #666; font-size: 0.9rem;">
                <strong>Use Case:</strong> ${bundle.useCase}
            </div>
            <div class="tool-actions">
                <button class="btn btn-primary" onclick="editBundle('${bundle.id}')">Edit</button>
                <button class="btn btn-secondary" onclick="testBundle('${bundle.id}')">Test</button>
                <button class="btn btn-success" onclick="viewBundleAnalytics('${bundle.id}')">Analytics</button>
            </div>
        `;
        
        return card;
    }

    renderAnalytics() {
        const container = document.getElementById('analytics-container');
        
        if (!this.analytics) {
            container.innerHTML = '<p>Loading analytics...</p>';
            return;
        }

        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-value">${(this.analytics.selectionAccuracy * 100).toFixed(1)}%</div>
                    <div class="stat-label">Selection Accuracy</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${this.analytics.avgToolsPerRequest}</div>
                    <div class="stat-label">Avg Tools/Request</div>
                </div>
            </div>
            
            <h4 style="margin: 30px 0 20px 0;">Tool Usage</h4>
            <div class="tools-grid">
                ${this.analytics.toolUsage.map(usage => `
                    <div class="tool-card">
                        <div class="tool-name">${usage.tool}</div>
                        <div style="margin: 10px 0;">
                            <strong>Uses:</strong> ${usage.uses}<br>
                            <strong>Last Used:</strong> ${usage.lastUsed}<br>
                            <strong>Avg Confidence:</strong> ${(usage.avgConfidence * 100).toFixed(1)}%
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <h4 style="margin: 30px 0 20px 0;">Bundle Activations</h4>
            <div class="bundles-grid">
                ${this.analytics.bundleActivations.map(activation => `
                    <div class="bundle-card">
                        <div class="bundle-name">${activation.bundle}</div>
                        <div style="margin: 10px 0;">
                            <strong>Activations:</strong> ${activation.activations}<br>
                            <strong>Effectiveness:</strong> ${(activation.effectiveness * 100).toFixed(1)}%
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    showNotification(message, type = 'info') {
        // Simple notification system
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
            color: white;
            border-radius: 8px;
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Global Functions for UI Interaction
const api = new ToolManagementAPI();

function switchTab(tabName) {
    // Remove active class from all tabs and content
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    // Add active class to selected tab and content
    event.target.classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

function editTool(toolName) {
    const tool = api.tools.get(toolName);
    if (!tool) return;

    // Populate form
    document.getElementById('tool-name').value = tool.name;
    document.getElementById('tool-description').value = tool.description;
    document.getElementById('tool-category').value = tool.category;
    document.getElementById('tool-trust').value = tool.trustLevel;
    document.getElementById('tool-capabilities').value = tool.capabilities.join(', ');
    
    // Show modal
    document.getElementById('tool-modal').classList.add('active');
}

function saveTool() {
    const form = document.getElementById('tool-form');
    const formData = new FormData(form);
    
    const toolData = {
        name: formData.get('name'),
        description: formData.get('description'),
        category: formData.get('category'),
        trustLevel: parseFloat(formData.get('trustLevel')),
        capabilities: formData.get('capabilities').split(',').map(c => c.trim())
    };
    
    api.saveTool(toolData).then(success => {
        if (success) {
            closeModal('tool-modal');
        }
    });
}

function editBundle(bundleId) {
    const bundle = api.bundles.get(bundleId);
    if (!bundle) return;

    // Populate form
    document.getElementById('bundle-id').value = bundle.id;
    document.getElementById('bundle-name').value = bundle.name;
    document.getElementById('bundle-description').value = bundle.description;
    document.getElementById('bundle-required').value = bundle.requiredTools.join(', ');
    document.getElementById('bundle-optional').value = bundle.optionalTools.join(', ');
    document.getElementById('bundle-keywords').value = bundle.activationKeywords.join(', ');
    document.getElementById('bundle-priority').value = bundle.priority;
    document.getElementById('bundle-usecase').value = bundle.useCase;
    
    // Show modal
    document.getElementById('bundle-modal').classList.add('active');
}

function createBundle() {
    // Clear form
    document.getElementById('bundle-form').reset();
    document.getElementById('bundle-modal').classList.add('active');
}

function saveBundle() {
    const form = document.getElementById('bundle-form');
    const formData = new FormData(form);
    
    const bundleData = {
        id: formData.get('id'),
        name: formData.get('name'),
        description: formData.get('description'),
        requiredTools: formData.get('requiredTools').split(',').map(t => t.trim()),
        optionalTools: formData.get('optionalTools').split(',').map(t => t.trim()),
        activationKeywords: formData.get('activationKeywords').split(',').map(k => k.trim()),
        priority: parseInt(formData.get('priority')),
        useCase: formData.get('useCase')
    };
    
    api.saveBundle(bundleData).then(success => {
        if (success) {
            closeModal('bundle-modal');
        }
    });
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function testTool(toolName) {
    api.showNotification(`Testing ${toolName}...`, 'info');
    // In real implementation, would trigger tool test
}

function testBundle(bundleId) {
    api.showNotification(`Testing bundle ${bundleId}...`, 'info');
    // In real implementation, would trigger bundle test
}

function viewAnalytics(toolName) {
    // Switch to analytics tab and filter by tool
    switchTab('analytics');
    // Additional filtering logic would go here
}

function viewBundleAnalytics(bundleId) {
    // Switch to analytics tab and filter by bundle
    switchTab('analytics');
    // Additional filtering logic would go here
}

// Close modals when clicking outside
document.addEventListener('click', (event) => {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
});

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(style);