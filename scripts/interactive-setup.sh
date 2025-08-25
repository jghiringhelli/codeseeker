#!/bin/bash

# Enhanced Interactive CodeMind Setup Script
# Can use Claude Code or Claude API to help gather project requirements and setup context

# Configuration
CODEMIND_API="http://localhost:3004"
CLAUDE_API="https://api.anthropic.com/v1/messages"
USE_CLAUDE_CODE=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# Helper functions
print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

info() { print_color "$CYAN" "$1"; }
success() { print_color "$GREEN" "$1"; }
warning() { print_color "$YELLOW" "$1"; }
error() { print_color "$RED" "$1"; }
question() { print_color "$PURPLE" "$1"; }
example() { print_color "$GRAY" "$1"; }

is_greenfield_project() {
    local project_path="$1"
    
    # Check if project has minimal code files
    local code_count=0
    if [ -d "$project_path" ]; then
        code_count=$(find "$project_path" -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.java" -o -name "*.cs" -o -name "*.go" -o -name "*.rs" -o -name "*.php" -o -name "*.rb" -o -name "*.cpp" -o -name "*.c" -o -name "*.h" | grep -v node_modules | grep -v ".git" | grep -v ".min." | wc -l 2>/dev/null || echo 0)
    fi
    
    # Greenfield if less than 5 code files
    [ "$code_count" -lt 5 ]
}

auto_discover_project_config() {
    local project_path="$1"
    
    if ! [ -d "$project_path" ]; then
        error "Project path does not exist: $project_path"
        return 1
    fi
    
    info "🔍 Auto-discovering project configuration from codebase..."
    
    # Initialize project data
    declare -g -A discovered_data=(
        [projectPath]="$project_path"
        [projectName]=""
        [projectType]=""
        [languages]=""
        [architecturePattern]=""
        [testingStrategy]=""
        [codingStandards]=""
        [projectIntent]=""
        [businessValue]=""
        [frameworks]=""
    )
    
    # Project name from directory
    local project_basename=$(basename "$project_path")
    if [ "$project_basename" = "." ] || [ -z "$project_basename" ]; then
        # For current directory, use the parent directory name
        discovered_data[projectName]=$(basename "$(pwd)" | sed 's/[^a-zA-Z0-9 ]/ /g')
    else
        discovered_data[projectName]=$(echo "$project_basename" | sed 's/[^a-zA-Z0-9 ]/ /g')
    fi
    
    # Detect languages
    local languages=()
    [ $(find "$project_path" -name "*.js" | grep -v node_modules | grep -v ".min." | head -1) ] && languages+=("JavaScript")
    [ $(find "$project_path" -name "*.ts" | grep -v node_modules | grep -v ".min." | head -1) ] && languages+=("TypeScript")
    [ $(find "$project_path" -name "*.py" | head -1) ] && languages+=("Python")
    [ $(find "$project_path" -name "*.java" | head -1) ] && languages+=("Java")
    [ $(find "$project_path" -name "*.cs" | head -1) ] && languages+=("C#")
    [ $(find "$project_path" -name "*.go" | head -1) ] && languages+=("Go")
    [ $(find "$project_path" -name "*.rs" | head -1) ] && languages+=("Rust")
    [ $(find "$project_path" -name "*.php" | head -1) ] && languages+=("PHP")
    
    discovered_data[languages]=$(IFS=', '; echo "${languages[*]}")
    
    # Detect project type and frameworks
    if [ -f "$project_path/package.json" ]; then
        local package_content=$(cat "$project_path/package.json" 2>/dev/null || echo "{}")
        
        # Check for web frameworks
        if echo "$package_content" | grep -q -E '"(react|vue|angular|svelte)"'; then
            discovered_data[projectType]="web_application"
            discovered_data[architecturePattern]="Component-Based Architecture"
            
            # Specific framework detection
            if echo "$package_content" | grep -q '"react"'; then
                discovered_data[frameworks]="React"
            elif echo "$package_content" | grep -q '"vue"'; then
                discovered_data[frameworks]="Vue.js"
            elif echo "$package_content" | grep -q '"angular"'; then
                discovered_data[frameworks]="Angular"
            fi
            
        elif echo "$package_content" | grep -q -E '"(express|koa|fastify|hapi)"'; then
            discovered_data[projectType]="api_service"
            discovered_data[architecturePattern]="Layered Architecture"
            discovered_data[frameworks]="Express.js/Node.js"
            
        elif echo "$package_content" | grep -q '"next"'; then
            discovered_data[projectType]="web_application"
            discovered_data[architecturePattern]="Full-Stack Framework"
            discovered_data[frameworks]="Next.js"
            
        else
            discovered_data[projectType]="library"
            discovered_data[architecturePattern]="Modular Architecture"
        fi
        
    elif [ -f "$project_path/requirements.txt" ] || [ -f "$project_path/pyproject.toml" ] || [ -f "$project_path/setup.py" ]; then
        # Python project
        if grep -q -E "(fastapi|flask|django)" "$project_path/requirements.txt" 2>/dev/null; then
            discovered_data[projectType]="api_service"
            discovered_data[architecturePattern]="MVC Pattern"
        else
            discovered_data[projectType]="library"
            discovered_data[architecturePattern]="Modular Architecture"
        fi
        
    elif [ -f "$project_path/pom.xml" ] || [ -f "$project_path/build.gradle" ]; then
        # Java project
        discovered_data[projectType]="api_service"
        discovered_data[architecturePattern]="Layered Architecture"
        
    elif [ -f "$project_path/Cargo.toml" ]; then
        # Rust project
        discovered_data[projectType]="cli_tool"
        discovered_data[architecturePattern]="Modular Architecture"
        
    elif [ -f "$project_path/go.mod" ]; then
        # Go project
        discovered_data[projectType]="api_service"
        discovered_data[architecturePattern]="Clean Architecture"
        
    else
        discovered_data[projectType]="other"
        discovered_data[architecturePattern]="Custom Architecture"
    fi
    
    # Detect testing strategy
    local test_files=$(find "$project_path" -name "*test*" -o -name "*spec*" | grep -v node_modules | wc -l)
    if [ "$test_files" -gt 0 ]; then
        if [ -f "$project_path/package.json" ] && grep -q -E '"(jest|cypress|playwright)"' "$project_path/package.json"; then
            discovered_data[testingStrategy]="Unit + Integration + E2E Testing"
        elif [ -f "$project_path/package.json" ] && grep -q '"jest"' "$project_path/package.json"; then
            discovered_data[testingStrategy]="Unit + Integration Testing"
        else
            discovered_data[testingStrategy]="Unit Testing Only"
        fi
    else
        discovered_data[testingStrategy]="No formal testing yet"
    fi
    
    # Detect coding standards
    if [ -f "$project_path/.eslintrc.js" ] || [ -f "$project_path/.eslintrc.json" ] || [ -f "$project_path/.prettierrc" ]; then
        discovered_data[codingStandards]="Strict (ESLint/Prettier with custom rules)"
    elif [ -f "$project_path/package.json" ] && grep -q -E '"(eslint|prettier)"' "$project_path/package.json"; then
        discovered_data[codingStandards]="Standard (Default linter rules)"
    else
        discovered_data[codingStandards]="Relaxed (Basic formatting only)"
    fi
    
    # Smart project intent detection
    local intent_found=false
    local business_value=""
    
    # First try: Extract clean description from package.json
    if [ -f "$project_path/package.json" ]; then
        local description=$(grep '"description"' "$project_path/package.json" | sed 's/.*"description"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
        if [ -n "$description" ] && [ "$description" != "null" ] && [ ${#description} -gt 10 ]; then
            discovered_data[projectIntent]="$description"
            intent_found=true
        fi
    fi
    
    # Second try: Extract from README.md with better parsing
    if [ "$intent_found" = false ]; then
        local readme_file=""
        [ -f "$project_path/README.md" ] && readme_file="$project_path/README.md"
        [ -f "$project_path/readme.md" ] && readme_file="$project_path/readme.md"
        [ -f "$project_path/README.txt" ] && readme_file="$project_path/README.txt"
        
        if [ -n "$readme_file" ]; then
            # Look for the first substantial description after the title
            local readme_content=$(sed -n '1,30p' "$readme_file" | \
                grep -v "^#" | \
                grep -v "^\[" | \
                grep -v "^!" | \
                grep -v "^$" | \
                grep -v "^-" | \
                grep -v "^\*" | \
                head -3 | \
                tr '\n' ' ' | \
                sed 's/[*_`]//g' | \
                sed 's/\[.*\]//g' | \
                sed 's/emoji:[^:]*://g' | \
                head -c 250)
            
            # Clean up the text
            readme_content=$(echo "$readme_content" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
            
            if [ -n "$readme_content" ] && [ ${#readme_content} -gt 20 ]; then
                discovered_data[projectIntent]="$readme_content"
                intent_found=true
            fi
        fi
    fi
    
    # Fallback: Generate based on project type and name
    if [ "$intent_found" = false ]; then
        case "${discovered_data[projectType]}" in
            "web_application")
                discovered_data[projectIntent]="A web application built with ${discovered_data[frameworks]:-modern web technologies}"
                business_value="Provide web-based functionality and user experience"
                ;;
            "api_service")
                discovered_data[projectIntent]="A ${discovered_data[frameworks]:-REST API} service for backend functionality"
                business_value="Provide reliable API endpoints and backend services"
                ;;
            "library")
                discovered_data[projectIntent]="A reusable ${discovered_data[languages]} library for developers"
                business_value="Enable code reuse and accelerate development across projects"
                ;;
            "cli_tool")
                discovered_data[projectIntent]="A command-line tool built with ${discovered_data[languages]}"
                business_value="Provide efficient command-line automation and utilities"
                ;;
            *)
                discovered_data[projectIntent]="A ${discovered_data[languages]} project for software development"
                business_value="Support development and operational needs"
                ;;
        esac
    fi
    
    # Set business value based on project type if not already set
    if [ -z "$business_value" ]; then
        case "${discovered_data[projectType]}" in
            "web_application") business_value="Deliver quality web application experience to users" ;;
            "api_service") business_value="Provide reliable and scalable backend services" ;;
            "library") business_value="Enable code reuse and accelerate development workflows" ;;
            "cli_tool") business_value="Streamline command-line workflows and automation" ;;
            *) business_value="Support business objectives through software solutions" ;;
        esac
    fi
    
    discovered_data[businessValue]="$business_value"
    
    # Display discovered configuration
    success "✅ Auto-discovery completed! Found:"
    info "  📦 Project: ${discovered_data[projectName]}"
    info "  🏗️  Type: ${discovered_data[projectType]}"
    info "  💻 Languages: ${discovered_data[languages]}"
    info "  🏛️  Architecture: ${discovered_data[architecturePattern]}"
    info "  🧪 Testing: ${discovered_data[testingStrategy]}"
    info "  📏 Standards: ${discovered_data[codingStandards]}"
    if [ -n "${discovered_data[frameworks]}" ]; then
        info "  🚀 Frameworks: ${discovered_data[frameworks]}"
    fi
    echo
    
    read -p "Does this look correct? (Y/n): " confirm_discovery
    if [[ "$confirm_discovery" =~ ^[Nn]$ ]]; then
        warning "Auto-discovery cancelled. Please run interactive setup instead."
        return 1
    fi
    
    return 0
}

