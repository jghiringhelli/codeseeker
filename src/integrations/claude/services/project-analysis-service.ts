/**
 * Project Analysis Service
 * SOLID Principles: Single Responsibility - Handle project analysis operations only
 */

import { Logger } from '../../../utils/logger';
import {
  IProjectAnalysisService,
  IClaudeExecutionService,
  IContextBuilderService,
  IResponseParsingService,
  AnalysisResult,
  ProjectContext,
  ClaudeCodeOptions
} from '../interfaces/index';

export class ProjectAnalysisService implements IProjectAnalysisService {
  private logger = Logger.getInstance();

  constructor(
    private executionService: IClaudeExecutionService,
    private contextBuilder: IContextBuilderService,
    private responseParser: IResponseParsingService
  ) {}

  async analyzeProject(projectPath: string, resumeToken?: string): Promise<AnalysisResult> {
    this.logger.info('🔍 Starting AI-powered project analysis');

    try {
      // Build comprehensive context
      const context = await this.contextBuilder.buildProjectContext(projectPath);

      // Create analysis prompt
      const analysisPrompt = this.createAnalysisPrompt();

      // Execute analysis
      const response = await this.executionService.executeClaudeCode(
        analysisPrompt,
        this.buildContextString(context),
        { projectPath, resumeToken }
      );

      if (!response.success) {
        throw new Error(response.error || 'Analysis execution failed');
      }

      // Parse the response
      const analysisResult = this.responseParser.parseAnalysisResult(response.data);

      // Enhance with additional analysis
      await this.enhanceAnalysisResult(analysisResult, projectPath, context);

      this.logger.info('✅ Project analysis completed successfully');
      return {
        ...analysisResult,
        resumeToken: response.resumeToken || resumeToken || ''
      };
    } catch (error) {
      this.logger.error('❌ Project analysis failed:', error);
      throw error;
    }
  }

  async buildProjectContext(projectPath: string): Promise<ProjectContext> {
    return this.contextBuilder.buildProjectContext(projectPath);
  }

  async extractUseCases(projectPath: string, context: string): Promise<AnalysisResult['useCases']> {
    try {
      this.logger.debug('🎯 Extracting use cases from project');

      const useCasePrompt = `
Analyze this codebase and extract the main business use cases. For each use case, provide:

1. **Use Case Name**: Clear, descriptive name
2. **Description**: What the use case accomplishes
3. **Actors**: Who interacts with this use case (users, systems, etc.)
4. **Preconditions**: What must be true before this use case can execute
5. **Main Steps**: The primary flow of the use case
6. **Postconditions**: What state the system is in after successful execution
7. **Business Value**: Why this use case matters to the business

Focus on the core business functionality, not technical implementation details.

Return the results as a JSON array of use case objects.
      `;

      const response = await this.executionService.executeClaudeCode(
        useCasePrompt,
        context,
        { projectPath }
      );

      if (!response.success) {
        this.logger.warn('Use case extraction failed, returning empty array');
        return [];
      }

      const parsed = this.responseParser.parseClaudeResponse(response.data);
      return Array.isArray(parsed.data) ? parsed.data : [];
    } catch (error) {
      this.logger.error('Failed to extract use cases:', error);
      return [];
    }
  }

  async assessCodeQuality(projectPath: string, context: string): Promise<AnalysisResult['codeQuality']> {
    try {
      this.logger.debug('📊 Assessing code quality');

      const qualityPrompt = `
Perform a comprehensive code quality assessment of this codebase. Analyze:

1. **Code Organization**: How well is the code structured and organized?
2. **SOLID Principles**: Adherence to Single Responsibility, Open/Closed, etc.
3. **Design Patterns**: Proper use of design patterns
4. **Error Handling**: Robustness and error handling practices
5. **Testing**: Test coverage and quality
6. **Security**: Security vulnerabilities and best practices
7. **Performance**: Potential performance issues
8. **Maintainability**: How easy is the code to maintain and extend?

Provide:
- Overall quality score (1-10, where 10 is excellent)
- List of specific issues found
- Actionable recommendations for improvement

Return as JSON with score, issues array, and recommendations array.
      `;

      const response = await this.executionService.executeClaudeCode(
        qualityPrompt,
        context,
        { projectPath }
      );

      if (!response.success) {
        this.logger.warn('Code quality assessment failed, returning default values');
        return {
          score: 5,
          issues: ['Unable to perform quality assessment'],
          recommendations: ['Review code structure and organization']
        };
      }

      const parsed = this.responseParser.parseClaudeResponse(response.data);
      return {
        score: parsed.data.score || 5,
        issues: Array.isArray(parsed.data.issues) ? parsed.data.issues : [],
        recommendations: Array.isArray(parsed.data.recommendations) ? parsed.data.recommendations : []
      };
    } catch (error) {
      this.logger.error('Failed to assess code quality:', error);
      return {
        score: 5,
        issues: ['Quality assessment failed'],
        recommendations: ['Manual code review recommended']
      };
    }
  }

