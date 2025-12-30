# Semantic Versioning Guide

This project follows [Semantic Versioning](https://semver.org/) (SemVer).

## Version Format: `MAJOR.MINOR.PATCH`

### PATCH (x.x.X) - Increment for:
- Bug fixes
- Performance improvements
- Security patches
- Documentation fixes
- Refactoring (no API changes)
- Dependency updates (non-breaking)

**Examples:**
- Fixed search returning duplicate results
- Improved indexing speed by 20%
- Fixed typo in error message
- Updated lodash to patch security vulnerability

### MINOR (x.X.0) - Increment for:
- New features (backward compatible)
- New CLI commands
- New MCP tools
- New configuration options
- Deprecations (old behavior still works)

**Examples:**
- Added `/codemind:analyze` command
- Added `get_code_metrics` MCP tool
- Added support for Python files
- New `--verbose` flag for CLI

### MAJOR (X.0.0) - Increment for:
- Breaking changes to API/CLI
- Removed features or commands
- Changed default behavior
- Database schema changes requiring migration
- Incompatible configuration changes

**Examples:**
- Renamed `/codemind:init` to `/codemind:setup`
- Removed deprecated `--legacy` flag
- Changed default storage from server to embedded
- MCP tool renamed from `search` to `search_code`

## Files to Update

When changing version, update ALL of these files:

| File | Field |
|------|-------|
| `package.json` | `"version": "X.Y.Z"` |
| `plugins/codemind/.claude-plugin/plugin.json` | `"version": "X.Y.Z"` |
| `plugins/codemind/version.json` | `"version": "X.Y.Z"` and `"releaseDate"` |

## Version Bump Commands

After making changes, Claude should:

1. Determine the appropriate version bump based on changes
2. Update all version files
3. Commit with message format:
   - PATCH: `fix: <description>` or `perf: <description>`
   - MINOR: `feat: <description>`
   - MAJOR: `feat!: <description>` or `BREAKING CHANGE: <description>`

## Plugin Branch Sync

After updating versions on master, sync to plugin branch:
```bash
git checkout plugin
# Update .claude-plugin/plugin.json and version.json
git commit -m "chore: bump version to X.Y.Z"
git push origin plugin
git checkout master
```

## Current Version

- **CLI (npm):** See `package.json`
- **Plugin:** See `plugins/codemind/.claude-plugin/plugin.json`

Keep these in sync unless there's a specific reason to diverge.