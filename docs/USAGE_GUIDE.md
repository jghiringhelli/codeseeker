# CodeMind Usage Guide

## Complete Project Setup and Usage Workflow

This guide shows you exactly how to set up and use CodeMind with real examples and practical workflows.

## 🎯 The CodeMind Advantage

### Before CodeMind
```
You: "Help me implement user authentication in my app"
Claude: "What framework are you using? What database? What's your current auth setup? Do you have any existing user models?"
[10 minutes of back-and-forth to establish context...]
```

### After CodeMind  
```bash
curl "http://localhost:3004/claude/context/my-app?intent=coding"
```
```
You: "Help me implement user authentication. Context: {Express.js app, PostgreSQL with Users table, JWT pattern established, bcrypt for hashing, existing middleware structure...}"
Claude: "Based on your setup, here's the authentication implementation that follows your established patterns..."
[Immediate, accurate, contextual help]
```

## 📋 Setup Checklist

### ✅ System Requirements
- [ ] Docker & Docker Compose installed
- [ ] Git for cloning repository
- [ ] Claude CLI: `npm install -g @anthropics/claude-cli`
- [ ] curl or equivalent for API testing

### ✅ Initial Setup (5 minutes)
```bash
# 1. Clone and start system
git clone https://github.com/yourusername/CodeMind.git
cd CodeMind
docker-compose -f docker-compose.postgres.yml up -d

# 2. Verify system is running
curl http://localhost:3004/health
# Expected: {"status":"healthy","database":"connected"}

# 3. Test Claude CLI
echo "Hello" | claude --print
# Expected: AI response
```

### ✅ Project Configuration (2 minutes per project)

#### Understanding Paths and Names
- **Project Path**: Full or relative path to your project directory (where code lives)
- **Project Name**: Automatically derived from directory name
- **API Identifier**: Uses the project name for API calls

#### Setup Examples
```bash
# Full absolute path
./scripts/interactive-setup.sh -p "/home/user/my-ecommerce-app"
# → Project Name: "my-ecommerce-app"
# → API calls: curl ".../claude/context/my-ecommerce-app?intent=coding"

# Relative path from CodeMind directory
./scripts/interactive-setup.sh -p "../projects/web-api"
# → Project Name: "web-api" 
# → API calls: curl ".../claude/context/web-api?intent=overview"

# Windows full path
.\scripts\interactive-setup.ps1 -ProjectPath "C:\Projects\MyReactApp"
# → Project Name: "MyReactApp"
# → API calls: curl ".../claude/context/MyReactApp?intent=review"

# Create new project directory and setup
mkdir ~/projects/new-mobile-app
./scripts/interactive-setup.sh -p "~/projects/new-mobile-app"
```

#### Follow the Setup Prompts
```
# During setup:
# - Choose: 1 (Claude Code) 
# - Choose: 1 (Automatic Claude CLI)
# - Answer project questions
# - Let Claude CLI enhance your answers automatically
```

#### What Gets Created
- **CLAUDE.md**: Written to your project directory (not CodeMind directory)
- **Database entry**: Project metadata stored in CodeMind database
- **API endpoints**: Available using your project name as identifier

## 🚀 Real-World Usage Examples

### Example 1: Starting a New Feature

**Scenario**: You need to implement a shopping cart feature

```bash
# 1. Get current project context
curl "http://localhost:3004/claude/context/ecommerce-app?intent=coding&maxTokens=800"

# Response includes your:
# - Architecture: "Express.js with MVC pattern"
# - Database: "PostgreSQL with Products, Users tables"
# - Patterns: "RESTful endpoints, JWT auth, validation middleware"
# - Current structure: File organization and naming conventions

# 2. Use with Claude Code
# "I need to implement a shopping cart feature. Here's my project context: [paste response]
# 
# The cart should:
# - Allow adding/removing products
# - Persist across sessions
# - Calculate totals with tax
# - Integrate with existing user authentication"
```

**Result**: Claude provides implementation that perfectly fits your existing patterns and architecture.

### Example 2: Code Review Session

**Scenario**: You've written authentication logic and want it reviewed

```bash
# 1. Get review-focused context  
curl "http://localhost:3004/claude/context/my-app?intent=review&maxTokens=600"

# 2. Use with Claude Code
# "Please review this authentication implementation. Context: [paste response]
#
# [Your authentication code here]
#
# Focus on security, performance, and consistency with the existing codebase."
```

**Result**: Claude reviews your code with full knowledge of your project's patterns, security requirements, and architectural decisions.

### Example 3: When You're Stuck

**Scenario**: You're not sure what to implement next

```bash
# 1. Get smart questions for your project
curl "http://localhost:3004/claude/suggest-questions/my-app?maxQuestions=6"

# Response might include:
# - "How will you handle session management across multiple devices?"
# - "What caching strategy should you implement for frequently accessed data?"
# - "How will you structure error handling for your API endpoints?"
# - "What testing approach works best for your authentication flow?"

# 2. Pick a question and ask Claude Code
# "How should I handle session management across multiple devices? 
# Context: [get fresh context] My current setup: [describe current implementation]"
```

**Result**: Targeted guidance that moves your project forward with specific, actionable next steps.

### Example 4: Deep Technical Analysis

**Scenario**: You want to analyze your codebase for improvements

```bash
# 1. Request deep analysis
curl -X POST http://localhost:3004/claude/analyze-with-context \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "my-app",
    "analysisType": "code_review",
    "context": {
      "intent": "quality_improvement",
      "includePatterns": true,
      "maxContextTokens": 1200
    }
  }'

# 2. Use comprehensive response with Claude Code
# "Based on this analysis of my codebase: [paste response]
# 
# What are the top 3 technical debt issues I should address first?
# Provide specific refactoring recommendations."
```