get_claude_code_enhancement() {
    local question="$1"
    local user_answer="$2"
    local context="$3"
    local project_path="$4"
    
    if is_greenfield_project "$project_path"; then
        info "🆕 GREENFIELD PROJECT DETECTED - Copy this prompt to Claude Code (anywhere with project docs):"
        echo
        print_color "$BLUE" "═══════════════════ CLAUDE CODE PROMPT ═══════════════════"
        echo
        echo "I'm setting up a NEW project and need your help enhancing my project setup decision."
        echo
        echo "Project Setup Question: $question"
        echo "My Current Answer: $user_answer"
        echo "Project Context: $context"
        echo
        echo "Since this is a greenfield project, please provide:"
        echo "1. Specific implementation recommendations for this tech stack"
        echo "2. Industry best practices for this type of project"
        echo "3. Common architectural patterns I should consider"
        echo "4. Potential challenges and how to avoid them early"
        echo "5. Key decisions I should make now to prevent technical debt"
        echo
        echo "Keep response concise (3-4 sentences) focused on actionable setup guidance."
        print_color "$BLUE" "═══════════════════════════════════════════════════════════"
        echo
        warning "📍 IMPORTANT: Paste this prompt in Claude Code anywhere (doesn't need to be in project folder since it's new)"
    else
        warning "📁 EXISTING PROJECT DETECTED - Open Claude Code IN YOUR PROJECT FOLDER first!"
        echo
        info "1. Open Claude Code"
        info "2. Navigate to your project folder: $project_path"
        info "3. Then paste this prompt:"
        echo
        print_color "$BLUE" "═══════════════════ CLAUDE CODE PROMPT ═══════════════════"
        echo
        echo "I'm configuring CodeMind for this existing project. Please analyze the codebase and enhance my answer."
        echo
        echo "Setup Question: $question"
        echo "My Answer: $user_answer"
        echo "Project Context: $context"
        echo
        echo "Based on the actual code you can see in this project, please:"
        echo "1. Validate my answer against the existing codebase"
        echo "2. Suggest improvements based on current patterns"
        echo "3. Identify any inconsistencies with existing code"
        echo "4. Recommend specific next steps for this codebase"
        echo
        echo "Keep response concise (2-3 sentences) based on what you observe in the code."
        print_color "$BLUE" "═══════════════════════════════════════════════════════════"
        echo
        error "🚨 CRITICAL: This only works if Claude Code is opened in the project folder!"
    fi
    echo
    
    info "After getting Claude Code's response, paste it here:"
    read -p "Enhanced answer (or press Enter to keep original): " enhanced_answer
    
    if [ -n "${enhanced_answer// }" ]; then
        info "🤖 Using Claude Code's enhanced version"
        echo "$enhanced_answer"
    else
        info "📝 Keeping original answer"
        echo "$user_answer"
    fi
}

