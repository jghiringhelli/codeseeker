/**
 * CodeMind Project API - Real Data Integration
 * Focuses on the actual CodeMind project data from initialized databases
 */

const { Pool } = require('pg');
const neo4j = require('neo4j-driver');
const fs = require('fs').promises;
const path = require('path');

class CodeMindProjectAPI {
    constructor() {
        this.initializeConnections();
    }

    async initializeConnections() {
        // PostgreSQL connection
        this.pg = new Pool({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: process.env.DB_NAME || 'codemind',
            user: process.env.DB_USER || 'codemind',
            password: process.env.DB_PASSWORD || 'codemind123',
        });

        // Neo4j connection
        try {
            this.neo4j = neo4j.driver(
                process.env.NEO4J_URI || 'bolt://localhost:7687',
                neo4j.auth.basic(
                    process.env.NEO4J_USER || 'neo4j',
                    process.env.NEO4J_PASSWORD || 'codemind123'
                )
            );
        } catch (error) {
            console.warn('⚠️ Neo4j connection failed:', error.message);
            this.neo4j = null;
        }
    }

    /**
     * Get CodeMind project overview
     */
    async getCodeMindProjectOverview() {
        const projectPath = 'C:\\workspace\\claude\\CodeMind';
        
        try {
            const [
                projectData,
                graphData,
                fileStructure,
                useCases
            ] = await Promise.allSettled([
                this.getProjectFromDatabase(projectPath),
                this.getSemanticGraphData(),
                this.getProjectFileStructure(projectPath),
                this.extractUseCasesFromDocs(projectPath)
            ]);

            return {
                success: true,
                data: {
                    project: this.extractValue(projectData),
                    graph: this.extractValue(graphData),
                    files: this.extractValue(fileStructure),
                    useCases: this.extractValue(useCases),
                    lastUpdated: new Date().toISOString(),
                    databases: await this.getDatabaseStatus()
                }
            };
        } catch (error) {
            console.error('Error getting CodeMind project overview:', error);
            return {
                success: false,
                error: error.message,
                data: null
            };
        }
    }

    /**
     * Get project data from PostgreSQL
     */
    async getProjectFromDatabase(projectPath) {
        try {
            const result = await this.pg.query(
                'SELECT * FROM projects WHERE project_path = $1',
                [projectPath]
            );
            
            if (result.rows.length === 0) {
                return {
                    name: 'CodeMind',
                    path: projectPath,
                    type: 'cli_tool',
                    status: 'active',
                    languages: ['TypeScript', 'JavaScript'],
                    frameworks: ['Express', 'Node.js', 'Docker']
                };
            }
            
            return result.rows[0];
        } catch (error) {
            console.warn('PostgreSQL query error:', error.message);
            return null;
        }
    }

    /**
     * Get semantic graph data from Neo4j
     */
    async getSemanticGraphData() {
        if (!this.neo4j) return { nodes: 0, relationships: 0, error: 'Neo4j not connected' };
        
        try {
            const session = this.neo4j.session();
            
            // Get graph statistics
            const statsResult = await session.run(`
                MATCH (n) 
                OPTIONAL MATCH (n)-[r]->() 
                RETURN count(distinct n) as nodes, count(distinct r) as relationships
            `);
            
            const stats = {
                nodes: statsResult.records[0].get('nodes').toNumber(),
                relationships: statsResult.records[0].get('relationships').toNumber()
            };
            
            // Get project nodes
            const projectResult = await session.run(`
                MATCH (p:Project) 
                RETURN p.name as name, p.path as path, p.type as type, p.status as status
            `);
            
            const projects = projectResult.records.map(record => ({
                name: record.get('name'),
                path: record.get('path'),
                type: record.get('type'),
                status: record.get('status')
            }));
            
            await session.close();
            
            return {
                statistics: stats,
                projects: projects,
                visualization: this.generateGraphVisualization(stats)
            };
        } catch (error) {
            console.warn('Neo4j query error:', error.message);
            return { error: error.message };
        }
    }

    /**
     * Generate simple graph visualization data
     */
    generateGraphVisualization(stats) {
        return {
            type: 'network',
            nodes: [
                { id: 'codemind', label: 'CodeMind', size: 10, color: '#2196F3' },
                { id: 'cli', label: 'CLI', size: 8, color: '#4CAF50' },
                { id: 'dashboard', label: 'Dashboard', size: 8, color: '#FF9800' },
                { id: 'database', label: 'Databases', size: 6, color: '#9C27B0' }
            ],
            edges: [
                { from: 'codemind', to: 'cli' },
                { from: 'codemind', to: 'dashboard' },
                { from: 'codemind', to: 'database' },
                { from: 'cli', to: 'database' },
                { from: 'dashboard', to: 'database' }
            ],
            totalNodes: stats.nodes,
            totalRelationships: stats.relationships
        };
    }

