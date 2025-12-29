# Root-Level Files Reference

This document explains every file at the root level of the CodeMind project.

## Documentation Files

### README.md
**Purpose**: Main project documentation
**Audience**: End users, developers, contributors
**Content**: Quick start, installation, features overview, CLI commands
**Keep**: ✅ Essential - First file users see

### CLAUDE.md
**Purpose**: Instructions for Claude Code integration
**Audience**: AI assistants (Claude Code)
**Content**: Project architecture, SOLID principles, coding standards, workflow patterns
**Keep**: ✅ Essential - Guides AI assistants working on this codebase

### CODEMIND.md
**Purpose**: CodeMind product overview and marketing
**Audience**: Potential users, stakeholders
**Content**: Product description, key features, use cases
**Keep**: ✅ Good to have - Marketing/overview document

### PROMOTION.md
**Purpose**: Promotional content for CodeMind
**Audience**: Marketing, social media
**Content**: Taglines, feature highlights, promotional copy
**Keep**: ✅ Good to have - Marketing material

### CHANGELOG.md
**Purpose**: Version history and release notes
**Audience**: Users, developers
**Content**: Version-by-version changes, features, bug fixes
**Keep**: ✅ Essential - Standard for npm packages

### CONTRIBUTING.md
**Purpose**: Contribution guidelines
**Audience**: Open source contributors
**Content**: How to contribute, code standards, PR process
**Keep**: ✅ Essential - Standard for open source projects

### SECURITY.md
**Purpose**: Security policy and vulnerability reporting
**Audience**: Security researchers, users
**Content**: How to report security issues, security practices
**Keep**: ✅ Essential - Best practice for public repos

### LICENSE
**Purpose**: Software license (MIT)
**Audience**: Legal, users, contributors
**Content**: MIT License text
**Keep**: ✅ **REQUIRED** - Legal requirement for distribution

### TODO
**Purpose**: Task tracking and development notes
**Audience**: Developers
**Content**: Pending tasks, known issues, future plans
**Keep**: ⚠️ Consider moving to GitHub Issues or keeping as dev notes

### TESTING_GUIDE.md
**Purpose**: Testing documentation
**Audience**: Developers, QA
**Content**: How to run tests, test structure, E2E testing
**Keep**: ✅ Good to have - Helps contributors run tests

## Configuration Files

### package.json
**Purpose**: NPM package manifest
**Content**: Dependencies, scripts, metadata, bin entry point
**Keep**: ✅ **REQUIRED** - npm package definition

### package-lock.json
**Purpose**: Locked dependency versions
**Content**: Exact versions of all dependencies (auto-generated)
**Keep**: ✅ **REQUIRED** - Ensures reproducible builds

### tsconfig.json
**Purpose**: Main TypeScript compiler configuration
**Content**: Compiler options, include/exclude patterns
**Keep**: ✅ **REQUIRED** - TypeScript compilation

### tsconfig.core.json
**Purpose**: TypeScript configuration for core modules
**Content**: Stricter TypeScript settings for core code
**Keep**: ✅ Recommended - Separate config for different strictness levels

### jest.config.js
**Purpose**: Jest test runner configuration
**Content**: Test patterns, coverage thresholds, setup files
**Keep**: ✅ **REQUIRED** - Test framework configuration

### eslint.config.mjs
**Purpose**: ESLint linting rules (Flat Config)
**Content**: Code quality rules, style enforcement
**Keep**: ✅ **REQUIRED** - Code quality enforcement

### .prettierrc
**Purpose**: Prettier code formatting rules
**Content**: Formatting preferences (semicolons, quotes, etc.)
**Keep**: ✅ **REQUIRED** - Code style consistency

## Docker & Deployment

### Dockerfile
**Purpose**: Docker image build instructions
**Content**: Multi-stage build for CodeMind services
**Keep**: ✅ Essential - Container deployment

### docker-compose.yml
**Purpose**: Docker Compose orchestration
**Content**: PostgreSQL, Neo4j, Redis, CodeMind services
**Keep**: ✅ Essential - Local development and deployment

### .dockerignore
**Purpose**: Files to exclude from Docker build context
**Content**: node_modules, .git, tests, documentation
**Keep**: ✅ Essential - Speeds up Docker builds

## Environment Configuration

### .env.example
**Purpose**: Template for environment variables
**Content**: Example values for DB_HOST, API keys, ports
**Keep**: ✅ Essential - Shows required environment variables

### .env
**Purpose**: Local environment variables (gitignored)
**Content**: Actual sensitive values for local development
**Keep**: ✅ Local only - Never commit (already in .gitignore)

### .env.database
**Purpose**: Database-specific environment variables
**Content**: PostgreSQL, Neo4j, Redis connection strings
**Keep**: ⚠️ Consider consolidating into .env.example

## Git Configuration

### .gitignore
**Purpose**: Files to exclude from version control
**Content**: node_modules, .env, build artifacts, IDE files
**Keep**: ✅ **REQUIRED** - Prevents committing sensitive/generated files

## Summary

| File | Status | Recommendation |
|------|--------|----------------|
| README.md | ✅ Keep | Essential documentation |
| CLAUDE.md | ✅ Keep | Essential for AI assistants |
| CODEMIND.md | ✅ Keep | Product overview |
| PROMOTION.md | ✅ Keep | Marketing content |
| CHANGELOG.md | ✅ Keep | Version history (required for npm) |
| CONTRIBUTING.md | ✅ Keep | Contributor guidelines |
| SECURITY.md | ✅ Keep | Security policy |
| LICENSE | ✅ **KEEP** | **REQUIRED** (legal requirement) |
| TODO | ⚠️ Review | Consider GitHub Issues instead |
| TESTING_GUIDE.md | ✅ Keep | Helpful for contributors |
| package.json | ✅ **KEEP** | **REQUIRED** (npm package) |
| package-lock.json | ✅ **KEEP** | **REQUIRED** (reproducible builds) |
| tsconfig.json | ✅ **KEEP** | **REQUIRED** (TypeScript) |
| tsconfig.core.json | ✅ Keep | Recommended for stricter core |
| jest.config.js | ✅ **KEEP** | **REQUIRED** (testing) |
| eslint.config.mjs | ✅ **KEEP** | **REQUIRED** (linting) |
| .prettierrc | ✅ **KEEP** | **REQUIRED** (formatting) |
| Dockerfile | ✅ Keep | Essential for containers |
| docker-compose.yml | ✅ Keep | Essential for local dev |
| .dockerignore | ✅ Keep | Docker optimization |
| .env.example | ✅ Keep | Configuration template |
| .env | ✅ Local only | Local development (gitignored) |
| .env.database | ⚠️ Review | Consider consolidating |
| .gitignore | ✅ **KEEP** | **REQUIRED** (version control) |

## Recommendations

### Files to Keep As-Is
All files marked with ✅ should remain at the root level. They serve essential purposes and follow standard conventions.

### Potential Consolidation
- **.env.database**: Consider merging into .env.example with clear section headers
- **TODO**: Consider migrating to GitHub Issues for better tracking and visibility

### All Files Are Needed
After review, **all root-level files serve legitimate purposes**. The project structure follows industry standards for a TypeScript npm package with Docker deployment.

## Reference Resources

- **npm package.json**: https://docs.npmjs.com/cli/v10/configuring-npm/package-json
- **TypeScript tsconfig**: https://www.typescriptlang.org/tsconfig
- **Docker best practices**: https://docs.docker.com/develop/dev-best-practices/
- **Open source file standards**: https://opensource.guide/