call_claude_api() {
    local prompt="$1"
    local max_tokens="${2:-500}"
    
    if [ -z "$ANTHROPIC_API_KEY" ]; then
        warning "⚠️  No Claude API key provided. Using default responses."
        return 1
    fi

    local body=$(cat <<EOF
{
    "model": "claude-3-haiku-20240307",
    "max_tokens": $max_tokens,
    "messages": [
        {
            "role": "user", 
            "content": "$prompt"
        }
    ]
}
EOF
)

    local response=$(curl -s -X POST "$CLAUDE_API" \
        -H "x-api-key: $ANTHROPIC_API_KEY" \
        -H "anthropic-version: 2023-06-01" \
        -H "content-type: application/json" \
        -d "$body")
    
    if [ $? -eq 0 ]; then
        echo "$response" | jq -r '.content[0].text' 2>/dev/null
    else
        warning "⚠️  Claude API call failed"
        return 1
    fi
}

get_user_choice() {
    local prompt="$1"
    local -a options=("${@:2}")
    
    question "$prompt"
    for i in "${!options[@]}"; do
        echo "  $((i+1)). ${options[$i]}"
    done
    echo "  Or type a custom answer"
    
    while true; do
        read -p $'\n'"Your choice (1-${#options[@]} or custom): " choice
        
        if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#options[@]}" ]; then
            echo "${options[$((choice-1))]}"
            return
        elif [ -n "${choice// }" ]; then
            echo "$choice"
            return
        else
            warning "Please enter a valid choice or custom answer."
        fi
    done
}

