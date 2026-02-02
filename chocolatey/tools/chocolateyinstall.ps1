$ErrorActionPreference = 'Continue'

$packageName = 'codeseeker'
$toolsDir = "$(Split-Path -parent $MyInvocation.MyCommand.Definition)"

# Install via npm (suppress npm warnings that aren't errors)
Write-Host "Installing CodeSeeker via npm..."
$npmOutput = & npm install -g codeseeker 2>&1
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
