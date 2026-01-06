# CodeMind MCP Integration

CodeMind provides semantic code search and understanding via the Model Context Protocol (MCP). This allows AI assistants in various IDEs to use CodeMind's powerful code analysis capabilities.

## Supported IDEs

| IDE | Config File Location | Status |
|-----|---------------------|--------|
| VS Code + GitHub Copilot | `.vscode/mcp.json` | ✅ Supported |
| Cursor | `.cursor/mcp.json` or `~/.cursor/mcp.json` | ✅ Supported |
| Visual Studio | `.vs/mcp.json` or `%USERPROFILE%\.mcp.json` | ✅ Supported |
| Windsurf | Similar to Cursor | ✅ Supported |
| JetBrains IDEs | MCP plugin required | ⚠️ Varies |

## Prerequisites

1. **Install CodeMind globally:**
   ```bash
   npm install -g codemind-enhanced-cli
   ```

   Or install locally in `~/.codemind`:
   ```bash
   mkdir -p ~/.codemind
   cd ~/.codemind
   npm init -y
   npm install codemind-enhanced-cli
   ```

2. **Index your project:**
   ```bash
   codemind serve --mcp
   # Then use index_project tool to index your codebase
   ```

---

## VS Code + GitHub Copilot

### Option 1: Workspace Configuration (Recommended)

Create `.vscode/mcp.json` in your project root:

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

### Option 2: User Configuration

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type `MCP: Open User Configuration`
3. Add the codemind server configuration

### Option 3: If installed locally in ~/.codemind

```json
{
  "mcpServers": {
    "codemind": {
      "command": "node",
      "args": ["${userHome}/.codemind/node_modules/codemind-enhanced-cli/dist/cli/cli.js", "serve", "--mcp"]
    }
  }
}
```

### Verify Installation

1. Open VS Code
2. Open Copilot Chat
3. Type: "Use search_code to find authentication logic"
4. Copilot should use CodeMind's semantic search

---

## Cursor

### Option 1: Project Configuration

Create `.cursor/mcp.json` in your project root:

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

### Option 2: Global Configuration

Create `~/.cursor/mcp.json`:

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

### Verify Installation

1. Open Cursor
2. Open the AI chat
3. Ask: "Use search_code to find validation logic"

---

## Visual Studio (Windows)

### Option 1: Solution Configuration

Create `.vs/mcp.json` in your solution directory:

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

### Option 2: User Configuration

Create `%USERPROFILE%\.mcp.json`:

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

---

## Windsurf

Same configuration as Cursor. Create `.windsurf/mcp.json` or use the global config.

---

## Available Tools

Once configured, these tools become available to your AI assistant:

| Tool | Description |
|------|-------------|
| `search_code` | Semantic code search - finds code by meaning |
| `find_and_read` | Search + read file in one step |
| `get_file_context` | Read file with related code context |
| `get_code_relationships` | Explore imports, calls, dependencies |
| `list_projects` | Show indexed projects |
| `index_project` | Index a new project |

## First-Time Setup

1. Install CodeMind
2. Add MCP configuration to your IDE
3. Restart your IDE
4. In AI chat, run: `index_project({path: "/path/to/your/project"})`
5. Start using semantic search!

## Troubleshooting

### "No indexed projects found"
Run `index_project` to index your codebase first.

### MCP server not starting
- Check that `codemind` is in your PATH: `which codemind` or `where codemind`
- Try using the full path to the codemind executable

### Timeout errors
- Large codebases may take time to index initially
- CodeMind uses lazy loading - first search may be slower

## Support

- GitHub: https://github.com/jghiringhelli/codemind
- Issues: https://github.com/jghiringhelli/codemind/issues