call_claude_cli() {
    local prompt="$1"
    local project_path="$2"
    
    # Check if Claude CLI is available
    if ! command -v claude >/dev/null 2>&1; then
        warning "Claude CLI not found. Install from: npm install -g @anthropics/claude-cli"
        return 1
    fi
    
    local claude_opts="--print"
    
    # For existing projects, add the project directory for context
    if [ -n "$project_path" ] && [ -d "$project_path" ] && ! is_greenfield_project "$project_path"; then
        claude_opts="$claude_opts --add-dir \"$project_path\""
    fi
    
    # Call Claude CLI with the prompt
    echo "$prompt" | claude $claude_opts 2>/dev/null
}

get_enhanced_answer() {
    local question="$1"
    local user_answer="$2"
    local context="$3"
    
    if [ "$USE_CLAUDE_CODE" = true ]; then
        echo
        info "🤖 Choose Claude Code enhancement method:"
        echo "1. Automatic (Claude CLI) - Recommended"
        echo "2. Manual copy-paste prompts"
        echo "3. Skip enhancement"
        read -p "Your choice (1-3): " enhancement_method
        
        case "$enhancement_method" in
            "1"|"")
                # Automatic Claude CLI enhancement
                local is_greenfield=false
                is_greenfield_project "$PROJECT_PATH" && is_greenfield=true
                
                if [ "$is_greenfield" = true ]; then
                    local prompt="I'm setting up a NEW project and need your help enhancing my project setup decision.

Project Setup Question: $question
My Current Answer: $user_answer
Project Context: $context

Since this is a greenfield project, please provide:
1. Specific implementation recommendations for this tech stack
2. Industry best practices for this type of project
3. Common architectural patterns I should consider
4. Potential challenges and how to avoid them early
5. Key decisions I should make now to prevent technical debt

Keep response concise (3-4 sentences) focused on actionable setup guidance."
                    
                    info "🆕 Enhancing with Claude CLI (greenfield project)..."
                else
                    local prompt="I'm configuring CodeMind for this existing project. Please analyze the codebase and enhance my answer.

Setup Question: $question
My Answer: $user_answer
Project Context: $context

Based on the actual code you can see in this project, please:
1. Validate my answer against the existing codebase
2. Suggest improvements based on current patterns
3. Identify any inconsistencies with existing code
4. Recommend specific next steps for this codebase

Keep response concise (2-3 sentences) based on what you observe in the code."
                    
                    info "📁 Enhancing with Claude CLI (existing project with codebase access)..."
                fi
                
                local enhanced_result=$(call_claude_cli "$prompt" "$PROJECT_PATH")
                if [ $? -eq 0 ] && [ -n "$enhanced_result" ]; then
                    success "✅ Claude CLI enhancement successful"
                    example "$enhanced_result"
                    echo "$enhanced_result"
                else
                    warning "⚠️  Claude CLI enhancement failed, using original answer"
                    echo "$user_answer"
                fi
                ;;
            "2")
                # Manual copy-paste method
                get_claude_code_enhancement "$question" "$user_answer" "$context" "$PROJECT_PATH"
                ;;
            *)
                # Skip enhancement
                echo "$user_answer"
                ;;
        esac
        return
    fi
    
    if [ -z "$ANTHROPIC_API_KEY" ]; then
        echo "$user_answer"
        return
    fi

    local prompt="You are helping set up a code analysis system. The user answered a question about their project.

Question: $question
User's Answer: $user_answer
Project Context: $context

Please enhance their answer with:
1. More specific technical details
2. Relevant best practices
3. Common patterns for this type of project
4. Potential challenges or considerations

Keep the response concise (2-3 sentences max) and focused on actionable insights.
Return only the enhanced answer, no preamble."

    local enhanced=$(call_claude_api "$prompt" 300)
    
    if [ -n "$enhanced" ] && [ "$enhanced" != "null" ]; then
        info "🤖 Claude's enhanced insight:"
        example "$enhanced"
        
        local use_enhanced=$(get_user_choice "Use Claude's enhanced version?" "Yes, use enhanced" "No, keep original" "Let me modify it")
        
        case "$use_enhanced" in
            "Yes, use enhanced") echo "$enhanced" ;;
            "Let me modify it")
                question "Enter your modified version:"
                read -r modified_answer
                echo "$modified_answer"
                ;;
            *) echo "$user_answer" ;;
        esac
    else
        echo "$user_answer"
    fi
}

