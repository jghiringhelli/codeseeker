# CodeMind Plugin for Claude Code

Give Claude Code superpowers: semantic search, code understanding, and auto-detected coding standards.

## What Happens After Installation

Once installed, **Claude automatically gets enhanced context** for your requests:

- **Semantic Search**: When you ask about code, Claude searches by meaning, not just keywords
- **Code Relationships**: Claude understands imports, exports, and dependencies
- **Coding Standards**: Claude follows your project's existing patterns (validation, error handling, logging)
- **Auto-Sync**: The index updates automatically when Claude edits files or runs git commands

**You don't need to do anything special** - just ask Claude questions and it will use CodeMind's enhanced context when helpful.

## Installation

### One-Time Setup

1. **Install the plugin** (run this in Claude Code chat, not bash):
   ```
   /plugin install codemind@github:jghiringhelli/codemind#plugin
   ```

2. **Restart Claude Code** to load the plugin

3. **Initialize your project** (run this in Claude Code chat):
   ```
   /codemind:init
   ```

That's it. The MCP server is auto-configured and will download on first use via npx.

### Per-Project Configuration (Optional)

The plugin applies globally, but you can customize per-project by adding to your project's `.claude/settings.json`:

```json
{
  "mcpServers": {
    "codemind": {
      "command": "npx",
      "args": ["-y", "codemind-enhanced-cli", "serve", "--mcp"],
      "env": {
        "CODEMIND_STORAGE_MODE": "embedded"
      }
    }
  }
}
```

Or for team projects, add `.mcp.json` at project root with the same content.

## Available Commands

These commands are run **in Claude Code chat** (not in terminal):

| Command | Description |
|---------|-------------|
| `/codemind:init` | Initialize CodeMind for the current project |
| `/codemind:search <query>` | Semantic search across the codebase |
| `/codemind:standards [category]` | View auto-detected coding standards |
| `/codemind:relationships <file>` | Explore code dependencies |
| `/codemind:context <file>` | Get file with related context |
| `/codemind:reindex` | Trigger full project reindex |

**Note**: Most users won't need these commands - Claude uses the MCP tools automatically when relevant.

## How It Works

1. **Project Indexing**: `/codemind:init` indexes your code into vector embeddings
2. **Automatic Enhancement**: Claude's MCP tools query the index when answering your questions
3. **Pattern Detection**: CodeMind detects validation, error handling, and logging patterns
4. **Auto-Sync**: Hooks trigger index updates after Claude edits files or runs git operations

### MCP Tools (Used Automatically)

The plugin provides these MCP tools that Claude uses behind the scenes:

- `search_code` - Semantic code search
- `get_file_context` - File with related context
- `get_code_relationships` - Dependency exploration
- `get_coding_standards` - Auto-detected patterns
- `index_project` - Project indexing
- `notify_file_changes` - Incremental updates
- `install_language_support` - Install Tree-sitter parsers for better code understanding

## Index Synchronization

| Scenario | Sync Method | Automatic? |
|----------|-------------|------------|
| Claude edits files | Plugin hook → MCP tool | Yes |
| Claude runs git pull/checkout | Plugin hook → full reindex | Yes |
| Manual edits in VSCode | VSCode Extension (optional) | Yes |
| Manual edits outside VSCode | `/codemind:reindex` command | Manual |

**For seamless manual edit sync**, install the [CodeMind VSCode Extension](../../extensions/vscode-codemind/).

## Troubleshooting

### Plugin not loading
- Verify plugin is in `~/.claude/plugins/codemind/`
- Check that `.claude-plugin/plugin.json` exists
- Restart Claude Code

### MCP tools not available
- First use downloads via npx - wait a moment
- Verify Node.js 18+ is installed
- Check Claude Code's MCP server logs

### Search returns no results
- Run `/codemind:init` to index the project
- Check if `.codemind/` directory exists
- Try `/codemind:reindex` for a full refresh

### Coding standards not detected
- Ensure project is indexed first
- Check `.codemind/coding-standards.json` exists
- Standards require 2+ uses of a pattern to be detected

## More Information

- [Integration Guide](../../docs/INTEGRATION.md) - All components explained
- [MCP Server Reference](../../docs/technical/mcp-server.md) - MCP tools reference
- [Main Repository](https://github.com/jghiringhelli/codemind) - Full documentation

## License

MIT License - see LICENSE file in the main repository.