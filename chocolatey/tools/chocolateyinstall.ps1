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
$env:CODESEEKER_SKIP_POSTINSTALL = 'true'

# Prevent node-gyp from hanging when prebuilt binaries aren't available.
# If prebuild-install can't find prebuilts for this Node version, it falls back
# to node-gyp which needs Python + VS Build Tools. Setting python to a
# nonexistent path makes node-gyp fail fast instead of hanging.
$env:npm_config_python = 'nonexistent-to-fail-fast'

# Node.js is provided by the nodejs-lts nuspec dependency
# Refresh PATH in case nodejs-lts was just installed in this session
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

$nodeVersion = & node --version
Write-Host "Using Node.js $nodeVersion"

# Install via npm with timeout protection
# Native addons (better-sqlite3, tree-sitter) may hang if prebuilt binaries
# aren't available for this Node.js version and node-gyp tries to compile
Write-Host "Installing CodeSeeker via npm..."

$npmArgs = "install -g codeseeker --no-progress --no-fund --no-audit"
$proc = Start-Process -FilePath "npm" -ArgumentList $npmArgs -NoNewWindow -PassThru -RedirectStandardOutput "$toolsDir\npm-stdout.txt" -RedirectStandardError "$toolsDir\npm-stderr.txt"

$timeoutSeconds = 300
$completed = $proc.WaitForExit($timeoutSeconds * 1000)

if (-not $completed) {
  $proc | Stop-Process -Force
  Write-Host "npm install timed out after $timeoutSeconds seconds." -ForegroundColor Red
  Write-Host "This usually means a native addon (better-sqlite3 or tree-sitter) could not" -ForegroundColor Red
  Write-Host "find prebuilt binaries for Node.js $nodeVersion and tried to compile from source." -ForegroundColor Red
  if (Test-Path "$toolsDir\npm-stderr.txt") {
    Write-Host "npm stderr:" -ForegroundColor Yellow
    Get-Content "$toolsDir\npm-stderr.txt" | Write-Host
  }
  throw "npm install timed out after $timeoutSeconds seconds"
}

$exitCode = $proc.ExitCode

# Show any output for debugging
if (Test-Path "$toolsDir\npm-stdout.txt") {
  $stdout = Get-Content "$toolsDir\npm-stdout.txt" -Raw
  if ($stdout) { Write-Host $stdout }
}

if ($exitCode -ne 0) {
  Write-Host "npm install failed with exit code $exitCode" -ForegroundColor Red
  if (Test-Path "$toolsDir\npm-stderr.txt") {
    Write-Host "npm stderr:" -ForegroundColor Yellow
    Get-Content "$toolsDir\npm-stderr.txt" | Write-Host
  }
  throw "npm install failed with exit code $exitCode"
}

# Clean up temp files
Remove-Item "$toolsDir\npm-stdout.txt" -ErrorAction SilentlyContinue
Remove-Item "$toolsDir\npm-stderr.txt" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "CodeSeeker installed successfully!" -ForegroundColor Green
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
