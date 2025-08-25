import Anthropic from '@anthropic-ai/sdk';
import { ContextOptimization } from './context-optimizer';
import { Logger } from '../utils/logger';

export interface ClaudeResponse {
  content: string;
  contextUsed?: {
    tokensUsed: number;
    filesIncluded: string[];
    optimizationStrategy: string;
  };
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface ClaudeConfig {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export class ClaudeIntegration {
  private client: Anthropic | null = null;
  private logger = Logger?.getInstance();
  private config: ClaudeConfig;

  constructor(config: ClaudeConfig = {}) {
    this.config = {
      model: 'claude-3-5-sonnet-20241022',
      maxTokens: 4096,
      temperature: 0.1,
      ...config
    };

    this?.initialize();
  }

  private initialize(): void {
    const apiKey = this.config.apiKey || process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      this.logger.warn('Anthropic API key not found. Claude integration will be simulated.');
      return;
    }

    try {
      this.client = new Anthropic({ apiKey });
      this.logger.info('Claude client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Claude client', error as Error);
    }
  }

  async askQuestion(question: string, contextOptimization: ContextOptimization): Promise<ClaudeResponse> {
    if (!this.client) {
      return this?.simulateResponse(question, contextOptimization);
    }

    try {
      const prompt = this?.buildPrompt(question, contextOptimization);
      
      this.logger.debug(`Sending request to Claude with ${prompt?.length} characters`);

      const response = await this.client.messages?.create({
        model: this.config.model!,
        max_tokens: this.config.maxTokens!,
        temperature: this.config.temperature!,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const content = response.content?.[0];
      const text = content && content?.type === 'text' ? content.text : 'Unable to parse response';

      return {
        content: text,
        contextUsed: {
          tokensUsed: this?.estimateTokens(prompt),
          filesIncluded: contextOptimization.priorityFiles?.map(f => f.path),
          optimizationStrategy: contextOptimization.strategy
        },
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens
        }
      };

    } catch (error) {
      this.logger.error('Failed to get response from Claude', error as Error);
      throw error as Error;
    }
  }

  private buildPrompt(question: string, context: ContextOptimization): string {
    let prompt = '';

    // Add project context
    if (context.projectInfo) {
      prompt += `# Project Context\n`;
      prompt += `Project Type: ${context.projectInfo.type}\n`;
      prompt += `Language: ${context.projectInfo.primaryLanguage}\n`;
      prompt += `Framework: ${context.projectInfo.framework || 'None detected'}\n\n`;
    }

    // Add relevant code files
    if (context.priorityFiles && context.priorityFiles?.length > 0) {
      prompt += `# Relevant Code Files\n\n`;
      
      for (const file of context.priorityFiles) {
        prompt += `## ${file.path}\n`;
        if (file.summary) {
          prompt += `Summary: ${file.summary}\n`;
        }
        if (file.relevantSections && file.relevantSections?.length > 0) {
          prompt += `\`\`\`${file.language || ''}\n`;
          file.relevantSections?.forEach(section => {
            prompt += `// Lines ${section.startLine}-${section.endLine}\n`;
            prompt += `${section.content}\n\n`;
          });
          prompt += `\`\`\`\n\n`;
        }
      }
    }

    // Add architectural patterns if detected
    if (context.detectedPatterns && context.detectedPatterns?.length > 0) {
      prompt += `# Detected Patterns\n`;
      context.detectedPatterns?.forEach(pattern => {
        prompt += `- ${pattern.name}: ${pattern.description}\n`;
      });
      prompt += `\n`;
    }

    // Add the user's question
    prompt += `# Question\n${question}\n\n`;
    
    // Add guidance for response
    prompt += `Please provide a comprehensive answer considering the project context and patterns above. `;
    prompt += `Focus on solutions that fit the existing architecture and coding style.`;

    return prompt;
  }

  private simulateResponse(question: string, context: ContextOptimization): ClaudeResponse {
    this.logger.info('Simulating Claude response (API key not available)');

    const simulatedContent = `# Simulated Claude Response

**Question:** ${question}

**Analysis based on your project context:**
- Project type: ${context.projectInfo?.type || 'Unknown'}
- Primary language: ${context.projectInfo?.primaryLanguage || 'Unknown'}
- Files analyzed: ${context.priorityFiles?.length || 0}

This is a simulated response because the Anthropic API key is not configured. 
To get real Claude responses:

1. Set your API key: \`export ANTHROPIC_API_KEY=your_key_here\`
2. Or pass it in the config when initializing

**Suggested approach based on context optimization:**
The system has identified ${context.priorityFiles?.length || 0} relevant files for your query.
${context?.strategy === 'smart' ? 'Smart context optimization was used to focus on the most relevant code sections.' : ''}

**Next steps:**
1. Configure your Anthropic API key for real Claude integration
2. The context has been optimized to use ${context.estimatedTokens} tokens
3. Focus areas: ${context.focusArea || 'General project analysis'}`;

    return {
      content: simulatedContent,
      contextUsed: {
        tokensUsed: context.estimatedTokens,
        filesIncluded: context.priorityFiles?.map(f => f.path) || [],
        optimizationStrategy: context.strategy
      }
    };
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text?.length / 4);
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const response = await this.client.messages?.create({
        model: this.config.model!,
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'Test connection. Respond with "OK".'
          }
        ]
      });

      const content = response.content?.[0];
      return content && content?.type === 'text' && content.text?.includes('OK');
    } catch (error) {
      this.logger.error('Claude connection test failed', error as Error);
      return false;
    }
  }
}

export default ClaudeIntegration;