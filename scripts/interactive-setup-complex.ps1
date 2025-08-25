# Enhanced Interactive CodeMind Setup Script
# Can use Claude Code or Claude API to help gather project requirements and setup context

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectPath,
    
    [Parameter(Mandatory=$false)]
    [string]$ClaudeApiKey = $env:ANTHROPIC_API_KEY,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipInteractive = $false,
    
    [Parameter(Mandatory=$false)]
    [switch]$UseClaudeCode = $false
)

# Configuration
$CODEMIND_API = "http://localhost:3004"
$CLAUDE_API = "https://api.anthropic.com/v1/messages"

# Colors for output
$colors = @{
    Info = "Cyan"
    Success = "Green" 
    Warning = "Yellow"
    Error = "Red"
    Question = "Magenta"
    Example = "Gray"
}

function Write-ColorOutput($Message, $Color = "White") {
    Write-Host $Message -ForegroundColor $colors[$Color]
}

function Get-ClaudeCodeEnhancement($question, $userAnswer, $context) {
    Write-ColorOutput "Copy the following prompt and paste it into Claude Code for enhanced analysis:" "Info"
    Write-Host ""
    Write-ColorOutput "═══════════════════ CLAUDE CODE PROMPT ═══════════════════" "Info"
    Write-Host ""
    Write-Host "You are helping set up a code analysis system. The user answered a question about their project."
    Write-Host ""
    Write-Host "Question: $question"
    Write-Host "User's Answer: $userAnswer"
    Write-Host "Project Context: $context"
    Write-Host ""
    Write-Host "Please enhance their answer with:"
    Write-Host "1. More specific technical details"
    Write-Host "2. Relevant best practices"
    Write-Host "3. Common patterns for this type of project"
    Write-Host "4. Potential challenges or considerations"
    Write-Host ""
    Write-Host "Keep the response concise (2-3 sentences max) and focused on actionable insights."
    Write-Host "Return only the enhanced answer, no preamble."
    Write-Host ""
    Write-ColorOutput "═══════════════════════════════════════════════════════════" "Info"
    Write-Host ""
    
    $enhancedAnswer = Read-Host "After getting Claude Code's response, paste it here (or press Enter to keep original)"
    
    if ([string]::IsNullOrWhiteSpace($enhancedAnswer)) {
        Write-ColorOutput "Keeping original answer" "Info"
        return $userAnswer
    } else {
        Write-ColorOutput "Using Claude Code's enhanced version" "Info"
        return $enhancedAnswer
    }
}

function Invoke-ClaudeAPI($prompt, $maxTokens = 500) {
    if (-not $ClaudeApiKey) {
        Write-ColorOutput "⚠️  No Claude API key provided. Using default responses." "Warning"
        return $null
    }

    $headers = @{
        "x-api-key" = $ClaudeApiKey
        "anthropic-version" = "2023-06-01"
        "content-type" = "application/json"
    }

    $body = @{
        model = "claude-3-haiku-20240307"
        max_tokens = $maxTokens
        messages = @(
            @{
                role = "user"
                content = $prompt
            }
        )
    } | ConvertTo-Json -Depth 5

    try {
        $response = Invoke-RestMethod -Uri $CLAUDE_API -Method POST -Headers $headers -Body $body
        return $response.content[0].text
    } catch {
        Write-ColorOutput "⚠️  Claude API call failed: $($_.Exception.Message)" "Warning"
        return $null
    }
}

