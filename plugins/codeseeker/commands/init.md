# Initialize CodeSeeker for this project

Initialize CodeSeeker semantic search and knowledge graph for the current project.

## What this does:
1. Indexes all code files and creates vector embeddings
2. Builds a knowledge graph of code relationships
3. Detects and generates coding standards from existing patterns
4. Creates a `.codeseeker/` directory with project configuration

## Instructions for Claude:

Run the CodeSeeker initialization command for this project:

```bash
codeseeker init
```

If CodeSeeker is not installed globally, install it first:
```bash
npm install -g codeseeker
```

After initialization completes, report:
- Number of files indexed
- Whether coding standards were detected
- Any errors or warnings

The project is now ready for semantic search and enhanced context building.