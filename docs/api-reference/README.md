# API Reference

Complete reference documentation for CodeMind's CLI, REST API, and programmatic interfaces.

## 📚 Reference Categories

### [CLI Commands](cli.md)
**Complete command-line interface reference**
- All CLI commands with detailed options
- Usage examples and common patterns
- Exit codes and error handling
- Output formats and configuration

### [REST API](rest-api.md)  
**HTTP API endpoints and specifications**
- Complete endpoint documentation
- Request/response schemas
- Authentication and authorization
- Rate limiting and error handling

### [TypeScript API](typescript-api.md)
**Programmatic API for developers**
- Class and interface definitions
- Usage examples and patterns
- Error handling and async operations
- Type definitions and generics

### [Configuration Schema](configuration.md)
**Complete configuration reference**
- Configuration file formats
- Environment variables
- Schema validation
- Default values and overrides

## 🚀 Quick Reference

### Most Common Commands

```bash
# Auto-improvement (recommended starting point)
npx codemind auto-fix ./project --interactive

# Project analysis
npx codemind analyze --project . --full

# Find code duplications
npx codemind find-duplicates --semantic --suggest-refactor

# Knowledge graph operations
npx codemind knowledge analyze --project .
npx codemind knowledge query "authentication logic"
```

### HTTP API Endpoints

```bash
# Analysis endpoints
GET    /api/v1/analyze/{projectId}
POST   /api/v1/analyze
GET    /api/v1/analyze/{projectId}/duplicates

# Auto-improvement endpoints  
POST   /api/v1/auto-fix
GET    /api/v1/auto-fix/{jobId}/status
POST   /api/v1/auto-fix/{jobId}/approve

# Knowledge graph endpoints
GET    /api/v1/knowledge/{projectId}
POST   /api/v1/knowledge/query
GET    /api/v1/knowledge/{projectId}/insights
```

### TypeScript API Example

```typescript
import { CodeMindClient, AutoFixMode } from 'codemind';

const client = new CodeMindClient({
  projectPath: './my-project',
  config: { aggressiveness: 'moderate' }
});

// Run auto-improvement
const result = await client.autoFix({
  mode: AutoFixMode.INTERACTIVE,
  types: ['duplicates', 'centralization'],
  dryRun: false
});

console.log(`Applied ${result.fixes.length} improvements`);
```

## 📋 API Categories

### Analysis APIs
| Category | CLI | REST | TypeScript |
|----------|-----|------|------------|
| Project Analysis | `analyze` | `/analyze` | `client.analyze()` |  
| Duplication Detection | `find-duplicates` | `/duplicates` | `client.findDuplicates()` |
| Quality Metrics | `quality` | `/quality` | `client.getQualityMetrics()` |
| Dependency Analysis | `tree` | `/dependencies` | `client.analyzeDependencies()` |

### Improvement APIs
| Category | CLI | REST | TypeScript |
|----------|-----|------|------------|
| Auto-Improvement | `auto-fix` | `/auto-fix` | `client.autoFix()` |
| Configuration Migration | `centralize-config` | `/centralize` | `client.centralizeConfig()` |
| Refactoring | `refactor` | `/refactor` | `client.refactor()` |

### Knowledge APIs
| Category | CLI | REST | TypeScript |
|----------|-----|------|------------|
| Graph Analysis | `knowledge analyze` | `/knowledge` | `client.knowledge.analyze()` |
| Semantic Search | `knowledge query` | `/knowledge/search` | `client.knowledge.search()` |
| Insights | `knowledge insights` | `/knowledge/insights` | `client.knowledge.getInsights()` |

## 🔧 Configuration Reference

### CLI Configuration
```bash
# Global configuration
export CODEMIND_CONFIG_PATH=/path/to/config
export CODEMIND_LOG_LEVEL=debug

# Per-command configuration  
npx codemind --config ./codemind.config.json analyze
```

