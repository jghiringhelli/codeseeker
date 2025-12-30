# Explore Code Relationships

Explore dependencies and relationships for a file or code pattern.

## Arguments:
- `$ARGUMENTS` - File path or search query to explore relationships for

## What this does:
1. Shows import/export chains
2. Displays class hierarchies and inheritance
3. Maps function call relationships
4. Identifies component dependencies

## Instructions for Claude:

Use the CodeMind MCP tool to explore relationships:

1. Call `get_code_relationships` MCP tool with:
   - filepath: "$ARGUMENTS" (if it's a file path)
   - OR query: "$ARGUMENTS" (if it's a search term)
   - depth: 2 (default, can be 1-3)
   - direction: "both" (shows incoming and outgoing relationships)

2. Present the relationships as:
   - A visual dependency tree if possible
   - List of files that import this code
   - List of files this code imports
   - Related classes/functions

This helps understand how code is connected throughout the project.