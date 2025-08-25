# CodeMind Setup Guide

Complete installation and configuration guide for the Intelligent Code Auxiliary System.

> **🚀 New to CodeMind?** Check out the [Quick Start Guide](docs/QUICKSTART.md) for a 5-minute setup.

## What You'll Get

After setup, CodeMind provides:
- 🧠 **Smart Context API** - Token-efficient context for Claude Code
- 🔍 **Codebase Analysis** - Automatic pattern and architecture detection
- 💡 **Intelligent Questions** - AI-generated questions for your project state
- 📋 **Development Planning** - Plan management and progress tracking (Phase 4)
- 🤖 **Claude Integration** - CLI and API integration for seamless enhancement

## Prerequisites

### Required
- **Docker & Docker Compose** - For system deployment
- **Git** - For cloning the repository
- **HTTP client** - curl, PowerShell, or similar

### Recommended
- **Claude CLI** - For automatic enhancement: `npm install -g @anthropics/claude-cli`
- **Node.js 16+** - For development and local testing

### Optional
- **Claude API Key** - Alternative to Claude CLI for setup enhancement

## Installation Methods

### Quick Setup (Recommended - 5 minutes)

**Best for: Most users who want the full CodeMind experience**

#### 1. Clone and Start System

```bash
# Navigate to the CodeMind directory
cd C:\workspace\claude\CodeMind

# Start the full PostgreSQL stack
docker-compose -f docker-compose.postgres.yml up -d

# Verify services are running
docker-compose -f docker-compose.postgres.yml ps
```

#### 2. Run Claude Code Interactive Setup

**PowerShell (Windows):**
```powershell
.\scripts\interactive-setup.ps1 -ProjectPath "MyProject" -UseClaudeCode
```

**Bash (Linux/Mac/Git Bash):**
```bash
./scripts/interactive-setup.sh -p "MyProject"
# Select "1. Use Claude Code" when prompted
```

#### 3. Follow Claude Code Prompts

The setup will provide formatted prompts to copy-paste into Claude Code for enhanced analysis. This creates an optimized CLAUDE.md with intelligent guidance tailored to your project.

#### 4. Verify Integration

```bash
# Test the enhanced API
curl "http://localhost:3004/claude/context/MyProject?intent=coding&maxTokens=600"
```

### Method 2: Basic Setup (5 minutes) - No AI Enhancement

#### 1. Clone and Start System

```bash
# Navigate to the CodeMind directory
cd C:\workspace\claude\CodeMind

# Start the full PostgreSQL stack
docker-compose -f docker-compose.postgres.yml up -d
```

#### 2. Verify Services are Running

```bash
# Check service status
docker-compose -f docker-compose.postgres.yml ps

# Expected output:
# codemind-postgres-api    running    0.0.0.0:3004->3004/tcp
# codemind-postgres        running    0.0.0.0:5432->5432/tcp
```

#### 3. Test the API

```bash
# Health check
curl http://localhost:3004/health

# Expected response:
# {"success":true,"data":{"status":"healthy","uptime":"1m 23s","version":"1.0.0"}}
```

### Method 3: Advanced Interactive Setup with API (15 minutes) - Alternative

#### 1. Start the System (same as Method 1)

```bash
cd C:\workspace\claude\CodeMind
docker-compose -f docker-compose.postgres.yml up -d
curl http://localhost:3004/health  # Verify running
```

#### 2. Run Interactive Setup Script

**PowerShell (Windows):**
```powershell
# Option 1: Use Claude Code (Recommended - Interactive Enhancement)
.\scripts\interactive-setup.ps1 -ProjectPath "MyProject" -UseClaudeCode

# Option 2: Use Claude API (Automatic Enhancement)
$env:ANTHROPIC_API_KEY = "your-claude-api-key"
.\scripts\interactive-setup.ps1 -ProjectPath "MyProject" -ClaudeApiKey $env:ANTHROPIC_API_KEY

# Option 3: Basic Setup (No AI Enhancement)
.\scripts\interactive-setup.ps1 -ProjectPath "MyProject" -SkipInteractive
```

**Bash (Linux/Mac/Git Bash):**
```bash
# Option 1: Use Claude Code (Recommended - Interactive Enhancement) 
./scripts/interactive-setup.sh -p "MyProject"
# Select "1. Use Claude Code" when prompted

# Option 2: Use Claude API (Automatic Enhancement)
export ANTHROPIC_API_KEY="your-claude-api-key"
./scripts/interactive-setup.sh -p "MyProject"
# Select "2. Use Claude API" when prompted

# Option 3: Basic Setup (No AI Enhancement)
./scripts/interactive-setup.sh -p "MyProject"
# Select "3. No enhancement" when prompted
```

#### 3. Choose Enhancement Method

When running the script, you'll be asked:
```
🤖 Choose how to enhance project analysis:
1. Use Claude Code (recommended for interactive enhancement)
2. Use Claude API (automatic enhancement with API key)
3. No enhancement (basic setup only)

Your choice (1-3):
```

#### 4. Follow Interactive Prompts

The script will ask about:
- **Project Type**: Web app, API service, library, etc.
- **Languages & Frameworks**: Technology stack
- **Architecture Pattern**: MVC, microservices, component-based, etc.
- **Testing Strategy**: Unit, integration, E2E, TDD, etc.
- **Coding Standards**: Strict, standard, relaxed
- **Project Intent**: What you're building (core functionality)
- **Business Value**: Why it matters (business impact)
- **Quality Requirements**: Non-functional requirements (performance, security, etc.)

