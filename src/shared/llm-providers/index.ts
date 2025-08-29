/**
 * Multi-LLM Provider System for CodeMind CLI
 * 
 * This system provides a clean abstraction layer for integrating multiple LLM providers
 * that offer CLI tools similar to Claude Code. It allows CodeMind to work with:
 * 
 * - Claude Code (Anthropic) - Available now
 * - ChatGPT CLI (OpenAI) - Template for future CLI
 * - Gemini CLI (Google) - Template for future CLI  
 * - Grok CLI (xAI) - Template for future CLI
 * 
 * The system automatically detects available providers and can switch between them
 * seamlessly, maintaining the same functionality regardless of which LLM is being used.
 */

// Core interfaces and base classes
export {
    LLMProvider,
    LLMCapabilities,
    LLMContext,
    LLMResponse,
    AnalysisOptions,
    CodeGenerationRequest,
    CodeGenerationResponse,
    CodeReviewRequest,
    CodeReviewResponse,
    CodeIssue,
    CodeSuggestion,
    QualityScore,
    ValidationResult,
    CommandResult,
    BaseLLMProvider,
    LLMProviderRegistry,
    llmRegistry
} from './base-provider';

// Individual provider implementations
export { ClaudeProvider } from './claude-provider';
export { GPTProvider } from './gpt-provider';
export { GeminiProvider } from './gemini-provider';
export { GrokProvider } from './grok-provider';

// Provider factory and configuration
import { llmRegistry } from './base-provider';
import { ClaudeProvider } from './claude-provider';
import { GPTProvider } from './gpt-provider';
import { GeminiProvider } from './gemini-provider';
import { GrokProvider } from './grok-provider';

/**
 * Multi-LLM Manager for CodeMind
 * Handles provider registration, detection, and switching
 */
export class MultiLLMManager {
    private static instance: MultiLLMManager;
    private currentWorkingDirectory: string;

    constructor(workingDirectory: string = process.cwd()) {
        this.currentWorkingDirectory = workingDirectory;
        this.initializeProviders();
    }

    static getInstance(workingDirectory?: string): MultiLLMManager {
        if (!MultiLLMManager.instance) {
            MultiLLMManager.instance = new MultiLLMManager(workingDirectory);
        }
        return MultiLLMManager.instance;
    }

    /**
     * Initialize all available LLM providers
     */
    private initializeProviders(): void {
        // Register all providers
        const providers = [
            new ClaudeProvider(this.currentWorkingDirectory),
            new GPTProvider(this.currentWorkingDirectory),
            new GeminiProvider(this.currentWorkingDirectory),
            new GrokProvider(this.currentWorkingDirectory)
        ];

        providers.forEach(provider => {
            llmRegistry.register(provider);
            
            // Set up event listeners for monitoring
            provider.on('usage', (data) => {
                console.log(`📊 ${data.provider} usage: ${data.operation} (${data.tokens} tokens)`);
            });

            provider.on('error', (data) => {
                console.warn(`⚠️  ${data.provider} error in ${data.operation}:`, data.error.message);
            });
        });
    }

    /**
     * Automatically detect and set the best available provider
     */
    async autoSelectProvider(): Promise<string | null> {
        console.log('🔍 Detecting available LLM providers...');
        
        const providers = llmRegistry.getAvailableProviders();
        const results: { name: string; available: boolean; config: any }[] = [];

        for (const providerName of providers) {
            const provider = llmRegistry.getProvider(providerName);
            if (!provider) continue;

            try {
                const isAvailable = await provider.isAvailable();
                const validation = await provider.validateConfiguration();
                
                results.push({
                    name: providerName,
                    available: isAvailable,
                    config: validation
                });

                if (isAvailable && validation.isValid) {
                    console.log(`✅ ${providerName} is available and configured`);
                } else if (isAvailable) {
                    console.log(`⚠️  ${providerName} is available but has configuration issues`);
                } else {
                    console.log(`❌ ${providerName} is not available`);
                }
            } catch (error) {
                console.log(`❌ ${providerName} failed availability check:`, (error as Error).message);
                results.push({
                    name: providerName,
                    available: false,
                    config: { isValid: false, errors: [(error as Error).message] }
                });
            }
        }

        // Find the best provider (prioritize Claude Code, then others)
        const priority = ['claude-code', 'chatgpt', 'google-gemini', 'xai-grok'];
        
        for (const preferredProvider of priority) {
            const result = results.find(r => r.name === preferredProvider);
            if (result?.available && result.config.isValid) {
                llmRegistry.setActiveProvider(preferredProvider);
                console.log(`🎯 Active LLM provider: ${preferredProvider}`);
                return preferredProvider;
            }
        }

        // If no fully configured provider is available, try to use any available one
        for (const preferredProvider of priority) {
            const result = results.find(r => r.name === preferredProvider);
            if (result?.available) {
                llmRegistry.setActiveProvider(preferredProvider);
                console.log(`⚠️  Using ${preferredProvider} with configuration warnings`);
                return preferredProvider;
            }
        }

        console.log('❌ No LLM providers are available');
        return null;
    }