function Get-UserChoice($prompt, $options, $examples = $null, $allowCustom = $true) {
    Write-ColorOutput "`n$prompt" "Question"
    
    for ($i = 0; $i -lt $options.Length; $i++) {
        Write-Host "  $($i + 1). $($options[$i])" -ForegroundColor White
    }
    
    if ($examples) {
        Write-ColorOutput "`nExamples:" "Example"
        foreach ($example in $examples) {
            Write-ColorOutput "  • $example" "Example"
        }
    }
    
    if ($allowCustom) {
        Write-ColorOutput "  Or type a custom answer" "Info"
    }
    
    do {
        $choice = Read-Host "`nYour choice (1-$($options.Length)$(if ($allowCustom) {' or custom'}))"
        
        if ([int]::TryParse($choice, [ref]$null) -and $choice -ge 1 -and $choice -le $options.Length) {
            return $options[$choice - 1]
        } elseif ($allowCustom -and $choice.Trim() -ne "") {
            return $choice.Trim()
        } else {
            Write-ColorOutput "Please enter a valid choice or custom answer." "Warning"
        }
    } while ($true)
}

function Get-EnhancedAnswer($question, $userAnswer, $context) {
    if ($UseClaudeCode) {
        return Get-ClaudeCodeEnhancement $question $userAnswer $context
    }
    
    if (-not $ClaudeApiKey) {
        return $userAnswer
    }

    $prompt = "You are helping set up a code analysis system. The user answered a question about their project.`n`n" +
              "Question: $question`n" +
              "User's Answer: $userAnswer`n" +
              "Project Context: $context`n`n" +
              "Please enhance their answer with:`n" +
              "1. More specific technical details`n" +
              "2. Relevant best practices`n" +
              "3. Common patterns for this type of project`n" +
              "4. Potential challenges or considerations`n`n" +
              "Keep the response concise (2-3 sentences max) and focused on actionable insights.`n" +
              "Return only the enhanced answer, no preamble."

    $enhanced = Invoke-ClaudeAPI $prompt 300
    if ($enhanced) {
        Write-ColorOutput "`nClaude's enhanced insight:" "Info"
        Write-ColorOutput "$enhanced" "Example"
        
        $useEnhanced = Get-UserChoice "Use Claude's enhanced version?" @("Yes, use enhanced", "No, keep original", "Let me modify it") $null $false
        
        switch ($useEnhanced) {
            "Yes, use enhanced" { return $enhanced }
            "Let me modify it" { 
                Write-ColorOutput "Enter your modified version:" "Question"
                return Read-Host
            }
            default { return $userAnswer }
        }
    }
    
    return $userAnswer
}

# Main setup flow
# Choose enhancement method if not specified via parameter
if (-not $UseClaudeCode -and -not $PSBoundParameters.ContainsKey('UseClaudeCode')) {
    Write-ColorOutput "Choose how to enhance project analysis:" "Info"
    Write-Host "1. Use Claude Code (recommended for interactive enhancement)"
    Write-Host "2. Use Claude API (automatic enhancement with API key)" 
    Write-Host "3. No enhancement (basic setup only)"
    Write-Host ""
    
    do {
        $choice = Read-Host "Your choice (1-3)"
        switch ($choice) {
            "1" { 
                $UseClaudeCode = $true
                Write-ColorOutput "Will use Claude Code for interactive enhancement" "Success"
                Write-ColorOutput "   You'll receive prompts to copy/paste to Claude Code during setup" "Info"
                break
            }
            "2" { 
                if (-not $ClaudeApiKey) {
                    Write-ColorOutput "ANTHROPIC_API_KEY not set. Please set your Claude API key:" "Warning"
                    Write-ColorOutput "   `$env:ANTHROPIC_API_KEY = 'your-api-key-here'" "Warning"
                    $continue = Read-Host "Continue without API enhancement? (y/N)"
                    if ($continue -notmatch '^[Yy]$') {
                        exit 1
                    }
                } else {
                    Write-ColorOutput "Will use Claude API for automatic enhancement" "Success"
                }
                break
            }
            "3" { 
                Write-ColorOutput "Basic setup mode selected" "Success"
                break
            }
            default { 
                Write-ColorOutput "Invalid choice. Please select 1-3." "Warning"
                continue
            }
        }
        break
    } while ($true)
    
    Write-Host ""
}

Write-ColorOutput "🚀 CodeMind Interactive Setup" "Success"
Write-ColorOutput "Setting up intelligent analysis for: $ProjectPath" "Info"
Write-ColorOutput "=" * 50 "Info"

