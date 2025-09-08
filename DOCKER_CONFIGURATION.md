# Docker Configuration

## Dashboard Service Configuration

The CodeMind Dashboard is configured to run in Docker through docker-compose.yml.

### Key Configuration Points:

1. **Dashboard runs in Docker by default**: 
   - Service name: `dashboard`
   - Container name: `codemind-dashboard`
   - Port: 3005 (configurable via DASHBOARD_PORT env var)
   - Profile: `dev` or `full` (optional services)

2. **To start dashboard in Docker**:
   ```bash
   # Start with dev profile (includes dashboard)
   docker-compose --profile dev up dashboard
   
   # Or start full stack with dev services
   docker-compose --profile dev up
   ```

3. **Dashboard Configuration**:
   - Uses dashboard.Dockerfile in docker/ directory
   - Runs `node src/dashboard/server.js` as entry point
   - Connects to PostgreSQL, Redis, Neo4j, and MongoDB services
   - Includes health check endpoint
   - Runs as non-root user (codemind:codemind)

4. **Environment Variables**:
   - NODE_ENV: production (in Docker)
   - DASHBOARD_PORT: 3005
   - Database connections automatically configured for Docker network

5. **Startup Command for Dashboard**:
   ```bash
   # Recommended: Use Docker (not command line)
   docker-compose --profile dev up dashboard
   
   # NOT recommended for production: Command line
   # npm run dashboard
   ```

## Other Services

- **API**: Always available, port 3004
- **Orchestrator**: Optional (dev profile), port 3006
- **Databases**: PostgreSQL (5432), Redis (6379), Neo4j (7474/7687), MongoDB (27017)

## Notes

- Dashboard should start in Docker container, not directly via npm/node commands
- Use docker-compose profiles to control which services run
- All services are connected via `codemind-network` bridge network