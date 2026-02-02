# Package Manager Setup Checklist

Use this checklist to track your one-time setup for automated publishing.

## ✅ Setup Status

### npm (Required - Publish First)

- [ ] Create npm account: https://www.npmjs.com/
- [ ] Login locally: `npm login`
- [ ] Generate token: `npm token create`
- [ ] Add to GitHub Secrets: `NPM_TOKEN`
- [ ] Test publish: `npm publish` (in test package or this repo)

### Snap (Linux - Universal)

- [ ] Create Snapcraft account: https://dashboard.snapcraft.io/
- [ ] Install snapcraft: `sudo snap install snapcraft --classic`
- [ ] Login: `snapcraft login`
- [ ] Register name: `snapcraft register codeseeker`
- [ ] Export token: `snapcraft export-login --snaps=codeseeker --channels=stable --acls=package_upload snapcraft-token.txt`
- [ ] Add to GitHub Secrets: `SNAPCRAFT_TOKEN` (paste contents of snapcraft-token.txt)
- [ ] Delete token file: `rm snapcraft-token.txt`
- [ ] Optional test: `cd snap && snapcraft && snapcraft upload ...`

**Detailed Guide:** [SNAP_SETUP.md](./SNAP_SETUP.md)

### Homebrew (macOS/Linux)

- [ ] Create GitHub repo: `jghiringhelli/homebrew-codeseeker`
- [ ] Generate GitHub PAT (Personal Access Token):
  - Go to https://github.com/settings/tokens
  - Generate new token (classic)
  - Scopes: `repo` (full control)
- [ ] Add to GitHub Secrets: `HOMEBREW_TAP_TOKEN`
- [ ] Calculate SHA256 (after npm publish):
  ```bash
  curl -sL https://registry.npmjs.org/codeseeker/-/codeseeker-1.7.1.tgz | shasum -a 256
  ```
- [ ] Update `Formula/codeseeker.rb` with SHA256
- [ ] Copy formula to tap repo:
  ```bash
  cd homebrew-codeseeker
  cp ../codeseeker/Formula/codeseeker.rb Formula/
  git add Formula/codeseeker.rb
  git commit -m "Add codeseeker formula v1.7.1"
  git push origin main
  ```

### Chocolatey (Windows)

- [ ] Create Chocolatey account: https://community.chocolatey.org/
- [ ] Get API key: https://community.chocolatey.org/account
- [ ] Add to GitHub Secrets: `CHOCO_API_KEY`
- [ ] Optional test:
  ```powershell
  cd chocolatey
  choco pack codeseeker.nuspec
  choco push codeseeker.1.7.1.nupkg --source https://push.chocolatey.org/
  ```
- [ ] Wait for moderation (1-7 days for first package)

## 🚀 GitHub Actions Verification

After all secrets are added:

- [ ] Verify all 4 secrets exist in GitHub:
  - Settings → Secrets and variables → Actions
  - Should see: `NPM_TOKEN`, `SNAPCRAFT_TOKEN`, `HOMEBREW_TAP_TOKEN`, `CHOCO_API_KEY`

- [ ] Check workflow file exists: `.github/workflows/publish-packages.yml`

- [ ] Test the workflow:
  1. Bump version in `package.json` to test version (e.g., 1.7.2-test)
  2. Commit and push
  3. Create a test release: `gh release create v1.7.2-test --prerelease`
  4. Watch Actions tab: https://github.com/jghiringhelli/codeseeker/actions
  5. Verify all jobs pass
  6. Delete test release

## 📦 One-Time Setup Per Package Manager

| Package Manager | Account | Token/Key | Repo/Name | Time | Difficulty |
|----------------|---------|-----------|-----------|------|------------|
| **npm** | ✅ | ✅ | N/A | 5 min | 🟢 Easy |
| **Snap** | ⬜ | ⬜ | ⬜ | 10 min | 🟡 Medium |
| **Homebrew** | ✅ (GitHub) | ⬜ | ⬜ | 15 min | 🟡 Medium |
| **Chocolatey** | ⬜ | ⬜ | N/A | 5 min | 🟢 Easy |

**Total setup time:** ~35 minutes (one-time)

## 🎯 After Setup is Complete

### Normal Release Process

1. **Bump version** in all files:
   - `package.json`
   - `plugins/codeseeker/.claude-plugin/plugin.json`
   - `plugins/codeseeker/version.json`
   - `CHANGELOG.md`

2. **Commit and push:**
   ```bash
   git add .
   git commit -m "chore: bump version to 1.7.2"
   git push origin master
   ```

3. **Create GitHub release:**
   ```bash
   gh release create v1.7.2 --title "v1.7.2 - Description" --notes "Release notes here"
   ```

4. **GitHub Actions automatically:**
   - ✅ Publishes to npm
   - ✅ Updates Homebrew formula
   - ✅ Builds and publishes Snap
   - ✅ Publishes to Chocolatey
   - ✅ Syncs plugin branch

**That's it!** All platforms updated automatically.

## 🆘 Support

If you get stuck:
- **Snap issues:** https://forum.snapcraft.io/
- **Homebrew issues:** https://github.com/Homebrew/homebrew-core/issues
- **Chocolatey issues:** https://community.chocolatey.org/packages/codeseeker
- **npm issues:** https://docs.npmjs.com/
- **CodeSeeker issues:** https://github.com/jghiringhelli/codeseeker/issues

## 📚 Detailed Guides

- [Complete Package Manager Setup](./PACKAGE_MANAGERS.md)
- [Snap Detailed Setup](./SNAP_SETUP.md)
- [GitHub Actions Workflow Details](./.github/workflows/publish-packages.yml)
