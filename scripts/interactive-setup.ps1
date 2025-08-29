# Enhanced Interactive CodeMind Three-Layer Setup Script for PowerShell
# Supports Smart CLI (Layer 1), Orchestrator (Layer 2), and Planner (Layer 3)

param(
    [Parameter(Mandatory=$false)]
    [Alias("p", "Path")]
    [string]$ProjectPath,
    
    [Parameter(Mandatory=$false)]
    [Alias("l", "Layers")]
    [string]$Layers = "all", # all, cli, orchestrator, planner, or comma-separated
    
    [Parameter(Mandatory=$false)]
    [Alias("s", "Skip")]
    [switch]$SkipInteractive,
    
    [Parameter(Mandatory=$false)]
    [Alias("a", "Auto", "Discover")]
    [switch]$AutoDiscovery,
    
    [Parameter(Mandatory=$false)]
    [Alias("u", "Update", "Override")]
    [switch]$UpdateExisting,
    
    [Parameter(Mandatory=$false)]
    [Alias("h", "Help")]
    [switch]$ShowHelp
)

# Configuration
$CODEMIND_API = "http://localhost:3004"
$CLAUDE_API = "https://api.anthropic.com/v1/messages"
$USE_CLAUDE_CODE = $false

# Colors for PowerShell output
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
            $files = Get-ChildItem -Path $projectPath -Filter $ext -Recurse -ErrorAction SilentlyContinue | 
                Where-Object { 
                    $_.Name -notlike "*.min.*" -and 
                    $_.Directory.Name -ne "node_modules" -and 
                    $_.Directory.Name -ne ".git" 
                }
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
        languages = @()
        architecturePattern = ""
        testingStrategy = ""
        codingStandards = ""
        projectIntent = ""
        businessValue = ""
        frameworks = @()
    }
    
    # Project name from directory
    $projectBasename = Split-Path -Leaf $projectPath
    if ($projectBasename -eq "." -or [string]::IsNullOrEmpty($projectBasename)) {
        $discoveredData.projectName = (Split-Path -Leaf (Get-Location)).Replace(" ", "")
    } else {
        $discoveredData.projectName = $projectBasename -replace '[^a-zA-Z0-9 ]', ' '
    }
    
    # Detect languages with better filtering
    $languages = @()
    $languageFiles = @{}
    
    # Count files for each language (excluding common non-source directories)
    $excludeDirs = @('node_modules', 'dist', 'build', '.git', 'vendor', 'packages', 'deps')
    
    # JavaScript
    $jsFiles = Get-ChildItem -Path $projectPath -Filter "*.js" -Recurse -ErrorAction SilentlyContinue | 
        Where-Object { 
            $exclude = $false
            foreach ($dir in $excludeDirs) {
                if ($_.FullName -match "\\$dir\\") { $exclude = $true; break }
            }
            -not $exclude -and $_.Name -notlike "*.min.*" -and $_.Name -notlike "*.bundle.*"
        }
    if ($jsFiles.Count -gt 2) { 
        $languages += "JavaScript"
        $languageFiles["JavaScript"] = $jsFiles.Count
    }
    
    # TypeScript
    $tsFiles = Get-ChildItem -Path $projectPath -Filter "*.ts" -Recurse -ErrorAction SilentlyContinue | 
        Where-Object { 
            $exclude = $false
            foreach ($dir in $excludeDirs) {
                if ($_.FullName -match "\\$dir\\") { $exclude = $true; break }
            }
            -not $exclude -and $_.Name -notlike "*.d.ts"
        }
    if ($tsFiles.Count -gt 2) { 
        $languages += "TypeScript"
        $languageFiles["TypeScript"] = $tsFiles.Count
    }
    
    # Python
    $pyFiles = Get-ChildItem -Path $projectPath -Filter "*.py" -Recurse -ErrorAction SilentlyContinue | 
        Where-Object { 
            $exclude = $false
            foreach ($dir in $excludeDirs) {
                if ($_.FullName -match "\\$dir\\") { $exclude = $true; break }
            }
            -not $exclude
        }
    if ($pyFiles.Count -gt 2) { 
        $languages += "Python"
        $languageFiles["Python"] = $pyFiles.Count
    }
    
    # Only check for other languages if we have significant files
    @(
        @{ext="*.java"; lang="Java"; minFiles=3},
        @{ext="*.cs"; lang="C#"; minFiles=3},
        @{ext="*.go"; lang="Go"; minFiles=2},
        @{ext="*.rs"; lang="Rust"; minFiles=2},
        @{ext="*.php"; lang="PHP"; minFiles=3},
        @{ext="*.rb"; lang="Ruby"; minFiles=2},
        @{ext="*.swift"; lang="Swift"; minFiles=2}
    ) | ForEach-Object {
        $files = Get-ChildItem -Path $projectPath -Filter $_.ext -Recurse -ErrorAction SilentlyContinue | 
            Where-Object { 
                $exclude = $false
                foreach ($dir in $excludeDirs) {
                    if ($_.FullName -match "\\$dir\\") { $exclude = $true; break }
                }
                -not $exclude
            }
        if ($files.Count -ge $_.minFiles) {
            $languages += $_.lang
            $languageFiles[$_.lang] = $files.Count
        }
    }
    
    # Determine primary languages (top 2-3 with most files)
    if ($languages.Count -gt 3) {
        $sortedLangs = $languageFiles.GetEnumerator() | Sort-Object -Property Value -Descending | Select-Object -First 3
        $languages = $sortedLangs | ForEach-Object { $_.Key }
    }
    
    $discoveredData.languages = $languages
    
    # Detect project type and frameworks
    $packageJsonPath = Join-Path $projectPath "package.json"
    if (Test-Path $packageJsonPath) {
        $packageContent = Get-Content $packageJsonPath -Raw -ErrorAction SilentlyContinue
        
        if ($packageContent -match 'react|vue|angular|svelte') {
            $discoveredData.projectType = "web_application"
            $discoveredData.architecturePattern = "Component-Based Architecture"
            
            if ($packageContent -match 'react') { 
                $discoveredData.frameworks += "React" 
            } elseif ($packageContent -match 'vue') { 
                $discoveredData.frameworks += "Vue.js" 
            } elseif ($packageContent -match 'angular') { 
                $discoveredData.frameworks += "Angular" 
            }
        }
        elseif ($packageContent -match 'express|koa|fastify|hapi') {
            $discoveredData.projectType = "api_service"
            $discoveredData.architecturePattern = "Layered Architecture"
            $discoveredData.frameworks += "Express.js/Node.js"
        }
        elseif ($packageContent -match 'next') {
            $discoveredData.projectType = "web_application"
            $discoveredData.architecturePattern = "Full-Stack Framework"
            $discoveredData.frameworks += "Next.js"
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
    elseif (Test-Path (Join-Path $projectPath "pom.xml")) {
        $discoveredData.projectType = "api_service"
        $discoveredData.architecturePattern = "Layered Architecture"
    }
    elseif (Test-Path (Join-Path $projectPath "Cargo.toml")) {
        $discoveredData.projectType = "cli_tool"
        $discoveredData.architecturePattern = "Modular Architecture"
    }
    elseif (Test-Path (Join-Path $projectPath "go.mod")) {
        $discoveredData.projectType = "api_service"
        $discoveredData.architecturePattern = "Clean Architecture"
    }
    else {
        $discoveredData.projectType = "other"
        $discoveredData.architecturePattern = "Custom Architecture"
    }
    
    # Detect testing strategy
    $testFiles = @()
    $testFiles += Get-ChildItem -Path $projectPath -Filter "*test*" -Recurse -ErrorAction SilentlyContinue | 
        Where-Object { $_.Directory.Name -ne "node_modules" }
    $testFiles += Get-ChildItem -Path $projectPath -Filter "*spec*" -Recurse -ErrorAction SilentlyContinue | 
        Where-Object { $_.Directory.Name -ne "node_modules" }
    
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
    if ((Test-Path (Join-Path $projectPath ".eslintrc.js")) -or 
        (Test-Path (Join-Path $projectPath ".eslintrc.json")) -or 
        (Test-Path (Join-Path $projectPath ".prettierrc"))) {
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
    
    # First try: Extract clean description from package.json
    if (Test-Path $packageJsonPath) {
        $packageContent = Get-Content $packageJsonPath -Raw -ErrorAction SilentlyContinue
        if ($packageContent -match '"description"\s*:\s*"([^"]+)"') {
            if ($matches[1].Length -gt 10) {
                $discoveredData.projectIntent = $matches[1]
                $intentFound = $true
            }
        }
    }
    
    # Second try: Extract from README with better parsing
    if (-not $intentFound) {
        $readmeFiles = @("README.md", "readme.md", "README.txt") | 
            ForEach-Object { Join-Path $projectPath $_ } | 
            Where-Object { Test-Path $_ }
        
        if ($readmeFiles.Count -gt 0) {
            # Get content and clean it up
            $readmeContent = Get-Content $readmeFiles[0] -TotalCount 30 -ErrorAction SilentlyContinue | 
                Where-Object { 
                    $_ -notmatch "^#" -and 
                    $_ -notmatch "^\[" -and 
                    $_ -notmatch "^!" -and 
                    $_.Trim() -ne "" -and 
                    $_ -notmatch "^-" -and 
                    $_ -notmatch "^\*" 
                } | 
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
        $businessValue = ""
        switch ($discoveredData.projectType) {
            "web_application" {
                $frameworkText = if ($discoveredData.frameworks -and $discoveredData.frameworks.Count -gt 0) { $discoveredData.frameworks -join ', ' } else { 'modern web technologies' }
                $discoveredData.projectIntent = "A web application built with $frameworkText"
                $businessValue = "Provide web-based functionality and user experience"
            }
            "api_service" {
                $frameworkText = if ($discoveredData.frameworks -and $discoveredData.frameworks.Count -gt 0) { $discoveredData.frameworks -join ', ' } else { 'REST API' }
                $discoveredData.projectIntent = "A $frameworkText service for backend functionality"
                $businessValue = "Provide reliable API endpoints and backend services"
            }
            "library" {
                $discoveredData.projectIntent = "A reusable $($discoveredData.languages -join ', ') library for developers"
                $businessValue = "Enable code reuse and accelerate development across projects"
            }
            "cli_tool" {
                $discoveredData.projectIntent = "A command-line tool built with $($discoveredData.languages -join ', ')"
                $businessValue = "Provide efficient command-line automation and utilities"
            }
            default {
                $discoveredData.projectIntent = "A $($discoveredData.languages -join ', ') project for software development"
                $businessValue = "Support development and operational needs"
            }
        }
        $discoveredData.businessValue = $businessValue
    }
    
    # Set business value based on project type if not already set
    if ([string]::IsNullOrEmpty($discoveredData.businessValue)) {
        $discoveredData.businessValue = switch ($discoveredData.projectType) {
            "web_application" { "Deliver quality web application experience to users" }
            "api_service" { "Provide reliable and scalable backend services" }
            "library" { "Enable code reuse and accelerate development workflows" }
            "cli_tool" { "Streamline command-line workflows and automation" }
            default { "Support business objectives through software solutions" }
        }
    }
    
    # Display discovered configuration
    Write-ColorOutput "`nAuto-discovery completed! Found:" "Success"
    Write-ColorOutput "=" * 50 "White"
    Write-ColorOutput "  Project: $($discoveredData.projectName)" "Info"
    Write-ColorOutput "  Path: $projectPath" "Info"
    Write-ColorOutput "  Type: $($discoveredData.projectType)" "Info"
    Write-ColorOutput "  Languages: $($discoveredData.languages -join ', ')" "Info"
    Write-ColorOutput "  Architecture: $($discoveredData.architecturePattern)" "Info"
    Write-ColorOutput "  Testing: $($discoveredData.testingStrategy)" "Info"
    Write-ColorOutput "  Standards: $($discoveredData.codingStandards)" "Info"
    if ($discoveredData.frameworks.Count -gt 0) {
        Write-ColorOutput "  Frameworks: $($discoveredData.frameworks -join ', ')" "Info"
    }
    Write-ColorOutput "`n  Intent: $($discoveredData.projectIntent)" "Question"
    Write-ColorOutput "  Value: $($discoveredData.businessValue)" "Question"
    Write-ColorOutput "=" * 50 "White"
    Write-Host ""
    
    $confirm = Read-Host "Does this look correct? (Y/n/e to edit)"
    
    if ($confirm -match "^[Ee]$") {
        # Allow editing discovered values
        Write-ColorOutput "`nLet's adjust the discovered values..." "Info"
        
        # Edit project name
        Write-ColorOutput "`nProject Name (current: $($discoveredData.projectName)):" "Question"
        $newName = Read-Host "Enter new name or press Enter to keep"
        if (![string]::IsNullOrWhiteSpace($newName)) {
            $discoveredData.projectName = $newName
        }
        
        # Edit project type
        Write-ColorOutput "`nProject Type (current: $($discoveredData.projectType)):" "Question"
        Write-Host "  1. web_application"
        Write-Host "  2. api_service"
        Write-Host "  3. library"
        Write-Host "  4. cli_tool"
        Write-Host "  5. other"
        $typeChoice = Read-Host "Choose 1-5 or press Enter to keep"
        if ($typeChoice -match '^[1-5]$') {
            $discoveredData.projectType = @('web_application', 'api_service', 'library', 'cli_tool', 'other')[[int]$typeChoice - 1]
        }
        
        # Edit languages
        Write-ColorOutput "`nLanguages (current: $($discoveredData.languages -join ', ')):" "Question"
        Write-ColorOutput "Enter comma-separated languages or press Enter to keep" "Info"
        $newLangs = Read-Host "Languages"
        if (![string]::IsNullOrWhiteSpace($newLangs)) {
            $discoveredData.languages = $newLangs.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
        }
        
        # Edit architecture
        Write-ColorOutput "`nArchitecture Pattern (current: $($discoveredData.architecturePattern)):" "Question"
        $newArch = Read-Host "Enter new pattern or press Enter to keep"
        if (![string]::IsNullOrWhiteSpace($newArch)) {
            $discoveredData.architecturePattern = $newArch
        }
        
        # Edit testing strategy
        Write-ColorOutput "`nTesting Strategy (current: $($discoveredData.testingStrategy)):" "Question"
        $newTest = Read-Host "Enter new strategy or press Enter to keep"
        if (![string]::IsNullOrWhiteSpace($newTest)) {
            $discoveredData.testingStrategy = $newTest
        }
        
        # Edit coding standards
        Write-ColorOutput "`nCoding Standards (current: $($discoveredData.codingStandards)):" "Question"
        $newStandards = Read-Host "Enter new standards or press Enter to keep"
        if (![string]::IsNullOrWhiteSpace($newStandards)) {
            $discoveredData.codingStandards = $newStandards
        }
        
        # Edit project intent
        Write-ColorOutput "`nProject Intent (current: $($discoveredData.projectIntent)):" "Question"
        Write-ColorOutput "This should describe what your project does" "Info"
        $newIntent = Read-Host "Enter new intent or press Enter to keep"
        if (![string]::IsNullOrWhiteSpace($newIntent)) {
            $discoveredData.projectIntent = $newIntent
        }
        
        # Edit business value
        Write-ColorOutput "`nBusiness Value (current: $($discoveredData.businessValue)):" "Question"
        Write-ColorOutput "This should describe why the project is important" "Info"
        $newValue = Read-Host "Enter new value or press Enter to keep"
        if (![string]::IsNullOrWhiteSpace($newValue)) {
            $discoveredData.businessValue = $newValue
        }
        
        # Show updated configuration
        Write-ColorOutput "`nUpdated configuration:" "Success"
        Write-ColorOutput "=" * 50 "White"
        Write-ColorOutput "  Project: $($discoveredData.projectName)" "Info"
        Write-ColorOutput "  Path: $projectPath" "Info"
        Write-ColorOutput "  Type: $($discoveredData.projectType)" "Info"
        Write-ColorOutput "  Languages: $($discoveredData.languages -join ', ')" "Info"
        Write-ColorOutput "  Architecture: $($discoveredData.architecturePattern)" "Info"
        Write-ColorOutput "  Testing: $($discoveredData.testingStrategy)" "Info"
        Write-ColorOutput "  Standards: $($discoveredData.codingStandards)" "Info"
        if ($discoveredData.frameworks.Count -gt 0) {
            Write-ColorOutput "  Frameworks: $($discoveredData.frameworks -join ', ')" "Info"
        }
        Write-ColorOutput "`n  Intent: $($discoveredData.projectIntent)" "Question"
        Write-ColorOutput "  Value: $($discoveredData.businessValue)" "Question"
        Write-ColorOutput "=" * 50 "White"
        
        Write-Host ""
        $finalConfirm = Read-Host "Use this configuration? (Y/n)"
        if ($finalConfirm -match "^[Nn]$") {
            Write-ColorOutput "Setup cancelled." "Warning"
            return $null
        }
    }
    elseif ($confirm -match "^[Nn]$") {
        Write-ColorOutput "Auto-discovery cancelled. Falling back to interactive setup." "Warning"
        return $null
    }
    
    return $discoveredData
}

function Get-UserChoice($prompt, $options) {
    Write-ColorOutput "`n$prompt" "Question"
    
    for ($i = 0; $i -lt $options.Length; $i++) {
        Write-Host "  $($i + 1). $($options[$i])" -ForegroundColor White
    }
    Write-ColorOutput "  Or type a custom answer" "Info"
    
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

function Get-EnhancedAnswer($question, $userAnswer, $context) {
    # For now, just return the user answer
    # Could be enhanced with Claude API integration later
    return $userAnswer
}

# Show help if requested
if ($ShowHelp) {
    Write-Host "Usage: .\interactive-setup.ps1 -p PROJECT_PATH [OPTIONS]"
    Write-Host ""
    Write-Host "CodeMind Three-Layer Architecture Setup:"
    Write-Host "  Layer 1: Smart CLI - Intelligent tool selection with database integration"
    Write-Host "  Layer 2: Orchestrator - Sequential role-based workflow coordination"  
    Write-Host "  Layer 3: Planner - AI-powered idea-to-implementation planning"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -p, -ProjectPath      Project path (required)"
    Write-Host "  -l, -Layers           Layers to initialize (all, cli, orchestrator, planner, or comma-separated)"
    Write-Host "  -s, -SkipInteractive  Skip interactive questions"
    Write-Host "  -a, -AutoDiscovery    Automatically analyze codebase and infer configuration"
    Write-Host "  -u, -UpdateExisting   Override existing project data in database"
    Write-Host "  -h, -ShowHelp         Show this help"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\interactive-setup.ps1 -p ./my-project                    # Setup all layers"
    Write-Host "  .\interactive-setup.ps1 -p ./my-project -l cli             # Setup Smart CLI only"
    Write-Host "  .\interactive-setup.ps1 -p ./my-project -l cli,orchestrator # Setup CLI and Orchestrator"
    Write-Host ""
    Write-Host "Environment variables:"
    Write-Host "  ANTHROPIC_API_KEY     Claude API key for enhanced analysis"
    exit 0
}

# Check if ProjectPath is provided when not showing help
if ([string]::IsNullOrWhiteSpace($ProjectPath)) {
    Write-ColorOutput "Error: ProjectPath is required" "Error"
    Write-Host "Usage: .\interactive-setup.ps1 -p PROJECT_PATH [OPTIONS]"
    Write-Host "Use -h for help"
    exit 1
}

# Resolve relative paths to absolute paths
if ($ProjectPath -eq "." -or $ProjectPath -eq ".\") {
    $ProjectPath = (Get-Location).Path
} elseif ($ProjectPath.StartsWith(".\") -or $ProjectPath.StartsWith("./")) {
    $ProjectPath = Join-Path (Get-Location).Path ($ProjectPath.Substring(2))
} elseif (-not [System.IO.Path]::IsPathRooted($ProjectPath)) {
    $ProjectPath = Join-Path (Get-Location).Path $ProjectPath
}

# Normalize path separators for consistency
$ProjectPath = $ProjectPath -replace '/', '\\'

# Parse enabled layers
$EnabledLayers = if ($Layers -eq "all") { 
    @("cli", "orchestrator", "planner") 
} else { 
    $Layers.Split(',') | ForEach-Object { $_.Trim().ToLower() } 
}

Write-ColorOutput "CodeMind Three-Layer Interactive Setup" "Success"
Write-ColorOutput "Setting up three-layer AI platform for: $ProjectPath" "Info"
Write-ColorOutput "Layers: $Layers" "Info"
Write-ColorOutput "======================================================" "Info"

# Check if CodeMind API is running
try {
    $healthCheck = Invoke-RestMethod -Uri "$CODEMIND_API/api/dashboard/health" -TimeoutSec 5
    if ($healthCheck.system_status -ne "healthy") {
        throw "API not healthy: $($healthCheck.system_status)"
    }
    Write-ColorOutput "CodeMind API is running" "Success"
} catch {
    Write-ColorOutput "CodeMind API not available at $CODEMIND_API" "Error"
    Write-ColorOutput "   Start it with: docker-compose -f docker-compose.postgres.yml up -d" "Warning"
    exit 1
}

# Initialize project data
$projectData = @{
    projectPath = $ProjectPath
    projectName = ""
    description = ""
    projectType = "unknown"
    architecturePattern = ""
    testingStrategy = ""
    codingStandards = ""
    projectIntent = ""
    businessValue = ""
}

$languages = @()
$frameworks = @()
$qualityRequirements = @()

if ($AutoDiscovery) {
    # Use auto-discovery to populate project data
    $discoveredData = Invoke-AutoDiscovery $ProjectPath
    if ($discoveredData) {
        Write-ColorOutput "Using auto-discovered configuration..." "Info"
        
        # Map discovered data to project data structure
        $projectData.projectName = $discoveredData.projectName
        $projectData.description = $discoveredData.projectIntent
        $projectData.projectType = $discoveredData.projectType
        $projectData.architecturePattern = $discoveredData.architecturePattern
        $projectData.testingStrategy = $discoveredData.testingStrategy
        $projectData.codingStandards = $discoveredData.codingStandards
        $projectData.projectIntent = $discoveredData.projectIntent
        $projectData.businessValue = $discoveredData.businessValue
        
        # Set languages and frameworks
        $languages = $discoveredData.languages
        $frameworks = $discoveredData.frameworks
        
        # Set quality requirements based on project type
        $qualityRequirements = switch ($discoveredData.projectType) {
            "web_application" { @("High Performance", "Good UX", "Scalable") }
            "api_service" { @("High Performance", "High Reliability", "Secure") }
            "library" { @("Well Documented", "Thoroughly Tested", "Reusable") }
            "cli_tool" { @("User Friendly", "Fast", "Cross Platform") }
            default { @("High Quality", "Maintainable", "Good Performance") }
        }
        
        Write-ColorOutput "Auto-discovery completed successfully!" "Success"
    } else {
        Write-ColorOutput "Auto-discovery failed. Falling back to interactive mode..." "Error"
        $AutoDiscovery = $false
    }
}

if (-not $SkipInteractive -and -not $AutoDiscovery) {
    Write-ColorOutput "`nLet's gather information about your project..." "Info"
    
    # Project Name
    $defaultName = (Split-Path -Leaf $ProjectPath) -replace '[^a-zA-Z0-9\s]', ' '
    $projectName = Read-Host "Project name (default: $defaultName)"
    $projectData.projectName = if ($projectName) { $projectName } else { $defaultName }
    
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
    
    $selectedType = Get-UserChoice "What type of project is this?" $projectTypes
    $projectData.projectType = switch ($selectedType) {
        { $_ -like "*Web Application*" } { "web_application" }
        { $_ -like "*API Service*" } { "api_service" }
        { $_ -like "*Library*" } { "library" }
        { $_ -like "*Mobile*" } { "mobile_app" }
        { $_ -like "*Desktop*" } { "desktop_app" }
        { $_ -like "*CLI*" } { "cli_tool" }
        default { "unknown" }
    }
    
    # Languages
    Write-ColorOutput "`nEnter primary languages (comma-separated):" "Question"
    Write-ColorOutput "  Examples: typescript,javascript  or  python,django  or  java,spring" "Example"
    $langInput = Read-Host "Languages"
    
    $languages = $langInput.Split(',') | ForEach-Object { $_.Trim().ToLower() } | Where-Object { $_ -ne "" }
    
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
    
    $context = "Project: $($projectData.projectName), Type: $selectedType, Languages: $($languages -join ', ')"
    $selectedArch = Get-UserChoice "What architectural pattern do you follow?" $archPatterns
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
    
    $selectedTesting = Get-UserChoice "What's your testing approach?" $testingStrategies
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
    
    $selectedStandards = Get-UserChoice "What coding standards do you follow?" $codingStandards
    $projectData.codingStandards = Get-EnhancedAnswer "Coding standards" $selectedStandards $context
    
    # Project Intent
    Write-ColorOutput "`nWhat is the main purpose of this project? (Project Intent)" "Question"
    Write-ColorOutput "Examples:" "Example"
    Write-ColorOutput "  Build a user authentication system with JWT tokens" "Example"
    Write-ColorOutput "  Create an e-commerce platform with payment processing" "Example"
    Write-ColorOutput "  Develop a real-time chat application for customer support" "Example"
    $projectData.projectIntent = Read-Host "Project intent"

    # Business Value
    Write-ColorOutput "`nWhy is this project important? (Business Value)" "Question"
    Write-ColorOutput "Examples:" "Example"
    Write-ColorOutput "  Enable secure user access and account management" "Example"
    Write-ColorOutput "  Allow customers to purchase products online" "Example"
    Write-ColorOutput "  Improve customer service response times and satisfaction" "Example"
    $projectData.businessValue = Read-Host "Business value"
    
    # Quality Requirements
    Write-ColorOutput "`nWhat quality standards must this project meet? (comma-separated numbers)" "Question"
    Write-Host "  1. High performance (fast response times)" -ForegroundColor White
    Write-Host "  2. High security (data protection, authentication)" -ForegroundColor White
    Write-Host "  3. High availability (minimal downtime)" -ForegroundColor White
    Write-Host "  4. Scalability (handle increasing load)" -ForegroundColor White
    Write-Host "  5. Maintainability (easy to modify and extend)" -ForegroundColor White
    Write-Host "  6. Usability (intuitive user experience)" -ForegroundColor White
    Write-Host "  7. Reliability (consistent error-free operation)" -ForegroundColor White
    Write-Host "  8. Accessibility (support for disabled users)" -ForegroundColor White
    
    $qualityInput = Read-Host "Your choices"
    $qualityOptions = @("High performance", "High security", "High availability", 
                       "Scalability", "Maintainability", "Usability",
                       "Reliability", "Accessibility")
    
    $qualityRequirements = @()
    $qualityInput.Split(',') | ForEach-Object {
        $qualityNum = $_.Trim()
        if ($qualityNum -match '^[1-8]$') {
            $qualityRequirements += $qualityOptions[[int]$qualityNum - 1]
        }
    }
    
    Write-ColorOutput "Great! I have all the information needed." "Success"
}

# Initialize project with CodeMind
Write-ColorOutput "`nInitializing CodeMind with enhanced project data..." "Info"

$initBody = @{
    project_name = $projectData.projectName
    project_path = $ProjectPath
    project_type = $projectData.projectType
    languages = $languages
    frameworks = $frameworks
    metadata = @{
        description = $projectData.description
        architecturePattern = $projectData.architecturePattern
        testingStrategy = $projectData.testingStrategy
        codingStandards = $projectData.codingStandards
        projectIntent = $projectData.projectIntent
        businessValue = $projectData.businessValue
        qualityRequirements = $qualityRequirements
        setupDate = (Get-Date).ToString("yyyy-MM-dd")
        claudeIntegration = $true
        interactiveSetup = $true
        mode = "auto"
        batchSize = 50
        override = $UpdateExisting
    }
} | ConvertTo-Json -Depth 5

try {
    $initResponse = Invoke-RestMethod -Uri "$CODEMIND_API/api/dashboard/projects" -Method POST -ContentType "application/json" -Body $initBody
    
    if ($initResponse.id) {
        Write-ColorOutput "Project initialized successfully" "Success"
        Write-ColorOutput "   Project ID: $($initResponse.id)" "Info"
        Write-ColorOutput "   Message: $($initResponse.message)" "Info"
        $projectId = $initResponse.id
    } else {
        throw "Project creation failed"
    }
} catch {
    $errorMessage = $_.Exception.Message
    $errorResponse = $_.ErrorDetails.Message
    
    if ($errorMessage -match "Project with this path already exists" -or $errorMessage -match "already exists" -or 
        $errorResponse -match "Project with this path already exists" -or $errorResponse -match "already exists") {
        Write-ColorOutput "Project already exists in database." "Warning"
        Write-ColorOutput "Would you like to update the existing project? (y/n) [y]" "Question"
        
        $updateChoice = ""
        if (-not $SkipInteractive) {
            $updateChoice = Read-Host
        } else {
            $updateChoice = "y"  # Default to yes in non-interactive mode
        }
        
        if (-not $updateChoice) { $updateChoice = "y" }
        
        if ($updateChoice.ToLower() -eq 'y') {
            try {
                # Get existing project ID by path or name
                Write-ColorOutput "Finding existing project..." "Info"
                $projectsResponse = Invoke-RestMethod -Uri "$CODEMIND_API/api/dashboard/projects" -Method GET
                
                # First try to find by exact path match
                $existingProject = $projectsResponse | Where-Object { $_.project_path -eq $ProjectPath }
                
                # If not found by path, try by name (take the first match)
                if (-not $existingProject) {
                    $existingProject = ($projectsResponse | Where-Object { $_.project_name -eq $projectData.projectName })[0]
                }
                
                if (-not $existingProject) {
                    throw "Could not find existing project to update"
                }
                
                Write-ColorOutput "Found existing project: $($existingProject.project_name) (ID: $($existingProject.project_id))" "Info"
                Write-ColorOutput "Current path: $($existingProject.project_path)" "Info"
                Write-ColorOutput "New path: $ProjectPath" "Info"
                
                # Create update payload (same structure as create, but using PUT)
                $updateBody = $initBody
                
                # Update the existing project
                $updateResponse = Invoke-RestMethod -Uri "$CODEMIND_API/api/dashboard/projects/$($existingProject.project_id)" -Method PUT -ContentType "application/json" -Body $updateBody
                
                if ($updateResponse.id) {
                    Write-ColorOutput "Project updated successfully!" "Success"
                    Write-ColorOutput "   Project ID: $($updateResponse.id)" "Info"
                    Write-ColorOutput "   Message: $($updateResponse.message)" "Info"
                    $projectId = $updateResponse.id
                } else {
                    throw "Project update failed"
                }
                
            } catch {
                Write-ColorOutput "Update failed: $_" "Error"
                exit 1
            }
        } else {
            Write-ColorOutput "Project initialization cancelled." "Warning"
            exit 0
        }
    } else {
        Write-ColorOutput "Initialization failed: $_" "Error"
        exit 1
    }
}

# Get smart questions
Write-ColorOutput "`nGenerating contextual questions..." "Info"
try {
    $questionsResponse = Invoke-RestMethod -Uri "$CODEMIND_API/claude/suggest-questions/$ProjectPath?maxQuestions=8"
    $questions = $questionsResponse.data.questions
} catch {
    $questions = @("What specific coding patterns should I follow?", "How should I structure the test files?", "What quality metrics are most important?")
}

# Create enhanced CLAUDE.md
Write-ColorOutput "`nCreating enhanced CLAUDE.md..." "Info"

$claudeMdContent = @"
# CLAUDE.md - $($projectData.projectName)

This file provides comprehensive guidance to Claude Code when working with this project.

## Project Overview

**Project**: $($projectData.projectName)
**Type**: $($projectData.projectType)
**Description**: $($projectData.description)
**Languages**: $($languages -join ", ")
**Architecture**: $($projectData.architecturePattern)
**Testing Strategy**: $($projectData.testingStrategy)
**Coding Standards**: $($projectData.codingStandards)
**Project Intent**: $($projectData.projectIntent)
**Business Value**: $($projectData.businessValue)
**Quality Requirements**: $($qualityRequirements -join ", ")

## CodeMind Integration

This project uses the CodeMind Intelligent Code Auxiliary System for enhanced context and analysis.

### Token-Efficient API Usage

**Environment Setup:**
```powershell
`$env:CODEMIND_API_URL = "$CODEMIND_API"
`$env:PROJECT_PATH = "$ProjectPath"
```

### Intelligent Context Patterns

#### Before Any Changes (Overview - ~200 tokens)
```powershell
Invoke-WebRequest -Uri "`$env:CODEMIND_API_URL/claude/context/`$env:PROJECT_PATH?intent=overview"
```

#### Before Coding (Development Context - ~500 tokens)
```powershell
Invoke-WebRequest -Uri "`$env:CODEMIND_API_URL/claude/context/`$env:PROJECT_PATH?intent=coding&maxTokens=800"
```

#### For Architecture Decisions (Detailed Analysis - ~1000 tokens)
```powershell
Invoke-WebRequest -Uri "`$env:CODEMIND_API_URL/claude/context/`$env:PROJECT_PATH?intent=architecture&maxTokens=1500"
```

#### When Debugging (Error Context - ~600 tokens)
```powershell
Invoke-WebRequest -Uri "`$env:CODEMIND_API_URL/claude/context/`$env:PROJECT_PATH?intent=debugging&maxTokens=1000"
```

#### For User Interaction (Smart Questions)
```powershell
Invoke-WebRequest -Uri "`$env:CODEMIND_API_URL/claude/suggest-questions/`$env:PROJECT_PATH?maxQuestions=3"
```

### Project-Specific Workflow

1. **Start every session** with overview context to understand current state
2. **Before creating features** get coding context for patterns and standards
3. **For architectural changes** use architecture context for design guidance
4. **When debugging** use error context for common issues and solutions
5. **For user requirements** use smart questions to gather focused information

### Smart Questions for User Interaction

When you need to gather requirements, consider asking:

$($questions | ForEach-Object { "- $_" } | Out-String)

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
- Project Intent: $($projectData.projectIntent)
- Quality Focus: $($qualityRequirements -join ", ")

### Integration Notes

- All CodeMind API calls are cached for 5 minutes
- Context responses are optimized for token efficiency
- Different intents provide focused information for specific tasks
- The system learns from your project patterns over time

**Setup completed**: $(Get-Date -Format "yyyy-MM-dd HH:mm")
**Integration**: Interactive Enhanced Setup v2.0 (PowerShell)
**Resume Token**: $resumeToken
"@

$claudeMdPath = Join-Path (Resolve-Path $ProjectPath) "CLAUDE.md"
$claudeMdContent | Out-File -FilePath $claudeMdPath -Encoding UTF8

Write-ColorOutput "Enhanced CLAUDE.md created with intelligent guidance" "Success"

# Final test
Write-ColorOutput "`nTesting enhanced integration..." "Info"
try {
    $testResponse = Invoke-RestMethod -Uri "$CODEMIND_API/claude/context/$ProjectPath?intent=coding&maxTokens=600"
    if ($testResponse.success) {
        Write-ColorOutput "Integration test successful" "Success"
        Write-ColorOutput "   Context API working with enhanced project data" "Info"
    }
} catch {
    Write-ColorOutput "Test failed but setup is complete" "Warning"
}

# Summary
Write-Host ""
Write-ColorOutput "CodeMind Three-Layer Platform Setup Complete!" "Success"
Write-ColorOutput "======================================================" "Info"
Write-ColorOutput "✅ Layer 1 (Smart CLI): Database-backed intelligent tool selection" "Success"
Write-ColorOutput "✅ Layer 2 (Orchestrator): Sequential role-based workflow coordination" "Success"
Write-ColorOutput "✅ Layer 3 (Planner): AI-powered idea-to-implementation planning" "Success"
Write-ColorOutput "" "Info"
Write-ColorOutput "Platform Features Configured:" "Info"
Write-ColorOutput "• Architecture: $($projectData.architecturePattern)" "Info"
Write-ColorOutput "• Testing: $($projectData.testingStrategy)" "Info"
Write-ColorOutput "• Standards: $($projectData.codingStandards)" "Info"
Write-ColorOutput "• Intent: $($projectData.projectIntent)" "Info"
Write-ColorOutput "• Quality: $($qualityRequirements -join ', ')" "Info"
Write-ColorOutput "" "Info"
Write-ColorOutput "Ready to Use:" "Success"
Write-ColorOutput "• Smart CLI: codemind 'your query' ./project" "Info"
Write-ColorOutput "• Orchestrator: codemind orchestrate 'complex task' ./project" "Info" 
Write-ColorOutput "• Planner: Dashboard → '💡 I have an idea' button" "Info"