#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const llm_providers_1 = require("../shared/llm-providers");
/**
 * Multi-LLM CLI Interface for CodeMind
 *
 * This CLI demonstrates how to use CodeMind with different LLM providers.
 * It automatically detects available providers (Claude, GPT, Gemini, Grok)
 * and provides a unified interface regardless of which LLM is active.
 */
const program = new commander_1.Command();
program
    .name('codemind-multi-llm')
    .description('Multi-LLM CLI for CodeMind - works with Claude, GPT, Gemini, and Grok')
    .version('2.0.0');
// Provider management commands
program
    .command('provider')
    .description('Manage LLM providers')
    .action(() => {
    // Show provider subcommands
    console.log(`
🤖 CodeMind Multi-LLM Provider Management

Available commands:
  provider list       - List all available providers and their status
  provider auto       - Automatically select the best available provider  
  provider switch <name> - Switch to a specific provider
  provider help       - Show setup help for all providers
  provider status     - Show detailed status of all providers
        `);
});
program
    .command('provider list')
    .alias('providers')
    .description('List all available providers and their status')
    .action(async () => {
    try {
        console.log('🔍 Checking LLM provider availability...\n');
        const status = await (0, llm_providers_1.getProviderStatus)();
        const active = llm_providers_1.multiLLMManager.getActiveProvider();
        console.log('📋 Available LLM Providers:');
        console.log('═'.repeat(50));
        Object.entries(status).forEach(([name, info]) => {
            const isActive = name === active ? '🎯 ACTIVE' : '';
            const isAvailable = info.available ? '✅' : '❌';
            const isValid = info.validation.isValid ? '✅' : '⚠️';
            console.log(`\n${isActive} ${name}`);
            console.log(`  Available: ${isAvailable}`);
            console.log(`  Configured: ${isValid}`);
            if (!info.validation.isValid) {
                console.log(`  Issues: ${info.validation.errors.join(', ')}`);
            }
            if (info.validation.requirements?.length) {
                console.log(`  Requirements: ${info.validation.requirements.join(', ')}`);
            }
        });
        if (!active) {
            console.log('\n⚠️  No active provider. Run: codemind-multi-llm provider auto');
        }
    }
    catch (error) {
        console.error('❌ Error checking providers:', error.message);
    }
});
program
    .command('provider auto')
    .description('Automatically select the best available provider')
    .action(async () => {
    try {
        const selected = await (0, llm_providers_1.autoSelectProvider)();
        if (selected) {
            console.log(`🎯 Successfully selected: ${selected}`);
            console.log('✅ You can now use CodeMind commands with this provider');
        }
        else {
            console.log('❌ No suitable providers found');
            (0, llm_providers_1.showProviderHelp)();
        }
    }
    catch (error) {
        console.error('❌ Error selecting provider:', error.message);
    }
});
program
    .command('provider switch <name>')
    .description('Switch to a specific provider')
    .action(async (name) => {
    try {
        await (0, llm_providers_1.switchProvider)(name);
        console.log(`🔄 Successfully switched to: ${name}`);
    }
    catch (error) {
        console.error('❌ Error switching provider:', error.message);
    }
});
program
    .command('provider help')
    .description('Show setup help for all providers')
    .action(() => {
    (0, llm_providers_1.showProviderHelp)();
});
program
    .command('provider status')
    .description('Show detailed status of all providers')
    .action(async () => {
    try {
        const status = await (0, llm_providers_1.getProviderStatus)();
        console.log('📊 Detailed Provider Status');
        console.log('═'.repeat(50));
        Object.entries(status).forEach(([name, info]) => {
            console.log(`\n🤖 ${name}:`);
            console.log(`  Available: ${info.available ? '✅ Yes' : '❌ No'}`);
            console.log(`  Valid Config: ${info.validation.isValid ? '✅ Yes' : '❌ No'}`);
            console.log('\n  Capabilities:');
            Object.entries(info.capabilities).forEach(([cap, supported]) => {
                console.log(`    ${cap}: ${supported ? '✅' : '❌'}`);
            });
            if (info.validation.errors?.length) {
                console.log('\n  ❌ Errors:');
                info.validation.errors.forEach((error) => {
                    console.log(`    - ${error}`);
                });
            }
            if (info.validation.warnings?.length) {
                console.log('\n  ⚠️  Warnings:');
                info.validation.warnings.forEach((warning) => {
                    console.log(`    - ${warning}`);
                });
            }
            if (info.validation.requirements?.length) {
                console.log('\n  📋 Requirements:');
                info.validation.requirements.forEach((req) => {
                    console.log(`    - ${req}`);
                });
            }
        });
    }
    catch (error) {
        console.error('❌ Error getting status:', error.message);
    }
});
// Analysis commands that work with any provider
program
    .command('analyze <prompt>')
    .description('Analyze code or project with the active LLM provider')
    .option('-c, --context', 'include project context')
    .option('-t, --tokens <number>', 'maximum tokens', '4000')
    .action(async (prompt, options) => {
    try {
        const active = llm_providers_1.multiLLMManager.getActiveProvider();
        if (!active) {
            console.log('❌ No active provider. Run: codemind-multi-llm provider auto');
            return;
        }
        console.log(`🤖 Using ${active} for analysis...\n`);
        const result = await llm_providers_1.multiLLMManager.analyze(prompt, {
            includeContext: options.context,
            maxTokens: parseInt(options.tokens)
        });
        console.log('📋 Analysis Result:');
        console.log('═'.repeat(50));
        console.log(result.content);
        console.log(`\n📊 Tokens used: ${result.tokensUsed}`);
        console.log(`⏱️  Processing time: ${result.processingTime}ms`);
        console.log(`🎯 Confidence: ${Math.round(result.confidence * 100)}%`);
    }
    catch (error) {
        console.error('❌ Analysis failed:', error.message);
    }
});
program
    .command('generate <description>')
    .description('Generate code with the active LLM provider')
    .option('-l, --language <lang>', 'programming language', 'typescript')
    .option('-f, --framework <framework>', 'framework to use')
    .option('-t, --tests', 'include test suggestions')
    .action(async (description, options) => {
    try {
        const active = llm_providers_1.multiLLMManager.getActiveProvider();
        if (!active) {
            console.log('❌ No active provider. Run: codemind-multi-llm provider auto');
            return;
        }
        console.log(`🤖 Using ${active} for code generation...\n`);
        const result = await llm_providers_1.multiLLMManager.generateCode({
            description,
            language: options.language,
            framework: options.framework,
            includeTests: options.tests
        });
        console.log('💻 Generated Code:');
        console.log('═'.repeat(50));
        console.log(result.code);
        if (result.explanation) {
            console.log('\n📝 Explanation:');
            console.log(result.explanation);
        }
        if (result.dependencies.length) {
            console.log('\n📦 Dependencies:');
            result.dependencies.forEach((dep) => {
                console.log(`  - ${dep}`);
            });
        }
        if (result.testSuggestions.length) {
            console.log('\n🧪 Test Suggestions:');
            result.testSuggestions.forEach((test) => {
                console.log(`  - ${test}`);
            });
        }
        console.log(`\n📊 Tokens used: ${result.tokensUsed}`);
        console.log(`⏱️  Processing time: ${result.processingTime}ms`);
    }
    catch (error) {
        console.error('❌ Code generation failed:', error.message);
    }
});
program
    .command('review <file>')
    .description('Review code with the active LLM provider')
    .option('-f, --focus <focus>', 'review focus: security, performance, maintainability, all', 'all')
    .option('-l, --language <lang>', 'programming language')
    .action(async (file, options) => {
    try {
        const active = llm_providers_1.multiLLMManager.getActiveProvider();
        if (!active) {
            console.log('❌ No active provider. Run: codemind-multi-llm provider auto');
            return;
        }
        console.log(`🤖 Using ${active} for code review...\n`);
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const code = await fs.readFile(file, 'utf-8');
        const result = await llm_providers_1.multiLLMManager.reviewCode({
            code,
            language: options.language || 'auto-detect',
            reviewFocus: options.focus
        });
        console.log('📋 Code Review Result:');
        console.log('═'.repeat(50));
        console.log('\n🎯 Quality Score:');
        Object.entries(result.quality).forEach(([metric, score]) => {
            console.log(`  ${metric}: ${score}/100`);
        });
        if (result.issues.length) {
            console.log('\n⚠️  Issues Found:');
            result.issues.forEach((issue) => {
                console.log(`  ${issue.severity.toUpperCase()}: Line ${issue.line} - ${issue.message}`);
            });
        }
        if (result.suggestions.length) {
            console.log('\n💡 Suggestions:');
            result.suggestions.forEach((suggestion) => {
                console.log(`  - ${suggestion.title}: ${suggestion.description}`);
            });
        }
        console.log(`\n📊 Tokens used: ${result.tokensUsed}`);
        console.log(`⏱️  Processing time: ${result.processingTime}ms`);
    }
    catch (error) {
        console.error('❌ Code review failed:', error.message);
    }
});
// Demo command to show off multi-provider capabilities
program
    .command('demo')
    .description('Demonstrate multi-provider capabilities')
    .action(async () => {
    console.log(`
🎭 CodeMind Multi-LLM Demo
═════════════════════════

This demo shows how CodeMind seamlessly works with different LLM providers.
The same commands work regardless of whether you're using:

🤖 Claude Code (Anthropic)
💬 ChatGPT CLI (OpenAI) 
🧠 Gemini CLI (Google)
🎭 Grok CLI (xAI)

Let's check what's available on your system...
        `);
    const status = await (0, llm_providers_1.getProviderStatus)();
    const availableCount = Object.values(status).filter((s) => s.available).length;
    if (availableCount === 0) {
        console.log('❌ No providers currently available.');
        (0, llm_providers_1.showProviderHelp)();
    }
    else {
        console.log(`✅ Found ${availableCount} available provider(s)!`);
        // Try to auto-select and run a simple demo
        const selected = await (0, llm_providers_1.autoSelectProvider)();
        if (selected) {
            console.log(`\n🎯 Selected ${selected} for demo...\n`);
            try {
                const result = await llm_providers_1.multiLLMManager.analyze('Analyze this simple TypeScript function: function add(a: number, b: number) { return a + b; }');
                console.log('📋 Demo Analysis Result:');
                console.log('═'.repeat(40));
                console.log(result.content.substring(0, 300) + '...');
                console.log(`\n✨ Success! ${selected} is working correctly.`);
            }
            catch (error) {
                console.log(`⚠️  ${selected} is available but encountered an issue during demo.`);
            }
        }
    }
    console.log(`\n🚀 Next steps:
1. Make sure you have at least one LLM CLI tool installed
2. Run: codemind-multi-llm provider auto
3. Start using: codemind-multi-llm analyze "your request"
        `);
});
// Initialize and auto-select provider on startup
program.hook('preAction', async () => {
    const active = llm_providers_1.multiLLMManager.getActiveProvider();
    if (!active) {
        // Try to auto-select silently
        try {
            await (0, llm_providers_1.autoSelectProvider)();
        }
        catch {
            // Ignore errors during auto-selection
        }
    }
});
program.parse();
exports.default = program;
//# sourceMappingURL=multi-llm-cli.js.map