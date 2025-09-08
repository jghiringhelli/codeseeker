# CodeMind Master Initialization Guide

## Overview
This guide provides comprehensive instructions for initializing CodeMind projects with the new consolidated initialization system.

## Quick Start

### For New Projects
```bash
# Initialize a new project with full analysis
node scripts/init-project-master.js [PROJECT_PATH] [PROJECT_NAME]

# Windows PowerShell
.\scripts\init-project-master.ps1 -ProjectPath "C:\path\to\project" -ProjectName "MyProject"
```

### For Existing Projects (Reset)
```bash
# Reset and repopulate project data
RESET_PROJECT=true node scripts/init-project-master.js

# Windows PowerShell
.\scripts\init-project-master.ps1 -Reset
```

## Script Structure

### Master Scripts (Use These)
- **`scripts/init-project-master.js`** - Main Node.js initialization script
- **`scripts/init-project-master.ps1`** - PowerShell wrapper for Windows users

### Helper Scripts (Internal Use)
- **`scripts/helpers/database-init.js`** - Database initialization
- **`scripts/helpers/project-init.js`** - Project registration and data population  
- **`scripts/helpers/analysis-runner.js`** - Comprehensive analysis runner
- **`scripts/helpers/dashboard-validator.js`** - Dashboard data validation

## Initialization Workflow

### Phase 1: Project Validation
- Validates project directory exists and is readable
- Scans for source code files (JS, TS, Python, etc.)
- Determines project size and type

### Phase 2: Database Initialization
- Tests connections to PostgreSQL, MongoDB, Neo4j, Redis
- Creates schemas, collections, constraints, and indexes
- Populates foundation data for each connected database
- Creates DuckDB analytics directories

### Phase 3: Project Registration
- Registers project in PostgreSQL with metadata
- Populates comprehensive sample data across all tool tables:
  - Tree navigation data (file structure)
  - Code duplications and refactoring opportunities
  - Test coverage metrics
  - Build/compilation results  
  - SOLID principle violations
  - UI component analysis
  - Use case documentation
  - Detected patterns and analysis results

### Phase 4: Comprehensive Analysis (Optional)
- Runs semantic graph analysis with Neo4j population
- Executes tool autodiscovery and analysis
- Creates embeddings for semantic search
- Generates relationship mappings

### Phase 5: Dashboard Validation
- Validates all critical tables have sufficient data
- Checks optional tables for enhanced features
- Provides recommendations for missing components

## Environment Variables

```bash
# Project configuration  
PROJECT_PATH="/path/to/your/project"      # Target project directory
PROJECT_NAME="MyProject"                  # Display name for project
RESET_PROJECT="true"                      # Reset existing project data
SKIP_ANALYSIS="true"                      # Skip time-intensive analysis
VERBOSE="true"                           # Enable detailed logging

# Database connections (optional - defaults provided)
DB_HOST="localhost"
DB_PORT="5432" 
DB_NAME="codemind"
DB_USER="codemind"
DB_PASSWORD="codemind123"

MONGO_URI="mongodb://codemind:codemind123@localhost:27017/codemind"
NEO4J_URI="bolt://localhost:7687"
NEO4J_USER="neo4j"
NEO4J_PASSWORD="codemind123"
REDIS_HOST="localhost"
REDIS_PORT="6379"
```

## Usage Examples

### Basic Project Initialization
```bash
# Initialize current directory
node scripts/init-project-master.js

# Initialize specific project
node scripts/init-project-master.js /path/to/project ProjectName
```

### PowerShell Examples
```powershell
# Basic initialization
.\scripts\init-project-master.ps1

# With custom parameters
.\scripts\init-project-master.ps1 -ProjectPath "C:\MyProjects\WebApp" -ProjectName "WebApp"

# Reset existing project
.\scripts\init-project-master.ps1 -Reset

# Skip analysis for faster initialization
.\scripts\init-project-master.ps1 -SkipAnalysis

# Verbose output for troubleshooting
.\scripts\init-project-master.ps1 -Verbose
```

