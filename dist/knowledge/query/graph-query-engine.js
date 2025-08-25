"use strict";
/**
 * Graph Query Engine for Semantic Knowledge Graph
 *
 * Provides powerful querying and traversal capabilities for the knowledge graph
 * with support for complex queries, graph algorithms, and semantic search.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphQueryEngine = void 0;
const logger_1 = require("../../utils/logger");
class GraphQueryEngine {
    knowledgeGraph;
    logger;
    cache = new Map();
    cacheTimeout = 5 * 60 * 1000; // 5 minutes
    constructor(knowledgeGraph) {
        this.knowledgeGraph = knowledgeGraph;
        this.logger = logger_1.Logger?.getInstance().child('GraphQueryEngine');
    }
    // Basic Queries
    async findNode(nodeId) {
        const startTime = Date?.now();
        const nodes = await this.knowledgeGraph?.queryNodes({});
        const node = nodes?.find(n => n?.id === nodeId) || null;
        return {
            data: node,
            metadata: {
                executionTime: Date?.now() - startTime,
                nodesTraversed: node ? 1 : 0,
                triadsExamined: 0,
                queryComplexity: 1
            }
        };
    }
    async findNodesByType(type, limit) {
        const startTime = Date?.now();
        const nodes = await this.knowledgeGraph?.queryNodes({
            nodes: { types: [type] },
            limit
        });
        return {
            data: nodes,
            metadata: {
                executionTime: Date?.now() - startTime,
                nodesTraversed: nodes?.length,
                triadsExamined: 0,
                queryComplexity: 1
            }
        };
    }
    async findRelatedNodes(nodeId, relationTypes, direction = 'both', depth = 1) {
        const startTime = Date?.now();
        let nodesTraversed = 0;
        let triadsExamined = 0;
        const result = await this.knowledgeGraph?.traverse({
            startNodes: [nodeId],
            relations: relationTypes,
            direction,
            maxDepth: depth
        });
        nodesTraversed = result.nodes?.length;
        triadsExamined = result.paths?.reduce((sum, path) => sum + path.path?.length, 0);
        return {
            data: result.nodes,
            metadata: {
                executionTime: Date?.now() - startTime,
                nodesTraversed,
                triadsExamined,
                queryComplexity: depth * relationTypes?.length
            }
        };
    }
    // Advanced Path Finding
    async findShortestPath(fromNodeId, toNodeId, relationTypes, maxDepth = 10) {
        const startTime = Date?.now();
        const cacheKey = `shortest_path:${fromNodeId}:${toNodeId}:${relationTypes?.join(',')}`;
        if (this?.isCacheValid(cacheKey)) {
            return this?.getCachedResult(cacheKey);
        }
        const result = await this?.dijkstraShortestPath(fromNodeId, toNodeId, relationTypes, maxDepth);
        const queryResult = {
            data: result.path,
            metadata: {
                executionTime: Date?.now() - startTime,
                nodesTraversed: result.nodesTraversed,
                triadsExamined: result.triadsExamined,
                queryComplexity: result.complexity
            }
        };
        this?.cacheResult(cacheKey, queryResult);
        return queryResult;
    }
    async findAllPaths(fromNodeId, toNodeId, relationTypes, maxDepth = 5, maxPaths = 100) {
        const startTime = Date?.now();
        let nodesTraversed = 0;
        let triadsExamined = 0;
        const paths = await this?.depthFirstSearchAllPaths(fromNodeId, toNodeId, relationTypes, maxDepth, maxPaths);
        // Calculate metadata from path finding
        paths?.forEach(path => {
            nodesTraversed += path.path?.length;
            triadsExamined += path.relationships?.length;
        });
        return {
            data: paths,
            metadata: {
                executionTime: Date?.now() - startTime,
                nodesTraversed,
                triadsExamined,
                queryComplexity: maxDepth * (relationTypes?.length || 10)
            }
        };
    }
    // Pattern Matching
    async findPattern(pattern) {
        const startTime = Date?.now();
        const matches = [];
        // Get all nodes that could match the pattern
        const candidateNodes = await this.knowledgeGraph?.queryNodes({});
        const allTriads = await this.knowledgeGraph?.queryTriads({});
        // Try to match the pattern starting from each candidate node
        for (const startNode of candidateNodes) {
            const match = await this?.matchPatternFromNode(startNode, pattern, candidateNodes, allTriads);
            if (match) {
                matches?.push(match);
            }
        }
        return {
            data: matches,
            metadata: {
                executionTime: Date?.now() - startTime,
                nodesTraversed: candidateNodes?.length,
                triadsExamined: allTriads?.length,
                queryComplexity: pattern.nodes?.length * pattern.relationships?.length
            }
        };
    }
    // Cypher-like Query Interface
    async executeCypher(cypherQuery) {
        // Simplified Cypher-like query parser and executor
        const startTime = Date?.now();
        try {
            const result = await this?.parseCypherQuery(cypherQuery.query, cypherQuery.parameters);
            return {
                data: result.data,
                metadata: {
                    executionTime: Date?.now() - startTime,
                    nodesTraversed: result.nodesTraversed,
                    triadsExamined: result.triadsExamined,
                    queryComplexity: result.complexity
                }
            };
        }
        catch (error) {
            this.logger.error('Cypher query execution failed', error);
            throw error;
        }
    }
    // Graph Analytics
    async analyzeNodeCentrality(nodeId) {
        const startTime = Date?.now();
        const betweenness = await this?.calculateBetweennessCentrality(nodeId);
        const closeness = await this?.calculateClosenessCentrality(nodeId);
        const degree = await this?.calculateDegreeCentrality(nodeId);
        const eigenvector = await this?.calculateEigenvectorCentrality(nodeId);
        return {
            data: {
                betweennessCentrality: betweenness,
                closenessCentrality: closeness,
                degreeCentrality: degree,
                eigenvectorCentrality: eigenvector
            },
            metadata: {
                executionTime: Date?.now() - startTime,
                nodesTraversed: await this.knowledgeGraph?.getNodeCount(),
                triadsExamined: await this.knowledgeGraph?.getTriadCount(),
                queryComplexity: 4 // Four centrality measures
            }
        };
    }
    async findCommunities(algorithm = 'louvain') {
        const startTime = Date?.now();
        const communities = algorithm === 'louvain'
            ? await this?.louvainCommunityDetection()
            : await this?.modularityCommunityDetection();
        return {
            data: communities,
            metadata: {
                executionTime: Date?.now() - startTime,
                nodesTraversed: await this.knowledgeGraph?.getNodeCount(),
                triadsExamined: await this.knowledgeGraph?.getTriadCount(),
                queryComplexity: communities?.length
            }
        };
    }
    // Semantic Search
    async semanticSearch(query, searchType = 'both', limit = 10) {
        const startTime = Date?.now();
        const results = [];
        if (searchType === 'nodes' || searchType === 'both') {
            const nodes = await this.knowledgeGraph?.queryNodes({});
            for (const node of nodes) {
                const similarity = this?.calculateSemanticSimilarity(query, node.name, node.metadata);
                if (similarity > 0.3) {
                    results?.push({ item: node, similarity });
                }
            }
        }
        if (searchType === 'relationships' || searchType === 'both') {
            const triads = await this.knowledgeGraph?.queryTriads({});
            for (const triad of triads) {
                const similarity = this?.calculateSemanticSimilarity(query, `${triad.subject} ${triad.predicate} ${triad.object}`, triad.metadata);
                if (similarity > 0.3) {
                    results?.push({ item: triad, similarity });
                }
            }
        }
        // Sort by similarity and limit results
        results?.sort((a, b) => b?.similarity - a.similarity);
        const limitedResults = results?.slice(0, limit);
        return {
            data: limitedResults,
            metadata: {
                executionTime: Date?.now() - startTime,
                nodesTraversed: searchType === 'relationships' ? 0 : (await this.knowledgeGraph?.getNodeCount()),
                triadsExamined: searchType === 'nodes' ? 0 : (await this.knowledgeGraph?.getTriadCount()),
                queryComplexity: Math.log(results?.length)
            }
        };
    }
    // Graph Filtering and Views
    async createSubgraph(nodeFilter, triadFilter) {
        const startTime = Date?.now();
        const allNodes = await this.knowledgeGraph?.queryNodes({});
        const allTriads = await this.knowledgeGraph?.queryTriads({});
        const filteredNodes = allNodes?.filter(nodeFilter);
        const filteredNodeIds = new Set(filteredNodes?.map(n => n.id));
        // Only include triads where both subject and object are in filtered nodes
        const filteredTriads = allTriads?.filter(triad => triadFilter(triad) &&
            filteredNodeIds?.has(triad.subject) &&
            filteredNodeIds?.has(triad.object));
        return {
            data: {
                nodes: filteredNodes,
                triads: filteredTriads
            },
            metadata: {
                executionTime: Date?.now() - startTime,
                nodesTraversed: allNodes?.length,
                triadsExamined: allTriads?.length,
                queryComplexity: 2 // Two filter operations
            }
        };
    }
    // Private Implementation Methods
    async dijkstraShortestPath(fromNodeId, toNodeId, relationTypes, maxDepth = 10) {
        const distances = new Map();
        const previous = new Map();
        const unvisited = new Set();
        const allNodes = await this.knowledgeGraph?.queryNodes({});
        const allTriads = await this.knowledgeGraph?.queryTriads({});
        // Initialize distances
        for (const node of allNodes) {
            distances?.set(node.id, node?.id === fromNodeId ? 0 : Infinity);
            unvisited?.add(node.id);
        }
        let nodesTraversed = 0;
        let triadsExamined = 0;
        while (unvisited.size > 0) {
            // Find node with minimum distance
            let currentNode;
            let minDistance = Infinity;
            for (const nodeId of unvisited) {
                const distance = distances?.get(nodeId) || Infinity;
                if (distance < minDistance) {
                    minDistance = distance;
                    currentNode = nodeId;
                }
            }
            if (!currentNode || minDistance === Infinity)
                break;
            unvisited?.delete(currentNode);
            nodesTraversed++;
            if (currentNode === toNodeId) {
                // Reconstruct path
                const path = await this?.reconstructPath(previous, fromNodeId, toNodeId, allNodes);
                return {
                    path,
                    nodesTraversed,
                    triadsExamined,
                    complexity: maxDepth
                };
            }
            // Find neighbors
            const relevantTriads = allTriads?.filter(triad => (triad?.subject === currentNode || triad?.object === currentNode) &&
                (!relationTypes || relationTypes?.includes(triad.predicate)));
            for (const triad of relevantTriads) {
                triadsExamined++;
                const neighbor = triad?.subject === currentNode ? triad.object : triad.subject;
                if (!unvisited?.has(neighbor))
                    continue;
                const tentativeDistance = (distances?.get(currentNode) || 0) + (1 - triad.confidence);
                if (tentativeDistance < (distances?.get(neighbor) || Infinity)) {
                    distances?.set(neighbor, tentativeDistance);
                    previous?.set(neighbor, { nodeId: currentNode, triad });
                }
            }
        }
        return {
            path: null,
            nodesTraversed,
            triadsExamined,
            complexity: maxDepth
        };
    }
    async reconstructPath(previous, fromNodeId, toNodeId, allNodes) {
        const path = [];
        const relationships = [];
        let totalWeight = 0;
        let confidence = 1;
        let currentNodeId = toNodeId;
        const nodeMap = new Map(allNodes?.map(n => [n.id, n]));
        while (currentNodeId !== fromNodeId) {
            const node = nodeMap?.get(currentNodeId);
            if (!node)
                return null;
            path?.unshift(node);
            const prev = previous?.get(currentNodeId);
            if (!prev)
                return null;
            relationships?.unshift(prev.triad);
            totalWeight += (1 - prev.triad.confidence);
            confidence = Math.min(confidence, prev.triad.confidence);
            currentNodeId = prev.nodeId;
        }
        // Add the starting node
        const startNode = nodeMap?.get(fromNodeId);
        if (startNode) {
            path?.unshift(startNode);
        }
        return {
            path,
            relationships,
            totalWeight,
            confidence
        };
    }
    async depthFirstSearchAllPaths(fromNodeId, toNodeId, relationTypes, maxDepth = 5, maxPaths = 100) {
        const allTriads = await this.knowledgeGraph?.queryTriads({});
        const allNodes = await this.knowledgeGraph?.queryNodes({});
        const nodeMap = new Map(allNodes?.map(n => [n.id, n]));
        const paths = [];
        const visited = new Set();
        const dfs = (currentNodeId, currentPath, currentRelationships, depth) => {
            if (paths?.length >= maxPaths || depth > maxDepth)
                return;
            if (currentNodeId === toNodeId && depth > 0) {
                const totalWeight = currentRelationships?.reduce((sum, rel) => sum + (1 - rel.confidence), 0);
                const confidence = currentRelationships?.reduce((min, rel) => Math.min(min, rel.confidence), 1);
                paths?.push({
                    path: [...currentPath],
                    relationships: [...currentRelationships],
                    totalWeight,
                    confidence
                });
                return;
            }
            visited?.add(currentNodeId);
            const relevantTriads = allTriads?.filter(triad => (triad?.subject === currentNodeId || triad?.object === currentNodeId) &&
                (!relationTypes || relationTypes?.includes(triad.predicate)));
            for (const triad of relevantTriads) {
                const nextNodeId = triad?.subject === currentNodeId ? triad.object : triad.subject;
                if (visited?.has(nextNodeId))
                    continue;
                const nextNode = nodeMap?.get(nextNodeId);
                if (!nextNode)
                    continue;
                currentPath?.push(nextNode);
                currentRelationships?.push(triad);
                dfs(nextNodeId, currentPath, currentRelationships, depth + 1);
                currentPath?.pop();
                currentRelationships?.pop();
            }
            visited?.delete(currentNodeId);
        };
        const startNode = nodeMap?.get(fromNodeId);
        if (startNode) {
            dfs(fromNodeId, [startNode], [], 0);
        }
        return paths;
    }
    async matchPatternFromNode(startNode, pattern, candidateNodes, allTriads) {
        // Simplified pattern matching - would be more sophisticated in practice
        const match = {};
        const usedNodes = new Set();
        // Try to match each node in the pattern
        for (let i = 0; i < pattern.nodes?.length; i++) {
            const patternNode = pattern.nodes[i];
            let candidateNode = null;
            if (i === 0) {
                candidateNode = startNode;
            }
            else {
                // Find a candidate that matches the pattern and isn't already used
                candidateNode = candidateNodes?.find(node => !usedNodes?.has(node.id) &&
                    this?.nodeMatchesPattern(node, patternNode)) || null;
            }
            if (!candidateNode)
                return null;
            match[`node_${i}`] = candidateNode;
            usedNodes?.add(candidateNode.id);
        }
        // Verify relationships match the pattern
        for (const patternRel of pattern.relationships) {
            const fromNode = match[`node_${patternRel.from}`];
            const toNode = match[`node_${patternRel.to}`];
            const hasRelationship = allTriads?.some(triad => triad?.subject === fromNode.id &&
                triad?.object === toNode.id &&
                triad?.predicate === patternRel.type);
            if (!hasRelationship)
                return null;
        }
        return match;
    }
    nodeMatchesPattern(node, pattern) {
        if (pattern.type && node?.type !== pattern.type)
            return false;
        if (pattern.name && !node.name?.includes(pattern.name))
            return false;
        if (pattern.constraints) {
            for (const [key, value] of Object.entries(pattern.constraints)) {
                if (node.metadata[key] !== value)
                    return false;
            }
        }
        return true;
    }
    async parseCypherQuery(query, parameters) {
        // Very simplified Cypher parser - would need full implementation
        const lowerQuery = query?.toLowerCase();
        if (lowerQuery?.includes('match') && lowerQuery?.includes('return')) {
            // Parse MATCH (n:Type) RETURN n patterns
            const typeMatch = query?.match(/\(n:(\w+)\)/);
            if (typeMatch) {
                const nodeType = typeMatch?.[1].toLowerCase();
                const nodes = await this.knowledgeGraph?.queryNodes({
                    nodes: { types: [nodeType] }
                });
                return {
                    data: nodes,
                    nodesTraversed: nodes?.length,
                    triadsExamined: 0,
                    complexity: 1
                };
            }
        }
        throw new Error('Unsupported Cypher query');
    }
    async calculateBetweennessCentrality(nodeId) {
        // Simplified betweenness centrality calculation
        const allNodes = await this.knowledgeGraph?.queryNodes({});
        const nodeIds = allNodes?.map(n => n.id);
        let betweenness = 0;
        let totalPairs = 0;
        for (let i = 0; i < nodeIds?.length; i++) {
            for (let j = i + 1; j < nodeIds?.length; j++) {
                if (nodeIds[i] === nodeId || nodeIds[j] === nodeId)
                    continue;
                const pathResult = await this?.dijkstraShortestPath(nodeIds[i], nodeIds[j]);
                if (pathResult.path) {
                    const pathNodeIds = pathResult.path.path?.map(n => n.id);
                    if (pathNodeIds?.includes(nodeId)) {
                        betweenness++;
                    }
                }
                totalPairs++;
            }
        }
        return totalPairs > 0 ? betweenness / totalPairs : 0;
    }
    async calculateClosenessCentrality(nodeId) {
        const allNodes = await this.knowledgeGraph?.queryNodes({});
        const nodeIds = allNodes?.map(n => n.id);
        let totalDistance = 0;
        let reachableNodes = 0;
        for (const otherNodeId of nodeIds) {
            if (otherNodeId === nodeId)
                continue;
            const pathResult = await this?.dijkstraShortestPath(nodeId, otherNodeId);
            if (pathResult.path) {
                totalDistance += pathResult.path.totalWeight;
                reachableNodes++;
            }
        }
        return reachableNodes > 0 ? reachableNodes / totalDistance : 0;
    }
    async calculateDegreeCentrality(nodeId) {
        const allTriads = await this.knowledgeGraph?.queryTriads({});
        const degree = allTriads?.filter(triad => triad?.subject === nodeId || triad?.object === nodeId).length;
        const totalNodes = await this.knowledgeGraph?.getNodeCount();
        return totalNodes > 1 ? degree / (totalNodes - 1) : 0;
    }
    async calculateEigenvectorCentrality(nodeId) {
        // Simplified eigenvector centrality - would need iterative calculation
        const allTriads = await this.knowledgeGraph?.queryTriads({});
        const connectedNodes = new Set();
        for (const triad of allTriads) {
            if (triad?.subject === nodeId) {
                connectedNodes?.add(triad.object);
            }
            else if (triad?.object === nodeId) {
                connectedNodes?.add(triad.subject);
            }
        }
        // Simplified: eigenvector centrality approximated by connected nodes' degrees
        let totalNeighborDegrees = 0;
        for (const neighborId of connectedNodes) {
            const neighborDegree = await this?.calculateDegreeCentrality(neighborId);
            totalNeighborDegrees += neighborDegree;
        }
        return connectedNodes.size > 0 ? totalNeighborDegrees / connectedNodes.size : 0;
    }
    async louvainCommunityDetection() {
        // Simplified community detection - would need full Louvain algorithm
        const clusters = await this.knowledgeGraph?.findSemanticClusters();
        return clusters;
    }
    async modularityCommunityDetection() {
        // Alternative community detection method
        return await this?.louvainCommunityDetection();
    }
    calculateSemanticSimilarity(query, text, metadata) {
        const queryLower = query?.toLowerCase();
        const textLower = text?.toLowerCase();
        // Simple text similarity
        if (textLower?.includes(queryLower))
            return 1.0;
        const queryWords = queryLower?.split(/\s+/);
        const textWords = textLower?.split(/\s+/);
        const matchedWords = queryWords?.filter(word => textWords?.includes(word));
        const similarity = matchedWords?.length / Math.max(queryWords?.length, textWords?.length);
        // Boost similarity if metadata tags match
        if (metadata.tags) {
            const tagMatches = queryWords?.filter(word => metadata.tags?.some((tag) => tag?.toLowerCase().includes(word)));
            return similarity + (tagMatches?.length * 0.1);
        }
        return similarity;
    }
    // Cache Management
    isCacheValid(key) {
        const cached = this.cache?.get(key);
        if (!cached)
            return false;
        return Date?.now() - cached.timestamp < this.cacheTimeout;
    }
    getCachedResult(key) {
        return this.cache?.get(key)?.result;
    }
    cacheResult(key, result) {
        this.cache?.set(key, {
            result,
            timestamp: Date?.now()
        });
    }
    clearCache() {
        this.cache?.clear();
    }
}
exports.GraphQueryEngine = GraphQueryEngine;
//# sourceMappingURL=graph-query-engine.js.map