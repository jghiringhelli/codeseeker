# Release Checklist

## One-time secrets setup

- [ ] Generate npm **Granular Access Token** (read+write, scoped to `codeseeker`) at [npmjs.com](https://www.npmjs.com/)
- [ ] Add as `NPM_TOKEN` in GitHub → **Settings → Secrets → Actions**
- [ ] MCP Registry uses GitHub OIDC — no token needed

## Every release

```bash
# Bump version (updates package.json + git tag)
npm version patch   # or minor / major

# Push — CI does the rest
git push origin master --tags
```

GitHub Actions will automatically:
- ✅ `npm publish` to npm registry
- ✅ Publish to MCP Registry (OIDC, no token)
- ✅ Sync `plugin` branch for Claude Code plugin users
- ✅ Create GitHub Release with install instructions

