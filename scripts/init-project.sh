#!/bin/bash

# CodeMind Three-Layer Project Initialization Script (Shell)
# Comprehensive initialization for all three layers: Smart CLI, Orchestrator, and Planner

# Configuration and argument parsing
PROJECT_PATH="${PWD}"
API_URL="http://localhost:3004"
DASHBOARD_URL="http://localhost:3005"
LAYERS="all"
INTERACTIVE="true"
VERBOSE=""
FORCE_REINIT=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

info() { print_color "$CYAN" "$1"; }
success() { print_color "$GREEN" "$1"; }
warning() { print_color "$YELLOW" "$1"; }
error() { print_color "$RED" "$1"; }

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--project-path)
            PROJECT_PATH="$2"
            shift 2
            ;;
        --api-url)
            API_URL="$2"
            shift 2
            ;;
        --dashboard-url)
            DASHBOARD_URL="$2"
            shift 2
            ;;
        -l|--layers)
            LAYERS="$2"
            shift 2
            ;;
        --non-interactive)
            INTERACTIVE="false"
            shift
            ;;
        -v|--verbose)
            VERBOSE="true"
            shift
            ;;
        --force-reinit)
            FORCE_REINIT="true"
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "CodeMind Three-Layer Architecture Initialization:"
            echo "  Layer 1: Smart CLI - Intelligent tool selection with database integration"
            echo "  Layer 2: Orchestrator - Sequential role-based workflow coordination"  
            echo "  Layer 3: Planner - AI-powered idea-to-implementation planning"
            echo ""
            echo "Options:"
            echo "  -p, --project-path    Project path (default: current directory)"
            echo "  -l, --layers          Layers to initialize (all, cli, orchestrator, planner, or comma-separated)"
            echo "  --api-url             CodeMind API URL (default: http://localhost:3004)"
            echo "  --dashboard-url       Dashboard URL (default: http://localhost:3005)"
            echo "  --non-interactive     Skip interactive prompts"
            echo "  -v, --verbose         Enable verbose output"
            echo "  --force-reinit        Force reinitialization of existing data"
            echo "  -h, --help            Show this help"
            echo ""
            echo "Examples:"
            echo "  $0                                           # Initialize all layers for current directory"
            echo "  $0 -p ./my-project                          # Initialize all layers for specific project"
            echo "  $0 -p ./my-project -l cli                   # Initialize Smart CLI only"
            echo "  $0 -p ./my-project -l cli,orchestrator      # Initialize CLI and Orchestrator"
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            echo "Use $0 --help for usage information."
            exit 1
            ;;
    esac
done

# Parse enabled layers
if [ "$LAYERS" = "all" ]; then
    ENABLED_LAYERS=("cli" "orchestrator" "planner")
else
    IFS=',' read -ra ENABLED_LAYERS <<< "$LAYERS"
    # Trim whitespace
    for i in "${!ENABLED_LAYERS[@]}"; do
        ENABLED_LAYERS[$i]=$(echo "${ENABLED_LAYERS[$i]}" | xargs)
    done
fi

# Main initialization function
initialize_codemind_project() {
    print_color "$CYAN" "CodeMind Three-Layer Project Initialization"
    print_color "$CYAN" "============================================"
    info "Project Path: $PROJECT_PATH"
    info "CodeMind API: $API_URL"
    info "Dashboard: $DASHBOARD_URL"
    warning "Enabled Layers: ${ENABLED_LAYERS[*]}"
    echo

    # Validate environment
    if ! test_environment; then
        exit 1
    fi

    # Check for existing project
    local existing_project
    existing_project=$(get_existing_project)
    
    local project_id=""
    if [ -n "$existing_project" ]; then
        info "Found existing project: $existing_project"
        project_id="$existing_project"
    else
        info "Creating new project..."
        project_id=$(create_new_project)
        if [ -z "$project_id" ]; then
            error "Failed to create project"
            exit 1
        fi
        success "Created project with ID: $project_id"
    fi

    # Initialize three-layer database
    info "Initializing three-layer database schema..."
    initialize_three_layer_database "$project_id"

    # Run layer-specific initialization
    for layer in "${ENABLED_LAYERS[@]}"; do
        print_color "$PURPLE" "Initializing Layer: $(echo "$layer" | tr '[:lower:]' '[:upper:]')"
        
        case "$layer" in
            "cli")
                initialize_cli_layer "$project_id"
                ;;
            "orchestrator")
                initialize_orchestrator_layer "$project_id"
                ;;
            "planner")
                initialize_planner_layer "$project_id"
                ;;
            *)
                warning "Unknown layer: $layer"
                ;;
        esac
    done

    # Set up inter-layer integration
    info "Configuring inter-layer integration..."
    initialize_layer_integration "$project_id"

    # Show summary
    show_summary_report
}

