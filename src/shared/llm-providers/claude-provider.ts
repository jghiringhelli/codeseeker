import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { 
    BaseLLMProvider, 
    LLMCapabilities, 
    AnalysisOptions, 
    LLMResponse,
    CodeGenerationRequest,
    CodeGenerationResponse,
    CodeReviewRequest,
    CodeReviewResponse,
    ValidationResult,
    CommandResult
} from './base-provider';

/**
 * Claude Code CLI Provider
 * Integrates with the official Claude Code CLI tool from Anthropic
 */
export class ClaudeProvider extends BaseLLMProvider {
    private claudeCommand = 'claude';
    private workingDirectory: string;

    constructor(workingDirectory: string = process.cwd()) {
        super(
            'claude-code',
            '1.0.0',
            {
                codeGeneration: true,
                codeReview: true,
                analysis: true,
                fileOperations: true,
                terminalAccess: true,
                toolIntegration: true,
                multiFileContext: true,
                projectAwareness: true
            }
        );
        this.workingDirectory = workingDirectory;
    }

    async analyze(prompt: string, options?: AnalysisOptions): Promise<LLMResponse> {
        const startTime = Date.now();
        
        try {
            // Use Claude Code's analysis capabilities
            const result = await this.executeCommand('analyze', [
                `"${prompt}"`,
                ...(options?.includeContext ? ['--with-context'] : []),
                ...(options?.maxTokens ? [`--max-tokens=${options.maxTokens}`] : [])
            ]);

            if (!result.success) {
                throw new Error(`Claude analysis failed: ${result.stderr}`);
            }

            const duration = Date.now() - startTime;
            const response: LLMResponse = {
                content: result.stdout || '',
                confidence: this.extractConfidence(result.stdout || ''),
                tokensUsed: this.estimateTokens(prompt + (result.stdout || '')),
                processingTime: duration,
                metadata: {
                    command: 'analyze',
                    options
                }
            };

            this.logUsage('analyze', response.tokensUsed, duration);
            return response;

        } catch (error) {
            this.handleError(error, 'analyze');
        }
    }

    async generateCode(request: CodeGenerationRequest): Promise<CodeGenerationResponse> {
        const startTime = Date.now();
        
        try {
            this.validateRequest(request, ['description', 'language']);

            // Prepare the generation prompt
            let prompt = `Generate ${request.language} code: ${request.description}`;
            
            if (request.framework) {
                prompt += ` using ${request.framework}`;
            }
            
            if (request.constraints?.length) {
                prompt += `\n\nConstraints:\n${request.constraints.map(c => `- ${c}`).join('\n')}`;
            }

            if (request.existingCode) {
                prompt += `\n\nExisting code context:\n\`\`\`${request.language}\n${request.existingCode}\n\`\`\``;
            }

            // Execute Claude Code generation
            const result = await this.executeCommand('generate', [
                `"${prompt}"`,
                `--language=${request.language}`,
                ...(request.framework ? [`--framework=${request.framework}`] : []),
                '--with-tests',
                '--explain'
            ]);

            if (!result.success) {
                throw new Error(`Code generation failed: ${result.stderr}`);
            }

            const duration = Date.now() - startTime;
            const output = result.stdout || '';
            
            const response: CodeGenerationResponse = {
                content: output,
                code: this.extractCode(output),
                explanation: this.extractExplanation(output),
                dependencies: this.extractDependencies(output),
                testSuggestions: this.extractTestSuggestions(output),
                confidence: this.extractConfidence(output),
                tokensUsed: this.estimateTokens(prompt + output),
                processingTime: duration,
                metadata: {
                    command: 'generate',
                    request
                }
            };

            this.logUsage('generateCode', response.tokensUsed, duration);
            return response;

        } catch (error) {
            this.handleError(error, 'generateCode');
        }
    }

    async reviewCode(request: CodeReviewRequest): Promise<CodeReviewResponse> {
        const startTime = Date.now();
        
        try {
            this.validateRequest(request, ['code', 'language']);

            // Create temporary file for code review
            const tempFile = await this.createTempFile(request.code, request.language);
            
            try {
                const result = await this.executeCommand('review', [
                    tempFile,
                    ...(request.reviewFocus ? [`--focus=${request.reviewFocus}`] : []),
                    '--format=json',
                    '--detailed'
                ]);

                if (!result.success) {
                    throw new Error(`Code review failed: ${result.stderr}`);
                }

                const duration = Date.now() - startTime;
                const output = result.stdout || '';
                
                const response: CodeReviewResponse = {
                    content: output,
                    issues: this.parseIssues(output),
                    suggestions: this.parseSuggestions(output),
                    quality: this.parseQualityScore(output),
                    confidence: this.extractConfidence(output),
                    tokensUsed: this.estimateTokens(request.code + output),
                    processingTime: duration,
                    metadata: {
                        command: 'review',
                        request
                    }
                };

                this.logUsage('reviewCode', response.tokensUsed, duration);
                return response;

            } finally {
                // Clean up temp file
                await fs.unlink(tempFile).catch(() => {});
            }

        } catch (error) {
            this.handleError(error, 'reviewCode');
        }
    }

