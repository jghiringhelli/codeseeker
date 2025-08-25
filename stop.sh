#!/bin/bash

# CodeMind Stop Script
# Gracefully stops all services and cleans up

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🛑 CodeMind - Stopping Services${NC}"
echo -e "${BLUE}===============================${NC}"

# Function to stop services
stop_services() {
    local compose_files=("docker-compose.local.yml" "docker-compose.yml")
    
    echo -e "${YELLOW}🔄 Stopping all CodeMind services...${NC}"
    
    for compose_file in "${compose_files[@]}"; do
        if [ -f "$compose_file" ]; then
            echo -e "${BLUE}📋 Checking $compose_file...${NC}"
            
            # Check if any services are running
            if docker-compose -f $compose_file ps --services --filter "status=running" | grep -q .; then
                echo -e "${YELLOW}🛑 Stopping services from $compose_file...${NC}"
                docker-compose -f $compose_file down
            else
                echo -e "${GREEN}✅ No running services in $compose_file${NC}"
            fi
        fi
    done
}

# Function to clean up resources
cleanup_resources() {
    local cleanup_type=${1:-"containers"}
    
    case $cleanup_type in
        "all")
            echo -e "${YELLOW}🧹 Cleaning up containers, networks, and volumes...${NC}"
            docker system prune -f --volumes
            echo -e "${GREEN}✅ Full cleanup completed${NC}"
            ;;
        "containers")
            echo -e "${YELLOW}🧹 Cleaning up stopped containers and networks...${NC}"
            docker container prune -f
            docker network prune -f
            echo -e "${GREEN}✅ Container cleanup completed${NC}"
            ;;
        "volumes")
            echo -e "${YELLOW}🧹 Cleaning up volumes (⚠️  This will delete data!)...${NC}"
            read -p "Are you sure you want to delete all volumes? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                docker volume prune -f
                echo -e "${GREEN}✅ Volume cleanup completed${NC}"
            else
                echo -e "${YELLOW}⏭️  Volume cleanup skipped${NC}"
            fi
            ;;
    esac
}

# Function to show status
show_status() {
    echo -e "${BLUE}📊 Current Docker Status:${NC}"
    echo
    
    # Check for any CodeMind-related containers
    if docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -i codemind; then
        echo
    else
        echo -e "${GREEN}✅ No CodeMind containers found${NC}"
    fi
    
    # Check for networks
    if docker network ls | grep -i codemind; then
        echo
    else
        echo -e "${GREEN}✅ No CodeMind networks found${NC}"
    fi
    
    # Check for volumes
    if docker volume ls | grep -i codemind; then
        echo
    else
        echo -e "${GREEN}✅ No CodeMind volumes found${NC}"
    fi
}

# Function to show help
show_help() {
    echo "CodeMind Stop Script"
    echo
    echo "Usage: $0 [cleanup_type]"
    echo
    echo "Cleanup types:"
    echo "  containers  - Clean up containers and networks only (default)"
    echo "  volumes     - Clean up volumes (⚠️  destroys data!)"
    echo "  all         - Full cleanup including volumes"
    echo "  none        - Just stop services, no cleanup"
    echo
    echo "Examples:"
    echo "  ./stop.sh                 # Stop and clean containers"
    echo "  ./stop.sh none           # Just stop, no cleanup"
    echo "  ./stop.sh volumes        # Clean up volumes too"
    echo "  ./stop.sh all            # Full cleanup"
}

# Main execution
main() {
    local cleanup_type=${1:-"containers"}
    
    stop_services
    
    echo
    
    case $cleanup_type in
        "none")
            echo -e "${GREEN}✅ Services stopped (no cleanup performed)${NC}"
            ;;
        *)
            cleanup_resources "$cleanup_type"
            ;;
    esac
    
    echo
    show_status
    
    echo
    echo -e "${GREEN}🎉 CodeMind services stopped successfully!${NC}"
    echo -e "${YELLOW}🔄 To restart: ./start.sh [environment]${NC}"
}

# Handle arguments
case $1 in
    "-h"|"--help"|"help")
        show_help
        exit 0
        ;;
    *)
        main "$1"
        ;;
esac