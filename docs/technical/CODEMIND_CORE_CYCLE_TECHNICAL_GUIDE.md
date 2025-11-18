# CodeMind Core Cycle - Technical Implementation Guide

**Version**: 1.0
**Date**: 2025-11-15
**Purpose**: Technical reference for debugging and code review of the 8-step CodeMind workflow

## Overview

The CodeMind Core Cycle is an 8-step intelligent enhancement workflow that transforms natural language queries into enhanced Claude Code interactions. This document provides detailed technical mapping of each step to the actual implementation.

## Architecture Entry Points

### CLI Entry Point
- **File**: `bin/codemind.js` → `src/cli/codemind-cli.ts`
- **Main Function**: `main()` at line 494
- **Input Processing**: Command line arguments parsed, natural language passed to `processInput()`

### Command Processing Flow
1. **CLI** → `CodeMindCLI.processInput()`
2. **Command Processor** → `CommandProcessor.processInput()`
3. **Command Router** → `CommandRouter.processInput()`
4. **Workflow Detection** → `WorkflowOrchestrator.shouldUseWorkflow()`
5. **Core Cycle** → `WorkflowOrchestrator.executeWorkflow()`

---

## Step-by-Step Technical Implementation

### 1️⃣ Query Analysis

**Purpose**: Analyze user input for assumptions, ambiguities, and intent

**Primary Implementation**:
- **File**: `src/cli/commands/services/natural-language-processor.ts`
- **Class**: `NaturalLanguageProcessor`
- **Method**: `analyzeQuery(query: string): QueryAnalysis`
- **Lines**: ~15-65

**Key Logic**:
```typescript
analyzeQuery(query: string): QueryAnalysis {
  const assumptions: string[] = [];
  const ambiguities: string[] = [];

  // Intent detection
  const intent = this.detectIntent(query);

  // Assumption detection patterns
  if (query.includes('authentication')) {
    assumptions.push('Assuming you have authentication system in place');
  }

  // Ambiguity detection
  if (query.includes('it') || query.includes('this')) {
    ambiguities.push('Pronouns detected - may need specific file/component references');
  }

  return { assumptions, ambiguities, intent, confidence };
}
```

**Dependencies**:
- **Interface**: `QueryAnalysis` (lines 8-14)
- **Helper Method**: `detectIntent()` (lines 95-110)
- **Helper Method**: `calculateConfidence()` (lines 100-108)

**Entry Point**:
- **File**: `src/cli/commands/services/workflow-orchestrator.ts`
- **Method**: `executeWorkflow()` line 55-60

**Debugging**:
- Check `assumptions` and `ambiguities` arrays
- Verify `intent` classification (create, modify, analyze, etc.)
- Monitor `confidence` score (0.0-1.0)

---

### 2️⃣ User Clarification

**Purpose**: Prompt user for clarifications when assumptions/ambiguities detected

**Primary Implementation**:
- **File**: `src/cli/commands/services/user-interaction-service.ts`
- **Class**: `UserInteractionService`
- **Method**: `promptForClarifications(queryAnalysis: QueryAnalysis): Promise<string[]>`
- **Lines**: ~30-55

**Key Logic**:
```typescript
async promptForClarifications(queryAnalysis: QueryAnalysis): Promise<string[]> {
  const clarifications: string[] = [];
  const questions = this.generateClarificationQuestions(queryAnalysis);

  if (questions.length === 0) {
    return clarifications;
  }

  console.log('🤔 CodeMind detected some assumptions and ambiguities...');

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    console.log(`${i + 1}. ${question}`);
    const answer = await this.getSimulatedUserInput(question);
    if (answer) {
      clarifications.push(`${question} → ${answer}`);
    }
  }

  return clarifications;
}
```

**Dependencies**:
- **Helper Method**: `generateClarificationQuestions()` (lines 120-150)
- **Helper Method**: `getSimulatedUserInput()` (lines 175-195)