#### Claude Code Integration Workflow (Option 1 - Recommended)

When using **Claude Code option**, the setup will:

1. **Detect project type** - Automatically determines if this is a new (greenfield) or existing project
2. **Display context-aware prompts** for copy-paste to Claude Code
3. **Provide specific guidance** based on project status
4. **Integrate AI insights** into your project configuration
5. **Generate optimized CLAUDE.md** with enhanced context

#### Context-Aware Enhancement

**For NEW/GREENFIELD Projects (< 5 code files):**
```
🆕 GREENFIELD PROJECT DETECTED - Copy this prompt to Claude Code (anywhere with project docs):

═══════════════════ CLAUDE CODE PROMPT ═══════════════════

I'm setting up a NEW project and need your help enhancing my project setup decision.

Project Setup Question: What architectural pattern do you follow?
My Current Answer: Component-Based Architecture
Project Context: Project: MyWebApp, Type: web_application, Languages: JavaScript

Since this is a greenfield project, please provide:
1. Specific implementation recommendations for this tech stack
2. Industry best practices for this type of project  
3. Common architectural patterns I should consider
4. Potential challenges and how to avoid them early
5. Key decisions I should make now to prevent technical debt

Keep response concise (3-4 sentences) focused on actionable setup guidance.

═══════════════════════════════════════════════════════════

📍 IMPORTANT: Paste this prompt in Claude Code anywhere (doesn't need to be in project folder since it's new)
```

**For EXISTING Projects (≥ 5 code files):**
```
📁 EXISTING PROJECT DETECTED - Open Claude Code IN YOUR PROJECT FOLDER first!

1. Open Claude Code
2. Navigate to your project folder: /path/to/your/project
3. Then paste this prompt:

═══════════════════ CLAUDE CODE PROMPT ═══════════════════

I'm configuring CodeMind for this existing project. Please analyze the codebase and enhance my answer.

Setup Question: What architectural pattern do you follow?
My Answer: Component-Based Architecture
Project Context: Project: MyApp, Type: web_application, Languages: JavaScript

Based on the actual code you can see in this project, please:
1. Validate my answer against the existing codebase
2. Suggest improvements based on current patterns
3. Identify any inconsistencies with existing code
4. Recommend specific next steps for this codebase

Keep response concise (2-3 sentences) based on what you observe in the code.

═══════════════════════════════════════════════════════════

🚨 CRITICAL: This only works if Claude Code is opened in the project folder!
```

#### Enhancement Methods Available

**1. Automatic (Claude CLI) - Recommended ⭐**
- **Direct Integration**: Uses `claude --print` command automatically
- **Codebase Access**: For existing projects, adds `--add-dir` to give Claude full codebase visibility
- **No Manual Steps**: Fully automated enhancement process
- **Context Aware**: Automatically detects greenfield vs existing projects
- **Requirement**: Requires `npm install -g @anthropics/claude-cli`

**2. Manual Copy-Paste**
- **Interactive Prompts**: Displays formatted prompts for copying to Claude Code
- **No CLI Required**: Works without Claude CLI installation
- **Step-by-Step**: Manual process but with clear instructions
- **Context Aware**: Same smart project detection and appropriate prompts

**3. Skip Enhancement**
- **Basic Setup**: No AI enhancement, uses original answers
- **Fast Setup**: Quickest option for simple configurations

**Why Claude CLI Integration is Powerful:**
- ✅ **Fully Automated** - No copy-paste required, seamless integration
- ✅ **Smart project detection** - Automatically adapts to your project's maturity level
- ✅ **Real codebase analysis** - For existing projects, Claude CLI can read and analyze your actual code files
- ✅ **Context-aware prompts** - Different enhancement strategies for new vs existing projects
- ✅ **Fallback support** - Falls back to manual method if CLI isn't available
- ✅ **Same as API usage** - Uses the same direct integration approach as the CLAUDE.md generation

#### 5. Generated Assets

The interactive setup creates:
- ✅ **Enhanced CLAUDE.md** with project-specific guidance
- ✅ **Database records** with rich project metadata
- ✅ **API integration** ready for Claude Code
- ✅ **Smart questions** tailored to your project
- ✅ **Claude analysis** (if API key provided)

## System Features & Capabilities

### ✅ Active Features (Phase 1)

#### Claude Code Integration API
- **Token-efficient context**: Get project context optimized for Claude Code's token limits
- **Smart question generation**: AI-powered questions tailored to your project type
- **Intelligent analysis**: Context-aware code analysis with pattern detection
- **Intent-based responses**: Focused information based on coding, review, or overview intents

#### Interactive Setup with Claude Code
- **No API key required**: Use your existing Claude Code access
- **Formatted prompts**: Copy-paste ready prompts for enhanced project analysis
- **Interactive enhancement**: Review and modify AI suggestions before integration
- **Intelligent CLAUDE.md generation**: Project-specific guidance with enhanced insights

#### PostgreSQL Database
- **Production-ready schema**: Comprehensive project metadata storage
- **Multi-project support**: Handle multiple projects in single instance
- **Progress tracking**: Initialization and analysis state management
- **Pattern detection storage**: Learn from project patterns over time

### 🔧 Designed Features (Phase 4)