### Project Configuration
```json
{
  "version": "0.1.0",
  "analysis": {
    "duplicates": {
      "threshold": 0.8,
      "minLines": 5
    },
    "centralization": {
      "minOccurrences": 2,
      "configTypes": ["api", "database"]
    }
  },
  "autoImprovement": {
    "aggressiveness": "moderate",
    "enableBackups": true
  }
}
```

### Environment Variables
```bash
# Core settings
CODEMIND_DB_PATH=/path/to/database
CODEMIND_API_BASE=https://api.codemind.dev
CODEMIND_LOG_LEVEL=info

# Feature flags
CODEMIND_ENABLE_SECURITY=true  
CODEMIND_ENABLE_PERFORMANCE=false

# API settings
CODEMIND_API_KEY=your-api-key
CODEMIND_API_TIMEOUT=30000
```

## 🎯 Usage Patterns

### Batch Operations
```bash
# Process multiple projects
for project in projects/*/; do
  npx codemind auto-fix "$project" --dry-run
done

# Multiple fix types
npx codemind auto-fix . --types duplicates,centralization,quality
```

### CI/CD Integration
```bash
# Quality gate check
npx codemind analyze . --output json | jq '.qualityScore >= 80'

# Auto-improvement in CI
npx codemind auto-fix . --dry-run --no-backup --output ./reports
```

### Programmatic Usage
```typescript
// Batch processing
const projects = await client.listProjects();
for (const project of projects) {
  const analysis = await client.analyze(project.path);
  if (analysis.qualityScore < 80) {
    await client.autoFix(project.path, { aggressiveness: 'conservative' });
  }
}

// Custom workflows
const duplicates = await client.findDuplicates();
const filtered = duplicates.filter(d => d.similarity > 0.9);
await client.refactor(filtered);
```

## 📊 Response Formats

### Standard Response Structure
```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T;
  metadata: {
    executionTime: number;
    version: string;
    timestamp: string;
  };
  errors?: ApiError[];
}
```

### Analysis Response Example
```json
{
  "success": true,
  "data": {
    "summary": {
      "filesAnalyzed": 145,
      "issuesFound": 23,
      "qualityScore": 78.5
    },
    "fixes": [...],
    "recommendations": [...]
  },
  "metadata": {
    "executionTime": 2340,
    "version": "0.1.0",
    "timestamp": "2025-08-25T14:30:22Z"
  }
}
```

## 🔒 Security and Authentication

### API Key Authentication
```bash
# CLI with API key
export CODEMIND_API_KEY=cm_1234567890abcdef
npx codemind analyze --cloud

# HTTP headers
curl -H "Authorization: Bearer cm_1234567890abcdef" \
     https://api.codemind.dev/v1/analyze
```

### Rate Limiting
- **Free Tier**: 100 requests/hour
- **Pro Tier**: 1000 requests/hour  
- **Enterprise**: Custom limits

## 🐛 Error Handling

### Common Error Codes
| Code | Description | Resolution |
|------|-------------|------------|
| `E001` | Project not found | Check project path |
| `E002` | Invalid configuration | Validate config schema |  
| `E003` | Analysis timeout | Increase timeout or reduce scope |
| `E004` | Insufficient permissions | Check file permissions |
| `E005` | Git repository required | Initialize Git repository |

### Error Response Format
```json
{
  "success": false,
  "errors": [
    {
      "code": "E001",
      "message": "Project directory not found",
      "details": {
        "path": "/invalid/path",
        "suggestion": "Check that the path exists and is readable"
      }
    }
  ]
}
```

## 🔗 Related Documentation

- **[User Guides](../user-guides/README.md)** - Step-by-step usage guides
- **[Features](../features/README.md)** - Detailed feature documentation
- **[Architecture](../architecture/README.md)** - Technical implementation details
- **[Troubleshooting](../troubleshooting/README.md)** - Error resolution guides

## 📝 Contributing to API Documentation

See the [Documentation Contributing Guide](../development/contributing.md#api-documentation) for:
- API documentation standards
- Schema definition guidelines
- Example requirements
- Review process

---

[← Features](../features/README.md) | [CLI Reference](cli.md) | [Architecture →](../architecture/README.md)