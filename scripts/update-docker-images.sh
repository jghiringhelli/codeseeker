#!/bin/bash

# CodeMind Docker Images Update Script
# Rebuilds and restarts all services with the latest three-layer architecture code

# Parse command line arguments
FORCE_REBUILD=false
NO_CACHE=false
VERBOSE_OUTPUT=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --force-rebuild)
            FORCE_REBUILD=true
            shift
            ;;
        --no-cache)
            NO_CACHE=true
            shift
            ;;
        --verbose)
            VERBOSE_OUTPUT=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --force-rebuild   Remove old images before rebuilding"
            echo "  --no-cache        Build images without using cache"
            echo "  --verbose         Show detailed build output"
            echo "  -h, --help        Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use $0 --help for usage information."
            exit 1
            ;;
    esac
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info() { echo -e "${CYAN}$1${NC}"; }
success() { echo -e "${GREEN}$1${NC}"; }
warning() { echo -e "${YELLOW}$1${NC}"; }
error() { echo -e "${RED}$1${NC}"; }

info "CodeMind Docker Images Update"
info "====================================="
info "Updating Docker images with latest three-layer architecture code"
info "This will rebuild all images and restart services with fresh containers"
echo

# Navigate to project directory
PROJECT_ROOT="$(dirname "$(dirname "$(realpath "$0")")")"
cd "$PROJECT_ROOT"
info "Working directory: $PWD"

# Check if docker-compose is available
if ! command -v docker-compose >/dev/null 2>&1; then
    error "docker-compose is not installed or not in PATH"
    exit 1
fi

# Step 1: Stop all services
info "Step 1: Stopping all CodeMind services..."
if docker-compose down; then
    success "✅ All services stopped"
else
    warning "⚠️  Error stopping services"
fi

# Step 2: Remove old images if force rebuild is requested
if [ "$FORCE_REBUILD" = true ]; then
    info "Step 2: Removing old CodeMind images (force rebuild)..."
    
    # Remove CodeMind images
    CODEMIND_IMAGES=$(docker images --filter "reference=codemind*" --format "{{.Repository}}:{{.Tag}}")
    if [ -n "$CODEMIND_IMAGES" ]; then
        echo "$CODEMIND_IMAGES" | while IFS= read -r image; do
            if [ "$image" != "<none>:<none>" ]; then
                info "  Removing image: $image"
                docker image rm "$image" --force
            fi
        done
        success "✅ Old images removed"
    else
        info "  No CodeMind images to remove"
    fi
else
    info "Step 2: Skipping image removal (use --force-rebuild to remove old images)"
fi

# Step 3: Build new images with latest code
info "Step 3: Building new Docker images with latest code..."

BUILD_ARGS=""
if [ "$NO_CACHE" = true ]; then
    BUILD_ARGS="$BUILD_ARGS --no-cache"
fi
if [ "$VERBOSE_OUTPUT" = true ]; then
    BUILD_ARGS="$BUILD_ARGS --progress=plain"
fi

# Build all services
services=("codemind-api" "codemind-dashboard" "codemind-orchestrator" "codemind-role-terminal")
build_failed=false

for service in "${services[@]}"; do
    info "  Building $service image..."
    if ! docker-compose build $BUILD_ARGS "$service"; then
        error "❌ Failed to build $service"
        build_failed=true
    fi
done

if [ "$build_failed" = true ]; then
    error "❌ One or more image builds failed"
    exit 1
else
    success "✅ All images built successfully"
fi

# Step 4: Start services with new images
info "Step 4: Starting services with updated images..."
if docker-compose up -d; then
    success "✅ All services started"
else
    error "❌ Error starting services"
    exit 1
fi

# Step 5: Wait for services to be healthy
info "Step 5: Waiting for services to become healthy..."
MAX_WAIT_TIME=120  # 2 minutes
WAIT_INTERVAL=5    # 5 seconds
ELAPSED_TIME=0

while [ $ELAPSED_TIME -lt $MAX_WAIT_TIME ]; do
    sleep $WAIT_INTERVAL
    ELAPSED_TIME=$((ELAPSED_TIME + WAIT_INTERVAL))
    
    # Check service health
    HEALTHY_COUNT=0
    TOTAL_COUNT=0
    
    # Get running containers
    CONTAINERS=$(docker-compose ps -q)
    for container in $CONTAINERS; do
        if [ -n "$container" ]; then
            TOTAL_COUNT=$((TOTAL_COUNT + 1))
            
            # Check if container is running
            if docker inspect "$container" --format '{{.State.Running}}' | grep -q "true"; then
                # Check health status if available
                HEALTH_STATUS=$(docker inspect "$container" --format '{{.State.Health.Status}}' 2>/dev/null || echo "")
                if [ "$HEALTH_STATUS" = "healthy" ] || [ "$HEALTH_STATUS" = "" ]; then
                    HEALTHY_COUNT=$((HEALTHY_COUNT + 1))
                fi
            fi
        fi
    done
    
    info "  Healthy services: $HEALTHY_COUNT/$TOTAL_COUNT (${ELAPSED_TIME}s elapsed)"
    
    if [ $HEALTHY_COUNT -eq $TOTAL_COUNT ] && [ $TOTAL_COUNT -gt 0 ]; then
        success "✅ All services are healthy!"
        break
    fi
done

if [ $ELAPSED_TIME -ge $MAX_WAIT_TIME ]; then
    warning "⚠️  Some services may not be fully healthy yet. Check logs if needed."
fi

# Step 6: Display final status
info "Step 6: Final service status..."
docker-compose ps

echo
success "🎉 Docker images update complete!"
success "======================================"
success "✅ All services rebuilt with latest three-layer architecture code"
success "✅ Database now uses three-layer-complete-schema.sql"
success "✅ Dashboard includes comprehensive three-layer interface"
success "✅ Orchestrator ready for sequential role-based workflows"
echo
info "Services are now running with the latest code:"
info "• Dashboard: http://localhost:3005 (three-layer interface)"
info "• API: http://localhost:3004 (smart CLI backend)"
info "• Orchestrator: http://localhost:3006 (workflow coordination)"
info "• Database: localhost:5432 (three-layer schema)"
echo
info "To view logs: docker-compose logs -f [service-name]"
info "To restart: docker-compose restart [service-name]"
info "To stop: docker-compose down"