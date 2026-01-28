$ErrorActionPreference = 'Stop'

$packageName = 'codeseeker'

# Uninstall via npm
Write-Host "Uninstalling CodeSeeker..."
& npm uninstall -g codeseeker

$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
  Write-Warning "npm uninstall returned exit code $exitCode"
}

Write-Host "CodeSeeker has been uninstalled." -ForegroundColor Green
