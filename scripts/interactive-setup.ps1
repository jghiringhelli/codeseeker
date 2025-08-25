# Simplified Interactive CodeMind Setup Script for PowerShell
# Fixed version with proper syntax

param(
    [Parameter(Mandatory=$true)]
    [Alias("p", "Path")]
    [string]$ProjectPath,
    
    [Parameter(Mandatory=$false)]
    [Alias("Key")]
    [string]$ClaudeApiKey = $env:ANTHROPIC_API_KEY,
    
    [Parameter(Mandatory=$false)]
    [Alias("Skip")]
    [switch]$SkipInteractive = $false,
    
    [Parameter(Mandatory=$false)]
    [Alias("Claude")]
    [switch]$UseClaudeCode = $false,
    
    [Parameter(Mandatory=$false)]
    [Alias("Auto", "Discover")]
    [switch]$AutoDiscovery = $false,
    
    [Parameter(Mandatory=$false)]
    [Alias("Override", "Force")]
    [switch]$UpdateExisting = $false
)

# Configuration
$CODEMIND_API = "http://localhost:3004"

# Colors for output
$colors = @{
    Info = "Cyan"
    Success = "Green" 
    Warning = "Yellow"
    Error = "Red"
    Question = "Magenta"
    Example = "Gray"
    White = "White"
}

function Write-ColorOutput($Message, $Color = "White") {
    $colorValue = $colors[$Color]
    if (-not $colorValue) {
        $colorValue = "White"
    }
    Write-Host $Message -ForegroundColor $colorValue
}

function Test-IsGreenfieldProject($projectPath) {
    # Check if project directory has minimal code files
    $codeExtensions = @("*.js", "*.ts", "*.py", "*.java", "*.cs", "*.go", "*.rs", "*.php", "*.rb", "*.cpp", "*.c", "*.h")
    $codeFiles = @()
    
    if (Test-Path $projectPath) {
        foreach ($ext in $codeExtensions) {
            $files = Get-ChildItem -Path $projectPath -Filter $ext -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Name -notlike "*.min.*" -and $_.Directory.Name -ne "node_modules" -and $_.Directory.Name -ne ".git" }
            $codeFiles += $files
        }
    }
    
    # Greenfield if less than 5 code files or project directory doesn't exist
    return ($codeFiles.Count -lt 5)
}

