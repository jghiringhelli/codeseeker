# Contributing to CodeSeeker

Thank you for your interest in contributing to CodeSeeker! This document provides guidelines and information for contributors.

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- Docker and Docker Compose (for database services)
- Git

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/jghiringhelli/codeseeker.git
   cd codeseeker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your local configuration
   ```

4. **Start infrastructure services**
   ```bash
   docker-compose up -d
   ```

5. **Build the project**
   ```bash
   npm run build
   ```

6. **Link for local development**
   ```bash
   npm link
   ```

## Development Workflow

### Running Tests

```bash
# Run all tests
npm test

# Run unit and integration tests (recommended - faster)
npx jest tests/core tests/cli tests/storage tests/scripts --testTimeout=60000 --forceExit

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Categories and Known Issues

CodeSeeker has different test categories with specific requirements:

| Category | Location | Requirements | Notes |
|----------|----------|--------------|-------|
| **Unit Tests** | `tests/core/`, `tests/cli/`, `tests/storage/`, `tests/scripts/` | None | Always run, ~225 tests |
| **Integration Tests** | `tests/integration/` | Optional Neo4j/PostgreSQL | Neo4j warnings are expected without server |
| **E2E Tests** | `tests/integration/e2e/` | Full environment | May fail on Windows due to process handling |
| **MCP Server Tests** | `tests/mcp/` | None | Tests MCP tool implementations |

#### Known Test Behaviors

1. **Neo4j Connection Warnings**: Expected when Neo4j is not running:
   ```
   Cannot log after tests are done... "Failed to connect to Neo4j database"
   ```
   These are informational - tests still pass using embedded storage fallback.

2. **E2E Test Timeouts on Windows**: The E2E tests spawn CLI processes which may fail with exit code `3221225794` (STATUS_DLL_INIT_FAILED) on Windows. This is a Windows-specific process spawning issue, not a code problem.

3. **Open Handle Warnings**: Jest may report open handles from:
   - `MiniSearchTextStore.startFlushTimer` - Background flush timers
   - `GraphologyGraphStore.startFlushTimer` - Graph persistence timers
   - `SQLiteVectorStore.startFlushTimer` - Vector store flush timers

   These are cleaned up properly in production but may show warnings during test teardown. Use `--forceExit` flag when running tests.

#### Recommended Test Commands

```bash
# Quick sanity check (unit tests only)
npx jest tests/storage/storage-abstraction.test.ts --testTimeout=30000

# Full unit test suite (recommended for CI)
npx jest tests/core tests/cli tests/storage tests/scripts --testTimeout=60000 --forceExit

# All tests including integration (requires Docker services)
npm test -- --forceExit
```

### Code Quality

```bash
# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type check
npm run typecheck
```

### Building

```bash
# Build the project
npm run build

# Start development mode
npm run dev
```

## Code Standards

### Architecture

CodeSeeker follows SOLID principles and a layered architecture:

- **CLI Layer**: Command handlers and user interaction
- **Service Layer**: Business logic and orchestration
- **Shared Layer**: Cross-cutting concerns and utilities

### Naming Conventions

- **Files**: Use kebab-case (`user-service.ts`)
- **Classes**: Use PascalCase (`UserService`)
- **Functions/Variables**: Use camelCase (`getUserById`)
- **Constants**: Use UPPER_SNAKE_CASE (`MAX_RETRIES`)

### Code Style

- Use TypeScript strict mode
- Prefer `const` over `let`
- Use explicit return types for functions
- Handle errors appropriately
- Add JSDoc comments for public APIs

## Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the code standards above
   - Add tests for new functionality
   - Update documentation as needed

3. **Run quality checks**
   ```bash
   npm run build
   npm test
   npm run lint
   ```

4. **Commit your changes**
   - Use clear, descriptive commit messages
   - Reference issues when applicable

5. **Push and create a PR**
   - Provide a clear description of changes
   - Link related issues
   - Request review from maintainers

## Reporting Issues

When reporting issues, please include:

- CodeSeeker version (`codeseeker --version`)
- Node.js version (`node --version`)
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs or error messages

## Feature Requests

Feature requests are welcome! Please:

- Check existing issues first
- Describe the use case clearly
- Explain why the feature would be valuable

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
- Focus on the code, not the person

## Questions?

If you have questions, feel free to:

- Open a GitHub issue
- Check the documentation in [CLAUDE.md](CLAUDE.md)

Thank you for contributing!
