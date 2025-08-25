#!/bin/bash

# Setup Test Database for API Testing
# Creates a separate test database to avoid affecting production data

echo "🏗️  Setting up test database for API testing..."

# Test database configuration
TEST_DB_NAME="codemind_test"
DB_USER="codemind"
DB_PASSWORD="codemind123"
DB_HOST="localhost"
DB_PORT="5432"

# Check if PostgreSQL container is running
if ! docker ps | grep -q "codemind-postgres"; then
    echo "❌ PostgreSQL container not running. Start it first:"
    echo "   docker-compose -f docker-compose.postgres.yml up -d"
    exit 1
fi

echo "📊 Creating test database..."

# Create test database
docker-compose -f docker-compose.postgres.yml exec postgres psql -U $DB_USER -c "DROP DATABASE IF EXISTS $TEST_DB_NAME;"
docker-compose -f docker-compose.postgres.yml exec postgres psql -U $DB_USER -c "CREATE DATABASE $TEST_DB_NAME;"

echo "📋 Loading schema into test database..."

# Load schema into test database
docker-compose -f docker-compose.postgres.yml exec postgres psql -U $DB_USER -d $TEST_DB_NAME -f /docker-entrypoint-initdb.d/schema.postgres.sql

echo "✅ Test database ready!"
echo ""
echo "Database Details:"
echo "  Name: $TEST_DB_NAME"
echo "  Host: $DB_HOST:$DB_PORT"
echo "  User: $DB_USER"
echo ""
echo "To run tests:"
echo "  cd tests && node api-database-tests.js"
echo ""
echo "To cleanup:"
echo "  docker-compose -f docker-compose.postgres.yml exec postgres psql -U $DB_USER -c \"DROP DATABASE $TEST_DB_NAME;\""