/**
 * Intent Analysis Service
 * SOLID Principles: Single Responsibility - Handle user intent analysis only
 */

import { Logger } from '../../logger';
import { IIntentAnalysisService, IntentAnalysisResult } from '../interfaces';

export class IntentAnalysisService implements IIntentAnalysisService {
  private logger = Logger.getInstance();

  async analyzeUserIntent(userIntent: string): Promise<IntentAnalysisResult> {
    try {
      // Analyze the user's intent to extract what they want to build
      const intendedFunctionality = this.extractIntendedFunctionality(userIntent);
      const detectedPatterns = await this.detectPatterns(intendedFunctionality, '');
      const suggestedNames = this.generateSuggestedNames(intendedFunctionality);
      const architecturalConcerns = this.identifyArchitecturalConcerns(intendedFunctionality);
      const bestPractices = this.generateBestPractices(intendedFunctionality);

      return {
        intendedFunctionality,
        detectedPatterns,
        suggestedNames,
        architecturalConcerns,
        bestPractices
      };
    } catch (error) {
      this.logger.error('Failed to analyze user intent:', error);
      return this.getDefaultAnalysisResult(userIntent);
    }
  }

  async detectPatterns(functionality: string, projectPath: string): Promise<string[]> {
    const patterns: string[] = [];

    // Authentication patterns
    if (this.matchesPattern(functionality, ['auth', 'login', 'signin', 'authenticate'])) {
      patterns.push('Authentication');
    }

    // CRUD patterns
    if (this.matchesPattern(functionality, ['create', 'read', 'update', 'delete', 'crud'])) {
      patterns.push('CRUD Operations');
    }

    // API patterns
    if (this.matchesPattern(functionality, ['api', 'endpoint', 'route', 'rest'])) {
      patterns.push('API Design');
    }

    // Database patterns
    if (this.matchesPattern(functionality, ['database', 'db', 'query', 'model'])) {
      patterns.push('Database Access');
    }

    // Validation patterns
    if (this.matchesPattern(functionality, ['validate', 'validation', 'verify', 'check'])) {
      patterns.push('Input Validation');
    }

    // Service patterns
    if (this.matchesPattern(functionality, ['service', 'business', 'logic', 'process'])) {
      patterns.push('Service Layer');
    }

    // Security patterns
    if (this.matchesPattern(functionality, ['security', 'secure', 'encrypt', 'hash'])) {
      patterns.push('Security');
    }

    return patterns;
  }

  private extractIntendedFunctionality(userIntent: string): string {
    // Remove common noise words and extract core functionality
    const noiseWords = ['i', 'want', 'to', 'need', 'create', 'make', 'build', 'implement', 'add'];

    const words = userIntent.toLowerCase()
      .split(/\s+/)
      .filter(word => !noiseWords.includes(word) && word.length > 2);

    // Join remaining words to form intended functionality
    const functionality = words.join(' ');

    // If too short, return original
    return functionality.length > 5 ? functionality : userIntent;
  }

  private generateSuggestedNames(functionality: string): string[] {
    const names: string[] = [];
    const words = functionality.split(/\s+/).filter(word => word.length > 2);

    if (words.length === 0) return names;

    // Generate different naming conventions
    const pascalCase = words.map(word =>
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join('');

    const camelCase = words[0].toLowerCase() +
      words.slice(1).map(word =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join('');

    const snakeCase = words.map(word => word.toLowerCase()).join('_');

    // Add service/manager/handler suffixes
    names.push(`${pascalCase}Service`);
    names.push(`${pascalCase}Manager`);
    names.push(`${pascalCase}Handler`);
    names.push(`${camelCase}Function`);
    names.push(`${snakeCase}_utility`);

    return names.slice(0, 5); // Return top 5 suggestions
  }

  private identifyArchitecturalConcerns(functionality: string): string[] {
    const concerns: string[] = [];

    if (this.matchesPattern(functionality, ['auth', 'login', 'security'])) {
      concerns.push('Consider security implications and use established authentication libraries');
      concerns.push('Implement proper session management and CSRF protection');
    }

    if (this.matchesPattern(functionality, ['database', 'data', 'store'])) {
      concerns.push('Ensure proper database connection pooling and transaction handling');
      concerns.push('Consider data validation and sanitization');
    }

    if (this.matchesPattern(functionality, ['api', 'endpoint', 'route'])) {
      concerns.push('Implement proper error handling and status codes');
      concerns.push('Consider rate limiting and request validation');
    }

    if (this.matchesPattern(functionality, ['upload', 'file'])) {
      concerns.push('Validate file types and implement size limits');
      concerns.push('Consider virus scanning and secure file storage');
    }

    return concerns;
  }

  private generateBestPractices(functionality: string): string[] {
    const practices: string[] = [];

    practices.push('Follow single responsibility principle');
    practices.push('Write unit tests for new functionality');
    practices.push('Add proper error handling and logging');

    if (this.matchesPattern(functionality, ['async', 'promise', 'await'])) {
      practices.push('Use proper async/await error handling');
    }

    if (this.matchesPattern(functionality, ['config', 'setting'])) {
      practices.push('Use environment variables for configuration');
    }

    return practices;
  }

  private matchesPattern(text: string, keywords: string[]): boolean {
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword));
  }

  private getDefaultAnalysisResult(userIntent: string): IntentAnalysisResult {
    return {
      intendedFunctionality: userIntent,
      detectedPatterns: [],
      suggestedNames: [
        'NewFeature',
        'CustomFunction',
        'UserRequested'
      ],
      architecturalConcerns: [
        'Consider the impact on existing architecture'
      ],
      bestPractices: [
        'Follow existing code patterns',
        'Add proper documentation',
        'Write tests'
      ]
    };
  }
}