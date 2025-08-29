# CodeMind Complete Setup Guide

Complete installation and configuration guide for the Intelligent Code Auxiliary System with **Auto-Improvement Mode**.

> **🚀 New to CodeMind?** Check out the [Quick Start Guide](docs/QUICKSTART.md) for a 5-minute setup.

## What You'll Get

After setup, CodeMind provides:
- 🧠 **Smart Context API** - Token-efficient context for Claude Code
- 🔍 **Codebase Analysis** - Automatic pattern and architecture detection
- 💡 **Intelligent Questions** - AI-generated questions for your project state
- ⚡ **Auto-Improvement Mode** - Automatic codebase analysis and fixes ⭐ **NEW!**
- 📋 **Development Planning** - Plan management and progress tracking
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

### Method 1: Quick Setup with Auto-Improvement (Recommended - 5 minutes)

**Best for: Users who want immediate project improvement capabilities**

#### 1. Clone and Start System

```bash
# Navigate to the CodeMind directory
cd C:\workspace\claude\CodeMind

# Start the full PostgreSQL stack
docker-compose -f docker-compose.postgres.yml up -d

# Verify services are running
docker-compose -f docker-compose.postgres.yml ps
```

#### 2. Auto-Improve Existing Project ⭐ **NEW!**

```bash
# Analyze and automatically fix issues in your existing project
npx codemind auto-fix /path/to/your-project

# Safe preview mode - see what would be fixed without making changes
npx codemind auto-fix /path/to/your-project --dry-run

# Fix specific issue types only
npx codemind auto-fix /path/to/your-project --types duplicates centralization

# Conservative improvements for production codebases
npx codemind auto-fix /path/to/your-project --aggressiveness conservative
```

#### 3. Setup Enhanced Project Configuration

**PowerShell (Windows):**
```powershell
.\scripts\interactive-setup.ps1 -ProjectPath "MyProject" -UseClaudeCode
```

**Bash (Linux/Mac/Git Bash):**
```bash
./scripts/interactive-setup.sh -p "MyProject"
# Select "1. Use Claude Code" when prompted
```

#### 4. Verify Integration

```bash
# Test the enhanced API
curl "http://localhost:3004/claude/context/MyProject?intent=coding&maxTokens=600"
```

### Method 2: Auto-Improvement Mode Only (2 minutes)

**Best for: Users who just want to improve existing codebases**

#### 1. Quick System Start

```bash
cd C:\workspace\claude\CodeMind
docker-compose -f docker-compose.postgres.yml up -d
```

#### 2. Run Auto-Improvement on Your Project

```bash
# Basic analysis and improvement
npx codemind auto-fix /path/to/your-project

# Examples with different options:

# Dry run to preview changes
npx codemind auto-fix /path/to/your-legacy-app --dry-run --verbose

# Focus on code quality and duplicates
npx codemind auto-fix /path/to/my-app --types duplicates quality

# Aggressive modernization (use with caution)
npx codemind auto-fix /path/to/legacy-codebase --aggressiveness aggressive

# Conservative fixes only
npx codemind auto-fix /path/to/production-app --aggressiveness conservative --no-backup
```

#### 3. Review Generated Reports

After running auto-fix, check your project directory for:
- `codemind-improvement-report.json` - Detailed analysis data
- `codemind-improvement-report.md` - Human-readable improvement report

### Method 3: Interactive Setup for New Projects (15 minutes)

**Best for: Setting up new projects with comprehensive configuration**

#### 1. Start the System

```bash
cd C:\workspace\claude\CodeMind
docker-compose -f docker-compose.postgres.yml up -d
curl http://localhost:3004/health  # Verify running
```

#### 2. Run Interactive Setup Script

**PowerShell (Windows):**
```powershell
# Option 1: Use Claude Code (Recommended)
.\scripts\interactive-setup.ps1 -ProjectPath "MyProject" -UseClaudeCode

# Option 2: Use Claude API (Automatic Enhancement)
$env:ANTHROPIC_API_KEY = "your-claude-api-key"
.\scripts\interactive-setup.ps1 -ProjectPath "MyProject" -ClaudeApiKey $env:ANTHROPIC_API_KEY

# Option 3: Basic Setup (No AI Enhancement)
.\scripts\interactive-setup.ps1 -ProjectPath "MyProject" -SkipInteractive
```

