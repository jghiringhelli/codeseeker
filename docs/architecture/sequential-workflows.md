# Sequential Workflow Orchestration Architecture

## Overview

The Sequential Workflow Orchestrator is a Redis-based message-driven system that coordinates multi-role analysis pipelines. Each role processes sequentially, enriching the context for the next role in the pipeline.

## Architecture Components

### 1. Sequential Workflow Orchestrator (`sequential-workflow-orchestrator.ts`)
- **Query Complexity Analysis**: Analyzes incoming queries to determine required roles
- **Workflow Graph Building**: Constructs sequential role dependency graphs
- **Orchestration Management**: Manages workflow lifecycle and monitoring
- **Redis Integration**: Coordinates with Redis queue system

### 2. Redis Queue System (`redis-queue.ts`)
- **Blocking Operations**: Uses BRPOP for efficient queue processing
- **Message Reliability**: Automatic retry logic and dead letter queues
- **Queue Management**: Role-specific queues with cleanup
- **System Monitoring**: Queue status and health monitoring

### 3. Role Terminal Worker (`role-terminal-worker.ts`)
- **Role Specialization**: Each worker has specific expertise and tools
- **Context Processing**: Enriches context before passing to next role
- **Queue Processing**: Blocks on Redis queues waiting for work
- **Error Handling**: Comprehensive error handling with retries

### 4. Dashboard Integration (`dashboard/server.js` + `index.html`)
- **Sequential Workflow Tab**: Complete UI for workflow management
- **Real-time Monitoring**: WebSocket-based status updates
- **Control Interface**: Start/stop workflows, view system health
- **API Integration**: Full REST API for workflow operations

## Role System

### Sequential Processing Flow

1. **🏗️ Architect** → System design, dependencies, architecture patterns
2. **🔒 Security** → Vulnerability assessment, threat modeling, compliance
3. **✅ Quality** → Code quality, testing coverage, maintainability  
4. **⚡ Performance** → Bottleneck identification, optimization opportunities
5. **🎯 Coordinator** → Synthesizes insights into actionable recommendations

### Role Specialization

Each role has:
- **Specific Expertise Areas**: Focused domain knowledge
- **Tool Access**: Role-appropriate tool selection
- **Context Requirements**: What information they need from previous roles
- **Output Format**: Standardized analysis format

## Redis Message Flow

### Message Types

```typescript
interface WorkflowMessage {
  workflowId: string;
  roleId: string;
  input: {
    originalQuery: string;
    projectPath: string;
    toolResults: any[];
    contextFromPrevious: any;
  };
  metadata: {
    step: number;
    totalSteps: number;
    timestamp: number;
    priority: 'high' | 'normal';
    retryCount: number;
    maxRetries: number;
  };
}

interface WorkflowCompletion {
  workflowId: string;
  roleId: string;
  status: 'progress' | 'complete' | 'error';
  result?: any;
  error?: string;
  nextRole?: string;
  enrichedContext?: any;
}
```

### Queue Structure

- **Role Queues**: `role:{roleId}:queue` - Work messages for specific roles
- **Completion Queue**: `completion:{workflowId}` - Status updates and results
- **Dead Letter Queue**: `dlq:{roleId}` - Failed messages for debugging
- **Monitoring**: `queue:status` - System health and metrics

## API Endpoints

### Sequential Workflow Orchestration
- `POST /api/sequential/orchestrate` - Start new sequential workflow
- `GET /api/sequential/:orchestrationId/status` - Get workflow status
- `POST /api/sequential/:orchestrationId/stop` - Stop workflow
- `GET /api/sequential/active` - List active workflows
- `GET /api/sequential/system/status` - System health check

## Database Schema

### Core Tables
- `sequential_workflows` - Master workflow tracking
- `workflow_role_executions` - Individual role processing records
- `workflow_message_log` - Redis message audit trail
- `role_performance_metrics` - Performance monitoring
- `redis_queue_status` - Queue health monitoring

### Views and Indexes
- Performance-optimized queries for dashboard
- Real-time monitoring capabilities
- Historical analysis support

## Docker Configuration

### Services
- **redis**: Message queue and caching
- **orchestrator**: Sequential workflow coordination service  
- **role-terminal**: Role-based terminal workers
- **dashboard**: Web interface and API

### Dependencies
- Redis must be running before orchestrator
- Orchestrator must be running before role terminals
- Health checks ensure proper startup order

## Monitoring and Observability

### Dashboard Features
- Real-time workflow status
- System health monitoring
- Queue status and metrics
- Error tracking and debugging

### Logging
- Structured logging with correlation IDs
- Performance metrics collection
- Error tracking and alerting
- Audit trail for compliance

## Error Handling

### Retry Logic
- Configurable retry attempts per role
- Exponential backoff for failed messages
- Dead letter queue for persistent failures
- Manual retry capability through dashboard

### Fault Tolerance
- Redis connection recovery
- Role terminal restart capability
- Workflow timeout handling
- Graceful degradation

## Performance Characteristics

### Scalability
- Multiple role terminal workers per role
- Horizontal scaling through Docker containers
- Redis clustering support for high availability
- Load balancing across role instances

### Resource Usage
- Memory-efficient message processing
- Token budget management per role
- Context compression for large workflows
- Cleanup of completed workflow data

## Migration from Legacy System

### Deprecated Components
- `workflow-orchestrator.ts` (legacy parallel system)
- `terminal-orchestrator.ts` (legacy multi-terminal coordination)
- `types.ts` (legacy type definitions)
- `workflow-definitions.ts` (legacy DAG definitions)

### Backwards Compatibility
- Legacy API endpoints preserved
- Graceful fallback for existing integrations
- Migration path documented
- Deprecation warnings in code

## Development Guidelines

### Adding New Roles
1. Define role in `createXxxRole()` methods
2. Add role to workflow graph building logic
3. Update dashboard UI to display new role
4. Add role-specific prompts and tools

### Extending Workflow Logic
1. Modify `buildWorkflowGraph()` for new patterns
2. Update complexity analysis algorithms
3. Add new workflow templates
4. Test with various query types

### Monitoring Integration
1. Add custom metrics to performance monitor
2. Update dashboard displays
3. Configure alerting rules
4. Document operational procedures