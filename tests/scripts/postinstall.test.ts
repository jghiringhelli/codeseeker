/**
 * Postinstall Script & Guidance Content Tests
 *
 * Tests for:
 * 1. Postinstall script guidance content completeness
 * 2. Setup command handler guidance content completeness
 * 3. Model-agnostic language (no hardcoded model names)
 * 4. Guidance consistency between postinstall and setup handler
 * 5. Postinstall utility functions
 */

import * as fs from 'fs';
import * as path from 'path';

// Read the postinstall script source for content validation
const postinstallPath = path.resolve(__dirname, '../../scripts/postinstall.js');
const postinstallContent = fs.readFileSync(postinstallPath, 'utf-8');

// Read the setup command handler source for content validation
const setupHandlerPath = path.resolve(
  __dirname,
  '../../src/cli/commands/handlers/setup-command-handler.ts'
);
const setupHandlerContent = fs.readFileSync(setupHandlerPath, 'utf-8');

/**
 * Extract the CODESEEKER_MCP_GUIDANCE content from a source file
 */
function extractGuidanceContent(source: string): string {
  // Match the template literal content between backticks after CODESEEKER_MCP_GUIDANCE =
  const match = source.match(
    /CODESEEKER_MCP_GUIDANCE\s*=\s*`([\s\S]*?)`;/
  );
  return match ? match[1] : '';
}

const postinstallGuidance = extractGuidanceContent(postinstallContent);
const setupHandlerGuidance = extractGuidanceContent(setupHandlerContent);

describe('Postinstall Script', () => {
  describe('file structure', () => {
    it('should exist at scripts/postinstall.js', () => {
      expect(fs.existsSync(postinstallPath)).toBe(true);
    });

    it('should have shebang line', () => {
      expect(postinstallContent.startsWith('#!/usr/bin/env node')).toBe(true);
    });

    it('should require necessary modules', () => {
      expect(postinstallContent).toContain("require('fs')");
      expect(postinstallContent).toContain("require('path')");
      expect(postinstallContent).toContain("require('os')");
      expect(postinstallContent).toContain("require('readline')");
    });
  });

  describe('non-interactive mode detection', () => {
    it('should check process.stdin.isTTY', () => {
      expect(postinstallContent).toContain('process.stdin.isTTY');
    });

    it('should check CI environment variables', () => {
      expect(postinstallContent).toContain("process.env.CI === 'true'");
      expect(postinstallContent).toContain("process.env.CONTINUOUS_INTEGRATION === 'true'");
    });

    it('should check npm_config_yes for --yes flag', () => {
      expect(postinstallContent).toContain("process.env.npm_config_yes === 'true'");
    });

    it('should support CODESEEKER_SKIP_POSTINSTALL env var', () => {
      expect(postinstallContent).toContain("process.env.CODESEEKER_SKIP_POSTINSTALL === 'true'");
    });
  });

  describe('agent file support', () => {
    it('should support Claude Code files', () => {
      expect(postinstallContent).toContain('.claude/CLAUDE.md');
    });

    it('should support Cursor files', () => {
      expect(postinstallContent).toContain('.cursor/rules');
      expect(postinstallContent).toContain('.cursorrules');
    });

    it('should support GitHub Copilot files', () => {
      expect(postinstallContent).toContain('copilot-instructions.md');
    });

    it('should support Windsurf files', () => {
      expect(postinstallContent).toContain('.windsurf/rules.md');
    });

    it('should support Gemini files', () => {
      expect(postinstallContent).toContain('.gemini/instructions.md');
    });

    it('should support Sourcegraph Cody files', () => {
      expect(postinstallContent).toContain('.sourcegraph/cody-instructions.md');
    });
  });

  describe('error handling', () => {
    it('should exit with code 0 on error (not block npm install)', () => {
      expect(postinstallContent).toContain('process.exit(0)');
    });

    it('should catch main() errors', () => {
      expect(postinstallContent).toContain('main().catch');
    });
  });

  describe('guidance update logic', () => {
    it('should detect old guidance marker', () => {
      expect(postinstallContent).toContain("'## CodeSeeker MCP Tools'");
    });

    it('should detect new guidance marker', () => {
      expect(postinstallContent).toContain("'## CodeSeeker MCP Tools - MANDATORY FOR CODE DISCOVERY'");
    });

    it('should handle replacing old guidance with new', () => {
      // The updateFileWithGuidance function should handle both old and new markers
      expect(postinstallContent).toContain('updateFileWithGuidance');
    });

    it('should handle creating new files with guidance', () => {
      expect(postinstallContent).toContain('createFileWithGuidance');
    });

    it('should create parent directories recursively', () => {
      expect(postinstallContent).toContain('recursive: true');
    });
  });
});

