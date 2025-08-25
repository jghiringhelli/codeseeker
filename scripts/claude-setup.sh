#!/bin/bash

# CodeMind Claude Integration Setup Script
# This script helps Claude Code integrate with the CodeMind system

# Default values
PROJECT_PATH=""
PROJECT_NAME=""
DESCRIPTION=""
LANGUAGES=""
FRAMEWORKS=""
PROJECT_TYPE="unknown"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -p|--project-path)
      PROJECT_PATH="$2"
      shift 2
      ;;
    -n|--project-name)
      PROJECT_NAME="$2"
      shift 2
      ;;
    -d|--description)
      DESCRIPTION="$2"
      shift 2
      ;;
    -l|--languages)
      LANGUAGES="$2"
      shift 2
      ;;
    -f|--frameworks)
      FRAMEWORKS="$2"
      shift 2
      ;;
    -t|--project-type)
      PROJECT_TYPE="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 -p PROJECT_PATH [-n PROJECT_NAME] [-d DESCRIPTION] [-l LANGUAGES] [-f FRAMEWORKS] [-t PROJECT_TYPE]"
      echo ""
      echo "Options:"
      echo "  -p, --project-path    Project path (required)"
      echo "  -n, --project-name    Project name"
      echo "  -d, --description     Project description"
      echo "  -l, --languages       Comma-separated languages (e.g., 'typescript,javascript')"
      echo "  -f, --frameworks      Comma-separated frameworks (e.g., 'react,express')"
      echo "  -t, --project-type    Project type (web_application, api_service, library, etc.)"
      echo "  -h, --help           Show this help message"
      exit 0
      ;;
    *)
      echo "Unknown option $1"
      exit 1
      ;;
  esac
done

# Check required parameters
if [ -z "$PROJECT_PATH" ]; then
    echo "❌ Error: Project path is required. Use -p or --project-path"
    echo "Usage: $0 -p PROJECT_PATH [-n PROJECT_NAME] [-d DESCRIPTION]"
    exit 1
fi

echo "🚀 Setting up CodeMind integration for project: $PROJECT_PATH"

# 1. Initialize the project with enhanced context
echo "📊 Initializing project analysis..."

# Convert comma-separated strings to JSON arrays
LANGUAGES_ARRAY=$(echo "[$LANGUAGES]" | sed 's/,/","/g' | sed 's/\[/["/' | sed 's/\]/"]/' | sed 's/\[\"\"\]/[]/')
FRAMEWORKS_ARRAY=$(echo "[$FRAMEWORKS]" | sed 's/,/","/g' | sed 's/\[/["/' | sed 's/\]/"]/' | sed 's/\[\"\"\]/[]/')

INIT_BODY=$(cat <<EOF
{
  "projectPath": "$PROJECT_PATH",
  "mode": "auto",
  "batchSize": 50,
  "metadata": {
    "projectName": "$PROJECT_NAME",
    "description": "$DESCRIPTION", 
    "languages": $LANGUAGES_ARRAY,
    "frameworks": $FRAMEWORKS_ARRAY,
    "projectType": "$PROJECT_TYPE",
    "setupDate": "$(date +%Y-%m-%d)",
    "claudeIntegration": true
  }
}
EOF
)

INIT_RESPONSE=$(curl -s -X POST http://localhost:3004/init \
  -H "Content-Type: application/json" \
  -d "$INIT_BODY")

if echo "$INIT_RESPONSE" | grep -q '"success":true'; then
    echo "✅ Project initialized successfully"
    RESUME_TOKEN=$(echo "$INIT_RESPONSE" | grep -o '"resumeToken":"[^"]*' | cut -d'"' -f4)
    echo "   Resume Token: $RESUME_TOKEN"
else
    echo "❌ Initialization failed:"
    echo "$INIT_RESPONSE"
    exit 1
fi

# 2. Get project context
echo "🔍 Analyzing project context..."
CONTEXT_RESPONSE=$(curl -s "http://localhost:3004/claude/context/$PROJECT_PATH?intent=overview")

