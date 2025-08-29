"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.llmRegistry = exports.LLMProviderRegistry = exports.BaseLLMProvider = void 0;
const events_1 = require("events");
/**
 * Base implementation providing common functionality
 */
class BaseLLMProvider extends events_1.EventEmitter {
    name;
    version;
    capabilities;
    context = null;
    config = {};
    constructor(name, version, capabilities) {
        super();
        this.name = name;
        this.version = version;
        this.capabilities = capabilities;
    }
    // Common implementations
    setContext(context) {
        this.context = context;
        this.emit('context-updated', context);
    }
    getContext() {
        return this.context;
    }
    clearContext() {
        this.context = null;
        this.emit('context-cleared');
    }
    logUsage(operation, tokens, duration) {
        this.emit('usage', {
            provider: this.name,
            operation,
            tokens,
            duration,
            timestamp: new Date()
        });
    }
    validateRequest(request, requiredFields) {
        for (const field of requiredFields) {
            if (!request[field]) {
                throw new Error(`Missing required field: ${String(field)}`);
            }
        }
    }
    handleError(error, operation) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.emit('error', {
            provider: this.name,
            operation,
            error: err,
            timestamp: new Date()
        });
        throw err;
    }
}
exports.BaseLLMProvider = BaseLLMProvider;
/**
 * Registry for managing multiple LLM providers
 */
class LLMProviderRegistry {
    providers = new Map();
    activeProvider = null;
    register(provider) {
        this.providers.set(provider.name, provider);
    }
    unregister(name) {
        return this.providers.delete(name);
    }
    getProvider(name) {
        return this.providers.get(name);
    }
    getActiveProvider() {
        if (!this.activeProvider)
            return null;
        return this.providers.get(this.activeProvider) || null;
    }
    setActiveProvider(name) {
        if (!this.providers.has(name)) {
            throw new Error(`Provider '${name}' not registered`);
        }
        this.activeProvider = name;
        return true;
    }
    getAvailableProviders() {
        return Array.from(this.providers.keys());
    }
    async getAvailableProvidersWithStatus() {
        const result = {};
        for (const [name, provider] of this.providers.entries()) {
            try {
                result[name] = await provider.isAvailable();
            }
            catch {
                result[name] = false;
            }
        }
        return result;
    }
    async autoSelectBestProvider() {
        const providers = Array.from(this.providers.entries());
        // Check availability in order of preference
        for (const [name, provider] of providers) {
            try {
                if (await provider.isAvailable()) {
                    this.setActiveProvider(name);
                    return name;
                }
            }
            catch {
                // Continue to next provider
            }
        }
        return null;
    }
}
exports.LLMProviderRegistry = LLMProviderRegistry;
// Global registry instance
exports.llmRegistry = new LLMProviderRegistry();
//# sourceMappingURL=base-provider.js.map