**Result**: Prioritized improvement recommendations based on actual code analysis.

## 🔄 Development Workflow Integration

### Daily Development Routine

#### Morning: Planning Session
```bash
# 1. Check project status
curl "http://localhost:3004/claude/context/my-app?intent=overview"

# 2. Review active plans (if using Phase 4)
curl "http://localhost:3004/plans/my-app?status=active"

# 3. Get fresh questions for direction
curl "http://localhost:3004/claude/suggest-questions/my-app"

# 4. Plan your day with Claude Code using this context
```

#### During Development: Context-First Approach
```bash
# Before each major coding session:
curl "http://localhost:3004/claude/context/my-app?intent=coding&maxTokens=800"

# Use this context with every Claude Code interaction
```

#### End of Day: Review and Planning
```bash
# Get review context
curl "http://localhost:3004/claude/context/my-app?intent=review"

# Update project progress (Phase 4)
curl -X POST http://localhost:3004/plans/{planId}/progress \
  -H "Content-Type: application/json" \
  -d '{"taskId": "completed-today", "status": "completed"}'
```

## 📊 Project Management with Phase 4

### Setting Up Development Plans

```bash
# 1. Create a feature development plan
curl -X POST http://localhost:3004/plans \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "my-app",
    "planType": "feature_development",
    "title": "User Profile Management",
    "projectIntent": "Allow users to create and manage their profiles",
    "businessValue": "Improve user engagement and personalization",
    "qualityRequirements": ["High security", "High performance"]
  }'

# 2. Track daily progress
curl "http://localhost:3004/plans/my-app"

# 3. Update task completion
curl -X POST http://localhost:3004/plans/{planId}/progress \
  -H "Content-Type: application/json" \
  -d '{
    "taskUpdates": [{
      "taskId": "create-profile-endpoint",
      "status": "completed",
      "notes": "Implemented with validation middleware"
    }]
  }'

# 4. Get plan insights
curl "http://localhost:3004/claude/plan-suggestions/my-app"
```

## 🎯 Best Practices

### 1. Context Freshness
- **Get fresh context** before major coding sessions (context is cached for 5 minutes)
- **Use appropriate intents**: `overview` for planning, `coding` for development, `review` for evaluation

### 2. Token Optimization
- **Adjust maxTokens** based on your needs: 200 for quick questions, 800 for detailed coding context
- **Use intent-specific endpoints** instead of generic queries

### 3. Integration Patterns
- **Always start with context** before asking Claude Code for help
- **Use smart questions** when you're not sure what to ask
- **Combine multiple API calls** for comprehensive analysis

### 4. Project Evolution
- **Re-run setup periodically** as your project grows and changes
- **Update project metadata** when you change architecture or add major features
- **Track progress** using Phase 4 features to maintain development momentum

## 🔍 Advanced Usage Patterns

### Multi-Project Management
```bash
# Setup multiple projects
./scripts/interactive-setup.sh -p "frontend-app"
./scripts/interactive-setup.sh -p "backend-api"  
./scripts/interactive-setup.sh -p "mobile-app"

# Get context for specific projects
curl "http://localhost:3004/claude/context/frontend-app?intent=coding"
curl "http://localhost:3004/claude/context/backend-api?intent=overview"
```

### Team Collaboration
```bash
# Share standardized setup
git commit -m "Add CodeMind configuration"

# Team members can use the same context
curl "http://localhost:3004/claude/context/shared-project?intent=coding"

# Consistent Claude Code interactions across team
```

### CI/CD Integration
```yaml
# .github/workflows/code-review.yml
- name: Get CodeMind Context
  run: |
    CONTEXT=$(curl -s "http://codemind-server:3004/claude/context/$PROJECT?intent=review")
    echo "Project context available for review automation"
```

## 🛠️ Troubleshooting

### Common Issues and Solutions

#### API Not Responding
```bash
# Check system status
docker-compose -f docker-compose.postgres.yml ps
docker-compose -f docker-compose.postgres.yml logs -f

# Restart if needed
docker-compose -f docker-compose.postgres.yml restart
```

#### Claude CLI Issues  
```bash
# Reinstall Claude CLI
npm uninstall -g @anthropics/claude-cli
npm install -g @anthropics/claude-cli

# Test functionality
echo "Test prompt" | claude --print
```

#### Context Seems Outdated
```bash
# CodeMind caches responses for 5 minutes
# Wait 5 minutes or restart the service for fresh analysis
docker-compose -f docker-compose.postgres.yml restart codemind-api
```

## 📈 Measuring Success

You'll know CodeMind is working when:
- ✅ **Claude Code responses are immediately relevant** to your project
- ✅ **You spend less time explaining context** and more time getting help
- ✅ **Code suggestions follow your established patterns** automatically
- ✅ **You get unstuck faster** with smart, project-specific questions
- ✅ **Development velocity increases** due to better AI assistance

## 🔗 Quick Reference

| Use Case | Command | Purpose |
|----------|---------|---------|
| Start coding | `curl ".../context/project?intent=coding"` | Get development context |
| Need direction | `curl ".../suggest-questions/project"` | Get smart questions |
| Code review | `curl ".../context/project?intent=review"` | Get review context |
| Project overview | `curl ".../context/project?intent=overview"` | Get high-level summary |
| Deep analysis | `POST .../analyze-with-context` | Comprehensive analysis |
| Create plan | `POST .../plans` | Start development plan |
| Check health | `curl .../health` | Verify system status |

---

**Ready to transform your Claude Code experience?** Start with the [Quick Start Guide](QUICKSTART.md) and follow this usage guide for maximum productivity!