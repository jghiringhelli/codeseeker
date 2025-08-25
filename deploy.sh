#!/bin/bash

# CodeMind Deployment Script
# Handles PostgreSQL deployment with full setup and management

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
ENVIRONMENT=${1:-"postgresql"}
WORKSPACE_PATH=${WORKSPACE_PATH:-"../workspace"}
API_PORT=${API_PORT:-3004}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-"codemind123"}

echo -e "${BLUE}🚀 CodeMind PostgreSQL Deployment${NC}"
echo -e "${BLUE}=================================${NC}"

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker is running${NC}"
}

# Function to check if port is available
check_port() {
    if lsof -Pi :$API_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Port $API_PORT is already in use${NC}"
        echo -e "${YELLOW}   You can specify a different port: API_PORT=3005 ./deploy.sh${NC}"
        read -p "Continue anyway? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        echo -e "${GREEN}✅ Port $API_PORT is available${NC}"
    fi
}

# Function to validate workspace path
check_workspace() {
    if [ ! -d "$WORKSPACE_PATH" ]; then
        echo -e "${YELLOW}⚠️  Workspace path does not exist: $WORKSPACE_PATH${NC}"
        echo -e "${YELLOW}   Creating directory...${NC}"
        mkdir -p "$WORKSPACE_PATH"
    fi
    echo -e "${GREEN}✅ Workspace path: $WORKSPACE_PATH${NC}"
}

# Function to install dependencies
install_dependencies() {
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    npm ci
    echo -e "${GREEN}✅ Dependencies installed${NC}"
}

# Function to build the application
build_application() {
    echo -e "${BLUE}🔨 Building application...${NC}"
    npm run build
    echo -e "${GREEN}✅ Application built${NC}"
}

# Function to start PostgreSQL deployment
start_postgresql() {
    local compose_file="docker-compose.postgres.yml"
    
    echo -e "${BLUE}📦 Starting PostgreSQL deployment...${NC}"
    echo -e "${BLUE}   API Port: $API_PORT${NC}"
    echo -e "${BLUE}   Workspace: $WORKSPACE_PATH${NC}"
    echo -e "${BLUE}   Environment: $ENVIRONMENT${NC}"

    # Export environment variables for docker-compose
    export API_PORT
    export WORKSPACE_PATH
    export POSTGRES_PASSWORD

    # Stop any existing containers
    echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
    docker-compose -f $compose_file down --remove-orphans 2>/dev/null || true

    # Build services
    echo -e "${BLUE}🔨 Building Docker services...${NC}"
    docker-compose -f $compose_file build

    # Start services
    echo -e "${BLUE}🚀 Starting services...${NC}"
    docker-compose -f $compose_file up -d

    # Wait for PostgreSQL to be ready
    echo -e "${BLUE}⏳ Waiting for PostgreSQL to be ready...${NC}"
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if docker-compose -f $compose_file exec -T postgres pg_isready -U codemind -d codemind > /dev/null 2>&1; then
            echo -e "${GREEN}✅ PostgreSQL is ready!${NC}"
            break
        fi
        attempt=$((attempt + 1))
        echo -e "${YELLOW}⏳ Attempt $attempt/$max_attempts - waiting for PostgreSQL...${NC}"
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        echo -e "${RED}❌ PostgreSQL failed to become ready${NC}"
        show_logs
        exit 1
    fi

    # Wait for API service to be healthy
    echo -e "${BLUE}⏳ Waiting for API service to be healthy...${NC}"
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost:$API_PORT/health > /dev/null 2>&1; then
            echo -e "${GREEN}✅ API service is healthy!${NC}"
            break
        fi
        attempt=$((attempt + 1))
        echo -e "${YELLOW}⏳ Attempt $attempt/$max_attempts - waiting for API service...${NC}"
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        echo -e "${RED}❌ API service failed to become healthy${NC}"
        show_logs
        exit 1
    fi
}

# Function to run database setup
setup_database() {
    echo -e "${BLUE}🗄️  Setting up database...${NC}"
    
    # Set environment variables for the database setup
    export DB_TYPE=postgresql
    export DB_HOST=localhost
    export DB_PORT=5432
    export DB_NAME=codemind
    export DB_USER=codemind
    export DB_PASSWORD=$POSTGRES_PASSWORD

    # Run database setup
    npm run db:setup
    
    echo -e "${GREEN}✅ Database setup completed${NC}"
}

