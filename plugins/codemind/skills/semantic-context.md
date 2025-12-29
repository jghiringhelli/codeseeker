# CodeMind Semantic Context Skill

This skill helps Claude understand code by providing semantically related context.

## When to use this skill:
- When exploring unfamiliar code
- When asked to modify existing code
- When understanding how components connect
- When debugging issues across files

## How to use:

When you need to understand a file or code pattern:

1. Use the `get_file_context` MCP tool to get the file plus related code
2. Use the `get_code_relationships` MCP tool to see dependencies
3. Use the `search_code` MCP tool to find similar patterns

## Automatic Context Enhancement:

Before making changes to a file:
1. Read the file using `get_file_context` (not just `Read`)
2. This provides:
   - The file content
   - Semantically similar code from other files
   - Import/export relationships
   - Usage patterns

## Example workflow:

User asks: "Update the authentication middleware"

1. Search for auth-related code:
   ```
   search_code(query: "authentication middleware", project: ".")
   ```

2. Get context for the main auth file:
   ```
   get_file_context(filepath: "src/middleware/auth.ts")
   ```

3. Understand relationships:
   ```
   get_code_relationships(filepath: "src/middleware/auth.ts")
   ```

4. Now you have full context to make informed changes

## Benefits:
- Understand code connections before making changes
- Find related code that might need updates
- Avoid breaking dependent code