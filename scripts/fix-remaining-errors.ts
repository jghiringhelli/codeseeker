import * as fs from 'fs';
import * as path from 'path';

const fixes = [
  // Fix optional chaining increment/decrement issues
  {
    pattern: /(\w+\?\.\w+)\+\+/g,
    replacement: '($1 || 0) + 1',
    description: 'Fix increment on optional chaining'
  },
  {
    pattern: /(\w+\?\.\w+)--/g,
    replacement: '($1 || 0) - 1', 
    description: 'Fix decrement on optional chaining'
  },
  // Fix assignment to optional chaining
  {
    pattern: /(\w+\?\.\w+)\s*=\s*([^;]+);/g,
    replacement: 'if ($1 !== undefined) { $1 = $2; }',
    description: 'Fix assignment to optional property'
  }
];

function applyFixes(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  
  for (const fix of fixes) {
    if (fix.pattern.test(content)) {
      content = content.replace(fix.pattern, fix.replacement);
      modified = true;
      console.log(`Applied: ${fix.description} in ${filePath}`);
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content);
  }
}

// Apply to specific problematic files
const problematicFiles = [
  'src/features/centralization/detector.ts',
  'src/features/duplication/detector.ts', 
  'src/orchestration/context-manager.ts',
  'src/knowledge/repository/knowledge-repository.ts',
  'src/self-improvement/self-improvement-engine.ts',
  'src/utils/cache.ts',
  'src/cli/context-optimizer.ts'
];

for (const file of problematicFiles) {
  applyFixes(file);
}

console.log('✅ Applied targeted fixes for remaining compilation errors');