function Invoke-AutoDiscovery($projectPath) {
    if (-not (Test-Path $projectPath)) {
        Write-ColorOutput "Project path does not exist: $projectPath" "Error"
        return $null
    }
    
    Write-ColorOutput "Auto-discovering project configuration from codebase..." "Info"
    
    # Initialize discovered data
    $discoveredData = @{
        projectName = ""
        projectType = ""
        languages = ""
        architecturePattern = ""
        testingStrategy = ""
        codingStandards = ""
        projectIntent = ""
        businessValue = ""
        frameworks = ""
    }
    
    # Project name from directory
    $projectBasename = Split-Path -Leaf $projectPath
    if ($projectBasename -eq "." -or [string]::IsNullOrEmpty($projectBasename)) {
        $discoveredData.projectName = (Split-Path -Leaf (Get-Location)).Replace(" ", "")
    } else {
        $discoveredData.projectName = $projectBasename.Replace(" ", "")
    }
    
    # Detect languages
    $languages = @()
    if (Get-ChildItem -Path $projectPath -Filter "*.js" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Directory.Name -ne "node_modules" -and $_.Name -notlike "*.min.*" } | Select-Object -First 1) { $languages += "JavaScript" }
    if (Get-ChildItem -Path $projectPath -Filter "*.ts" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Directory.Name -ne "node_modules" -and $_.Name -notlike "*.min.*" } | Select-Object -First 1) { $languages += "TypeScript" }
    if (Get-ChildItem -Path $projectPath -Filter "*.py" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1) { $languages += "Python" }
    if (Get-ChildItem -Path $projectPath -Filter "*.java" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1) { $languages += "Java" }
    if (Get-ChildItem -Path $projectPath -Filter "*.cs" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1) { $languages += "C#" }
    if (Get-ChildItem -Path $projectPath -Filter "*.go" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1) { $languages += "Go" }
    
    $discoveredData.languages = $languages -join ", "
    
    # Detect project type and frameworks
    $packageJsonPath = Join-Path $projectPath "package.json"
    if (Test-Path $packageJsonPath) {
        $packageContent = Get-Content $packageJsonPath -Raw -ErrorAction SilentlyContinue
        
        if ($packageContent -match 'react|vue|angular|svelte') {
            $discoveredData.projectType = "web_application"
            $discoveredData.architecturePattern = "Component-Based Architecture"
            
            if ($packageContent -match 'react') { $discoveredData.frameworks = "React" }
            elseif ($packageContent -match 'vue') { $discoveredData.frameworks = "Vue.js" }
            elseif ($packageContent -match 'angular') { $discoveredData.frameworks = "Angular" }
        }
        elseif ($packageContent -match 'express|koa|fastify|hapi') {
            $discoveredData.projectType = "api_service"
            $discoveredData.architecturePattern = "Layered Architecture"
            $discoveredData.frameworks = "Express.js/Node.js"
        }
        elseif ($packageContent -match 'next') {
            $discoveredData.projectType = "web_application"
            $discoveredData.architecturePattern = "Full-Stack Framework"
            $discoveredData.frameworks = "Next.js"
        }
        else {
            $discoveredData.projectType = "library"
            $discoveredData.architecturePattern = "Modular Architecture"
        }
    }
    elseif ((Test-Path (Join-Path $projectPath "requirements.txt")) -or (Test-Path (Join-Path $projectPath "pyproject.toml"))) {
        $discoveredData.projectType = "api_service"
        $discoveredData.architecturePattern = "MVC Pattern"
    }
    else {
        $discoveredData.projectType = "other"
        $discoveredData.architecturePattern = "Custom Architecture"
    }
    
    # Detect testing strategy
    $testFiles = @()
    $testFiles += Get-ChildItem -Path $projectPath -Filter "*test*" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Directory.Name -ne "node_modules" }
    $testFiles += Get-ChildItem -Path $projectPath -Filter "*spec*" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.Directory.Name -ne "node_modules" }
    
    if ($testFiles.Count -gt 0) {
        if ((Test-Path $packageJsonPath) -and ((Get-Content $packageJsonPath -Raw -ErrorAction SilentlyContinue) -match 'jest.*cypress|playwright')) {
            $discoveredData.testingStrategy = "Unit + Integration + E2E Testing"
        }
        elseif ((Test-Path $packageJsonPath) -and ((Get-Content $packageJsonPath -Raw -ErrorAction SilentlyContinue) -match 'jest')) {
            $discoveredData.testingStrategy = "Unit + Integration Testing"
        }
        else {
            $discoveredData.testingStrategy = "Unit Testing Only"
        }
    }
    else {
        $discoveredData.testingStrategy = "No formal testing yet"
    }
    
    # Detect coding standards
    if ((Test-Path (Join-Path $projectPath ".eslintrc.js")) -or (Test-Path (Join-Path $projectPath ".eslintrc.json")) -or (Test-Path (Join-Path $projectPath ".prettierrc"))) {
        $discoveredData.codingStandards = "Strict (ESLint/Prettier with custom rules)"
    }
    elseif ((Test-Path $packageJsonPath) -and ((Get-Content $packageJsonPath -Raw -ErrorAction SilentlyContinue) -match 'eslint|prettier')) {
        $discoveredData.codingStandards = "Standard (Default linter rules)"
    }
    else {
        $discoveredData.codingStandards = "Relaxed (Basic formatting only)"
    }
    
    # Smart project intent detection
    $intentFound = $false
    $businessValue = ""
    
    # First try: Extract clean description from package.json
    if (Test-Path $packageJsonPath) {
        $packageContent = Get-Content $packageJsonPath -Raw -ErrorAction SilentlyContinue
        if ($packageContent -match '"description"\s*:\s*"([^"]+)"' -and $matches[1].Length -gt 10) {
            $discoveredData.projectIntent = $matches[1]
            $intentFound = $true
        }
    }
    
    # Second try: Extract from README with better parsing
    if (-not $intentFound) {
        $readmeFiles = @("README.md", "readme.md", "README.txt") | ForEach-Object { Join-Path $projectPath $_ } | Where-Object { Test-Path $_ }
        
        if ($readmeFiles.Count -gt 0) {
            # Get content and clean it up
            $readmeContent = Get-Content $readmeFiles[0] -TotalCount 30 -ErrorAction SilentlyContinue | 
                Where-Object { $_ -notmatch "^#" -and $_ -notmatch "^\[" -and $_ -notmatch "^!" -and $_.Trim() -ne "" -and $_ -notmatch "^-" -and $_ -notmatch "^\*" } | 
                Select-Object -First 3 | 
                Out-String
            
            # Clean markdown formatting and emojis
            $readmeContent = $readmeContent -replace '[*_`]', '' -replace '\[.*?\]', '' -replace 'emoji:[^:]*:', ''
            $readmeContent = $readmeContent.Trim()
            
            if ($readmeContent.Length -gt 20) {
                $discoveredData.projectIntent = $readmeContent.Substring(0, [Math]::Min(250, $readmeContent.Length)).Trim()
                $intentFound = $true
            }
        }
    }
    
    # Fallback: Generate based on project type and name
    if (-not $intentFound) {
        switch ($discoveredData.projectType) {
            "web_application" {
                $discoveredData.projectIntent = "A web application built with $($discoveredData.frameworks -or 'modern web technologies')"
                $businessValue = "Provide web-based functionality and user experience"
            }
            "api_service" {
                $discoveredData.projectIntent = "A $($discoveredData.frameworks -or 'REST API') service for backend functionality"
                $businessValue = "Provide reliable API endpoints and backend services"
            }
            "library" {
                $discoveredData.projectIntent = "A reusable $($discoveredData.languages) library for developers"
                $businessValue = "Enable code reuse and accelerate development across projects"
            }
            "cli_tool" {
                $discoveredData.projectIntent = "A command-line tool built with $($discoveredData.languages)"
                $businessValue = "Provide efficient command-line automation and utilities"
            }
            default {
                $discoveredData.projectIntent = "A $($discoveredData.languages) project for software development"
                $businessValue = "Support development and operational needs"
            }
        }
    }
    
    # Set business value based on project type if not already set
    if ([string]::IsNullOrEmpty($businessValue)) {
        $businessValue = switch ($discoveredData.projectType) {
            "web_application" { "Deliver quality web application experience to users" }
            "api_service" { "Provide reliable and scalable backend services" }
            "library" { "Enable code reuse and accelerate development workflows" }
            "cli_tool" { "Streamline command-line workflows and automation" }
            default { "Support business objectives through software solutions" }
        }
    }
    
    $discoveredData.businessValue = $businessValue
    
    # Display discovered configuration
    Write-ColorOutput "Auto-discovery completed! Found:" "Success"
    Write-ColorOutput "  Project: $($discoveredData.projectName)" "Info"
    Write-ColorOutput "  Type: $($discoveredData.projectType)" "Info"
    Write-ColorOutput "  Languages: $($discoveredData.languages)" "Info"
    Write-ColorOutput "  Architecture: $($discoveredData.architecturePattern)" "Info"
    Write-ColorOutput "  Testing: $($discoveredData.testingStrategy)" "Info"
    Write-ColorOutput "  Standards: $($discoveredData.codingStandards)" "Info"
    if ($discoveredData.frameworks) {
        Write-ColorOutput "  Frameworks: $($discoveredData.frameworks)" "Info"
    }
    Write-Host ""
    
    $confirm = Read-Host "Does this look correct? (Y/n)"
    if ($confirm -match "^[Nn]$") {
        Write-ColorOutput "Auto-discovery cancelled. Please run interactive setup instead." "Warning"
        return $null
    }
    
    return $discoveredData
}

