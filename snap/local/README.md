# Snap Package for CodeSeeker

This directory contains the Snap package definition for installing CodeSeeker on all Linux distributions.

## Quick Start for Maintainers

### Prerequisites

1. **Install snapcraft:**
   ```bash
   sudo snap install snapcraft --classic
   ```

2. **Create Snapcraft account:**
   - Go to https://dashboard.snapcraft.io/
   - Register/login with Ubuntu One account

### Building the Snap

```bash
# Build the snap locally
cd snap
snapcraft

# Test the snap locally
sudo snap install codeseeker_1.7.1_amd64.snap --dangerous --classic

# Verify installation
codeseeker --version
codeseeker install --vscode

# Remove test installation
sudo snap remove codeseeker
```

### Publishing to Snap Store

1. **Login to snapcraft:**
   ```bash
   snapcraft login
   ```

2. **Upload and release:**
   ```bash
   # Upload
   snapcraft upload codeseeker_1.7.1_amd64.snap

   # Release to stable channel
   snapcraft release codeseeker 1 stable
   ```

3. **First-time setup:**
   ```bash
   # Register the snap name (only needed once)
   snapcraft register codeseeker
   ```

### Updating the Snap

When releasing a new version:

1. **Update version in `snapcraft.yaml`:**
   ```yaml
   version: '1.7.2'
   source: https://registry.npmjs.org/codeseeker/-/codeseeker-1.7.2.tgz
   ```

2. **Build and publish:**
   ```bash
   snapcraft
   snapcraft upload codeseeker_1.7.2_amd64.snap
   snapcraft release codeseeker <revision> stable
   ```

## Package Structure

```
snap/
└── snapcraft.yaml    # Snap package definition
```

## Key Configuration

- **Base:** `core22` (Ubuntu 22.04 LTS)
- **Confinement:** `classic` (full system access for Node.js development tools)
- **Grade:** `stable` (production-ready)
- **Node Version:** 18.20.5 (LTS)

## For Users

Install CodeSeeker via Snap:

```bash
sudo snap install codeseeker --classic
```

The `--classic` flag is required because CodeSeeker needs full system access to:
- Read/write project files
- Execute Node.js and npm commands
- Access AI assistant configuration files

## Channels

Snap supports multiple release channels:

| Channel | Purpose | Stability |
|---------|---------|-----------|
| `stable` | Production releases | High |
| `candidate` | Release candidates | Medium |
| `beta` | Beta testing | Low |
| `edge` | Development builds | Very Low |

Users install from `stable` by default:
```bash
sudo snap install codeseeker        # stable channel
sudo snap install codeseeker --edge # edge channel (bleeding edge)
```

## Automatic Updates

Snaps auto-update by default. Users can control this:

```bash
# Check for updates manually
sudo snap refresh codeseeker

# Disable auto-updates (not recommended)
sudo snap refresh --hold codeseeker

# Re-enable auto-updates
sudo snap refresh --unhold codeseeker
```

## Troubleshooting

### Build fails with native dependencies

If build fails on native modules (like better-sqlite3):

1. Ensure build-packages includes:
   ```yaml
   build-packages:
     - python3
     - make
     - g++
   ```

2. Ensure stage-packages includes:
   ```yaml
   stage-packages:
     - libsqlite3-0
   ```

### Snap doesn't run after installation

1. Check confinement is set to `classic`
2. Verify user installed with `--classic` flag
3. Check file permissions: `ls -la /snap/codeseeker/current/bin/`

### Node.js version issues

Update `npm-node-version` in snapcraft.yaml to match required Node.js version (currently 18.20.5).

## Documentation

See [PACKAGE_MANAGERS.md](../docs/install/PACKAGE_MANAGERS.md) for complete publishing instructions including automated CI/CD workflows.
