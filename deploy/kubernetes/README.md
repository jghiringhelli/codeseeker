# CodeMind Kubernetes Deployment

Production-ready Kubernetes manifests for deploying CodeMind's server-mode databases.

> **Note**: Most users don't need Kubernetes deployment. CodeMind works out-of-the-box with **embedded mode** (SQLite + Graphology) - just `npm install -g codemind && codemind init`. Use Kubernetes only for production deployments with 100K+ files or multi-user requirements.

## Overview

These manifests deploy:
- **PostgreSQL** with pgvector extension (vector search + projects)
- **Neo4j** Community Edition (code relationship graph)
- **Redis** (distributed caching)

## Quick Start

```bash
# Create namespace
kubectl create namespace codemind

# Apply all manifests
kubectl apply -f . -n codemind

# Check status
kubectl get pods -n codemind

# Wait for all pods to be ready
kubectl wait --for=condition=ready pod --all -n codemind --timeout=120s
```

## Configuration

### 1. Create Secrets

Before deploying, create the required secrets:

```bash
# Create secrets (replace with your passwords)
kubectl create secret generic codemind-postgres-secret \
  --from-literal=password=your-secure-password \
  -n codemind

kubectl create secret generic codemind-neo4j-secret \
  --from-literal=password=your-secure-password \
  -n codemind

kubectl create secret generic codemind-redis-secret \
  --from-literal=password=your-secure-password \
  -n codemind
```

### 2. Configure Storage

Edit the PersistentVolumeClaim sizes in each manifest based on your needs:

| Database | Recommended Size | For Large Codebases |
|----------|------------------|---------------------|
| PostgreSQL | 10Gi | 50Gi+ |
| Neo4j | 5Gi | 20Gi+ |
| Redis | 1Gi | 5Gi |

### 3. Apply Manifests

```bash
kubectl apply -f postgres.yaml -n codemind
kubectl apply -f neo4j.yaml -n codemind
kubectl apply -f redis.yaml -n codemind
```

## Connecting CodeMind

After deployment, configure CodeMind to use server mode:

```bash
# Get service endpoints (if using LoadBalancer)
kubectl get svc -n codemind

# Or port-forward for local access
kubectl port-forward svc/codemind-postgres 5432:5432 -n codemind &
kubectl port-forward svc/codemind-neo4j 7687:7687 -n codemind &
kubectl port-forward svc/codemind-redis 6379:6379 -n codemind &
```

Configure environment variables:

```bash
export CODEMIND_STORAGE_MODE=server
export CODEMIND_PG_HOST=localhost  # or service IP
export CODEMIND_PG_PORT=5432
export CODEMIND_PG_DATABASE=codemind
export CODEMIND_PG_USER=codemind
export CODEMIND_PG_PASSWORD=your-secure-password
export CODEMIND_NEO4J_URI=bolt://localhost:7687
export CODEMIND_NEO4J_USER=neo4j
export CODEMIND_NEO4J_PASSWORD=your-secure-password
export CODEMIND_REDIS_HOST=localhost
export CODEMIND_REDIS_PORT=6379
```

## Files

| File | Description |
|------|-------------|
| `postgres.yaml` | PostgreSQL with pgvector for vector search |
| `neo4j.yaml` | Neo4j for code relationship graphs |
| `redis.yaml` | Redis for distributed caching |
| `configmap.yaml` | Shared configuration values |
| `namespace.yaml` | Namespace definition |

## Production Considerations

### High Availability

For production, consider:
- PostgreSQL: Use a managed service (RDS, Cloud SQL) or operator (Zalando)
- Neo4j: Use Neo4j Aura or Enterprise with clustering
- Redis: Use managed Redis (ElastiCache, Memorystore) or Redis Cluster

### Resource Limits

Adjust resource limits based on your workload:

```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "2Gi"
    cpu: "1000m"
```

### Backup Strategy

1. **PostgreSQL**: Use `pg_dump` or continuous archiving
2. **Neo4j**: Use `neo4j-admin dump` or online backup
3. **Redis**: Enable RDB snapshots and/or AOF persistence

## Troubleshooting

### Pod not starting

```bash
kubectl describe pod <pod-name> -n codemind
kubectl logs <pod-name> -n codemind
```

### Connection refused

Verify services are running and endpoints are correct:

```bash
kubectl get endpoints -n codemind
```

### Storage issues

Check PersistentVolumeClaims:

```bash
kubectl get pvc -n codemind
```