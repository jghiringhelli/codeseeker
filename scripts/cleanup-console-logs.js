#!/usr/bin/env node

/**
 * Console.log cleanup script
 * Replaces debug console.log statements with proper logger calls
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

async function cleanupConsoleLogs() {
  console.log('🧹 Starting console.log cleanup...');

  const files = await glob('src/**/*.ts', { cwd: process.cwd() });
  console.log(`Found ${files.length} TypeScript files to process`);

  let totalReplacements = 0;
  const processedFiles = [];

  for (const filePath of files) {
    const fullPath = path.resolve(filePath);
    let content = fs.readFileSync(fullPath, 'utf8');
    const originalContent = content;

    // Skip logger.ts itself
    if (filePath.includes('logger.ts')) continue;

    // Skip files that are user-facing CLI output
    if (filePath.includes('welcome-display.ts') ||
        filePath.includes('conversation-manager.ts') ||
        filePath.includes('user-interface.ts')) continue;

    let fileReplacements = 0;

    // Pattern 1: Debug console.log statements (common debugging patterns)
    content = content.replace(
      /console\.log\(\s*['"`](?:DEBUG|Info|Error|Warning|Log)[:]\s*[^'"`]*['"`]\s*(?:,\s*[^)]+)?\s*\);?/g,
      (match) => {
        fileReplacements++;
        // Extract the message and convert to logger.debug
        const messageMatch = match.match(/console\.log\(\s*['"`]([^'"`]*)['"`]/);
        const message = messageMatch ? messageMatch[1] : 'Debug message';
        return `this.logger.debug('${message.replace(/DEBUG[:]\s*/, '')}');`;
      }
    );

    // Pattern 2: Simple variable logging
    content = content.replace(
      /console\.log\(\s*['"`][^'"`]*['"`]\s*,\s*([^)]+)\s*\);?/g,
      (match, variable) => {
        fileReplacements++;
        const messageMatch = match.match(/console\.log\(\s*['"`]([^'"`]*)['"`]/);
        const message = messageMatch ? messageMatch[1] : 'Variable';
        return `this.logger.debug('${message}', { ${variable} });`;
      }
    );

    // Pattern 3: Simple debug console.log with template literals
    content = content.replace(
      /console\.log\(\s*`[^`]*\$\{[^}]+\}[^`]*`\s*\);?/g,
      (match) => {
        fileReplacements++;
        const message = match.replace(/console\.log\(\s*`([^`]*)`\s*\);?/, '$1');
        return `this.logger.debug(\`${message}\`);`;
      }
    );

    // Pattern 4: Simple string console.log
    content = content.replace(
      /console\.log\(\s*['"`](?!.*(?:\u2713|\u274c|\ud83d[\udc00-\udfff]|\ud83c[\udc00-\udfff]))([^'"`]+)['"`]\s*\);?/g,
      (match, message) => {
        fileReplacements++;
        return `this.logger.debug('${message}');`;
      }
    );

    // Add logger import if we made replacements and don't already have it
    if (fileReplacements > 0) {
      if (!content.includes("import { Logger }") &&
          !content.includes("private logger") &&
          !content.includes("this.logger")) {

        // Add logger import
        const importMatch = content.match(/^(import .+;\s*)+/m);
        if (importMatch) {
          content = content.replace(
            importMatch[0],
            importMatch[0] + "import { Logger } from '../utils/logger';\n"
          );
        }

        // Add logger property to class if it exists
        const classMatch = content.match(/export class (\w+) \{/);
        if (classMatch) {
          content = content.replace(
            /export class (\w+) \{/,
            `export class $1 {\n  private logger = Logger.getInstance();`
          );
        }
      }
    }

    // Write the file back if changes were made
    if (content !== originalContent) {
      fs.writeFileSync(fullPath, content);
      processedFiles.push({
        file: filePath,
        replacements: fileReplacements
      });
      totalReplacements += fileReplacements;
    }
  }

  console.log(`\n✅ Cleanup complete!`);
  console.log(`   Total replacements: ${totalReplacements}`);
  console.log(`   Files modified: ${processedFiles.length}`);

  if (processedFiles.length > 0) {
    console.log(`\n📝 Modified files:`);
    processedFiles.forEach(({ file, replacements }) => {
      console.log(`   ${file}: ${replacements} replacements`);
    });
  }

  return { totalReplacements, processedFiles };
}

// Run the cleanup
cleanupConsoleLogs()
  .then(result => {
    console.log(`\n🎉 Console.log cleanup completed successfully!`);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Console.log cleanup failed:', error);
    process.exit(1);
  });