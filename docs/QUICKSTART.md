# CodeMind Quick Start Guide

## What is CodeMind?

CodeMind is an intelligent code auxiliary system that enhances your development workflow by:
- **Analyzing your codebase** to understand patterns and architecture
- **Providing optimized context** to Claude Code for better AI assistance
- **Managing development plans** and tracking progress
- **Generating smart questions** based on your project state

Think of it as a smart assistant that sits between you and Claude Code, making your AI interactions more efficient and context-aware.

## 🚀 5-Minute Setup

### Step 1: Start CodeMind System

```bash
# Clone the repository (if not already done)
git clone https://github.com/yourusername/CodeMind.git
cd CodeMind

# Start the system with Docker
docker-compose -f docker-compose.postgres.yml up -d

# Verify it's running
curl http://localhost:3004/health
```

### Step 2: Install Claude CLI (Recommended)

```bash
# Install Claude CLI for automatic enhancement
npm install -g @anthropics/claude-cli

# Verify installation
claude --version
```

### Step 3: Run Interactive Setup

#### Understanding Project Path

**Project Path** = The **full or relative path** to your project directory (where your code lives)
**Project Name** = Automatically derived from the directory name

**Examples:**
- Path: `/home/user/my-ecommerce-app` → Name: `my-ecommerce-app` 
- Path: `C:\Projects\WebAPI` → Name: `WebAPI`
- Path: `../my-react-app` → Name: `my-react-app`

#### ⭐ NEW: Auto-Discovery Mode

**Auto-Discovery** analyzes your existing codebase and automatically infers project configuration without asking questions:

```bash
# Auto-discovery: Let CodeMind analyze and configure automatically
./scripts/interactive-setup.sh -p "/path/to/project" --auto-discovery
```

**What it detects:**
- 🏗️ **Project Type**: web_application, api_service, library, cli_tool
- 💻 **Languages**: JavaScript, TypeScript, Python, Java, Go, Rust, etc.
- 🏛️ **Architecture**: MVC, Component-Based, Microservices, Layered
- 🧪 **Testing**: Unit, Integration, E2E testing setups
- 📏 **Standards**: ESLint, Prettier, linting configurations
- 🚀 **Frameworks**: React, Vue, Express, Django, Spring, etc.

#### Choose Your Setup Mode

**Option A: Auto-Discovery (Recommended for existing projects)**
```bash
# Let CodeMind analyze your codebase automatically
./scripts/interactive-setup.sh -p "/path/to/your-project" --auto-discovery

# Update existing project configuration
./scripts/interactive-setup.sh -p "/path/to/your-project" --auto-discovery -U

# Example output:
# 🔍 Auto-discovering project configuration...
# ✅ Found: TypeScript, React, Jest testing, ESLint standards
# ✅ Detected: Component-Based Architecture
# Does this look correct? (Y/n): y
# 📊 Final Project Configuration Stored:
#    • Project: my-app
#    • Type: web_application
#    • Languages: TypeScript, JavaScript
#    • Architecture: Component-Based Architecture
```

**Option B: Interactive Questions (Recommended for new projects)**
```bash
# Answer guided questions about your project
./scripts/interactive-setup.sh -p "/path/to/your-project"

# You'll be asked about:
# - Project type (web app, API, library, etc.)
# - Programming languages
# - Architecture patterns
# - Testing strategy
# - And more...
```

#### For a NEW Project (Greenfield)

```bash
# Navigate to CodeMind directory
cd /path/to/CodeMind

# Option 1: Full path with interactive setup
./scripts/interactive-setup.sh -p "/home/user/projects/my-new-app"

# Option 2: Create project directory first, then auto-discover
mkdir /path/to/new-project
# Add some initial files (package.json, README.md)
./scripts/interactive-setup.sh -p "/path/to/new-project" --auto-discovery

# The script will:
# 1. Detect project type (greenfield vs existing)
# 2. Configure based on your choice (interactive vs auto-discovery)
# 3. Create CLAUDE.md in your project directory
# 4. Use project directory name as the API identifier
```

#### For an EXISTING Project

```bash
# Navigate to CodeMind directory  
cd /path/to/CodeMind

# Run setup pointing to your existing codebase
./scripts/interactive-setup.sh -p "/path/to/your/existing-project"

# The system will:
# 1. Detect it's an existing project (≥5 code files)  
# 2. Use Claude CLI with --add-dir to analyze your actual code
# 3. Validate your answers against the real codebase
# 4. Create enhanced CLAUDE.md in your project directory
```

#### Windows PowerShell Examples

```powershell
# Navigate to CodeMind directory
cd C:\path\to\CodeMind

# Full Windows path
.\scripts\interactive-setup.ps1 -ProjectPath "C:\Users\YourName\Projects\MyApp"

# Relative path
.\scripts\interactive-setup.ps1 -ProjectPath "..\MyApp"

# UNC path (network drive)
.\scripts\interactive-setup.ps1 -ProjectPath "\\server\share\projects\MyApp"
```

### Step 4: Use CodeMind in Your Development

