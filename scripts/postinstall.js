#!/usr/bin/env node
/**
 * CodeSeeker Post-Install Script
 *
 * Solves the chicken-and-egg problem: AI assistants won't use CodeSeeker MCP tools
 * unless explicitly instructed, but users won't run `codeseeker init` unless the
 * AI assistant suggests it.
 *
 * This script runs after `npm install` and:
 * 1. Searches for user-level AI agent instruction files
 * 2. Asks permission to add CodeSeeker MCP guidance
 * 3. If declined, prompts the user to run `codeseeker init` in specific projects
 *
 * Supports: Claude, Cursor, Copilot, Windsurf, Gemini, Grok, Cody, and more
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

/**
 * CodeSeeker MCP guidance to inject into agent instruction files
 * This tells AI assistants to prefer CodeSeeker tools over grep/glob
 */
const CODESEEKER_MCP_GUIDANCE = `
## CodeSeeker MCP Tools - MANDATORY FOR CODE DISCOVERY

**CRITICAL**: CodeSeeker MCP tools are available. Use them as your PRIMARY method for code discovery, NOT grep/glob.

### Auto-Initialization Check

**BEFORE any code search**, verify the project is indexed:
1. Call \`projects()\` to see indexed projects
2. If this project is NOT listed, call \`index({path: "PROJECT_ROOT_PATH"})\` first
3. If tools return "Not connected", the MCP server may need restart

### When to Use CodeSeeker (DEFAULT)

**ALWAYS use CodeSeeker for these queries:**
- "Where is X handled?" → \`search("X handling logic")\`
- "Find the auth/login/validation code" → \`search("authentication")\`
- "How does Y work?" → \`search_and_read("Y implementation")\`
- "What calls/imports Z?" → \`show_dependencies({filepath: "path/to/Z"})\`
- "Show me the error handling" → \`search_and_read("error handling patterns")\`

| Task | MUST Use | NOT This |
|------|----------|----------|
| Find code by meaning | \`search("authentication logic")\` | ❌ \`grep -r "auth"\` |
| Search + read files | \`search_and_read("error handling")\` | ❌ \`grep\` then \`cat\` |
| Show dependencies | \`show_dependencies({filepath})\` | ❌ Manual file reading |
| Find patterns | \`standards({project})\` | ❌ Searching manually |
| Understand a file | \`read_with_context({filepath})\` | ❌ Just Read alone |

### When to Use grep/glob (EXCEPTIONS ONLY)

Only fall back to grep/glob when:
- Searching for **exact literal strings** (UUIDs, specific error codes, magic numbers)
- Using **regex patterns** that semantic search can't handle
- You **already know the exact file path**

### Available MCP Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| \`search(query)\` | Semantic search | First choice for any "find X" query |
| \`search_and_read(query)\` | Search + read combined | When you need file contents |
| \`show_dependencies({filepath})\` | Dependency graph | "What uses this?", "What does this depend on?" |
| \`read_with_context({filepath})\` | File + related code | Reading a file for the first time |
| \`standards({project})\` | Project patterns | Before writing new code |
| \`index({path})\` | Index a project | If project not indexed |
| \`sync({changes})\` | Update index | After editing files |
| \`projects()\` | Show indexed projects | Check if project is indexed |

### Keep Index Updated

After using Edit/Write tools, call:
\`\`\`
sync({changes: [{type: "modified", path: "path/to/file"}]})
\`\`\`

`;

/**
 * User-level agent instruction file locations
 * These are in the user's home directory and apply globally
 */
