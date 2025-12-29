# CodeMind TODO - Migrate to GitHub Issues

**This file has been replaced with GitHub Issues for better tracking and collaboration.**

Please create issues at: https://github.com/anthropics/codemind/issues

Use the following issue templates:
- **Bug Report** - Report bugs and unexpected behavior
- **Feature Request** - Suggest new features or enhancements
- **Documentation** - Report documentation issues

---

## Tasks Previously Tracked Here

The tasks below have been documented and should be created as GitHub issues:

### Priority 1 - Post-MVP Features

**[Create Issue: Abstract CLI to Support Multiple AI Providers]**
- Abstract CLI interface to use Copilot and Gemini CLI in addition to Claude
- Component: CLI Interface
- Priority: High
- Labels: enhancement, multi-ai-support

**[Create Issue: Session Summaries Feature]**
- Implement summaries of past sessions for context retention
- Component: CLI Interface
- Priority: High
- Labels: enhancement, session-management

### Priority 2 - Future Enhancements

**[Create Issue: MCP Integration with Image Generators]**
- MCP server to connect to Stable Diffusion/image generator
- Component: MCP Server
- Priority: Medium
- Labels: enhancement, integration, mcp

**[Create Issue: Layer 2 Orchestrator]**
- Implement orchestration layer for multi-step workflows
- Component: Orchestrator
- Priority: Medium
- Labels: enhancement, architecture

**[Create Issue: Layer 3 Planner]**
- Implement planning layer for complex task breakdown
- Component: Planner
- Priority: Medium
- Labels: enhancement, architecture

**[Create Issue: Evaluate API and Dashboard Integration]**
- Check if binding API and dashboard makes sense
- Component: Other
- Priority: Low
- Labels: question, architecture

### Feature Backlog (from FEATURE_REMOVAL_RECORD.md)

The following features were removed during MVP development and could be reconsidered:

- Real-time file monitoring (file watchers) - **Partially implemented in VSCode extension**
- Neo4j integration for relationship graphs - **Implemented**
- MongoDB for complex metadata - Consider if needed
- Redis caching system - **Implemented**
- Multi-database orchestration - **Implemented**
- Performance monitoring and metrics
- Background processing architecture
- Complex notification systems
- Advanced search filtering
- Multi-language parsing support
- Real-time collaboration features
- Advanced analytics and reporting
- Plugin/extension system
- Custom workflow definitions
- Advanced security features
- Multi-project workspace support
- Integration with multiple AI providers
- Advanced testing frameworks
- Comprehensive logging system
- Health monitoring and alerting

---

## How to Create Issues from These Tasks

For each task above:

1. Go to https://github.com/anthropics/codemind/issues/new/choose
2. Select the appropriate template (usually "Feature Request")
3. Fill in the details from the task description
4. Add appropriate labels (enhancement, priority-high, etc.)
5. Reference this TODO.md file if needed

Once all tasks are migrated, this file can be deleted.
