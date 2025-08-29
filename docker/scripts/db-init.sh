#!/bin/bash
# Database initialization script for CodeMind Three-Layer Architecture

set -e

echo "🚀 Initializing CodeMind Three-Layer Database..."

# Check if database is ready
until pg_isready -U ${POSTGRES_USER:-codemind} -d ${POSTGRES_DB:-codemind}; do
  echo "⏳ Waiting for PostgreSQL to be ready..."
  sleep 2
done

echo "📊 Setting up three-layer architecture tables:"
echo "   - Layer 1: Smart CLI (intelligent tool selection)"
echo "   - Layer 2: Orchestrator (workflow coordination)" 
echo "   - Layer 3: Planner (idea-to-implementation)"

# Run any additional setup commands if needed
psql -U ${POSTGRES_USER:-codemind} -d ${POSTGRES_DB:-codemind} -c "SELECT 'CodeMind Three-Layer Database Ready' AS status;"

echo "✅ Three-layer database initialization complete"