# Function to show service information
show_info() {
    echo -e "${GREEN}🎉 CodeMind PostgreSQL deployment is running!${NC}"
    echo -e "${GREEN}=============================================${NC}"
    echo -e "API Endpoint:     ${BLUE}http://localhost:$API_PORT${NC}"
    echo -e "Health Check:     ${BLUE}http://localhost:$API_PORT/health${NC}"
    echo -e "Projects API:     ${BLUE}http://localhost:$API_PORT/projects${NC}"
    echo -e "Claude Context:   ${BLUE}http://localhost:$API_PORT/claude/context${NC}"
    echo -e "PostgreSQL:       ${BLUE}localhost:5432${NC}"
    echo -e "Database:         ${BLUE}codemind${NC}"
    echo -e "Workspace:        ${BLUE}$WORKSPACE_PATH${NC}"
    echo -e "Environment:      ${BLUE}$ENVIRONMENT${NC}"
    echo
    echo -e "${YELLOW}📖 Quick API Test:${NC}"
    echo -e "curl http://localhost:$API_PORT/health"
    echo -e "curl http://localhost:$API_PORT/projects"
    echo -e "curl http://localhost:$API_PORT/db/stats"
    echo
    echo -e "${YELLOW}🗄️  Database Management:${NC}"
    echo -e "npm run db:verify              # Check database health"
    echo -e "npm run db:clean               # Clear all data"
    echo -e "npm run db:reset               # Full database reset"
    echo
    echo -e "${YELLOW}🐳 Docker Management:${NC}"
    echo -e "docker-compose -f docker-compose.postgres.yml logs -f    # View logs"
    echo -e "docker-compose -f docker-compose.postgres.yml ps         # Check status"
    echo -e "docker-compose -f docker-compose.postgres.yml down       # Stop services"
    echo
    echo -e "${YELLOW}🔄 To restart:${NC} ./deploy.sh postgresql"
    echo -e "${YELLOW}🛑 To stop:${NC}    docker-compose -f docker-compose.postgres.yml down"
}

# Function to show logs
show_logs() {
    echo -e "${YELLOW}📋 Showing service logs:${NC}"
    docker-compose -f docker-compose.postgres.yml logs --tail=20
}

# Function to verify deployment
verify_deployment() {
    echo -e "${BLUE}🔍 Verifying deployment...${NC}"
    
    # Test health endpoint
    if curl -s http://localhost:$API_PORT/health | grep -q "healthy"; then
        echo -e "${GREEN}✅ Health check passed${NC}"
    else
        echo -e "${RED}❌ Health check failed${NC}"
        return 1
    fi

    # Test database stats
    if curl -s http://localhost:$API_PORT/db/stats | grep -q "success"; then
        echo -e "${GREEN}✅ Database connection verified${NC}"
    else
        echo -e "${RED}❌ Database connection failed${NC}"
        return 1
    fi

    # Test projects endpoint (PostgreSQL specific)
    if curl -s http://localhost:$API_PORT/projects | grep -q "success"; then
        echo -e "${GREEN}✅ PostgreSQL features verified${NC}"
    else
        echo -e "${RED}❌ PostgreSQL features failed${NC}"
        return 1
    fi

    echo -e "${GREEN}✅ All deployment checks passed!${NC}"
    return 0
}

# Main execution
main() {
    echo -e "${BLUE}Environment: $ENVIRONMENT${NC}"
    echo -e "${BLUE}API Port:    $API_PORT${NC}"
    echo -e "${BLUE}Workspace:   $WORKSPACE_PATH${NC}"
    echo -e "${BLUE}PostgreSQL:  enabled${NC}"
    echo

    check_docker
    check_port
    check_workspace
    
    echo
    install_dependencies
    build_application
    start_postgresql
    
    # Give services time to fully start
    sleep 3
    
    # Verify deployment
    if verify_deployment; then
        show_info
    else
        echo -e "${RED}❌ Deployment verification failed${NC}"
        show_logs
        exit 1
    fi
}

# Help function
show_help() {
    echo "CodeMind PostgreSQL Deployment Script"
    echo
    echo "Usage: $0 [environment] [options]"
    echo
    echo "Environments:"
    echo "  postgresql  - PostgreSQL deployment (default)"
    echo
    echo "Environment Variables:"
    echo "  WORKSPACE_PATH      - Path to user workspace (default: ../workspace)"
    echo "  API_PORT           - API port (default: 3004)"
    echo "  POSTGRES_PASSWORD  - PostgreSQL password (default: codemind123)"
    echo
    echo "Examples:"
    echo "  ./deploy.sh postgresql"
    echo "  WORKSPACE_PATH=/home/user/code ./deploy.sh"
    echo "  API_PORT=3005 ./deploy.sh postgresql"
    echo
    echo "Database Commands:"
    echo "  npm run db:setup    - Initialize database with sample data"
    echo "  npm run db:verify   - Check database health"
    echo "  npm run db:clean    - Clear all data (keep schema)"
    echo "  npm run db:reset    - Complete database reset"
}

# Handle arguments
case $1 in
    "-h"|"--help"|"help")
        show_help
        exit 0
        ;;
    "logs")
        show_logs
        exit 0
        ;;
    "verify")
        verify_deployment
        exit 0
        ;;
    *)
        main
        ;;
esac