#### Development Plan Management
- **AI-powered plan suggestions**: Get development plans based on project analysis
- **Template-based planning**: Feature development, bug fixes, refactoring, testing initiatives
- **Progress tracking**: Task completion, milestone tracking, blocker management
- **Integration hooks**: Connect with existing project management tools

#### Plan Types Available
- **Feature Development Template**: Comprehensive new feature implementation
- **Bug Fix Campaign Template**: Systematic approach to resolving multiple bugs  
- **Refactoring Project Template**: Code quality and maintainability improvements
- **Testing Initiative Template**: Comprehensive testing strategy implementation

### 🔄 Integration Patterns

#### Claude Code Workflow
1. **Setup**: Run interactive setup with Claude Code enhancement
2. **Development**: Use token-efficient API endpoints for context and analysis
3. **Planning**: Get AI-powered development plan suggestions (Phase 4)
4. **Monitoring**: Track progress and get intelligent insights

#### API Endpoints
- `GET /claude/context/{project}` - Get project context for Claude Code
- `GET /claude/suggest-questions/{project}` - Get smart questions for current project state
- `POST /claude/analyze-with-context` - Deep analysis with intelligent context inclusion
- `GET /claude/plan-suggestions/{project}` - AI-powered development plan recommendations (Phase 4)

## Complete API Testing Guide

### Phase 1: Claude-Optimized Endpoints (Active)

#### Overview Context (Minimal Tokens ~200)
```bash
curl "http://localhost:3004/claude/context/MyProject?intent=overview"
```
**Use Case**: Quick project status before starting work
**Expected**: Basic project info, initialization status, key patterns

#### Coding Context (Development Focus ~500 tokens)
```bash
curl "http://localhost:3004/claude/context/MyProject?intent=coding&maxTokens=800"
```
**Use Case**: Before implementing new features or making changes
**Expected**: Architecture patterns, coding standards, project structure

#### Architecture Context (Detailed ~1000 tokens)
```bash
curl "http://localhost:3004/claude/context/MyProject?intent=architecture&maxTokens=1500"
```
**Use Case**: Making architectural decisions or major refactoring
**Expected**: Design patterns, relationships, architectural recommendations

#### Debugging Context (~600 tokens)
```bash
curl "http://localhost:3004/claude/context/MyProject?intent=debugging&maxTokens=1000"
```
**Use Case**: When troubleshooting issues or investigating bugs
**Expected**: Error patterns, common issues, diagnostic guidance

#### Smart Questions for User Interaction
```bash
curl "http://localhost:3004/claude/suggest-questions/MyProject?maxQuestions=5"
curl "http://localhost:3004/claude/suggest-questions/MyProject?category=architecture&maxQuestions=3"
```
**Use Case**: Gathering requirements or clarifying project details
**Expected**: Context-aware questions tailored to project type

#### Focused Analysis with Context
```bash
curl -X POST http://localhost:3004/claude/analyze-with-context \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "MyProject",
    "analysisType": "code_review", 
    "context": {
      "intent": "quality_improvement",
      "includePatterns": true,
      "maxContextTokens": 1000
    }
  }'
```
**Use Case**: Deep analysis with intelligent context inclusion
**Expected**: Focused analysis with relevant patterns and context

### Phase 4: Development Plan Management (Designed)

#### Get Plan Suggestions (AI-Powered)
```bash
curl "http://localhost:3004/claude/plan-suggestions/MyProject"
```
**Use Case**: Get AI recommendations for development plans
**Expected**: Suggested plan types based on project analysis

#### Plan Management Endpoints
```bash
# Create new development plan
curl -X POST http://localhost:3004/plans \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "MyProject",
    "planType": "feature_development",
    "title": "User Authentication System",
    "projectIntent": "Build secure JWT-based authentication",
    "businessValue": "Enable user account management and security",
    "qualityRequirements": ["High security", "High performance"]
  }'

# Get project plans
curl "http://localhost:3004/plans/MyProject?status=active&type=feature_development"

# Get plan details
curl "http://localhost:3004/plans/details/PLAN_ID"

# Update plan progress
curl -X POST http://localhost:3004/plans/PLAN_ID/progress \
  -H "Content-Type: application/json" \
  -d '{
    "taskUpdates": [{
      "taskId": "task-123",
      "status": "completed",
      "actualHours": 4,
      "notes": "JWT middleware implemented successfully"
    }],
    "generalUpdate": {
      "summary": "Backend authentication core completed",
      "hoursSpent": 8
    }
  }'

# Get progress analytics
curl "http://localhost:3004/plans/PLAN_ID/progress?days=30"
```
**Current Status**: Endpoints return detailed "Phase 4 designed" information
**Future**: Full plan lifecycle management with progress tracking

#### Plan Templates
```bash
# List available templates
curl "http://localhost:3004/plan-templates"

# Get template details
curl "http://localhost:3004/plan-templates/feature-development-template"

# Create plan from template
curl -X POST http://localhost:3004/plans/from-template/feature-development-template \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "MyProject",
    "customizations": {
      "title": "Payment Processing Feature",
      "estimatedWeeks": 4
    }
  }'
```

#### Claude AI Integration for Plans
```bash
# AI plan optimization
curl -X POST http://localhost:3004/plans/PLAN_ID/claude-optimize \
  -H "Content-Type: application/json" \
  -d '{
    "optimizationType": "timeline_optimization",
    "context": {
      "currentProgress": 35,
      "teamCapacity": "2 developers, 40 hours/week",
      "blockers": ["Database schema pending approval"]
    }
  }'
```
**Expected**: AI recommendations for plan improvements and optimizations

