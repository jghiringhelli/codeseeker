#!/bin/bash

# CodeMind Startup Script
# Handles local development and production deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
ENVIRONMENT=${1:-"local"}
WORKSPACE_PATH=${WORKSPACE_PATH:-"../workspace"}
API_PORT=${API_PORT:-3000}

echo -e "${BLUE}🚀 CodeMind - Intelligent Code Auxiliary System${NC}"
echo -e "${BLUE}===============================================${NC}"

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
    if lsof -Pi :$API_PORT -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${YELLOW}⚠️  Port $API_PORT is already in use${NC}"
        echo -e "${YELLOW}   You can specify a different port: API_PORT=3001 ./start.sh${NC}"
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

# Function to build and start services
start_services() {
    local compose_file=""
    local profile_args=""
    
    case $ENVIRONMENT in
        "local"|"dev")
            compose_file="docker-compose.local.yml"
            echo -e "${BLUE}📦 Starting local development environment...${NC}"
            ;;
        "production"|"prod")
            compose_file="docker-compose.yml"
            echo -e "${BLUE}📦 Starting production environment...${NC}"
            ;;
        "monitoring")
            compose_file="docker-compose.yml"
            profile_args="--profile monitoring"
            echo -e "${BLUE}📦 Starting with monitoring stack...${NC}"
            ;;
        *)
            echo -e "${RED}❌ Invalid environment: $ENVIRONMENT${NC}"
            echo -e "${YELLOW}   Valid options: local, production, monitoring${NC}"
            exit 1
            ;;
    esac

    # Export environment variables for docker-compose
    export WORKSPACE_PATH
    export API_PORT

    # Build and start services
    echo -e "${BLUE}🔨 Building services...${NC}"
    docker-compose -f $compose_file build

    echo -e "${BLUE}🚀 Starting services...${NC}"
    docker-compose -f $compose_file up -d $profile_args

    # Wait for health check
    echo -e "${BLUE}⏳ Waiting for services to be healthy...${NC}"
    sleep 10
    
    # Check health
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost:$API_PORT/health > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Services are healthy!${NC}"
            break
        fi
        attempt=$((attempt + 1))
        echo -e "${YELLOW}⏳ Attempt $attempt/$max_attempts - waiting for services...${NC}"
        sleep 2
    done
    
    if [ $attempt -eq $max_attempts ]; then
        echo -e "${RED}❌ Services failed to become healthy${NC}"
        echo -e "${YELLOW}📋 Showing logs:${NC}"
        docker-compose -f $compose_file logs
        exit 1
    fi
}

# Function to show service information
show_info() {
    echo -e "${GREEN}🎉 CodeMind is running!${NC}"
    echo -e "${GREEN}=====================${NC}"
    echo -e "API Endpoint:     ${BLUE}http://localhost:$API_PORT${NC}"
    echo -e "Health Check:     ${BLUE}http://localhost:$API_PORT/health${NC}"
    echo -e "Stats:            ${BLUE}http://localhost:$API_PORT/stats${NC}"
    echo -e "Workspace:        ${BLUE}$WORKSPACE_PATH${NC}"
    echo -e "Environment:      ${BLUE}$ENVIRONMENT${NC}"
    echo
    echo -e "${YELLOW}📖 Quick API Test:${NC}"
    echo -e "curl http://localhost:$API_PORT/health"
    echo
    echo -e "${YELLOW}🔄 To restart:${NC} ./start.sh $ENVIRONMENT"
    echo -e "${YELLOW}🛑 To stop:${NC}    ./stop.sh"
    echo -e "${YELLOW}📋 View logs:${NC}  docker-compose logs -f"
}

# Main execution
main() {
    echo -e "${BLUE}Environment: $ENVIRONMENT${NC}"
    echo -e "${BLUE}Workspace:   $WORKSPACE_PATH${NC}"
    echo -e "${BLUE}API Port:    $API_PORT${NC}"
    echo

    check_docker
    check_port
    check_workspace
    
    echo
    start_services
    
    echo
    show_info
}

# Help function
show_help() {
    echo "CodeMind Startup Script"
    echo
    echo "Usage: $0 [environment] [options]"
    echo
    echo "Environments:"
    echo "  local       - Local development (default)"
    echo "  production  - Production deployment"
    echo "  monitoring  - Production with monitoring stack"
    echo
    echo "Environment Variables:"
    echo "  WORKSPACE_PATH - Path to user workspace (default: ../workspace)"
    echo "  API_PORT       - API port (default: 3000)"
    echo
    echo "Examples:"
    echo "  ./start.sh local"
    echo "  WORKSPACE_PATH=/home/user/code ./start.sh production"
    echo "  API_PORT=3001 ./start.sh local"
}

# Handle arguments
case $1 in
    "-h"|"--help"|"help")
        show_help
        exit 0
        ;;
    *)
        main
        ;;
esac