**Entry Point**:
- **File**: `src/cli/commands/services/workflow-orchestrator.ts`
- **Method**: `executeWorkflow()` lines 62-69

**Debugging**:
- Check if `queryAnalysis.assumptions.length > 0` or `queryAnalysis.ambiguities.length > 0`
- Verify question generation logic
- Monitor user response simulation

---

### 3️⃣ Semantic Search

**Purpose**: Search codebase for files relevant to the query using vector embeddings

**Primary Implementation**:
- **File**: `src/cli/commands/services/semantic-search-orchestrator.ts`
- **Class**: `SemanticSearchOrchestrator`
- **Method**: `performSemanticSearch(query: string, projectPath: string): Promise<SemanticResult[]>`
- **Lines**: ~25-80

**Key Logic**:
```typescript
async performSemanticSearch(query: string, projectPath: string): Promise<SemanticResult[]> {
  const results: SemanticResult[] = [];

  try {
    // Find actual files in the project
    const { glob } = await import('fast-glob');
    const sourceFiles = await glob([
      'src/**/*.ts',
      'src/**/*.js',
      '*.ts',
      '*.js'
    ], {
      cwd: projectPath,
      ignore: ['node_modules/**', 'dist/**', '**/*.test.*']
    });

    // Calculate relevance for each file
    for (const file of sourceFiles) {
      const relevance = this.calculateRelevance(query, file);
      if (relevance.similarity > 0.3) {
        results.push({
          file: file,
          content: await this.getFilePreview(path.join(projectPath, file)),
          similarity: relevance.similarity,
          type: this.detectFileType(file)
        });
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity).slice(0, 10);
  } catch (error) {
    console.error('Semantic search error:', error);
    return [];
  }
}
```

**Dependencies**:
- **Interface**: `SemanticResult` (lines 8-14)
- **Helper Method**: `calculateRelevance()` (lines 85-120)
- **Helper Method**: `getFilePreview()` (lines 125-140)
- **Helper Method**: `detectFileType()` (lines 145-160)
- **External**: `fast-glob` library for file discovery

**Entry Point**:
- **File**: `src/cli/commands/services/workflow-orchestrator.ts`
- **Method**: `executeWorkflow()` lines 72-74

**Debugging**:
- Check `sourceFiles` array from glob pattern
- Verify `calculateRelevance()` scoring logic
- Monitor file filtering (similarity > 0.3 threshold)
- Check file preview extraction

---

### 4️⃣ Code Relationship Analysis

**Purpose**: Analyze relationships between relevant files and map dependencies

**Primary Implementation**:
- **File**: `src/cli/commands/services/graph-analysis-service.ts`
- **Class**: `GraphAnalysisService`
- **Method**: `performGraphAnalysis(query: string, semanticResults: SemanticResult[]): Promise<GraphContext>`
- **Lines**: ~25-85

**Key Logic**:
```typescript
async performGraphAnalysis(query: string, semanticResults: SemanticResult[]): Promise<GraphContext> {
  const classes: Array<{ name: string; filePath: string }> = [];
  const relationships: string[] = [];
  const relationshipDetails: Array<{ from: string; to: string; type: string }> = [];

  // Extract classes from semantic results
  for (const result of semanticResults) {
    const fileClasses = this.extractClassesFromFile(result);
    classes.push(...fileClasses);
  }

  // Analyze relationships between classes
  for (const cls of classes) {
    const classRelationships = await this.analyzeClassRelationships(cls, classes);
    relationships.push(...classRelationships.map(rel => `${rel.from} → ${rel.to}`));
    relationshipDetails.push(...classRelationships);
  }

  // Extract package structure
  const packageStructure = this.extractPackageStructure(semanticResults);

  return {
    classes,
    relationships,
    relationshipDetails,
    packageStructure
  };
}
```