# 3. Get smart questions
echo "❓ Generating smart questions..."
QUESTIONS_RESPONSE=$(curl -s "http://localhost:3004/claude/suggest-questions/$PROJECT_PATH?maxQuestions=5")
QUESTIONS=$(echo "$QUESTIONS_RESPONSE" | grep -o '"questions":\[[^]]*\]' | sed 's/"questions":\[//g' | sed 's/\]$//g' | sed 's/","/\n- /g' | sed 's/"//g' | sed 's/^/- /')

# 4. Create CLAUDE.md
echo "📝 Creating CLAUDE.md with CodeMind integration..."

cat > CLAUDE.md << EOF
# CLAUDE.md - $PROJECT_NAME

This file provides guidance to Claude Code when working with this project.

## Project Overview

**Project**: $PROJECT_NAME
**Type**: $PROJECT_TYPE  
**Description**: $DESCRIPTION
**Languages**: $LANGUAGES
**Frameworks**: $FRAMEWORKS

## CodeMind Integration

This project is integrated with the CodeMind Intelligent Code Auxiliary System for enhanced context and analysis.

### API Usage Patterns

**Environment Setup:**
\`\`\`bash
export CODEMIND_API_URL="http://localhost:3004"
export PROJECT_PATH="$PROJECT_PATH"
\`\`\`

### Token-Efficient Context Calls

#### Before Making Changes (Overview - ~200 tokens)
\`\`\`bash
curl "http://localhost:3004/claude/context/$PROJECT_PATH?intent=overview"
\`\`\`

#### When Coding (Development Context - ~500 tokens)
\`\`\`bash
curl "http://localhost:3004/claude/context/$PROJECT_PATH?intent=coding&maxTokens=800"
\`\`\`

#### For Architecture Decisions (Detailed - ~1000 tokens)
\`\`\`bash
curl "http://localhost:3004/claude/context/$PROJECT_PATH?intent=architecture&maxTokens=1500"
\`\`\`

#### When Debugging (Error Context - ~600 tokens)
\`\`\`bash
curl "http://localhost:3004/claude/context/$PROJECT_PATH?intent=debugging&maxTokens=1000"
\`\`\`

#### Get Smart Questions for User Interaction
\`\`\`bash
curl "http://localhost:3004/claude/suggest-questions/$PROJECT_PATH?maxQuestions=3"
\`\`\`

### Integration Workflow

1. **Start every coding session** with an overview call to understand current project state
2. **Before creating new features** get coding context to understand patterns and standards
3. **When stuck or debugging** use debugging context for error patterns and solutions
4. **For user interaction** get smart questions to gather requirements efficiently
5. **For architectural decisions** get detailed architectural context and recommendations

### Smart Questions Generated

Based on the current project analysis, consider asking the user:

$QUESTIONS

### Usage Notes

- All API calls are cached for 5 minutes for better performance
- Responses are optimized for token efficiency while maintaining context richness
- Use different intent parameters to get focused context for specific tasks
- The system learns and improves its recommendations based on project analysis

## Setup Complete

CodeMind integration is now active for this project. Use the API calls above to get intelligent, token-efficient context for all your coding tasks.

**Last Updated**: $(date +"%Y-%m-%d %H:%M")
**Integration Version**: Phase 1
EOF

echo "✅ CLAUDE.md created with CodeMind integration"

# 5. Test the integration
echo "🧪 Testing integration..."
TEST_RESPONSE=$(curl -s "http://localhost:3004/claude/context/$PROJECT_PATH?intent=coding&maxTokens=500")

if echo "$TEST_RESPONSE" | grep -q '"success":true'; then
    echo "✅ Integration test successful"
else
    echo "⚠️  Integration test failed"
fi

# 6. Summary
echo ""
echo "🎉 CodeMind Integration Complete!"
echo ""
echo "Next Steps:"
echo "1. Review the generated CLAUDE.md file"
echo "2. Start using the API calls in your Claude Code sessions"
echo "3. Use 'intent=overview' for quick context (200 tokens)"
echo "4. Use 'intent=coding' before development (500 tokens)"
echo "5. Use smart questions for user interaction"
echo ""
echo "API Endpoint: http://localhost:3004"
echo "Project: $PROJECT_PATH"
echo "Resume Token: $RESUME_TOKEN"