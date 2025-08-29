#!/usr/bin/env node

import { Command } from 'commander';
import { 
    multiLLMManager, 
    autoSelectProvider, 
    getProviderStatus, 
    switchProvider, 
    showProviderHelp 
} from '../shared/llm-providers';

/**
 * Multi-LLM CLI Interface for CodeMind
 * 
 * This CLI demonstrates how to use CodeMind with different LLM providers.
 * It automatically detects available providers (Claude, GPT, Gemini, Grok)
 * and provides a unified interface regardless of which LLM is active.
 */

const program = new Command();

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
            
            const status = await getProviderStatus();
            const active = multiLLMManager.getActiveProvider();
            
            console.log('📋 Available LLM Providers:');
            console.log('═'.repeat(50));
            
            Object.entries(status).forEach(([name, info]: [string, any]) => {
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
            
        } catch (error) {
            console.error('❌ Error checking providers:', (error as Error).message);
        }
    });

program
    .command('provider auto')
    .description('Automatically select the best available provider')
    .action(async () => {
        try {
            const selected = await autoSelectProvider();
            
            if (selected) {
                console.log(`🎯 Successfully selected: ${selected}`);
                console.log('✅ You can now use CodeMind commands with this provider');
            } else {
                console.log('❌ No suitable providers found');
                showProviderHelp();
            }
        } catch (error) {
            console.error('❌ Error selecting provider:', (error as Error).message);
        }
    });

program
    .command('provider switch <name>')
    .description('Switch to a specific provider')
    .action(async (name: string) => {
        try {
            await switchProvider(name);
            console.log(`🔄 Successfully switched to: ${name}`);
        } catch (error) {
            console.error('❌ Error switching provider:', (error as Error).message);
        }
    });

program
    .command('provider help')
    .description('Show setup help for all providers')
    .action(() => {
        showProviderHelp();
    });

program
    .command('provider status')
    .description('Show detailed status of all providers')
    .action(async () => {
        try {
            const status = await getProviderStatus();
            
            console.log('📊 Detailed Provider Status');
            console.log('═'.repeat(50));
            
            Object.entries(status).forEach(([name, info]: [string, any]) => {
                console.log(`\n🤖 ${name}:`);
                console.log(`  Available: ${info.available ? '✅ Yes' : '❌ No'}`);
                console.log(`  Valid Config: ${info.validation.isValid ? '✅ Yes' : '❌ No'}`);
                
                console.log('\n  Capabilities:');
                Object.entries(info.capabilities).forEach(([cap, supported]) => {
                    console.log(`    ${cap}: ${supported ? '✅' : '❌'}`);
                });
                
                if (info.validation.errors?.length) {
                    console.log('\n  ❌ Errors:');
                    info.validation.errors.forEach((error: string) => {
                        console.log(`    - ${error}`);
                    });
                }
                
                if (info.validation.warnings?.length) {
                    console.log('\n  ⚠️  Warnings:');
                    info.validation.warnings.forEach((warning: string) => {
                        console.log(`    - ${warning}`);
                    });
                }
                
                if (info.validation.requirements?.length) {
                    console.log('\n  📋 Requirements:');
                    info.validation.requirements.forEach((req: string) => {
                        console.log(`    - ${req}`);
                    });
                }
            });
        } catch (error) {
            console.error('❌ Error getting status:', (error as Error).message);
        }
    });

// Analysis commands that work with any provider
program
    .command('analyze <prompt>')
    .description('Analyze code or project with the active LLM provider')
    .option('-c, --context', 'include project context')
    .option('-t, --tokens <number>', 'maximum tokens', '4000')
    .action(async (prompt: string, options: any) => {
        try {
            const active = multiLLMManager.getActiveProvider();
            if (!active) {
                console.log('❌ No active provider. Run: codemind-multi-llm provider auto');
                return;
            }
            
            console.log(`🤖 Using ${active} for analysis...\n`);
            
            const result = await multiLLMManager.analyze(prompt, {
                includeContext: options.context,
                maxTokens: parseInt(options.tokens)
            });
            
            console.log('📋 Analysis Result:');
            console.log('═'.repeat(50));
            console.log(result.content);
            console.log(`\n📊 Tokens used: ${result.tokensUsed}`);
            console.log(`⏱️  Processing time: ${result.processingTime}ms`);
            console.log(`🎯 Confidence: ${Math.round(result.confidence * 100)}%`);
            
        } catch (error) {
            console.error('❌ Analysis failed:', (error as Error).message);
        }
    });

