# Chocolatey Package for CodeSeeker

This directory contains the Chocolatey package definition for installing CodeSeeker on Windows.

## Quick Start for Maintainers

### After Publishing to npm

1. **Update version in `codeseeker.nuspec`:**
   ```xml
   <version>1.7.1</version>
   ```

2. **Pack the package:**
   ```powershell
   cd chocolatey
   choco pack codeseeker.nuspec
   ```

3. **Test locally:**
   ```powershell
   choco install codeseeker -source "'.'" -y
   codeseeker --version
   choco uninstall codeseeker -y
   ```

4. **Push to Chocolatey Community:**
   ```powershell
   choco apikey --key YOUR_API_KEY --source https://push.chocolatey.org/
   choco push codeseeker.1.7.1.nupkg --source https://push.chocolatey.org/
   ```

## Package Structure

```
chocolatey/
├── codeseeker.nuspec          # Package metadata
└── tools/
    ├── chocolateyinstall.ps1  # Install script
    └── chocolateyuninstall.ps1 # Uninstall script
```

## For Users

Install CodeSeeker via Chocolatey:

```powershell
choco install codeseeker
```

## Documentation

See [PACKAGE_MANAGERS.md](../docs/install/PACKAGE_MANAGERS.md) for detailed publishing instructions.
