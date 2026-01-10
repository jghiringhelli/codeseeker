# CodeSeeker Documentation Index

This directory contains detailed documentation for CodeSeeker. For a quick overview, see the [main README](../README.md).

## Getting Started

| Document | Description |
|----------|-------------|
| [Claude Code Plugin](install/claude-code-plugin.md) | **Recommended** - Install CodeSeeker as a Claude Code plugin |
| [CLI Commands Manual](install/cli_commands_manual.md) | Full reference for all CLI commands |
| [MCP Server Guide](install/mcp-server.md) | Setup MCP server for Claude Code/Desktop integration |
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
| [Claude Code Plugin](../plugins/codeseeker/README.md) | Claude Code plugin with slash commands and skills |
| [VSCode Extension](../extensions/vscode-codeseeker/README.md) | Real-time file sync extension (legacy) |
| [Database Scripts](../deploy/scripts/README.md) | Manual PostgreSQL, Neo4j, Redis installation |
| [Kubernetes Deployment](../deploy/kubernetes/README.md) | Production Kubernetes manifests |

## Quick Links

- **[Main README](../README.md)** - Project overview and quick start
- **[CLAUDE.md](../CLAUDE.md)** - Instructions for Claude Code integration
- **[root_files.md](technical/root_files.md)** - Explanation of all root-level files
- **[CHANGELOG.md](../CHANGELOG.md)** - Version history and release notes
- **[CONTRIBUTING.md](../CONTRIBUTING.md)** - Contribution guidelines
- **[testing_guide.md](testing/testing_guide.md)** - Testing documentation and E2E tests

## Directory Structure

```
docs/
├── README.md                 # This file - documentation index
├── install/                  # Installation guides
│   ├── claude-code-plugin.md     # Claude Code plugin setup (recommended)
│   ├── cli_commands_manual.md    # CLI commands reference
│   ├── manual_setup.md           # Manual setup instructions
│   ├── mcp-server.md             # MCP server setup
│   └── vscode_extension.md       # VSCode extension setup (legacy)
├── technical/                # Technical documentation
│   ├── architecture.md       # Architecture overview
│   ├── core_cycle.md         # Core cycle implementation
│   ├── graphrag.md           # GraphRAG documentation
│   ├── root_files.md         # Explanation of files in root folder
│   └── storage.md            # Storage modes
└── db/                       # Database documentation
    └── schema.md             # Database schema reference

extensions/vscode-codeseeker/   # VSCode extension
deploy/scripts/               # Database setup scripts
deploy/kubernetes/            # Kubernetes manifests
```