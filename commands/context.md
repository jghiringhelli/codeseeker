# Get File Context

Read a file with its semantically related code context.

## Arguments:
- `$ARGUMENTS` - File path to get context for

## What this does:
1. Reads the specified file
2. Finds semantically similar code in other files
3. Shows related dependencies and usages
4. Provides comprehensive context for understanding the file

## Instructions for Claude:

Use the CodeSeeker MCP tool to get file context:

1. Call `get_file_context` MCP tool with:
   - filepath: "$ARGUMENTS"
   - include_related: true

2. This returns:
   - The file content
   - Similar code chunks from other files
   - Import/export relationships
   - Usage examples

Use this context to better understand how a file fits into the larger codebase before making changes.