**Bash (Linux/Mac/Git Bash):**
```bash
# Option 1: Use Claude Code (Recommended)
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

## Auto-Improvement Mode Guide ⭐ **NEW FEATURE**

### What Auto-Improvement Does

CodeMind's Auto-Improvement Mode analyzes existing codebases and automatically fixes common issues:

#### 🔍 **Analysis Types**
- **Code Duplication** - Finds exact and semantic duplicates
- **Configuration Centralization** - Identifies scattered hardcoded values
- **Code Quality Issues** - Detects long functions, deep nesting
- **Architecture Violations** - Finds structural problems

#### ⚡ **Automatic Fixes**
- **Duplicate Removal** - Suggests refactoring opportunities
- **Config Centralization** - Recommends centralized configuration
- **Quality Improvements** - Identifies code quality enhancements
- **Architecture Enhancements** - Suggests structural improvements

### Auto-Fix Command Options

```bash
# Basic usage
npx codemind auto-fix <project-path>

# Command line options:
--dry-run                    # Preview changes without modifying files
--types <types>              # Specific fix types: duplicates,centralization,quality,all
--aggressiveness <level>     # conservative, moderate, aggressive
--output <path>              # Custom output directory for reports
--no-backup                  # Skip creating backup (use with caution)
--no-report                  # Skip generating reports
--verbose                    # Detailed logging
```

### Usage Examples

#### Existing Project Analysis
```bash
# Analyze a legacy codebase
npx codemind auto-fix ./legacy-app --dry-run --verbose

# Output shows:
# 🔧 CodeMind Auto-Fix Configuration:
#    Project Path: ./legacy-app
#    Dry Run: Yes
#    Fix Types: all
#    Aggressiveness: moderate
#
# 📊 Summary:
#    Issues Found: 23
#    Files Analyzed: 145
#    Duplicate Lines: 89
#    Scattered Configs: 12
#    Quality Issues: 34
```

#### Production-Safe Improvements
```bash
# Conservative fixes for production code
npx codemind auto-fix ./production-app \
  --aggressiveness conservative \
  --types duplicates centralization \
  --output ./improvement-reports
```

#### Legacy Modernization
```bash
# Comprehensive modernization (creates backup automatically)
npx codemind auto-fix ./old-codebase --aggressiveness aggressive --verbose
```

### Setup Integration Modes

#### Mode 1: Auto-Improvement + Interactive Setup

For existing projects that need both improvement and enhanced configuration:

```bash
# Step 1: Improve the codebase first
npx codemind auto-fix /path/to/your-project --dry-run
# Review the report, then run without --dry-run if satisfied