**Dependencies**:
- **Interface**: `GraphContext` (lines 8-15)
- **Helper Method**: `extractClassesFromFile()` (lines 90-110)
- **Helper Method**: `analyzeClassRelationships()` (lines 115-140)
- **Helper Method**: `extractPackageStructure()` (lines 145-165)

**Entry Point**:
- **File**: `src/cli/commands/services/workflow-orchestrator.ts`
- **Method**: `executeWorkflow()` lines 76-78

**Debugging**:
- Check class extraction from TypeScript/JavaScript files
- Verify relationship detection (imports, extends, implements)
- Monitor package structure mapping
- Check relationship type classification (dependency, inheritance, etc.)

---

### 5️⃣ Enhanced Context Building

**Purpose**: Combine all analysis results into comprehensive context prompt for Claude

**Primary Implementation**:
- **File**: `src/cli/commands/services/context-builder.ts`
- **Class**: `ContextBuilder`
- **Method**: `buildEnhancedContext(...): EnhancedContext`
- **Lines**: ~25-55

**Key Logic**:
```typescript
buildEnhancedContext(
  originalQuery: string,
  queryAnalysis: QueryAnalysis,
  userClarifications: string[],
  semanticResults: SemanticResult[],
  graphContext: GraphContext
): EnhancedContext {
  const relevantFiles = semanticResults.map(result => ({
    path: result.file,
    type: result.type,
    similarity: result.similarity,
    preview: this.createFilePreview(result)
  }));

  const enhancedPrompt = this.createEnhancedPrompt(
    originalQuery,
    queryAnalysis,
    userClarifications,
    relevantFiles,
    graphContext
  );

  return {
    originalQuery,
    clarifications: userClarifications,
    assumptions: queryAnalysis.assumptions,
    relevantFiles,
    codeRelationships: graphContext.relationshipDetails,
    packageStructure: graphContext.packageStructure,
    enhancedPrompt
  };
}
```

**Dependencies**:
- **Interface**: `EnhancedContext` (lines 10-22)
- **Helper Method**: `createEnhancedPrompt()` (lines 60-120)
- **Helper Method**: `createFilePreview()` (lines 125-135)
- **Helper Method**: `getContextStats()` (lines 140-155)

**Entry Point**:
- **File**: `src/cli/commands/services/workflow-orchestrator.ts`
- **Method**: `executeWorkflow()` lines 80-87

**Debugging**:
- Check `enhancedPrompt` construction and formatting
- Verify all context sections are included
- Monitor prompt length for token optimization
- Check file preview generation

---

### 6️⃣ Claude Code Execution

**Purpose**: Execute Claude Code CLI with enhanced prompt and capture response

**Primary Implementation**:
- **File**: `src/cli/commands/services/user-interaction-service.ts`
- **Class**: `UserInteractionService`
- **Method**: `executeClaudeCode(enhancedPrompt: string): Promise<ClaudeResponse>`
- **Lines**: ~80-140

**Key Logic**:
```typescript
async executeClaudeCode(enhancedPrompt: string): Promise<ClaudeResponse> {
  try {
    // Check if running inside Claude Code (avoid recursion)
    if (PlatformUtils.isRunningInClaudeCode()) {
      console.log('🔄 Running inside Claude Code - using simulation mode');
      return this.simulateClaudeResponse(enhancedPrompt);
    }

    // Create temporary file for the prompt
    const promptFile = path.join(this.tempDir, `codemind-prompt-${Date.now()}.txt`);
    await fs.writeFile(promptFile, enhancedPrompt, 'utf8');

    // Execute Claude Code command
    const command = PlatformUtils.getClaudeCodeCommand(promptFile);
    console.log(`\n🚀 Executing Claude Code...`);

    const { stdout, stderr } = await execAsync(command, {
      ...PlatformUtils.getExecOptions(),
      timeout: 120000 // 2 minute timeout
    });

    // Clean up temp file
    await fs.unlink(promptFile).catch(() => {}); // Ignore errors

    return this.parseClaudeResponse(stdout);
  } catch (error) {
    console.error('❌ Failed to execute Claude Code:', error);
    return {
      response: 'Failed to execute Claude Code command',
      filesToModify: [],
      summary: 'Execution failed'
    };
  }
}
```