After setup, you'll have a `CLAUDE.md` file in your project with API commands.

#### Get Project Context (Before Starting Work)
```bash
# Quick overview (~200 tokens)
curl "http://localhost:3004/claude/context/YourProject?intent=overview"

# Detailed coding context (~500 tokens)
curl "http://localhost:3004/claude/context/YourProject?intent=coding&maxTokens=800"
```

#### Get Smart Questions (When Stuck)
```bash
# Get AI-generated questions for your current project state
curl "http://localhost:3004/claude/suggest-questions/YourProject?maxQuestions=5"
```

#### Use with Claude Code
1. Open Claude Code in your project folder
2. Reference the context from CodeMind API when asking questions
3. Use the smart questions to guide your development

## 📋 Complete Workflow Example

### Setting Up a New Web Application

```bash
# 1. Start CodeMind
cd /path/to/CodeMind
docker-compose -f docker-compose.postgres.yml up -d

# 2. Create your project directory
mkdir ~/projects/my-web-app
cd ~/projects/my-web-app

# 3. Run CodeMind setup
/path/to/CodeMind/scripts/interactive-setup.sh -p "~/projects/my-web-app"
```

**Interactive Setup Flow:**
```
🤖 Choose how to enhance project analysis:
> 1 (Use Claude Code)

Choose Claude Code enhancement method:
> 1 (Automatic Claude CLI)

What type of project is this?
> web_application

What is the primary programming language?
> TypeScript

What architectural pattern do you follow?
> Component-Based Architecture
🆕 Enhancing with Claude CLI (greenfield project)...
✅ Enhanced: "Component-Based Architecture with React patterns, atomic design principles..."

What's your testing approach?
> Unit + Integration Testing  
🆕 Enhancing with Claude CLI...
✅ Enhanced: "Jest for unit tests, React Testing Library for components, Cypress for E2E..."

Project intent?
> E-commerce platform with payment processing

Business value?
> Enable online sales and streamline checkout process
```

### Using CodeMind During Development

#### Starting a New Feature
```bash
# 1. Get context before starting
curl "http://localhost:3004/claude/context/my-web-app?intent=coding"

# 2. Open Claude Code with context
# "I need to implement user authentication. Here's my project context: [paste API response]"
```

#### Code Review
```bash
# Get review-focused context
curl "http://localhost:3004/claude/context/my-web-app?intent=review"

# Ask Claude Code: "Review this authentication implementation: [code]
# Project context: [paste API response]"
```

#### When Stuck
```bash
# Get smart questions
curl "http://localhost:3004/claude/suggest-questions/my-web-app"

# Response might include:
# - "How should you handle JWT token refresh in your authentication flow?"
# - "What security measures are needed for your payment processing?"
# - "How will you manage cart state across sessions?"

# Use these questions with Claude Code for guidance
```

## 🎯 Key Concepts

### Project Types
- **Greenfield** (< 5 code files): New projects get architectural guidance
- **Existing** (≥ 5 code files): Projects get codebase analysis and validation

### Enhancement Methods
1. **Automatic (Claude CLI)**: Fully automated with `claude --print`
2. **Manual**: Copy-paste prompts to Claude Code
3. **Skip**: No AI enhancement

### Context Intents
- **overview**: Quick project summary (~200 tokens)
- **coding**: Detailed development context (~500 tokens)
- **review**: Code review focused context (~600 tokens)

### API Endpoints
- `GET /claude/context/{project}` - Get optimized context
- `GET /claude/suggest-questions/{project}` - Get smart questions
- `POST /claude/analyze-with-context` - Deep analysis
- `GET /health` - Check system status

## 🔧 Configuration

### Environment Variables
```bash
# Optional: Use Claude API instead of CLI
export ANTHROPIC_API_KEY="your-api-key"

# Custom API port (default: 3004)
export API_PORT=3004

# Database connection (if not using Docker)
export DATABASE_URL="postgresql://user:pass@localhost:5432/codemind"
```

### Windows PowerShell Setup
```powershell
# Use PowerShell script instead
.\scripts\interactive-setup.ps1 -ProjectPath "C:\projects\my-app" -UseClaudeCode

# Set environment variables
$env:ANTHROPIC_API_KEY = "your-api-key"
```

## 📊 Development Plan Management (Phase 4 - Preview)

### Create a Development Plan
```bash
curl -X POST http://localhost:3004/plans \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "my-web-app",
    "planType": "feature_development",
    "title": "User Authentication System",
    "projectIntent": "Implement secure JWT-based auth",
    "businessValue": "Enable user accounts and personalization"
  }'
```

### Track Progress
```bash
# Get active plans
curl "http://localhost:3004/plans/my-web-app?status=active"

# Update task status
curl -X POST http://localhost:3004/plans/{planId}/progress \
  -H "Content-Type: application/json" \
  -d '{"taskId": "task-123", "status": "completed"}'
```

## ❓ Frequently Asked Questions

### Project Path vs Project Name

**Q: Is the project path the project name or the actual file path?**
**A:** The project path is the **actual file path** to your project directory. The project name is automatically derived from the directory name.

