# CodeMind Deployment Guide

Quick deployment guide for the Intelligent Code Auxiliary System Phase 1.

## Quick Start

### Local Development

```bash
# Start local environment
./start.sh local

# With custom workspace
WORKSPACE_PATH=/path/to/your/code ./start.sh local

# With custom port
API_PORT=3001 ./start.sh local

# Stop services
./stop.sh
```

### Production Deployment

```bash
# Start production stack
./start.sh production

# With monitoring
./start.sh monitoring

# Stop with cleanup
./stop.sh all
```

## API Integration for Claude Code

Once running, Claude Code can access the system at:
- **API Base URL**: `http://localhost:3000`
- **Health Check**: `http://localhost:3000/health`

### Claude-Specific Endpoints

#### Get Project Context
```bash
curl -X POST http://localhost:3000/claude/context \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "/workspace/user/project",
    "operation": "create"
  }'
```

#### Validate Code
```bash
curl -X POST http://localhost:3000/claude/validate \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "/workspace/user/project",
    "code": "function example() { return true; }",
    "language": "typescript"
  }'
```

#### Get Guidance
```bash
curl "http://localhost:3000/claude/guidance/workspace/user/project?task=component"
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WORKSPACE_PATH` | `../workspace` | Path to user's code workspace |
| `API_PORT` | `3000` | Port for API server |
| `NODE_ENV` | `production` | Runtime environment |
| `DB_PATH` | `/app/data/auxiliary-system.db` | Database file location |

## Docker Services

### Local Development (`docker-compose.local.yml`)
- **codemind**: Main API service with development settings
- **Port**: 3000
- **Database**: Persistent SQLite
- **Workspace**: Mounted as read-only

### Production (`docker-compose.yml`)
- **codemind-api**: Production API service  
- **nginx**: Reverse proxy (optional)
- **prometheus**: Metrics collection (optional)
- **grafana**: Monitoring dashboard (optional)

## Volumes and Data

- **codemind-local-data**: Development database storage
- **codemind-data**: Production database storage
- **prometheus-data**: Metrics storage
- **grafana-data**: Dashboard configuration

## Health Checks

The system includes comprehensive health checks:
- **API Health**: `GET /health`
- **Docker Health**: Built-in container health checks
- **Startup Validation**: Scripts wait for services to be ready

## Logs

View logs:
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f codemind

# With timestamps
docker-compose logs -f -t
```

## Troubleshooting

### Port Already in Use
```bash
# Check what's using the port
lsof -i :3000

# Use different port
API_PORT=3001 ./start.sh local
```

### Database Issues
```bash
# Reset database (⚠️ destroys data)
./stop.sh volumes
./start.sh local
```

### Service Won't Start
```bash
# Check service logs
docker-compose logs codemind

# Rebuild containers
docker-compose build --no-cache
./start.sh local
```

## Claude Code Integration Workflow

1. **Initialize Project**: Claude calls `POST /init` with project path
2. **Get Context**: Before changes, call `POST /claude/context`  
3. **Validate Code**: Use `POST /claude/validate` for consistency
4. **Get Guidance**: Call `GET /claude/guidance` for task-specific help

## Security Notes

- API runs on localhost by default
- No authentication in Phase 1 (local development)
- Workspace mounted as read-only
- Non-root user in containers
- Health checks prevent exposure of unhealthy services

## Performance

- **Caching**: Responses cached for 5-15 minutes
- **Token Optimization**: Minimal response payloads
- **Batching**: Efficient batch processing
- **Memory**: ~50MB base memory usage
- **Startup**: ~10-15 seconds to healthy state

## Next Steps

After deployment:
1. Test health endpoint
2. Initialize a test project
3. Try the Claude-specific endpoints
4. Monitor logs for any issues
5. Set up your IDE/Claude Code integration