# Step 2: Setup enhanced project configuration
./scripts/interactive-setup.sh -p "YourProject"
# This creates optimized CLAUDE.md and API integration
```

#### Mode 2: New Project Setup

For new projects that don't need improvement:

```bash
# Run interactive setup directly
./scripts/interactive-setup.sh -p "NewProject"
# Choose Claude Code integration for best experience
```

#### Mode 3: Existing Project Enhancement

For projects that just need CodeMind integration without code changes:

```bash
# Auto-detect project characteristics and create integration
./scripts/interactive-setup.sh -p "ExistingProject" --auto-discovery
```

### Generated Assets

After running auto-improvement and setup, you get:

#### Auto-Improvement Reports
- ✅ **JSON Report** (`codemind-improvement-report.json`) - Machine-readable analysis data
- ✅ **Markdown Report** (`codemind-improvement-report.md`) - Human-readable improvement summary
- ✅ **Before/After Metrics** - Quality score improvements and issue resolution
- ✅ **Actionable Recommendations** - Next steps and best practices

#### Project Integration
- ✅ **Enhanced CLAUDE.md** - Project-specific Claude Code guidance
- ✅ **Database Records** - Rich project metadata for ongoing analysis
- ✅ **API Integration** - Token-efficient endpoints for Claude Code
- ✅ **Smart Questions** - AI-generated questions tailored to your project

## Interactive Setup Features

### Context-Aware Enhancement

The setup system automatically detects your project type and provides appropriate guidance:

**For NEW/GREENFIELD Projects (< 5 code files):**
- Provides architectural guidance and best practices
- Suggests implementation patterns for your tech stack
- Helps prevent technical debt from the start

**For EXISTING Projects (≥ 5 code files):**
- Analyzes actual codebase structure
- Validates your choices against existing patterns
- Provides specific improvements based on current code

### Setup Questions

The interactive setup asks about:
- **Project Type**: Web app, API service, library, mobile app, etc.
- **Languages & Frameworks**: Complete technology stack
- **Architecture Pattern**: MVC, microservices, component-based, etc.
- **Testing Strategy**: Unit, integration, E2E, TDD approach
- **Coding Standards**: Strict, standard, or relaxed enforcement
- **Project Intent**: Core functionality and business purpose
- **Business Value**: Why the project matters and its impact
- **Quality Requirements**: Performance, security, availability needs

### Enhancement Options

#### 1. Claude Code Integration (Recommended ⭐)
- **Interactive Enhancement**: Copy-paste prompts for Claude Code
- **Context-Aware**: Adapts to greenfield vs existing projects
- **No API Key Required**: Uses your existing Claude Code access
- **Step-by-Step Guidance**: Clear instructions for each step

#### 2. Claude API Integration
- **Automatic Enhancement**: Direct API integration with your key
- **Fully Automated**: No manual copy-paste required
- **Rich Analysis**: Advanced project analysis and suggestions
- **Requires API Key**: Need valid Anthropic API access

#### 3. Basic Setup
- **No AI Enhancement**: Fast setup without external dependencies
- **Manual Configuration**: Based on your direct answers only
- **Quick Setup**: Fastest option for simple configurations

## System Features & Capabilities

### ✅ Active Features

#### Auto-Improvement Mode ⭐ **NEW!**
- **Codebase Analysis**: Automatic detection of duplicates, config issues, quality problems
- **Safe Refactoring**: Dry-run mode, automatic backups, comprehensive reporting
- **Configurable Fixes**: Choose specific improvement types and aggressiveness levels
- **Enterprise Ready**: Production-safe with validation and rollback capabilities

#### Claude Code Integration API
- **Token-Efficient Context**: Optimized for Claude Code's token limits
- **Intent-Based Responses**: Coding, review, architecture, debugging contexts
- **Smart Question Generation**: AI-powered questions for your project type
- **Intelligent Analysis**: Pattern detection and architectural insights

#### Interactive Setup System
- **Auto-Discovery Mode**: Automatically detects project characteristics
- **Claude Enhancement**: Both CLI and API integration options
- **Project Type Detection**: Greenfield vs existing project optimization
- **Rich Metadata**: Comprehensive project information storage

#### PostgreSQL Database
- **Production Schema**: Comprehensive project and improvement tracking
- **Multi-Project Support**: Handle multiple projects in single instance
- **Progress Tracking**: Initialization, analysis, and improvement history
- **Pattern Learning**: Learn from project patterns over time

### 📋 Development Plan Management (Phase 4)

#### Plan Creation and Management
- **AI-Powered Suggestions**: Get development plans based on project analysis
- **Template System**: Feature development, bug fixes, refactoring, testing plans
- **Progress Tracking**: Task completion, milestone monitoring, time estimation
- **Integration Ready**: Connect with project management tools

## Complete Usage Workflow

### Daily Development with Auto-Improvement

#### 1. Project Health Check
```bash
# Quick codebase health analysis
npx codemind auto-fix ./my-project --dry-run --types quality

# Review quality metrics and recommendations
```

#### 2. Get Context for Coding
```bash
# Get current project context for Claude Code
curl "http://localhost:3004/claude/context/my-project?intent=coding&maxTokens=800"

# Use this context with Claude Code:
# "I need to implement [feature]. Context: [paste response]"
```

#### 3. Periodic Improvement
```bash
# Weekly codebase maintenance
npx codemind auto-fix ./my-project --aggressiveness conservative --types duplicates

# Monthly comprehensive analysis
npx codemind auto-fix ./my-project --dry-run --verbose > monthly-analysis.txt
```

### Legacy Code Modernization Workflow

#### 1. Initial Assessment
```bash
# Comprehensive analysis without changes
npx codemind auto-fix ./legacy-codebase --dry-run --aggressiveness aggressive --verbose
```

#### 2. Staged Improvements
```bash
# Phase 1: Safe improvements
npx codemind auto-fix ./legacy-codebase --aggressiveness conservative

# Phase 2: Quality fixes
npx codemind auto-fix ./legacy-codebase --types quality centralization

