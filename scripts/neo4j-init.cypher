// Neo4j Initialization Script for CodeMind Semantic Graph
// Creates the base schema and constraints for semantic analysis

// ============================================
// CONSTRAINTS AND INDEXES FOR COMPLETE CODEBASE GRAPH
// ============================================

// File-level unique constraints
CREATE CONSTRAINT file_path_unique IF NOT EXISTS FOR (f:File) REQUIRE f.path IS UNIQUE;
CREATE CONSTRAINT module_path_unique IF NOT EXISTS FOR (m:Module) REQUIRE m.path IS UNIQUE;
CREATE CONSTRAINT class_signature_unique IF NOT EXISTS FOR (c:Class) REQUIRE (c.name, c.file_path) IS UNIQUE;
CREATE CONSTRAINT function_signature_unique IF NOT EXISTS FOR (fn:Function) REQUIRE (fn.name, fn.file_path, fn.line_start) IS UNIQUE;
CREATE CONSTRAINT variable_signature_unique IF NOT EXISTS FOR (v:Variable) REQUIRE (v.name, v.file_path, v.scope) IS UNIQUE;

// Configuration and pattern constraints  
CREATE CONSTRAINT config_path_unique IF NOT EXISTS FOR (cfg:Configuration) REQUIRE cfg.path IS UNIQUE;
CREATE CONSTRAINT pattern_signature_unique IF NOT EXISTS FOR (p:Pattern) REQUIRE (p.type, p.name, p.file_path) IS UNIQUE;

// Documentation and test constraints
CREATE CONSTRAINT doc_path_unique IF NOT EXISTS FOR (d:Documentation) REQUIRE d.path IS UNIQUE;
CREATE CONSTRAINT test_signature_unique IF NOT EXISTS FOR (t:Test) REQUIRE (t.name, t.file_path) IS UNIQUE;

// Performance indexes for file analysis
CREATE INDEX file_language_index IF NOT EXISTS FOR (f:File) ON (f.language);
CREATE INDEX file_type_index IF NOT EXISTS FOR (f:File) ON (f.type);
CREATE INDEX file_size_index IF NOT EXISTS FOR (f:File) ON (f.size);
CREATE INDEX module_namespace_index IF NOT EXISTS FOR (m:Module) ON (m.namespace);
CREATE INDEX class_type_index IF NOT EXISTS FOR (c:Class) ON (c.type);
CREATE INDEX function_complexity_index IF NOT EXISTS FOR (fn:Function) ON (fn.complexity);
CREATE INDEX pattern_category_index IF NOT EXISTS FOR (p:Pattern) ON (p.category);

// Full-text search indexes for complete codebase search
CALL db.index.fulltext.createNodeIndex('fileSearch', ['File', 'Module'], ['name', 'content', 'description']);
CALL db.index.fulltext.createNodeIndex('codeSearch', ['Class', 'Function', 'Variable'], ['name', 'description', 'signature']);
CALL db.index.fulltext.createNodeIndex('patternSearch', ['Pattern', 'Configuration'], ['name', 'description', 'content']);
CALL db.index.fulltext.createNodeIndex('docSearch', ['Documentation', 'Test'], ['name', 'description', 'content']);

// ============================================
// RELATIONSHIP TYPES FOR COMPLETE GRAPH
// ============================================

// Core file relationships
// DEPENDS_ON: File A depends on File B (imports, includes, requires)
// IMPLEMENTS: File A implements interface/contract in File B  
// EXTENDS: Class A extends Class B
// USES: Function/Class A uses Function/Class B
// CALLS: Function A calls Function B
// INSTANTIATES: Code A creates instance of Class B

// Configuration relationships  
// CONFIGURES: Config file configures Module/Service
// CONFIGURED_BY: Module is configured by Config file
// OVERRIDES: Config A overrides Config B

// Pattern relationships
// FOLLOWS_PATTERN: File follows architectural/design pattern
// VIOLATES_PATTERN: File violates expected pattern
// DEFINES_PATTERN: File defines reusable pattern

// Documentation relationships
// DOCUMENTS: Documentation describes Code/Module
// DOCUMENTED_BY: Code is documented by Documentation
// TESTS: Test file tests Module/Function
// TESTED_BY: Code is tested by Test file

// Semantic relationships
// SIMILAR_TO: Files with similar functionality
// RELATED_TO: Files working toward same business goal
// SUPERSEDES: Newer file replaces older file
// REFERENCES: File references external resource

// ============================================
// UTILITY PROCEDURES FOR COMPLETE GRAPH
// ============================================

// ============================================
// STORED PROCEDURES
// ============================================

