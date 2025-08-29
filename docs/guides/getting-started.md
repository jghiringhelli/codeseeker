# Getting Started with CodeMind

> **User Guide** | [← Back to User Guides](README.md) | [Dashboard Usage](#-dashboard-monitoring) | [Multi-Project Setup](#-managing-multiple-projects)

This guide will walk you through your first CodeMind experience, from system setup to monitoring multiple projects via the dashboard.

## 📋 Prerequisites

Before you begin, ensure you have:
- **Docker & Docker Compose** installed ([Download](https://docs.docker.com/get-docker/))
- **Git** installed and configured ([Download](https://git-scm.com/))
- Multiple code projects ready for analysis (any language supported)
- **Optional**: PowerShell or curl for API testing

## 🚀 System Setup

### Step 1: Clone and Start CodeMind

```bash
# Clone the repository
git clone https://github.com/your-org/CodeMind.git
cd CodeMind

# Start the complete system (API + Dashboard + Database)
docker-compose -f docker-compose.dashboard.yml up -d

# Verify services are running
curl http://localhost:3004/health     # API service
curl http://localhost:3005/api/dashboard/status  # Dashboard service
```

### Step 2: Access the Dashboard

Open your browser and navigate to:
**🖥️ http://localhost:3005** 

You should see the CodeMind Dashboard with:
- **System Overview** tab - Overall system health and metrics
- **Project View** tab - Project-specific monitoring and details

## 🔍 Your First Project Analysis

### Step 3: Initialize Your First Project

**🎯 Recommended: Interactive Setup Script**

```bash
# Navigate to CodeMind directory
cd CodeMind

# Interactive setup with auto-discovery (analyzes your project automatically)
./scripts/interactive-setup.sh -p "/path/to/your/project" --auto-discovery

# Or guided interactive setup (asks questions about your project)
./scripts/interactive-setup.sh -p "/path/to/your/project"
```

**What the Interactive Script Does:**
- 🔍 **Auto-discovers** your project type, languages, and frameworks
- 🎯 **Asks smart questions** to understand your project better
- 📋 **Configures optimal settings** based on your codebase
- 🚀 **Handles the API calls** for you automatically
- 📊 **Shows progress** and provides helpful feedback

**Alternative: Direct API Call**

```bash
curl -X POST "http://localhost:3004/init" \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "/path/to/your/project",
    "projectName": "MyFirstProject",
    "mode": "comprehensive"
  }'
```

### Step 4: Monitor Progress in Dashboard

1. **Return to the dashboard**: http://localhost:3005
2. **Switch to Project View** tab
3. **Select your project** from the dropdown
4. **Monitor real-time progress**:
   - Initialization phases
   - Pattern detection results
   - Quality metrics
   - Active AI roles and processes

## 📊 Dashboard Monitoring

### System Overview Tab
- **System Health**: Overall status and uptime
- **Active Processes**: Currently running workflows
- **Role Activity**: AI role utilization and performance
- **Recent Accomplishments**: Latest completed tasks
- **System Metrics**: Performance graphs and statistics

### Project View Tab  
- **Project Selection**: Dropdown to switch between projects
- **Project Details**: Specific project information and progress
- **Pattern Analysis**: Detected code patterns and architecture
- **Project Metrics**: Project-specific performance data
- **Recent Logs**: Project-filtered log entries

## 🔄 Managing Multiple Projects

### Adding Additional Projects

**🎯 Recommended: Interactive Script**

```bash
# Initialize second project (quick analysis)
./scripts/interactive-setup.sh -p "/path/to/another/project" --auto-discovery

# Initialize legacy project with guided questions (for complex setup)
./scripts/interactive-setup.sh -p "/path/to/legacy/project"

# Initialize multiple projects in sequence
./scripts/interactive-setup.sh -p "/path/to/frontend"
./scripts/interactive-setup.sh -p "/path/to/backend" 
./scripts/interactive-setup.sh -p "/path/to/mobile-app"
```

**💡 Interactive Script Benefits:**
- **Auto-detects** project configuration automatically
- **Handles errors** and provides helpful suggestions  
- **Optimizes settings** based on project size and complexity
- **Provides progress feedback** during initialization
- **No need to specify** project names or modes manually

**Alternative: Direct API Calls**

```bash
# Initialize second project
curl -X POST "http://localhost:3004/init" \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "/path/to/another/project",
    "projectName": "SecondProject", 
    "mode": "quick"
  }'

# Initialize third project with custom settings
curl -X POST "http://localhost:3004/init" \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "/path/to/legacy/project",
    "projectName": "LegacySystem",
    "mode": "comprehensive",
    "batchSize": 10,
    "metadata": {
      "team": "backend",
      "priority": "high"
    }
  }'
```

### Monitoring Multiple Projects

1. **Use the Project View tab** in the dashboard
2. **Select different projects** from the dropdown to switch between them
3. **Compare metrics** across projects
4. **Monitor parallel initialization** of multiple projects simultaneously

## 🎯 Next Steps

### Immediate Actions
1. **[Usage Guide](usage-guide.md)** - Learn detailed API usage and advanced features
2. **[Configuration Guide](configuration.md)** - Customize CodeMind for your workflow
3. **[Auto-Improvement Guide](auto-improvement.md)** - Use interactive improvement features

### Advanced Usage
```bash
# Get optimized context for Claude Code
curl "http://localhost:3004/claude/context/MyFirstProject?intent=coding&maxTokens=4000"

# Get smart questions about your project
curl "http://localhost:3004/claude/suggest-questions/MyFirstProject"

# Request AI analysis with context
curl -X POST "http://localhost:3004/claude/analyze-with-context" \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "/path/to/your/project",
    "analysisType": "architecture_review",
    "context": "I want to understand the overall system design"
  }'
```

## 🔧 Troubleshooting

### Common Issues

**Dashboard not loading?**
```bash
# Check if services are running
docker-compose -f docker-compose.dashboard.yml ps

# Restart services if needed
docker-compose -f docker-compose.dashboard.yml restart
```

**Project initialization failing?**
```bash
# Check API logs
docker-compose -f docker-compose.dashboard.yml logs codemind-api

# Check database connection
curl http://localhost:3004/health

# Make sure you're running the script from CodeMind directory
cd CodeMind
./scripts/interactive-setup.sh -p "/your/project/path" --auto-discovery
```

**Dashboard shows no data?**
- Ensure projects have been initialized via the API first
- Check that the database contains project data
- Verify API endpoints are responding correctly

## 🎉 Success Indicators

You've successfully set up CodeMind when you can:

✅ **Access the dashboard** at http://localhost:3005  
✅ **Initialize projects** via API calls  
✅ **Monitor multiple projects** in the Project View tab  
✅ **See real-time metrics** and progress updates  
✅ **Get context-optimized responses** for Claude Code integration

---

**Next**: [Usage Guide](usage-guide.md) | **Related**: [Dashboard Features](../features/overview.md#dashboard-monitoring)
