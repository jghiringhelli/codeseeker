# Versioning & Releases

## SemVer Rule
| Bump | When |
|---|---|
| PATCH x.y.+1 | Bug fixes, refactors, perf, docs |
| MINOR x.+1.0 | New backward-compatible feature |
| MAJOR +1.0.0 | Breaking change (renamed cmd, removed feature, schema migration) |

## Files to Update (ALL)
1. `package.json` → `"version"`
2. `plugins/codeseeker/.claude-plugin/plugin.json` → `"version"`
3. `plugins/codeseeker/version.json` → `"version"` + `"releaseDate"`
4. `CHANGELOG.md` → add entry

## Commit Format
PATCH → `fix: desc` | MINOR → `feat: desc` | MAJOR → `feat!: desc` or `BREAKING CHANGE:` in body

## Publish (manual — 2FA required)
```bash
npm login            # browser 2FA
npm publish --access public
```
Classic tokens were revoked Dec 2025. Granular tokens cannot bypass 2FA. No CI automation.

## GitHub Release
```bash
gh release create vX.Y.Z --repo jghiringhelli/codeseeker \
  --title "vX.Y.Z - Title" --notes "..."
```
Release notes format: PATCH = concise fixes; MINOR = new features + upgrade cmd; MAJOR = full feature docs.

## Plugin Branch Sync
After release: `git checkout plugin` → bump version files → commit `chore: bump version to X.Y.Z` → push → `git checkout master`.