describe('CODESEEKER_MCP_GUIDANCE Content', () => {
  describe('postinstall guidance', () => {
    it('should contain the mandatory header', () => {
      expect(postinstallGuidance).toContain('## CodeSeeker MCP Tools - MANDATORY FOR CODE DISCOVERY');
    });

    it('should contain auto-initialization check section', () => {
      expect(postinstallGuidance).toContain('### Auto-Initialization Check');
      expect(postinstallGuidance).toContain('projects()');
      expect(postinstallGuidance).toContain('index({path:');
    });

    it('should contain when to use CodeSeeker section', () => {
      expect(postinstallGuidance).toContain('### When to Use CodeSeeker (DEFAULT)');
    });

    it('should contain the usage comparison table', () => {
      expect(postinstallGuidance).toContain('| Task | MUST Use | NOT This |');
      expect(postinstallGuidance).toContain('search("authentication logic")');
      expect(postinstallGuidance).toContain('search_and_read("error handling")');
    });

    it('should contain grep/glob exceptions section', () => {
      expect(postinstallGuidance).toContain('### When to Use grep/glob (EXCEPTIONS ONLY)');
    });

    it('should contain available MCP tools table', () => {
      expect(postinstallGuidance).toContain('### Available MCP Tools');
      expect(postinstallGuidance).toContain('search(query)');
      expect(postinstallGuidance).toContain('search_and_read(query)');
      expect(postinstallGuidance).toContain('show_dependencies({filepath})');
      expect(postinstallGuidance).toContain('read_with_context({filepath})');
      expect(postinstallGuidance).toContain('standards({project})');
      expect(postinstallGuidance).toContain('index({path})');
      expect(postinstallGuidance).toContain('sync({changes})');
      expect(postinstallGuidance).toContain('projects()');
    });

    it('should contain keep index updated section', () => {
      expect(postinstallGuidance).toContain('### Keep Index Updated');
      expect(postinstallGuidance).toContain('sync({changes:');
    });
  });

  describe('best practices section', () => {
    it('should contain the best practices header', () => {
      expect(postinstallGuidance).toContain('## Claude Code Best Practices (from 2000+ hours of expert usage)');
    });

    it('should contain Subagent Strategy section', () => {
      expect(postinstallGuidance).toContain('### Subagent Strategy for Complex Tasks');
      expect(postinstallGuidance).toContain('Orchestrator coordinates + focused subagents execute');
    });

    it('should contain Context Hygiene section', () => {
      expect(postinstallGuidance).toContain('### Context Hygiene - Prevent "Lost in the Middle"');
      expect(postinstallGuidance).toContain('double-escape (Esc Esc)');
      expect(postinstallGuidance).toContain('lost in the middle');
    });

    it('should contain Error Attribution Mindset section', () => {
      expect(postinstallGuidance).toContain('### Error Attribution Mindset');
      expect(postinstallGuidance).toContain('prompting or context engineering');
      expect(postinstallGuidance).toContain('Better input = better output');
    });
  });

  describe('model-agnostic language', () => {
    it('should NOT reference specific model names like "Opus"', () => {
      // Case-insensitive check for "opus subagent" or "Opus subagent"
      expect(postinstallGuidance.toLowerCase()).not.toContain('opus subagent');
    });

    it('should NOT reference "Opus 4.5" or similar versioned model names', () => {
      expect(postinstallGuidance).not.toMatch(/opus\s*4/i);
      expect(postinstallGuidance).not.toMatch(/sonnet\s*\d/i);
      expect(postinstallGuidance).not.toMatch(/haiku\s*\d/i);
    });

    it('should use "main model" instead of specific model names', () => {
      expect(postinstallGuidance).toContain('main model');
    });

    it('should recommend against cheaper/smaller models for subagents', () => {
      expect(postinstallGuidance).toContain('not cheaper/smaller models');
    });
  });
});

