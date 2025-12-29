// CodeMind Neo4j Setup Script
// Run this script in Neo4j Browser or via cypher-shell
//
// Usage:
//   cypher-shell -u neo4j -p password -f setup-neo4j.cypher
//
// Or paste into Neo4j Browser at http://localhost:7474

// Create indexes for fast lookups
CREATE INDEX node_id IF NOT EXISTS FOR (n:CodeNode) ON (n.id);
CREATE INDEX node_project IF NOT EXISTS FOR (n:CodeNode) ON (n.projectId);
CREATE INDEX node_type IF NOT EXISTS FOR (n:CodeNode) ON (n.type);
CREATE INDEX node_filepath IF NOT EXISTS FOR (n:CodeNode) ON (n.filePath);
CREATE INDEX node_name IF NOT EXISTS FOR (n:CodeNode) ON (n.name);

// Create constraint for unique node IDs
CREATE CONSTRAINT unique_node_id IF NOT EXISTS FOR (n:CodeNode) REQUIRE n.id IS UNIQUE;

// Example: Create a sample project node (optional, for testing)
// MERGE (p:Project {id: 'sample-project'})
// SET p.name = 'Sample Project',
//     p.path = '/path/to/project',
//     p.createdAt = datetime()
// RETURN p;

// Verify indexes created
SHOW INDEXES;

// Display schema
CALL db.schema.visualization();