**Dependencies**:
- **Interface**: `ClaudeResponse` (lines 16-21)
- **Platform Utils**: `src/shared/platform-utils.ts`
- **Helper Method**: `simulateClaudeResponse()` (lines 200-210)
- **Helper Method**: `parseClaudeResponse()` (lines 215-230)
- **External**: Node.js `child_process.exec()` for command execution

**Entry Point**:
- **File**: `src/cli/commands/services/workflow-orchestrator.ts`
- **Method**: `executeWorkflow()` lines 94-96

**Debugging**:
- Check Claude Code CLI availability and authentication
- Verify temporary file creation and cleanup
- Monitor command execution timeout
- Check response parsing logic
- Test simulation mode fallback

---

### 7️⃣ File Modification Approval

**Purpose**: Show user which files Claude intends to modify and get approval

**Primary Implementation**:
- **File**: `src/cli/commands/services/user-interaction-service.ts`
- **Class**: `UserInteractionService`
- **Method**: `confirmFileModifications(filesToModify: string[]): Promise<{approved: boolean, dontAskAgain: boolean}>`
- **Lines**: ~145-175

**Key Logic**:
```typescript
async confirmFileModifications(filesToModify: string[]): Promise<{approved: boolean, dontAskAgain: boolean}> {
  if (filesToModify.length === 0) {
    return { approved: true, dontAskAgain: false };
  }

  console.log('\n📝 Claude Code will modify the following files:');
  filesToModify.forEach((file, index) => {
    console.log(`  ${index + 1}. ${file}`);
  });

  console.log('\nOptions:');
  console.log('  [y] Yes, proceed with modifications');
  console.log('  [n] No, cancel modifications');
  console.log('  [a] Yes, and don\'t ask me again for this session');

  // In a real implementation, this would use readline
  // For now, simulate user approval
  const choice = await this.getSimulatedUserChoice();

  return {
    approved: choice !== 'n',
    dontAskAgain: choice === 'a'
  };
}
```

**Dependencies**:
- **Helper Method**: `getSimulatedUserChoice()` (lines 235-240)

**Entry Point**:
- **File**: `src/cli/commands/services/workflow-orchestrator.ts`
- **Method**: `executeWorkflow()` lines 98-108

**Debugging**:
- Check `filesToModify` array parsing from Claude response
- Verify user choice simulation
- Monitor approval/cancellation logic

---

### 8️⃣ Execution Summary

**Purpose**: Display comprehensive summary of workflow execution and statistics

**Primary Implementation**:
- **File**: `src/cli/commands/services/user-interaction-service.ts`
- **Class**: `UserInteractionService`
- **Method**: `displayExecutionSummary(summary: string, stats: any): void`
- **Lines**: ~245-265

**Key Logic**:
```typescript
displayExecutionSummary(summary: string, stats: any): void {
  console.log('\n✅ CodeMind Execution Summary');
  console.log('━'.repeat(50));
  console.log(summary);

  if (stats) {
    console.log('\n📊 Analysis Statistics:');
    console.log(`  • Files analyzed: ${stats.filesFound}`);
    console.log(`  • Relationships found: ${stats.relationshipsFound}`);
    console.log(`  • Assumptions detected: ${stats.assumptionsDetected}`);
    console.log(`  • Clarifications provided: ${stats.clarificationsProvided}`);
  }
  console.log('');
}
```

**Dependencies**:
- **Statistics**: Generated by `ContextBuilder.getContextStats()` and `WorkflowOrchestrator.getWorkflowStats()`

**Entry Point**:
- **File**: `src/cli/commands/services/workflow-orchestrator.ts`
- **Method**: `executeWorkflow()` lines 112-113

