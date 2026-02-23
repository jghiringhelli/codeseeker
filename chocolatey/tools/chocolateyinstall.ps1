$ErrorActionPreference = 'Continue'

$packageName = 'codeseeker'
$toolsDir = "$(Split-Path -parent $MyInvocation.MyCommand.Definition)"

# Ensure npm runs non-interactively (critical for Chocolatey automated testing)
$env:CI = 'true'
$env:npm_config_yes = 'true'
$env:npm_config_progress = 'false'
$env:npm_config_fund = 'false'
$env:npm_config_audit = 'false'
$env:npm_config_loglevel = 'error'

# Check if Node.js is available (we don't use a nuspec dependency because
# the nodejs.install MSI hangs in Chocolatey's automated test environment)
$nodePath = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodePath) {
  Write-Host "Node.js not found. Installing via Chocolatey..." -ForegroundColor Yellow
  choco install nodejs-lts -y --no-progress 2>&1 | Out-Null
  # Refresh PATH so npm is available in this session
  $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
  $nodePath = Get-Command node -ErrorAction SilentlyContinue
  if (-not $nodePath) {
    throw "Failed to install Node.js. Please install Node.js 18+ manually: https://nodejs.org"
  }
}

$nodeVersion = & node --version
Write-Host "Using Node.js $nodeVersion"

# Install via npm (suppress npm warnings that aren't errors)
Write-Host "Installing CodeSeeker via npm..."
$npmOutput = & npm install -g codeseeker --no-progress --no-fund --no-audit 2>&1
$exitCode = $LASTEXITCODE

# Only fail on actual errors (exit code != 0), not deprecation warnings
if ($exitCode -ne 0) {
  Write-Host "npm output:" -ForegroundColor Red
  Write-Host $npmOutput
  throw "npm install failed with exit code $exitCode"
}

Write-Host ""
Write-Host "✓ CodeSeeker installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Quick start:" -ForegroundColor Cyan
Write-Host "  1. cd your-project"
Write-Host "  2. codeseeker install --vscode    # or --cursor, --windsurf"
Write-Host "  3. Restart your IDE"
Write-Host ""
Write-Host "Verify installation:" -ForegroundColor Cyan
Write-Host "  Ask your AI assistant: 'What CodeSeeker tools do you have?'"
Write-Host ""
Write-Host "Documentation: https://github.com/jghiringhelli/codeseeker#readme" -ForegroundColor Gray
Write-Host ""
