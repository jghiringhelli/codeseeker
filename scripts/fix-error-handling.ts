#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'fast-glob';

/**
 * Fix TypeScript error handling issues
 * - Fix logger.error(message, error) -> logger.error(message, error as Error)
 * - Fix other common TypeScript strict mode issues
 */

async function fixErrorHandling(): Promise<void> {
  console.log('🔧 Fixing error handling across TypeScript files...');
  
  const tsFiles = await glob('src/**/*.ts', {
    cwd: process.cwd(),
    absolute: true
  });
  
  let totalFixes = 0;
  
  for (const filePath of tsFiles) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      let newContent = content;
      
      // Fix logger.error calls
      newContent = newContent.replace(
        /logger\.error\(([^,]+),\s*error\)/g,
        'logger.error($1, error as Error)'
      );
      
      // Fix this.logger.error calls
      newContent = newContent.replace(
        /this\.logger\.error\(([^,]+),\s*error\)/g,
        'this.logger.error($1, error as Error)'
      );
      
      // Fix other common error casting issues
      newContent = newContent.replace(
        /throw error;/g,
        'throw error as Error;'
      );
      
      // Fix undefined property access with optional chaining where possible
      newContent = newContent.replace(
        /\.forEach\(([^)]+)\)/g,
        '?.forEach($1)'
      );
      
      if (newContent !== content) {
        await fs.writeFile(filePath, newContent, 'utf-8');
        console.log(`✅ Fixed: ${path.relative(process.cwd(), filePath)}`);
        totalFixes++;
      }
      
    } catch (error) {
      console.warn(`⚠️ Failed to process ${filePath}:`, error);
    }
  }
  
  console.log(`\n🎉 Fixed error handling in ${totalFixes} files`);
}

// Run if called directly
if (require.main === module) {
  fixErrorHandling().catch(console.error);
}

export { fixErrorHandling };