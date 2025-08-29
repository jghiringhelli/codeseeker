# Migration Guide: Legacy Parallel to Sequential Workflows

## Overview

CodeMind has transitioned from a complex parallel terminal orchestration system to a streamlined sequential workflow system with Redis-based messaging. This guide helps you migrate from the legacy system to the new architecture.

## Key Changes

### Architecture Changes

| Legacy System | New Sequential System |
|---------------|----------------------|
| Parallel terminal spawning | Sequential role-based processing |
| Complex DAG workflows | Simple role pipelines |
| 19+ specialized roles | 5 core roles |
| In-memory coordination | Redis message queues |
| Complex backtracking | Linear progression with error handling |

### Role System Simplification

#### Legacy Roles (DEPRECATED)
```typescript
// 19+ roles including:
ORCHESTRATOR, WORK_CLASSIFIER, REQUIREMENT_ANALYST, 
TEST_DESIGNER, IMPLEMENTATION_DEVELOPER, CODE_REVIEWER,
COMPILER_BUILDER, DEVOPS_ENGINEER, DEPLOYER,
UNIT_TEST_EXECUTOR, INTEGRATION_TEST_ENGINEER,
E2E_TEST_ENGINEER, SECURITY_AUDITOR, PERFORMANCE_AUDITOR,
QUALITY_AUDITOR, TECHNICAL_DOCUMENTER, USER_DOCUMENTER,
RELEASE_MANAGER, COMMITTER
```

#### New Sequential Roles
```typescript
// 5 focused roles:
architect     -> System design and architecture
security      -> Security analysis and compliance  
quality       -> Code quality and testing
performance   -> Performance optimization
coordinator   -> Synthesis and recommendations
```

## Migration Steps

### 1. Update Dependencies

```bash
# Ensure Redis is available
docker-compose up redis -d

# Install new dependencies (already in package.json)
npm install
```

### 2. CLI Usage Migration

#### Legacy Terminal Orchestration
```bash
# OLD: Complex terminal orchestration
codemind orchestrate "comprehensive analysis" ./project

# This still works but is deprecated
```

#### New Sequential Workflows
```bash
# NEW: Sequential workflow orchestration
codemind orchestrate "comprehensive production readiness review" ./project

# The CLI command is the same, but it now uses the sequential system
```

### 3. API Endpoint Migration

#### Legacy Endpoints (Still Available)
```javascript
// DEPRECATED: Legacy parallel terminal system
POST /api/orchestrate
GET /api/orchestration/:id/status  
GET /api/orchestration/:id/terminals
POST /api/orchestration/:id/stop
GET /api/orchestration/active
```

#### New Sequential Endpoints
```javascript
// NEW: Sequential workflow system  
POST /api/sequential/orchestrate
GET /api/sequential/:id/status
POST /api/sequential/:id/stop
GET /api/sequential/active
GET /api/sequential/system/status
```

### 4. Dashboard Changes

#### Access Sequential Workflows
1. Navigate to http://localhost:3005
2. Click the **"🎭 Sequential Workflows"** tab
3. Use the new interface for:
   - Starting sequential workflows
   - Monitoring active workflows
   - Viewing system health
   - Stopping workflows

#### Legacy vs New Dashboard
- **Legacy**: Terminal-based view with multiple parallel terminals
- **New**: Role-based pipeline view with sequential processing

### 5. Configuration Migration

#### Docker Compose Changes
```yaml
# NEW: Redis is now required
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    
  orchestrator:
    # New sequential orchestrator service
    
  role-terminal:
    # New role terminal workers
```

#### Environment Variables
```bash
# NEW: Redis connection
REDIS_URL=redis://localhost:6379

# NEW: Sequential orchestrator
ORCHESTRATOR_PORT=3006
```

## Code Migration

### 1. TypeScript Interface Changes

#### Legacy Types (DEPRECATED)
```typescript
// OLD: Complex workflow definitions
import { WorkflowDAG, WorkflowNode, RoleType } from './orchestration/types';

// These are now deprecated with warnings
```

#### New Sequential Types
```typescript
// NEW: Simplified sequential interfaces
import { 
  WorkflowGraph, 
  WorkflowRole, 
  OrchestrationRequest,
  OrchestrationResult 
} from './orchestration/sequential-workflow-orchestrator';
```

### 2. Service Integration Changes

#### Legacy Integration
```typescript
// OLD: Complex workflow orchestrator
import { WorkflowOrchestrator } from './orchestration/workflow-orchestrator';
import { TerminalOrchestrator } from './orchestration/terminal-orchestrator';

// These are deprecated
```