# Parse command line arguments
PROJECT_PATH=""
SKIP_INTERACTIVE=false
AUTO_DISCOVERY=false
UPDATE_EXISTING=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -p|--project-path)
            PROJECT_PATH="$2"
            shift 2
            ;;
        -s|--skip|--skip-interactive)
            SKIP_INTERACTIVE=true
            shift
            ;;
        -a|--auto|--auto-discovery)
            AUTO_DISCOVERY=true
            shift
            ;;
        -u|--update|--override)
            UPDATE_EXISTING=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 -p PROJECT_PATH [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -p, --project-path    Project path (required)"
            echo "  -s, --skip            Skip interactive questions"
            echo "  -a, --auto-discovery  Automatically analyze codebase and infer configuration"
            echo "  -u, --update          Override existing project data in database"
            echo "      --override        (alias for --update)"
            echo "  -h, --help           Show this help"
            echo ""
            echo "Environment variables:"
            echo "  ANTHROPIC_API_KEY    Claude API key for enhanced analysis"
            exit 0
            ;;
        *)
            error "Unknown option $1"
            echo "Usage: $0 -p PROJECT_PATH [OPTIONS]"
            echo "Try '$0 --help' for more information."
            exit 1
            ;;
    esac
done

if [ -z "$PROJECT_PATH" ]; then
    error "❌ Project path is required. Use -p or --project-path"
    echo "Usage: $0 -p PROJECT_PATH [OPTIONS]"
    echo "Try '$0 --help' for more information."
    exit 1
fi

# Main setup flow
# Choose enhancement method only if not using auto-discovery
if [ "$AUTO_DISCOVERY" = false ]; then
    info "🤖 Choose how to enhance project analysis:"
    echo "1. Use Claude Code (recommended for interactive enhancement)"
    echo "2. Use Claude API (automatic enhancement with API key)"
    echo "3. No enhancement (basic setup only)"
    echo
    read -p "Your choice (1-3): " enhancement_choice

    case "$enhancement_choice" in
        1)
            USE_CLAUDE_CODE=true
            success "✅ Will use Claude Code for interactive enhancement"
            info "   You'll receive prompts to copy/paste to Claude Code during setup"
            ;;
        2)
            if [ -z "$ANTHROPIC_API_KEY" ]; then
                warning "⚠️  ANTHROPIC_API_KEY not set. Please export your Claude API key:"
                warning "   export ANTHROPIC_API_KEY='your-api-key-here'"
                read -p "Continue without API enhancement? (y/N): " continue_choice
                if [[ ! "$continue_choice" =~ ^[Yy]$ ]]; then
                    exit 1
                fi
            else
                success "✅ Will use Claude API for automatic enhancement"
            fi
            ;;
        3)
            success "✅ Basic setup mode selected"
            ;;
        *)
            warning "Invalid choice. Using basic setup mode."
            ;;
    esac
else
    info "🤖 Auto-discovery mode selected - using basic setup without interactive enhancement"
    success "✅ Basic setup mode for auto-discovered configuration"
fi

echo

success "🚀 CodeMind Interactive Setup"
info "Setting up intelligent analysis for: $PROJECT_PATH"
info "=================================================="

# Check CodeMind API
if ! curl -s "$CODEMIND_API/health" > /dev/null; then
    error "❌ CodeMind API not available at $CODEMIND_API"
    warning "   Start it with: docker-compose -f docker-compose.postgres.yml up -d"
    exit 1
fi
success "✅ CodeMind API is running"

# Initialize project data
declare -A project_data=(
    [projectPath]="$PROJECT_PATH"
    [projectName]=""
    [description]=""
    [projectType]="unknown"
    [architecturePattern]=""
    [testingStrategy]=""
    [codingStandards]=""
    [targetAudience]=""
    [deploymentModel]=""
)

declare -a languages=()
declare -a frameworks=()
declare -a primary_goals=()
declare -a quality_requirements=()

if [ "$AUTO_DISCOVERY" = true ]; then
    # Use auto-discovery to populate project data
    if auto_discover_project_config "$PROJECT_PATH"; then
        info "🎯 Using auto-discovered configuration..."
        
        # Map discovered data to project_data structure
        project_data[projectName]="${discovered_data[projectName]}"
        project_data[description]="${discovered_data[projectIntent]}"
        project_data[projectType]="${discovered_data[projectType]}"
        project_data[architecturePattern]="${discovered_data[architecturePattern]}"
        project_data[testingStrategy]="${discovered_data[testingStrategy]}"
        project_data[codingStandards]="${discovered_data[codingStandards]}"
        project_data[targetAudience]="Developers and end-users"
        project_data[deploymentModel]="Standard deployment for ${discovered_data[projectType]}"
        
        # Parse languages into array
        IFS=', ' read -ra languages <<< "${discovered_data[languages]}"
        
        # Set frameworks if discovered
        if [ -n "${discovered_data[frameworks]}" ]; then
            IFS=', ' read -ra frameworks <<< "${discovered_data[frameworks]}"
        fi
        
        # Set primary goals and quality requirements based on project type
        case "${discovered_data[projectType]}" in
            "web_application") 
                primary_goals=("User Experience" "Performance" "Scalability") 
                quality_requirements=("High Performance" "Good UX" "Scalable")
                project_data[projectIntent]="${discovered_data[projectIntent]}"
                project_data[businessValue]="Deliver quality web application to users"
                ;;
            "api_service") 
                primary_goals=("Performance" "Reliability" "Security") 
                quality_requirements=("High Performance" "High Reliability" "Secure")
                project_data[projectIntent]="${discovered_data[projectIntent]}"
                project_data[businessValue]="Provide reliable API services to clients"
                ;;
            "library") 
                primary_goals=("Reusability" "Documentation" "Testing") 
                quality_requirements=("Well Documented" "Thoroughly Tested" "Reusable")
                project_data[projectIntent]="${discovered_data[projectIntent]}"
                project_data[businessValue]="Enable code reuse and accelerate development"
                ;;
            "cli_tool") 
                primary_goals=("Usability" "Performance" "Portability") 
                quality_requirements=("User Friendly" "Fast" "Cross Platform")
                project_data[projectIntent]="${discovered_data[projectIntent]}"
                project_data[businessValue]="Provide efficient command-line tool for users"
                ;;
            *) 
                primary_goals=("Quality" "Maintainability" "Performance") 
                quality_requirements=("High Quality" "Maintainable" "Good Performance")
                project_data[projectIntent]="${discovered_data[projectIntent]}"
                project_data[businessValue]="${discovered_data[businessValue]}"
                ;;
        esac
        
        success "✅ Auto-discovery completed successfully!"
    else
        error "❌ Auto-discovery failed. Falling back to interactive mode..."
        AUTO_DISCOVERY=false
    fi