```bash
# Example:
./scripts/interactive-setup.sh -p "/home/user/my-web-app"
#                                     ^^^^^^^^^^^^^^^^^^^ This is the PROJECT PATH
#                                                ^^^^^^^^ This becomes the PROJECT NAME

# Later used in API calls:
curl "http://localhost:3004/claude/context/my-web-app?intent=coding"
#                                           ^^^^^^^^ Project name as identifier
```

**Q: Can I use relative paths?**
**A:** Yes! Relative paths work from wherever you run the CodeMind script.

```bash
cd /path/to/CodeMind
./scripts/interactive-setup.sh -p "../my-project"  # Relative to CodeMind directory
./scripts/interactive-setup.sh -p "~/projects/my-app"  # Home directory relative
```

**Q: Where does CLAUDE.md get created?**
**A:** In your **project directory** (the path you specified), not in the CodeMind directory.

```bash
./scripts/interactive-setup.sh -p "/home/user/my-app"
# Creates: /home/user/my-app/CLAUDE.md
```

**Q: What if my project directory doesn't exist yet?**
**A:** Create it first, then run setup:

```bash
mkdir /path/to/new-project
./scripts/interactive-setup.sh -p "/path/to/new-project"
```

**Q: Can I rename my project after setup?**
**A:** You'll need to re-run setup with the new path. The API uses the directory name as the identifier.

### Path Examples

| Your Project Location | Command | Project Name | API Calls |
|----------------------|---------|--------------|-----------|
| `/home/user/ecommerce-site` | `-p "/home/user/ecommerce-site"` | `ecommerce-site` | `.../context/ecommerce-site` |
| `C:\Projects\WebAPI` | `-ProjectPath "C:\Projects\WebAPI"` | `WebAPI` | `.../context/WebAPI` |
| `../my-react-app` | `-p "../my-react-app"` | `my-react-app` | `.../context/my-react-app` |

## 🆘 Troubleshooting

### Common Issues

#### CodeMind API Not Running
```bash
# Check if services are running
docker-compose -f docker-compose.postgres.yml ps

# View logs
docker-compose -f docker-compose.postgres.yml logs -f

# Restart services
docker-compose -f docker-compose.postgres.yml restart
```

#### Claude CLI Not Working
```bash
# Reinstall Claude CLI
npm uninstall -g @anthropics/claude-cli
npm install -g @anthropics/claude-cli

# Test Claude CLI
echo "Hello" | claude --print
```

#### Database Connection Issues
```bash
# Reset database
docker-compose -f docker-compose.postgres.yml down -v
docker-compose -f docker-compose.postgres.yml up -d
```

## 💡 Best Practices

### 1. Always Start with Context
Before any coding session, get fresh context from CodeMind API

### 2. Use Appropriate Intents
- `overview` - Planning and architecture decisions
- `coding` - Active development
- `review` - Code review and refactoring

### 3. Update Project Status
Re-run setup periodically as your project evolves

### 4. Leverage Smart Questions
Use the AI-generated questions to uncover blind spots

### 5. Cache Awareness
API responses are cached for 5 minutes - use this for efficient workflows

## 🎓 Advanced Usage

### Custom Analysis
```bash
curl -X POST http://localhost:3004/claude/analyze-with-context \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "my-web-app",
    "analysisType": "security_audit",
    "context": {
      "intent": "security",
      "includePatterns": true,
      "maxContextTokens": 1500
    }
  }'
```

### Multiple Projects
```bash
# Setup multiple projects
./scripts/interactive-setup.sh -p "project1"
./scripts/interactive-setup.sh -p "project2"

# Get context for specific project
curl "http://localhost:3004/claude/context/project1?intent=coding"
curl "http://localhost:3004/claude/context/project2?intent=overview"
```

### CI/CD Integration
```yaml
# .github/workflows/codemind.yml
- name: Get CodeMind Context
  run: |
    CONTEXT=$(curl -s "http://codemind-server:3004/claude/context/$PROJECT?intent=review")
    echo "::set-output name=context::$CONTEXT"
```

## 📚 Next Steps

1. **Explore Phase 4**: Try development plan management features
2. **Customize Templates**: Edit `templates/plan-templates.json`
3. **Integrate with IDE**: Use CodeMind API in your editor
4. **Provide Feedback**: Help improve the system

## 🔗 Quick Reference

| Task | Command |
|------|---------|
| Start System | `docker-compose -f docker-compose.postgres.yml up -d` |
| Run Setup | `./scripts/interactive-setup.sh -p "project-path"` |
| Get Context | `curl "http://localhost:3004/claude/context/project?intent=coding"` |
| Get Questions | `curl "http://localhost:3004/claude/suggest-questions/project"` |
| Check Health | `curl http://localhost:3004/health` |
| View Logs | `docker-compose -f docker-compose.postgres.yml logs -f` |
| Stop System | `docker-compose -f docker-compose.postgres.yml down` |

---

**Need Help?** Check the [full documentation](../SETUP.md) or [troubleshooting guide](../SETUP.md#troubleshooting)