#### New Sequential Integration  
```typescript
// NEW: Sequential workflow orchestrator
import { SequentialWorkflowOrchestrator } from './orchestration/sequential-workflow-orchestrator';
import { RedisQueue } from './messaging/redis-queue';

const orchestrator = new SequentialWorkflowOrchestrator();
await orchestrator.initialize();
```

## Service Startup Changes

### Legacy Startup (DEPRECATED)
```bash
# OLD: Just dashboard
npm run dashboard
```

### New Sequential Startup
```bash
# NEW: Start Redis first
docker-compose up redis -d

# Start sequential orchestrator
npm run orchestrator

# Start role terminals
npm run role-terminal

# Start dashboard
npm run dashboard

# OR: Start everything with Docker
docker-compose up -d
```

## Behavioral Changes

### 1. Processing Model
- **Legacy**: Multiple terminals process simultaneously with complex coordination
- **New**: Roles process sequentially, each enriching context for the next

### 2. Error Handling
- **Legacy**: Complex backtracking and rollback mechanisms
- **New**: Simple retry logic with dead letter queues

### 3. Monitoring
- **Legacy**: Terminal-based status monitoring
- **New**: Role-based pipeline monitoring with Redis queue status

### 4. Resource Usage
- **Legacy**: High memory usage with multiple terminal processes
- **New**: Efficient Redis-based messaging with controlled resource usage

## Troubleshooting Migration Issues

### 1. Redis Connection Issues
```bash
# Check Redis is running
docker ps | grep redis

# Test Redis connection
redis-cli ping

# Check Redis logs
docker logs <redis-container-id>
```

### 2. Legacy API Still Being Used
```javascript
// Check your code for these patterns:
// - Imports from 'workflow-orchestrator'
// - Calls to '/api/orchestrate' (legacy)
// - References to old RoleType enum

// Replace with sequential equivalents
```

### 3. Service Dependencies
```bash
# Ensure proper startup order:
# 1. Redis
# 2. Orchestrator  
# 3. Role terminals
# 4. Dashboard

# Check service health
curl http://localhost:3006/api/system/status
```

### 4. Dashboard Not Showing Sequential Tab
- Clear browser cache
- Ensure you're using the updated dashboard code
- Check browser console for JavaScript errors

## Performance Improvements

### 1. Token Efficiency
- **Legacy**: Higher token usage due to parallel processing overhead
- **New**: More efficient token usage through sequential context enrichment

### 2. Memory Usage
- **Legacy**: Multiple terminal processes consuming memory
- **New**: Single role workers with Redis-based coordination

### 3. Scalability
- **Legacy**: Limited by terminal process spawning
- **New**: Horizontal scaling through role worker instances

## Support for Legacy Code

### Backwards Compatibility
- Legacy API endpoints remain functional
- Deprecated files include migration guidance
- Gradual migration path supported

### Deprecation Timeline
- **Phase 1**: Sequential system available alongside legacy (current)
- **Phase 2**: Legacy system marked as deprecated (warnings added)
- **Phase 3**: Legacy system removed (future release)

### Migration Assistance
- All legacy files include deprecation warnings
- This migration guide provides step-by-step instructions
- Sequential system is drop-in replacement for most use cases

## Benefits of Sequential System

### 1. Simplicity
- 5 roles instead of 19+
- Linear processing model
- Reduced configuration complexity

### 2. Reliability  
- Redis-based messaging for fault tolerance
- Automatic retry logic
- Dead letter queues for debugging

### 3. Observability
- Clear role-based pipeline monitoring
- Redis queue status visibility
- Structured logging and metrics

### 4. Scalability
- Multiple role workers per role type
- Docker-based horizontal scaling
- Redis clustering support

### 5. Maintainability
- Simpler codebase
- Clear separation of concerns
- Better testing capabilities

## Next Steps

1. **Test Sequential Workflows**: Start with simple queries to verify the system works
2. **Update Integrations**: Migrate custom code to use new APIs
3. **Monitor Performance**: Compare results between legacy and sequential systems  
4. **Update Documentation**: Update any custom documentation referencing the legacy system
5. **Train Team**: Ensure team members understand the new role-based pipeline model

## Questions and Support

- **Architecture Questions**: See [Sequential Workflow Architecture](../architecture/sequential-workflows.md)
- **API Reference**: Check new endpoints in dashboard or API documentation
- **Issues**: Create GitHub issues for migration problems
- **Performance**: Monitor dashboard for sequential workflow performance metrics