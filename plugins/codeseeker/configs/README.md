# CodeSeeker MCP Integration

CodeSeeker provides semantic code search and understanding via the Model Context Protocol (MCP). This allows AI assistants in various IDEs to use CodeSeeker's powerful code analysis capabilities.

## Who Needs This?

**Already using Claude Code?** You don't need these configs! Claude Code (CLI or VS Code extension) has built-in MCP support. Install CodeSeeker as a plugin with `/plugin install codeseeker@github:jghiringhelli/codeseeker#plugin` and you're done.

**Using other AI assistants?** These configs let you add CodeSeeker to GitHub Copilot, Cursor, and other MCP-compatible tools.

## Supported IDEs and AI Assistants

| IDE | AI Assistant | Config Location | Notes |
|-----|--------------|-----------------|-------|
| VS Code | Claude Code Extension | Built-in | Use `/plugin install` - no config needed |
| VS Code | GitHub Copilot | `.vscode/mcp.json` | Requires MCP config below |
| Cursor | Cursor AI | `.cursor/mcp.json` | Requires MCP config below |
| Visual Studio | GitHub Copilot | `.vs/mcp.json` | Full IDE (not VS Code) |
| Windsurf | Windsurf AI | `.windsurf/mcp.json` | Similar to Cursor |
| JetBrains | Various | Plugin required | ⚠️ Varies by IDE |

**VS Code vs Visual Studio:** These are different products!
- **VS Code** = Lightweight cross-platform editor (Windows/Mac/Linux)
- **Visual Studio** = Full Windows IDE for .NET/C++/C# development

## Prerequisites

1. **Install CodeSeeker globally:**
   ```bash
   npm install -g codeseeker
   ```

   Or install locally in `~/.codeseeker`:
   ```bash
   mkdir -p ~/.codeseeker
   cd ~/.codeseeker
   npm init -y
   npm install codeseeker
   ```

2. **Index your project:**
   ```bash
   codeseeker serve --mcp
   # Then use index_project tool to index your codebase
   ```

---

## VS Code + GitHub Copilot

### Option 1: Workspace Configuration (Recommended)

Create `.vscode/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "codeseeker": {
      "command": "codeseeker",
      "args": ["serve", "--mcp"]
    }
  }
}
```

### Option 2: User Configuration

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type `MCP: Open User Configuration`
3. Add the codeseeker server configuration

### Option 3: If installed locally in ~/.codeseeker

```json
{
  "mcpServers": {
    "codeseeker": {
      "command": "node",
      "args": ["${userHome}/.codeseeker/node_modules/codeseeker/dist/cli/cli.js", "serve", "--mcp"]
    }
  }
}
```

### Verify Installation

1. Open VS Code
2. Open Copilot Chat
3. Type: "Use search_code to find authentication logic"
4. Copilot should use CodeSeeker's semantic search

---

## Cursor

### Option 1: Project Configuration

Create `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "codeseeker": {
      "command": "codeseeker",
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
    "codeseeker": {
      "command": "codeseeker",
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
    "codeseeker": {
      "command": "codeseeker",
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
    "codeseeker": {
      "command": "codeseeker",
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

1. Install CodeSeeker
2. Add MCP configuration to your IDE
3. Restart your IDE
4. In AI chat, run: `index_project({path: "/path/to/your/project"})`
5. Start using semantic search!

## Troubleshooting

### "No indexed projects found"
Run `index_project` to index your codebase first.

### MCP server not starting
- Check that `codeseeker` is in your PATH: `which codeseeker` or `where codeseeker`
- Try using the full path to the codeseeker executable

### Timeout errors
- Large codebases may take time to index initially
- CodeSeeker uses lazy loading - first search may be slower

## Support

- GitHub: https://github.com/jghiringhelli/codeseeker
- Issues: https://github.com/jghiringhelli/codeseeker/issues