fi

if [ "$SKIP_INTERACTIVE" = false ] && [ "$AUTO_DISCOVERY" = false ]; then
    info "📋 Let's gather information about your project..."
    
    # Project Name
    default_name=$(basename "$PROJECT_PATH" | sed 's/[^a-zA-Z0-9 ]/ /g')
    read -p "Project name (default: $default_name): " project_name
    project_data[projectName]="${project_name:-$default_name}"
    
    # Project Description
    read -p "Brief project description: " description
    project_data[description]="$description"
    
    # Project Type
    project_type=$(get_user_choice "What type of project is this?" \
        "Web Application (Frontend + Backend)" \
        "API Service (Backend only)" \
        "Library/Package (Reusable code)" \
        "Mobile Application" \
        "Desktop Application" \
        "CLI Tool" \
        "Data Processing Pipeline" \
        "Machine Learning Project")
    
    case "$project_type" in
        *"Web Application"*) project_data[projectType]="web_application" ;;
        *"API Service"*) project_data[projectType]="api_service" ;;
        *"Library"*) project_data[projectType]="library" ;;
        *"Mobile"*) project_data[projectType]="mobile_app" ;;
        *"Desktop"*) project_data[projectType]="desktop_app" ;;
        *"CLI"*) project_data[projectType]="cli_tool" ;;
        *) project_data[projectType]="unknown" ;;
    esac
    
    # Languages
    question "Select primary languages (comma-separated):"
    echo "  Examples: typescript,javascript  or  python,django  or  java,spring"
    read -p "Languages: " lang_input
    
    IFS=',' read -ra ADDR <<< "$lang_input"
    for lang in "${ADDR[@]}"; do
        languages+=($(echo "$lang" | xargs | tr '[:upper:]' '[:lower:]'))
    done
    
    # Architecture Pattern  
    context="Project: ${project_data[projectName]}, Type: $project_type, Languages: ${languages[*]}"
    arch_pattern=$(get_user_choice "What architectural pattern do you follow?" \
        "Model-View-Controller (MVC)" \
        "Model-View-ViewModel (MVVM)" \
        "Component-Based Architecture" \
        "Microservices" \
        "Layered Architecture" \
        "Event-Driven Architecture" \
        "Hexagonal Architecture" \
        "Not sure / Need recommendations")
    
    project_data[architecturePattern]=$(get_enhanced_answer "Architectural pattern" "$arch_pattern" "$context")
    
    # Testing Strategy
    testing_strategy=$(get_user_choice "What's your testing approach?" \
        "Unit Testing Only" \
        "Unit + Integration Testing" \
        "Unit + Integration + E2E Testing" \
        "Test-Driven Development (TDD)" \
        "Behavior-Driven Development (BDD)" \
        "No formal testing yet" \
        "Need testing recommendations")
    
    project_data[testingStrategy]=$(get_enhanced_answer "Testing strategy" "$testing_strategy" "$context")
    
    # Coding Standards
    coding_standards=$(get_user_choice "What coding standards do you follow?" \
        "Strict (ESLint/Prettier with custom rules)" \
        "Standard (Default linter rules)" \
        "Relaxed (Basic formatting only)" \
        "Company/Team specific standards" \
        "Following industry best practices" \
        "No formal standards yet" \
        "Need standards recommendations")
    
    project_data[codingStandards]=$(get_enhanced_answer "Coding standards" "$coding_standards" "$context")
    
    # Project Intent (Primary Goals)
    question "What is the main purpose of this project? (Project Intent)"
    example "Examples:"
    example "  • Build a user authentication system with JWT tokens"
    example "  • Create an e-commerce platform with payment processing"
    example "  • Develop a real-time chat application for customer support"
    example "  • Build a data analytics dashboard for sales insights"
    read -p "Project intent: " project_intent
    project_data[projectIntent]="$project_intent"

    # Business Value
    question "Why is this project important? (Business Value)"
    example "Examples:"
    example "  • Enable secure user access and account management"
    example "  • Allow customers to purchase products online"
    example "  • Improve customer service response times and satisfaction"
    example "  • Provide data-driven insights for business decisions"
    read -p "Business value: " business_value
    project_data[businessValue]="$business_value"

    # Quality Requirements (Non-functional requirements)
    question "What quality standards must this project meet? (comma-separated numbers)"
    echo "  1. High performance (fast response times)"
    echo "  2. High security (data protection, authentication)"
    echo "  3. High availability (minimal downtime)"
    echo "  4. Scalability (handle increasing load)"
    echo "  5. Maintainability (easy to modify and extend)"
    echo "  6. Usability (intuitive user experience)"
    echo "  7. Reliability (consistent, error-free operation)"
    echo "  8. Accessibility (support for disabled users)"
    
    read -p "Your choices: " quality_input
    quality_options=("High performance" "High security" "High availability" 
                    "Scalability" "Maintainability" "Usability"
                    "Reliability" "Accessibility")
    
    declare -a quality_requirements=()
    IFS=',' read -ra quality_nums <<< "$quality_input"
    for quality_num in "${quality_nums[@]}"; do
        quality_num=$(echo "$quality_num" | xargs)
        if [[ "$quality_num" =~ ^[1-8]$ ]]; then
            quality_requirements+=("${quality_options[$((quality_num-1))]}")
        fi
    done
    
    success "🎯 Great! I have all the information needed."