function Get-UserChoice($prompt, $options) {
    Write-ColorOutput "`n$prompt" "Question"
    
    for ($i = 0; $i -lt $options.Length; $i++) {
        Write-Host "  $($i + 1). $($options[$i])" -ForegroundColor White
    }
    
    do {
        $maxChoice = $options.Length
        $choice = Read-Host "`nYour choice (1-$maxChoice or custom)"
        
        if ($choice -match '^\d+$' -and [int]$choice -ge 1 -and [int]$choice -le $options.Length) {
            return $options[[int]$choice - 1]
        } elseif (![string]::IsNullOrWhiteSpace($choice)) {
            return $choice
        } else {
            Write-ColorOutput "Please enter a valid choice or custom answer." "Warning"
        }
    } while ($true)
}

Write-ColorOutput "CodeMind Interactive Setup" "Success"
Write-ColorOutput "Setting up intelligent analysis for: $ProjectPath" "Info"
Write-ColorOutput "=" * 50 "Info"

# Check if CodeMind API is running
try {
    $healthCheck = Invoke-RestMethod -Uri "$CODEMIND_API/health" -TimeoutSec 5
    Write-ColorOutput "CodeMind API is running" "Success"
} catch {
    Write-ColorOutput "CodeMind API not available at $CODEMIND_API" "Error"
    Write-ColorOutput "Please start the system first: docker-compose -f docker-compose.postgres.yml up -d" "Info"
    exit 1
}

