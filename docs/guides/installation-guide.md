# Installation Guide

This guide covers all installation methods for CodeMind, from quick setup to advanced configurations for different environments.

## 📋 Prerequisites

Before installing CodeMind, ensure you have:

- **Node.js 18+** ([Download](https://nodejs.org/))
- **Git** ([Download](https://git-scm.com/))  
- **npm** or **yarn** package manager
- **PowerShell** (Windows) or **bash** (macOS/Linux)

## 🚀 Quick Installation

### Global Installation (Recommended)

```bash
# Install globally with npm
npm install -g codemind

# Install globally with yarn  
yarn global add codemind

# Verify installation
npx codemind --version
```

### Project-Specific Installation

```bash
# Install as dev dependency
npm install --save-dev codemind

# Or with yarn
yarn add -D codemind

# Use via npx
npx codemind --version
```

## 🔧 Advanced Installation

### Development Installation

For contributing to CodeMind or running from source:

```bash
# Clone the repository
git clone https://github.com/your-org/codemind.git
cd codemind

# Install dependencies
npm install

# Build the project
npm run build

# Link for global use
npm link

# Verify development installation
codemind --version
```

### Docker Installation

Run CodeMind in a containerized environment:

```bash
# Pull the official image
docker pull codemind/cli:latest

# Run CodeMind in a container
docker run --rm -v $(pwd):/workspace codemind/cli:latest analyze /workspace

# Create an alias for easier usage
echo 'alias codemind="docker run --rm -v $(pwd):/workspace codemind/cli:latest"' >> ~/.bashrc
```

### CI/CD Installation

#### GitHub Actions

```yaml
name: CodeMind Analysis
on: [push, pull_request]

jobs:
  codemind-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install -g codemind
      - run: codemind analyze --project . --output ./reports
      - uses: actions/upload-artifact@v3
        with:
          name: codemind-reports
          path: reports/
```

#### GitLab CI

```yaml
codemind_analysis:
  stage: test
  image: node:18
  script:
    - npm install -g codemind
    - codemind analyze --project . --output ./reports
  artifacts:
    reports:
      junit: reports/junit.xml
    paths:
      - reports/
```

#### Jenkins Pipeline

```groovy
pipeline {
    agent any
    stages {
        stage('CodeMind Analysis') {
            steps {
                sh 'npm install -g codemind'
                sh 'codemind analyze --project . --output ./reports'
                publishHTML([
                    allowMissing: false,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: 'reports',
                    reportFiles: 'index.html',
                    reportName: 'CodeMind Report'
                ])
            }
        }
    }
}
```

## 🌍 Environment Setup

### Environment Variables

Configure CodeMind with environment variables:

```bash
# Core settings
export CODEMIND_CONFIG_PATH=/path/to/config
export CODEMIND_LOG_LEVEL=info
export CODEMIND_DB_PATH=/path/to/database

# API settings (for cloud features)
export CODEMIND_API_KEY=your-api-key
export CODEMIND_API_BASE=https://api.codemind.dev

# Feature flags
export CODEMIND_ENABLE_SECURITY=true
export CODEMIND_ENABLE_PERFORMANCE=false

# Performance tuning
export CODEMIND_MAX_WORKERS=4
export CODEMIND_MEMORY_LIMIT=2048
```

### Shell Configuration

#### Bash/Zsh

```bash
# Add to ~/.bashrc or ~/.zshrc
export PATH="$PATH:$HOME/.npm-global/bin"
export CODEMIND_CONFIG_PATH="$HOME/.config/codemind"

# Optional: Add completion
eval "$(codemind completion bash)" # or zsh
```

#### PowerShell

```powershell
# Add to PowerShell profile
$env:CODEMIND_CONFIG_PATH = "$env:USERPROFILE\.config\codemind"

# Optional: Add to PATH if needed
$env:PATH += ";$env:APPDATA\npm"
```

## 🔍 Verification

### Basic Verification

```bash
# Check version
codemind --version

# Verify core commands
codemind --help
codemind analyze --help
codemind auto-fix --help

# Test on a sample project
mkdir test-project && cd test-project
echo "console.log('hello')" > index.js
codemind analyze --project . --quick
```

### Advanced Verification

```bash
# Check all features
codemind analyze --project . --full
codemind find-duplicates --project .  
codemind knowledge analyze --project .

# Verify Git integration
git init && git add . && git commit -m "test"
codemind auto-fix . --interactive --dry-run
```

## 🐛 Troubleshooting Installation

### Common Issues

**❌ "Command not found: codemind"**

```bash
# Check global installation
npm list -g --depth=0 | grep codemind

# Reinstall if missing
npm uninstall -g codemind
npm install -g codemind

# Check PATH
echo $PATH | tr ':' '\n' | grep npm
```

**❌ "Permission denied" (Linux/macOS)**

```bash
# Fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Then reinstall
npm install -g codemind
```

**❌ "Node.js version too old"**

```bash
# Check current version
node --version

# Update Node.js
# Using nvm (recommended)
nvm install 18
nvm use 18

# Or download from nodejs.org
```

**❌ "Git not found"**

```bash
# Install Git
# Ubuntu/Debian
sudo apt-get install git

# macOS (with Homebrew)
brew install git

# Windows: Download from git-scm.com
```

### Performance Issues

**Large Projects:**

```bash
# Increase memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Use specific analysis types
codemind analyze --types duplicates --project .
```

**Slow Analysis:**

```bash
# Exclude large directories
echo "node_modules/" > .codemindignore
echo "dist/" >> .codemindignore
echo "coverage/" >> .codemindignore
```

### Network Issues

**Corporate Firewalls:**

```bash
# Configure npm proxy
npm config set proxy http://proxy.company.com:8080
npm config set https-proxy http://proxy.company.com:8080

# Skip SSL verification (use with caution)
npm config set strict-ssl false
```

## 🔄 Updating CodeMind

### Regular Updates

```bash
# Check current version
codemind --version

# Update global installation
npm update -g codemind

# Or with yarn
yarn global upgrade codemind

# Verify update
codemind --version
```

### Development Updates

```bash
# Pull latest changes
git pull origin main

# Reinstall dependencies
npm install

# Rebuild
npm run build

# Update global link
npm link
```

## 🗑️ Uninstallation

### Remove Global Installation

```bash
# Uninstall with npm
npm uninstall -g codemind

# Or with yarn
yarn global remove codemind

# Clean npm cache
npm cache clean --force
```

### Clean Configuration

```bash
# Remove configuration files
rm -rf ~/.config/codemind
rm -rf ~/.codemind

# Remove environment variables from shell profile
# Edit ~/.bashrc, ~/.zshrc, or PowerShell profile
```

### Remove Docker Images

```bash
# Remove CodeMind images
docker rmi codemind/cli:latest

# Clean unused Docker resources
docker system prune -a
```

## 🔗 Next Steps

After successful installation:

1. **[Getting Started Guide](getting-started.md)** - Run your first analysis
2. **[Configuration Guide](configuration.md)** - Customize CodeMind for your project
3. **[Auto-Improvement Guide](auto-improvement.md)** - Try interactive improvements
4. **[CLI Reference](../api-reference/cli.md)** - Explore all available commands

## 📞 Installation Support

- **Installation Issues**: [Report here](https://github.com/your-org/codemind/issues/new?labels=installation)
- **Environment Help**: [Discussions](https://github.com/your-org/codemind/discussions)
- **Documentation**: [Installation FAQ](../troubleshooting/installation-faq.md)

---

[← User Guides](README.md) | [Getting Started →](getting-started.md)