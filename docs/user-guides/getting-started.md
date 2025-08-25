# Getting Started with CodeMind

This guide will walk you through your first CodeMind experience, from installation to running your first auto-improvement workflow.

## 📋 Prerequisites

Before you begin, ensure you have:
- **Node.js 18+** installed ([Download](https://nodejs.org/))
- **Git** installed and configured ([Download](https://git-scm.com/))
- A code project to analyze (TypeScript/JavaScript preferred)

## 🚀 Quick Installation

```bash
# Install CodeMind globally
npm install -g codemind

# Or install locally in your project
npm install --save-dev codemind

# Verify installation
npx codemind --version
```

## 🔍 Your First Analysis

Let's start with a basic project analysis:

```bash
# Navigate to your project
cd /path/to/your/project

# Run a quick analysis
npx codemind analyze --project . --quick

# View duplication analysis
npx codemind find-duplicates --project . --output table
```

**Expected Output:**
```
🔍 Project Analysis Complete
📊 Summary:
   Files analyzed: 45
   Duplications found: 3 groups
   Configuration issues: 2 opportunities
   Quality score: 78/100
```

## 🔧 Interactive Auto-Improvement

Now let's try CodeMind's signature feature - interactive auto-improvement:

```bash
# Run interactive auto-improvement (recommended for first use)
npx codemind auto-fix . --interactive --skip-tests
```

This will start the **7-phase interactive workflow**:

### Phase 1: Git Repository Setup
```
🔄 Phase 1: Git Repository Setup
✅ Git repository detected
📋 Current branch: main
📝 Uncommitted changes: 2 files
```

### Phase 2: Project Analysis  
```
📊 Phase 2: Project Analysis
Running initial analysis to identify improvement opportunities...

📊 Analysis Results:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 Files analyzed: 45
🔍 Issues found: 12
📈 Current quality score: 78.5/100

🔧 Proposed Improvements:
   1. 🔄 Remove 3 code duplication groups 🟢
   2. ⚙️ Centralize 4 scattered configurations 🟡
   3. 🔗 Fix 2 circular dependencies 🟢
```

### Phase 3: Git Workflow Setup
```
🤔 Do you want to apply these improvements to your project?
   This will create a new Git branch and apply the suggested fixes.
   Enter (y/n): y

🌿 Phase 3: Git Workflow Setup
Setting up Git branch for improvements...
✅ Created checkpoint commit: a1b2c3d4
✅ Created improvement branch: codemind-autofix-2025-08-25T14-30-22
```

### Phase 4-7: Applying & Finalizing
The workflow will continue through applying improvements, testing (if enabled), review, and finalization.

## 📊 Understanding Results

After completion, you'll see a comprehensive summary:

```
🎉 Auto-Improvement Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Successfully applied 8 improvements
📁 Files modified: 12
📈 Quality score: 78.5 → 87.2 (+8.7 points)
🔗 Commit: f5e6d7c8
🌿 Branch: codemind-autofix-2025-08-25T14-30-22

🔀 To merge improvements to main:
   git checkout main
   git merge codemind-autofix-2025-08-25T14-30-22
```

## 🎯 Next Steps

### Explore More Features

```bash
# Analyze knowledge graph relationships
npx codemind knowledge analyze --project .

# Search for semantic code patterns
npx codemind search "authentication logic" --semantic

# Generate dependency tree
npx codemind tree --project . --show-deps
```

### Configure for Your Project

Create a `codemind.config.json` file:

```json
{
  "analysis": {
    "duplicates": { "threshold": 0.8 },
    "centralization": { "minOccurrences": 2 },
    "quality": { "targetScore": 90 }
  },
  "autoImprovement": {
    "aggressiveness": "moderate",
    "skipPatterns": ["*.test.ts", "node_modules/**"],
    "enableBackups": true
  }
}
```

### Set Up Regular Improvements

Add to your `package.json` scripts:

```json
{
  "scripts": {
    "codemind:analyze": "codemind analyze --project .",
    "codemind:improve": "codemind auto-fix . --interactive",
    "codemind:ci": "codemind auto-fix . --dry-run --no-report"
  }
}
```

## 🔗 What's Next?

- **[Auto-Improvement Guide](auto-improvement.md)** - Deep dive into improvement workflows
- **[Configuration Guide](configuration.md)** - Customize CodeMind for your needs  
- **[Feature Documentation](../features/README.md)** - Explore all available features
- **[CLI Reference](../api-reference/cli.md)** - Complete command reference

## ❓ Common Questions

**Q: Is it safe to run on production code?**  
A: Yes! CodeMind uses Git branching and dry-run analysis. Always review changes before merging.

**Q: What languages are supported?**  
A: TypeScript and JavaScript are fully supported. Python and other languages have basic support.

**Q: How do I revert changes?**  
A: Simply delete the improvement branch: `git branch -D codemind-autofix-*`

## 🐛 Issues?

If you encounter any issues:
1. Check the [Troubleshooting Guide](../troubleshooting/common-issues.md)
2. Run with `--verbose` flag for detailed logs
3. [Report bugs](https://github.com/your-org/codemind/issues) with full error messages

---

[← User Guides](README.md) | [Auto-Improvement Guide →](auto-improvement.md)