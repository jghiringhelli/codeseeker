# Snap One-Time Setup Guide

This guide walks you through the one-time setup to enable automated Snap publishing via GitHub Actions.

## Prerequisites

- Ubuntu machine or Ubuntu VM (Windows users: use WSL2 with Ubuntu)
- Snapcraft account (free)
- CodeSeeker repository cloned

## Step 1: Create Snapcraft Account

1. Go to https://dashboard.snapcraft.io/
2. Click "Sign in" or "Create account"
3. Use your Ubuntu One account (or create one)
4. Verify your email address

## Step 2: Install Snapcraft

On your Ubuntu machine/VM/WSL2:

```bash
sudo snap install snapcraft --classic
```

Verify installation:
```bash
snapcraft --version
# Should show: snapcraft 8.x.x
```

## Step 3: Login to Snapcraft

```bash
snapcraft login
```

Enter your Ubuntu One credentials when prompted.

## Step 4: Register the Snap Name

**IMPORTANT:** This reserves the name "codeseeker" in the Snap Store.

```bash
snapcraft register codeseeker
```

You'll see:
```
Congrats! You are now the publisher of 'codeseeker'.
```

## Step 5: Export Snapcraft Token for GitHub Actions

This token allows GitHub Actions to publish on your behalf.

```bash
snapcraft export-login --snaps=codeseeker --channels=stable --acls=package_upload snapcraft-token.txt
```

This creates `snapcraft-token.txt` with your credentials.

**⚠️ CRITICAL:** This file contains sensitive credentials. DO NOT commit it to git!

## Step 6: Add Token to GitHub Secrets

1. **Read the token file:**
   ```bash
   cat snapcraft-token.txt
   ```

2. **Copy the entire contents** (it's base64-encoded, looks like gibberish - that's normal)

3. **Go to GitHub:**
   - Navigate to https://github.com/jghiringhelli/codeseeker
   - Go to Settings → Secrets and variables → Actions
   - Click "New repository secret"

4. **Create the secret:**
   - Name: `SNAPCRAFT_TOKEN`
   - Value: Paste the contents of `snapcraft-token.txt`
   - Click "Add secret"

5. **Delete the token file from your machine:**
   ```bash
   rm snapcraft-token.txt
   ```

## Step 7: Verify GitHub Actions Workflow

The workflow is already configured in `.github/workflows/publish-packages.yml`.

Check it includes the Snap job:

```yaml
publish-snap:
  needs: publish-npm
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: snapcore/action-build@v1
      id: snapcraft
    - uses: snapcore/action-publish@v1
      with:
        snap: ${{ steps.snapcraft.outputs.snap }}
        release: stable
      env:
        SNAPCRAFT_STORE_CREDENTIALS: ${{ secrets.SNAPCRAFT_TOKEN }}
```

## Step 8: Test Manual Build (Optional)

Before relying on GitHub Actions, test building locally:

```bash
cd snap
snapcraft
```

This creates `codeseeker_1.7.1_amd64.snap`.

**Test the snap:**
```bash
sudo snap install codeseeker_1.7.1_amd64.snap --dangerous --classic
codeseeker --version
sudo snap remove codeseeker
```

## Step 9: Test Manual Upload (Optional)

Upload to Snap Store to verify credentials:

```bash
snapcraft upload codeseeker_1.7.1_amd64.snap
```

You'll see:
```
Revision 1 created for 'codeseeker'
```

**Release to stable:**
```bash
snapcraft release codeseeker 1 stable
```

**Verify it's live:**
```bash
snap info codeseeker
```

## ✅ Setup Complete!

Your Snap is now configured for automated publishing!

### What Happens Next

**When you create a GitHub release:**

1. GitHub Actions triggers
2. npm package published
3. Snap is automatically:
   - Built on Ubuntu
   - Uploaded to Snap Store
   - Released to stable channel

**Users can install with:**
```bash
sudo snap install codeseeker --classic
```

## Troubleshooting

### "snapcraft: command not found"

Install snapcraft:
```bash
sudo snap install snapcraft --classic
```

### "This snap name is already registered"

Someone else registered it. Choose a different name or contact support:
- Check: https://snapcraft.io/codeseeker
- If it's yours: Use `snapcraft login` with the correct account
- If it's someone else's: Choose a different name

### "Authentication failed"

Re-login:
```bash
snapcraft logout
snapcraft login
```

### GitHub Actions fails with "Invalid credentials"

Re-export the token:
```bash
snapcraft export-login --snaps=codeseeker --channels=stable --acls=package_upload snapcraft-token.txt
cat snapcraft-token.txt  # Copy to GitHub Secrets
rm snapcraft-token.txt
```

### Build fails with "classic confinement requires snap-declaration"

This is expected on first upload. After the first successful upload and release, classic confinement is automatically approved.

## Advanced: Using Remote Build

If you don't have Ubuntu locally, use Launchpad remote build:

```bash
cd snap
snapcraft remote-build
```

This builds on Canonical's servers and downloads the .snap file.

## Next Steps

After Snap setup is complete, set up the other package managers:
- [Homebrew Setup](./HOMEBREW_SETUP.md)
- [Chocolatey Setup](./CHOCOLATEY_SETUP.md)
- [npm Setup](./NPM_SETUP.md)

Or see the complete guide: [PACKAGE_MANAGERS.md](./PACKAGE_MANAGERS.md)
