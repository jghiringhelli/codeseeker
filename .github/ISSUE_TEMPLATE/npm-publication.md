---
name: Publish to npm registry
about: Steps to publish codemind-enhanced-cli to npm
title: "Publish codemind-enhanced-cli to npm registry"
labels: enhancement, documentation
assignees: ''
---

## Summary

Publish the `codemind-enhanced-cli` package to npm so users can install via:
- `npm install -g codemind-enhanced-cli`
- `npx codemind-enhanced-cli serve --mcp`

## Prerequisites

1. **npm account** - Create at https://www.npmjs.com/signup
2. **2FA enabled** - Required for publishing
3. **Package name available** - Verify `codemind-enhanced-cli` is not taken

## Pre-Publication Checklist

### Security Review
- [ ] Remove any hardcoded credentials or API keys
- [ ] Check `.gitignore` and `.npmignore` exclude sensitive files
- [ ] Verify no `.env` files are included in package
- [ ] Review dependencies for known vulnerabilities: `npm audit`
- [ ] Ensure no internal/private paths are exposed

### Package Preparation
- [ ] Update `package.json` version following SemVer
- [ ] Verify `main`, `bin`, and `files` fields are correct
- [ ] Test local install: `npm pack && npm install -g codemind-enhanced-cli-*.tgz`
- [ ] Verify CLI works: `codemind --version`
- [ ] Verify MCP server works: `codemind serve --mcp`
- [ ] Run tests: `npm test`
- [ ] Build: `npm run build`

### Files to Include (.npmignore)
```
# Include
dist/
bin/
package.json
README.md
LICENSE

# Exclude (add to .npmignore)
src/
tests/
*.ts
.codemind/
.github/
docs/
plugins/
extensions/
archive/
deploy/
scripts/
*.log
.env*
```

## Publication Steps

```bash
# 1. Login to npm
npm login

# 2. Verify package contents
npm pack --dry-run

# 3. Run final checks
npm audit
npm test
npm run build

# 4. Publish (first time)
npm publish --access public

# 5. Verify publication
npm view codemind-enhanced-cli
```

## Post-Publication

1. Update README with npm install instructions
2. Create GitHub release with same version tag
3. Update plugin `.mcp.json` to use npx (already done)
4. Test fresh install: `npx -y codemind-enhanced-cli --version`

## Version Sync

When publishing, ensure these files have matching versions:
- `package.json`
- `plugins/codemind/.claude-plugin/plugin.json`
- `plugins/codemind/version.json`

## Troubleshooting

### "Package name already exists"
- Choose a different name or use scoped package: `@username/codemind`

### "Missing dependencies"
- Ensure all runtime deps are in `dependencies`, not `devDependencies`
- Test with `npm pack` then install the tarball

### "Command not found after install"
- Check `bin` field in package.json points to correct file
- Verify shebang line in bin/codemind.js: `#!/usr/bin/env node`