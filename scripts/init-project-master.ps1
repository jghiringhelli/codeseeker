# CodeMind Master Project Initialization - PowerShell Wrapper
# Simple wrapper for the Node.js master initialization script

param(
    [string]$ProjectPath = $PWD,
    [string]$ProjectName,
    [switch]$Reset,
    [switch]$SkipAnalysis,
    [switch]$Verbose
)

Write-Host ""
Write-Host "🚀 CodeMind Master Project Initialization" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Set environment variables
$env:PROJECT_PATH = $ProjectPath

if ($ProjectName) {
    $env:PROJECT_NAME = $ProjectName
} else {
    $env:PROJECT_NAME = Split-Path -Leaf $ProjectPath
}

if ($Reset) {
    $env:RESET_PROJECT = "true"
}

if ($SkipAnalysis) {
    $env:SKIP_ANALYSIS = "true"
}

if ($Verbose) {
    $env:VERBOSE = "true"
}

Write-Host "Configuration:" -ForegroundColor Blue
Write-Host "  Project Path: $ProjectPath" -ForegroundColor Gray
Write-Host "  Project Name: $env:PROJECT_NAME" -ForegroundColor Gray
Write-Host "  Reset Project: $(if ($Reset) { 'Yes' } else { 'No' })" -ForegroundColor Gray
Write-Host "  Skip Analysis: $(if ($SkipAnalysis) { 'Yes' } else { 'No' })" -ForegroundColor Gray
Write-Host ""

# Run the master initialization script
Write-Host "Executing master initialization script..." -ForegroundColor Blue
node scripts/init-project-master.js $ProjectPath $env:PROJECT_NAME

$exitCode = $LASTEXITCODE

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "✅ Initialization completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  npm run dashboard" -ForegroundColor White
    Write-Host "  # or" -ForegroundColor White
    Write-Host "  docker-compose up dashboard" -ForegroundColor White
    Write-Host "  # then visit: http://localhost:3005" -ForegroundColor White
} else {
    Write-Host "❌ Initialization failed. Check the output above for details." -ForegroundColor Red
    Write-Host ""
    Write-Host "Common solutions:" -ForegroundColor Yellow
    Write-Host "  • Ensure PostgreSQL is running: docker-compose up database -d" -ForegroundColor White
    Write-Host "  • Build the project first: npm run build" -ForegroundColor White
    Write-Host "  • Check database connection settings in .env" -ForegroundColor White
}

exit $exitCode
