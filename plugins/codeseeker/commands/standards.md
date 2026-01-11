# Get Coding Standards

Retrieve auto-detected coding standards and patterns from this project.

## Arguments:
- `$ARGUMENTS` - Optional category filter: `validation`, `error-handling`, `logging`, `testing`, or `all`

## What this does:
1. Returns coding patterns detected from the indexed codebase
2. Shows preferred patterns with usage counts and confidence levels
3. Includes import statements and code examples
4. Lists alternatives with recommendations

## Instructions for Claude:

Use the CodeSeeker MCP tool to get coding standards:

1. Call `get_coding_standards` MCP tool with:
   - project: current working directory
   - category: "$ARGUMENTS" (or "all" if not specified)

2. Present the standards showing:
   - Preferred pattern for each category
   - Usage count and confidence level
   - Example code and import statements
   - Alternative patterns if any

If MCP tools are not available, read the standards file directly:
```bash
cat .codeseeker/coding-standards.json
```

Use these standards when writing new code to maintain consistency with project conventions.