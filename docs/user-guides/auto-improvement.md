# Auto-Improvement Guide

This comprehensive guide covers CodeMind's Auto-Improvement Mode, including both interactive and non-interactive workflows for systematically improving code quality.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Interactive Mode](#interactive-mode) ⭐ **Recommended**
3. [Non-Interactive Mode](#non-interactive-mode)
4. [Configuration](#configuration)
5. [Safety Features](#safety-features)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

## Overview

CodeMind's Auto-Improvement Mode analyzes existing codebases and applies comprehensive fixes across multiple dimensions. It can detect and fix duplications, centralize configurations, resolve dependencies, and enhance overall code quality.

### 🎯 What It Does

- **Code Duplication Detection** - Finds and refactors exact, structural, semantic, and renamed duplicates
- **Configuration Centralization** - Identifies scattered configs and creates centralized configuration
- **Dependency Analysis** - Detects circular dependencies and optimization opportunities
- **Quality Improvements** - Applies systematic code quality enhancements
- **Git Workflow Integration** - Safe branching, testing, and user approval workflows

## Interactive Mode ⭐

**Interactive Mode** is the recommended approach, providing a safe, step-by-step improvement process with Git integration.

### Quick Start

```bash
# Run interactive auto-improvement (recommended)
npx codemind auto-fix ./my-project --interactive

# Skip tests if not available
npx codemind auto-fix ./my-project --interactive --skip-tests

# Auto-approve for CI/CD (use with caution)
npx codemind auto-fix ./my-project --interactive --auto-approve
```

### 7-Phase Interactive Workflow

#### Phase 1: Git Repository Setup
```
🔄 Phase 1: Git Repository Setup
✅ Git repository detected
📋 Current branch: main
📝 Uncommitted changes: 2 files
```

**What happens:**
- Detects existing Git repository or initializes if needed
- Checks for uncommitted changes
- Prepares for safe branching workflow

#### Phase 2: Project Analysis
```
📊 Phase 2: Project Analysis
Running initial analysis to identify improvement opportunities...

📊 Analysis Results:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 Files analyzed: 145
🔍 Issues found: 23
📈 Current quality score: 72.5/100

🔧 Proposed Improvements:
   1. 🔄 Remove 3 code duplication groups 🟢
   2. ⚙️ Centralize 4 scattered configurations 🟡
   3. 🔗 Fix 2 circular dependencies 🟢
   4. ✨ Apply 6 quality improvements 🟢

💡 Recommendations:
   1. Consider extracting common validation logic
   2. Move hardcoded API endpoints to config
   3. Break circular dependency in auth modules
```

**User Decision Point:**
```
🤔 Do you want to apply these improvements to your project?
   This will create a new Git branch and apply the suggested fixes.
   Enter (y/n): 
```

#### Phase 3: Git Workflow Setup
```
🌿 Phase 3: Git Workflow Setup
Setting up Git branch for improvements...
✅ Created checkpoint commit: a1b2c3d4
✅ Created improvement branch: codemind-autofix-2025-08-25T14-30-22
```

**What happens:**
- Creates initial commit if there are uncommitted changes
- Creates timestamped improvement branch
- Switches to improvement branch for safe isolated changes

#### Phase 4: Applying Improvements
```
⚡ Phase 4: Applying Improvements
Applying fixes to your project...
✅ Fixed duplication in auth/validator.ts
✅ Centralized API endpoints to config/api.ts
✅ Resolved circular dependency in services/
✅ Applied code quality improvements
```

#### Phase 5: Testing Changes
```
🧪 Phase 5: Testing Changes
✅ Tests passed (12.3s)
   Command: npm test
   All test suites passed: 45 tests, 0 failures
```

**If tests fail:**
```
❌ Tests failed (8.7s)
   Command: npm test
   Exit code: 1
   Last output:
   │ FAIL src/auth.test.ts
   │ Expected 'isValid' to be true

⚠️  Tests failed. Do you want to continue anyway?
   You can fix the test failures manually or revert the changes.
   Enter (y/n): 
```

#### Phase 6: Final Review
```
📋 Phase 6: Final Review

📋 Summary of Changes:
━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Fixes applied: 18/23
📁 Files modified: 12
📝 Lines changed: 89
📈 Quality improvement: +17.5 points
🧪 Tests: ✅ Passed
🎯 Benefit score: 67
```

**Final User Decision:**
```
✅ Do you want to commit these improvements?
   This will create a commit with all the applied fixes. You can always revert later.
   Enter (y/n): 
```

#### Phase 7: Finalizing Changes
```
💾 Phase 7: Finalizing Changes
✅ Committed improvements: f5e6d7c8

🎉 Auto-Improvement Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Successfully applied 18 improvements
📁 Files modified: 12
📈 Quality score: 72.5 → 90.0 (+17.5 points)
🔗 Commit: f5e6d7c8
🌿 Branch: codemind-autofix-2025-08-25T14-30-22

🔀 To merge improvements to main:
   git checkout main
   git merge codemind-autofix-2025-08-25T14-30-22
⏱️  Total time: 45s
```

### Interactive Mode Options

```bash
# Full interactive mode
npx codemind auto-fix ./project --interactive

# Skip user prompts (auto-approve everything)
npx codemind auto-fix ./project --interactive --auto-approve

# Skip test execution
npx codemind auto-fix ./project --interactive --skip-tests

# Skip Git workflow (no branching)
npx codemind auto-fix ./project --interactive --skip-git

# Combine options for CI/CD
npx codemind auto-fix ./project --interactive --auto-approve --skip-tests
```

## Non-Interactive Mode

For automated environments or when you want direct control over the process.

### Basic Usage

```bash
# Apply all improvements
npx codemind auto-fix ./my-project

# Dry run to preview changes
npx codemind auto-fix ./my-project --dry-run

# Fix specific issue types
npx codemind auto-fix ./my-project --types duplicates centralization

# Set aggressiveness level
npx codemind auto-fix ./my-project --aggressiveness conservative
```

### All Available Options

```bash
npx codemind auto-fix <project-path> [options]

Options:
  -o, --output <path>           Output directory for reports
  --dry-run                     Analyze only, don't make changes
  --no-backup                   Skip creating backup
  --no-report                   Skip generating reports
  -t, --types <types...>        Fix types: duplicates, centralization, dependencies, quality
  -a, --aggressiveness <level>  conservative | moderate | aggressive
  -i, --interactive             Interactive mode with Git workflow
  --auto-approve                Auto-approve changes in interactive mode
  --skip-tests                  Skip running tests
  --skip-git                    Skip Git workflow
  -v, --verbose                 Verbose logging
```

## Configuration

### Project Configuration File

Create `codemind.config.json` in your project root:

```json
{
  "analysis": {
    "duplicates": {
      "threshold": 0.8,
      "minLines": 5,
      "includeComments": false
    },
    "centralization": {
      "minOccurrences": 2,
      "configTypes": ["api", "database", "styling"],
      "excludePatterns": ["*.test.*", "*.spec.*"]
    },
    "quality": {
      "targetScore": 90,
      "enabledRules": ["naming", "formatting", "structure"]
    }
  },
  "autoImprovement": {
    "aggressiveness": "moderate",
    "enableBackups": true,
    "skipPatterns": [
      "node_modules/**",
      "dist/**",
      "*.generated.*"
    ],
    "git": {
      "branchPrefix": "codemind-autofix",
      "createInitialCommit": true,
      "runTests": true
    }
  },
  "reporting": {
    "formats": ["json", "markdown"],
    "includeMetrics": true,
    "detailLevel": "full"
  }
}
```

### Fix Types

#### `duplicates`
- **Detects**: Exact, structural, semantic, and renamed code duplications
- **Fixes**: Extracts common code into shared functions, modules, or utilities
- **Example**: Common validation logic → shared validation utility

#### `centralization` 
- **Detects**: Hardcoded values scattered across the codebase
- **Fixes**: Creates config files, environment variables, or constants
- **Example**: API URLs in multiple files → centralized API configuration

#### `dependencies`
- **Detects**: Circular dependencies, unused imports, inefficient patterns
- **Fixes**: Refactors code to break cycles, removes unused imports
- **Example**: Module A imports B, B imports A → proper dependency hierarchy

#### `quality`
- **Detects**: Code style issues, naming inconsistencies, structural problems  
- **Fixes**: Applies consistent formatting, improves naming, enhances structure
- **Example**: Inconsistent variable names → unified naming convention

### Aggressiveness Levels

#### `conservative`
- **Risk**: Minimal
- **Changes**: Only safe, well-tested fixes
- **Use Case**: Production systems, critical code

#### `moderate` (Default)
- **Risk**: Low to Medium  
- **Changes**: Most fixes with reasonable confidence
- **Use Case**: Regular development, improvement cycles

#### `aggressive`
- **Risk**: Medium to High
- **Changes**: All possible fixes, including speculative ones
- **Use Case**: Legacy modernization, experimental improvements

## Safety Features

### Automatic Backups
```bash
# Backup created at: project.codemind-backup-2025-08-25T14-30-22
# Restore with: rm -rf project && mv project.codemind-backup-2025-08-25T14-30-22 project
```

### Dry Run Analysis
```bash
# See all changes without applying them
npx codemind auto-fix ./project --dry-run

# Output shows what would be changed:
🔍 DRY RUN MODE - No changes will be made to your project

📊 Would apply 18 improvements:
✨ Extract duplicate validation logic (3 files affected)
⚙️ Centralize API configuration (5 files affected)  
🔗 Break circular dependency (2 files affected)
```

### Git Branching (Interactive Mode)
- All changes applied in isolated branch
- Easy rollback: `git branch -D codemind-autofix-*`
- Safe testing environment
- Clear merge path back to main

## Best Practices

### 🚀 Getting Started

1. **Start with dry run**:
   ```bash
   npx codemind auto-fix ./project --dry-run --verbose
   ```

2. **Use interactive mode**:
   ```bash
   npx codemind auto-fix ./project --interactive
   ```

3. **Begin conservatively**:
   ```bash
   npx codemind auto-fix ./project --aggressiveness conservative
   ```

### 🔄 Regular Maintenance

```bash
# Weekly quality check
npx codemind auto-fix . --interactive --types quality

# Monthly comprehensive improvement  
npx codemind auto-fix . --interactive --aggressiveness moderate

# Pre-release cleanup
npx codemind auto-fix . --interactive --aggressiveness conservative --dry-run
```

### 🏗️ CI/CD Integration

```yaml
# GitHub Actions workflow
name: CodeMind Quality Check
on: [pull_request]

jobs:
  quality-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx codemind auto-fix . --dry-run --no-backup
```

### 📊 Team Workflows

```bash
# Before code review
npx codemind auto-fix ./feature-branch --dry-run --output ./pr-reports

# New team member onboarding
npx codemind auto-fix . --types quality --aggressiveness moderate

# Legacy code modernization
npx codemind auto-fix ./legacy --interactive --aggressiveness aggressive
```

## Troubleshooting

### Common Issues

**❌ "No Git repository found"**
```bash
# Initialize Git first
git init && git add . && git commit -m "Initial commit"
npx codemind auto-fix . --interactive
```

**❌ "Tests failed during improvement"**
```bash
# Skip tests temporarily or fix them first
npx codemind auto-fix . --interactive --skip-tests

# Or run without Git workflow
npx codemind auto-fix . --skip-git
```

**❌ "Too many changes proposed"**
```bash
# Use conservative mode first
npx codemind auto-fix . --aggressiveness conservative

# Apply fixes incrementally
npx codemind auto-fix . --types duplicates
npx codemind auto-fix . --types centralization
```

**❌ "Backup creation failed"**
```bash
# Check disk space and permissions
df -h
ls -la ..

# Skip backup if using Git
npx codemind auto-fix . --no-backup
```

### Performance Optimization

**Large Projects:**
```bash
# Exclude unnecessary directories
npx codemind auto-fix . --exclude "node_modules/**,dist/**,coverage/**"

# Process specific directories
npx codemind auto-fix ./src --types quality
```

**Memory Issues:**
```bash
# Run specific fix types separately
npx codemind auto-fix . --types duplicates
npx codemind auto-fix . --types centralization
```

### Verbose Debugging

```bash
# Get detailed logs
npx codemind auto-fix . --verbose --dry-run

# Output includes:
🔧 Analyzing file: src/components/UserCard.tsx
🔍 Found duplication: validateEmail (3 occurrences)
📋 Similarity score: 0.95
⚡ Proposed fix: Extract to utils/validation.ts
```

## Advanced Usage

### Custom Configuration Profiles

```json
// codemind.profiles.json
{
  "strict": {
    "aggressiveness": "conservative", 
    "quality": { "targetScore": 95 }
  },
  "modernization": {
    "aggressiveness": "aggressive",
    "types": ["all"]
  },
  "maintenance": {
    "aggressiveness": "moderate",
    "types": ["duplicates", "quality"]
  }
}
```

```bash
# Use profile
npx codemind auto-fix . --profile strict
```

### Integration with Other Tools

```bash
# Combine with linting
npx eslint . --fix
npx codemind auto-fix . --types quality

# Pre-commit hook
npx codemind auto-fix . --dry-run --types quality || exit 1
```

## 🔗 Related Documentation

- **[Getting Started Guide](getting-started.md)** - First steps with CodeMind
- **[Configuration Guide](configuration.md)** - Detailed configuration options
- **[CLI Reference](../api-reference/cli.md)** - Complete command reference
- **[Feature Documentation](../features/auto-improvement.md)** - Technical feature details
- **[Troubleshooting](../troubleshooting/common-issues.md)** - Common issues and solutions

---

[← Getting Started](getting-started.md) | [Configuration Guide →](configuration.md)