## Complete Real Project Workflow

### Method 1: Basic Project Setup

#### 1. Initialize a Project with Basic Metadata
```bash
curl -X POST http://localhost:3004/init \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "MyWebApp",
    "mode": "auto",
    "batchSize": 50,
    "metadata": {
      "projectName": "E-commerce Platform",
      "description": "Online shopping platform with payment processing",
      "languages": ["typescript", "javascript"],
      "frameworks": ["react", "express"],
      "projectType": "web_application"
    }
  }'
```

#### 2. Get Project Context After Initialization
```bash
# Get overview of your project
curl "http://localhost:3004/claude/context/MyWebApp?intent=overview"

# Get detailed architecture context
curl "http://localhost:3004/claude/context/MyWebApp?intent=architecture&maxTokens=2000"

# Get coding-specific context
curl "http://localhost:3004/claude/context/MyWebApp?intent=coding&maxTokens=800"
```

#### 3. Test Smart Question System
```bash
# Get general project questions
curl "http://localhost:3004/claude/suggest-questions/MyWebApp?maxQuestions=5"

# Get architecture-specific questions
curl "http://localhost:3004/claude/suggest-questions/MyWebApp?category=architecture&maxQuestions=3"

# Get standards and patterns questions
curl "http://localhost:3004/claude/suggest-questions/MyWebApp?category=standards,patterns"
```

### Method 2: Enhanced Interactive Workflow (Recommended)

#### 1. Run Full Interactive Setup
```bash
# With Claude API key for AI enhancement
export ANTHROPIC_API_KEY="your-claude-api-key"
./scripts/interactive-setup.sh -p "MyWebApp" 

# Follow prompts for:
# - Project type and technology stack
# - Architecture patterns and testing strategy  
# - Project intent and business value
# - Quality requirements and standards
```

#### 2. Review Generated CLAUDE.md
After interactive setup, review the generated `CLAUDE.md` file:
```markdown
# CLAUDE.md - MyWebApp

## Project Overview
**Project**: E-commerce Platform
**Type**: web_application
**Project Intent**: Build online shopping platform with secure payment processing
**Business Value**: Enable customers to purchase products online with confidence
**Quality Requirements**: High security, High performance, High availability

## CodeMind Integration
### Token-Efficient API Usage
# Before Making Changes (Overview - ~200 tokens)
curl "http://localhost:3004/claude/context/MyWebApp?intent=overview"

# When Coding (Development Context - ~500 tokens)  
curl "http://localhost:3004/claude/context/MyWebApp?intent=coding&maxTokens=800"
```

#### 3. Test All Generated API Patterns
```bash
# Use patterns from generated CLAUDE.md
curl "http://localhost:3004/claude/context/MyWebApp?intent=overview"
curl "http://localhost:3004/claude/context/MyWebApp?intent=coding&maxTokens=800" 
curl "http://localhost:3004/claude/context/MyWebApp?intent=architecture&maxTokens=1500"
curl "http://localhost:3004/claude/suggest-questions/MyWebApp?maxQuestions=3"
```

### Method 3: Development Plan Workflow

#### 1. Get AI Plan Suggestions
```bash
curl "http://localhost:3004/claude/plan-suggestions/MyWebApp"
```
**Expected Response**: AI-recommended development plans based on project analysis

#### 2. Explore Plan Templates
```bash
# List available plan templates
curl "http://localhost:3004/plan-templates"

# Get details for feature development template
curl "http://localhost:3004/plan-templates/feature-development-template"
```

#### 3. Create Development Plan (Phase 4 Preview)
```bash
curl -X POST http://localhost:3004/plans \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "MyWebApp",
    "planType": "feature_development",
    "title": "Shopping Cart Feature",
    "projectIntent": "Implement shopping cart with item management and checkout flow",
    "businessValue": "Allow customers to collect items and complete purchases",
    "qualityRequirements": ["High performance", "High security"],
    "phases": [
      {
        "name": "Backend API Development",
        "order": 1,
        "tasks": ["Create cart endpoints", "Implement cart persistence"]
      },
      {
        "name": "Frontend Implementation", 
        "order": 2,
        "tasks": ["Build cart UI components", "Integrate with backend"]
      }
    ]
  }'
```

## PowerShell Commands (Windows Users)

### Basic Testing with PowerShell
```powershell
# Health check
Invoke-WebRequest -Uri "http://localhost:3004/health"

# Initialize project with metadata
$initBody = @{
    projectPath = "MyWebApp"
    mode = "auto"
    batchSize = 50
    metadata = @{
        projectName = "E-commerce Platform"
        projectType = "web_application"
        languages = @("typescript", "javascript")
        frameworks = @("react", "express")
    }
} | ConvertTo-Json -Depth 3

Invoke-WebRequest -Uri "http://localhost:3004/init" -Method POST -ContentType "application/json" -Body $initBody

# Get project context
Invoke-WebRequest -Uri "http://localhost:3004/claude/context/MyWebApp?intent=overview"
Invoke-WebRequest -Uri "http://localhost:3004/claude/context/MyWebApp?intent=coding&maxTokens=800"

# Get smart questions
Invoke-WebRequest -Uri "http://localhost:3004/claude/suggest-questions/MyWebApp?maxQuestions=5"
```

