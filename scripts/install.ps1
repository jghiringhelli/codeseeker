# CodeSeeker One-Line Installer for Windows
# Usage: irm https://codeseeker.dev/install.ps1 | iex

$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "╔══════════════════════════════════════╗" -ForegroundColor Blue
Write-Host "║   CodeSeeker Installer v1.0.0        ║" -ForegroundColor Blue
Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Blue
Write-Host ""

# Detect platform
Write-Host "→ Detected platform: " -NoNewline -ForegroundColor Blue
Write-Host "Windows" -ForegroundColor White
Write-Host ""

# Function to check if command exists
function Test-Command($cmdname) {
    return [bool](Get-Command -Name $cmdname -ErrorAction SilentlyContinue)
}

# Function to check if running as admin
function Test-Admin {
    $currentUser = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentUser.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Install CodeSeeker
function Install-CodeSeeker {
    # Try Chocolatey first
    if (Test-Command choco) {
        Write-Host "✓ Found Chocolatey package manager" -ForegroundColor Green
        Write-Host "→ Installing via Chocolatey..." -ForegroundColor Blue

        if (Test-Admin) {
            choco install codeseeker -y
        } else {
            Write-Host "⚠  Chocolatey requires admin privileges" -ForegroundColor Yellow
            Write-Host "  Falling back to npm..." -ForegroundColor Yellow

            if (Test-Command npm) {
                npm install -g codeseeker
            } else {
                throw "Neither Chocolatey (with admin) nor npm is available"
            }
        }
        return
    }

    # Fall back to npm
    if (Test-Command npm) {
        Write-Host "✓ Found npm package manager" -ForegroundColor Green
        Write-Host "→ Installing via npm..." -ForegroundColor Blue
        npm install -g codeseeker
        return
    }

    # No package manager found
    Write-Host "✗ No package manager found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install one of the following:" -ForegroundColor Yellow
    Write-Host "  • Chocolatey: https://chocolatey.org/install"
    Write-Host "  • Node.js/npm: https://nodejs.org/"
    exit 1
}

# Main installation
try {
    Install-CodeSeeker
} catch {
    Write-Host "✗ Installation failed: $_" -ForegroundColor Red
    exit 1
}

# Verify installation
Write-Host ""
Write-Host "→ Verifying installation..." -ForegroundColor Blue
if (Test-Command codeseeker) {
    $version = & codeseeker --version 2>$null
    if ($null -eq $version) { $version = "unknown" }
    Write-Host "✓ CodeSeeker installed successfully! (version: $version)" -ForegroundColor Green
} else {
    Write-Host "✗ Installation verification failed" -ForegroundColor Red
    Write-Host "  Try closing and reopening PowerShell" -ForegroundColor Yellow
    exit 1
}

# Ask if user wants to configure IDE
Write-Host ""
Write-Host "Configure IDE?" -ForegroundColor Blue
Write-Host "CodeSeeker needs to be configured for your AI assistant."
Write-Host ""
$ideChoice = Read-Host "Which IDE are you using? (vscode/cursor/windsurf/skip)"

switch ($ideChoice.ToLower()) {
    { $_ -in @("vscode", "code", "vs") } {
        Write-Host "→ Configuring for VS Code..." -ForegroundColor Blue
        & codeseeker install --vscode
        Write-Host "✓ VS Code configured! Restart VS Code to activate." -ForegroundColor Green
    }
    "cursor" {
        Write-Host "→ Configuring for Cursor..." -ForegroundColor Blue
        & codeseeker install --cursor
        Write-Host "✓ Cursor configured! Restart Cursor to activate." -ForegroundColor Green
    }
    "windsurf" {
        Write-Host "→ Configuring for Windsurf..." -ForegroundColor Blue
        & codeseeker install --windsurf
        Write-Host "✓ Windsurf configured! Restart Windsurf to activate." -ForegroundColor Green
    }
    { $_ -in @("skip", "") } {
        Write-Host "⚠  Skipped IDE configuration" -ForegroundColor Yellow
        Write-Host "    Run manually: codeseeker install --vscode" -ForegroundColor Gray
    }
    default {
        Write-Host "⚠  Unknown IDE. Run manually: codeseeker install --<ide>" -ForegroundColor Yellow
    }
}

# Success message
Write-Host ""
Write-Host "╔══════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   Installation Complete! 🎉          ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  1. Restart your IDE"
Write-Host "  2. Ask your AI assistant: `"What CodeSeeker tools do you have?`""
Write-Host "  3. Start using semantic code search!"
Write-Host ""
Write-Host "Documentation: https://github.com/jghiringhelli/codeseeker" -ForegroundColor Blue
Write-Host ""
