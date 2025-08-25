# CLAUDE.md - CodeMind

This file provides guidance to Claude Code when working with this project.

## Project Overview

**Project**: CodeMind - Intelligent Code Auxiliary System
**Type**: api_service with AI orchestration
**Languages**: JavaScript, TypeScript, Python
**Architecture**: Layered Architecture with Multi-Role AI Orchestration
**Testing**: Unit + Integration + End-to-End Testing
**Intent**: Computational backend for coding LLMs that provides code analysis, pattern detection, knowledge management, and automated development orchestration
**Business Value**: Provide reliable API services to clients with intelligent development workflow automation

### Core Capabilities
- **Semantic Knowledge Graph**: Triad-based (Subject-Predicate-Object) code relationship analysis
- **Multi-Role AI Orchestration**: 19 specialized AI roles coordinating development workflows
- **Quality Gates & Scoring**: Automated quality assessment across security, performance, architecture
- **Parallel Workflow Execution**: Concurrent processing with intelligent resource management
- **Branch-Based Development**: Automated git workflow with merge strategies

## CodeMind Integration

Use token-efficient API: http://localhost:3004
Project path: .

### Quick Commands

Get project context:
```powershell
Invoke-WebRequest -Uri "http://localhost:3004/claude/context/CodeMind?intent=coding"
```

Get smart questions:
```powershell
Invoke-WebRequest -Uri "http://localhost:3004/claude/suggest-questions/CodeMind"
```

**Setup completed**: 2025-08-24 20:03
**Integration**: Claude Code Enhanced Setup

## Development Orchestration System

### Multi-Role AI Workflow
The system orchestrates 19 specialized AI roles through sophisticated DAG-based workflows:

**Core Roles:**
- 🎭 Orchestrator (workflow coordination)
- 📋 Work Classifier (requirement categorization)
- 📝 Requirement Analyst (specification breakdown)
- 🧪 Test Designer (TDD approach)
- 💻 Implementation Developer (code implementation)
- 🔍 Code Reviewer (quality assurance)
- 🔒 Security Auditor (vulnerability assessment)
- ⚡ Performance Auditor (optimization analysis)
- ⭐ Quality Auditor (architecture compliance)
- 📚 Technical Documenter (API documentation)
- 🏷️ Release Manager (version coordination)

### Workflow Types
1. **Feature Development**: Complete TDD workflow with parallel quality gates
2. **Defect Resolution**: Streamlined bug fix process with rapid deployment
3. **Tech Debt Reduction**: Systematic refactoring with quality tracking
4. **Hotfix Workflow**: Critical issue resolution with minimal overhead

### Quality Gates & Metrics
- **Security Score**: ≥90% (zero critical vulnerabilities)
- **Code Coverage**: ≥85% with comprehensive test suites
- **SOLID Compliance**: ≥90% adherence to principles
- **Performance**: ≤2s response time, ≤80% memory usage
- **Architecture**: Complexity metrics and dependency analysis

### Usage Examples

```powershell
# Start feature development workflow
npx codemind orchestrate start-workflow --type feature --item FEAT-001

# Monitor workflow progress
npx codemind orchestrate status --execution-id <execution-id>

# View role utilization
npx codemind orchestrate roles --utilization

# Generate workflow visualization
npx codemind orchestrate visualize --workflow feature-development-v1

# Semantic knowledge graph operations
npx codemind knowledge analyze --project ./src
npx codemind knowledge query "FIND nodes WHERE type=CLASS"
npx codemind knowledge path "User" "Order" --max-depth 3
```

## Implementation Phases

### Phase 3: Advanced Intelligence (Implemented)
- ✅ Semantic knowledge graph with triads
- ✅ Multi-role AI orchestration system
- ✅ Quality gates and scoring framework
- ✅ Parallel workflow execution
- ✅ Branch-based development strategies

### Phase 4: Production Ready (Next)
- 🔄 Full deployment automation
- 🔄 Advanced monitoring and alerting
- 🔄 Machine learning workflow optimization
- 🔄 Integration with external tools (Jira, Slack)
- 🔄 Visual workflow designer

### Phase 5: Future Enhancements
- 🔮 Predictive quality scoring
- 🔮 Self-healing workflows
- 🔮 Distributed multi-environment execution
- 🔮 Advanced conflict resolution
