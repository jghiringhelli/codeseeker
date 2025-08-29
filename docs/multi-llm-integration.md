# Multi-LLM Integration for CodeMind CLI

## 🌟 Overview

CodeMind CLI now supports multiple Large Language Model providers through a clean abstraction layer. This enables users to work with different LLM CLI tools while maintaining a consistent experience.

## 🤖 Supported Providers

### ✅ Currently Available

#### Claude Code (Anthropic)
- **Status**: ✅ Fully Functional
- **Installation**: [Claude Code CLI](https://claude.ai/code)
- **Setup**: `claude auth login`
- **Features**: Full CodeMind integration with all capabilities

### 🔄 Coming Soon (Template Ready)

#### ChatGPT CLI (OpenAI)
- **Status**: 🔄 Template Ready
- **Availability**: Waiting for OpenAI CLI release
- **Features**: Will support all CodeMind capabilities when available

#### Gemini CLI (Google)
- **Status**: 🔄 Template Ready  
- **Availability**: Waiting for Google CLI release
- **Features**: Will support all CodeMind capabilities when available

#### Grok CLI (xAI)
- **Status**: 🔄 Template Ready
- **Availability**: Waiting for xAI CLI release
- **Features**: Will support all CodeMind capabilities when available

## 🏗️ Architecture

### Base Provider Interface

All providers implement the `LLMProvider` interface:

```typescript
interface LLMProvider {
    readonly name: string;
    readonly version: string;
    readonly capabilities: LLMCapabilities;
    
    // Core methods
    analyze(prompt: string, options?: AnalysisOptions): Promise<LLMResponse>;
    generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResponse>;
    reviewCode(request: CodeReviewRequest): Promise<CodeReviewResponse>;
    
    // CLI integration
    isAvailable(): Promise<boolean>;
    validateConfiguration(): Promise<ValidationResult>;
    executeCommand(command: string, args: string[]): Promise<CommandResult>;
}
```

### Provider Registry

The `LLMProviderRegistry` manages all available providers and handles automatic selection:

```typescript
// Register all providers
llmRegistry.register(new ClaudeProvider());
llmRegistry.register(new GPTProvider());
llmRegistry.register(new GeminiProvider());
llmRegistry.register(new GrokProvider());

// Auto-select best available
const activeProvider = await llmRegistry.autoSelectBestProvider();
```

## 🚀 Usage Examples

### Quick Start

```bash
# Check available providers
npm run multi-llm provider list

# Auto-select best provider
npm run multi-llm provider auto

# Use with any provider
npm run multi-llm analyze "review this code"
npm run multi-llm generate "create a user service" --language typescript
```

### Provider Management

```bash
# List all providers with status
npm run multi-llm providers

# Switch to specific provider
npm run multi-llm provider switch claude-code

# Show setup help
npm run multi-llm provider help

# Detailed status
npm run multi-llm provider status
```

### Analysis Commands

```bash
# Analyze with context
npm run multi-llm analyze "optimize this function" --context

# Generate code
npm run multi-llm generate "REST API for user management" \
  --language typescript \
  --framework express \
  --tests

# Review code file
npm run multi-llm review ./src/user.ts --focus security
```

## 🔧 Integration with Existing CodeMind

### Enhanced CLI Integration

The multi-LLM system integrates seamlessly with the existing CodeMind enhanced CLI:

```typescript
// In codemind-enhanced-v2.ts
import { multiLLMManager } from '../shared/llm-providers';

// Auto-select provider at startup
await multiLLMManager.autoSelectProvider();

// Use active provider for analysis
const result = await multiLLMManager.analyze(prompt, options);
```

### Tool Selection Integration

The intelligent tool selector can work with any active provider:

```typescript
// The tool selection logic remains the same
const toolChain = await this.enhanceContextAutomatically({
    task: query,
    projectPath,
    provider: multiLLMManager.getActiveProvider() // Optional provider hint
});
```

## 📋 Provider Implementation Guide

### Adding New Providers

To add support for a new LLM CLI tool:

1. **Create Provider Class**:
```typescript
export class NewLLMProvider extends BaseLLMProvider {
    constructor() {
        super('new-llm', '1.0.0', capabilities);
    }
    
    async analyze(prompt: string, options?: AnalysisOptions): Promise<LLMResponse> {
        // Implement CLI command execution
        const result = await this.executeCommand('analyze', [prompt]);
        return this.parseResponse(result);
    }
    
    // Implement other required methods...
}
```

2. **Register Provider**:
```typescript
// In src/shared/llm-providers/index.ts
import { NewLLMProvider } from './new-llm-provider';

// Add to initialization
llmRegistry.register(new NewLLMProvider());
```

3. **Update Priority List**:
```typescript
// In MultiLLMManager.autoSelectBestProvider()
const priority = ['claude-code', 'new-llm', 'chatgpt', 'google-gemini', 'xai-grok'];
```

## 🎯 Provider Capabilities

Each provider declares its capabilities:

```typescript
interface LLMCapabilities {
    codeGeneration: boolean;      // Can generate code
    codeReview: boolean;          // Can review code  
    analysis: boolean;            // Can analyze text/code
    fileOperations: boolean;      // Can read/write files
    terminalAccess: boolean;      // Can execute commands
    toolIntegration: boolean;     // Can use external tools
    multiFileContext: boolean;    // Can handle multiple files
    projectAwareness: boolean;    // Understands project structure
}
```

## 🔒 Configuration and Security

### Provider Configuration

Each provider handles its own configuration:

```typescript
// Claude provider
const claudeProvider = new ClaudeProvider('/project/path');

// Validate configuration
const validation = await claudeProvider.validateConfiguration();
if (!validation.isValid) {
    console.log('Issues:', validation.errors);
    console.log('Requirements:', validation.requirements);
}
```

### Security Considerations

- Each provider manages its own authentication
- API keys and credentials are handled by the respective CLI tools
- CodeMind never stores or processes credentials directly
- All communication goes through the official CLI tools

## 📊 Monitoring and Analytics

### Usage Tracking

All providers emit usage events:

```typescript
provider.on('usage', (data) => {
    console.log(`${data.provider}: ${data.operation} (${data.tokens} tokens)`);
});

provider.on('error', (data) => {
    console.warn(`${data.provider} error:`, data.error);
});
```

### Performance Metrics

Track provider performance:

```typescript
const metrics = {
    tokensUsed: response.tokensUsed,
    processingTime: response.processingTime,
    confidence: response.confidence,
    provider: activeProvider.name
};
```

## 🤝 Backwards Compatibility

The multi-LLM system is designed to be fully backwards compatible:

- Existing CodeMind CLI commands continue to work
- Claude Code remains the default provider when available
- No breaking changes to existing APIs
- Gradual migration path for users

## 🔮 Future Enhancements

### Planned Features

1. **Provider Fallback**: Automatic fallback to secondary providers if primary fails
2. **Load Balancing**: Distribute requests across multiple providers
3. **Cost Optimization**: Route requests based on provider pricing
4. **Performance Optimization**: Cache results across providers
5. **Custom Providers**: Support for custom/local LLM providers

### Extensibility

The architecture supports:

- Custom provider implementations
- Plugin-based provider loading
- Dynamic provider discovery
- Provider-specific optimizations

## 📞 Support and Troubleshooting

### Common Issues

1. **No Providers Available**:
   ```bash
   # Install Claude Code CLI
   # Visit: https://claude.ai/code
   npm run multi-llm provider help
   ```

2. **Authentication Errors**:
   ```bash
   # For Claude Code
   claude auth login
   
   # Check status
   npm run multi-llm provider status
   ```

3. **Provider Not Detected**:
   ```bash
   # Force refresh
   npm run multi-llm provider auto
   ```

### Debug Mode

Enable detailed logging:

```bash
DEBUG=codemind:multi-llm npm run multi-llm analyze "test"
```

### Getting Help

- Check provider status: `npm run multi-llm provider status`
- View setup help: `npm run multi-llm provider help`  
- Run demo: `npm run multi-llm demo`

## 📝 Contributing

To contribute new providers or improvements:

1. Follow the provider implementation guide above
2. Add comprehensive tests
3. Update documentation
4. Submit pull request with provider template

The multi-LLM system makes CodeMind future-ready for the expanding ecosystem of AI CLI tools while maintaining the excellent user experience users expect.