# CodeMind Integration Guide

This guide explains the different ways to use CodeMind and how they work together.

## Components Overview

CodeMind provides multiple integration points - use what fits your workflow:

| Component | Purpose | Install Once? | Auto-Sync? |
|-----------|---------|---------------|------------|
| **CLI** | Standalone tool, REPL mode | Global npm install | Manual |
| **MCP Server** | AI assistant integration | Via plugin or manual | Manual |
| **Claude Code Plugin** | Seamless Claude Code integration | Copy to plugins folder | Yes |
| **VSCode Extension** | File watching for manual edits | VSCode marketplace | Yes |

## Quick Start: Install & Forget

For the smoothest experience with Claude Code:

```bash
# 1. Install CodeMind globally
npm install -g codemind-enhanced-cli

# 2. Copy plugin to Claude Code
cp -r plugins/codemind ~/.claude/plugins/   # Linux/macOS
xcopy /E /I plugins\codemind %USERPROFILE%\.claude\plugins\codemind  # Windows

# 3. Restart Claude Code

# 4. Initialize your project (one time)
# In Claude Code, run: /codemind:init
```

That's it! The plugin handles everything else automatically.

## Component Details

### 1. CLI (`codemind`)

The command-line interface for direct interaction.

**Installation:**
```bash
npm install -g codemind-enhanced-cli
```

**Usage:**
```bash
# Interactive REPL mode
codemind

# Single command
codemind -c "search for authentication logic"

# Direct query
codemind "what does this project do"

# Start MCP server
codemind serve --mcp
```

**When to use:** Local development, scripting, CI/CD pipelines.

---

### 2. MCP Server

Exposes CodeMind tools to AI assistants via Model Context Protocol.

**Tools provided:**
- `search_code` - Semantic search across codebase
- `get_file_context` - File with related context
- `get_code_relationships` - Dependency exploration
- `get_coding_standards` - Auto-detected patterns
- `index_project` - Project indexing
- `notify_file_changes` - Incremental updates

**Auto-configured:** The Claude Code Plugin includes MCP configuration.

**Manual setup:** Add to `~/.claude/settings.json`:
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

### 3. Claude Code Plugin (Recommended)

The plugin provides the most seamless experience with Claude Code.

**What it includes:**
- Slash commands (`/codemind:init`, `/codemind:search`, etc.)
- Agent skills (auto-invoked by Claude when relevant)
- MCP server auto-configuration
- Auto-sync hooks (keeps index updated automatically)

**Installation:**
```bash
# Copy to plugins directory
cp -r plugins/codemind ~/.claude/plugins/

# Restart Claude Code
```

**Auto-sync hooks:**

| Trigger | Action |
|---------|--------|
| Claude edits files (Edit/Write) | Incremental index update |
| Claude runs git operations | Full reindex if files changed |

This means the index stays current without any manual intervention.

---

### 4. VSCode Extension (Optional)

Watches for manual file edits and syncs the index.

**When to install:** If you frequently edit files manually (not through Claude).

**What it does:**
- Monitors file system for creates/edits/deletes
- Batches changes (2-second debounce)
- Calls MCP `notify_file_changes` automatically

**Installation:** Install from VSCode marketplace or build from `extensions/vscode-codemind/`.

---

## Sync Behavior Summary

| Scenario | Component | Sync Type | Automatic? |
|----------|-----------|-----------|------------|
| Claude edits file | Plugin hook | Incremental | Yes |
| Claude runs `git pull` | Plugin hook | Full reindex | Yes |
| Claude runs `git checkout` | Plugin hook | Full reindex | Yes |
| User edits in VSCode | Extension | Incremental | Yes (if installed) |
| User edits outside VSCode | - | Manual | No |
| User runs git commands | - | Manual | No |

**Manual reindex when needed:**
```
/codemind:reindex
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User's Project                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  CLI         │    │  VSCode Ext  │    │  Claude Code │       │
│  │  (codemind)  │    │  (watcher)   │    │  (plugin)    │       │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘       │
│         │                   │                   │                │
│         └───────────────────┼───────────────────┘                │
│                             │                                    │
│                             ▼                                    │
│                    ┌────────────────┐                            │
│                    │   MCP Server   │                            │
│                    │  (codemind     │                            │
│                    │   serve --mcp) │                            │
│                    └────────┬───────┘                            │
│                             │                                    │
│              ┌──────────────┼──────────────┐                     │
│              ▼              ▼              ▼                     │
│     ┌─────────────┐ ┌─────────────┐ ┌─────────────┐             │
│     │   SQLite    │ │  Embedded   │ │  .codemind/ │             │
│     │  (vectors)  │ │  MiniSearch │ │  (config)   │             │
│     └─────────────┘ └─────────────┘ └─────────────┘             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Recommended Setup by Use Case

### Developer using Claude Code daily
1. Install CLI globally
2. Install Claude Code Plugin
3. Run `/codemind:init` once per project
4. (Optional) Install VSCode Extension for manual edit sync

### Team with shared codebase
1. Each developer installs CLI + Plugin
2. Add `.codemind/` to `.gitignore` (indexes are local)
3. Each developer runs `/codemind:init` on clone

### CI/CD integration
1. Install CLI in pipeline
2. Use `codemind -c "analyze..."` for automated checks
3. No plugin/extension needed

---

## Troubleshooting

### MCP tools not available
```bash
# Verify CLI is installed
codemind --version

# Verify MCP server starts
codemind serve --mcp
# Should output: "CodeMind MCP server running..."
```

### Index out of date
```
/codemind:reindex
```

### Plugin not loading
- Check `~/.claude/plugins/codemind/.claude-plugin/plugin.json` exists
- Restart Claude Code completely

### Hooks not triggering
- Verify plugin is loaded: `/codemind:search test`
- Check `~/.claude/plugins/codemind/hooks/hooks.json` exists
