# NPM Publishing Guide for CodeMind

This guide covers how to publish the `codemind-enhanced-cli` package to npm with proper security considerations.

## Pre-Publishing Checklist

### 1. Security Audit

Before publishing, run security audits:

```bash
# Check for known vulnerabilities in dependencies
npm audit

# Fix automatically fixable vulnerabilities
npm audit fix

# For manual review of remaining issues
npm audit --json > audit-report.json
```

**Critical:** Never publish with high or critical vulnerabilities unless you've assessed they don't affect your package's functionality.

### 2. Dependency Review

```bash
# Check for outdated dependencies
npm outdated

# Review dependency tree for unexpected packages
npm ls --all

# Check for duplicate dependencies
npm dedupe
```

### 3. Sensitive Data Check

Ensure these are NOT included in the package:

- [ ] `.env` files (should be in `.npmignore`)
- [ ] API keys or secrets
- [ ] Private configuration files
- [ ] Test fixtures with real data
- [ ] Local database files (`.codemind/` directory)
- [ ] IDE configuration (`.vscode/`, `.idea/`)

Review `.npmignore`:

```bash
cat .npmignore
```

### 4. Package Contents Preview

See exactly what will be published:

```bash
# List files that will be included
npm pack --dry-run

# Create a tarball to inspect
npm pack
tar -tzf codemind-enhanced-cli-*.tgz
```

### 5. Version Check

Ensure version is correct across all files:

```bash
# Check package.json
grep '"version"' package.json

# Check plugin.json
grep '"version"' plugins/codemind/.claude-plugin/plugin.json

# Check version.json
cat plugins/codemind/version.json
```

All three should match!

## Publishing Steps

### First-Time Setup

1. **Create npm account** at https://www.npmjs.com/signup

2. **Enable 2FA** (required for publishing):
   - Go to Account Settings → Two-Factor Authentication
   - Enable for "Authorization and Publishing"

3. **Login to npm**:
   ```bash
   npm login
   ```

### Publishing Process

1. **Build the project**:
   ```bash
   npm run build
   ```

2. **Run tests** (if available):
   ```bash
   npm test
   ```

3. **Verify package contents**:
   ```bash
   npm pack --dry-run
   ```

4. **Publish**:
   ```bash
   # For first publish
   npm publish --access public

   # For updates
   npm publish
   ```

5. **Verify on npm**:
   - Visit https://www.npmjs.com/package/codemind-enhanced-cli
   - Check the version, files, and readme

### Version Bumping

Follow semantic versioning:

```bash
# Patch release (bug fixes): 1.0.1 → 1.0.2
npm version patch

# Minor release (new features): 1.0.1 → 1.1.0
npm version minor

# Major release (breaking changes): 1.0.1 → 2.0.0
npm version major
```

After version bump, remember to:
1. Update `plugins/codemind/.claude-plugin/plugin.json`
2. Update `plugins/codemind/version.json`
3. Create GitHub release
4. Sync to plugin branch

## Security Best Practices

### Package Provenance

Consider enabling npm provenance for supply chain security:

```bash
npm publish --provenance
```

This requires publishing from GitHub Actions with proper OIDC setup.

### Scoped Packages (Optional)

For additional namespace protection, consider using a scoped package:

```json
{
  "name": "@your-username/codemind-cli"
}
```

### Access Control

For organization packages:

```bash
# Set package to public
npm access public codemind-enhanced-cli

# Add collaborators
npm owner add <username> codemind-enhanced-cli
```

## Post-Publishing

### Verify Installation Works

```bash
# Test global install
npm install -g codemind-enhanced-cli
codemind --version
codemind --help

# Test npx
npx codemind-enhanced-cli --version

# Test MCP server
npx codemind-enhanced-cli serve --mcp
```

### Update Documentation

After successful publish:

1. Remove the "NPM Package Not Yet Published" warnings from README.md
2. Update CHANGELOG.md
3. Create GitHub release
4. Announce the release

### Deprecation (if needed)

If you need to deprecate a version:

```bash
npm deprecate codemind-enhanced-cli@"< 1.0.0" "Please upgrade to 1.x for security fixes"
```

## Troubleshooting

### Common Issues

**"npm ERR! 403 Forbidden"**
- Check if package name is available
- Ensure you're logged in: `npm whoami`
- Check 2FA is properly configured

**"npm ERR! 402 Payment Required"**
- For scoped packages, use `--access public`

**Large Package Size**
- Review `.npmignore`
- Check `files` field in package.json
- Remove unnecessary assets

### Unpublish (Emergency Only)

You can unpublish within 72 hours:

```bash
npm unpublish codemind-enhanced-cli@1.0.0
```

After 72 hours, contact npm support.

## Automation (Future)

Consider setting up GitHub Actions for automated publishing:

```yaml
# .github/workflows/publish.yml
name: Publish to npm
on:
  release:
    types: [created]
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

This enables:
- Automatic publishing on GitHub release
- Package provenance for supply chain security
- Consistent build environment

## Quick Reference

```bash
# Pre-publish checklist
npm audit                    # Security check
npm outdated                 # Dependency check
npm pack --dry-run           # Preview contents

# Publish
npm login                    # Authenticate
npm version patch            # Bump version
npm publish --access public  # Publish

# Verify
npm info codemind-enhanced-cli  # Check published info
npx codemind-enhanced-cli --version  # Test installation
```