program
    .command('generate <description>')
    .description('Generate code with the active LLM provider')
    .option('-l, --language <lang>', 'programming language', 'typescript')
    .option('-f, --framework <framework>', 'framework to use')
    .option('-t, --tests', 'include test suggestions')
    .action(async (description: string, options: any) => {
        try {
            const active = multiLLMManager.getActiveProvider();
            if (!active) {
                console.log('❌ No active provider. Run: codemind-multi-llm provider auto');
                return;
            }
            
            console.log(`🤖 Using ${active} for code generation...\n`);
            
            const result = await multiLLMManager.generateCode({
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
                result.dependencies.forEach((dep: string) => {
                    console.log(`  - ${dep}`);
                });
            }
            
            if (result.testSuggestions.length) {
                console.log('\n🧪 Test Suggestions:');
                result.testSuggestions.forEach((test: string) => {
                    console.log(`  - ${test}`);
                });
            }
            
            console.log(`\n📊 Tokens used: ${result.tokensUsed}`);
            console.log(`⏱️  Processing time: ${result.processingTime}ms`);
            
        } catch (error) {
            console.error('❌ Code generation failed:', (error as Error).message);
        }
    });

program
    .command('review <file>')
    .description('Review code with the active LLM provider')
    .option('-f, --focus <focus>', 'review focus: security, performance, maintainability, all', 'all')
    .option('-l, --language <lang>', 'programming language')
    .action(async (file: string, options: any) => {
        try {
            const active = multiLLMManager.getActiveProvider();
            if (!active) {
                console.log('❌ No active provider. Run: codemind-multi-llm provider auto');
                return;
            }
            
            console.log(`🤖 Using ${active} for code review...\n`);
            
            const fs = await import('fs/promises');
            const code = await fs.readFile(file, 'utf-8');
            
            const result = await multiLLMManager.reviewCode({
                code,
                language: options.language || 'auto-detect',
                reviewFocus: options.focus
            });
            
            console.log('📋 Code Review Result:');
            console.log('═'.repeat(50));
            
            console.log('\n🎯 Quality Score:');
            Object.entries(result.quality).forEach(([metric, score]: [string, any]) => {
                console.log(`  ${metric}: ${score}/100`);
            });
            
            if (result.issues.length) {
                console.log('\n⚠️  Issues Found:');
                result.issues.forEach((issue: any) => {
                    console.log(`  ${issue.severity.toUpperCase()}: Line ${issue.line} - ${issue.message}`);
                });
            }
            
            if (result.suggestions.length) {
                console.log('\n💡 Suggestions:');
                result.suggestions.forEach((suggestion: any) => {
                    console.log(`  - ${suggestion.title}: ${suggestion.description}`);
                });
            }
            
            console.log(`\n📊 Tokens used: ${result.tokensUsed}`);
            console.log(`⏱️  Processing time: ${result.processingTime}ms`);
            
        } catch (error) {
            console.error('❌ Code review failed:', (error as Error).message);
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
        
        const status = await getProviderStatus();
        const availableCount = Object.values(status).filter((s: any) => s.available).length;
        
        if (availableCount === 0) {
            console.log('❌ No providers currently available.');
            showProviderHelp();
        } else {
            console.log(`✅ Found ${availableCount} available provider(s)!`);
            
            // Try to auto-select and run a simple demo
            const selected = await autoSelectProvider();
            if (selected) {
                console.log(`\n🎯 Selected ${selected} for demo...\n`);
                
                try {
                    const result = await multiLLMManager.analyze(
                        'Analyze this simple TypeScript function: function add(a: number, b: number) { return a + b; }'
                    );
                    
                    console.log('📋 Demo Analysis Result:');
                    console.log('═'.repeat(40));
                    console.log(result.content.substring(0, 300) + '...');
                    console.log(`\n✨ Success! ${selected} is working correctly.`);
                    
                } catch (error) {
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
    const active = multiLLMManager.getActiveProvider();
    if (!active) {
        // Try to auto-select silently
        try {
            await autoSelectProvider();
        } catch {
            // Ignore errors during auto-selection
        }
    }
});

program.parse();

export default program;