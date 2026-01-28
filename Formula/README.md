# Homebrew Formula for CodeSeeker

This directory contains the Homebrew formula for installing CodeSeeker on macOS and Linux.

## Quick Start for Maintainers

### After Publishing to npm

1. **Calculate SHA256 of the npm tarball:**
   ```bash
   curl -sL https://registry.npmjs.org/codeseeker/-/codeseeker-1.7.1.tgz | shasum -a 256
   ```

2. **Update `codeseeker.rb`:**
   - Update `url` with new version
   - Update `sha256` with calculated hash

3. **Test locally:**
   ```bash
   brew install --build-from-source Formula/codeseeker.rb
   codeseeker --version
   brew uninstall codeseeker
   ```

4. **Publish to tap:**
   - Copy to `homebrew-codeseeker` repository
   - Commit and push

## For Users

Install CodeSeeker via Homebrew:

```bash
# If using custom tap
brew tap jghiringhelli/codeseeker
brew install codeseeker

# If published to homebrew-core
brew install codeseeker
```

## Documentation

See [PACKAGE_MANAGERS.md](../docs/install/PACKAGE_MANAGERS.md) for detailed publishing instructions.
