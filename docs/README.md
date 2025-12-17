# CodeMind Documentation

This directory contains the official documentation for CodeMind.

## Quick Links

### For Users
- **[CLI Commands Manual](cli_commands_manual.md)** - Complete guide to all CLI commands, options, and usage examples
- **[Manual Setup Guide](manual_setup.md)** - Step-by-step manual setup instructions when automated setup fails

### For Developers
- **[MVP Core Cycle](mvp_core_cycle.md)** - The definitive reference for the 10-step CodeMind workflow
- **[Technical Implementation Guide](technical/CODEMIND_CORE_CYCLE_TECHNICAL_GUIDE.md)** - Detailed code-level implementation reference
- **[Architecture Summary](technical/ARCHITECTURE_SUMMARY.md)** - Three-layer architecture and SOLID principles implementation

### Database Documentation
- **[Database Schema](db/CONSOLIDATED_SCHEMA.md)** - Complete PostgreSQL, Neo4j, and Redis schema documentation
- **[Database README](db/README.md)** - Overview of database consolidation and migration

### Architecture Decision Records
- **[ADR Index](adr/README.md)** - Index of architectural decision records
- **[ADR-001: Granular Embeddings](adr/001-granular-semantic-embeddings.md)** - Method and class-level embedding strategy

### Historical Records
- **[Feature Removal Record](feature_removal_record.md)** - Record of features removed during MVP cleanup

## Documentation Structure

```
docs/
├── README.md                    # This file - documentation index
├── cli_commands_manual.md       # CLI commands reference
├── manual_setup.md              # Manual setup instructions
├── mvp_core_cycle.md            # MVP core cycle reference
├── feature_removal_record.md    # Historical feature removal record
├── adr/                         # Architecture Decision Records
│   ├── README.md
│   └── 001-granular-semantic-embeddings.md
├── db/                          # Database documentation
│   ├── README.md
│   └── CONSOLIDATED_SCHEMA.md
└── technical/                   # Technical documentation
    ├── ARCHITECTURE_SUMMARY.md
    └── CODEMIND_CORE_CYCLE_TECHNICAL_GUIDE.md
```

## Getting Started

1. **New Users**: Start with `cli_commands_manual.md` for usage instructions
2. **Contributors**: Read `mvp_core_cycle.md` and `technical/CODEMIND_CORE_CYCLE_TECHNICAL_GUIDE.md`
3. **Database Work**: Reference `db/CONSOLIDATED_SCHEMA.md` for schema details

## Main Project Entry Points

- **CLAUDE.md** (project root) - Claude Code integration instructions and project guidelines
- **README.md** (project root) - Project overview and quick start