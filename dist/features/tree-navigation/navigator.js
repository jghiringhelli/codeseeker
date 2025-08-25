"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TreeNavigator = exports.DependencyType = exports.NodeType = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const fast_glob_1 = require("fast-glob");
const analyzer_1 = require("../../shared/ast/analyzer");
const logger_1 = require("../../utils/logger");
const readline = __importStar(require("readline"));
var NodeType;
(function (NodeType) {
    NodeType["FILE"] = "file";
    NodeType["MODULE"] = "module";
    NodeType["PACKAGE"] = "package";
    NodeType["EXTERNAL"] = "external";
    NodeType["VIRTUAL"] = "virtual";
})(NodeType || (exports.NodeType = NodeType = {}));
var DependencyType;
(function (DependencyType) {
    DependencyType["IMPORT"] = "import";
    DependencyType["EXPORT"] = "export";
    DependencyType["DYNAMIC_IMPORT"] = "dynamic_import";
    DependencyType["TYPE_ONLY"] = "type_only";
    DependencyType["INHERITANCE"] = "inheritance";
    DependencyType["COMPOSITION"] = "composition";
})(DependencyType || (exports.DependencyType = DependencyType = {}));
class TreeNavigator {
    logger = logger_1.Logger?.getInstance();
    astAnalyzer = new analyzer_1.ASTAnalyzer();
    rl;
    async buildTree(request) {
        this.logger.info(`Building dependency tree for ${request.projectPath}`);
        const nodes = new Map();
        const edges = [];
        // Get all project files
        const files = await this?.getProjectFiles(request.projectPath, request.filePattern);
        // Create nodes for each file
        for (const file of files) {
            const filePath = path?.join(request.projectPath, file);
            const node = await this?.createFileNode(filePath, request.projectPath);
            nodes?.set(node.id, node);
        }
        // Analyze dependencies and create edges
        for (const [nodeId, node] of nodes) {
            try {
                const astResult = await this.astAnalyzer?.analyzeFile(path?.join(request.projectPath, node.path));
                for (const dep of astResult.dependencies) {
                    const edge = await this?.createDependencyEdge(dep, node, nodes, request);
                    if (edge) {
                        edges?.push(edge);
                    }
                }
                // Update node metadata
                node.metadata.imports = astResult.dependencies?.filter(d => d?.type === 'import').map(d => d.target);
                node.metadata.exports = astResult.symbols?.filter(s => s.isExported).map(s => s.name);
            }
            catch (error) {
                this.logger.warn(`Failed to analyze dependencies for ${node.path}`, error);
            }
        }
        // Build tree structure
        this?.buildTreeStructure(nodes, edges);
        // Detect circular dependencies
        const circularDependencies = this?.detectCircularDependencies(nodes, edges);
        // Create clusters
        const clusters = this?.createModuleClusters(nodes, edges);
        // Calculate statistics
        const statistics = this?.calculateTreeStatistics(nodes, edges, circularDependencies);
        // Find or create root node
        const root = this?.findRootNode(nodes) || this?.createVirtualRoot(nodes);
        const tree = {
            root,
            nodes,
            edges: request.circularOnly ?
                edges?.filter(edge => this?.isPartOfCircularDependency(edge, circularDependencies)) :
                edges,
            circularDependencies,
            clusters,
            statistics
        };
        this.logger.info(`Dependency tree built: ${statistics.totalNodes} nodes, ${statistics.totalEdges} edges, ${statistics.circularDependencyCount} circular dependencies`);
        return tree;
    }
    async getProjectFiles(projectPath, pattern) {
        const defaultPattern = '**/*.{ts,tsx,js,jsx,py,go,rs,java}';
        const excludes = [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/.git/**',
            '**/coverage/**'
        ];
        return await (0, fast_glob_1.glob)(pattern || defaultPattern, {
            cwd: projectPath,
            ignore: excludes,
            onlyFiles: true
        });
    }
    async createFileNode(filePath, projectRoot) {
        const stats = await fs?.stat(filePath);
        const relativePath = path?.relative(projectRoot, filePath);
        const name = path?.basename(filePath);
        const language = this?.detectLanguage(filePath);
        let linesOfCode = 0;
        let complexity = 1;
        try {
            const astResult = await this.astAnalyzer?.analyzeFile(filePath);
            linesOfCode = astResult.complexity.linesOfCode;
            complexity = astResult.complexity.cyclomaticComplexity;
        }
        catch (error) {
            // Use file size as fallback
            linesOfCode = Math.ceil(stats?.size / 50); // Rough estimate
        }
        const node = {
            id: this?.generateNodeId(relativePath),
            path: relativePath,
            name,
            type: NodeType.FILE,
            language,
            size: stats.size,
            complexity,
            children: [],
            parents: [],
            metadata: {
                exports: [],
                imports: [],
                lastModified: stats.mtime,
                linesOfCode,
                maintainabilityIndex: Math.max(0, 171 - 5.2 * Math.log(linesOfCode) - 0.23 * complexity),
                isEntryPoint: this?.isEntryPoint(name),
                isLeaf: false // Will be determined later
            }
        };
        return node;
    }
    detectLanguage(filePath) {
        const ext = path?.extname(filePath);
        const mapping = {
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.py': 'python',
            '.go': 'go',
            '.rs': 'rust',
            '.java': 'java'
        };
        return mapping[ext] || 'unknown';
    }
    generateNodeId(relativePath) {
        return relativePath?.replace(/[^a-zA-Z0-9]/g, '_');
    }
    isEntryPoint(fileName) {
        const entryPointNames = ['index', 'main', 'app', 'server', 'cli'];
        const baseName = path?.parse(fileName).name?.toLowerCase();
        return entryPointNames?.includes(baseName);
    }
    async createDependencyEdge(dep, sourceNode, nodes, request) {
        let targetPath;
        let isExternal = dep.isExternal || false;
        if (dep.isExternal) {
            if (!request.includeExternal)
                return null;
            // Create virtual node for external dependency
            const externalNodeId = `external_${dep.target?.replace(/[^a-zA-Z0-9]/g, '_')}`;
            if (!nodes?.has(externalNodeId)) {
                const externalNode = {
                    id: externalNodeId,
                    path: dep.target,
                    name: dep.target,
                    type: NodeType.EXTERNAL,
                    language: 'external',
                    size: 0,
                    complexity: 0,
                    children: [],
                    parents: [],
                    metadata: {
                        exports: [],
                        imports: [],
                        lastModified: new Date(),
                        linesOfCode: 0,
                        maintainabilityIndex: 100,
                        isEntryPoint: false,
                        isLeaf: true
                    }
                };
                nodes?.set(externalNodeId, externalNode);
            }
            targetPath = externalNodeId;
        }
        else {
            // Resolve relative import path
            targetPath = this?.resolveImportPath(dep.target, sourceNode.path, request.projectPath);
            if (!targetPath || !nodes?.has(this?.generateNodeId(targetPath))) {
                return null;
            }
            targetPath = this?.generateNodeId(targetPath);
        }
        return {
            from: sourceNode.id,
            to: targetPath,
            type: this?.mapDependencyType(dep.type),
            weight: this?.calculateEdgeWeight(dep, sourceNode),
            line: dep.line,
            isExternal
        };
    }
    resolveImportPath(importPath, sourceFile, projectRoot) {
        if (importPath?.startsWith('.')) {
            // Relative import
            const sourceDir = path?.dirname(sourceFile);
            const resolved = path?.resolve(sourceDir, importPath);
            const relativePath = path?.relative(projectRoot, resolved);
            // Try common extensions
            const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py'];
            for (const ext of extensions) {
                const withExt = relativePath + ext;
                try {
                    if (fs?.access(path?.join(projectRoot, withExt))) {
                        return withExt;
                    }
                }
                catch {
                    // File doesn't exist, continue
                }
            }
            // Try index files
            for (const ext of extensions) {
                const indexFile = path?.join(relativePath, `index${ext}`);
                try {
                    if (fs?.access(path?.join(projectRoot, indexFile))) {
                        return indexFile;
                    }
                }
                catch {
                    // File doesn't exist, continue
                }
            }
        }
        return null;
    }
    mapDependencyType(depType) {
        const mapping = {
            'import': DependencyType.IMPORT,
            'export': DependencyType.EXPORT,
            'call': DependencyType.COMPOSITION,
            'inheritance': DependencyType.INHERITANCE,
            'composition': DependencyType.COMPOSITION
        };
        return mapping[depType] || DependencyType.IMPORT;
    }
    calculateEdgeWeight(dep, sourceNode) {
        let weight = 1;
        // Higher weight for exports (they create stronger coupling)
        if (dep?.type === 'export')
            weight += 2;
        // Higher weight for internal dependencies
        if (!dep.isExternal)
            weight += 1;
        // Consider the source node complexity
        if (sourceNode.complexity > 10)
            weight += 1;
        return weight;
    }
    buildTreeStructure(nodes, edges) {
        // Clear existing relationships
        for (const node of nodes?.values()) {
            node.children = [];
            node.parents = [];
        }
        // Build relationships based on edges
        for (const edge of edges) {
            const fromNode = nodes?.get(edge.from);
            const toNode = nodes?.get(edge.to);
            if (fromNode && toNode) {
                fromNode.children?.push(toNode);
                toNode.parents?.push(fromNode);
            }
        }
        // Mark leaf nodes
        for (const node of nodes?.values()) {
            node.metadata.isLeaf = node.children?.length === 0;
        }
    }
    detectCircularDependencies(nodes, edges) {
        const circularDependencies = [];
        const visited = new Set();
        const recursionStack = new Set();
        const dfs = (nodeId, path) => {
            if (recursionStack?.has(nodeId)) {
                // Found a cycle
                const cycleStart = path?.indexOf(nodeId);
                const cyclePath = path?.slice(cycleStart);
                cyclePath?.push(nodeId); // Close the cycle
                const cycle = {
                    path: cyclePath,
                    severity: this?.calculateCycleSeverity(cyclePath, nodes),
                    description: this?.generateCycleDescription(cyclePath, nodes),
                    suggestions: this?.generateCycleSuggestions(cyclePath, nodes, edges)
                };
                circularDependencies?.push(cycle);
                return;
            }
            if (visited?.has(nodeId))
                return;
            visited?.add(nodeId);
            recursionStack?.add(nodeId);
            path?.push(nodeId);
            // Visit all children
            const children = edges
                .filter(edge => edge?.from === nodeId)
                .map(edge => edge.to);
            for (const childId of children) {
                dfs(childId, [...path]);
            }
            recursionStack?.delete(nodeId);
            path?.pop();
        };
        // Start DFS from each node
        for (const nodeId of nodes?.keys()) {
            if (!visited?.has(nodeId)) {
                dfs(nodeId, []);
            }
        }
        return this?.deduplicateCycles(circularDependencies);
    }
    calculateCycleSeverity(cyclePath, nodes) {
        let complexity = 0;
        let size = 0;
        for (const nodeId of cyclePath) {
            const node = nodes?.get(nodeId);
            if (node) {
                complexity += node.complexity;
                size += node.size;
            }
        }
        if (cyclePath?.length > 5 || complexity > 50 || size > 10000) {
            return 'critical';
        }
        else if (cyclePath?.length > 3 || complexity > 20 || size > 5000) {
            return 'high';
        }
        else if (cyclePath?.length > 2 || complexity > 10) {
            return 'medium';
        }
        else {
            return 'low';
        }
    }
    generateCycleDescription(cyclePath, nodes) {
        const fileNames = cyclePath?.map(nodeId => {
            const node = nodes?.get(nodeId);
            return node ? node.name : nodeId;
        });
        return `Circular dependency involving ${cyclePath?.length} files: ${fileNames?.join(' → ')}`;
    }
    generateCycleSuggestions(cyclePath, nodes, edges) {
        const suggestions = [];
        suggestions?.push('Consider extracting shared functionality into a separate module');
        suggestions?.push('Use dependency injection to break direct dependencies');
        if (cyclePath?.length === 2) {
            suggestions?.push('Merge the two files if they are tightly coupled');
        }
        suggestions?.push('Apply the Dependency Inversion Principle');
        suggestions?.push('Consider using events or observers to decouple components');
        return suggestions;
    }
    deduplicateCycles(cycles) {
        const unique = new Map();
        for (const cycle of cycles) {
            // Create a canonical representation of the cycle
            const sortedPath = [...cycle.path].sort();
            const key = sortedPath?.join('->');
            if (!unique?.has(key) || unique?.get(key).severity < cycle.severity) {
                unique?.set(key, cycle);
            }
        }
        return Array.from(unique?.values());
    }
    createModuleClusters(nodes, edges) {
        const clusters = [];
        // Simple clustering based on directory structure
        const directoryClusters = new Map();
        for (const node of nodes?.values()) {
            if (node?.type === NodeType.FILE) {
                const dir = path?.dirname(node.path);
                if (!directoryClusters?.has(dir)) {
                    directoryClusters?.set(dir, []);
                }
                directoryClusters?.get(dir).push(node.id);
            }
        }
        for (const [dirPath, nodeIds] of directoryClusters) {
            if (nodeIds?.length > 1) {
                const cohesion = this?.calculateCohesion(nodeIds, edges);
                const coupling = this?.calculateCoupling(nodeIds, edges);
                clusters?.push({
                    id: `cluster_${dirPath?.replace(/[^a-zA-Z0-9]/g, '_')}`,
                    name: dirPath || 'root',
                    nodes: nodeIds,
                    cohesion,
                    coupling,
                    description: `Module cluster for ${dirPath} directory with ${nodeIds?.length} files`
                });
            }
        }
        return clusters;
    }
    calculateCohesion(nodeIds, edges) {
        const internalEdges = edges?.filter(edge => nodeIds?.includes(edge.from) && nodeIds?.includes(edge.to));
        const maxPossibleEdges = nodeIds?.length * (nodeIds?.length - 1);
        return maxPossibleEdges > 0 ? internalEdges?.length / maxPossibleEdges : 0;
    }
    calculateCoupling(nodeIds, edges) {
        const externalEdges = edges?.filter(edge => (nodeIds?.includes(edge.from) && !nodeIds?.includes(edge.to)) ||
            (!nodeIds?.includes(edge.from) && nodeIds?.includes(edge.to)));
        return externalEdges?.length / nodeIds?.length;
    }
    calculateTreeStatistics(nodes, edges, circularDependencies) {
        const depths = Array.from(nodes?.values()).map(node => this?.calculateNodeDepth(node));
        const maxDepth = Math.max(...depths, 0);
        const externalEdges = edges?.filter(edge => edge.isExternal);
        return {
            totalNodes: nodes.size,
            totalEdges: edges?.length,
            maxDepth,
            averageDependencies: nodes.size > 0 ? edges?.length / nodes.size : 0,
            circularDependencyCount: circularDependencies?.length,
            externalDependencyCount: externalEdges?.length,
            clustersCount: 0 // Will be set after clusters are created
        };
    }
    calculateNodeDepth(node) {
        const visited = new Set();
        const dfs = (currentNode) => {
            if (visited?.has(currentNode.id))
                return 0;
            visited?.add(currentNode.id);
            if (currentNode.parents?.length === 0)
                return 0;
            const parentDepths = currentNode.parents?.map(parent => dfs(parent));
            return Math.max(...parentDepths) + 1;
        };
        return dfs(node);
    }
    findRootNode(nodes) {
        // Find node with no parents and marked as entry point
        for (const node of nodes?.values()) {
            if (node.parents?.length === 0 && node.metadata.isEntryPoint) {
                return node;
            }
        }
        // Fallback: find any node with no parents
        for (const node of nodes?.values()) {
            if (node.parents?.length === 0) {
                return node;
            }
        }
        return null;
    }
    createVirtualRoot(nodes) {
        const rootNodes = Array.from(nodes?.values()).filter(node => node.parents?.length === 0);
        const virtualRoot = {
            id: 'virtual_root',
            path: '/',
            name: 'Project Root',
            type: NodeType.VIRTUAL,
            language: 'virtual',
            size: 0,
            complexity: 0,
            children: rootNodes,
            parents: [],
            metadata: {
                exports: [],
                imports: [],
                lastModified: new Date(),
                linesOfCode: 0,
                maintainabilityIndex: 100,
                isEntryPoint: true,
                isLeaf: false
            }
        };
        // Update root nodes to have virtual root as parent
        for (const rootNode of rootNodes) {
            rootNode.parents = [virtualRoot];
        }
        return virtualRoot;
    }
    isPartOfCircularDependency(edge, cycles) {
        return cycles?.some(cycle => cycle.path?.includes(edge.from) && cycle.path?.includes(edge.to));
    }
    // Interactive navigation methods
    async startInteractiveMode(tree) {
        this.rl = readline?.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        const state = {
            currentNode: tree.root,
            history: [],
            selectedNodes: new Set(),
            filters: {
                showExternal: false,
                showTypes: [NodeType.FILE, NodeType.MODULE],
                maxDepth: 10
            }
        };
        console?.log('\n🌲 Interactive Tree Navigation Mode');
        console?.log('─'.repeat(50));
        this?.printCommands();
        await this?.navigationLoop(tree, state);
        this.rl?.close();
    }
    async navigationLoop(tree, state) {
        while (true) {
            this?.printCurrentNode(state.currentNode, state);
            const answer = await this?.prompt('> ');
            const [command, ...args] = answer?.trim().split(' ');
            try {
                const shouldContinue = await this?.executeCommand(command, args, tree, state);
                if (!shouldContinue)
                    break;
            }
            catch (error) {
                console?.log(`Error: ${error.message}`);
            }
        }
    }
    printCommands() {
        console?.log(`
Commands:
  ls                    - List children of current node
  cd <node>            - Navigate to node
  parent               - Go to parent node
  back                 - Go back in history
  info                 - Show detailed node information
  deps                 - Show dependencies
  cycles               - Show circular dependencies
  cluster              - Show cluster information
  find <name>          - Find nodes by name
  filter <type>        - Filter by node type
  select <node>        - Select/deselect node for comparison
  compare              - Compare selected nodes
  tree [depth]         - Print tree structure
  stats                - Show tree statistics
  help                 - Show this help
  exit                 - Exit interactive mode
`);
    }
    printCurrentNode(node, state) {
        console?.log(`\n📍 Current: ${node.name} (${node.type})`);
        console?.log(`   Path: ${node.path}`);
        console?.log(`   Language: ${node.language}`);
        console?.log(`   Complexity: ${node.complexity}`);
        console?.log(`   Children: ${node.children?.length}`);
        console?.log(`   Parents: ${node.parents?.length}`);
        if (state.selectedNodes.size > 0) {
            console?.log(`   Selected: ${Array.from(state.selectedNodes).join(', ')}`);
        }
    }
    async executeCommand(command, args, tree, state) {
        switch (command) {
            case 'ls':
                this?.listChildren(state.currentNode, state.filters);
                return true;
            case 'cd':
                if (args?.length === 0) {
                    console?.log('Usage: cd <node_name_or_number>');
                    return true;
                }
                this?.navigateTo(args[0], tree, state);
                return true;
            case 'parent':
                this?.navigateToParent(state);
                return true;
            case 'back':
                this?.navigateBack(state);
                return true;
            case 'info':
                this?.showDetailedInfo(state.currentNode);
                return true;
            case 'deps':
                this?.showDependencies(state.currentNode, tree);
                return true;
            case 'cycles':
                this?.showCircularDependencies(tree.circularDependencies);
                return true;
            case 'tree':
                const depth = args?.length > 0 ? parseInt(args[0]) : 3;
                this?.printTree(tree, depth);
                return true;
            case 'stats':
                this?.showStatistics(tree.statistics);
                return true;
            case 'help':
                this?.printCommands();
                return true;
            case 'exit':
                return false;
            default:
                console?.log(`Unknown command: ${command}. Type 'help' for available commands.`);
                return true;
        }
    }
    listChildren(node, filters) {
        const filteredChildren = node.children?.filter(child => filters.showTypes?.includes(child.type) &&
            (filters.showExternal || child?.type !== NodeType.EXTERNAL) &&
            (!filters.languageFilter || child?.language === filters.languageFilter));
        if (filteredChildren?.length === 0) {
            console?.log('No children found with current filters.');
            return;
        }
        console?.log('\nChildren:');
        filteredChildren?.forEach((child, index) => {
            const icon = this?.getNodeIcon(child.type);
            console?.log(`  ${index + 1}. ${icon} ${child.name} (${child.type}, ${child.language})`);
        });
    }
    getNodeIcon(type) {
        const icons = {
            [NodeType.FILE]: '📄',
            [NodeType.MODULE]: '📦',
            [NodeType.PACKAGE]: '🗂️',
            [NodeType.EXTERNAL]: '🌐',
            [NodeType.VIRTUAL]: '⭐'
        };
        return icons[type] || '📄';
    }
    navigateTo(target, tree, state) {
        let targetNode;
        // Try to parse as number (index in children list)
        const index = parseInt(target);
        if (!isNaN(index) && index > 0 && index <= state.currentNode.children?.length) {
            targetNode = state.currentNode.children[index - 1];
        }
        else {
            // Search by name
            targetNode = state.currentNode.children?.find(child => child.name?.toLowerCase().includes(target?.toLowerCase()));
            if (!targetNode) {
                // Search in all nodes
                targetNode = Array.from(tree.nodes?.values()).find(node => node.name?.toLowerCase().includes(target?.toLowerCase()));
            }
        }
        if (targetNode) {
            state.history?.push(state.currentNode);
            state.currentNode = targetNode;
            console?.log(`✅ Navigated to ${targetNode.name}`);
        }
        else {
            console?.log(`❌ Node not found: ${target}`);
        }
    }
    navigateToParent(state) {
        if (state.currentNode.parents?.length === 0) {
            console?.log('❌ Current node has no parent');
            return;
        }
        if (state.currentNode.parents?.length === 1) {
            state.history?.push(state.currentNode);
            state.currentNode = state.currentNode.parents[0];
            console?.log(`✅ Navigated to parent: ${state.currentNode.name}`);
        }
        else {
            console?.log('Multiple parents available:');
            state.currentNode.parents?.forEach((parent, index) => {
                console?.log(`  ${index + 1}. ${parent.name}`);
            });
            // In a full implementation, would prompt for selection
        }
    }
    navigateBack(state) {
        if (state.history?.length === 0) {
            console?.log('❌ No history available');
            return;
        }
        state.currentNode = state.history?.pop();
        console?.log(`✅ Went back to ${state.currentNode.name}`);
    }
    showDetailedInfo(node) {
        console?.log(`\n📊 Detailed Information for ${node.name}`);
        console?.log('─'.repeat(50));
        console?.log(`Type: ${node.type}`);
        console?.log(`Language: ${node.language}`);
        console?.log(`Path: ${node.path}`);
        console?.log(`Size: ${node.size} bytes`);
        console?.log(`Lines of Code: ${node.metadata.linesOfCode}`);
        console?.log(`Complexity: ${node.complexity}`);
        console?.log(`Maintainability Index: ${node.metadata.maintainabilityIndex?.toFixed(2)}`);
        console?.log(`Last Modified: ${node.metadata.lastModified?.toISOString()}`);
        console?.log(`Is Entry Point: ${node.metadata.isEntryPoint}`);
        console?.log(`Is Leaf: ${node.metadata.isLeaf}`);
        console?.log(`Children: ${node.children?.length}`);
        console?.log(`Parents: ${node.parents?.length}`);
        if (node.metadata.exports?.length > 0) {
            console?.log(`Exports: ${node.metadata.exports?.join(', ')}`);
        }
        if (node.metadata.imports?.length > 0) {
            console?.log(`Imports: ${node.metadata.imports?.slice(0, 5).join(', ')}${node.metadata.imports?.length > 5 ? '...' : ''}`);
        }
    }
    showDependencies(node, tree) {
        const incomingEdges = tree.edges?.filter(edge => edge?.to === node.id);
        const outgoingEdges = tree.edges?.filter(edge => edge?.from === node.id);
        console?.log(`\n🔗 Dependencies for ${node.name}`);
        console?.log('─'.repeat(50));
        console?.log(`\nIncoming (${incomingEdges?.length}):`);
        incomingEdges?.forEach(edge => {
            const fromNode = tree.nodes?.get(edge.from);
            console?.log(`  ← ${fromNode?.name || edge.from} (${edge.type})`);
        });
        console?.log(`\nOutgoing (${outgoingEdges?.length}):`);
        outgoingEdges?.forEach(edge => {
            const toNode = tree.nodes?.get(edge.to);
            console?.log(`  → ${toNode?.name || edge.to} (${edge.type})`);
        });
    }
    showCircularDependencies(cycles) {
        console?.log('\n⚠️  Circular Dependencies');
        console?.log('─'.repeat(50));
        if (cycles?.length === 0) {
            console?.log('✅ No circular dependencies found!');
            return;
        }
        cycles?.forEach((cycle, index) => {
            console?.log(`\n${index + 1}. ${cycle.severity?.toUpperCase()} - ${cycle.description}`);
            console?.log(`   Path: ${cycle.path?.join(' → ')}`);
            if (cycle.suggestions?.length > 0) {
                console?.log(`   💡 Suggestions:`);
                cycle.suggestions?.forEach(suggestion => {
                    console?.log(`     - ${suggestion}`);
                });
            }
        });
    }
    showStatistics(stats) {
        console?.log('\n📈 Tree Statistics');
        console?.log('─'.repeat(50));
        console?.log(`Total Nodes: ${stats.totalNodes}`);
        console?.log(`Total Edges: ${stats.totalEdges}`);
        console?.log(`Max Depth: ${stats.maxDepth}`);
        console?.log(`Average Dependencies per Node: ${stats.averageDependencies?.toFixed(2)}`);
        console?.log(`Circular Dependencies: ${stats.circularDependencyCount}`);
        console?.log(`External Dependencies: ${stats.externalDependencyCount}`);
        console?.log(`Module Clusters: ${stats.clustersCount}`);
    }
    // Public method for non-interactive tree printing
    printTree(tree, maxDepth = 5) {
        console?.log('\n🌲 Project Dependency Tree');
        console?.log('─'.repeat(50));
        this?.printNodeRecursive(tree.root, '', new Set(), 0, maxDepth);
    }
    printNodeRecursive(node, prefix, visited, depth, maxDepth) {
        if (depth > maxDepth || visited?.has(node.id)) {
            if (visited?.has(node.id)) {
                console?.log(`${prefix}↻ ${node.name} (circular reference)`);
            }
            return;
        }
        visited?.add(node.id);
        const icon = this?.getNodeIcon(node.type);
        console?.log(`${prefix}${icon} ${node.name} (${node.language})`);
        const childPrefix = prefix + '  ';
        node.children?.forEach(child => {
            this?.printNodeRecursive(child, childPrefix, new Set(visited), depth + 1, maxDepth);
        });
    }
    prompt(question) {
        return new Promise(resolve => {
            this.rl.question(question, resolve);
        });
    }
}
exports.TreeNavigator = TreeNavigator;
exports.default = TreeNavigator;
//# sourceMappingURL=navigator.js.map