# CodeMind VSCode Extension - Installation Guide

This guide walks you through installing the CodeMind VSCode extension for automatic file sync.

## Prerequisites

1. **VSCode** installed (1.74.0 or later)
2. **Node.js** 18+ installed
3. **CodeMind CLI** installed globally:
   ```bash
   npm install -g codemind
   # or from local build:
   cd c:\workspace\claude\CodeMind
   npm run build && npm link
   ```

## Step-by-Step Installation

### Step 1: Navigate to Extension Directory

```bash
cd c:\workspace\claude\CodeMind\extensions\vscode-codemind
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Compile TypeScript

```bash
npm run compile
```

### Step 4: Package the Extension

```bash
npm run package
```

This creates `vscode-codemind-0.1.0.vsix` in the current directory.

### Step 5: Install in VSCode

**Option A: Using Command Line**
```bash
code --install-extension vscode-codemind-0.1.0.vsix
```

**Option B: Using VSCode UI**
1. Open VSCode
2. Go to Extensions (Ctrl+Shift+X)
3. Click the "..." menu at the top
4. Select "Install from VSIX..."
5. Navigate to `c:\workspace\claude\CodeMind\extensions\vscode-codemind\vscode-codemind-0.1.0.vsix`
6. Click "Install"

### Step 6: Restart VSCode

Close and reopen VSCode to activate the extension.

## Quick Install Script (All Steps)

```bash
# Run from CodeMind root
cd c:\workspace\claude\CodeMind\extensions\vscode-codemind
npm install && npm run compile && npm run package
code --install-extension vscode-codemind-0.1.0.vsix
```

## Verifying Installation

1. Open VSCode
2. Look for "CodeMind" in the status bar (bottom right)
3. Status should show: `📊 CodeMind`

## First-Time Setup

Before the extension works, you need to initialize your project with CodeMind:

```bash
cd /path/to/your/project
codemind init --quick
```

## Using the Extension

### Status Bar Indicators

| Icon | Status |
|------|--------|
| 📊 | Idle - watching for changes |
| 🔄 | Syncing - uploading changes |
| ✓ | Success - changes synced |
| ⚠ | Error - sync failed |

### Commands (Ctrl+Shift+P)

| Command | Description |
|---------|-------------|
| `CodeMind: Sync Now` | Immediately sync pending changes |
| `CodeMind: Full Reindex` | Rebuild the entire index |
| `CodeMind: Show Status` | View sync status and options |
| `CodeMind: Toggle Auto-Sync` | Enable/disable automatic syncing |

### Configuration

Open Settings (Ctrl+,) and search for "CodeMind":

| Setting | Default | Description |
|---------|---------|-------------|
| `codemind.autoSync` | `true` | Auto-sync file changes |
| `codemind.syncDebounceMs` | `2000` | Delay before syncing (ms) |
| `codemind.showStatusBar` | `true` | Show status bar indicator |

## Troubleshooting

### Extension Not Showing

1. Check Extensions panel for "CodeMind VSCode Extension"
2. If disabled, click "Enable"
3. Restart VSCode

### Sync Not Working

1. Verify project is indexed: `codemind list`
2. Check Output panel: View → Output → CodeMind MCP
3. Ensure auto-sync is enabled (click status bar)

### Build Errors

If `npm run compile` fails:

```bash
# Clear and reinstall
rm -rf node_modules
npm install
npm run compile
```

### VSIX Packaging Fails

Install vsce tool:
```bash
npm install -g @vscode/vsce
npm run package
```

## Uninstalling

**Via Command Line:**
```bash
code --uninstall-extension codemind.vscode-codemind
```

**Via VSCode UI:**
1. Extensions (Ctrl+Shift+X)
2. Find "CodeMind VSCode Extension"
3. Click "Uninstall"

## Development Mode (For Testing Changes)

Instead of packaging, run in development mode:

1. Open `c:\workspace\claude\CodeMind\extensions\vscode-codemind` in VSCode
2. Press F5 to launch Extension Development Host
3. Test changes in the new VSCode window

---

**Need Help?** Check the [main README](../README.md) or [open an issue](https://github.com/your-org/codemind/issues).