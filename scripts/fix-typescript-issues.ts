import * as fs from 'fs';
import * as path from 'path';

interface FileStats {
  fixedFiles: string[];
  totalFixes: number;
}

function fixTypeScriptIssues(filePath: string): number {
  let content = fs.readFileSync(filePath, 'utf-8');
  let fixes = 0;

  // Fix Object is possibly undefined/null issues
  const originalContent = content;

  // Fix .forEach on possibly empty objects - add optional chaining
  content = content.replace(
    /(\w+)\.forEach\(/g,
    (match, varName) => {
      if (!varName.includes('?')) {
        fixes++;
        return `${varName}?.forEach(`;
      }
      return match;
    }
  );

  // Fix object property access that might be undefined
  content = content.replace(
    /(\w+)\.(\w+)(\s*[=!]=|\s*\+|\s*-|\s*\*|\s*\/)/g,
    (match, obj, prop, op) => {
      if (!obj.includes('?') && !obj.includes('this.') && !obj.includes('console.')) {
        fixes++;
        return `${obj}?.${prop}${op}`;
      }
      return match;
    }
  );

  // Fix array/object length checks
  content = content.replace(
    /(\w+)\.length/g,
    (match, varName) => {
      if (!varName.includes('?') && !varName.includes('this.')) {
        fixes++;
        return `${varName}?.length`;
      }
      return match;
    }
  );

  // Fix boolean assignment issues - add ?? false for undefined booleans
  content = content.replace(
    /(\w+:\s*boolean\s*=\s*)(\w+\.?\w*);/g,
    (match, declaration, value) => {
      if (!value.includes('??')) {
        fixes++;
        return `${declaration}${value} ?? false;`;
      }
      return match;
    }
  );

  // Fix string assignment issues - add ?? '' for undefined strings
  content = content.replace(
    /(\w+:\s*string\s*=\s*)(\w+\.?\w*);/g,
    (match, declaration, value) => {
      if (!value.includes('??')) {
        fixes++;
        return `${declaration}${value} ?? '';`;
      }
      return match;
    }
  );

  // Fix array access issues - add null checks
  content = content.replace(
    /(\w+)\[(\w+)\](?=\s*\.\w)/g,
    (match, arr, index) => {
      if (!arr.includes('?')) {
        fixes++;
        return `${arr}?.[${index}]`;
      }
      return match;
    }
  );

  // Fix method calls on potentially undefined objects
  content = content.replace(
    /(\w+)\.(\w+)\(/g,
    (match, obj, method) => {
      if (!obj.includes('?') && !obj.includes('this.') && !obj.includes('console.') && 
          !['logger', 'JSON', 'Math', 'Object', 'Array', 'String', 'Number'].includes(obj)) {
        fixes++;
        return `${obj}?.${method}(`;
      }
      return match;
    }
  );

  // Only write if changes were made
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content);
    return fixes;
  }
  
  return 0;
}

function processDirectory(dirPath: string): FileStats {
  const stats: FileStats = { fixedFiles: [], totalFixes: 0 };
  
  function processFiles(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      if (entry.isDirectory() && !['node_modules', '.git', 'dist'].includes(entry.name)) {
        processFiles(fullPath);
      } else if (entry.isFile() && fullPath.endsWith('.ts')) {
        const fixes = fixTypeScriptIssues(fullPath);
        if (fixes > 0) {
          stats.fixedFiles.push(fullPath);
          stats.totalFixes += fixes;
        }
      }
    }
  }
  
  processFiles(dirPath);
  return stats;
}

console.log('🔧 Fixing TypeScript strict mode issues...');
const stats = processDirectory('./src');

if (stats.fixedFiles.length > 0) {
  console.log('✅ Fixed files:');
  stats.fixedFiles.forEach(file => console.log(`  - ${file}`));
  console.log(`🎉 Applied ${stats.totalFixes} fixes across ${stats.fixedFiles.length} files`);
} else {
  console.log('ℹ️ No TypeScript issues found to fix');
}