# Check if CodeMind API is running
try {
    $healthCheck = Invoke-RestMethod -Uri "$CODEMIND_API/health" -TimeoutSec 5
    if (-not $healthCheck.success) {
        throw "API not healthy"
    }
    Write-ColorOutput "✅ CodeMind API is running" "Success"
} catch {
    Write-ColorOutput "❌ CodeMind API not available at $CODEMIND_API" "Error"
    Write-ColorOutput "   Start it with: docker-compose -f docker-compose.postgres.yml up -d" "Warning"
    exit 1
}

# Initialize project data
$projectData = @{
    projectPath = $ProjectPath
    projectName = ""
    description = ""
    projectType = "unknown"
    languages = @()
    frameworks = @()
    architecturePattern = ""
    testingStrategy = ""
    codingStandards = ""
    primaryGoals = @()
    targetAudience = ""
    deploymentModel = ""
    qualityFocus = @()
}

if (-not $SkipInteractive) {
    Write-ColorOutput "`n📋 Let's gather information about your project..." "Info"

    # Project Name
    $defaultName = (Split-Path $ProjectPath -Leaf) -replace '[^a-zA-Z0-9\s]', ' '
    $projectData.projectName = Read-Host "Project name (default: $defaultName)"
    if (-not $projectData.projectName) { $projectData.projectName = $defaultName }

    # Project Description  
    $projectData.description = Read-Host "Brief project description"

    # Project Type
    $projectTypes = @(
        "Web Application (Frontend + Backend)",
        "API Service (Backend only)", 
        "Library/Package (Reusable code)",
        "Mobile Application",
        "Desktop Application", 
        "CLI Tool",
        "Data Processing Pipeline",
        "Machine Learning Project"
    )
    
    $typeExamples = @(
        "React + Express e-commerce site",
        "REST API for mobile app backend",
        "NPM package for date utilities", 
        "Electron desktop app",
        "Python data analysis scripts"
    )
    
    $selectedType = Get-UserChoice "What type of project is this?" $projectTypes $typeExamples
    $projectData.projectType = switch ($selectedType) {
        { $_ -like "*Web Application*" } { "web_application" }
        { $_ -like "*API Service*" } { "api_service" }
        { $_ -like "*Library*" } { "library" }
        { $_ -like "*Mobile*" } { "mobile_app" }
        { $_ -like "*Desktop*" } { "desktop_app" }
        { $_ -like "*CLI*" } { "cli_tool" }
        default { "unknown" }
    }

    # Primary Languages
    $languageOptions = @(
        "TypeScript", "JavaScript", "Python", "Java", "C#", 
        "Go", "Rust", "PHP", "Ruby", "Swift", "Kotlin"
    )
    
    Write-ColorOutput "`nSelect primary languages (comma-separated numbers or names):" "Question"
    for ($i = 0; $i -lt $languageOptions.Length; $i++) {
        Write-Host "  $($i + 1). $($languageOptions[$i])" -ForegroundColor White
    }
    
    $langInput = Read-Host "Your choice"
    $projectData.languages = @()
    
    foreach ($item in $langInput.Split(',')) {
        $item = $item.Trim()
        if ([int]::TryParse($item, [ref]$null) -and $item -ge 1 -and $item -le $languageOptions.Length) {
            $projectData.languages += $languageOptions[$item - 1].ToLower()
        } elseif ($item -ne "") {
            $projectData.languages += $item.ToLower()
        }
    }

    # Architecture Pattern
    $archPatterns = @(
        "Model-View-Controller (MVC)",
        "Model-View-ViewModel (MVVM)", 
        "Component-Based Architecture",
        "Microservices",
        "Layered Architecture",
        "Event-Driven Architecture",
        "Hexagonal Architecture",
        "Not sure / Need recommendations"
    )
    
    $archExamples = @(
        "Express.js with separate routes/controllers/models",
        "React components with Redux state management",
        "Spring Boot microservices with Docker",
        "Clean architecture with dependency injection"
    )
    
    $selectedArch = Get-UserChoice "What architectural pattern do you follow?" $archPatterns $archExamples
    $context = "Project: $($projectData.projectName), Type: $selectedType, Languages: $($projectData.languages -join ', ')"
    $projectData.architecturePattern = Get-EnhancedAnswer "Architectural pattern" $selectedArch $context

    # Testing Strategy
    $testingStrategies = @(
        "Unit Testing Only",
        "Unit + Integration Testing", 
        "Unit + Integration + E2E Testing",
        "Test-Driven Development (TDD)",
        "Behavior-Driven Development (BDD)",
        "No formal testing yet",
        "Need testing recommendations"
    )
    
    $testExamples = @(
        "Jest for unit tests, Cypress for E2E",
        "PyTest with fixtures and mocking",
        "JUnit with Spring Test framework",
        "Mocha/Chai with Selenium"
    )
    
    $selectedTesting = Get-UserChoice "What's your testing approach?" $testingStrategies $testExamples
    $projectData.testingStrategy = Get-EnhancedAnswer "Testing strategy" $selectedTesting $context

    # Coding Standards
    $codingStandards = @(
        "Strict (ESLint/Prettier with custom rules)",
        "Standard (Default linter rules)",
        "Relaxed (Basic formatting only)",
        "Company/Team specific standards", 
        "Following industry best practices",
        "No formal standards yet",
        "Need standards recommendations"
    )
    
    $standardsExamples = @(
        "Airbnb ESLint config with Prettier",
        "Black + flake8 for Python formatting",
        "Google Java Style Guide",
        "Custom TSConfig with strict mode"
    )
    
    $selectedStandards = Get-UserChoice "What coding standards do you follow?" $codingStandards $standardsExamples
    $projectData.codingStandards = Get-EnhancedAnswer "Coding standards" $selectedStandards $context

    # Primary Goals
    Write-ColorOutput "`nWhat are your main goals for this project? (select multiple with comma-separated numbers)" "Question"
    $goalOptions = @(
        "Performance optimization",
        "Code maintainability", 
        "Developer productivity",
        "Security compliance",
        "Scalability planning",
        "Technical debt reduction",
        "Documentation improvement",
        "Testing coverage increase"
    )
    
    for ($i = 0; $i -lt $goalOptions.Length; $i++) {
        Write-Host "  $($i + 1). $($goalOptions[$i])" -ForegroundColor White
    }
    
    $goalsInput = Read-Host "Your choices"
    $projectData.primaryGoals = @()
    
    foreach ($item in $goalsInput.Split(',')) {
        $item = $item.Trim()
        if ([int]::TryParse($item, [ref]$null) -and $item -ge 1 -and $item -le $goalOptions.Length) {
            $projectData.primaryGoals += $goalOptions[$item - 1]
        }
    }

    Write-ColorOutput "`n🎯 Great! I have all the information needed." "Success"
}

