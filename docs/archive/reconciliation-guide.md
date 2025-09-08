# Database Reconciliation System

The reconciliation system ensures that the CodeMind database stays synchronized with your actual codebase, especially after events like branch merges, file moves, or when the automated update system falls behind.

## When to Use Reconciliation

### Scenarios requiring reconciliation:

1. **After Branch Merges**: When you merge branches, the database may contain outdated references to moved or deleted files
2. **Manual File Operations**: When files are moved/renamed/deleted outside of tracked operations
3. **System Interruptions**: When the CLI crashes or is interrupted during analysis
4. **Inconsistent State**: When dashboard shows missing or incorrect data
5. **Fresh Environment Setup**: When setting up CodeMind on an existing codebase

## Available Commands

### Quick Start

```bash
# Basic incremental reconciliation (most common)
node dist/cli/codemind.js reconcile

# Full reconciliation (after major changes)
node dist/cli/codemind.js reconcile --scope full

# Preview changes without applying them
node dist/cli/codemind.js reconcile --dry-run --verbose
```

### Command Options

```bash
node dist/cli/codemind.js reconcile [project-path] [options]

Options:
  -p, --project-id <id>     Project ID (auto-detected if not provided)
  -s, --scope <scope>       Reconciliation scope: full, incremental, selective (default: incremental)
  -t, --tools <tools>       Comma-separated list of specific tools (for selective scope)
  -h, --hours <hours>       Hours to look back for incremental reconciliation (default: 24)
  -d, --dry-run            Preview changes without applying them
  -v, --verbose            Verbose output showing detailed actions
  --help                   Show help for reconcile command
```

## Reconciliation Scopes

### 1. Incremental Reconciliation (Default)
**Use case**: Daily maintenance, catching up after small changes

```bash
node dist/cli/codemind.js reconcile --scope incremental --hours 48
```

- Checks files modified in the last N hours (default: 24)
- Fastest option for regular maintenance
- Good for automated cron jobs

### 2. Full Reconciliation
**Use case**: After major refactoring, branch merges, or setup on existing projects

```bash
node dist/cli/codemind.js reconcile --scope full
```

- Analyzes entire codebase
- Rebuilds all tool data from scratch
- Takes longer but ensures complete accuracy
- Recommended after significant codebase changes

### 3. Selective Reconciliation
**Use case**: When you know specific tools need updates

```bash
node dist/cli/codemind.js reconcile --scope selective --tools "tree-navigation,solid-analysis,compilation"
```

- Only processes specified tools
- Fastest when you know exactly what needs updating
- Good for debugging specific tool issues

## Common Use Cases

### After Git Merge
```bash
# Preview what would change
node dist/cli/codemind.js reconcile --scope full --dry-run --verbose

# Apply the changes
node dist/cli/codemind.js reconcile --scope full
```

### Weekly Maintenance
```bash
# Quick check for any inconsistencies in the past week
node dist/cli/codemind.js reconcile --hours 168  # 7 days
```

### New Team Member Setup
```bash
# Full analysis of existing codebase
node dist/cli/codemind.js reconcile --scope full --project-id $(cat .codemind-project-id)
```

### Debugging Specific Tool
```bash
# Only reconcile tree navigation data
node dist/cli/codemind.js reconcile --scope selective --tools "tree-navigation" --verbose
```

## Understanding Output

### Summary Information
```
📊 Reconciliation Results:
   Project ID: 6e305831-2335-448d-b750-ef2b5498c487
   Scope: incremental
   Duration: 2547ms
   Dry Run: No

📈 Summary:
   Files Scanned: 117
   Tools Processed: 6
   Discrepancies Found: 23
   Updates Applied: 18
   Errors Encountered: 0
```

### Detailed Actions (with --verbose)
```
🔍 Detailed Actions:
   ✅ tree-navigation: Successfully reanalyzed
      File: C:/workspace/claude/CodeMind/src/new-feature.ts
      Records: 1
   🔄 solid-analysis: Successfully updated
      File: C:/workspace/claude/CodeMind/src/refactored-module.ts
      Records: 3
   🗑️ compilation: Deleted orphaned data
      File: C:/workspace/claude/CodeMind/src/deleted-file.ts
      Records: 1
```

## Integration with CI/CD

### Automated Reconciliation
Add to your CI/CD pipeline after deployments:

```yaml
# .github/workflows/reconciliation.yml
name: Database Reconciliation
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM

jobs:
  reconcile:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Reconcile CodeMind Database
        run: |
          npm install
          npm run build
          node dist/cli/codemind.js reconcile --scope incremental
```

### Pre-merge Checks
```bash
# Add to pre-merge hooks
node dist/cli/codemind.js reconcile --dry-run --verbose
if [ $? -ne 0 ]; then
  echo "Database reconciliation found issues. Please run reconciliation manually."
  exit 1
fi
```

## Troubleshooting

### Common Issues

1. **"Could not determine project ID"**
   ```bash
   # Solution: Provide project ID explicitly
   node dist/cli/codemind.js reconcile --project-id your-project-id
   ```

2. **"Tool not found in registry"**
   ```bash
   # Check available tools first
   node dist/cli/codemind.js tools
   
   # Then use correct tool names
   node dist/cli/codemind.js reconcile --tools "tree-navigation,solid-analysis"
   ```

3. **Database connection errors**
   ```bash
   # Ensure services are running
   docker ps | grep codemind
   
   # Start services if needed
   docker-compose up -d
   ```

### Performance Tips

1. **Use incremental for regular maintenance**: Don't run full reconciliation daily
2. **Use selective when debugging**: Target specific tools to save time
3. **Use dry-run first**: Always preview major changes before applying
4. **Schedule during off-hours**: Full reconciliation can be resource-intensive

### Logging and Monitoring

```bash
# Enable verbose logging
export CODEMIND_LOG_LEVEL=debug
node dist/cli/codemind.js reconcile --verbose

# Log to file for later analysis
node dist/cli/codemind.js reconcile --verbose > reconciliation.log 2>&1
```

## API Integration

### Programmatic Usage
```typescript
import { ReconciliationHelpers } from '../shared/reconciliation-system';

// Full reconciliation
const result = await ReconciliationHelpers.fullReconciliation(
  '/path/to/project',
  'project-id',
  false  // dry run = false
);

// Incremental reconciliation
const result = await ReconciliationHelpers.incrementalReconciliation(
  '/path/to/project',
  'project-id',
  48,    // hours
  true   // dry run = true
);

// Selective reconciliation
const result = await ReconciliationHelpers.selectiveReconciliation(
  '/path/to/project',
  'project-id',
  ['tree-navigation', 'solid-analysis'],
  false  // dry run = false
);
```

This reconciliation system ensures your CodeMind database stays accurate and useful, providing reliable data for analysis and decision-making.