    /**
     * Get status of all providers
     */
    async getProviderStatus(): Promise<Record<string, any>> {
        const providers = llmRegistry.getAvailableProviders();
        const status: Record<string, any> = {};

        for (const providerName of providers) {
            const provider = llmRegistry.getProvider(providerName);
            if (!provider) continue;

            try {
                status[providerName] = {
                    available: await provider.isAvailable(),
                    validation: await provider.validateConfiguration(),
                    capabilities: provider.capabilities
                };
            } catch (error) {
                status[providerName] = {
                    available: false,
                    validation: { 
                        isValid: false, 
                        errors: [(error as Error).message] 
                    },
                    capabilities: provider.capabilities
                };
            }
        }

        return status;
    }

    /**
     * Switch to a specific provider
     */
    async switchProvider(providerName: string): Promise<boolean> {
        const provider = llmRegistry.getProvider(providerName);
        if (!provider) {
            throw new Error(`Provider '${providerName}' not found`);
        }

        const isAvailable = await provider.isAvailable();
        if (!isAvailable) {
            throw new Error(`Provider '${providerName}' is not available`);
        }

        llmRegistry.setActiveProvider(providerName);
        console.log(`🔄 Switched to LLM provider: ${providerName}`);
        return true;
    }

    /**
     * Get the currently active provider
     */
    getActiveProvider(): string | null {
        const provider = llmRegistry.getActiveProvider();
        return provider?.name || null;
    }

    /**
     * Execute analysis with the active provider
     */
    async analyze(prompt: string, options?: any): Promise<any> {
        const provider = llmRegistry.getActiveProvider();
        if (!provider) {
            throw new Error('No active LLM provider. Run autoSelectProvider() first.');
        }

        return provider.analyze(prompt, options);
    }

    /**
     * Generate code with the active provider
     */
    async generateCode(request: any): Promise<any> {
        const provider = llmRegistry.getActiveProvider();
        if (!provider) {
            throw new Error('No active LLM provider. Run autoSelectProvider() first.');
        }

        return provider.generateCode(request);
    }

    /**
     * Review code with the active provider
     */
    async reviewCode(request: any): Promise<any> {
        const provider = llmRegistry.getActiveProvider();
        if (!provider) {
            throw new Error('No active LLM provider. Run autoSelectProvider() first.');
        }

        return provider.reviewCode(request);
    }

    /**
     * Show help for setting up providers
     */
    showProviderSetupHelp(): void {
        console.log(`
🔧 LLM Provider Setup Guide
═══════════════════════════

📋 Available Providers:

1. 🤖 Claude Code (Anthropic) - AVAILABLE NOW
   Installation: Visit https://claude.ai/code
   Setup: Run 'claude auth login' after installation
   Status: Fully functional CLI tool

2. 💬 ChatGPT (OpenAI) - COMING SOON
   Installation: Wait for OpenAI CLI release
   Setup: Will require OpenAI account and API keys
   Status: Template implementation ready

3. 🧠 Gemini (Google) - COMING SOON
   Installation: Wait for Google CLI release
   Setup: Will require Google Cloud credentials
   Status: Template implementation ready

4. 🎭 Grok (xAI) - COMING SOON
   Installation: Wait for xAI CLI release
   Setup: Will require xAI platform account
   Status: Template implementation ready

🎯 Quick Start:
1. Install Claude Code CLI: https://claude.ai/code
2. Run: claude auth login
3. Run: codemind-cli auto-select-provider
4. Start using: codemind-cli analyze "your request"

💡 The system will automatically use the best available provider.
`);
    }
}

// Export the singleton instance
export const multiLLMManager = MultiLLMManager.getInstance();

// Export convenient functions
export const autoSelectProvider = () => multiLLMManager.autoSelectProvider();
export const getProviderStatus = () => multiLLMManager.getProviderStatus();
export const switchProvider = (name: string) => multiLLMManager.switchProvider(name);
export const showProviderHelp = () => multiLLMManager.showProviderSetupHelp();