# Generate Claude-enhanced project summary
if ($ClaudeApiKey) {
    Write-ColorOutput "`nHaving Claude analyze your project setup..." "Info"
    
    $analysisPrompt = "Based on this project information, provide a comprehensive analysis:`n`n" +
                      "Project: $($projectData.projectName)`n" +
                      "Type: $($projectData.projectType)`n" +
                      "Languages: $($projectData.languages -join ', ')`n" +
                      "Architecture: $($projectData.architecturePattern)`n" +
                      "Testing: $($projectData.testingStrategy)`n" +
                      "Standards: $($projectData.codingStandards)`n" +
                      "Goals: $($projectData.primaryGoals -join ', ')`n`n" +
                      "Please provide:`n" +
                      "1. Key architectural recommendations`n" +
                      "2. Suggested development workflow`n" +
                      "3. Potential challenges and solutions`n" +
                      "4. Best practices for this technology stack`n" +
                      "5. Quality metrics to track`n`n" +
                      "Format as concise bullet points for inclusion in CLAUDE.md."

    $analysis = Invoke-ClaudeAPI $analysisPrompt 800
    if ($analysis) {
        Write-ColorOutput "`nClaude's Project Analysis:" "Example"
        Write-ColorOutput $analysis "Example"
        $projectData.claudeAnalysis = $analysis
    }
}