const USER_LEVEL_AGENT_FILES = [
  // Claude Code - user-level config
  { path: '.claude/CLAUDE.md', name: 'Claude Code', create: true },
  { path: '.claude/settings/claude_desktop_config.json', name: 'Claude Desktop', create: false }, // JSON needs special handling

  // Cursor - user-level rules
  { path: '.cursor/rules', name: 'Cursor (global rules)', create: true },
  { path: '.cursorrules', name: 'Cursor (home)', create: true },

  // GitHub Copilot - user-level instructions
  { path: '.github/copilot-instructions.md', name: 'GitHub Copilot', create: true },

  // Windsurf
  { path: '.windsurf/rules.md', name: 'Windsurf', create: true },

  // Gemini / Google AI Studio
  { path: '.gemini/instructions.md', name: 'Google Gemini', create: true },

  // Grok / xAI
  { path: '.grok/instructions.md', name: 'xAI Grok', create: true },

  // Amazon Q / CodeWhisperer
  { path: '.aws/q-instructions.md', name: 'Amazon Q', create: true },

  // Codeium
  { path: '.codeium/instructions.md', name: 'Codeium', create: true },

  // Tabnine
  { path: '.tabnine/instructions.md', name: 'Tabnine', create: true },

  // Sourcegraph Cody
  { path: '.sourcegraph/cody-instructions.md', name: 'Sourcegraph Cody', create: true },

  // Continue.dev (VSCode extension)
  { path: '.continue/config.json', name: 'Continue.dev', create: false }, // JSON needs special handling

  // Generic agent files in home directory
  { path: 'AGENTS.md', name: 'Generic AGENTS.md', create: true },
  { path: '.ai/instructions.md', name: 'Generic AI instructions', create: true },
];

/**
 * Check if running in CI/CD or non-interactive environment
 */
function isNonInteractive() {
  return !process.stdin.isTTY ||
         process.env.CI === 'true' ||
         process.env.CONTINUOUS_INTEGRATION === 'true' ||
         process.env.npm_config_yes === 'true' ||
         process.env.CODESEEKER_SKIP_POSTINSTALL === 'true';
}

/**
 * Prompt user for yes/no input
 */
async function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase().trim());
    });
  });
}

/**
 * Find existing user-level agent instruction files
 */
function findExistingAgentFiles() {
  const homeDir = os.homedir();
  const found = [];

  for (const fileInfo of USER_LEVEL_AGENT_FILES) {
    // Skip JSON files for now - they need special handling
    if (fileInfo.path.endsWith('.json')) continue;

    const fullPath = path.join(homeDir, fileInfo.path);
    try {
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        found.push({
          ...fileInfo,
          fullPath,
          content,
          hasGuidance: content.includes('## CodeSeeker MCP Tools'),
        });
      }
    } catch (err) {
      // File doesn't exist or can't be read - that's fine
    }
  }

  return found;
}

/**
 * Get files that could be created (don't exist yet)
 */
function getCreatableFiles() {
  const homeDir = os.homedir();
  const creatable = [];

  for (const fileInfo of USER_LEVEL_AGENT_FILES) {
    // Skip JSON files and non-creatable files
    if (fileInfo.path.endsWith('.json') || !fileInfo.create) continue;

    const fullPath = path.join(homeDir, fileInfo.path);
    if (!fs.existsSync(fullPath)) {
      creatable.push({
        ...fileInfo,
        fullPath,
      });
    }
  }

  return creatable;
}

/**
 * Update an existing file with CodeSeeker guidance
 */