  private createAnalysisPrompt(): string {
    return `
You are an expert software architect analyzing a codebase. Provide a comprehensive analysis including:

1. **Architecture Analysis**:
   - Identify the architectural pattern (MVC, microservices, layered, etc.)
   - List design patterns used
   - Identify frameworks and technologies
   - Assess adherence to SOLID principles

2. **Dependency Analysis**:
   - Map file-to-file dependencies
   - Identify circular dependencies
   - Rate relationship strength (1-10)
   - Categorize dependency types

3. **Use Case Inference**:
   - Infer business use cases from code structure
   - Identify key user journeys
   - Map actors and their interactions
   - Assess business value of each use case

4. **Code Quality Assessment**:
   - Overall quality score (1-10)
   - Identify technical debt
   - Security concerns
   - Performance bottlenecks
   - Recommendations for improvement

Return your analysis as structured JSON with the exact schema:
{
  "architecture": {
    "type": "string",
    "patterns": ["string"],
    "frameworks": ["string"],
    "designPrinciples": ["string"]
  },
  "dependencies": {
    "files": [{"file": "string", "dependencies": ["string"], "type": "import|require|reference"}],
    "relationships": [{"from": "string", "to": "string", "type": "string", "strength": 1-10}]
  },
  "useCases": [
    {
      "name": "string",
      "description": "string",
      "actors": ["string"],
      "preconditions": ["string"],
      "steps": ["string"],
      "postconditions": ["string"],
      "businessValue": "string"
    }
  ],
  "codeQuality": {
    "score": 1-10,
    "issues": ["string"],
    "recommendations": ["string"]
  }
}
`;
  }

  private buildContextString(context: ProjectContext): string {
    return `
PROJECT STRUCTURE:
${context.structure}

DEPENDENCIES:
${context.dependencies}

CONFIGURATION:
${context.configuration}

README:
${context.readme}

KEY FILES:
${context.keyFiles.join('\n')}
`;
  }

  private async enhanceAnalysisResult(
    result: AnalysisResult,
    projectPath: string,
    context: ProjectContext
  ): Promise<void> {
    try {
      // Enhance with additional insights if base analysis is sparse
      if (result.useCases.length === 0) {
        const contextString = this.buildContextString(context);
        result.useCases = await this.extractUseCases(projectPath, contextString);
      }

      if (!result.codeQuality || result.codeQuality.score === 0) {
        const contextString = this.buildContextString(context);
        result.codeQuality = await this.assessCodeQuality(projectPath, contextString);
      }

      // Add metadata
      result.architecture = result.architecture || {
        type: 'Unknown',
        patterns: [],
        frameworks: [],
        designPrinciples: []
      };

      result.dependencies = result.dependencies || {
        files: [],
        relationships: []
      };
    } catch (error) {
      this.logger.warn('Failed to enhance analysis result:', error);
      // Continue with basic result
    }
  }

  // Additional analysis methods
  async analyzeArchitecture(projectPath: string, context: string): Promise<AnalysisResult['architecture']> {
    try {
      const architecturePrompt = `
Analyze the software architecture of this codebase. Identify:

1. **Architectural Pattern**: What overall pattern does this follow? (MVC, MVP, MVVM, Layered, Microservices, etc.)
2. **Design Patterns**: What specific design patterns are used? (Singleton, Factory, Observer, etc.)
3. **Frameworks**: What frameworks and libraries are being used?
4. **SOLID Principles**: How well does the code follow SOLID principles?

Return as JSON with type, patterns, frameworks, and designPrinciples arrays.
      `;

      const response = await this.executionService.executeClaudeCode(
        architecturePrompt,
        context,
        { projectPath }
      );

      if (response.success) {
        const parsed = this.responseParser.parseClaudeResponse(response.data);
        return {
          type: parsed.data.type || 'Unknown',
          patterns: Array.isArray(parsed.data.patterns) ? parsed.data.patterns : [],
          frameworks: Array.isArray(parsed.data.frameworks) ? parsed.data.frameworks : [],
          designPrinciples: Array.isArray(parsed.data.designPrinciples) ? parsed.data.designPrinciples : []
        };
      }
    } catch (error) {
      this.logger.error('Failed to analyze architecture:', error);
    }

    return {
      type: 'Unknown',
      patterns: [],
      frameworks: [],
      designPrinciples: []
    };
  }

  async analyzeDependencies(projectPath: string, context: string): Promise<AnalysisResult['dependencies']> {
    try {
      const dependencyPrompt = `
Analyze the dependencies in this codebase:

1. **File Dependencies**: List which files depend on which other files
2. **Dependency Types**: Classify as import, require, or reference
3. **Circular Dependencies**: Identify any circular dependencies
4. **Relationship Strength**: Rate the coupling strength (1-10)

Return as JSON with files array and relationships array.
      `;

      const response = await this.executionService.executeClaudeCode(
        dependencyPrompt,
        context,
        { projectPath }
      );

      if (response.success) {
        const parsed = this.responseParser.parseClaudeResponse(response.data);
        return {
          files: Array.isArray(parsed.data.files) ? parsed.data.files : [],
          relationships: Array.isArray(parsed.data.relationships) ? parsed.data.relationships : []
        };
      }
    } catch (error) {
      this.logger.error('Failed to analyze dependencies:', error);
    }

    return {
      files: [],
      relationships: []
    };
  }
}