# Phase 3: Structural improvements (with careful testing)
npx codemind auto-fix ./legacy-codebase --types dependencies architecture
```

#### 3. Setup Enhanced Development
```bash
# Create CodeMind integration after improvements
./scripts/interactive-setup.sh -p "legacy-codebase" --auto-discovery
```

### New Project Setup Workflow

#### 1. Create Project Structure
```bash
mkdir my-new-project
cd my-new-project
# ... create initial files ...
```

#### 2. Setup CodeMind Integration
```bash
./scripts/interactive-setup.sh -p "my-new-project"
# Choose Claude Code integration for best experience
```

#### 3. Development with Smart Context
```bash
# Get architectural guidance
curl "http://localhost:3004/claude/context/my-new-project?intent=architecture&maxTokens=1200"

# Get smart questions for requirements
curl "http://localhost:3004/claude/suggest-questions/my-new-project?category=requirements&maxQuestions=5"
```

## API Testing and Verification

### Auto-Improvement API

```bash
# Test auto-fix with dry run
npx codemind auto-fix /path/to/test-project --dry-run --output ./test-reports

# Verify reports were generated
ls -la ./test-reports/codemind-improvement-report.*
```

### Context and Analysis APIs

```bash
# Health check
curl http://localhost:3004/health

# Project context for different intents
curl "http://localhost:3004/claude/context/TestProject?intent=overview"
curl "http://localhost:3004/claude/context/TestProject?intent=coding&maxTokens=800"
curl "http://localhost:3004/claude/context/TestProject?intent=architecture&maxTokens=1500"

# Smart questions
curl "http://localhost:3004/claude/suggest-questions/TestProject?maxQuestions=5"

# Deep analysis
curl -X POST http://localhost:3004/claude/analyze-with-context \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "TestProject",
    "analysisType": "code_review",
    "context": {"intent": "quality_improvement", "includePatterns": true}
  }'
```

### Development Plan APIs (Phase 4)

```bash
# Plan suggestions
curl "http://localhost:3004/claude/plan-suggestions/TestProject"

# Create development plan
curl -X POST http://localhost:3004/plans \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "TestProject",
    "planType": "feature_development",
    "title": "User Authentication System",
    "projectIntent": "Implement secure user login and registration"
  }'

# Get project plans
curl "http://localhost:3004/plans/TestProject?status=active"
```

## System Administration

### Database Management

```bash
# Connect to PostgreSQL
docker exec -it codemind-postgres psql -U codemind -d codemind

# View project data
\dt  # List tables
SELECT project_path, project_name, status FROM projects;

# View improvement history (auto-fix results would be stored here)
SELECT * FROM improvement_sessions WHERE project_path = 'your-project';
```

### Performance Monitoring

```bash
# Monitor API response times
time curl "http://localhost:3004/claude/context/TestProject?intent=overview"

# Check auto-fix performance
time npx codemind auto-fix ./small-project --dry-run

# Container resource usage
docker stats codemind-postgres-api codemind-postgres
```

### Backup and Maintenance

```bash
# Backup database (includes project data and improvement history)
docker exec -t codemind-postgres pg_dump -U codemind codemind > codemind_backup.sql

# Clean restart (preserves data)
docker-compose -f docker-compose.postgres.yml restart

# Full reset (WARNING: Deletes all data)
docker-compose -f docker-compose.postgres.yml down -v
docker-compose -f docker-compose.postgres.yml up -d
```

## Troubleshooting

### Auto-Fix Issues

#### "No issues found"
```bash
# Try with lower thresholds or different project
npx codemind auto-fix /path/with/more/code --verbose

# Check if project has analyzable code files
ls -la /path/to/project/**/*.{js,ts,py,java}
```

#### "Analysis taking too long"
```bash
# Use types to limit scope
npx codemind auto-fix ./large-project --types duplicates --verbose

# Exclude large directories (future enhancement)
# For now, run on smaller subdirectories
```

#### "Backup creation failed"
```bash
# Check disk space and permissions
df -h
ls -la /path/to/project/../

# Run without backup if version control exists
npx codemind auto-fix ./project --no-backup
```

### System Issues

#### Services Won't Start
```bash
# Check port conflicts
netstat -ano | findstr :3004  # Windows
lsof -i :3004  # Linux/Mac

# Restart services
docker-compose -f docker-compose.postgres.yml down
docker-compose -f docker-compose.postgres.yml up -d
```

#### Database Connection Issues
```bash
# Check PostgreSQL status
docker-compose -f docker-compose.postgres.yml ps
docker exec codemind-postgres pg_isready -U codemind

# View logs
docker-compose -f docker-compose.postgres.yml logs postgres
```

#### Interactive Setup Issues
```bash
# Permission issues (Linux/Mac)
chmod +x scripts/interactive-setup.sh