test_environment() {
    info "Validating environment..."
    
    # Check if project directory exists
    if [ ! -d "$PROJECT_PATH" ]; then
        error "Project directory does not exist: $PROJECT_PATH"
        return 1
    fi

    # Check if CodeMind services are running
    if ! curl -s --connect-timeout 10 "$DASHBOARD_URL/api/auth/status" > /dev/null; then
        error "CodeMind services not running. Please start with: docker-compose up -d"
        return 1
    fi

    success "Environment validated"
    return 0
}

get_existing_project() {
    local project_name
    project_name=$(basename "$PROJECT_PATH")
    
    local response
    response=$(curl -s "$DASHBOARD_URL/api/dashboard/projects/all" 2>/dev/null)
    
    if [ $? -eq 0 ] && [ -n "$response" ]; then
        # Try to extract project ID (this is a simplified version)
        echo "$response" | grep -o "\"project_id\":\"[^\"]*\"" | head -1 | sed 's/"project_id":"\([^"]*\)"/\1/'
    fi
}

create_new_project() {
    local project_name
    project_name=$(basename "$PROJECT_PATH")
    
    local body
    body=$(cat <<EOF
{
    "project_name": "$project_name",
    "project_path": "$PROJECT_PATH",
    "description": "Auto-initialized three-layer project: $project_name",
    "project_type": "unknown",
    "languages": [],
    "frameworks": [],
    "metadata": {
        "setupDate": "$(date +%Y-%m-%d)",
        "layers": ["${ENABLED_LAYERS[*]}"],
        "threeLayers": true
    }
}
EOF
)

    local response
    response=$(curl -s -X POST "$DASHBOARD_URL/api/dashboard/projects" \
        -H "Content-Type: application/json" \
        -d "$body" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        echo "$response" | grep -o '"id":"[^"]*"' | sed 's/"id":"\([^"]*\)"/\1/'
    fi
}

initialize_three_layer_database() {
    local project_id="$1"
    
    info "  Setting up three-layer database schema..."
    
    # Check if schema file exists
    local schema_path="$(dirname "$0")/../database/three-layer-complete-schema.sql"
    if [ ! -f "$schema_path" ]; then
        warning "  Three-layer database schema not found, skipping..."
        return
    fi
    
    local schema_content
    schema_content=$(cat "$schema_path")
    
    local body
    body=$(cat <<EOF
{
    "projectId": "$project_id",
    "schema": $(echo "$schema_content" | jq -Rs .),
    "layers": [$(printf '"%s",' "${ENABLED_LAYERS[@]}" | sed 's/,$//')],
    "init": true
}
EOF
)

    local response
    response=$(curl -s -X POST "$DASHBOARD_URL/api/dashboard/database/init-schema" \
        -H "Content-Type: application/json" \
        -d "$body" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        success "  ✅ Three-layer database schema initialized"
    else
        warning "  ⚠️  Database initialization failed, continuing..."
    fi
}

initialize_cli_layer() {
    local project_id="$1"
    
    info "  Setting up Smart CLI tools..."
    
    local body
    body=$(cat <<EOF
{
    "projectId": "$project_id",
    "tools": [
        "context-optimizer",
        "issues-detector", 
        "performance-analyzer",
        "security-scanner",
        "duplication-detector",
        "centralization-detector",
        "dependency-analyzer"
    ],
    "config": {
        "tokenOptimization": true,
        "learningEnabled": true,
        "realTimeUpdates": true
    }
}
EOF
)

    local response
    response=$(curl -s -X POST "$DASHBOARD_URL/api/dashboard/cli/tools/setup" \
        -H "Content-Type: application/json" \
        -d "$body" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        success "  ✅ Smart CLI tools configured"
    else
        warning "  ⚠️  CLI tools setup failed"
    fi
}

initialize_orchestrator_layer() {
    local project_id="$1"
    
    info "  Setting up workflow orchestrator..."
    
    # Create workflow templates
    local workflow_body
    workflow_body=$(cat <<EOF
{
    "projectId": "$project_id",
    "workflows": [
        {
            "name": "comprehensive-review",
            "description": "Full project review using all 5 roles",
            "roles": ["architect", "security", "quality", "performance", "coordinator"],
            "type": "sequential"
        },
        {
            "name": "security-audit",
            "description": "Focused security analysis",
            "roles": ["security", "coordinator"],
            "type": "sequential"
        }
    ]
}
EOF
)

    curl -s -X POST "$DASHBOARD_URL/api/dashboard/orchestrator/workflows/templates" \
        -H "Content-Type: application/json" \
        -d "$workflow_body" >/dev/null 2>&1

    # Setup Redis queues
    local queue_body
    queue_body=$(cat <<EOF
{
    "projectId": "$project_id",
    "queues": ["architect:queue", "security:queue", "quality:queue", "performance:queue", "coordinator:queue"],
    "options": {
        "retry_attempts": 3,
        "timeout_seconds": 300,
        "dead_letter_queue": true
    }
}
EOF
)

    curl -s -X POST "$DASHBOARD_URL/api/dashboard/orchestrator/queues/setup" \
        -H "Content-Type: application/json" \
        -d "$queue_body" >/dev/null 2>&1

    success "  ✅ Workflow orchestrator configured"
}

initialize_planner_layer() {
    local project_id="$1"
    
    info "  Setting up idea planner..."
    
    local body
    body=$(cat <<EOF
{
    "projectId": "$project_id",
    "templates": {
        "roadmap": {
            "phases": ["Discovery", "Design", "Development", "Testing", "Deployment"],
            "default_timeline_weeks": 12
        },
        "business_plan": {
            "sections": ["Executive Summary", "Market Analysis", "Revenue Model", "Go-to-Market"]
        },
        "tech_stack": {
            "categories": ["Frontend", "Backend", "Database", "Infrastructure", "Tools"]
        }
    },
    "features": {
        "voice_interface": true,
        "ai_conversation": true,
        "auto_documentation": true
    }
}
EOF
)

    local response
    response=$(curl -s -X POST "$DASHBOARD_URL/api/dashboard/planner/init" \
        -H "Content-Type: application/json" \
        -d "$body" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        success "  ✅ Idea planner initialized"
    else
        warning "  ⚠️  Planner initialization failed"
    fi
}

initialize_layer_integration() {
    local project_id="$1"
    
    info "  Setting up inter-layer integration..."
    
    local body
    body=$(cat <<EOF
{
    "projectId": "$project_id",
    "integrations": [
        {
            "source": "planner",
            "target": "orchestrator",
            "type": "workflow_handoff",
            "enabled": true
        },
        {
            "source": "orchestrator",
            "target": "cli",
            "type": "tool_coordination",
            "enabled": true
        },
        {
            "source": "cli",
            "target": "planner",
            "type": "learning_feedback",
            "enabled": true
        }
    ],
    "learning_enabled": true
}
EOF
)

    local response
    response=$(curl -s -X POST "$DASHBOARD_URL/api/dashboard/integration/setup" \
        -H "Content-Type: application/json" \
        -d "$body" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        success "  ✅ Inter-layer integration configured"
    else
        warning "  ⚠️  Integration setup failed"
    fi
}

show_summary_report() {
    echo
    print_color "$GREEN" "Three-Layer Platform Ready!"
    print_color "$GREEN" "=============================="
    print_color "$CYAN" "Layer 1 (Smart CLI): Intelligent tool selection and database integration"
    print_color "$CYAN" "Layer 2 (Orchestrator): Sequential role-based workflow coordination"  
    print_color "$CYAN" "Layer 3 (Planner): AI-powered idea-to-implementation planning"
    echo
    print_color "$YELLOW" "Next Steps:"
    print_color "$NC" "1. Dashboard: $DASHBOARD_URL"
    print_color "$NC" "   - View project overview across all layers"
    print_color "$NC" "   - Access Layer 3 planning interface"
    print_color "$NC" "   - Monitor Layer 2 orchestration workflows"
    echo
    print_color "$NC" "2. Smart CLI Usage:"
    print_color "$NC" "   codemind 'analyze security issues' ./project"
    echo
    print_color "$NC" "3. Orchestrator Usage:"
    print_color "$NC" "   codemind orchestrate 'production review' ./project"
    echo
    print_color "$NC" "4. Planner Usage:"
    print_color "$NC" "   Dashboard → '💡 I have an idea' button"
}

# Main execution
initialize_codemind_project