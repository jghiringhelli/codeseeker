# CodeMind Claude Integration Setup Script
# This script helps Claude Code integrate with the CodeMind system

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectPath,
    
    [Parameter(Mandatory=$false)]
    [string]$ProjectName = "",
    
    [Parameter(Mandatory=$false)]
    [string]$Description = "",
    
    [Parameter(Mandatory=$false)]
    [string[]]$Languages = @(),
    
    [Parameter(Mandatory=$false)]
    [string[]]$Frameworks = @(),
    
    [Parameter(Mandatory=$false)]
    [string]$ProjectType = "unknown"
)

Write-Host "🚀 Setting up CodeMind integration for project: $ProjectPath" -ForegroundColor Green

# 1. Initialize the project with enhanced context
Write-Host "📊 Initializing project analysis..." -ForegroundColor Yellow

$initBody = @{
    projectPath = $ProjectPath
    mode = "auto"
    batchSize = 50
    metadata = @{
        projectName = $ProjectName
        description = $Description
        languages = $Languages
        frameworks = $Frameworks
        projectType = $ProjectType
        setupDate = (Get-Date).ToString("yyyy-MM-dd")
        claudeIntegration = $true
    }
} | ConvertTo-Json -Depth 3

try {
    $initResponse = Invoke-WebRequest -Uri "http://localhost:3004/init" -Method POST -ContentType "application/json" -Body $initBody
    $initData = ($initResponse.Content | ConvertFrom-Json)
    
    if ($initData.success) {
        Write-Host "✅ Project initialized successfully" -ForegroundColor Green
        Write-Host "   Resume Token: $($initData.data.resumeToken)" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Initialization failed: $($initData.error)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Failed to connect to CodeMind API at http://localhost:3004" -ForegroundColor Red
    Write-Host "   Make sure the system is running: docker-compose -f docker-compose.postgres.yml up -d" -ForegroundColor Yellow
    exit 1
}

# 2. Get project context to understand what we're working with
Write-Host "🔍 Analyzing project context..." -ForegroundColor Yellow

$contextResponse = Invoke-WebRequest -Uri "http://localhost:3004/claude/context/$ProjectPath?intent=overview"
$contextData = ($contextResponse.Content | ConvertFrom-Json).data

# 3. Get smart questions for the project
Write-Host "❓ Generating smart questions..." -ForegroundColor Yellow

$questionsResponse = Invoke-WebRequest -Uri "http://localhost:3004/claude/suggest-questions/$ProjectPath?maxQuestions=5"
$questionsData = ($questionsResponse.Content | ConvertFrom-Json).data

# 4. Update or create CLAUDE.md with project-specific guidance
Write-Host "📝 Updating CLAUDE.md with CodeMind integration..." -ForegroundColor Yellow

$claudeMdPath = Join-Path $PWD "CLAUDE.md"
$claudeMdContent = @"
# CLAUDE.md - $ProjectName

This file provides guidance to Claude Code when working with this project.

## Project Overview

**Project**: $ProjectName
**Type**: $ProjectType
**Description**: $Description
**Languages**: $($Languages -join ", ")
**Frameworks**: $($Frameworks -join ", ")

## CodeMind Integration

This project is integrated with the CodeMind Intelligent Code Auxiliary System for enhanced context and analysis.

### API Usage Patterns

**Environment Setup:**
```powershell
`$env:CODEMIND_API_URL = "http://localhost:3004"
`$env:PROJECT_PATH = "$ProjectPath"
```

### Token-Efficient Context Calls

#### Before Making Changes (Overview - ~200 tokens)
```powershell
Invoke-WebRequest -Uri "http://localhost:3004/claude/context/$ProjectPath?intent=overview"
```

#### When Coding (Development Context - ~500 tokens)
```powershell
Invoke-WebRequest -Uri "http://localhost:3004/claude/context/$ProjectPath?intent=coding&maxTokens=800"
```

#### For Architecture Decisions (Detailed - ~1000 tokens)
```powershell
Invoke-WebRequest -Uri "http://localhost:3004/claude/context/$ProjectPath?intent=architecture&maxTokens=1500"
```

#### When Debugging (Error Context - ~600 tokens)
```powershell
Invoke-WebRequest -Uri "http://localhost:3004/claude/context/$ProjectPath?intent=debugging&maxTokens=1000"
```

#### Get Smart Questions for User Interaction
```powershell
Invoke-WebRequest -Uri "http://localhost:3004/claude/suggest-questions/$ProjectPath?maxQuestions=3"
```

### Integration Workflow

1. **Start every coding session** with an overview call to understand current project state
2. **Before creating new features** get coding context to understand patterns and standards
3. **When stuck or debugging** use debugging context for error patterns and solutions
4. **For user interaction** get smart questions to gather requirements efficiently
5. **For architectural decisions** get detailed architectural context and recommendations

### Smart Questions Generated

Based on the current project analysis, consider asking the user:

$($questionsData.questions | ForEach-Object { "- $_" } | Out-String)

### Current Project Status

- **Initialization Status**: $($contextData.summary.initializationStatus)
- **Total Files**: $($contextData.summary.totalFiles)
- **Detected Patterns**: $($contextData.summary.keyPatterns.Count)

### Usage Notes

- All API calls are cached for 5 minutes for better performance
- Responses are optimized for token efficiency while maintaining context richness
- Use different intent parameters to get focused context for specific tasks
- The system learns and improves its recommendations based on project analysis

## Project-Specific Guidance

$(if ($Languages -contains "typescript" -or $Languages -contains "javascript") {
"### TypeScript/JavaScript Guidelines
- Follow existing code patterns detected in the project
- Use the coding context endpoint before creating new components
- Check architectural patterns for consistency with existing structure"
})

$(if ($Languages -contains "python") {
"### Python Guidelines  
- Follow PEP 8 standards unless project patterns indicate otherwise
- Use the coding context to understand existing module structure
- Check for existing testing patterns before adding new tests"
})

$(if ($Frameworks -contains "react" -or $Frameworks -contains "vue" -or $Frameworks -contains "angular") {
"### Frontend Framework Guidelines
- Maintain consistency with existing component patterns
- Use architectural context for state management decisions
- Follow existing styling and structure conventions"
})

## Setup Complete

CodeMind integration is now active for this project. Use the API calls above to get intelligent, token-efficient context for all your coding tasks.

**Last Updated**: $(Get-Date -Format "yyyy-MM-dd HH:mm")
**Integration Version**: Phase 1
"@

# Write the CLAUDE.md file
$claudeMdContent | Out-File -FilePath $claudeMdPath -Encoding UTF8

Write-Host "✅ CLAUDE.md updated with CodeMind integration" -ForegroundColor Green
Write-Host "📍 File created at: $claudeMdPath" -ForegroundColor Cyan

# 5. Test the integration
Write-Host "🧪 Testing integration..." -ForegroundColor Yellow

$testResponse = Invoke-WebRequest -Uri "http://localhost:3004/claude/context/$ProjectPath?intent=coding&maxTokens=500"
$testData = ($testResponse.Content | ConvertFrom-Json)

if ($testData.success) {
    Write-Host "✅ Integration test successful" -ForegroundColor Green
    Write-Host "   Response size: $($testResponse.Content.Length) characters" -ForegroundColor Cyan
} else {
    Write-Host "⚠️  Integration test failed: $($testData.error)" -ForegroundColor Yellow
}

# 6. Summary
Write-Host ""
Write-Host "🎉 CodeMind Integration Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Review the generated CLAUDE.md file" -ForegroundColor White
Write-Host "2. Start using the API calls in your Claude Code sessions" -ForegroundColor White
Write-Host "3. Use 'intent=overview' for quick context (200 tokens)" -ForegroundColor White
Write-Host "4. Use 'intent=coding' before development (500 tokens)" -ForegroundColor White
Write-Host "5. Use smart questions for user interaction" -ForegroundColor White
Write-Host ""
Write-Host "API Endpoint: http://localhost:3004" -ForegroundColor Cyan
Write-Host "Project: $ProjectPath" -ForegroundColor Cyan
Write-Host "Resume Token: $($initData.data.resumeToken)" -ForegroundColor Cyan