    async isAvailable(): Promise<boolean> {
        try {
            const result = await this.executeCommand('--version', []);
            return result.success;
        } catch {
            return false;
        }
    }

    async validateConfiguration(): Promise<ValidationResult> {
        const result: ValidationResult = {
            isValid: true,
            errors: [],
            warnings: [],
            requirements: []
        };

        // Check if Claude CLI is installed
        if (!(await this.isAvailable())) {
            result.isValid = false;
            result.errors.push('Claude Code CLI is not installed or not in PATH');
            result.requirements.push('Install Claude Code CLI from https://claude.ai/code');
            return result;
        }

        // Check authentication
        try {
            const authResult = await this.executeCommand('auth', ['status']);
            if (!authResult.success) {
                result.isValid = false;
                result.errors.push('Claude Code CLI is not authenticated');
                result.requirements.push('Run: claude auth login');
            }
        } catch {
            result.warnings.push('Could not verify authentication status');
        }

        // Check for project context
        const hasClaudeConfig = await fs.access(path.join(this.workingDirectory, '.claude'))
            .then(() => true)
            .catch(() => false);

        if (!hasClaudeConfig) {
            result.warnings.push('No .claude directory found - some features may not work optimally');
            result.requirements.push('Consider running: claude init');
        }

        return result;
    }

    async executeCommand(command: string, args: string[]): Promise<CommandResult> {
        return new Promise((resolve) => {
            const childProcess = spawn(this.claudeCommand, [command, ...args], {
                cwd: this.workingDirectory,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            childProcess.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            childProcess.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            childProcess.on('close', (code) => {
                resolve({
                    success: code === 0,
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    exitCode: code || 0
                });
            });

            childProcess.on('error', (error) => {
                resolve({
                    success: false,
                    error,
                    exitCode: -1
                });
            });
        });
    }

    // Helper methods for parsing Claude Code output
    private extractCode(output: string): string {
        const codeBlockMatch = output.match(/```[\w]*\n([\s\S]*?)\n```/);
        return codeBlockMatch ? codeBlockMatch[1] : '';
    }

    private extractExplanation(output: string): string {
        // Look for explanation patterns in Claude Code output
        const explanationMatch = output.match(/## Explanation\n([\s\S]*?)(?=\n##|\n```|$)/);
        return explanationMatch ? explanationMatch[1].trim() : '';
    }

    private extractDependencies(output: string): string[] {
        const depsMatch = output.match(/## Dependencies\n([\s\S]*?)(?=\n##|\n```|$)/);
        if (!depsMatch) return [];
        
        return depsMatch[1]
            .split('\n')
            .filter(line => line.trim().startsWith('-'))
            .map(line => line.replace(/^-\s*/, '').trim());
    }

    private extractTestSuggestions(output: string): string[] {
        const testsMatch = output.match(/## Test Suggestions\n([\s\S]*?)(?=\n##|\n```|$)/);
        if (!testsMatch) return [];
        
        return testsMatch[1]
            .split('\n')
            .filter(line => line.trim().startsWith('-'))
            .map(line => line.replace(/^-\s*/, '').trim());
    }

    private extractConfidence(output: string): number {
        // Look for confidence indicators in Claude output
        const confidenceMatch = output.match(/confidence[:\s]*(\d+(?:\.\d+)?)/i);
        return confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.8; // Default confidence
    }

    private parseIssues(output: string): any[] {
        // Parse JSON output or extract issues from text
        try {
            const json = JSON.parse(output);
            return json.issues || [];
        } catch {
            // Fallback to text parsing
            return [];
        }
    }

    private parseSuggestions(output: string): any[] {
        try {
            const json = JSON.parse(output);
            return json.suggestions || [];
        } catch {
            return [];
        }
    }

    private parseQualityScore(output: string): any {
        try {
            const json = JSON.parse(output);
            return json.quality || {
                overall: 75,
                maintainability: 75,
                reliability: 75,
                security: 75,
                performance: 75
            };
        } catch {
            return {
                overall: 75,
                maintainability: 75,
                reliability: 75,
                security: 75,
                performance: 75
            };
        }
    }

    private async createTempFile(code: string, language: string): Promise<string> {
        const ext = this.getFileExtension(language);
        const tempPath = path.join(require('os').tmpdir(), `claude-review-${Date.now()}.${ext}`);
        await fs.writeFile(tempPath, code);
        return tempPath;
    }

    private getFileExtension(language: string): string {
        const extensions: Record<string, string> = {
            javascript: 'js',
            typescript: 'ts',
            python: 'py',
            java: 'java',
            csharp: 'cs',
            cpp: 'cpp',
            c: 'c',
            go: 'go',
            rust: 'rs',
            php: 'php',
            ruby: 'rb'
        };
        
        return extensions[language.toLowerCase()] || 'txt';
    }

    private estimateTokens(text: string): number {
        // Rough estimation: ~4 characters per token
        return Math.ceil(text.length / 4);
    }
}

export default ClaudeProvider;