### Advanced Usage
```bash
# Reset project and skip analysis (fastest)
RESET_PROJECT=true SKIP_ANALYSIS=true node scripts/init-project-master.js

# Full analysis with verbose logging
VERBOSE=true node scripts/init-project-master.js

# Initialize for specific environment
DB_HOST=mydb.server.com PROJECT_PATH=/app node scripts/init-project-master.js
```

## Dashboard Verification

### Method 1: Validation Script
```bash
# Generate comprehensive data report
node -e "const {generateDataReport} = require('./scripts/helpers/dashboard-validator'); generateDataReport('PROJECT_ID')"
```

### Method 2: Dashboard Access
1. Start the dashboard: `npm run dashboard` or `docker-compose up dashboard`
2. Visit: `http://localhost:3005`
3. Navigate to "📁 Enhanced Project View"
4. Select your project to verify data display

### Method 3: API Testing
```bash
# Check projects list
curl http://localhost:3005/api/projects

# Check project-specific data
curl "http://localhost:3005/project-view.html?projectId=YOUR_PROJECT_ID"
```

## Troubleshooting

### Common Issues

1. **PostgreSQL Connection Failed**
   ```bash
   # Start PostgreSQL in Docker
   docker-compose up database -d
   
   # Or check connection settings
   psql -h localhost -U codemind -d codemind
   ```

2. **Missing Dependencies**
   ```bash
   # Install required packages
   npm install uuid chalk
   
   # Build TypeScript services
   npm run build
   ```

3. **Port Already in Use**
   ```bash
   # Find and stop conflicting processes
   netstat -tulpn | grep :3005
   kill -9 PID
   
   # Or use different port
   PORT=3006 npm run dashboard
   ```

4. **Analysis Services Unavailable**
   - Build the project first: `npm run build`
   - Analysis will fall back to basic file system scanning
   - Use `SKIP_ANALYSIS=true` to bypass entirely

### Validation Checklist

✅ **Critical Tables (Required for dashboard)**
- [ ] `projects` - At least 1 project registered
- [ ] `tree_navigation_data` - At least 5 file/directory entries
- [ ] `detected_patterns` - At least 3 code patterns
- [ ] `analysis_results` - At least 2 analysis records

✅ **Optional Tables (Enhanced features)**
- [ ] `code_duplications` - Duplicate code detection
- [ ] `centralization_opportunities` - Refactoring suggestions
- [ ] `test_coverage_data` - Coverage metrics
- [ ] `compilation_results` - Build results
- [ ] `solid_violations` - SOLID principle analysis
- [ ] `ui_components` - UI component mapping
- [ ] `use_cases` - Requirements documentation

## Success Indicators

After successful initialization, you should see:

```
✅ Your project is ready! Start the dashboard:
   npm run dashboard  
   # or
   docker-compose up dashboard
   # then visit: http://localhost:3005
```

**Dashboard Features Available:**
- 📊 System Overview with project metrics
- 🧠 Smart CLI for intelligent tool selection  
- 🎭 Orchestrator for workflow management
- 📁 Enhanced Project View with comprehensive data
- 🚀 Idea Planner for development planning

## Migration from Legacy Scripts

**Removed Scripts (Replaced by Master System):**
- `project-init.ps1` → Use `init-project-master.ps1`
- `project-init-enhanced.ps1` → Use `init-project-master.ps1`  
- `setup-test-project.js` → Use `init-project-master.js`

**Helper Scripts (Keep for Reference):**
- `initialize-all-databases.js` → Moved to `helpers/`
- `master-database-init.js` → Moved to `helpers/`
- `mongo-init.js` → Moved to `helpers/`

The new master system provides all functionality with improved error handling, comprehensive reporting, and better user experience.