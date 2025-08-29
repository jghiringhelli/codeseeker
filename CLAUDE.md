# CLAUDE.md - CodeMind

This file provides comprehensive guidance to Claude Code when working with this project.

## Project Overview

**Project**: CodeMind
**Type**: api_service
**Description**: Smart Claude Code CLI with intelligent tool selection, token optimization, and real-time quality monitoring
**Languages**: JavaScript, TypeScript
**Architecture**: Layered Architecture
**Testing Strategy**: Unit + Integration Testing
**Coding Standards**: Strict (ESLint/Prettier with custom rules)
**Project Intent**: Smart Claude Code CLI with intelligent tool selection, token optimization, and real-time quality monitoring
**Business Value**: Provide reliable and scalable backend services
**Quality Requirements**: High Performance, High Reliability, Secure

## CodeMind Integration

This project uses the CodeMind Intelligent Code Auxiliary System for enhanced context and analysis.

### Token-Efficient API Usage

**Environment Setup:**
`powershell
$env:CODEMIND_API_URL = "http://localhost:3004"
$env:PROJECT_PATH = "C:\workspace\claude\CodeMind"
`

### Intelligent Context Patterns

#### Before Any Changes (Overview - ~200 tokens)
`powershell
Invoke-WebRequest -Uri "$env:CODEMIND_API_URL/claude/context/$env:PROJECT_PATH?intent=overview"
`

#### Before Coding (Development Context - ~500 tokens)
`powershell
Invoke-WebRequest -Uri "$env:CODEMIND_API_URL/claude/context/$env:PROJECT_PATH?intent=coding&maxTokens=800"
`

#### For Architecture Decisions (Detailed Analysis - ~1000 tokens)
`powershell
Invoke-WebRequest -Uri "$env:CODEMIND_API_URL/claude/context/$env:PROJECT_PATH?intent=architecture&maxTokens=1500"
`

#### When Debugging (Error Context - ~600 tokens)
`powershell
Invoke-WebRequest -Uri "$env:CODEMIND_API_URL/claude/context/$env:PROJECT_PATH?intent=debugging&maxTokens=1000"
`

#### For User Interaction (Smart Questions)
`powershell
Invoke-WebRequest -Uri "$env:CODEMIND_API_URL/claude/suggest-questions/$env:PROJECT_PATH?maxQuestions=3"
`

### Project-Specific Workflow

1. **Start every session** with overview context to understand current state
2. **Before creating features** get coding context for patterns and standards
3. **For architectural changes** use architecture context for design guidance
4. **When debugging** use error context for common issues and solutions
5. **For user requirements** use smart questions to gather focused information

### Smart Questions for User Interaction

When you need to gather requirements, consider asking:

- What specific coding patterns should I follow?
- How should I structure the test files?
- What quality metrics are most important?


## Development Guidelines

### Architecture Principles
- Follow Layered Architecture patterns consistently
- Use the coding context API before creating new components
- Validate architectural decisions with the architecture context endpoint

### Testing Approach
- Implement Unit + Integration Testing
- Use debugging context when tests fail
- Check existing test patterns before adding new ones

### Code Quality Standards
- Maintain Strict (ESLint/Prettier with custom rules)
- Use smart questions to clarify quality requirements
- Project Intent: Smart Claude Code CLI with intelligent tool selection, token optimization, and real-time quality monitoring
- Quality Focus: High Performance, High Reliability, Secure

### Integration Notes

- All CodeMind API calls are cached for 5 minutes
- Context responses are optimized for token efficiency
- Different intents provide focused information for specific tasks
- The system learns from your project patterns over time

**Setup completed**: 2025-08-27 12:37
**Integration**: Interactive Enhanced Setup v2.0 (PowerShell)
**Resume Token**: 
