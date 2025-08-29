# CodeMind Enhanced CLI Testing Script
# Tests the new automatic context enhancement features

Write-Host "🚀 CodeMind Enhanced CLI Testing" -ForegroundColor Cyan
Write-Host "═" * 60 -ForegroundColor Cyan

# Build the project first
Write-Host "`n📦 Building project..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build completed successfully" -ForegroundColor Green

# Test 1: Initialize configuration
Write-Host "`n🔧 Test 1: Initialize Configuration" -ForegroundColor Magenta
node dist/cli/codemind-enhanced-v2.js config init --file .codemind-test.json

# Test 2: Automatic Context Enhancement for Code Generation
Write-Host "`n🎯 Test 2: Code Generation Request (Auto-Enhanced)" -ForegroundColor Magenta
Write-Host "Expected: compilation-verifier, context-deduplicator, dependency-mapper, semantic-context-builder, duplication-detector, tree-navigator, test-mapping-analyzer, solid-principles-analyzer" -ForegroundColor Gray
node dist/cli/codemind-enhanced-v2.js analyze "create a new user authentication service" . --explain

# Test 3: UI Development Request
Write-Host "`n🎨 Test 3: UI Development Request (Auto-Enhanced)" -ForegroundColor Magenta
Write-Host "Expected: compilation-verifier, context-deduplicator, dependency-mapper, semantic-context-builder, ui-navigation-analyzer, duplication-detector" -ForegroundColor Gray
node dist/cli/codemind-enhanced-v2.js analyze "create a new React component for user profile" . --explain

# Test 4: Refactoring Request
Write-Host "`n🔄 Test 4: Refactoring Request (Auto-Enhanced)" -ForegroundColor Magenta
Write-Host "Expected: compilation-verifier, context-deduplicator, dependency-mapper, semantic-context-builder, duplication-detector, solid-principles-analyzer, centralization-detector, test-mapping-analyzer" -ForegroundColor Gray
node dist/cli/codemind-enhanced-v2.js analyze "refactor the authentication logic to improve maintainability" . --explain

# Test 5: Architecture Changes Request
Write-Host "`n🏗️  Test 5: Architecture Changes Request (Auto-Enhanced)" -ForegroundColor Magenta
Write-Host "Expected: compilation-verifier, context-deduplicator, dependency-mapper, semantic-context-builder, solid-principles-analyzer, use-cases-analyzer, tree-navigator, knowledge-graph" -ForegroundColor Gray
node dist/cli/codemind-enhanced-v2.js analyze "design a new microservices architecture" . --explain

# Test 6: Bug Fix Request
Write-Host "`n🐛 Test 6: Bug Fix Request (Auto-Enhanced)" -ForegroundColor Magenta
Write-Host "Expected: compilation-verifier, context-deduplicator, dependency-mapper, semantic-context-builder, issues-detector, test-mapping-analyzer, tree-navigator" -ForegroundColor Gray
node dist/cli/codemind-enhanced-v2.js analyze "fix the memory leak in the user service" . --explain

# Test 7: Testing Request
Write-Host "`n🧪 Test 7: Testing Request (Auto-Enhanced)" -ForegroundColor Magenta
Write-Host "Expected: compilation-verifier, context-deduplicator, dependency-mapper, semantic-context-builder, test-mapping-analyzer, solid-principles-analyzer" -ForegroundColor Gray
node dist/cli/codemind-enhanced-v2.js analyze "add comprehensive unit tests for the payment module" . --explain

# Test 8: Tool Preview (Shows automatic selection)
Write-Host "`n🔍 Test 8: Tool Preview for Code Generation" -ForegroundColor Magenta
node dist/cli/codemind-enhanced-v2.js preview-tools "implement a new payment processing feature"

# Test 9: Enhanced Enhancement with Auto-Context
Write-Host "`n⚡ Test 9: Enhanced Enhancement with Auto-Context" -ForegroundColor Magenta
node dist/cli/codemind-enhanced-v2.js enhance . --explain --dry-run

# Test 10: Benchmark - Smart vs Traditional
Write-Host "`n📊 Test 10: Performance Benchmark" -ForegroundColor Magenta
node dist/cli/codemind-enhanced-v2.js benchmark .

# Test 11: Session Management
Write-Host "`n📋 Test 11: Session Management" -ForegroundColor Magenta
node dist/cli/codemind-enhanced-v2.js sessions list
node dist/cli/codemind-enhanced-v2.js sessions stats

# Color Legend for Manual Verification
Write-Host "`n🎨 Color Legend for Manual Verification:" -ForegroundColor Cyan
Write-Host "🔵 BLUE [INFO] - General information and analysis steps" -ForegroundColor Blue
Write-Host "🟢 GREEN [SUCCESS] - Completed operations and successful results" -ForegroundColor Green  
Write-Host "🟣 MAGENTA [🔧 TOOL-SELECT] - Tool selection and execution" -ForegroundColor Magenta
Write-Host "🔵 CYAN [📝 CONTEXT] - Context optimization operations" -ForegroundColor Cyan
Write-Host "🔵 BRIGHT BLUE [💾 DATABASE] - Database operations" -ForegroundColor Blue
Write-Host "🟡 YELLOW [WARNING] - Warnings and non-critical issues" -ForegroundColor Yellow
Write-Host "🔴 RED [ERROR] - Errors and failed operations" -ForegroundColor Red

Write-Host "`n✨ Key Features to Verify:" -ForegroundColor Cyan
Write-Host "1. Automatic tool selection based on request type" -ForegroundColor White
Write-Host "2. Core context enhancement tools always run" -ForegroundColor White
Write-Host "3. Request-specific tools added automatically" -ForegroundColor White
Write-Host "4. Parallel execution for performance" -ForegroundColor White
Write-Host "5. Colored logging for easy identification" -ForegroundColor White
Write-Host "6. Tool caching for performance" -ForegroundColor White
Write-Host "7. Database updates tracking tool usage" -ForegroundColor White

Write-Host "`n🔧 Manual Database Verification Commands:" -ForegroundColor Cyan
Write-Host "docker exec -it codemind-postgres psql -U postgres -d codemind_dev -c \"SELECT decision_type, context->>'task', decision->>'selectedTools', timestamp FROM claude_decisions ORDER BY timestamp DESC LIMIT 5;\"" -ForegroundColor Gray

Write-Host "`n🌐 Dashboard Verification:" -ForegroundColor Cyan  
Write-Host "1. Start dashboard: node src/dashboard/server.js" -ForegroundColor Gray
Write-Host "2. Visit: http://localhost:3005" -ForegroundColor Gray
Write-Host "3. Check tool usage visualization" -ForegroundColor Gray

Write-Host "`n🎯 Testing completed! Review the colored output above to verify automatic context enhancement is working." -ForegroundColor Green