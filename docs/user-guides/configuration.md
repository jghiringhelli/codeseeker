# Configuration Guide

This comprehensive guide covers all configuration options for CodeMind, from basic project setup to advanced customization scenarios.

## 📋 Table of Contents

1. [Configuration File Overview](#configuration-file-overview)
2. [Analysis Configuration](#analysis-configuration)
3. [Auto-Improvement Settings](#auto-improvement-settings)
4. [Environment Variables](#environment-variables)
5. [Advanced Configuration](#advanced-configuration)
6. [Configuration Profiles](#configuration-profiles)
7. [Best Practices](#best-practices)

## Configuration File Overview

CodeMind uses JSON configuration files to customize behavior. The configuration is loaded in this priority order:

1. Command-line arguments (`--config ./custom.json`)
2. Project-level configuration (`./codemind.config.json`)
3. User-level configuration (`~/.config/codemind/config.json`)
4. Global defaults

### Basic Configuration File

Create `codemind.config.json` in your project root:

```json
{
  "version": "0.1.0",
  "analysis": {
    "duplicates": {
      "threshold": 0.8,
      "minLines": 5
    },
    "centralization": {
      "minOccurrences": 2
    }
  },
  "autoImprovement": {
    "aggressiveness": "moderate",
    "enableBackups": true
  }
}
```

## Analysis Configuration

### Duplication Detection

Configure how CodeMind identifies code duplications:

```json
{
  "analysis": {
    "duplicates": {
      "threshold": 0.8,
      "minLines": 5,
      "minTokens": 50,
      "includeComments": false,
      "includeWhitespace": false,
      "excludePatterns": [
        "*.test.*",
        "*.spec.*", 
        "*.generated.*"
      ],
      "types": ["exact", "structural", "semantic", "renamed"],
      "semanticThreshold": 0.7,
      "structuralThreshold": 0.85
    }
  }
}
```

**Options:**
- `threshold` (0.0-1.0): Overall similarity threshold
- `minLines`: Minimum lines for duplication detection
- `minTokens`: Minimum tokens for semantic analysis
- `includeComments`: Include comments in analysis
- `includeWhitespace`: Consider whitespace in comparison
- `excludePatterns`: File patterns to ignore
- `types`: Types of duplications to detect
- `semanticThreshold`: Threshold for semantic duplicates
- `structuralThreshold`: Threshold for structural duplicates

### Centralization Analysis

Configure configuration centralization detection:

```json
{
  "analysis": {
    "centralization": {
      "minOccurrences": 2,
      "configTypes": [
        "api",
        "database", 
        "styling",
        "environment",
        "constants"
      ],
      "patterns": {
        "api": [
          "https?://[\\w.-]+",
          "api[._]?base[._]?url",
          "endpoint"
        ],
        "database": [
          "connection[._]?string",
          "db[._]?host",
          "mongodb://",
          "postgresql://"
        ]
      },
      "excludePatterns": [
        "node_modules/**",
        "*.test.*",
        "test/**"
      ],
      "outputFormat": "centralized-config",
      "createEnvFile": true
    }
  }
}
```

### Quality Analysis

Configure code quality assessment:

```json
{
  "analysis": {
    "quality": {
      "targetScore": 90,
      "enabledRules": [
        "naming",
        "formatting", 
        "structure",
        "complexity",
        "documentation"
      ],
      "complexity": {
        "maxCyclomaticComplexity": 10,
        "maxNestingDepth": 4,
        "maxFunctionLength": 50
      },
      "naming": {
        "enforceConsistency": true,
        "conventions": {
          "variables": "camelCase",
          "functions": "camelCase",
          "classes": "PascalCase",
          "constants": "UPPER_CASE"
        }
      }
    }
  }
}
```

### Dependency Analysis

Configure dependency and import analysis:

```json
{
  "analysis": {
    "dependencies": {
      "detectCircular": true,
      "detectUnused": true,
      "detectMissing": true,
      "analyzeDepth": 5,
      "excludePatterns": [
        "node_modules/**",
        "vendor/**"
      ],
      "circularDependencyStrategy": "break-with-interface"
    }
  }
}
```

## Auto-Improvement Settings

### Basic Auto-Improvement

```json
{
  "autoImprovement": {
    "aggressiveness": "moderate",
    "enableBackups": true,
    "skipPatterns": [
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "*.min.*",
      "*.generated.*"
    ],
    "enabledFixTypes": [
      "duplicates",
      "centralization", 
      "dependencies",
      "quality"
    ],
    "dryRunByDefault": false
  }
}
```

### Git Workflow Configuration

```json
{
  "autoImprovement": {
    "git": {
      "branchPrefix": "codemind-autofix",
      "createInitialCommit": true,
      "runTests": true,
      "testCommand": "npm test",
      "buildCommand": "npm run build",
      "commitMessageTemplate": "🤖 CodeMind: {description}\n\n{details}",
      "mergeStrategy": "merge-commit",
      "deleteBranchAfterMerge": false
    }
  }
}
```

### Interactive Mode Settings

```json
{
  "autoImprovement": {
    "interactive": {
      "confirmBeforeChanges": true,
      "confirmBeforeCommit": true,
      "showDetailedDiff": true,
      "pauseOnTestFailure": true,
      "allowSkipTests": true,
      "displayProgress": true,
      "verboseOutput": false
    }
  }
}
```

### Fix Type Specific Configuration

```json
{
  "autoImprovement": {
    "fixTypes": {
      "duplicates": {
        "extractionStrategy": "function",
        "namingConvention": "descriptive",
        "createUtilityFiles": true,
        "utilityFileLocation": "./src/utils"
      },
      "centralization": {
        "configFileName": "app.config.js",
        "createEnvExample": true,
        "updateImports": true,
        "consolidationStrategy": "by-type"
      },
      "dependencies": {
        "removeUnusedImports": true,
        "optimizeImportOrder": true,
        "groupImports": true,
        "breakCircularDependencies": true
      },
      "quality": {
        "applyFormatting": true,
        "enforceNamingConventions": true,
        "addMissingDocumentation": false,
        "restructureComplexFunctions": true
      }
    }
  }
}
```

## Environment Variables

### Core Environment Variables

```bash
# Configuration
CODEMIND_CONFIG_PATH=/path/to/config/codemind.config.json
CODEMIND_LOG_LEVEL=info # debug, info, warn, error
CODEMIND_DB_PATH=/path/to/database

# API Configuration
CODEMIND_API_KEY=your-api-key-here
CODEMIND_API_BASE=https://api.codemind.dev
CODEMIND_API_TIMEOUT=30000

# Feature Flags
CODEMIND_ENABLE_SECURITY=true
CODEMIND_ENABLE_PERFORMANCE=false
CODEMIND_ENABLE_KNOWLEDGE_GRAPH=true
CODEMIND_ENABLE_AI_ORCHESTRATION=true

# Performance Settings
CODEMIND_MAX_WORKERS=4
CODEMIND_MEMORY_LIMIT=2048
CODEMIND_ANALYSIS_TIMEOUT=300000

# Development Settings
CODEMIND_DEBUG=false
CODEMIND_VERBOSE=false
CODEMIND_DEV_MODE=false
```

### Project-Specific Variables

```bash
# Project Configuration
CODEMIND_PROJECT_TYPE=web-app # web-app, library, api, mobile
CODEMIND_PROJECT_LANGUAGE=typescript # javascript, typescript, python
CODEMIND_PROJECT_FRAMEWORK=react # react, vue, angular, express

# Analysis Overrides
CODEMIND_SKIP_TESTS=false
CODEMIND_SKIP_NODE_MODULES=true
CODEMIND_MAX_FILE_SIZE=1048576 # 1MB
CODEMIND_MAX_FILES=10000
```

## Advanced Configuration

### Ignore Files

Create `.codemindignore` to exclude files and directories:

```gitignore
# Dependencies
node_modules/
vendor/
.pnp.*

# Build outputs
dist/
build/
out/
.next/

# Testing
coverage/
.nyc_output/
test-results/

# Generated files
*.generated.*
*.min.*
*.bundle.*

# IDE and OS
.vscode/
.idea/
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Temporary files
tmp/
temp/
.tmp/
```

### Language-Specific Configuration

#### TypeScript Projects

```json
{
  "analysis": {
    "typescript": {
      "tsconfigPath": "./tsconfig.json",
      "strictMode": true,
      "checkTypes": true,
      "analyzeDecorators": true,
      "analyzeGenerics": true
    }
  },
  "autoImprovement": {
    "typescript": {
      "addMissingTypes": true,
      "enforceStrictMode": false,
      "convertToModernSyntax": true,
      "optimizeImports": true
    }
  }
}
```

#### React Projects

```json
{
  "analysis": {
    "react": {
      "version": "18",
      "analyzeHooks": true,
      "analyzeComponents": true,
      "detectUnusedProps": true,
      "checkAccessibility": true
    }
  },
  "autoImprovement": {
    "react": {
      "convertToFunctionalComponents": true,
      "optimizeRerenders": true,
      "extractCustomHooks": true,
      "addPropTypes": false
    }
  }
}
```

#### Node.js Projects

```json
{
  "analysis": {
    "nodejs": {
      "packageJsonPath": "./package.json",
      "analyzeScripts": true,
      "checkSecurity": true,
      "analyzeDependencies": true
    }
  },
  "autoImprovement": {
    "nodejs": {
      "updateDependencies": false,
      "addMissingScripts": true,
      "optimizePackageJson": true,
      "addSecurityScripts": true
    }
  }
}
```

### Plugin Configuration

```json
{
  "plugins": [
    {
      "name": "eslint-integration",
      "enabled": true,
      "options": {
        "configPath": ".eslintrc.js",
        "fixOnSave": true
      }
    },
    {
      "name": "prettier-integration", 
      "enabled": true,
      "options": {
        "configPath": ".prettierrc",
        "formatOnFix": true
      }
    },
    {
      "name": "jest-integration",
      "enabled": true,
      "options": {
        "configPath": "jest.config.js",
        "runBeforeCommit": true
      }
    }
  ]
}
```

## Configuration Profiles

Create multiple configuration profiles for different scenarios:

### `codemind.profiles.json`

```json
{
  "strict": {
    "aggressiveness": "conservative",
    "analysis": {
      "quality": {
        "targetScore": 95,
        "enabledRules": ["all"]
      },
      "duplicates": {
        "threshold": 0.9
      }
    },
    "autoImprovement": {
      "enableBackups": true,
      "git": {
        "runTests": true,
        "confirmBeforeCommit": true
      }
    }
  },
  "development": {
    "aggressiveness": "moderate",
    "analysis": {
      "quality": {
        "targetScore": 80
      },
      "duplicates": {
        "threshold": 0.8
      }
    },
    "autoImprovement": {
      "enableBackups": false,
      "interactive": {
        "confirmBeforeChanges": false
      }
    }
  },
  "legacy-modernization": {
    "aggressiveness": "aggressive",
    "analysis": {
      "duplicates": {
        "threshold": 0.7,
        "types": ["all"]
      },
      "centralization": {
        "minOccurrences": 1
      }
    },
    "autoImprovement": {
      "enabledFixTypes": ["all"],
      "git": {
        "createInitialCommit": true
      }
    }
  },
  "ci-cd": {
    "aggressiveness": "conservative",
    "analysis": {
      "quality": {
        "targetScore": 85
      }
    },
    "autoImprovement": {
      "dryRunByDefault": true,
      "enableBackups": false,
      "interactive": {
        "confirmBeforeChanges": false,
        "confirmBeforeCommit": false
      }
    },
    "reporting": {
      "formats": ["json", "junit"],
      "outputPath": "./reports"
    }
  }
}
```

### Using Profiles

```bash
# Use specific profile
npx codemind auto-fix . --profile strict

# Combine profile with overrides
npx codemind auto-fix . --profile development --aggressiveness aggressive

# List available profiles
npx codemind config profiles --list
```

## Best Practices

### Configuration Organization

1. **Start Simple**: Begin with basic configuration and gradually add complexity
2. **Use Profiles**: Create profiles for different scenarios (development, CI, production)
3. **Version Control**: Commit `codemind.config.json` to share team settings
4. **Document Changes**: Comment configuration files with reasoning

### Performance Optimization

```json
{
  "performance": {
    "maxWorkers": 4,
    "memoryLimit": 2048,
    "analysisTimeout": 300000,
    "excludeLargeFiles": true,
    "maxFileSize": 1048576,
    "cacheAnalysis": true,
    "cachePath": "./node_modules/.cache/codemind"
  }
}
```

### Team Configuration

```json
{
  "team": {
    "enforceConsistentConfig": true,
    "sharedConfigVersion": "1.0.0",
    "allowLocalOverrides": ["aggressiveness", "interactive"],
    "requireApproval": ["aggressive"],
    "notificationWebhook": "https://hooks.slack.com/your-webhook"
  }
}
```

### Security Configuration

```json
{
  "security": {
    "scanForSecrets": true,
    "excludeSecretPatterns": [
      "test-api-key",
      "localhost"
    ],
    "secretsThreshold": 0.9,
    "reportSecrets": false,
    "encryptSensitiveData": true
  }
}
```

## Configuration Validation

### Schema Validation

CodeMind automatically validates configuration files against a JSON schema. You can also validate manually:

```bash
# Validate configuration file
npx codemind config validate ./codemind.config.json

# Check current configuration
npx codemind config show

# Show default configuration
npx codemind config defaults

# Generate configuration template
npx codemind config init --profile development
```

### Common Configuration Errors

**❌ Invalid JSON syntax**
- Use a JSON validator or IDE with JSON support
- Check for trailing commas, missing quotes

**❌ Invalid threshold values**
- Thresholds must be between 0.0 and 1.0
- Use 0.8 instead of 80 for 80%

**❌ Invalid file patterns**
- Use glob patterns: `*.js`, `**/*.test.js`
- Escape special characters in regex patterns

**❌ Conflicting settings**
- Ensure `enableBackups: true` when `dryRunByDefault: false`
- Don't disable all fix types

## 🔗 Related Documentation

- **[Getting Started Guide](getting-started.md)** - Basic setup and first run
- **[Auto-Improvement Guide](auto-improvement.md)** - Using auto-improvement features
- **[CLI Reference](../api-reference/cli.md)** - Command-line options
- **[Troubleshooting](../troubleshooting/configuration-issues.md)** - Configuration problem solving

---

[← Installation Guide](installation.md) | [Auto-Improvement Guide →](auto-improvement.md)