**Debugging**:
- Check statistics calculation and aggregation
- Verify summary message generation
- Monitor console output formatting

---

## Master Orchestration

### WorkflowOrchestrator

**File**: `src/cli/commands/services/workflow-orchestrator.ts`
**Class**: `WorkflowOrchestrator`
**Main Method**: `executeWorkflow(query: string, projectPath: string, options?: WorkflowOptions): Promise<WorkflowResult>`

**Constructor Dependencies**:
```typescript
constructor() {
  this.nlpProcessor = new NaturalLanguageProcessor();
  this.searchOrchestrator = new SemanticSearchOrchestrator();
  this.graphAnalysisService = new GraphAnalysisService();
  this.contextBuilder = new ContextBuilder();
  this.userInteractionService = new UserInteractionService();
}
```

**Service Coordination**:
- Line 55: Query Analysis (Step 1)
- Lines 62-69: User Clarification (Step 2)
- Lines 72-74: Semantic Search (Step 3)
- Lines 76-78: Graph Analysis (Step 4)
- Lines 80-87: Context Building (Step 5)
- Lines 94-96: Claude Execution (Step 6)
- Lines 98-108: File Approval (Step 7)
- Lines 112-113: Summary Display (Step 8)

---

## Natural Language Detection

**File**: `src/cli/commands/services/natural-language-processor.ts`
**Method**: `isNaturalLanguageQuery(input: string): boolean`
**Lines**: 70-98

**Logic**:
1. Check if first word matches known CLI commands
2. Look for natural language indicators
3. Require minimum length (>10 characters)
4. Pattern matching for action words and technical terms

**Entry Point**:
- **File**: `src/cli/commands/command-router.ts`
- **Method**: `processInput()` line 78
- **Condition**: `this.workflowOrchestrator.shouldUseWorkflow(trimmedInput)`

---

## Error Handling and Fallbacks

### Claude Code Not Available
- **Location**: `user-interaction-service.ts` lines 200-210
- **Fallback**: `simulateClaudeResponse()` method
- **Detection**: `PlatformUtils.isRunningInClaudeCode()`

### Semantic Search Failures
- **Location**: `semantic-search-orchestrator.ts` lines 75-80
- **Fallback**: Empty results array
- **Logging**: Console error output

### File System Issues
- **Location**: Various file preview and analysis methods
- **Fallback**: Skip problematic files, continue processing
- **Logging**: Individual file errors logged but don't halt workflow

---

## Debugging Tips

### Enable Debug Logging
Add console.log statements at key decision points:

1. **Query Detection**: In `command-router.ts` line 78
2. **Service Entry**: At start of each main service method
3. **Data Flow**: Log input/output of each step
4. **Error Boundaries**: Catch blocks in all async methods

### Common Issues

1. **Natural Language Not Detected**: Check `isNaturalLanguageQuery()` patterns
2. **No Semantic Results**: Verify file glob patterns and project structure
3. **Empty Relationships**: Check TypeScript parsing in `graph-analysis-service.ts`
4. **Claude Code Fails**: Verify CLI installation and authentication

### Test Queries

```bash
# Simple creation task
codemind -c "add authentication middleware to the API routes"

# Analysis task
codemind -c "analyze the project structure for improvements"

# Modification task
codemind -c "improve the performance of the database queries"

# Complex task
codemind -c "refactor the user service to follow SOLID principles"
```

---

## Performance Considerations

1. **File Scanning**: Limited to specific patterns, ignores node_modules
2. **Semantic Results**: Capped at 10 files to prevent context overflow
3. **Timeouts**: 2-minute timeout on Claude Code execution
4. **Memory**: Temporary files cleaned up after use
5. **Token Optimization**: Context builder limits prompt size

---

This technical guide provides the complete mapping between the user-facing 8-step workflow and the actual implementation code. Use it for debugging, code review, and understanding the data flow through the system.