function updateFileWithGuidance(fileInfo) {
  try {
    const oldMarker = '## CodeSeeker MCP Tools';
    const newMarker = '## CodeSeeker MCP Tools - MANDATORY FOR CODE DISCOVERY';

    // Check if already has latest guidance
    if (fileInfo.content.includes(newMarker)) {
      return { updated: false, reason: 'already up to date' };
    }

    let newContent;

    // Check if has old guidance - replace it
    if (fileInfo.content.includes(oldMarker)) {
      const oldGuidanceStart = fileInfo.content.indexOf(oldMarker);
      const afterOldGuidance = fileInfo.content.substring(oldGuidanceStart + oldMarker.length);

      // Find where the old guidance ends
      const nextHeadingMatch = afterOldGuidance.match(/\n## [^#]/);
      let oldGuidanceEnd;
      if (nextHeadingMatch?.index !== undefined) {
        oldGuidanceEnd = oldGuidanceStart + oldMarker.length + nextHeadingMatch.index;
      } else {
        oldGuidanceEnd = fileInfo.content.length;
      }

      const beforeGuidance = fileInfo.content.substring(0, oldGuidanceStart);
      const afterGuidance = fileInfo.content.substring(oldGuidanceEnd);
      newContent = beforeGuidance.trimEnd() + '\n\n' + CODESEEKER_MCP_GUIDANCE.trim() + '\n' + afterGuidance;
    } else {
      // No guidance at all - append it
      newContent = fileInfo.content.trimEnd() + '\n\n' + CODESEEKER_MCP_GUIDANCE;
    }

    fs.writeFileSync(fileInfo.fullPath, newContent);
    return { updated: true };
  } catch (err) {
    return { updated: false, reason: err.message };
  }
}

/**
 * Create a new file with CodeSeeker guidance
 */
function createFileWithGuidance(fileInfo) {
  try {
    // Ensure parent directory exists
    const dirPath = path.dirname(fileInfo.fullPath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const content = `# ${fileInfo.name} Instructions

This file contains instructions for ${fileInfo.name} AI assistant.

${CODESEEKER_MCP_GUIDANCE}
`;

    fs.writeFileSync(fileInfo.fullPath, content);
    return { created: true };
  } catch (err) {
    return { created: false, reason: err.message };
  }
}

/**
 * Main postinstall logic
 */
async function main() {
  console.log(`\n${colors.cyan}${colors.bright}🔍 CodeSeeker Post-Install Setup${colors.reset}\n`);

  // Check for non-interactive mode
  if (isNonInteractive()) {
    console.log(`${colors.yellow}⚠️  Running in non-interactive mode - skipping user prompts${colors.reset}`);
    console.log(`${colors.dim}   Set CODESEEKER_SKIP_POSTINSTALL=true to skip this message${colors.reset}`);
    console.log(`\n${colors.blue}💡 To enable CodeSeeker MCP tools in your AI assistant, run:${colors.reset}`);
    console.log(`${colors.bright}   codeseeker init${colors.reset} ${colors.dim}(in your project directory)${colors.reset}\n`);
    return;
  }

  // Find existing agent instruction files
  const existingFiles = findExistingAgentFiles();
  const creatableFiles = getCreatableFiles();

  // Files that need updating (don't have guidance or have old guidance)
  const filesToUpdate = existingFiles.filter(f => !f.hasGuidance ||
    (f.content.includes('## CodeSeeker MCP Tools') &&
     !f.content.includes('## CodeSeeker MCP Tools - MANDATORY FOR CODE DISCOVERY')));

  // Files that already have the latest guidance
  const upToDateFiles = existingFiles.filter(f =>
    f.content.includes('## CodeSeeker MCP Tools - MANDATORY FOR CODE DISCOVERY'));

  if (upToDateFiles.length > 0) {
    console.log(`${colors.green}✓ Found ${upToDateFiles.length} agent file(s) already configured:${colors.reset}`);
    for (const file of upToDateFiles) {
      console.log(`${colors.dim}   • ${file.name} (${file.fullPath})${colors.reset}`);
    }
    console.log('');
  }

  if (filesToUpdate.length === 0 && creatableFiles.length === 0) {
    if (upToDateFiles.length > 0) {
      console.log(`${colors.green}✅ All detected AI agent files already have CodeSeeker guidance!${colors.reset}\n`);
    } else {
      console.log(`${colors.yellow}⚠️  No AI agent instruction files found in your home directory.${colors.reset}\n`);
      console.log(`${colors.blue}💡 To enable CodeSeeker MCP tools:${colors.reset}`);
      console.log(`${colors.bright}   codeseeker init${colors.reset} ${colors.dim}(in your project directory)${colors.reset}\n`);
    }
    return;
  }

  // Show files that will be updated
  if (filesToUpdate.length > 0) {
    console.log(`${colors.yellow}📝 Found ${filesToUpdate.length} agent file(s) that can be updated:${colors.reset}`);
    for (const file of filesToUpdate) {
      const status = file.hasGuidance ? '(outdated guidance)' : '(no CodeSeeker guidance)';
      console.log(`${colors.dim}   • ${file.name} ${status}${colors.reset}`);
      console.log(`${colors.dim}     ${file.fullPath}${colors.reset}`);
    }
    console.log('');
  }

  // Show files that can be created
  if (creatableFiles.length > 0 && filesToUpdate.length === 0) {
    console.log(`${colors.blue}📄 These AI agent files can be created in your home directory:${colors.reset}`);
    // Only show the most common ones
    const commonFiles = creatableFiles.slice(0, 3);
    for (const file of commonFiles) {
      console.log(`${colors.dim}   • ${file.name}${colors.reset}`);
    }
    if (creatableFiles.length > 3) {
      console.log(`${colors.dim}   • ... and ${creatableFiles.length - 3} more${colors.reset}`);
    }
    console.log('');
  }

  // Ask for permission to update existing files
  if (filesToUpdate.length > 0) {
    console.log(`${colors.bright}CodeSeeker needs to add instructions to your AI agent files.${colors.reset}`);
    console.log(`${colors.dim}This helps AI assistants use CodeSeeker's semantic search instead of grep/glob.${colors.reset}\n`);

    const answer = await askQuestion(
      `${colors.cyan}? Update ${filesToUpdate.length} file(s) with CodeSeeker guidance? (Y/n): ${colors.reset}`
    );

    if (answer === '' || answer === 'y' || answer === 'yes') {
      console.log('');
      let successCount = 0;
      for (const file of filesToUpdate) {
        const result = updateFileWithGuidance(file);
        if (result.updated) {
          console.log(`${colors.green}   ✅ Updated ${file.name}${colors.reset}`);
          successCount++;
        } else {
          console.log(`${colors.yellow}   ⚠️  Skipped ${file.name}: ${result.reason}${colors.reset}`);
        }
      }
      console.log(`\n${colors.green}✅ Updated ${successCount} file(s) with CodeSeeker guidance!${colors.reset}\n`);
    } else {
      console.log(`\n${colors.yellow}⚠️  Skipped updating agent files.${colors.reset}`);
      console.log(`${colors.blue}💡 To enable CodeSeeker MCP tools later, run:${colors.reset}`);
      console.log(`${colors.bright}   codeseeker init${colors.reset} ${colors.dim}(in your project directory)${colors.reset}\n`);
      return;
    }
  }

  // Offer to create a common agent file if none exist
  if (filesToUpdate.length === 0 && creatableFiles.length > 0 && upToDateFiles.length === 0) {
    // Find Claude.md specifically as the most common
    const claudeFile = creatableFiles.find(f => f.path === '.claude/CLAUDE.md');
    const targetFile = claudeFile || creatableFiles[0];

    console.log(`${colors.bright}Would you like to create a user-level ${targetFile.name} file?${colors.reset}`);
    console.log(`${colors.dim}This will apply CodeSeeker guidance to all your projects.${colors.reset}\n`);

    const answer = await askQuestion(
      `${colors.cyan}? Create ${targetFile.path}? (Y/n): ${colors.reset}`
    );

    if (answer === '' || answer === 'y' || answer === 'yes') {
      const result = createFileWithGuidance(targetFile);
      if (result.created) {
        console.log(`\n${colors.green}✅ Created ${targetFile.fullPath}${colors.reset}`);
        console.log(`${colors.dim}   CodeSeeker MCP guidance is now available globally!${colors.reset}\n`);
      } else {
        console.log(`\n${colors.red}❌ Failed to create ${targetFile.name}: ${result.reason}${colors.reset}\n`);
      }
    } else {
      console.log(`\n${colors.yellow}⚠️  Skipped creating agent file.${colors.reset}`);
      console.log(`${colors.blue}💡 To enable CodeSeeker MCP tools, run:${colors.reset}`);
      console.log(`${colors.bright}   codeseeker init${colors.reset} ${colors.dim}(in your project directory)${colors.reset}\n`);
    }
  }

  // Final message
  console.log(`${colors.cyan}${colors.bright}🚀 CodeSeeker is ready!${colors.reset}`);
  console.log(`${colors.dim}   Run 'codeseeker --help' to see available commands.${colors.reset}\n`);
}

// Run the script
main().catch((err) => {
  console.error(`${colors.red}Error during post-install: ${err.message}${colors.reset}`);
  // Don't exit with error code - postinstall failures shouldn't block npm install
  process.exit(0);
});