// Semantic search procedure
CALL apoc.custom.asProcedure(
  'semanticSearch',
  'MATCH (n) 
   WHERE any(keyword IN $keywords WHERE 
     n.name CONTAINS keyword OR 
     n.description CONTAINS keyword OR 
     (n.keywords IS NOT NULL AND any(k IN n.keywords WHERE k CONTAINS keyword))
   )
   OPTIONAL MATCH (n)-[r]-(related)
   RETURN n, collect(DISTINCT {node: related, relationship: type(r)}) as related_nodes
   ORDER BY 
     CASE 
       WHEN n.name CONTAINS $keywords[0] THEN 3
       WHEN n.description CONTAINS $keywords[0] THEN 2  
       ELSE 1
     END DESC
   LIMIT $limit',
  'read',
  [['keywords', 'LIST OF STRING'], ['limit', 'INTEGER', 10]],
  [['node', 'NODE'], ['related_nodes', 'LIST OF MAP']]
);

// Impact analysis procedure
CALL apoc.custom.asProcedure(
  'impactAnalysis', 
  'MATCH (start)
   WHERE id(start) = $nodeId
   CALL apoc.path.subgraphAll(start, {
     relationshipFilter: "IMPORTS>|USES>|DEPENDS_ON>|TESTS>|DESCRIBES>",
     maxLevel: $maxDepth
   })
   YIELD nodes, relationships
   RETURN nodes, relationships,
     size([n IN nodes WHERE labels(n)[0] = "Code"]) as code_files,
     size([n IN nodes WHERE labels(n)[0] = "Documentation"]) as docs,
     size([n IN nodes WHERE labels(n)[0] = "TestCase"]) as tests',
  'read',
  [['nodeId', 'INTEGER'], ['maxDepth', 'INTEGER', 3]],
  [['nodes', 'LIST OF NODE'], ['relationships', 'LIST OF RELATIONSHIP'], 
   ['code_files', 'INTEGER'], ['docs', 'INTEGER'], ['tests', 'INTEGER']]
);

// Cross-reference finder
CALL apoc.custom.asProcedure(
  'findCrossReferences',
  'MATCH (concept:BusinessConcept {name: $conceptName})
   OPTIONAL MATCH (concept)<-[:IMPLEMENTS]-(code:Code)
   OPTIONAL MATCH (concept)<-[:DEFINES]-(doc:Documentation)  
   OPTIONAL MATCH (concept)<-[:RELATES_TO]-(ui:UIComponent)
   OPTIONAL MATCH (concept)<-[:TESTS_CONCEPT]-(test:TestCase)
   RETURN concept,
     collect(DISTINCT code) as related_code,
     collect(DISTINCT doc) as related_docs,
     collect(DISTINCT ui) as related_ui,
     collect(DISTINCT test) as related_tests',
  'read', 
  [['conceptName', 'STRING']],
  [['concept', 'NODE'], ['related_code', 'LIST OF NODE'], ['related_docs', 'LIST OF NODE'],
   ['related_ui', 'LIST OF NODE'], ['related_tests', 'LIST OF NODE']]
);

// ============================================
// UTILITY PROCEDURES
// ============================================

// Batch node creation for performance
CALL apoc.custom.asProcedure(
  'batchCreateNodes',
  'UNWIND $nodes as nodeData
   CALL apoc.create.node(nodeData.labels, nodeData.properties) YIELD node
   RETURN count(node) as created_count',
  'write',
  [['nodes', 'LIST OF MAP']],
  [['created_count', 'INTEGER']]
);

// Batch relationship creation
CALL apoc.custom.asProcedure(
  'batchCreateRelationships', 
  'UNWIND $relationships as relData
   MATCH (from) WHERE id(from) = relData.from_id
   MATCH (to) WHERE id(to) = relData.to_id
   CALL apoc.create.relationship(from, relData.type, relData.properties, to) YIELD rel
   RETURN count(rel) as created_count',
  'write',
  [['relationships', 'LIST OF MAP']],
  [['created_count', 'INTEGER']]
);

// Statistics and health check
CALL apoc.custom.asProcedure(
  'graphStatistics',
  'MATCH (n) 
   WITH labels(n)[0] as label, count(n) as node_count
   COLLECT({label: label, count: node_count}) as node_stats
   MATCH ()-[r]->()
   WITH node_stats, type(r) as rel_type, count(r) as rel_count  
   COLLECT({type: rel_type, count: rel_count}) as rel_stats
   RETURN {
     total_nodes: size(node_stats),
     total_relationships: size(rel_stats), 
     node_distribution: node_stats,
     relationship_distribution: rel_stats,
     timestamp: datetime()
   } as statistics',
  'read',
  [],
  [['statistics', 'MAP']]
);

// ============================================
// COMPLETION MESSAGE
// ============================================
RETURN "CodeMind Semantic Graph initialized successfully!" as message;