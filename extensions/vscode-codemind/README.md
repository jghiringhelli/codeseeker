# CodeMind VSCode Extension

Keep your CodeMind semantic index in sync with file changes automatically.

## Features

- **Automatic Sync**: File changes are automatically synced to CodeMind index
- **Debounced Updates**: Changes are batched to reduce server load
- **Full Reindex**: Trigger a complete reindex after major changes (git pull, branch switch)
- **Status Bar**: Visual indicator showing sync status
- **Smart Exclusions**: Automatically ignores node_modules, .git, dist, etc.

## Requirements

- [CodeMind CLI](https://github.com/codemind/codemind) installed globally
- A project indexed with CodeMind (`codemind init`)

## Installation

### From VSIX (Local)

```bash
# Build the extension
cd extensions/vscode-codemind
npm install
npm run compile
npm run package

# Install in VSCode
code --install-extension vscode-codemind-0.1.0.vsix
```

### From Marketplace (Coming Soon)

Search for "CodeMind" in the VSCode Extensions marketplace.

## Usage

### Automatic Sync

Once activated, the extension automatically watches for file changes and syncs them to CodeMind. You'll see a status indicator in the bottom right of VSCode.

**Status Icons:**
- 📊 Idle - watching for changes
- 🔄 Syncing - uploading changes
- ✓ Success - changes synced
- ⚠ Error - sync failed

### Commands

Open the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and type "CodeMind":

| Command | Description |
|---------|-------------|
| `CodeMind: Sync Now` | Immediately sync pending changes |
| `CodeMind: Full Reindex` | Rebuild the entire index |
| `CodeMind: Show Status` | View sync status and options |
| `CodeMind: Toggle Auto-Sync` | Enable/disable automatic syncing |

### Status Bar Menu

Click the CodeMind status bar item to access:
- Sync Now
- Full Reindex
- Toggle Auto-Sync
- View Output Logs

## Configuration

Open Settings (`Ctrl+,`) and search for "CodeMind":

| Setting | Default | Description |
|---------|---------|-------------|
| `codemind.autoSync` | `true` | Automatically sync file changes |
| `codemind.syncDebounceMs` | `2000` | Delay before syncing (ms) |
| `codemind.projectPath` | `""` | Project path (empty = workspace root) |
| `codemind.excludePatterns` | `[...]` | Glob patterns to exclude |
| `codemind.mcpCommand` | `"codemind"` | Command to invoke CodeMind |
| `codemind.showStatusBar` | `true` | Show status bar indicator |

### Default Exclusions

```json
[
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/out/**",
  "**/*.log"
]
```

## How It Works

1. **File Watcher**: VSCode's file system watcher detects changes
2. **Debounce**: Changes are collected and debounced (default 2s)
3. **MCP Client**: Sends `notify_file_changes` to CodeMind MCP server
4. **Index Update**: CodeMind updates semantic embeddings and graph

### Change Types

| Type | Action |
|------|--------|
| `created` | New file added to index |
| `modified` | File re-indexed with new content |
| `deleted` | File removed from index |

### Smart Merging

The extension intelligently merges rapid changes:
- Create → Delete = No change (cancelled out)
- Delete → Create = Modified (file recreated)
- Multiple edits = Single modified event

## Troubleshooting

### "codemind" command not found

Ensure CodeMind is installed globally:
```bash
npm install -g codemind
codemind --version
```

### No sync happening

1. Check if auto-sync is enabled (status bar shows 📊 not ⊘)
2. Verify file isn't in exclude patterns
3. Check Output → CodeMind MCP for errors

### Sync failures

1. Run `CodeMind: Show Status` → View Output
2. Ensure CodeMind MCP server can start: `codemind serve --mcp`
3. Check project is indexed: `codemind list`

### High CPU usage

Increase debounce delay in settings:
```json
{
  "codemind.syncDebounceMs": 5000
}
```

## Development

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Watch mode
npm run watch

# Package
npm run package
```

## License

MIT - See [LICENSE](LICENSE)

## Contributing

Contributions welcome! Please read our [Contributing Guide](../../CONTRIBUTING.md).