# Initialize with CodeMind API
Write-ColorOutput "`n🚀 Initializing CodeMind with enhanced project data..." "Info"

$initBody = @{
    projectPath = $projectData.projectPath
    mode = "auto"
    batchSize = 50
    metadata = @{
        projectName = $projectData.projectName
        description = $projectData.description
        projectType = $projectData.projectType
        languages = $projectData.languages
        frameworks = $projectData.frameworks
        architecturePattern = $projectData.architecturePattern
        testingStrategy = $projectData.testingStrategy
        codingStandards = $projectData.codingStandards
        primaryGoals = $projectData.primaryGoals
        setupDate = (Get-Date).ToString("yyyy-MM-dd")
        claudeIntegration = $true
        interactiveSetup = $true
        claudeAnalysis = $projectData.claudeAnalysis
    }
} | ConvertTo-Json -Depth 5

try {
    $initResponse = Invoke-RestMethod -Uri "$CODEMIND_API/init" -Method POST -ContentType "application/json" -Body $initBody
    
    if ($initResponse.success) {
        Write-ColorOutput "✅ Project initialized successfully" "Success"
        Write-ColorOutput "   Resume Token: $($initResponse.data.resumeToken)" "Info"
    } else {
        throw $initResponse.error
    }
} catch {
    Write-ColorOutput "❌ Initialization failed: $_" "Error"
    exit 1
}

# Get smart questions based on the setup
Write-ColorOutput "`n❓ Generating contextual questions..." "Info"
try {
    $questionsResponse = Invoke-RestMethod -Uri "$CODEMIND_API/claude/suggest-questions/$($projectData.projectPath)?maxQuestions=8"
    $questions = $questionsResponse.data.questions
} catch {
    $questions = @("What specific coding patterns should I follow?", "How should I structure the test files?", "What quality metrics are most important?")
}

# Create enhanced CLAUDE.md
Write-ColorOutput "`nCreating enhanced CLAUDE.md..." "Info"

# Create CLAUDE.md content using Out-File to avoid here-string parsing issues
$claudeMdPath = Join-Path (Resolve-Path $ProjectPath) "CLAUDE.md"
# Build CLAUDE.md content with array to avoid here-string issues
$content = @()
$content += "# CLAUDE.md - $($projectData.projectName)"

This file provides comprehensive guidance to Claude Code when working with this project.

## Project Overview

**Project**: $($projectData.projectName)
**Type**: $($projectData.projectType)
**Description**: $($projectData.description)
**Languages**: $($projectData.languages -join ", ")
**Architecture**: $($projectData.architecturePattern)
**Testing Strategy**: $($projectData.testingStrategy)
**Coding Standards**: $($projectData.codingStandards)
**Primary Goals**: $($projectData.primaryGoals -join ", ")

## CodeMind Integration

This project uses the CodeMind Intelligent Code Auxiliary System for enhanced context and analysis.

### Token-Efficient API Usage

**Environment Setup:**
``````powershell
`$env:CODEMIND_API_URL = "$CODEMIND_API"
`$env:PROJECT_PATH = "$($projectData.projectPath)"
``````

### Intelligent Context Patterns

#### Before Any Changes (Overview - ~200 tokens)
``````powershell
Invoke-WebRequest -Uri "$CODEMIND_API/claude/context/$($projectData.projectPath)?intent=overview"
``````

#### Before Coding (Development Context - ~500 tokens)  
``````powershell
Invoke-WebRequest -Uri "$CODEMIND_API/claude/context/$($projectData.projectPath)?intent=coding&maxTokens=800"
``````