fi

# Generate Claude analysis
claude_analysis=""
if [ -n "$ANTHROPIC_API_KEY" ]; then
    info "🤖 Having Claude analyze your project setup..."
    
    analysis_prompt="Based on this project information, provide a comprehensive analysis:

Project: ${project_data[projectName]}
Type: ${project_data[projectType]}
Languages: ${languages[*]}
Architecture: ${project_data[architecturePattern]}
Testing: ${project_data[testingStrategy]}
Standards: ${project_data[codingStandards]}
Goals: ${primary_goals[*]}

Please provide:
1. Key architectural recommendations
2. Suggested development workflow
3. Potential challenges and solutions
4. Best practices for this technology stack
5. Quality metrics to track

Format as concise bullet points for inclusion in CLAUDE.md."

    claude_analysis=$(call_claude_api "$analysis_prompt" 800)
    
    if [ -n "$claude_analysis" ] && [ "$claude_analysis" != "null" ]; then
        info "📊 Claude's Project Analysis:"
        example "$claude_analysis"
    fi
fi

# Prepare API request
languages_json=$(printf '%s\n' "${languages[@]}" | jq -R . | jq -s .)
quality_json=$(printf '%s\n' "${quality_requirements[@]}" | jq -R . | jq -s .)

init_body=$(cat <<EOF
{
    "projectPath": "${project_data[projectPath]}",
    "mode": "auto",
    "batchSize": 50,
    "override": $([ "$UPDATE_EXISTING" = true ] && echo "true" || echo "false"),
    "metadata": {
        "projectName": "${project_data[projectName]}",
        "description": "${project_data[description]}",
        "projectType": "${project_data[projectType]}",
        "languages": $languages_json,
        "frameworks": [],
        "architecturePattern": "${project_data[architecturePattern]}",
        "testingStrategy": "${project_data[testingStrategy]}",
        "codingStandards": "${project_data[codingStandards]}",
        "projectIntent": "${project_data[projectIntent]}",
        "businessValue": "${project_data[businessValue]}",
        "qualityRequirements": $quality_json,
        "setupDate": "$(date +%Y-%m-%d)",
        "claudeIntegration": true,
        "interactiveSetup": true,
        "claudeAnalysis": "$claude_analysis"
    }
}
EOF
)

# Initialize with CodeMind
info "🚀 Initializing CodeMind with enhanced project data..."

init_response=$(curl -s -X POST "$CODEMIND_API/init" \
    -H "Content-Type: application/json" \
    -d "$init_body")

if echo "$init_response" | jq -e '.success' > /dev/null 2>&1; then
    success "✅ Project initialized successfully"
    resume_token=$(echo "$init_response" | jq -r '.data.resumeToken')
    info "   Resume Token: $resume_token"
    
    # Display final processed project data
    if [ "$UPDATE_EXISTING" = true ]; then
        info "🔄 Project data updated in database"
    fi
    
    # Show the processed data that was stored
    info "📊 Final Project Configuration Stored:"
    info "   • Project: ${project_data[projectName]}"
    info "   • Type: ${project_data[projectType]}"
    info "   • Languages: ${languages[*]}"
    info "   • Architecture: ${project_data[architecturePattern]}"
    info "   • Testing: ${project_data[testingStrategy]}"
    info "   • Standards: ${project_data[codingStandards]}"
    info "   • Intent: ${project_data[projectIntent]}"
    info "   • Business Value: ${project_data[businessValue]}"
    if [ -n "$claude_analysis" ] && [ "$claude_analysis" != "null" ]; then
        info "   • Claude Analysis: ✅ Enhanced with AI insights"
    fi
else
    error "❌ Initialization failed:"
    echo "$init_response"
    exit 1
fi

