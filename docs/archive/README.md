# Technical Specifications

**CodeMind Three-Layer Platform - Technical References**

> [← Back to Documentation Index](../index.md) | [Main README](../README.md) | [Architecture](../architecture/README.md)

Technical specifications and reference documentation for CodeMind's three-layer architecture.

## 🔧 Core Specifications

### Database & Storage
- **[Database Schema](database-schema.md)** - Complete PostgreSQL database design with tables, relationships, and data flows

## 🏗️ Architecture References

### System Components
- **[Architecture Overview](../architecture/README.md)** - Three-layer architecture technical implementation
- **[Sequential Workflows](../architecture/sequential-workflows.md)** - Workflow orchestration system
- **[System Architecture](../architecture/system-architecture.md)** - Component interactions and integration

### Implementation Details
- **Database Schema**: [`src/database/schema.postgres.sql`](../../src/database/schema.postgres.sql)
- **API Endpoints**: [`src/orchestration/orchestrator-server.ts`](../../src/orchestration/orchestrator-server.ts)
- **External Tools**: [`src/orchestration/external-tool-manager.ts`](../../src/orchestration/external-tool-manager.ts)
- **CLI Implementation**: [`src/cli/codemind.ts`](../../src/cli/codemind.ts)

## 🎯 Key Technical Features

### Layer 1: Smart CLI
- **Intelligent Tool Selection**: AI-powered tool recommendations with confidence scoring
- **Token Optimization**: 75-90% token reduction through smart tool selection
- **Context Integration**: Real-time context enhancement for Claude Code sessions

### Layer 2: Orchestrator  
- **External Tool Management**: 8 default tools with automatic installation
- **Sequential Workflows**: Redis-based role coordination and message queuing
- **Database Integration**: PostgreSQL with comprehensive schema and data management

### Layer 3: Planner
- **Project Analysis**: Automated project structure and technology detection
- **Implementation Planning**: AI-powered workflow generation and task coordination
- **Knowledge Integration**: Context-aware recommendations and insights

## 🛠️ Technical Implementation

### Database Design
- **PostgreSQL Backend**: Production-ready with persistent volumes
- **Key Tables**: `external_tools`, `projects`, `tool_installations`, `role_tool_permissions`
- **Initialization**: Automated via database initialization scripts

### API Architecture
- **RESTful Endpoints**: Complete API for tool management and orchestration
- **Message Queuing**: Redis-based coordination between components
- **Health Monitoring**: System status and performance tracking

### External Tool Integration
- **Smart Detection**: Automatic language and framework detection
- **Installation Management**: User-controlled tool installation with permissions
- **Performance Tracking**: Tool effectiveness metrics and optimization

## 🔗 Related Documentation

- **[Architecture Documentation](../architecture/README.md)** - Complete architectural overview
- **[Setup Guide](../guides/Setup-Guide.md)** - Installation and configuration
- **[API Reference](../api-reference/README.md)** - REST API documentation
- **[CLI Usage Guide](../CLI_USAGE_GUIDE.md)** - Command reference and examples

---

**Focus**: Technical specifications for the three-layer architecture  
**Audience**: Developers, architects, system integrators  
**Approach**: Detailed technical information with code references