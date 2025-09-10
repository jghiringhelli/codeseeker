# CodeMind Getting Started Guide

## Quick Setup

### 1. Prerequisites
- **Node.js** 18+ and npm
- **Docker** and Docker Compose
- **Git** for version control
- **PostgreSQL** client tools (optional)

### 2. Installation

```bash
# Clone repository
git clone https://github.com/your-org/codemind.git
cd codemind

# Install dependencies
npm install

# Build TypeScript
npm run build
```

### 3. Infrastructure Setup

```bash
# Start all database services
npm run docker:up

# Initialize database schemas (one-time setup)
node dist/cli/codemind-unified-cli.js
> /setup
```

### 4. Project Initialization

```bash
# Navigate to your project directory
cd /path/to/your/project

# Initialize CodeMind
node /path/to/codemind/dist/cli/codemind-unified-cli.js
> /init
```

Follow the interactive prompts:
- **Project Name**: Your project identifier
- **Project Type**: Select from web_application, cli_tool, api_service, etc.
- **Features**: Enable semantic search, code graphs, use case inference
- **Confirmation**: Confirm embedding generation for AI-powered analysis

## Core Features

### **🔍 Semantic Code Search**
```bash
> /search "authentication logic"
> /search "database connection setup"
```

### **📊 Project Analysis**
```bash
> /analyze architecture
> /analyze dependencies
> /analyze quality
```

### **🚀 Natural Language Queries**
```bash
> How is user authentication implemented?
> Show me the main database models
> What are the key security considerations?
```

### **⚡ Workflow Commands**
```bash
> /refactor extract method from large function
> /optimize reduce memory usage in data processing
> /test generate unit tests for authentication
```

## Configuration

### **Environment Variables** (`.env`)
```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=codemind
DB_USER=codemind
DB_PASSWORD=codemind123

# Redis Configuration  
REDIS_HOST=localhost
REDIS_PORT=6379

# OpenAI (optional - local embeddings used as fallback)
OPENAI_API_KEY=your_api_key_here
```

### **Project Settings** (`.codemind/project.json`)
```json
{
  "projectName": "Your Project",
  "projectType": "cli_tool", 
  "languages": ["TypeScript", "JavaScript"],
  "features": ["semantic", "graph", "usecases"]
}
```

## Usage Patterns

### **Daily Development Workflow**
1. **Morning Standup**: `> /status` - Check project health and recent changes
2. **Feature Development**: `> How should I implement feature X?`
3. **Code Review**: `> /analyze quality` - Check code quality before commits
4. **Debugging**: `> /search "error handling patterns"`

### **New Team Member Onboarding**
1. **Project Overview**: `> Explain the overall architecture`
2. **Key Components**: `> Show me the main entry points`
3. **Development Setup**: `> What are the development prerequisites?`

### **Technical Debt Management**
1. **Identify Issues**: `> /analyze technical-debt`
2. **Prioritize Fixes**: `> What are the highest priority code improvements?`
3. **Refactoring Plans**: `> /refactor suggest improvements for module X`

## Advanced Features

### **Custom Analysis**
```bash
# Analyze specific directories
> /analyze src/components --depth 3

# Search with filters
> /search "API endpoints" --type typescript --recent 7days
```

### **Integration with Claude Code**
- CodeMind automatically enhances Claude Code workflows
- Provides intelligent context for AI-powered code generation
- Reduces token usage through smart context selection

### **Team Collaboration**
- Shared project analysis and insights
- Version-controlled configuration
- Centralized knowledge base through semantic search

## Troubleshooting

### **Common Issues**

**Database Connection Errors**
```bash
# Check Docker services
docker ps

# Restart if needed
docker-compose down && docker-compose up -d
```

**Embedding Generation Fails**
```bash
# Check OpenAI API key (if using)
echo $OPENAI_API_KEY

# Use local embeddings only
> /config set embedding-strategy local
```

**Memory Issues with Large Projects**
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=8192"

# Process files in smaller batches
> /config set batch-size 50
```

### **Getting Help**
- **CLI Help**: `> /help [command]`
- **Status Check**: `> /status` 
- **Logs**: Check `~/.codemind/logs/` for detailed debugging

## Performance Tips

1. **Selective Analysis**: Choose specific features during `/init` to reduce processing time
2. **Incremental Updates**: CodeMind tracks file changes and only processes modified files
3. **Batch Processing**: Large projects process files in parallel for optimal performance
4. **Local Embeddings**: Use local embeddings for faster processing without API dependencies

---

**Next Steps**: Explore the [Technical Architecture](../technical/architecture-overview.md) or [Business Overview](../business/investor-overview.md) for deeper insights.