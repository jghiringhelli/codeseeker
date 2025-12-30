# CodeMind Plugin for Claude Code

The CodeMind plugin integrates seamlessly with Claude Code (both CLI and VSCode extension), providing semantic search, coding standards detection, and intelligent context enhancement.

## What You Get

After installation, you can use these slash commands in Claude Code:

| Command | Description |
|---------|-------------|
| `/codemind:init` | Initialize CodeMind for your project |
| `/codemind:search <query>` | Semantic search across codebase |
| `/codemind:standards [category]` | Get auto-detected coding standards |
| `/codemind:relationships <file>` | Explore code dependencies |
| `/codemind:context <file>` | Get file with related context |
| `/codemind:reindex` | Trigger full project reindex |

Plus, Claude automatically uses CodeMind's skills to:
- Check coding standards before writing code
- Get semantic context when exploring files
- Keep the index updated as you work

## Prerequisites

1. **Claude Code** - Install from [claude.ai](https://claude.ai/download)
2. **Node.js 18+** - Required for CodeMind
3. **CodeMind CLI** - Install globally:
   ```bash
   npm install -g codemind-enhanced-cli
   ```

## Installation

### Option 1: Quick Install (Recommended)

```bash
# Clone or download CodeMind
git clone https://github.com/anthropics/codemind.git
cd codemind

# Build the project
npm install
npm run build

# Install the plugin to Claude Code
claude /plugin install ./plugins/codemind
```

### Option 2: Manual Installation

1. **Copy plugin files** to Claude Code's plugin directory:

   **Linux/macOS:**
   ```bash
   mkdir -p ~/.claude/plugins
   cp -r plugins/codemind ~/.claude/plugins/
   ```

   **Windows (PowerShell):**
   ```powershell
   New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.claude\plugins"
   Copy-Item -Recurse plugins\codemind "$env:USERPROFILE\.claude\plugins\"
   ```

2. **Restart Claude Code** to load the plugin

### Option 3: Development Mode

For plugin development, symlink instead of copy:

```bash
# Linux/macOS
ln -s $(pwd)/plugins/codemind ~/.claude/plugins/codemind

# Windows (Admin PowerShell)
New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\.claude\plugins\codemind" -Target "$(pwd)\plugins\codemind"
```

## Configuration

### MCP Server Setup

The plugin includes MCP server configuration that enables advanced tools. To activate:

1. **Automatic**: The plugin's `.mcp.json` is loaded automatically on plugin install

2. **Manual**: Add to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "codemind": {
      "command": "node",
      "args": ["/path/to/codemind/dist/mcp/mcp-server.js"],
      "env": {
        "CODEMIND_STORAGE_MODE": "embedded"
      }
    }
  }
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CODEMIND_STORAGE_MODE` | `embedded` | Storage mode: `embedded` or `server` |
| `CODEMIND_DATA_DIR` | `~/.codemind/data` | Data directory for embedded mode |

## Usage

### Initialize Your Project

When you open a project for the first time:

```
/codemind:init
```

This indexes your codebase for semantic search (takes 1-5 minutes depending on size).

### Search Code Semantically

Find code by meaning, not just keywords:

```
/codemind:search authentication middleware
/codemind:search how are errors handled
/codemind:search database connection pooling
```

### Get Coding Standards

Before writing new code, check the project's patterns:

```
/codemind:standards validation
/codemind:standards error-handling
/codemind:standards logging
/codemind:standards testing
/codemind:standards all
```

### Explore Code Relationships

Understand how code connects:

```
/codemind:relationships src/services/auth.ts
/codemind:context src/controllers/user.ts
```

### Keep Index Updated

After major changes (git pull, branch switch):

```
/codemind:reindex
```

## Example Workflow

```
You: I need to add email validation to the user registration endpoint

Claude: Let me check the project's coding standards first.
/codemind:standards validation

[Shows that project uses validator.isEmail()]

Claude: I see this project uses the `validator` library for validation.
Let me find the registration code.
/codemind:search user registration endpoint

[Shows relevant files]

Claude: Now I'll add email validation using the project's standard pattern...
```

## Troubleshooting

### "Plugin not found"
- Verify files are in `~/.claude/plugins/codemind/`
- Check `.claude-plugin/plugin.json` exists
- Restart Claude Code

### "MCP tools not available"
- Ensure CodeMind CLI is installed: `codemind --version`
- Check the MCP server path is correct
- Verify Node.js 18+ is installed

### "Search returns no results"
- Run `/codemind:init` first
- Check `.codemind/` directory exists in your project
- Try `/codemind:reindex` for a full refresh

### "Coding standards empty"
- Project must be indexed first
- Standards need 2+ occurrences of a pattern
- Check `.codemind/coding-standards.json` exists

## Updating the Plugin

To update to a newer version:

```bash
cd /path/to/codemind
git pull
npm install
npm run build

# Reinstall plugin
claude /plugin uninstall codemind
claude /plugin install ./plugins/codemind
```

## Uninstalling

```bash
# Via Claude Code
claude /plugin uninstall codemind

# Or manually
rm -rf ~/.claude/plugins/codemind
```

## Next Steps

- Read the [MCP Server documentation](mcp-server.md) for advanced configuration
- See [CLI Commands Manual](cli_commands_manual.md) for standalone CLI usage
- Check [Coding Standards](../technical/coding-standards-validation.md) for pattern detection details