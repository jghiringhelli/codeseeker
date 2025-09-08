// Neo4j Initialization Script for CodeMind Semantic Graph
// Creates the base schema and constraints for semantic analysis

// ============================================
// CONSTRAINTS AND INDEXES
// ============================================

// Unique constraints
CREATE CONSTRAINT code_path_unique IF NOT EXISTS FOR (c:Code) REQUIRE c.path IS UNIQUE;
CREATE CONSTRAINT doc_path_unique IF NOT EXISTS FOR (d:Documentation) REQUIRE d.path IS UNIQUE;
CREATE CONSTRAINT concept_name_unique IF NOT EXISTS FOR (bc:BusinessConcept) REQUIRE (bc.name, bc.domain) IS UNIQUE;
CREATE CONSTRAINT ui_name_unique IF NOT EXISTS FOR (ui:UIComponent) REQUIRE (ui.name, ui.path) IS UNIQUE;
CREATE CONSTRAINT test_name_unique IF NOT EXISTS FOR (t:TestCase) REQUIRE (t.name, t.path) IS UNIQUE;

// Performance indexes
CREATE INDEX code_type_index IF NOT EXISTS FOR (c:Code) ON (c.type);
CREATE INDEX code_language_index IF NOT EXISTS FOR (c:Code) ON (c.language);
CREATE INDEX doc_type_index IF NOT EXISTS FOR (d:Documentation) ON (d.type);
CREATE INDEX concept_domain_index IF NOT EXISTS FOR (bc:BusinessConcept) ON (bc.domain);
CREATE INDEX ui_type_index IF NOT EXISTS FOR (ui:UIComponent) ON (ui.type);

// Full-text search indexes for semantic search
CALL db.index.fulltext.createNodeIndex('codeSearch', ['Code'], ['name', 'description', 'content']);
CALL db.index.fulltext.createNodeIndex('docSearch', ['Documentation'], ['title', 'summary', 'content']);
CALL db.index.fulltext.createNodeIndex('conceptSearch', ['BusinessConcept'], ['name', 'description', 'keywords']);

// ============================================
// SAMPLE DATA STRUCTURE
// ============================================

// Create sample business concepts
CREATE (:BusinessConcept {
  name: "user-authentication", 
  domain: "security",
  description: "User login, logout, and session management",
  keywords: ["auth", "login", "session", "security", "jwt"],
  importance: "high",
  created_at: datetime()
});

CREATE (:BusinessConcept {
  name: "data-processing", 
  domain: "core",
  description: "Data transformation, validation, and storage",
  keywords: ["data", "validation", "transformation", "storage"],
  importance: "high", 
  created_at: datetime()
});

CREATE (:BusinessConcept {
  name: "user-interface", 
  domain: "frontend",
  description: "User experience, navigation, and interaction",
  keywords: ["ui", "ux", "navigation", "interaction", "components"],
  importance: "medium",
  created_at: datetime()
});

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