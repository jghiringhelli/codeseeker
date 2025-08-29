# CodeMind Documentation

**CodeMind** is a three-layer AI development platform that transforms ideas into implemented code through intelligent planning, orchestration, and execution using Claude AI at every layer.

## 🏗️ Three-Layer Architecture

### Layer 1: Smart CLI 🧠
**Database-backed intelligent tool selection for daily development**
- [Platform Overview](architecture/platform-overview.md) - Complete three-layer architecture
- [Installation Guide](guides/installation-guide.md) - Platform setup and configuration
- **Usage**: `codemind "your query" ./project` - AI selects optimal tools, updates databases

### Layer 2: Workflow Orchestrator 🎭  
**Redis-based sequential role coordination for complex implementations**
- [Sequential Workflows](architecture/sequential-workflows.md) - Technical architecture details
- [Migration Guide](guides/migration-to-sequential-workflows.md) - Upgrading from legacy system
- **Usage**: `codemind orchestrate "complex task" ./project` - 5-role coordinated pipeline

### Layer 3: Idea Planner 🚀
**Interactive AI planning for idea-to-implementation workflows**
- Dashboard → "💡 I have an idea" button → AI conversation
- Automated generation of roadmaps, business plans, tech stacks, architectures
- Seamless handoff to Orchestrator for implementation

## 📖 Essential Documentation

### Getting Started
- **[Platform Overview](architecture/platform-overview.md)** - Complete architecture understanding
- **[Installation Guide](guides/installation-guide.md)** - Setup and configuration
- **[Migration Guide](guides/migration-to-sequential-workflows.md)** - Upgrading from legacy

### Technical Reference  
- **[Sequential Workflows](architecture/sequential-workflows.md)** - Layer 2 technical architecture
- **[Database Schema](../src/database/schema.postgres.sql)** - PostgreSQL schema reference

## 🚀 Quick Start

### Three-Layer Platform Setup
```bash
# 1. Install platform
git clone https://github.com/your-org/codemind.git
cd codemind && npm install && npm run build

# 2. Start services  
docker-compose up -d

# 3. Use the layers
codemind "optimize performance" ./project          # Layer 1: Smart CLI
codemind orchestrate "production review" ./project  # Layer 2: Orchestrator  
# Layer 3: Dashboard → http://localhost:3005 → "💡 I have an idea"
```

## 🔗 Key Resources

- **[Platform Overview](architecture/platform-overview.md)** - Complete three-layer architecture
- **[GitHub Repository](https://github.com/your-org/codemind)** - Source code and issues
- **[Migration Guide](guides/migration-to-sequential-workflows.md)** - Upgrading from legacy system

---

**CodeMind Platform**: Three-layer AI development ecosystem  
**From ideas to implementation** 🚀