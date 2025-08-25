# CLAUDE.md - CodeMind

This file provides guidance to Claude Code when working with this project.

## Project Overview

**Project**: CodeMind
**Type**: api_service
**Languages**: JavaScript, TypeScript, Python
**Architecture**: Layered Architecture
**Testing**: Unit + Integration Testing
**Intent**: Computational backend for coding LLMs that provides code analysis, pattern detection, and knowledge management
**Business Value**: Provide reliable API services to clients

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
