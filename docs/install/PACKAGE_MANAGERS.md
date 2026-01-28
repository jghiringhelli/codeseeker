# Package Manager Setup Guide

This guide explains how to publish CodeSeeker to Homebrew and Chocolatey package managers.

## Homebrew (macOS/Linux)

### Prerequisites

- Homebrew tap repository (optional but recommended for custom formulas)
- npm package published to npm registry
- SHA256 hash of the npm tarball

### Publishing to Homebrew

#### Option 1: Homebrew Core (Official)

Submit a pull request to [Homebrew/homebrew-core](https://github.com/Homebrew/homebrew-core):

1. **Calculate SHA256:**
   ```bash
   curl -sL https://registry.npmjs.org/codeseeker/-/codeseeker-1.7.1.tgz | shasum -a 256
   ```

2. **Update Formula:**
   - Copy `Formula/codeseeker.rb` content
   - Add the SHA256 from step 1
   - Submit PR to homebrew-core

3. **PR Requirements:**
   - Formula must be error-free
   - Must have `test do` block
   - Must follow Homebrew naming conventions

#### Option 2: Custom Tap (Faster, Recommended for Now)

Create your own Homebrew tap:

1. **Create tap repository:**
   ```bash
   # Repository name MUST be: homebrew-<tapname>
   # Example: homebrew-codeseeker
   ```

2. **Add formula:**
   ```bash
   git clone https://github.com/jghiringhelli/homebrew-codeseeker.git
   cd homebrew-codeseeker
   cp ../codeseeker/Formula/codeseeker.rb Formula/

   # Calculate SHA256 and update formula
   curl -sL https://registry.npmjs.org/codeseeker/-/codeseeker-1.7.1.tgz | shasum -a 256

   # Edit Formula/codeseeker.rb and add the SHA256
   git add Formula/codeseeker.rb
   git commit -m "Add codeseeker formula v1.7.1"
   git push origin main
   ```

3. **Users install via:**
   ```bash
   brew tap jghiringhelli/codeseeker
   brew install codeseeker
   ```

### Testing the Formula Locally

```bash
# Audit the formula
brew audit --new-formula Formula/codeseeker.rb

# Test installation locally
brew install --build-from-source Formula/codeseeker.rb

# Test uninstall
brew uninstall codeseeker

# Test bottle (binary package)
brew install codeseeker
```

### Updating the Formula

When releasing a new version:

1. Update version in formula
2. Calculate new SHA256 hash
3. Update URL
4. Commit and push

```bash
# Calculate new SHA256
curl -sL https://registry.npmjs.org/codeseeker/-/codeseeker-X.Y.Z.tgz | shasum -a 256

# Update Formula/codeseeker.rb with new version and SHA256
git add Formula/codeseeker.rb
git commit -m "Update codeseeker to vX.Y.Z"
git push origin main
```

## Chocolatey (Windows)

### Prerequisites

- Chocolatey account (free): https://community.chocolatey.org/
- API key from your Chocolatey profile
- npm package published to npm registry

### Publishing to Chocolatey

1. **Create Chocolatey API Key:**
   - Go to https://community.chocolatey.org/account
   - Generate an API key
   - Save it securely

2. **Package the .nupkg file:**
   ```powershell
   cd chocolatey
   choco pack codeseeker.nuspec
   ```

   This creates `codeseeker.1.7.1.nupkg`

3. **Test locally before publishing:**
   ```powershell
   # Install from local .nupkg
   choco install codeseeker -source "'.'" -y

   # Verify installation
   codeseeker --version

   # Uninstall
   choco uninstall codeseeker -y
   ```

4. **Push to Chocolatey Community Repository:**
   ```powershell
   choco apikey --key YOUR_API_KEY --source https://push.chocolatey.org/
   choco push codeseeker.1.7.1.nupkg --source https://push.chocolatey.org/
   ```

5. **Wait for moderation:**
   - First-time packages require manual approval (~1-7 days)
   - Subsequent updates are usually auto-approved

### Testing the Package

```powershell
# Test install
choco install codeseeker -y

# Verify
codeseeker --version
codeseeker install --vscode

# Test uninstall
choco uninstall codeseeker -y
```

### Updating the Package

When releasing a new version:

1. Update version in `codeseeker.nuspec`
2. Update release notes URL
3. Pack and push

```powershell
cd chocolatey

# Update version in codeseeker.nuspec to X.Y.Z

# Pack
choco pack codeseeker.nuspec

# Push
choco push codeseeker.X.Y.Z.nupkg --source https://push.chocolatey.org/
```

## Automated Publishing (GitHub Actions)

### Create `.github/workflows/publish-packages.yml`

```yaml
name: Publish Packages

on:
  release:
    types: [published]

jobs:
  publish-npm:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

  update-homebrew:
    needs: publish-npm
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Calculate SHA256
        id: sha
        run: |
          VERSION=${{ github.event.release.tag_name }}
          SHA=$(curl -sL https://registry.npmjs.org/codeseeker/-/codeseeker-${VERSION#v}.tgz | shasum -a 256 | cut -d ' ' -f 1)
          echo "sha256=$SHA" >> $GITHUB_OUTPUT

      - name: Update Homebrew Formula
        uses: mislav/bump-homebrew-formula-action@v3
        with:
          formula-name: codeseeker
          homebrew-tap: jghiringhelli/homebrew-codeseeker
          download-url: https://registry.npmjs.org/codeseeker/-/codeseeker-${{ github.event.release.tag_name }}.tgz
          commit-message: |
            codeseeker ${{ github.event.release.tag_name }}
        env:
          COMMITTER_TOKEN: ${{ secrets.HOMEBREW_TAP_TOKEN }}

  publish-chocolatey:
    needs: publish-npm
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - name: Update Chocolatey Package
        run: |
          cd chocolatey
          choco pack codeseeker.nuspec
          choco apikey --key ${{ secrets.CHOCO_API_KEY }} --source https://push.chocolatey.org/
          choco push codeseeker.${{ github.event.release.tag_name }}.nupkg --source https://push.chocolatey.org/
```

### Required GitHub Secrets

Add these to your repository settings (Settings → Secrets → Actions):

- `NPM_TOKEN`: npm authentication token (from npmjs.com)
- `HOMEBREW_TAP_TOKEN`: GitHub personal access token with repo access
- `CHOCO_API_KEY`: Chocolatey API key (from chocolatey.org)

## Version Bump Checklist

When releasing a new version (e.g., 1.7.2):

- [ ] Update `package.json` version
- [ ] Update `plugins/codeseeker/.claude-plugin/plugin.json` version
- [ ] Update `plugins/codeseeker/version.json` version and releaseDate
- [ ] Update `CHANGELOG.md`
- [ ] Update `Formula/codeseeker.rb` version (SHA256 will be calculated after npm publish)
- [ ] Update `chocolatey/codeseeker.nuspec` version
- [ ] Commit with semantic message: `feat:` (minor), `fix:` (patch), `feat!:` (major)
- [ ] Create GitHub release
- [ ] GitHub Actions auto-publishes to npm, Homebrew, Chocolatey

## Manual Publishing Steps

If GitHub Actions fails or you prefer manual publishing:

### 1. npm
```bash
npm run build
npm publish
```

### 2. Homebrew
```bash
# Calculate SHA256
curl -sL https://registry.npmjs.org/codeseeker/-/codeseeker-1.7.2.tgz | shasum -a 256

# Update Formula/codeseeker.rb with new version and SHA256
cd ../homebrew-codeseeker
git add Formula/codeseeker.rb
git commit -m "Update codeseeker to v1.7.2"
git push origin main
```

### 3. Chocolatey
```powershell
cd chocolatey
choco pack codeseeker.nuspec
choco push codeseeker.1.7.2.nupkg --source https://push.chocolatey.org/
```

## User Installation Commands

After successful publishing, users can install via:

**macOS/Linux:**
```bash
brew install codeseeker
# or: brew tap jghiringhelli/codeseeker && brew install codeseeker
```

**Windows:**
```powershell
choco install codeseeker
```

**Cross-platform:**
```bash
npm install -g codeseeker
```

## Support

- Homebrew issues: https://github.com/jghiringhelli/homebrew-codeseeker/issues
- Chocolatey issues: https://community.chocolatey.org/packages/codeseeker
- CodeSeeker issues: https://github.com/jghiringhelli/codeseeker/issues
