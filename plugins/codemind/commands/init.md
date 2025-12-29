# Initialize CodeMind for this project

Initialize CodeMind semantic search and knowledge graph for the current project.

## What this does:
1. Indexes all code files and creates vector embeddings
2. Builds a knowledge graph of code relationships
3. Detects and generates coding standards from existing patterns
4. Creates a `.codemind/` directory with project configuration

## Instructions for Claude:

Run the CodeMind initialization command for this project:

```bash
codemind init
```

If CodeMind is not installed globally, install it first:
```bash
npm install -g codemind-enhanced-cli
```

After initialization completes, report:
- Number of files indexed
- Whether coding standards were detected
- Any errors or warnings

The project is now ready for semantic search and enhanced context building.