    /**
     * Get project file structure overview
     */
    async getProjectFileStructure(projectPath) {
        try {
            const structure = {
                src: await this.countFilesInDir(path.join(projectPath, 'src')),
                docs: await this.countFilesInDir(path.join(projectPath, 'docs')),
                scripts: await this.countFilesInDir(path.join(projectPath, 'scripts')),
                tests: await this.countFilesInDir(path.join(projectPath, 'tests')),
                config: await this.countConfigFiles(projectPath)
            };
            
            const totalFiles = Object.values(structure).reduce((sum, count) => sum + count, 0);
            
            return {
                structure,
                totalFiles,
                directories: Object.keys(structure).length
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Extract use cases from project documentation
     */
    async extractUseCasesFromDocs(projectPath) {
        try {
            const useCases = [];
            const docsPath = path.join(projectPath, 'docs');
            
            // Check for README
            try {
                const readmePath = path.join(projectPath, 'README.md');
                const readmeContent = await fs.readFile(readmePath, 'utf-8');
                if (readmeContent.includes('## Use Cases') || readmeContent.includes('## Usage')) {
                    useCases.push({
                        title: 'Primary Use Cases',
                        source: 'README.md',
                        type: 'overview'
                    });
                }
            } catch (error) {
                // README not found or not readable
            }
            
            // Check CLAUDE.md for project context
            try {
                const claudePath = path.join(projectPath, 'CLAUDE.md');
                const claudeContent = await fs.readFile(claudePath, 'utf-8');
                if (claudeContent.includes('CodeMind')) {
                    useCases.push({
                        title: 'Intelligent Code Analysis',
                        source: 'CLAUDE.md',
                        type: 'ai_integration',
                        description: 'Smart Claude Code CLI with intelligent tool selection, token optimization, and real-time quality monitoring'
                    });
                }
            } catch (error) {
                // CLAUDE.md not found
            }
            
            // Extract from package.json
            try {
                const packagePath = path.join(projectPath, 'package.json');
                const packageContent = await fs.readFile(packagePath, 'utf-8');
                const packageData = JSON.parse(packageContent);
                
                useCases.push({
                    title: 'CLI Tool',
                    source: 'package.json',
                    type: 'application',
                    description: packageData.description || 'Enhanced CLI tool for intelligent code analysis'
                });
            } catch (error) {
                // package.json not found
            }
            
            return {
                useCases,
                recommendations: [
                    'Use CodeMind CLI for intelligent tool selection',
                    'Leverage semantic graph for code relationships',
                    'Monitor token usage for cost optimization',
                    'Use dashboard for project insights'
                ]
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Get database connection status
     */
    async getDatabaseStatus() {
        const status = {
            postgresql: false,
            neo4j: false,
            redis: false,
            mongodb: false
        };
        
        // Test PostgreSQL
        try {
            await this.pg.query('SELECT 1');
            status.postgresql = true;
        } catch (error) {
            console.warn('PostgreSQL status check failed:', error.message);
        }
        
        // Test Neo4j
        if (this.neo4j) {
            try {
                const session = this.neo4j.session();
                await session.run('RETURN 1');
                await session.close();
                status.neo4j = true;
            } catch (error) {
                console.warn('Neo4j status check failed:', error.message);
            }
        }
        
        return status;
    }

    /**
     * Helper methods
     */
    extractValue(result) {
        return result.status === 'fulfilled' ? result.value : null;
    }

    async countFilesInDir(dirPath) {
        try {
            const files = await fs.readdir(dirPath);
            return files.length;
        } catch (error) {
            return 0;
        }
    }

    async countConfigFiles(projectPath) {
        const configFiles = [
            'package.json', 'tsconfig.json', 'docker-compose.yml', 
            '.env', 'CLAUDE.md', 'README.md'
        ];
        
        let count = 0;
        for (const file of configFiles) {
            try {
                await fs.access(path.join(projectPath, file));
                count++;
            } catch (error) {
                // File doesn't exist
            }
        }
        return count;
    }

    async close() {
        if (this.pg) await this.pg.end();
        if (this.neo4j) await this.neo4j.close();
    }
}

module.exports = { CodeMindProjectAPI };