### Interactive Setup with PowerShell
```powershell
# Option 1: Use Claude Code (Recommended)
.\scripts\interactive-setup.ps1 -ProjectPath "MyWebApp" -UseClaudeCode

# Option 2: Use Claude API
$env:ANTHROPIC_API_KEY = "your-claude-api-key"
.\scripts\interactive-setup.ps1 -ProjectPath "MyWebApp" -ClaudeApiKey $env:ANTHROPIC_API_KEY

# Option 3: Basic setup without AI enhancement
.\scripts\interactive-setup.ps1 -ProjectPath "MyWebApp" -SkipInteractive
```

### Alternative: Async Claude Interaction

If you prefer not to use the Claude Code integration during setup, you can still get enhanced project analysis:

#### 1. Run basic setup first:
```bash
./scripts/interactive-setup.sh -p "MyProject"
# Choose option 3 (No enhancement)
```

#### 2. Then ask Claude Code to enhance your setup:
Copy this prompt to Claude Code after setup:
```
I just set up a CodeMind project with these details:
- Project: [your project name]
- Type: [project type from setup]
- Languages: [languages from setup]
- Architecture: [pattern from setup]

Please analyze this configuration and suggest:
1. Specific best practices for this tech stack
2. Common architectural patterns I should consider
3. Testing strategies that would work well
4. Potential challenges and how to address them
5. Quality requirements I should prioritize

Generate an enhanced CLAUDE.md section for this project.
```

#### 3. Update your CLAUDE.md with the enhanced insights

### Method 4: Development Setup (30 minutes) - For Contributors

### Local Development Environment

If you want to run the system locally for development:

#### 1. Install Dependencies
```bash
npm install
```

#### 2. Build the Project
```bash
npm run build
```

#### 3. Run in Development Mode
```bash
# Set environment variables
export NODE_ENV=development
export DB_TYPE=postgresql  
export DATABASE_URL=postgresql://codemind:codemind123@localhost:5432/codemind
export PORT=3004

# Run the API server
npm run dev
```

#### 4. Development with Hot Reload
```bash
# Install development dependencies
npm install --save-dev nodemon ts-node

# Run with auto-restart on changes
npx nodemon --exec ts-node src/api/server.ts
```

### Testing Framework

#### 1. Run Database Tests
```bash
# Setup test database
./scripts/setup-test-db.sh

# Run API integration tests
cd tests && node api-database-tests.js
```

#### 2. Manual API Testing
Use the provided test endpoints to validate all functionality:
```bash
# Test all Phase 1 endpoints
curl http://localhost:3004/health
curl "http://localhost:3004/claude/context/TestProject?intent=overview"
curl "http://localhost:3004/claude/suggest-questions/TestProject"

# Test Phase 4 endpoints (designed responses)
curl "http://localhost:3004/claude/plan-suggestions/TestProject"
curl -X POST http://localhost:3004/plans -H "Content-Type: application/json" -d '{"projectPath":"Test","planType":"feature_development","title":"Test Plan"}'
```

## Advanced Integration Patterns

### Claude Code Integration

#### 1. Environment Setup for Claude Code
```bash
# Set environment variables for Claude Code sessions
export CODEMIND_API_URL="http://localhost:3004"
export PROJECT_PATH="MyWebApp"
```

#### 2. CLAUDE.md Integration Pattern
Add to your project's CLAUDE.md:
```markdown
# CLAUDE.md - MyProject

## CodeMind Integration Active

Before any coding tasks, use these token-efficient API calls:

### Quick Project Status (50-200 tokens)
```bash
curl "$CODEMIND_API_URL/claude/context/$PROJECT_PATH?intent=overview"
```

### Before Development (200-800 tokens)  
```bash
curl "$CODEMIND_API_URL/claude/context/$PROJECT_PATH?intent=coding&maxTokens=800"
```

### For Architecture Decisions (500-1500 tokens)
```bash
curl "$CODEMIND_API_URL/claude/context/$PROJECT_PATH?intent=architecture&maxTokens=1500"
```

### User Interaction (100-300 tokens)
```bash
curl "$CODEMIND_API_URL/claude/suggest-questions/$PROJECT_PATH?maxQuestions=3"
```

## Usage Workflow
1. Start coding session with overview context
2. Get coding context before implementing features
3. Use smart questions for user requirements
4. Get architectural context for design decisions
```

#### 3. Token Optimization Strategy
- **Overview**: Use for quick status checks (minimal tokens)
- **Coding**: Use before feature development (focused context)
- **Architecture**: Use for major design decisions (comprehensive context)  
- **Debugging**: Use when troubleshooting issues (error-focused context)
- **Smart Questions**: Use for user interaction (relevant questions)

### Workflow Integration Examples

#### Daily Development Workflow
```bash
# Morning standup - project status
curl "$CODEMIND_API_URL/claude/context/$PROJECT_PATH?intent=overview"

# Before coding - get development context  
curl "$CODEMIND_API_URL/claude/context/$PROJECT_PATH?intent=coding&maxTokens=800"

# User requirements gathering
curl "$CODEMIND_API_URL/claude/suggest-questions/$PROJECT_PATH?category=requirements&maxQuestions=5"

# Architecture review
curl "$CODEMIND_API_URL/claude/context/$PROJECT_PATH?intent=architecture&maxTokens=1500"
```