#### For Architecture Decisions (Detailed Analysis - ~1000 tokens)
``````powershell
Invoke-WebRequest -Uri "$CODEMIND_API/claude/context/$($projectData.projectPath)?intent=architecture&maxTokens=1500"
``````

#### When Debugging (Error Context - ~600 tokens)
``````powershell
Invoke-WebRequest -Uri "$CODEMIND_API/claude/context/$($projectData.projectPath)?intent=debugging&maxTokens=1000"
``````

#### For User Interaction (Smart Questions)
``````powershell
Invoke-WebRequest -Uri "$CODEMIND_API/claude/suggest-questions/$($projectData.projectPath)?maxQuestions=3"
``````

### Project-Specific Workflow

1. **Start every session** with overview context to understand current state
2. **Before creating features** get coding context for patterns and standards
3. **For architectural changes** use architecture context for design guidance
4. **When debugging** use error context for common issues and solutions
5. **For user requirements** use smart questions to gather focused information

### Smart Questions for User Interaction

When you need to gather requirements, consider asking:

$($questions | ForEach-Object { "- $_" } | Out-String)

$(if ($projectData.claudeAnalysis) {
@"
## Claude's Project Analysis

$($projectData.claudeAnalysis)
"@
})

## Development Guidelines

### Architecture Principles
- Follow $($projectData.architecturePattern) patterns consistently
- Use the coding context API before creating new components
- Validate architectural decisions with the architecture context endpoint

### Testing Approach  
- Implement $($projectData.testingStrategy)
- Use debugging context when tests fail
- Check existing test patterns before adding new ones

### Code Quality Standards
- Maintain $($projectData.codingStandards)
- Use smart questions to clarify quality requirements
- Focus on: $($projectData.primaryGoals -join ", ")

### Integration Notes

- All CodeMind API calls are cached for 5 minutes
- Context responses are optimized for token efficiency  
- Different intents provide focused information for specific tasks
- The system learns from your project patterns over time

**Setup completed**: $(Get-Date -Format "yyyy-MM-dd HH:mm")  
**Integration**: Interactive Enhanced Setup v2.0
**Resume Token**: $($initResponse.data.resumeToken)
"@

$claudeMdContent | Out-File -FilePath "CLAUDE.md" -Encoding UTF8

Write-ColorOutput "✅ Enhanced CLAUDE.md created with intelligent guidance" "Success"

# Final test
Write-ColorOutput "`n🧪 Testing enhanced integration..." "Info"
try {
    $testResponse = Invoke-RestMethod -Uri "$CODEMIND_API/claude/context/$($projectData.projectPath)?intent=coding&maxTokens=600"
    if ($testResponse.success) {
        Write-ColorOutput "✅ Integration test successful" "Success"
        Write-ColorOutput "   Context API working with enhanced project data" "Info"
    }
} catch {
    Write-ColorOutput "⚠️  Test failed but setup is complete" "Warning"
}

# Summary
Write-ColorOutput "`n" "Info"
Write-ColorOutput "🎉 Enhanced CodeMind Setup Complete!" "Success"
Write-ColorOutput "=" * 50 "Info"
Write-ColorOutput "✅ Interactive project analysis completed" "Success"
Write-ColorOutput "✅ Claude-enhanced insights integrated" "Success" 
Write-ColorOutput "✅ Smart questions generated for your project type" "Success"
Write-ColorOutput "✅ Token-efficient API patterns configured" "Success"
Write-ColorOutput "✅ Project-specific CLAUDE.md created" "Success"
Write-ColorOutput "`nYour CodeMind integration is now optimized for:" "Info"
Write-ColorOutput "• $($projectData.architecturePattern)" "Info"
Write-ColorOutput "• $($projectData.testingStrategy)" "Info"
Write-ColorOutput "• $($projectData.codingStandards)" "Info"
Write-ColorOutput "• Goals: $($projectData.primaryGoals -join ', ')" "Info"
Write-ColorOutput "`nNext: Use the API patterns in CLAUDE.md for intelligent, token-efficient development!" "Success"