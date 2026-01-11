# CodeSeeker VSCode Extension - Installation Guide

This guide walks you through installing the CodeSeeker VSCode extension for automatic file sync.

## Prerequisites

1. **VSCode** installed (1.74.0 or later)
2. **Node.js** 18+ installed
3. **CodeSeeker CLI** installed globally:
   ```bash
   npm install -g codeseeker
   # or from local build:
   cd c:\workspace\claude\CodeSeeker
   npm run build && npm link
   ```

## Step-by-Step Installation

### Step 1: Navigate to Extension Directory

```bash
cd c:\workspace\claude\CodeSeeker\extensions\vscode-codeseeker
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

This creates `vscode-codeseeker-0.1.0.vsix` in the current directory.

### Step 5: Install in VSCode

**Option A: Using Command Line**
```bash
code --install-extension vscode-codeseeker-0.1.0.vsix
```

**Option B: Using VSCode UI**
1. Open VSCode
2. Go to Extensions (Ctrl+Shift+X)
3. Click the "..." menu at the top
4. Select "Install from VSIX..."
5. Navigate to `c:\workspace\claude\CodeSeeker\extensions\vscode-codeseeker\vscode-codeseeker-0.1.0.vsix`
6. Click "Install"

### Step 6: Restart VSCode

Close and reopen VSCode to activate the extension.

## Quick Install Script (All Steps)

```bash
# Run from CodeSeeker root
cd c:\workspace\claude\CodeSeeker\extensions\vscode-codeseeker
npm install && npm run compile && npm run package
code --install-extension vscode-codeseeker-0.1.0.vsix
```

## Verifying Installation

1. Open VSCode
2. Look for "CodeSeeker" in the status bar (bottom right)
3. Status should show: `📊 CodeSeeker`

## First-Time Setup

Before the extension works, you need to initialize your project with CodeSeeker:

```bash
cd /path/to/your/project
codeseeker init --quick
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
| `CodeSeeker: Sync Now` | Immediately sync pending changes |
| `CodeSeeker: Full Reindex` | Rebuild the entire index |
| `CodeSeeker: Show Status` | View sync status and options |
| `CodeSeeker: Toggle Auto-Sync` | Enable/disable automatic syncing |

### Configuration

Open Settings (Ctrl+,) and search for "CodeSeeker":

| Setting | Default | Description |
|---------|---------|-------------|
| `codeseeker.autoSync` | `true` | Auto-sync file changes |
| `codeseeker.syncDebounceMs` | `2000` | Delay before syncing (ms) |
| `codeseeker.showStatusBar` | `true` | Show status bar indicator |

## Troubleshooting

### Extension Not Showing

1. Check Extensions panel for "CodeSeeker VSCode Extension"
2. If disabled, click "Enable"
3. Restart VSCode

### Sync Not Working

1. Verify project is indexed: `codeseeker list`
2. Check Output panel: View → Output → CodeSeeker MCP
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
code --uninstall-extension codeseeker.vscode-codeseeker
```

**Via VSCode UI:**
1. Extensions (Ctrl+Shift+X)
2. Find "CodeSeeker VSCode Extension"
3. Click "Uninstall"

## Development Mode (For Testing Changes)

Instead of packaging, run in development mode:

1. Open `c:\workspace\claude\CodeSeeker\extensions\vscode-codeseeker` in VSCode
2. Press F5 to launch Extension Development Host
3. Test changes in the new VSCode window

---

**Need Help?** Check the [main README](../README.md) or [open an issue](https://github.com/your-org/codeseeker/issues).