describe('Setup Command Handler Guidance', () => {
  describe('content completeness', () => {
    it('should contain the mandatory header', () => {
      expect(setupHandlerGuidance).toContain('## CodeSeeker MCP Tools - MANDATORY FOR CODE DISCOVERY');
    });

    it('should contain best practices section', () => {
      expect(setupHandlerGuidance).toContain('## Claude Code Best Practices (from 2000+ hours of expert usage)');
    });

    it('should contain all three best practice subsections', () => {
      expect(setupHandlerGuidance).toContain('### Subagent Strategy for Complex Tasks');
      expect(setupHandlerGuidance).toContain('### Context Hygiene - Prevent "Lost in the Middle"');
      expect(setupHandlerGuidance).toContain('### Error Attribution Mindset');
    });

    it('should contain all MCP tools', () => {
      expect(setupHandlerGuidance).toContain('search(query)');
      expect(setupHandlerGuidance).toContain('search_and_read(query)');
      expect(setupHandlerGuidance).toContain('show_dependencies({filepath})');
      expect(setupHandlerGuidance).toContain('read_with_context({filepath})');
      expect(setupHandlerGuidance).toContain('standards({project})');
      expect(setupHandlerGuidance).toContain('index({path})');
      expect(setupHandlerGuidance).toContain('sync({changes})');
      expect(setupHandlerGuidance).toContain('projects()');
    });
  });

  describe('model-agnostic language', () => {
    it('should NOT reference specific model names', () => {
      expect(setupHandlerGuidance.toLowerCase()).not.toContain('opus subagent');
      expect(setupHandlerGuidance).not.toMatch(/opus\s*4/i);
      expect(setupHandlerGuidance).not.toMatch(/sonnet\s*\d/i);
      expect(setupHandlerGuidance).not.toMatch(/haiku\s*\d/i);
    });

    it('should use "main model" instead of specific model names', () => {
      expect(setupHandlerGuidance).toContain('main model');
    });
  });
});

describe('Guidance Consistency', () => {
  it('both sources should have the same MCP tools header', () => {
    const postinstallHasHeader = postinstallGuidance.includes(
      '## CodeSeeker MCP Tools - MANDATORY FOR CODE DISCOVERY'
    );
    const setupHasHeader = setupHandlerGuidance.includes(
      '## CodeSeeker MCP Tools - MANDATORY FOR CODE DISCOVERY'
    );
    expect(postinstallHasHeader).toBe(true);
    expect(setupHasHeader).toBe(true);
  });

  it('both sources should have the same best practices header', () => {
    const postinstallHasHeader = postinstallGuidance.includes(
      '## Claude Code Best Practices (from 2000+ hours of expert usage)'
    );
    const setupHasHeader = setupHandlerGuidance.includes(
      '## Claude Code Best Practices (from 2000+ hours of expert usage)'
    );
    expect(postinstallHasHeader).toBe(true);
    expect(setupHasHeader).toBe(true);
  });

  it('both sources should have all three best practice sections', () => {
    const sections = [
      '### Subagent Strategy for Complex Tasks',
      '### Context Hygiene - Prevent "Lost in the Middle"',
      '### Error Attribution Mindset',
    ];

    for (const section of sections) {
      expect(postinstallGuidance).toContain(section);
      expect(setupHandlerGuidance).toContain(section);
    }
  });

  it('both sources should have the same MCP tool names', () => {
    const tools = [
      'search(query)',
      'search_and_read(query)',
      'show_dependencies({filepath})',
      'read_with_context({filepath})',
      'standards({project})',
      'index({path})',
      'sync({changes})',
      'projects()',
    ];

    for (const tool of tools) {
      expect(postinstallGuidance).toContain(tool);
      expect(setupHandlerGuidance).toContain(tool);
    }
  });

  it('both sources should use model-agnostic "main model" language', () => {
    expect(postinstallGuidance).toContain('main model');
    expect(setupHandlerGuidance).toContain('main model');
  });

  it('neither source should contain model-specific references', () => {
    const modelSpecificPatterns = [
      /opus subagent/i,
      /opus\s+4/i,
      /sonnet\s+\d/i,
      /haiku\s+\d/i,
      /claude-3/i,
    ];

    for (const pattern of modelSpecificPatterns) {
      expect(postinstallGuidance).not.toMatch(pattern);
      expect(setupHandlerGuidance).not.toMatch(pattern);
    }
  });
});
