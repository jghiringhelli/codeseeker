import * as fs from 'fs';
import * as path from 'path';

// Fix specific syntax errors that were introduced
const filesToFix = [
  'src/features/tree-navigation/navigator.ts',
  'src/features/vector-search/search-engine.ts', 
  'src/knowledge/analyzers/semantic-analyzer.ts',
  'src/knowledge/integration/knowledge-integrator.ts',
  'src/knowledge/repository/knowledge-repository.ts',
  'src/knowledge/tree/class-traversal-engine.ts',
  'src/orchestration/context-manager.ts',
  'src/orchestration/dynamic-knowledge-generator.ts',
  'src/orchestration/role-knowledge-integrator.ts',
  'src/self-improvement/self-improvement-engine.ts',
  'src/shared/ast/analyzer.ts'
];

for (const filePath of filesToFix) {
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${filePath} - file not found`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;

  // Fix double question marks that may have been added incorrectly
  const doubleQuestionRegex = /(\w+)\?\?\?/g;
  if (doubleQuestionRegex.test(content)) {
    content = content.replace(doubleQuestionRegex, '$1?');
    modified = true;
  }

  // Fix broken method/property access
  const brokenAccessRegex = /(\w+)\?\?\./g; 
  if (brokenAccessRegex.test(content)) {
    content = content.replace(brokenAccessRegex, '$1?.');
    modified = true;
  }

  // Fix broken multiplication/division/arithmetic operators
  const brokenArithmeticRegex = /(\w+)\?\?\s*([*\/\-\+])/g;
  if (brokenArithmeticRegex.test(content)) {
    content = content.replace(brokenArithmeticRegex, '$1? $2');
    modified = true;
  }

  // Fix malformed numbers like 5?.2
  const brokenNumberRegex = /(\d+)\?\?\.(\d+)/g;
  if (brokenNumberRegex.test(content)) {
    content = content.replace(brokenNumberRegex, '$1.$2');
    modified = true;
  }

  // Fix 5?.2 pattern (incorrect optional chaining on numbers)
  const numberOptionalRegex = /(\d+)\?\.(\d+)/g;
  if (numberOptionalRegex.test(content)) {
    content = content.replace(numberOptionalRegex, '$1.$2');
    modified = true;
  }

  // Fix 0?.23 pattern (incorrect optional chaining on numbers) 
  const leadingZeroRegex = /(^|\s)(\d+\?)\./gm;
  if (leadingZeroRegex.test(content)) {
    content = content.replace(leadingZeroRegex, '$1$2.');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed syntax errors in ${filePath}`);
  }
}

console.log('🎉 Syntax error fixes completed');