# Quick Start Guide

> **User Guide** | [← Back to User Guides](README.md) | [Usage Guide](usage-guide.md) | [Installation](installation.md)

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
git clone https://github.com/your-org/CodeMind.git
cd CodeMind

# Start the complete system (API + Dashboard + Database)
docker-compose -f docker-compose.dashboard.yml up -d

# Verify services are running
curl http://localhost:3004/health                         # API service
curl http://localhost:3005/api/dashboard/status          # Dashboard service
```

### Step 2: Access the Dashboard

Open your browser: **🖥️ http://localhost:3005**

You'll see:
- **System Overview** - Overall system health and metrics  
- **Project View** - Project-specific monitoring (after initializing projects)

### Step 3: Initialize Your First Project

**🎯 Recommended: Use the Interactive Setup Script**

```bash
# Navigate to CodeMind directory
cd CodeMind

# Interactive setup with auto-discovery (easiest)
./scripts/interactive-setup.sh -p "/path/to/your/project" --auto-discovery

# Or interactive setup with guided questions
./scripts/interactive-setup.sh -p "/path/to/your/project"
```

**Alternative: Direct API Call**

```bash
curl -X POST "http://localhost:3004/init" \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "/path/to/your/project",
    "projectName": "MyProject",
    "mode": "comprehensive"
  }'
```

### Step 4: Monitor in Dashboard

1. Return to http://localhost:3005
2. Switch to **Project View** tab
3. Select your project from dropdown
4. Watch real-time initialization progress!

## ⚡ Quick Tasks

### Initialize Multiple Projects

**🎯 Recommended: Interactive Script for Each Project**

```bash
# Project 1 - Frontend (quick analysis)
./scripts/interactive-setup.sh -p "/path/to/frontend-project" --auto-discovery

# Project 2 - Backend (comprehensive analysis)
./scripts/interactive-setup.sh -p "/path/to/backend-project" --auto-discovery

# Project 3 - Legacy System (guided setup for complex projects)
./scripts/interactive-setup.sh -p "/path/to/legacy-system"
```

**Alternative: Direct API Calls**

```bash
# Project 1
curl -X POST "http://localhost:3004/init" \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "/path/to/project1", "projectName": "Frontend", "mode": "quick"}'

# Project 2  
curl -X POST "http://localhost:3004/init" \
  -H "Content-Type: application/json" \
  -d '{"projectPath": "/path/to/project2", "projectName": "Backend", "mode": "comprehensive"}'
```

### Get Claude Code Context

```bash
# Get optimized context for your project
curl "http://localhost:3004/claude/context/MyProject?intent=coding&maxTokens=4000"

# Get smart questions about your project
curl "http://localhost:3004/claude/suggest-questions/MyProject"
```

## 🎉 You're Ready!

You now have CodeMind running with:

✅ **Dashboard monitoring** at http://localhost:3005  
✅ **API service** at http://localhost:3004  
✅ **Multi-project capability** for managing several codebases  
✅ **Real-time progress tracking** via the dashboard

## 🚀 Next Steps

### Learn More
- **[Getting Started Guide](getting-started.md)** - Detailed setup and multi-project workflows  
- **[Usage Guide](usage-guide.md)** - Advanced API usage and features
- **[Auto-Improvement Guide](auto-improvement.md)** - Interactive code improvement workflows

### Quick Tips
- **Monitor multiple projects** by switching between them in the Project View tab
- **Watch initialization progress** in real-time via the dashboard
- **Use the API endpoints** to integrate with Claude Code or other tools
- **Check system health** regularly in the System Overview tab

---

**Ready for more?** → [Getting Started Guide](getting-started.md)