#### Feature Development Workflow
```bash
# 1. Get plan suggestions
curl "$CODEMIND_API_URL/claude/plan-suggestions/$PROJECT_PATH"

# 2. Create development plan (Phase 4)
curl -X POST "$CODEMIND_API_URL/plans" -H "Content-Type: application/json" -d '{
  "projectPath": "'$PROJECT_PATH'",
  "planType": "feature_development", 
  "title": "New Feature Implementation",
  "projectIntent": "Build specific functionality",
  "businessValue": "Provide user value",
  "qualityRequirements": ["High performance", "High security"]
}'

# 3. Get coding context for implementation
curl "$CODEMIND_API_URL/claude/context/$PROJECT_PATH?intent=coding&maxTokens=800"

# 4. Track progress (Phase 4)
curl -X POST "$CODEMIND_API_URL/plans/PLAN_ID/progress" -H "Content-Type: application/json" -d '{
  "taskUpdates": [{"taskId": "task-1", "status": "completed", "actualHours": 4}],
  "generalUpdate": {"summary": "Feature implementation completed", "hoursSpent": 8}
}'
```

## System Administration

### Database Management

#### PostgreSQL Administration
```bash
# Connect to database
docker exec -it codemind-postgres psql -U codemind -d codemind

# View schema information
\dt  # List tables
\d projects  # Describe projects table
\d development_plans  # Describe development plans table (Phase 4)

# Query project data
SELECT project_path, project_name, project_type, status FROM projects;
SELECT COUNT(*) FROM initialization_progress;

# View system statistics
SELECT * FROM project_status_summary;
```

#### Backup and Restore
```bash
# Backup database
docker exec -t codemind-postgres pg_dump -U codemind codemind > codemind_backup.sql

# Restore database
docker exec -i codemind-postgres psql -U codemind -d codemind < codemind_backup.sql

# Clean slate restart (WARNING: Deletes all data)
docker-compose -f docker-compose.postgres.yml down -v
docker-compose -f docker-compose.postgres.yml up -d
```

### Performance Monitoring

#### API Performance
```bash
# Monitor response times
time curl "http://localhost:3004/claude/context/MyProject?intent=overview"

# Check cache effectiveness  
curl "http://localhost:3004/claude/context/MyProject?intent=overview"  # First call
curl "http://localhost:3004/claude/context/MyProject?intent=overview"  # Cached call

# System statistics
curl "http://localhost:3004/stats"
```

#### Resource Monitoring
```bash
# Container resource usage
docker stats codemind-postgres-api codemind-postgres

# Database connection monitoring
docker exec codemind-postgres psql -U codemind -d codemind -c "SELECT * FROM pg_stat_activity;"

# Log monitoring
docker-compose -f docker-compose.postgres.yml logs -f --tail=50 codemind
```

## Troubleshooting

### Common Issues and Solutions

#### Services Won't Start
```bash
# Check port usage
netstat -ano | findstr :3004  # API port
netstat -ano | findstr :5432  # PostgreSQL port

# On Windows PowerShell
Get-NetTCPConnection -LocalPort 3004
Get-NetTCPConnection -LocalPort 5432

# Stop conflicting services
docker-compose -f docker-compose.postgres.yml down
docker-compose -f docker-compose.postgres.yml up -d

# If ports are busy, change them in docker-compose.postgres.yml
```

#### Database Connection Issues
```bash
# Check PostgreSQL is running
docker-compose -f docker-compose.postgres.yml ps

# Check database connectivity
docker exec codemind-postgres pg_isready -U codemind -d codemind

# Restart database container
docker-compose -f docker-compose.postgres.yml restart postgres

# Check database logs
docker-compose -f docker-compose.postgres.yml logs postgres
```

#### API Endpoint Errors
```bash
# Check API server logs
docker-compose -f docker-compose.postgres.yml logs -f codemind

# Test basic connectivity
curl http://localhost:3004/health

# Check all container status
docker-compose -f docker-compose.postgres.yml ps

# Restart API container
docker-compose -f docker-compose.postgres.yml restart codemind
```

#### Interactive Setup Script Issues
```bash
# Permission issues (Linux/Mac)
chmod +x scripts/interactive-setup.sh
chmod +x scripts/setup-test-db.sh

# PowerShell execution policy (Windows)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Missing dependencies
npm install  # For jq and other tools
# Or install jq separately: https://stedolan.github.io/jq/download/

# API not responding
# Ensure CodeMind is running before running interactive setup
curl http://localhost:3004/health
```

### Debug Information Collection

#### System Information
```bash
# Docker version and status
docker --version
docker-compose --version
docker system df

# Container resource usage
docker stats --no-stream codemind-postgres-api codemind-postgres

# Network connectivity
docker network ls
docker network inspect codemind-network
```

#### Database Debugging
```bash
# Connect to database
docker exec -it codemind-postgres psql -U codemind -d codemind

# Check tables and data
\dt                           # List all tables
\d projects                   # Describe projects table
SELECT COUNT(*) FROM projects; # Count projects
SELECT * FROM projects LIMIT 3; # Sample data

# Check Phase 4 schema (if implemented)
\d development_plans          # Plan management tables
\d plan_templates            # Template system

# Exit PostgreSQL
\q
```

#### Log Analysis
```bash
# Get recent logs
docker-compose -f docker-compose.postgres.yml logs --tail=100 codemind
docker-compose -f docker-compose.postgres.yml logs --tail=50 postgres

# Follow logs in real-time
docker-compose -f docker-compose.postgres.yml logs -f

# Search logs for errors
docker-compose -f docker-compose.postgres.yml logs codemind | grep -i error
docker-compose -f docker-compose.postgres.yml logs postgres | grep -i error
```

