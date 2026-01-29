#!/bin/sh
set -e

# CodeSeeker One-Line Installer for macOS/Linux
# Usage: curl -fsSL https://codeseeker.dev/install.sh | sh

RESET='\033[0m'
BOLD='\033[1m'
GREEN='\033[32m'
BLUE='\033[34m'
YELLOW='\033[33m'
RED='\033[31m'

echo "${BOLD}${BLUE}╔══════════════════════════════════════╗${RESET}"
echo "${BOLD}${BLUE}║   CodeSeeker Installer v1.0.0        ║${RESET}"
echo "${BOLD}${BLUE}╚══════════════════════════════════════╝${RESET}"
echo ""

# Detect OS
OS="$(uname -s)"
case "${OS}" in
  Linux*)     PLATFORM=Linux;;
  Darwin*)    PLATFORM=Mac;;
  *)          PLATFORM="UNKNOWN:${OS}"
esac

echo "${BLUE}→${RESET} Detected platform: ${BOLD}${PLATFORM}${RESET}"
echo ""

# Check for package managers and install
install_codeseeker() {
  # Try Snap first (Linux)
  if command -v snap >/dev/null 2>&1; then
    echo "${GREEN}✓${RESET} Found Snap package manager"
    echo "${BLUE}→${RESET} Installing via Snap..."
    sudo snap install codeseeker --classic
    return 0
  fi

  # Try Homebrew (macOS/Linux)
  if command -v brew >/dev/null 2>&1; then
    echo "${GREEN}✓${RESET} Found Homebrew package manager"
    echo "${BLUE}→${RESET} Installing via Homebrew..."
    brew install jghiringhelli/codeseeker/codeseeker
    return 0
  fi

  # Fall back to npm
  if command -v npm >/dev/null 2>&1; then
    echo "${GREEN}✓${RESET} Found npm package manager"
    echo "${BLUE}→${RESET} Installing via npm..."
    npm install -g codeseeker
    return 0
  fi

  # No package manager found
  echo "${RED}✗${RESET} No package manager found!"
  echo ""
  echo "Please install one of the following:"
  echo "  • Homebrew: https://brew.sh/"
  echo "  • Node.js/npm: https://nodejs.org/"
  if [ "$PLATFORM" = "Linux" ]; then
    echo "  • Snap: sudo apt install snapd"
  fi
  exit 1
}

# Install CodeSeeker
install_codeseeker

# Verify installation
echo ""
echo "${BLUE}→${RESET} Verifying installation..."
if command -v codeseeker >/dev/null 2>&1; then
  VERSION=$(codeseeker --version 2>/dev/null || echo "unknown")
  echo "${GREEN}✓${RESET} CodeSeeker installed successfully! (version: ${VERSION})"
else
  echo "${RED}✗${RESET} Installation verification failed"
  exit 1
fi

# Ask if user wants to configure IDE
echo ""
echo "${BOLD}${BLUE}Configure IDE?${RESET}"
echo "CodeSeeker needs to be configured for your AI assistant."
echo ""
printf "Which IDE are you using? (vscode/cursor/windsurf/skip): "
read -r IDE_CHOICE

case "${IDE_CHOICE}" in
  vscode|code|vs)
    echo "${BLUE}→${RESET} Configuring for VS Code..."
    codeseeker install --vscode
    echo "${GREEN}✓${RESET} VS Code configured! Restart VS Code to activate."
    ;;
  cursor)
    echo "${BLUE}→${RESET} Configuring for Cursor..."
    codeseeker install --cursor
    echo "${GREEN}✓${RESET} Cursor configured! Restart Cursor to activate."
    ;;
  windsurf)
    echo "${BLUE}→${RESET} Configuring for Windsurf..."
    codeseeker install --windsurf
    echo "${GREEN}✓${RESET} Windsurf configured! Restart Windsurf to activate."
    ;;
  skip|"")
    echo "${YELLOW}⚠${RESET}  Skipped IDE configuration"
    echo "    Run manually: ${BOLD}codeseeker install --vscode${RESET}"
    ;;
  *)
    echo "${YELLOW}⚠${RESET}  Unknown IDE. Run manually: ${BOLD}codeseeker install --<ide>${RESET}"
    ;;
esac

# Success message
echo ""
echo "${BOLD}${GREEN}╔══════════════════════════════════════╗${RESET}"
echo "${BOLD}${GREEN}║   Installation Complete! 🎉          ║${RESET}"
echo "${BOLD}${GREEN}╚══════════════════════════════════════╝${RESET}"
echo ""
echo "${BOLD}Next steps:${RESET}"
echo "  1. Restart your IDE"
echo "  2. Ask your AI assistant: \"What CodeSeeker tools do you have?\""
echo "  3. Start using semantic code search!"
echo ""
echo "Documentation: ${BLUE}https://github.com/jghiringhelli/codeseeker${RESET}"
echo ""
