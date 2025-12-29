# CodeMind Documentation Index

This directory contains detailed documentation for CodeMind. For a quick overview, see the [main README](../README.md).

## Getting Started

| Document | Description |
|----------|-------------|
| [CLI Commands Manual](install/cli_commands_manual.md) | Full reference for all CLI commands |
| [MCP Server Guide](technical/mcp-server.md) | Setup MCP server for Claude Code/Desktop integration |
| [Storage Guide](technical/storage.md) | Embedded vs Server mode configuration |
| [Manual Setup Guide](install/manual_setup.md) | Step-by-step setup instructions |

## Technical Reference

| Document | Description |
|----------|-------------|
| [Core Cycle Technical Guide](technical/core_cycle.md) | Code-level implementation details for the 11-step workflow |
| [Architecture Summary](technical/architecture.md) | Three-layer architecture and SOLID principles |
| [Database Schema](db/schema.md) | PostgreSQL, Neo4j, and Redis schema reference |

## Extensions & Deployment

| Document | Description |
|----------|-------------|
| [VSCode Extension](../extensions/vscode-codemind/README.md) | Real-time file sync extension |
| [Database Scripts](../deploy/scripts/README.md) | Manual PostgreSQL, Neo4j, Redis installation |
| [Kubernetes Deployment](../deploy/kubernetes/README.md) | Production Kubernetes manifests |

## Quick Links

- **[Main README](../README.md)** - Project overview and quick start
- **[CLAUDE.md](../CLAUDE.md)** - Instructions for Claude Code integration
- **[ROOT_FILES.md](../ROOT_FILES.md)** - Explanation of all root-level files
- **[CHANGELOG.md](../CHANGELOG.md)** - Version history and release notes
- **[CONTRIBUTING.md](../CONTRIBUTING.md)** - Contribution guidelines
- **[TESTING_GUIDE.md](../TESTING_GUIDE.md)** - Testing documentation and E2E tests

## Directory Structure

```
docs/
├── README.md                 # This file - documentation index
├── install/                  # Installation guides
│   ├── cli_commands_manual.md    # CLI commands reference
│   ├── manual_setup.md           # Manual setup instructions
│   └── vscode_extension.md       # VSCode extension setup
├── technical/                # Technical documentation
│   ├── architecture.md       # Architecture overview
│   ├── core_cycle.md         # Core cycle implementation
│   ├── mcp-server.md         # MCP server setup
│   ├── graphrag.md           # GraphRAG documentation
│   └── storage.md            # Storage modes
└── db/                       # Database documentation
    └── schema.md             # Database schema reference

extensions/vscode-codemind/   # VSCode extension
deploy/scripts/               # Database setup scripts
deploy/kubernetes/            # Kubernetes manifests
```