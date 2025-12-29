# CodeMind

> Give Claude Code superpowers: semantic search, code understanding, and auto-detected coding standards.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](https://www.typescriptlang.org/)

## What You Get

- **Semantic Search** - Find code by meaning, not just keywords. Ask "where is authentication handled?" and get relevant results.
- **Code Relationships** - See how files connect: imports, exports, class hierarchies, function calls.
- **Auto-Detected Standards** - CodeMind learns your project's patterns (validation, error handling, logging) and helps Claude write consistent code.
- **Auto-Sync** - When Claude edits files or runs git commands, the index updates automatically. No manual reindexing.

## Quick Start (2 minutes)

### Step 1: Install CLI
```bash
npm install -g codemind-enhanced-cli
```

### Step 2: Install Plugin

**Option A - From GitHub (recommended):**
```
/plugin install codemind@github:jghiringhelli/codemind#plugin
```

**Option B - Manual copy:**
```bash
git clone https://github.com/jghiringhelli/codemind.git
cp -r codemind/plugins/codemind ~/.claude/plugins/    # Linux/macOS
xcopy /E /I codemind\plugins\codemind %USERPROFILE%\.claude\plugins\codemind  # Windows
```

### Step 3: Initialize your project
Restart Claude Code, then:
```
/codemind:init
```

**That's it.** CodeMind now enhances Claude with semantic search, coding standards, and auto-sync.

## What Can You Do?

### Search Your Code
```
/codemind:search authentication middleware
/codemind:search error handling patterns
/codemind:search database connection
```

### Get Coding Standards
```
/codemind:standards validation
/codemind:standards error-handling
```
Claude will now use your project's actual patterns when writing new code.

### Explore Relationships
```
/codemind:relationships src/services/auth.ts
/codemind:context src/api/routes.ts
```

### Keep Index Updated
The plugin auto-syncs after Claude's edits. For manual changes:
```
/codemind:reindex
```

---

## Alternative Ways to Use CodeMind

### CLI Mode (Without Claude Code)

Use CodeMind directly from terminal:

```bash
# Natural language queries
codemind -c "what does this project do?"
codemind -c "find all API endpoints"
codemind -c "show me SOLID violations"

# Interactive mode
codemind
```

### MCP Server (For Claude Desktop)

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "codemind": {
      "command": "codemind",
      "args": ["serve", "--mcp"]
    }
  }
}
```

### VSCode Extension (For Manual Edit Sync)

If you frequently edit files manually (not through Claude), the extension watches for changes:

```bash
cd extensions/vscode-codemind
npm install && npm run compile && npm run package
code --install-extension vscode-codemind-0.1.0.vsix
```

---

## How Sync Works

| Scenario | Sync Method | Automatic? |
|----------|-------------|------------|
| Claude edits files | Plugin hook | Yes |
| Claude runs git pull/checkout | Plugin hook | Yes |
| Manual edits in VSCode | Extension | Yes (if installed) |
| Manual edits elsewhere | `/codemind:reindex` | Manual |

---

## Documentation

| Document | Description |
|----------|-------------|
| [Integration Guide](docs/INTEGRATION.md) | All components explained |
| [Plugin README](plugins/codemind/README.md) | Slash commands and hooks |
| [MCP Server](docs/technical/mcp-server.md) | MCP tools reference |
| [CLI Commands](docs/install/cli_commands_manual.md) | Full CLI reference |

---

## Enterprise: Server Mode

For large codebases (100K+ files) or teams, CodeMind supports PostgreSQL + Neo4j + Redis instead of embedded storage.

**Most users don't need this.** Embedded mode handles projects up to 50K files with sub-second search.

| When to Consider Server Mode |
|------------------------------|
| 100K+ files in a single project |
| Multiple developers need shared index |
| Cross-project analysis requirements |
| CI/CD integration with persistent storage |

See [Storage Documentation](docs/technical/storage.md) for setup.

---

## License

MIT License - see [LICENSE](LICENSE) file.

**Open source.** Enterprise features (server mode, cross-project analysis) may be offered commercially in the future.

---

*Built for developers who want Claude to truly understand their codebase.*