# Project data collection
$projectData = @{}

if ($AutoDiscovery) {
    # Use auto-discovery to populate project data
    $discoveredData = Invoke-AutoDiscovery $ProjectPath
    if ($discoveredData) {
        Write-ColorOutput "Using auto-discovered configuration..." "Info"
        
        # Map discovered data to project data structure
        $projectData.projectName = $discoveredData.projectName
        $projectData.projectPath = $ProjectPath
        $projectData.projectType = $discoveredData.projectType
        $projectData.languages = $discoveredData.languages -split ', '
        $projectData.architecturePattern = $discoveredData.architecturePattern
        $projectData.testingStrategy = $discoveredData.testingStrategy
        $projectData.businessValue = switch ($discoveredData.projectType) {
            "web_application" { "Deliver quality web application to users" }
            "api_service" { "Provide reliable API services to clients" }
            "library" { "Enable code reuse and accelerate development" }
            "cli_tool" { "Provide efficient command-line tool for users" }
            default { $discoveredData.businessValue }
        }
        $projectData.projectIntent = $discoveredData.projectIntent
        
        Write-ColorOutput "Auto-discovery completed successfully!" "Success"
    } else {
        Write-ColorOutput "Auto-discovery failed. Falling back to interactive mode..." "Error"
        $AutoDiscovery = $false
    }
}

if (-not $AutoDiscovery) {
    $projectData.projectName = (Split-Path -Leaf $ProjectPath)
    $projectData.projectPath = $ProjectPath

    # Project type
    $projectTypes = @(
        "web_application", "api_service", "library", "cli_tool", 
        "mobile_app", "desktop_app", "data_science", "other"
    )
    $projectData.projectType = Get-UserChoice "What type of project is this?" $projectTypes

    # Languages
    $languageOptions = @(
        "JavaScript", "TypeScript", "Python", "Java", "C#", 
        "Go", "Rust", "PHP", "Ruby", "Other"
    )
    $selectedLanguages = Get-UserChoice "What is the primary programming language?" $languageOptions
    $projectData.languages = @($selectedLanguages)

    # Architecture pattern
    $archPatterns = @(
        "Model-View-Controller (MVC)", "Component-Based Architecture", 
        "Microservices", "Layered Architecture", "Not sure"
    )
    $selectedArch = Get-UserChoice "What architectural pattern do you follow?" $archPatterns
    $projectData.architecturePattern = $selectedArch

    # Testing strategy
    $testingStrategies = @(
        "Unit Testing Only", "Unit + Integration Testing", 
        "Test-Driven Development (TDD)", "No formal testing yet"
    )
    $selectedTesting = Get-UserChoice "What's your testing approach?" $testingStrategies
    $projectData.testingStrategy = $selectedTesting

    # Project intent
    Write-ColorOutput "`nWhat is the main purpose of this project? (Project Intent)" "Question"
    $projectData.projectIntent = Read-Host "Project intent"

    # Business value
    Write-ColorOutput "`nWhy is this project important? (Business Value)" "Question"
    $projectData.businessValue = Read-Host "Business value"
}