### Reset and Recovery

#### Soft Reset (Keep Data)
```bash
# Restart services only
docker-compose -f docker-compose.postgres.yml restart

# Rebuild containers (keep data)
docker-compose -f docker-compose.postgres.yml up -d --build
```

#### Hard Reset (Delete All Data)
```bash
# WARNING: This deletes all project data and database
docker-compose -f docker-compose.postgres.yml down -v
docker system prune -f
docker-compose -f docker-compose.postgres.yml up -d
```

#### Selective Data Cleanup
```bash
# Connect to database
docker exec -it codemind-postgres psql -U codemind -d codemind

# Delete specific project data
DELETE FROM projects WHERE project_path = 'TestProject';
DELETE FROM initialization_progress WHERE project_path = 'TestProject';

# Clear all test data
DELETE FROM projects WHERE project_path LIKE 'test-%';

# Reset auto-increment counters
SELECT setval('projects_id_seq', 1, false);
```

## Expected API Responses

### Health Check Response
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": "5m 23s", 
    "version": "1.0.0"
  },
  "cached": false
}
```

### Context Response Examples

#### Overview Context (Minimal)
```json
{
  "success": true,
  "data": {
    "project": {
      "name": "MyWebApp",
      "type": "web_application",
      "languages": ["typescript", "javascript"],
      "frameworks": ["react", "express"],
      "status": "active"
    },
    "summary": {
      "totalFiles": 0,
      "totalLines": 0,
      "initializationStatus": "project_discovery", 
      "keyPatterns": []
    },
    "timestamp": "2025-08-24T19:30:00Z"
  },
  "cached": false
}
```

#### Smart Questions Response
```json
{
  "success": true,
  "data": {
    "questions": [
      "What type of application is this project?",
      "What are the main architectural patterns used?", 
      "What testing strategy should I follow?",
      "What are the coding standards and conventions?"
    ],
    "context": "web_application",
    "projectStatus": "active",
    "suggestedContext": "coding",
    "total": 4
  },
  "cached": false
}
```

#### Phase 4 Plan Suggestions Response
```json
{
  "success": true,
  "data": {
    "projectPath": "/MyWebApp",
    "suggestions": [
      {
        "planType": "feature_development",
        "title": "Authentication System",
        "description": "Implement user authentication and authorization", 
        "priority": "high",
        "estimatedWeeks": 3,
        "reasoning": "No authentication patterns detected"
      }
    ],
    "message": "Enhanced Claude plan suggestions will be implemented in Phase 4",
    "currentFeatures": ["Basic plan type suggestions based on project analysis"],
    "plannedEnhancements": [
      "AI-generated custom plan templates",
      "Context-aware task recommendations", 
      "Smart timeline estimates"
    ]
  }
}
```

## Quick Reference

### Essential Commands

#### For New Users (Claude Code)
```bash
# Start system
docker-compose -f docker-compose.postgres.yml up -d

# Claude Code interactive setup (Recommended)
./scripts/interactive-setup.sh -p "ProjectName"
# Select "1. Use Claude Code" when prompted

# Test integration
curl "http://localhost:3004/claude/context/ProjectName?intent=coding&maxTokens=600"
```

#### For API Users
```bash
# Start system
docker-compose -f docker-compose.postgres.yml up -d

# Set Claude API key
export ANTHROPIC_API_KEY="your-claude-api-key"

# API-enhanced setup
./scripts/interactive-setup.sh -p "ProjectName"
# Select "2. Use Claude API" when prompted

# Get project context
curl "http://localhost:3004/claude/context/ProjectName?intent=overview"

# Stop system
docker-compose -f docker-compose.postgres.yml down
```

### Key Endpoints
- **Health**: `GET /health`
- **Project Init**: `POST /init`
- **Context**: `GET /claude/context/:projectPath?intent={overview|coding|architecture|debugging}`
- **Questions**: `GET /claude/suggest-questions/:projectPath`
- **Analysis**: `POST /claude/analyze-with-context`
- **Plan Suggestions**: `GET /claude/plan-suggestions/:projectPath`
- **Plans** (Phase 4): `POST /plans`, `GET /plans/:projectPath`, etc.

### File Locations
- **Main Config**: `docker-compose.postgres.yml`
- **Interactive Setup**: `scripts/interactive-setup.sh`, `scripts/interactive-setup.ps1`
- **Database Schema**: `src/database/schema.postgres.sql`, `src/database/schema-phase4-plans.sql`
- **Documentation**: `CLAUDE.md`, `docs/DATABASE_SCHEMA.md`, `docs/PHASE4_DEVELOPMENT_PLANS.md`
- **Templates**: `templates/plan-templates.json`

### Default Configuration
- **API Port**: 3004
- **Database Port**: 5432 
- **Database**: PostgreSQL with persistent volumes
- **Cache Duration**: 5 minutes
- **Health Check Interval**: 30 seconds

## Support and Next Steps

### System Status
- **Phase 1**: ✅ **Active** - Token-efficient Claude integration with caching and optimization
- **Phase 4**: ✅ **Designed** - Development plan management system ready for implementation
- **Database**: ✅ **Production Ready** - PostgreSQL with comprehensive schema and indexing
- **Interactive Setup**: ✅ **Enhanced** - Claude-powered project configuration with corrected goal structure

## How to Use CodeMind

### Daily Development Workflow

#### 1. Before Starting Any Coding Session
```bash
# Get current project context
curl "http://localhost:3004/claude/context/YourProject?intent=coding&maxTokens=800"

