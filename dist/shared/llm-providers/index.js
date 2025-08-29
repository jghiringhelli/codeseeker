"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.showProviderHelp = exports.switchProvider = exports.getProviderStatus = exports.autoSelectProvider = exports.multiLLMManager = exports.MultiLLMManager = exports.GrokProvider = exports.GeminiProvider = exports.GPTProvider = exports.ClaudeProvider = exports.llmRegistry = exports.LLMProviderRegistry = exports.BaseLLMProvider = void 0;
// Core interfaces and base classes
var base_provider_1 = require("./base-provider");
Object.defineProperty(exports, "BaseLLMProvider", { enumerable: true, get: function () { return base_provider_1.BaseLLMProvider; } });
Object.defineProperty(exports, "LLMProviderRegistry", { enumerable: true, get: function () { return base_provider_1.LLMProviderRegistry; } });
Object.defineProperty(exports, "llmRegistry", { enumerable: true, get: function () { return base_provider_1.llmRegistry; } });
// Individual provider implementations
var claude_provider_1 = require("./claude-provider");
Object.defineProperty(exports, "ClaudeProvider", { enumerable: true, get: function () { return claude_provider_1.ClaudeProvider; } });
var gpt_provider_1 = require("./gpt-provider");
Object.defineProperty(exports, "GPTProvider", { enumerable: true, get: function () { return gpt_provider_1.GPTProvider; } });
var gemini_provider_1 = require("./gemini-provider");
Object.defineProperty(exports, "GeminiProvider", { enumerable: true, get: function () { return gemini_provider_1.GeminiProvider; } });
var grok_provider_1 = require("./grok-provider");
Object.defineProperty(exports, "GrokProvider", { enumerable: true, get: function () { return grok_provider_1.GrokProvider; } });
// Provider factory and configuration
const base_provider_2 = require("./base-provider");
const claude_provider_2 = require("./claude-provider");
const gpt_provider_2 = require("./gpt-provider");
const gemini_provider_2 = require("./gemini-provider");
const grok_provider_2 = require("./grok-provider");
/**
 * Multi-LLM Manager for CodeMind
 * Handles provider registration, detection, and switching
 */
class MultiLLMManager {
    static instance;
    currentWorkingDirectory;
    constructor(workingDirectory = process.cwd()) {
        this.currentWorkingDirectory = workingDirectory;
        this.initializeProviders();
    }
    static getInstance(workingDirectory) {
        if (!MultiLLMManager.instance) {
            MultiLLMManager.instance = new MultiLLMManager(workingDirectory);
        }
        return MultiLLMManager.instance;
    }
    /**
     * Initialize all available LLM providers
     */
    initializeProviders() {
        // Register all providers
        const providers = [
            new claude_provider_2.ClaudeProvider(this.currentWorkingDirectory),
            new gpt_provider_2.GPTProvider(this.currentWorkingDirectory),
            new gemini_provider_2.GeminiProvider(this.currentWorkingDirectory),
            new grok_provider_2.GrokProvider(this.currentWorkingDirectory)
        ];
        providers.forEach(provider => {
            base_provider_2.llmRegistry.register(provider);
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
    async autoSelectProvider() {
        console.log('🔍 Detecting available LLM providers...');
        const providers = base_provider_2.llmRegistry.getAvailableProviders();
        const results = [];
        for (const providerName of providers) {
            const provider = base_provider_2.llmRegistry.getProvider(providerName);
            if (!provider)
                continue;
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
                }
                else if (isAvailable) {
                    console.log(`⚠️  ${providerName} is available but has configuration issues`);
                }
                else {
                    console.log(`❌ ${providerName} is not available`);
                }
            }
            catch (error) {
                console.log(`❌ ${providerName} failed availability check:`, error.message);
                results.push({
                    name: providerName,
                    available: false,
                    config: { isValid: false, errors: [error.message] }
                });
            }
        }
        // Find the best provider (prioritize Claude Code, then others)
        const priority = ['claude-code', 'chatgpt', 'google-gemini', 'xai-grok'];
        for (const preferredProvider of priority) {
            const result = results.find(r => r.name === preferredProvider);
            if (result?.available && result.config.isValid) {
                base_provider_2.llmRegistry.setActiveProvider(preferredProvider);
                console.log(`🎯 Active LLM provider: ${preferredProvider}`);
                return preferredProvider;
            }
        }
        // If no fully configured provider is available, try to use any available one
        for (const preferredProvider of priority) {
            const result = results.find(r => r.name === preferredProvider);
            if (result?.available) {
                base_provider_2.llmRegistry.setActiveProvider(preferredProvider);
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
    async getProviderStatus() {
        const providers = base_provider_2.llmRegistry.getAvailableProviders();
        const status = {};
        for (const providerName of providers) {
            const provider = base_provider_2.llmRegistry.getProvider(providerName);
            if (!provider)
                continue;
            try {
                status[providerName] = {
                    available: await provider.isAvailable(),
                    validation: await provider.validateConfiguration(),
                    capabilities: provider.capabilities
                };
            }
            catch (error) {
                status[providerName] = {
                    available: false,
                    validation: {
                        isValid: false,
                        errors: [error.message]
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
    async switchProvider(providerName) {
        const provider = base_provider_2.llmRegistry.getProvider(providerName);
        if (!provider) {
            throw new Error(`Provider '${providerName}' not found`);
        }
        const isAvailable = await provider.isAvailable();
        if (!isAvailable) {
            throw new Error(`Provider '${providerName}' is not available`);
        }
        base_provider_2.llmRegistry.setActiveProvider(providerName);
        console.log(`🔄 Switched to LLM provider: ${providerName}`);
        return true;
    }
    /**
     * Get the currently active provider
     */
    getActiveProvider() {
        const provider = base_provider_2.llmRegistry.getActiveProvider();
        return provider?.name || null;
    }
    /**
     * Execute analysis with the active provider
     */
    async analyze(prompt, options) {
        const provider = base_provider_2.llmRegistry.getActiveProvider();
        if (!provider) {
            throw new Error('No active LLM provider. Run autoSelectProvider() first.');
        }
        return provider.analyze(prompt, options);
    }
    /**
     * Generate code with the active provider
     */
    async generateCode(request) {
        const provider = base_provider_2.llmRegistry.getActiveProvider();
        if (!provider) {
            throw new Error('No active LLM provider. Run autoSelectProvider() first.');
        }
        return provider.generateCode(request);
    }
    /**
     * Review code with the active provider
     */
    async reviewCode(request) {
        const provider = base_provider_2.llmRegistry.getActiveProvider();
        if (!provider) {
            throw new Error('No active LLM provider. Run autoSelectProvider() first.');
        }
        return provider.reviewCode(request);
    }
    /**
     * Show help for setting up providers
     */
    showProviderSetupHelp() {
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
exports.MultiLLMManager = MultiLLMManager;
// Export the singleton instance
exports.multiLLMManager = MultiLLMManager.getInstance();
// Export convenient functions
const autoSelectProvider = () => exports.multiLLMManager.autoSelectProvider();
exports.autoSelectProvider = autoSelectProvider;
const getProviderStatus = () => exports.multiLLMManager.getProviderStatus();
exports.getProviderStatus = getProviderStatus;
const switchProvider = (name) => exports.multiLLMManager.switchProvider(name);
exports.switchProvider = switchProvider;
const showProviderHelp = () => exports.multiLLMManager.showProviderSetupHelp();
exports.showProviderHelp = showProviderHelp;
//# sourceMappingURL=index.js.map