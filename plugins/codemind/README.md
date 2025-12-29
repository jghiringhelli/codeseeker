# CodeMind Plugin for Claude Code

This plugin integrates CodeMind's intelligent code understanding capabilities into Claude Code (CLI and VSCode extension).

## Features

### Slash Commands

| Command | Description |
|---------|-------------|
| `/codemind:init` | Initialize CodeMind for the current project |
| `/codemind:search <query>` | Semantic search across the codebase |
| `/codemind:standards [category]` | Get auto-detected coding standards |
| `/codemind:relationships <file>` | Explore code dependencies |
| `/codemind:context <file>` | Get file with related context |
| `/codemind:reindex` | Trigger full project reindex |

### Agent Skills

The plugin includes skills that Claude automatically uses:

- **Code Standards Skill**: Automatically checks coding standards before writing new code
- **Semantic Context Skill**: Gets related code context when exploring files
- **Project Indexing Skill**: Ensures project is indexed for search

### MCP Tools

When configured, provides these MCP tools:

- `search_code` - Semantic code search
- `get_file_context` - File with related context
- `get_code_relationships` - Dependency exploration
- `get_coding_standards` - Auto-detected patterns
- `index_project` - Project indexing
- `notify_file_changes` - Incremental updates

## Installation

### Prerequisites

1. **Claude Code** installed (CLI or VSCode extension)
2. **Node.js 18+** installed
3. **CodeMind CLI** installed globally:
   ```bash
   npm install -g codemind-enhanced-cli
   ```

### Install Plugin

#### Option 1: Via Claude Code CLI (Recommended)

```bash
# Install from local path
claude /plugin install /path/to/CodeMind/plugins/codemind

# Or if published to registry
claude /plugin install codemind
```

#### Option 2: Manual Installation

1. Copy the plugin folder to your Claude Code plugins directory:
   ```bash
   # Linux/macOS
   cp -r plugins/codemind ~/.claude/plugins/

   # Windows
   xcopy /E /I plugins\codemind %USERPROFILE%\.claude\plugins\codemind
   ```

2. Restart Claude Code to load the plugin

### Configure MCP Server

The plugin includes an MCP server configuration. To enable it:

1. The plugin's `.mcp.json` will be loaded automatically
2. Or manually add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "codemind": {
      "command": "node",
      "args": ["/path/to/CodeMind/dist/mcp/mcp-server.js"]
    }
  }
}
```

## Usage

### Quick Start

1. Open your project in Claude Code
2. Initialize CodeMind:
   ```
   /codemind:init
   ```
3. Search your codebase:
   ```
   /codemind:search authentication middleware
   ```
4. Check coding standards:
   ```
   /codemind:standards validation
   ```

### Example Workflows

#### Understanding Code
```
/codemind:context src/services/auth.ts
/codemind:relationships src/services/auth.ts
```

#### Writing Consistent Code
```
/codemind:standards validation
# Now write code using the detected patterns
```

#### Finding Related Code
```
/codemind:search error handling patterns
```

## How It Works

1. **Indexing**: CodeMind indexes your project files into vector embeddings
2. **Semantic Search**: Queries find semantically similar code, not just keyword matches
3. **Knowledge Graph**: Tracks imports, exports, and code relationships
4. **Pattern Detection**: Automatically detects coding patterns from your codebase
5. **Context Enhancement**: Provides Claude with relevant context for better responses

## Troubleshooting

### Plugin not loading
- Verify plugin is in `~/.claude/plugins/codemind/`
- Check that `.claude-plugin/plugin.json` exists
- Restart Claude Code

### MCP tools not available
- Ensure CodeMind is installed: `codemind --version`
- Check MCP server path in `.mcp.json`
- Verify Node.js 18+ is installed

### Search returns no results
- Run `/codemind:init` to index the project
- Check if `.codemind/` directory exists
- Try `/codemind:reindex` for a full refresh

### Coding standards not detected
- Ensure project is indexed first
- Check `.codemind/coding-standards.json` exists
- Standards require 2+ uses of a pattern to be detected

## Contributing

See the main [CodeMind repository](https://github.com/anthropics/codemind) for contribution guidelines.

## License

MIT License - see LICENSE file in the main repository.