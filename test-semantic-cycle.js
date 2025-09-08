#!/usr/bin/env node

/**
 * Test Script for Enhanced Semantic Cycle Features
 * Demonstrates the new intelligent deduplication and security analysis
 */

const { IntelligentCycleFeatures } = require('./dist/shared/intelligent-cycle-features');

async function demonstrateSemanticDeduplication() {
  console.log('🧠 Testing Semantic Deduplication Features\n');
  
  const intelligentFeatures = new IntelligentCycleFeatures();
  await intelligentFeatures.initialize();
  
  // Test cases
  const testCases = [
    {
      intent: "add user authentication function",
      description: "Should find existing authentication code"
    },
    {
      intent: "create API endpoint for login",
      description: "Should find existing login/auth endpoints"
    },
    {
      intent: "implement password validation",
      description: "Should find existing validation functions"
    },
    {
      intent: "build database connection",
      description: "Should find existing database utilities"
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`🔍 Testing: "${testCase.intent}"`);
    console.log(`💭 Expected: ${testCase.description}\n`);
    
    try {
      const result = await intelligentFeatures.checkSemanticDuplication(
        process.cwd(),
        testCase.intent,
        ['src/auth/auth.ts', 'src/api/routes.ts'] // Mock changed files
      );
      
      console.log(`📊 Results:`);
      console.log(`   Has duplicates: ${result.hasDuplicates}`);
      console.log(`   Semantic similarity: ${Math.round(result.semanticSimilarity * 100)}%`);
      console.log(`   Existing implementations: ${result.existingImplementations.length}`);
      
      if (result.existingImplementations.length > 0) {
        console.log(`   Top matches:`);
        result.existingImplementations.slice(0, 2).forEach((impl, i) => {
          console.log(`     ${i + 1}. ${impl.description} (${Math.round(impl.similarity * 100)}% match)`);
          console.log(`        File: ${impl.file}:${impl.lineRange.start}`);
        });
      }
      
      if (result.recommendations.length > 0) {
        console.log(`   💡 Recommendations:`);
        result.recommendations.slice(0, 3).forEach(rec => {
          console.log(`     • ${rec}`);
        });
      }
      
      console.log(`   ✅ Should proceed: ${result.shouldProceed}\n`);
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }
    
    console.log('─'.repeat(60) + '\n');
  }
}

async function demonstrateSmartSecurity() {
  console.log('🔒 Testing Smart Security Analysis Features\n');
  
  const intelligentFeatures = new IntelligentCycleFeatures();
  await intelligentFeatures.initialize();
  
  // Test cases
  const testCases = [
    {
      intent: "add user authentication system",
      description: "Should check for auth-specific vulnerabilities",
      mockFiles: ['src/auth/login.ts', 'src/auth/register.ts']
    },
    {
      intent: "create API endpoint",
      description: "Should check for injection vulnerabilities",
      mockFiles: ['src/api/users.ts', 'src/api/routes.ts']
    },
    {
      intent: "implement file upload",
      description: "Should check for path traversal issues",
      mockFiles: ['src/upload/handler.ts']
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`🔒 Testing: "${testCase.intent}"`);
    console.log(`💭 Expected: ${testCase.description}\n`);
    
    try {
      const result = await intelligentFeatures.performSmartSecurity(
        process.cwd(),
        testCase.mockFiles,
        testCase.intent
      );
      
      console.log(`📊 Security Analysis Results:`);
      console.log(`   Risk level: ${result.riskLevel}`);
      console.log(`   Vulnerabilities found: ${result.vulnerabilities.length}`);
      console.log(`   Security patterns checked: ${result.patterns.length}`);
      
      if (result.vulnerabilities.length > 0) {
        console.log(`   🚨 Vulnerabilities:`);
        result.vulnerabilities.slice(0, 3).forEach((vuln, i) => {
          console.log(`     ${i + 1}. [${vuln.severity.toUpperCase()}] ${vuln.description}`);
          if (vuln.file) console.log(`        File: ${vuln.file}:${vuln.line || '?'}`);
          console.log(`        Suggestion: ${vuln.suggestion}`);
        });
      }
      
      if (result.patterns.length > 0) {
        console.log(`   🛡️ Security Patterns Checked:`);
        result.patterns.slice(0, 3).forEach((pattern, i) => {
          console.log(`     ${i + 1}. ${pattern.description}`);
        });
      }
      
      if (result.recommendations.length > 0) {
        console.log(`   💡 Security Recommendations:`);
        result.recommendations.slice(0, 3).forEach(rec => {
          console.log(`     • ${rec}`);
        });
      }
      
      console.log('');
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`);
    }
    
    console.log('─'.repeat(60) + '\n');
  }
}

async function main() {
  console.log('🎯 CodeMind Enhanced Cycle Features Demonstration\n');
  console.log('This demonstrates the new intelligent features:\n');
  console.log('1. 🧠 Semantic-Powered Deduplication');
  console.log('   - Uses semantic search to find existing functionality');
  console.log('   - Prevents creating duplicate code');
  console.log('   - Provides intelligent recommendations\n');
  console.log('2. 🔒 Context-Aware Security Analysis');
  console.log('   - Analyzes security based on user intent');
  console.log('   - Applies relevant security patterns');
  console.log('   - Provides specific recommendations\n');
  console.log('═'.repeat(60) + '\n');
  
  try {
    await demonstrateSemanticDeduplication();
    console.log('\n' + '═'.repeat(60) + '\n');
    await demonstrateSmartSecurity();
  } catch (error) {
    console.error('Demo failed:', error);
  }
  
  console.log('🎉 Enhanced Cycle Features Demo Complete!\n');
  console.log('These features now run automatically in the CodeMind cycle system,');
  console.log('providing intelligent guidance before every Claude Code response.');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { demonstrateSemanticDeduplication, demonstrateSmartSecurity };