# PowerShell execution policy (Windows)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Missing dependencies
npm install  # For CLI tools if running locally
```

## Quick Reference

### Essential Commands

#### Auto-Improvement Mode
```bash
# Basic project improvement
npx codemind auto-fix ./my-project

# Safe analysis (no changes)
npx codemind auto-fix ./my-project --dry-run

# Specific improvements
npx codemind auto-fix ./my-project --types duplicates centralization

# Production-safe improvements
npx codemind auto-fix ./my-project --aggressiveness conservative
```

#### System Management
```bash
# Start/stop system
docker-compose -f docker-compose.postgres.yml up -d
docker-compose -f docker-compose.postgres.yml down

# Health check
curl http://localhost:3004/health

# View logs
docker-compose -f docker-compose.postgres.yml logs -f
```

#### Project Setup
```bash
# Interactive setup with Claude Code
./scripts/interactive-setup.sh -p "ProjectName"

# Auto-discovery mode
./scripts/interactive-setup.sh -p "ProjectName" --auto-discovery

# Get project context
curl "http://localhost:3004/claude/context/ProjectName?intent=coding"
```

### Key Endpoints
- **Health**: `GET /health`
- **Auto-Fix**: `npx codemind auto-fix <path> [options]`
- **Context**: `GET /claude/context/:projectPath?intent={overview|coding|architecture|debugging}`
- **Questions**: `GET /claude/suggest-questions/:projectPath`
- **Analysis**: `POST /claude/analyze-with-context`
- **Plan Suggestions**: `GET /claude/plan-suggestions/:projectPath`
- **Plans**: `POST /plans`, `GET /plans/:projectPath`

### Fix Types Available
- **`duplicates`** - Remove code duplications
- **`centralization`** - Centralize scattered configurations
- **`dependencies`** - Fix circular dependencies
- **`quality`** - General code quality improvements
- **`architecture`** - Improve architectural patterns
- **`security`** - Address security issues (future)
- **`performance`** - Optimize performance bottlenecks (future)
- **`all`** - Apply all fix types (default)

### Aggressiveness Levels
- **`conservative`** - Apply only safe, low-risk fixes
- **`moderate`** - Apply most fixes with reasonable confidence (default)
- **`aggressive`** - Apply all possible fixes, including potentially risky ones

## Support and Next Steps

### Current Status
- **Auto-Improvement Mode**: ✅ **Active** - Comprehensive codebase analysis and improvement
- **Claude Integration**: ✅ **Active** - Token-efficient context and smart questions
- **Interactive Setup**: ✅ **Enhanced** - Auto-discovery and Claude-powered configuration
- **Database System**: ✅ **Production Ready** - PostgreSQL with comprehensive schema
- **Development Plans**: ✅ **Designed** - Ready for Phase 4 implementation

### How to Get Started

#### For Existing Projects (Recommended)
1. **Start with auto-improvement**: `npx codemind auto-fix ./your-project --dry-run`
2. **Review the report**: Check generated improvement recommendations
3. **Apply improvements**: Run without `--dry-run` if satisfied with preview
4. **Setup integration**: `./scripts/interactive-setup.sh -p "your-project"`
5. **Use with Claude Code**: Follow generated CLAUDE.md instructions

#### For New Projects
1. **Setup integration first**: `./scripts/interactive-setup.sh -p "new-project"`
2. **Develop with smart context**: Use API endpoints for Claude Code integration
3. **Monitor code quality**: Run periodic auto-improvements as project grows

### Key Benefits You'll Experience
- ✅ **Immediate Code Improvements** - Auto-fix removes duplicates, centralizes config, improves quality
- ✅ **No Context Repetition** - CodeMind remembers your project details for Claude Code
- ✅ **Faster Development** - Pre-optimized context saves time in every Claude interaction
- ✅ **Better Code Quality** - Continuous monitoring and improvement suggestions
- ✅ **Smart Project Management** - AI-powered development planning (Phase 4)

### Documentation
- **[Auto-Improvement Mode Guide](docs/AUTO_IMPROVEMENT_MODE.md)** - Comprehensive auto-fix documentation
- **[Features Documentation](docs/FEATURES_DOCUMENTATION.md)** - Complete feature overview
- **[Quick Start Guide](docs/QUICKSTART.md)** - 5-minute setup
- **[API Documentation](docs/API.md)** - All endpoints and examples

The system is production-ready and provides immediate value through automated code improvement and intelligent Claude Code integration!