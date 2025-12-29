---
name: Auto-update notification for plugin
about: Add automatic update check when running /codemind:init
title: "Auto-update notification for plugin"
labels: enhancement
assignees: ''
---

## Summary

Add an automatic update check when running `/codemind:init` to notify users when a newer plugin version is available.

## Current State

- Plugin has `version.json` with current version info
- No mechanism to check for updates
- Users must manually check GitHub for new versions

## Proposed Implementation

1. On `/codemind:init`, fetch `version.json` from GitHub raw URL:
   ```
   https://raw.githubusercontent.com/jghiringhelli/codemind/plugin/version.json
   ```

2. Compare fetched version with local `plugin.json` version

3. If remote version is newer, display:
   ```
   ⚠️ CodeMind v1.1.0 available (you have v1.0.0)
   Run: /plugin uninstall codemind && /plugin install codemind@github:jghiringhelli/codemind#plugin
   ```

4. Cache check result for 24 hours to avoid repeated network calls

## Technical Notes

- Use `fetch()` in the init command handler
- Store last check timestamp in `.codemind/update-check.json`
- Fail silently if network unavailable (don't block init)
- Consider semantic version comparison (semver)

## Priority

Low - nice-to-have feature for better UX