# Get smart questions
info "❓ Generating contextual questions..."
questions_response=$(curl -s "$CODEMIND_API/claude/suggest-questions/${project_data[projectPath]}?maxQuestions=8")
questions=$(echo "$questions_response" | jq -r '.data.questions[]' 2>/dev/null | sed 's/^/- /' || echo "- What specific coding patterns should I follow?
- How should I structure the test files?
- What quality metrics are most important?")

# Create enhanced CLAUDE.md
info "📝 Creating enhanced CLAUDE.md..."

claude_analysis_section=""
if [ -n "$claude_analysis" ] && [ "$claude_analysis" != "null" ]; then
    claude_analysis_section="
## Claude's Project Analysis

$claude_analysis"
fi

cat > CLAUDE.md << EOF
# CLAUDE.md - ${project_data[projectName]}

This file provides comprehensive guidance to Claude Code when working with this project.

## Project Overview

**Project**: ${project_data[projectName]}
**Type**: ${project_data[projectType]}
**Description**: ${project_data[description]}
**Languages**: $(IFS=','; echo "${languages[*]}")
**Architecture**: ${project_data[architecturePattern]}
**Testing Strategy**: ${project_data[testingStrategy]}
**Coding Standards**: ${project_data[codingStandards]}
**Project Intent**: ${project_data[projectIntent]}
**Business Value**: ${project_data[businessValue]}
**Quality Requirements**: $(IFS=','; echo "${quality_requirements[*]}")

## CodeMind Integration

This project uses the CodeMind Intelligent Code Auxiliary System for enhanced context and analysis.

### Token-Efficient API Usage

**Environment Setup:**
\`\`\`bash
export CODEMIND_API_URL="$CODEMIND_API"
export PROJECT_PATH="${project_data[projectPath]}"
\`\`\`

### Intelligent Context Patterns

#### Before Any Changes (Overview - ~200 tokens)
\`\`\`bash
curl "\$CODEMIND_API_URL/claude/context/\$PROJECT_PATH?intent=overview"
\`\`\`

#### Before Coding (Development Context - ~500 tokens)
\`\`\`bash
curl "\$CODEMIND_API_URL/claude/context/\$PROJECT_PATH?intent=coding&maxTokens=800"
\`\`\`

#### For Architecture Decisions (Detailed Analysis - ~1000 tokens)
\`\`\`bash
curl "\$CODEMIND_API_URL/claude/context/\$PROJECT_PATH?intent=architecture&maxTokens=1500"
\`\`\`

#### When Debugging (Error Context - ~600 tokens)
\`\`\`bash
curl "\$CODEMIND_API_URL/claude/context/\$PROJECT_PATH?intent=debugging&maxTokens=1000"
\`\`\`

#### For User Interaction (Smart Questions)
\`\`\`bash
curl "\$CODEMIND_API_URL/claude/suggest-questions/\$PROJECT_PATH?maxQuestions=3"
\`\`\`

### Project-Specific Workflow

1. **Start every session** with overview context to understand current state
2. **Before creating features** get coding context for patterns and standards
3. **For architectural changes** use architecture context for design guidance
4. **When debugging** use error context for common issues and solutions
5. **For user requirements** use smart questions to gather focused information

### Smart Questions for User Interaction

When you need to gather requirements, consider asking:

$questions
$claude_analysis_section

## Development Guidelines

### Architecture Principles
- Follow ${project_data[architecturePattern]} patterns consistently
- Use the coding context API before creating new components
- Validate architectural decisions with the architecture context endpoint

### Testing Approach
- Implement ${project_data[testingStrategy]}
- Use debugging context when tests fail
- Check existing test patterns before adding new ones

### Code Quality Standards
- Maintain ${project_data[codingStandards]}
- Use smart questions to clarify quality requirements
- Project Intent: ${project_data[projectIntent]}
- Quality Focus: $(IFS=','; echo "${quality_requirements[*]}")

### Integration Notes

- All CodeMind API calls are cached for 5 minutes
- Context responses are optimized for token efficiency
- Different intents provide focused information for specific tasks
- The system learns from your project patterns over time

**Setup completed**: $(date +"%Y-%m-%d %H:%M")
**Integration**: Interactive Enhanced Setup v2.0
**Resume Token**: $resume_token
EOF

success "✅ Enhanced CLAUDE.md created with intelligent guidance"

# Final test
info "🧪 Testing enhanced integration..."
test_response=$(curl -s "$CODEMIND_API/claude/context/${project_data[projectPath]}?intent=coding&maxTokens=600")
if echo "$test_response" | jq -e '.success' > /dev/null 2>&1; then
    success "✅ Integration test successful"
    info "   Context API working with enhanced project data"
else
    warning "⚠️  Test failed but setup is complete"
fi

# Summary
echo
success "🎉 Enhanced CodeMind Setup Complete!"
info "=================================================="
success "✅ Interactive project analysis completed"
success "✅ Claude-enhanced insights integrated"
success "✅ Smart questions generated for your project type"
success "✅ Token-efficient API patterns configured"
success "✅ Project-specific CLAUDE.md created"
info "Your CodeMind integration is now optimized for:"
info "• ${project_data[architecturePattern]}"
info "• ${project_data[testingStrategy]}"
info "• ${project_data[codingStandards]}"
info "• Intent: ${project_data[projectIntent]}"
info "• Quality: $(IFS=','; echo "${quality_requirements[*]}")"
success "Next: Use the API patterns in CLAUDE.md for intelligent, token-efficient development!"