# Initialize project with CodeMind
Write-ColorOutput "`nInitializing project with CodeMind..." "Info"

$initBody = @{
    projectPath = $ProjectPath
    mode = "auto"
    override = $UpdateExisting
    metadata = @{
        projectName = $projectData.projectName
        projectType = $projectData.projectType
        languages = $projectData.languages
        architecturePattern = $projectData.architecturePattern
        testingStrategy = $projectData.testingStrategy
        projectIntent = $projectData.projectIntent
        businessValue = $projectData.businessValue
    }
} | ConvertTo-Json -Depth 3

try {
    $initResponse = Invoke-RestMethod -Uri "$CODEMIND_API/init" -Method POST -ContentType "application/json" -Body $initBody
    Write-ColorOutput "Project initialized successfully" "Success"
    
    # Display final processed project data
    if ($UpdateExisting) {
        Write-ColorOutput "Project data updated in database" "Info"
    }
    
    # Show the processed data that was stored
    Write-ColorOutput "`nFinal Project Configuration Stored:" "Info"
    Write-ColorOutput "   • Project: $($projectData.projectName)" "Info"
    Write-ColorOutput "   • Type: $($projectData.projectType)" "Info"
    Write-ColorOutput "   • Languages: $($projectData.languages -join ', ')" "Info"
    Write-ColorOutput "   • Architecture: $($projectData.architecturePattern)" "Info"
    Write-ColorOutput "   • Testing: $($projectData.testingStrategy)" "Info"
    Write-ColorOutput "   • Intent: $($projectData.projectIntent)" "Info"
    Write-ColorOutput "   • Business Value: $($projectData.businessValue)" "Info"
    
} catch {
    Write-ColorOutput "Failed to initialize project: $($_.Exception.Message)" "Error"
    exit 1
}

# Create basic CLAUDE.md
Write-ColorOutput "`nCreating CLAUDE.md..." "Info"

$claudeMdContent = @(
    "# CLAUDE.md - $($projectData.projectName)",
    "",
    "This file provides guidance to Claude Code when working with this project.",
    "",
    "## Project Overview",
    "",
    "**Project**: $($projectData.projectName)",
    "**Type**: $($projectData.projectType)",
    "**Languages**: $($projectData.languages -join ', ')",
    "**Architecture**: $($projectData.architecturePattern)",
    "**Testing**: $($projectData.testingStrategy)",
    "**Intent**: $($projectData.projectIntent)",
    "**Business Value**: $($projectData.businessValue)",
    "",
    "## CodeMind Integration",
    "",
    "Use token-efficient API: $CODEMIND_API",
    "Project path: $ProjectPath",
    "",
    "### Quick Commands",
    "",
    "Get project context:",
    '```powershell',
    "Invoke-WebRequest -Uri `"$CODEMIND_API/claude/context/$($projectData.projectName)?intent=coding`"",
    '```',
    "",
    "Get smart questions:",
    '```powershell', 
    "Invoke-WebRequest -Uri `"$CODEMIND_API/claude/suggest-questions/$($projectData.projectName)`"",
    '```',
    "",
    "**Setup completed**: $(Get-Date -Format 'yyyy-MM-dd HH:mm')",
    "**Integration**: Claude Code Enhanced Setup"
) -join "`n"

$claudeMdPath = Join-Path (Resolve-Path $ProjectPath) "CLAUDE.md"
$claudeMdContent | Out-File -FilePath $claudeMdPath -Encoding UTF8

Write-ColorOutput "Enhanced CLAUDE.md created" "Success"

# Test integration
Write-ColorOutput "`nTesting integration..." "Info"
try {
    $testResponse = Invoke-RestMethod -Uri "$CODEMIND_API/claude/context/$($projectData.projectName)?intent=overview"
    Write-ColorOutput "Integration test successful" "Success"
} catch {
    Write-ColorOutput "Test failed but setup is complete" "Warning"
}

Write-ColorOutput "`nCodeMind Setup Complete!" "Success"
Write-ColorOutput "Enhanced project configuration created with Claude Code integration" "Info"