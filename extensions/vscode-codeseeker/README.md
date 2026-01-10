# CodeSeeker VSCode Extension

Keep your CodeSeeker semantic index in sync with file changes automatically.

## Features

- **Automatic Sync**: File changes are automatically synced to CodeSeeker index
- **Debounced Updates**: Changes are batched to reduce server load
- **Full Reindex**: Trigger a complete reindex after major changes (git pull, branch switch)
- **Status Bar**: Visual indicator showing sync status
- **Smart Exclusions**: Automatically ignores node_modules, .git, dist, etc.

## Requirements

- [CodeSeeker CLI](https://github.com/codeseeker/codeseeker) installed globally
- A project indexed with CodeSeeker (`codeseeker init`)

## Installation

### From VSIX (Local)

```bash
# Build the extension
cd extensions/vscode-codeseeker
npm install
npm run compile
npm run package

# Install in VSCode
code --install-extension vscode-codeseeker-0.1.0.vsix
```

### From Marketplace (Coming Soon)

Search for "CodeSeeker" in the VSCode Extensions marketplace.

## Usage

### Automatic Sync

Once activated, the extension automatically watches for file changes and syncs them to CodeSeeker. You'll see a status indicator in the bottom right of VSCode.

**Status Icons:**
- 📊 Idle - watching for changes
- 🔄 Syncing - uploading changes
- ✓ Success - changes synced
- ⚠ Error - sync failed

### Commands

Open the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and type "CodeSeeker":

| Command | Description |
|---------|-------------|
| `CodeSeeker: Sync Now` | Immediately sync pending changes |
| `CodeSeeker: Full Reindex` | Rebuild the entire index |
| `CodeSeeker: Show Status` | View sync status and options |
| `CodeSeeker: Toggle Auto-Sync` | Enable/disable automatic syncing |

### Status Bar Menu

Click the CodeSeeker status bar item to access:
- Sync Now
- Full Reindex
- Toggle Auto-Sync
- View Output Logs

## Configuration

Open Settings (`Ctrl+,`) and search for "CodeSeeker":

| Setting | Default | Description |
|---------|---------|-------------|
| `codeseeker.autoSync` | `true` | Automatically sync file changes |
| `codeseeker.syncDebounceMs` | `2000` | Delay before syncing (ms) |
| `codeseeker.projectPath` | `""` | Project path (empty = workspace root) |
| `codeseeker.excludePatterns` | `[...]` | Glob patterns to exclude |
| `codeseeker.mcpCommand` | `"codeseeker"` | Command to invoke CodeSeeker |
| `codeseeker.showStatusBar` | `true` | Show status bar indicator |

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
3. **MCP Client**: Sends `notify_file_changes` to CodeSeeker MCP server
4. **Index Update**: CodeSeeker updates semantic embeddings and graph

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

### "codeseeker" command not found

Ensure CodeSeeker is installed globally:
```bash
npm install -g codeseeker
codeseeker --version
```

### No sync happening

1. Check if auto-sync is enabled (status bar shows 📊 not ⊘)
2. Verify file isn't in exclude patterns
3. Check Output → CodeSeeker MCP for errors

### Sync failures

1. Run `CodeSeeker: Show Status` → View Output
2. Ensure CodeSeeker MCP server can start: `codeseeker serve --mcp`
3. Check project is indexed: `codeseeker list`

### High CPU usage

Increase debounce delay in settings:
```json
{
  "codeseeker.syncDebounceMs": 5000
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