# Copy the response and use it with Claude Code:
# "I need to implement [feature]. Here's my project context: [paste response]"
```

#### 2. When You're Stuck or Need Direction  
```bash
# Get AI-generated questions specific to your project
curl "http://localhost:3004/claude/suggest-questions/YourProject?maxQuestions=5"

# Use these questions with Claude Code to get unstuck
```

#### 3. During Code Reviews
```bash
# Get review-focused context
curl "http://localhost:3004/claude/context/YourProject?intent=review&maxTokens=600"

# Use with Claude Code: "Review this code. Context: [paste response]"
```

#### 4. For Deep Analysis (When Needed)
```bash
curl -X POST http://localhost:3004/claude/analyze-with-context \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "YourProject",
    "analysisType": "code_review",
    "context": {"intent": "quality_improvement", "includePatterns": true}
  }'
```

### Project Management (Phase 4 - Available Now)

#### Create Development Plans
```bash
curl -X POST http://localhost:3004/plans \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "YourProject",
    "planType": "feature_development",
    "title": "User Authentication System",
    "projectIntent": "Implement secure user login/registration"
  }'
```

#### Track Progress  
```bash
# View active plans
curl "http://localhost:3004/plans/YourProject?status=active"

# Update task completion
curl -X POST http://localhost:3004/plans/{planId}/progress \
  -H "Content-Type: application/json" \
  -d '{"taskId": "task-123", "status": "completed"}'
```

### Integration with Claude Code

**Your CLAUDE.md file will contain ready-to-use commands like:**
```bash
# Get context before major changes
curl "http://localhost:3004/claude/context/YourProject?intent=overview"

# Get coding context with token limit
curl "http://localhost:3004/claude/context/YourProject?intent=coding&maxTokens=800"

# Get smart questions when stuck
curl "http://localhost:3004/claude/suggest-questions/YourProject"
```

### Key Benefits You'll Experience
- ✅ **No more context repetition** - CodeMind remembers your project details
- ✅ **Faster Claude interactions** - Pre-optimized context saves time
- ✅ **Smarter questions** - AI generates questions specific to your project state
- ✅ **Better code quality** - Context-aware suggestions improve decisions
- ✅ **Project tracking** - Monitor development progress with Phase 4 features

### Future Development
- **Phase 2**: Direct CLI integration (`code-knowledge` commands)
- **Phase 3**: Web-based dashboard and visualization
- **Phase 4 Implementation**: Full development plan management with progress tracking
- **Advanced AI**: Enhanced Claude integration with project learning

The system is production-ready for Phase 1 features and comprehensively designed for Phase 4 development plan management!

## Expected Responses

### Health Check Response
```json
{
  "status": "healthy",
  "timestamp": "2024-08-24T...",
  "database": "connected",
  "uptime": 123
}
```

### Context Response (Overview)
```json
{
  "project": {
    "name": "test",
    "type": "unknown",
    "languages": [],
    "frameworks": [],
    "status": "not_initialized"
  },
  "summary": {
    "totalFiles": 0,
    "totalLines": 0,
    "initializationStatus": "not_initialized",
    "keyPatterns": []
  },
  "timestamp": "2024-08-24T...",
  "tokenEstimate": 45,
  "cached": false
}
```

### Questions Response
```json
{
  "questions": [
    {
      "id": "arch_pattern_mvc",
      "category": "architecture",
      "text": "Does this project follow MVC architecture?",
      "impact": "high",
      "context": {
        "projectType": "unknown",
        "detectedPatterns": [],
        "techStack": [],
        "projectSize": "small"
      }
    }
  ],
  "metadata": {
    "totalQuestions": 1,
    "categories": ["architecture"],
    "tokenEstimate": 89
  }
}
```

## Using with Claude Code

Add this to your project's CLAUDE.md:

```bash
# Environment variables
export CODEMIND_API_URL=http://localhost:3004
export WORKSPACE_PATH=/workspace

# Get project context before coding
curl "$CODEMIND_API_URL/claude/context$WORKSPACE_PATH?intent=coding"

# Get questions for user interaction
curl "$CODEMIND_API_URL/claude/suggest-questions$WORKSPACE_PATH?maxQuestions=3"
```

## Next Steps

1. **Test with your own projects**: Replace `/workspace/test` with paths to your actual projects
2. **Integrate with Claude Code**: Use the API calls in your Claude Code sessions
3. **Monitor performance**: Check response times and token usage
4. **Provide feedback**: Report issues or suggestions

## API Reference

Full API documentation is in CLAUDE.md. Key endpoints:

- `GET /claude/context/:projectPath` - Project context
- `GET /claude/suggest-questions/:projectPath` - Smart questions
- `POST /claude/analyze-with-context` - Focused analysis
- `POST /init` - Initialize project
- `GET /health` - Health check
- `GET /stats` - System statistics

## Support

If you encounter issues:

1. Check the logs: `docker-compose -f docker-compose.postgres.yml logs -f`
2. Verify services: `docker-compose -f docker-compose.postgres.yml ps`
3. Test connectivity: `curl http://localhost:3004/health`
4. Reset if needed: Follow troubleshooting steps above