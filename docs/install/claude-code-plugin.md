# CodeSeeker Plugin for Claude Code

The CodeSeeker plugin integrates seamlessly with Claude Code (both CLI and VSCode extension), providing semantic search, coding standards detection, and intelligent context enhancement.

## What You Get

After installation, you can use these slash commands in Claude Code:

| Command | Description |
|---------|-------------|
| `/codeseeker:init` | Initialize CodeSeeker for your project |
| `/codeseeker:search <query>` | Semantic search across codebase |
| `/codeseeker:standards [category]` | Get auto-detected coding standards |
| `/codeseeker:relationships <file>` | Explore code dependencies |
| `/codeseeker:context <file>` | Get file with related context |
| `/codeseeker:reindex` | Trigger full project reindex |

Plus, Claude automatically uses CodeSeeker's skills to:
- Check coding standards before writing code
- Get semantic context when exploring files
- Keep the index updated as you work

## Prerequisites

1. **Claude Code** - Install from [claude.ai](https://claude.ai/download)
2. **Node.js 18+** - Required for CodeSeeker
3. **CodeSeeker CLI** - Install globally:
   ```bash
   npm install -g codeseeker
   ```

## Installation

### Option 1: Quick Install (Recommended)

```bash
# Clone or download CodeSeeker
git clone https://github.com/anthropics/codeseeker.git
cd codeseeker

# Build the project
npm install
npm run build

# Install the plugin to Claude Code
claude /plugin install ./plugins/codeseeker
```

### Option 2: Manual Installation

1. **Copy plugin files** to Claude Code's plugin directory:

   **Linux/macOS:**
   ```bash
   mkdir -p ~/.claude/plugins
   cp -r plugins/codeseeker ~/.claude/plugins/
   ```

   **Windows (PowerShell):**
   ```powershell
   New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.claude\plugins"
   Copy-Item -Recurse plugins\codeseeker "$env:USERPROFILE\.claude\plugins\"
   ```

2. **Restart Claude Code** to load the plugin

### Option 3: Development Mode

For plugin development, symlink instead of copy:

```bash
# Linux/macOS
ln -s $(pwd)/plugins/codeseeker ~/.claude/plugins/codeseeker

# Windows (Admin PowerShell)
New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\.claude\plugins\codeseeker" -Target "$(pwd)\plugins\codeseeker"
```

## Configuration

### MCP Server Setup

The plugin includes MCP server configuration that enables advanced tools. To activate:

1. **Automatic**: The plugin's `.mcp.json` is loaded automatically on plugin install

2. **Manual**: Add to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "codeseeker": {
      "command": "node",
      "args": ["/path/to/codeseeker/dist/mcp/mcp-server.js"],
      "env": {
        "CODESEEKER_STORAGE_MODE": "embedded"
      }
    }
  }
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CODESEEKER_STORAGE_MODE` | `embedded` | Storage mode: `embedded` or `server` |
| `CODESEEKER_DATA_DIR` | `~/.codeseeker/data` | Data directory for embedded mode |

## Usage

### Initialize Your Project

When you open a project for the first time:

```
/codeseeker:init
```

This indexes your codebase for semantic search (takes 1-5 minutes depending on size).

### Search Code Semantically

Find code by meaning, not just keywords:

```
/codeseeker:search authentication middleware
/codeseeker:search how are errors handled
/codeseeker:search database connection pooling
```

### Get Coding Standards

Before writing new code, check the project's patterns:

```
/codeseeker:standards validation
/codeseeker:standards error-handling
/codeseeker:standards logging
/codeseeker:standards testing
/codeseeker:standards all
```

### Explore Code Relationships

Understand how code connects:

```
/codeseeker:relationships src/services/auth.ts
/codeseeker:context src/controllers/user.ts
```

### Keep Index Updated

After major changes (git pull, branch switch):

```
/codeseeker:reindex
```

## Example Workflow

```
You: I need to add email validation to the user registration endpoint

Claude: Let me check the project's coding standards first.
/codeseeker:standards validation

[Shows that project uses validator.isEmail()]

Claude: I see this project uses the `validator` library for validation.
Let me find the registration code.
/codeseeker:search user registration endpoint

[Shows relevant files]

Claude: Now I'll add email validation using the project's standard pattern...
```

## Troubleshooting

### "Plugin not found"
- Verify files are in `~/.claude/plugins/codeseeker/`
- Check `.claude-plugin/plugin.json` exists
- Restart Claude Code

### "MCP tools not available"
- Ensure CodeSeeker CLI is installed: `codeseeker --version`
- Check the MCP server path is correct
- Verify Node.js 18+ is installed

### "Search returns no results"
- Run `/codeseeker:init` first
- Check `.codeseeker/` directory exists in your project
- Try `/codeseeker:reindex` for a full refresh

### "Coding standards empty"
- Project must be indexed first
- Standards need 2+ occurrences of a pattern
- Check `.codeseeker/coding-standards.json` exists

## Updating the Plugin

To update to a newer version:

```bash
cd /path/to/codeseeker
git pull
npm install
npm run build

# Reinstall plugin
claude /plugin uninstall codeseeker
claude /plugin install ./plugins/codeseeker
```

## Uninstalling

```bash
# Via Claude Code
claude /plugin uninstall codeseeker

# Or manually
rm -rf ~/.claude/plugins/codeseeker
```

## Next Steps

- Read the [MCP Server documentation](mcp-server.md) for advanced configuration
- See [CLI Commands Manual](cli_commands_manual.md) for standalone CLI usage
- Check [Coding Standards](../technical/coding-standards-validation.md) for pattern detection details