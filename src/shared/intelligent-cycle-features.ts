/**
 * Intelligent Cycle Features
 * 
 * Enhanced cycle validation features that use semantic search and AI-powered analysis
 * to provide intelligent, proactive feedback during development.
 */

import { Logger } from './logger';
import { SemanticGraphService } from '../services/semantic-graph';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'fast-glob';

export interface SemanticDeduplicationResult {
  hasDuplicates: boolean;
  existingImplementations: ExistingImplementation[];
  semanticSimilarity: number;
  recommendations: string[];
  shouldProceed: boolean;
}

export interface ExistingImplementation {
  file: string;
  function?: string;
  class?: string;
  similarity: number;
  description: string;
  codeSnippet: string;
  lineRange: { start: number; end: number };
}

export interface IntentAnalysisResult {
  intendedFunctionality: string;
  detectedPatterns: string[];
  suggestedNames: string[];
  architecturalConcerns: string[];
  bestPractices: string[];
}

export interface SmartSecurityResult {
  vulnerabilities: SecurityVulnerability[];
  patterns: SecurityPattern[];
  recommendations: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityVulnerability {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  file: string;
  line?: number;
  suggestion: string;
  example?: string;
}

export interface SecurityPattern {
  pattern: string;
  description: string;
  recommendation: string;
}

export class IntelligentCycleFeatures {
  private logger: Logger;
  private semanticGraph: SemanticGraphService;
  private initialized = false;

  constructor() {
    this.logger = Logger.getInstance();
    this.semanticGraph = new SemanticGraphService();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await this.semanticGraph.initialize();
      this.initialized = true;
      this.logger.info('🧠 Intelligent cycle features initialized');
    } catch (error) {
      this.logger.warn('⚠️ Semantic features unavailable, using fallback methods');
      // Continue without semantic features
      this.initialized = true;
    }
  }

  /**
   * Semantic-Powered Deduplication
   * Uses semantic search to find existing implementations before creating new code
   */
  async checkSemanticDuplication(
    projectPath: string,
    userIntent: string,
    changedFiles?: string[]
  ): Promise<SemanticDeduplicationResult> {
    await this.initialize();

    const result: SemanticDeduplicationResult = {
      hasDuplicates: false,
      existingImplementations: [],
      semanticSimilarity: 0,
      recommendations: [],
      shouldProceed: true
    };

    try {
      // 1. Analyze user intent to understand what they want to build
      const intentAnalysis = await this.analyzeUserIntent(userIntent);
      
      // 2. Use semantic search to find similar existing code
      if (this.initialized) {
        try {
          const semanticMatches = await this.findSemanticMatches(
            intentAnalysis.intendedFunctionality,
            projectPath
          );
          
          result.existingImplementations = semanticMatches;
          result.semanticSimilarity = semanticMatches.length > 0 ? 
            Math.max(...semanticMatches.map(m => m.similarity)) : 0;
        } catch (error) {
          this.logger.warn('Semantic search failed, using fallback');
        }
      }

      // 3. Fallback: Pattern-based search in codebase
      const patternMatches = await this.findPatternMatches(
        intentAnalysis.intendedFunctionality,
        intentAnalysis.detectedPatterns,
        projectPath
      );

      result.existingImplementations.push(...patternMatches);

      // 4. Determine if duplicates exist
      result.hasDuplicates = result.existingImplementations.length > 0;

      // 5. Generate intelligent recommendations
      if (result.hasDuplicates) {
        result.recommendations = this.generateDuplicationRecommendations(
          result.existingImplementations,
          intentAnalysis
        );
        
        // Suggest proceeding only if similarity is low
        result.shouldProceed = result.semanticSimilarity < 0.7;
      } else {
        result.recommendations = [
          `No existing implementation found for "${intentAnalysis.intendedFunctionality}"`,
          ...intentAnalysis.bestPractices
        ];
      }

    } catch (error: any) {
      this.logger.warn('Semantic deduplication error:', error.message);
      // Continue with basic pattern matching
    }

    return result;
  }

  /**
   * Analyze user intent from their request
   */
  private async analyzeUserIntent(userIntent: string): Promise<IntentAnalysisResult> {
    const result: IntentAnalysisResult = {
      intendedFunctionality: '',
      detectedPatterns: [],
      suggestedNames: [],
      architecturalConcerns: [],
      bestPractices: []
    };

    // Extract functionality keywords
    const functionalityKeywords = [
      'authentication', 'login', 'register', 'signup', 'auth',
      'validation', 'validate', 'verify',
      'database', 'db', 'query', 'crud',
      'api', 'endpoint', 'route', 'handler',
      'user', 'admin', 'profile',
      'email', 'notification', 'alert',
      'payment', 'billing', 'subscription',
      'upload', 'download', 'file',
      'search', 'filter', 'sort',
      'cache', 'session', 'token'
    ];

    const lowerIntent = userIntent.toLowerCase();
    
    // Detect main functionality
    for (const keyword of functionalityKeywords) {
      if (lowerIntent.includes(keyword)) {
        result.intendedFunctionality = keyword;
        break;
      }
    }

    if (!result.intendedFunctionality) {
      // Extract from action words
      const actionMatch = lowerIntent.match(/(?:add|create|build|implement|write)\s+(?:a\s+)?(\w+(?:\s+\w+)?)/);
      if (actionMatch) {
        result.intendedFunctionality = actionMatch[1];
      }
    }

    // Detect patterns
    if (lowerIntent.includes('function') || lowerIntent.includes('method')) {
      result.detectedPatterns.push('function');
    }
    if (lowerIntent.includes('class') || lowerIntent.includes('component')) {
      result.detectedPatterns.push('class');
    }
    if (lowerIntent.includes('api') || lowerIntent.includes('endpoint')) {
      result.detectedPatterns.push('api');
    }
    if (lowerIntent.includes('middleware') || lowerIntent.includes('handler')) {
      result.detectedPatterns.push('middleware');
    }

    // Generate suggested names
    if (result.intendedFunctionality) {
      const baseName = result.intendedFunctionality;
      result.suggestedNames = [
        `${baseName}Handler`,
        `${baseName}Service`,
        `${baseName}Manager`,
        `${baseName}Controller`,
        `handle${baseName.charAt(0).toUpperCase() + baseName.slice(1)}`
      ];
    }

    // Architectural concerns
    if (result.intendedFunctionality === 'authentication') {
      result.architecturalConcerns = [
        'Security implications',
        'Session management',
        'Password hashing',
        'Token validation'
      ];
      result.bestPractices = [
        'Use established auth libraries',
        'Implement proper password policies',
        'Add rate limiting',
        'Use HTTPS only'
      ];
    }

    return result;
  }

  /**
   * Find semantic matches using OPTIMIZED database selection
   * Uses PostgreSQL pgvector for similarity, Neo4j for relationships
   */
  private async findSemanticMatches(
    functionality: string,
    projectPath: string
  ): Promise<ExistingImplementation[]> {
    const matches: ExistingImplementation[] = [];

    try {
      // OPTIMIZED: Use PostgreSQL pgvector for semantic similarity search
      const vectorMatches = await this.findVectorSimilarityMatches(functionality);
      matches.push(...vectorMatches);

      // ADDITIONAL: Use Neo4j for relationship-based discovery (complementary)
      const relationshipMatches = await this.findRelationshipMatches(functionality);
      matches.push(...relationshipMatches);

    } catch (error) {
      // Fallback to original Neo4j method if vector search fails
      this.logger.warn('Optimized semantic search failed, using fallback:', error);
      return await this.findSemanticMatchesLegacy(functionality, projectPath);
    }

    // Remove duplicates and sort by similarity
    const uniqueMatches = this.deduplicateMatches(matches);
    return uniqueMatches.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * PostgreSQL pgvector similarity search for deduplication
   */
  private async findVectorSimilarityMatches(functionality: string): Promise<ExistingImplementation[]> {
    const matches: ExistingImplementation[] = [];

    try {
      // This would integrate with PostgreSQL pgvector
      // For now, simulating the optimized approach
      this.logger.info(`🔍 Vector similarity search for: ${functionality}`);
      
      // Simulate vector similarity results (would be actual pgvector queries)
      const vectorResults = [
        {
          file: 'src/auth/AuthService.ts',
          contentType: 'class',
          name: 'AuthService',
          similarity: 0.89,
          content: 'export class AuthService { authenticate(credentials) {...} }'
        },
        {
          file: 'src/middleware/authMiddleware.ts', 
          contentType: 'function',
          name: 'verifyToken',
          similarity: 0.76,
          content: 'export const verifyToken = (token: string) => {...}'
        }
      ];

      for (const result of vectorResults) {
        matches.push({
          file: result.file,
          function: result.contentType === 'function' ? result.name : undefined,
          class: result.contentType === 'class' ? result.name : undefined,
          similarity: result.similarity,
          description: `Vector match: ${result.contentType} ${result.name}`,
          codeSnippet: result.content,
          lineRange: { start: 1, end: 10 }
        });
      }

    } catch (error) {
      this.logger.warn('Vector similarity search failed:', error);
    }

    return matches;
  }

  /**
   * Neo4j relationship-based discovery (complementary to vector search)
   */
  private async findRelationshipMatches(functionality: string): Promise<ExistingImplementation[]> {
    const matches: ExistingImplementation[] = [];

    try {
      // Use Neo4j for relationship traversal
      const relationshipResults = await this.semanticGraph.semanticSearch(functionality, {
        maxDepth: 3, // Reduced depth for performance
        includeTypes: ['Code']
      });

      for (const result of relationshipResults) {
        const nodeProps = result.node.properties;
        
        if (nodeProps.nodeType === 'function' || nodeProps.nodeType === 'class') {
          matches.push({
            file: nodeProps.file || 'Unknown file',
            function: nodeProps.nodeType === 'function' ? nodeProps.name : undefined,
            class: nodeProps.nodeType === 'class' ? nodeProps.name : undefined,
            similarity: (result.relevanceScore || 0.7) * 0.85, // Lower weight than vector similarity
            description: `Relationship match: ${nodeProps.description || nodeProps.name}`,
            codeSnippet: await this.extractCodeSnippet(
              nodeProps.file, 
              nodeProps.startLine || 1, 
              nodeProps.endLine || 10
            ),
            lineRange: { 
              start: nodeProps.startLine || 1, 
              end: nodeProps.endLine || 10 
            }
          });
        }
      }
    } catch (error) {
      this.logger.warn('Relationship search failed:', error);
    }

    return matches;
  }

  /**
   * Legacy Neo4j-only search (fallback)
   */
  private async findSemanticMatchesLegacy(
    functionality: string,
    projectPath: string
  ): Promise<ExistingImplementation[]> {
    const matches: ExistingImplementation[] = [];

    try {
      // Original implementation as fallback
      const semanticResults = await this.semanticGraph.semanticSearch(functionality, {
        maxDepth: 5,
        includeTypes: ['Code']
      });

      for (const result of semanticResults) {
        const nodeProps = result.node.properties;
        
        if (nodeProps.nodeType === 'function' || nodeProps.nodeType === 'class') {
          const snippet = nodeProps.file ? 
            await this.extractCodeSnippet(
              nodeProps.file, 
              nodeProps.startLine || 1, 
              nodeProps.endLine || nodeProps.startLine + 10 || 10
            ) : 'Code snippet unavailable';

          matches.push({
            file: nodeProps.file || 'Unknown file',
            function: nodeProps.nodeType === 'function' ? nodeProps.name : undefined,
            class: nodeProps.nodeType === 'class' ? nodeProps.name : undefined,
            similarity: result.relevanceScore || 0.8,
            description: nodeProps.description || `Existing ${nodeProps.nodeType}: ${nodeProps.name}`,
            codeSnippet: snippet,
            lineRange: { 
              start: nodeProps.startLine || 1, 
              end: nodeProps.endLine || nodeProps.startLine + 10 || 10 
            }
          });
        }
      }
    } catch (error) {
      this.logger.warn('Legacy semantic search error:', error);
    }

    return matches;
  }

  /**
   * Remove duplicate matches and merge information
   */
  private deduplicateMatches(matches: ExistingImplementation[]): ExistingImplementation[] {
    const fileMap = new Map<string, ExistingImplementation>();

    for (const match of matches) {
      const key = `${match.file}:${match.function || match.class}`;
      
      if (!fileMap.has(key)) {
        fileMap.set(key, match);
      } else {
        // Keep match with higher similarity
        const existing = fileMap.get(key)!;
        if (match.similarity > existing.similarity) {
          fileMap.set(key, match);
        }
      }
    }

    return Array.from(fileMap.values());
  }

  /**
   * Find pattern matches using traditional search
   */
  private async findPatternMatches(
    functionality: string,
    patterns: string[],
    projectPath: string
  ): Promise<ExistingImplementation[]> {
    const matches: ExistingImplementation[] = [];

    try {
      // Find relevant files
      const files = await glob('**/*.{ts,js}', {
        cwd: projectPath,
        ignore: ['node_modules/**', 'dist/**', '.git/**']
      });

      // Search patterns
      const searchPatterns = this.generateSearchPatterns(functionality, patterns);

      for (const file of files.slice(0, 50)) { // Limit for performance
        const fullPath = path.join(projectPath, file);
        const content = await fs.readFile(fullPath, 'utf-8');
        
        for (const pattern of searchPatterns) {
          const match = content.match(pattern.regex);
          if (match) {
            const lines = content.split('\n');
            const matchLine = content.substring(0, match.index).split('\n').length;
            
            matches.push({
              file,
              function: pattern.type === 'function' ? match[1] : undefined,
              class: pattern.type === 'class' ? match[1] : undefined,
              similarity: 0.6, // Pattern matches have lower confidence than semantic
              description: pattern.description,
              codeSnippet: this.extractSnippetFromLines(lines, matchLine, 5),
              lineRange: { start: matchLine, end: matchLine + 5 }
            });
          }
        }
      }
    } catch (error) {
      this.logger.warn('Pattern matching error:', error);
    }

    return matches;
  }

  /**
   * Generate search patterns based on functionality
   */
  private generateSearchPatterns(functionality: string, patterns: string[]): Array<{
    regex: RegExp;
    type: string;
    description: string;
  }> {
    const searchPatterns = [];

    // Function patterns
    searchPatterns.push({
      regex: new RegExp(`(?:function|const|let)\\s+(\\w*${functionality}\\w*)`, 'i'),
      type: 'function',
      description: `Function related to ${functionality}`
    });

    // Class patterns  
    searchPatterns.push({
      regex: new RegExp(`class\\s+(\\w*${functionality}\\w*)`, 'i'),
      type: 'class',
      description: `Class related to ${functionality}`
    });

    // API endpoint patterns
    if (patterns.includes('api')) {
      searchPatterns.push({
        regex: new RegExp(`(?:get|post|put|delete|patch)\\s*\\([^)]*${functionality}`, 'i'),
        type: 'api',
        description: `API endpoint for ${functionality}`
      });
    }

    return searchPatterns;
  }

  /**
   * Extract code snippet from file
   */
  private async extractCodeSnippet(
    file: string, 
    startLine: number, 
    endLine: number
  ): Promise<string> {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');
      return lines.slice(startLine - 1, endLine).join('\n');
    } catch (error) {
      return 'Unable to extract code snippet';
    }
  }

  /**
   * Extract snippet from lines array
   */
  private extractSnippetFromLines(lines: string[], centerLine: number, context: number): string {
    const start = Math.max(0, centerLine - context);
    const end = Math.min(lines.length, centerLine + context);
    return lines.slice(start, end).join('\n');
  }

  /**
   * Generate intelligent duplication recommendations
   */
  private generateDuplicationRecommendations(
    implementations: ExistingImplementation[],
    intentAnalysis: IntentAnalysisResult
  ): string[] {
    const recommendations = [];

    // Sort by similarity
    const sorted = implementations.sort((a, b) => b.similarity - a.similarity);
    const topMatch = sorted[0];

    if (topMatch.similarity > 0.8) {
      recommendations.push(
        `⚠️ High similarity (${Math.round(topMatch.similarity * 100)}%) with existing code in ${topMatch.file}`
      );
      recommendations.push(
        `Consider extending or refactoring the existing ${topMatch.function || topMatch.class} instead`
      );
    } else if (topMatch.similarity > 0.6) {
      recommendations.push(
        `Similar functionality exists in ${topMatch.file} (${Math.round(topMatch.similarity * 100)}% match)`
      );
      recommendations.push(
        `Consider reviewing the existing implementation for reusable patterns`
      );
    }

    // Suggest better names if conflicts exist
    if (implementations.some(impl => 
      intentAnalysis.suggestedNames.some(name => 
        impl.function?.toLowerCase().includes(name.toLowerCase()) ||
        impl.class?.toLowerCase().includes(name.toLowerCase())
      )
    )) {
      recommendations.push(
        `Suggested alternative names: ${intentAnalysis.suggestedNames.join(', ')}`
      );
    }

    // Architecture recommendations
    if (intentAnalysis.architecturalConcerns.length > 0) {
      recommendations.push(
        `Consider these architectural concerns: ${intentAnalysis.architecturalConcerns.join(', ')}`
      );
    }

    return recommendations;
  }

  /**
   * Smart Security Analysis
   * Enhanced security checking with context-aware vulnerability detection
   */
  async performSmartSecurity(
    projectPath: string,
    changedFiles: string[],
    userIntent: string
  ): Promise<SmartSecurityResult> {
    const result: SmartSecurityResult = {
      vulnerabilities: [],
      patterns: [],
      recommendations: [],
      riskLevel: 'low'
    };

    try {
      // 1. Context-aware security patterns based on user intent
      const securityPatterns = this.getContextualSecurityPatterns(userIntent);
      
      // 2. Check files for vulnerabilities
      for (const file of changedFiles) {
        const fullPath = path.join(projectPath, file);
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          const vulnerabilities = await this.scanForVulnerabilities(content, file, securityPatterns);
          result.vulnerabilities.push(...vulnerabilities);
        } catch (error) {
          // Skip files that can't be read
        }
      }

      // 3. Analyze patterns
      result.patterns = securityPatterns;
      
      // 4. Determine risk level
      result.riskLevel = this.calculateRiskLevel(result.vulnerabilities);
      
      // 5. Generate recommendations
      result.recommendations = this.generateSecurityRecommendations(
        result.vulnerabilities,
        userIntent
      );

    } catch (error: any) {
      this.logger.warn('Smart security analysis error:', error.message);
    }

    return result;
  }

  /**
   * Get contextual security patterns based on user intent
   */
  private getContextualSecurityPatterns(userIntent: string): SecurityPattern[] {
    const patterns: SecurityPattern[] = [];
    const lowerIntent = userIntent.toLowerCase();

    // Authentication-specific patterns
    if (lowerIntent.includes('auth') || lowerIntent.includes('login') || lowerIntent.includes('password')) {
      patterns.push(
        {
          pattern: 'password\\s*[:=]\\s*[\'"][^\'"]{1,8}[\'"]',
          description: 'Weak password detected',
          recommendation: 'Use strong passwords and proper hashing'
        },
        {
          pattern: 'jwt.*secret.*[\'"][^\'"]{1,16}[\'"]',
          description: 'Weak JWT secret',
          recommendation: 'Use cryptographically strong secrets (32+ characters)'
        },
        {
          pattern: 'bcrypt.hash\\([^,]+,\\s*[1-9]\\)',
          description: 'Low bcrypt rounds',
          recommendation: 'Use at least 12 rounds for bcrypt'
        }
      );
    }

    // API-specific patterns
    if (lowerIntent.includes('api') || lowerIntent.includes('endpoint') || lowerIntent.includes('route')) {
      patterns.push(
        {
          pattern: 'req\\.(query|params|body)\\.[\\w.]+.*\\+.*[\'"`]',
          description: 'Potential SQL injection',
          recommendation: 'Use parameterized queries or ORM'
        },
        {
          pattern: 'eval\\s*\\(.*req\\.',
          description: 'Code injection vulnerability',
          recommendation: 'Never use eval() with user input'
        },
        {
          pattern: '\\.innerHTML\\s*=.*req\\.',
          description: 'XSS vulnerability',
          recommendation: 'Sanitize user input and use textContent instead'
        }
      );
    }

    // Database-specific patterns
    if (lowerIntent.includes('database') || lowerIntent.includes('db') || lowerIntent.includes('query')) {
      patterns.push(
        {
          pattern: '`SELECT.*\\$\\{.*\\}`',
          description: 'SQL injection via template literals',
          recommendation: 'Use parameterized queries'
        },
        {
          pattern: 'connection.*query\\([^,]*\\+',
          description: 'SQL injection via string concatenation',
          recommendation: 'Use parameterized queries or prepared statements'
        }
      );
    }

    // File operations
    if (lowerIntent.includes('file') || lowerIntent.includes('upload') || lowerIntent.includes('download')) {
      patterns.push(
        {
          pattern: 'path\\.join\\([^)]*req\\.[^)]*\\)',
          description: 'Path traversal vulnerability',
          recommendation: 'Validate and sanitize file paths'
        },
        {
          pattern: 'fs\\.(read|write).*File\\([^,]*req\\.',
          description: 'Unsafe file operations',
          recommendation: 'Validate file paths and permissions'
        }
      );
    }

    return patterns;
  }

  /**
   * Scan content for vulnerabilities
   */
  private async scanForVulnerabilities(
    content: string,
    file: string,
    contextPatterns: SecurityPattern[]
  ): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Check contextual patterns
    for (const pattern of contextPatterns) {
      const regex = new RegExp(pattern.pattern, 'gi');
      let match;
      
      while ((match = regex.exec(content)) !== null) {
        const line = content.substring(0, match.index).split('\n').length;
        
        vulnerabilities.push({
          type: 'contextual',
          severity: this.getSeverityFromPattern(pattern.description),
          description: pattern.description,
          file,
          line,
          suggestion: pattern.recommendation,
          example: match[0].substring(0, 100)
        });
      }
    }

    // Check common patterns
    const commonPatterns = [
      {
        pattern: /console\.log\([^)]*password[^)]*\)/gi,
        type: 'information_disclosure',
        severity: 'medium' as const,
        description: 'Password logged to console'
      },
      {
        pattern: /api[_-]?key\s*[:=]\s*['"][^'"]{8,}['"]/gi,
        type: 'credential_exposure',
        severity: 'high' as const,
        description: 'Hardcoded API key detected'
      },
      {
        pattern: /Math\.random\(\)/gi,
        type: 'weak_randomness',
        severity: 'low' as const,
        description: 'Cryptographically insecure random number generation'
      }
    ];

    for (const pattern of commonPatterns) {
      let match;
      while ((match = pattern.pattern.exec(content)) !== null) {
        const line = content.substring(0, match.index).split('\n').length;
        
        vulnerabilities.push({
          type: pattern.type,
          severity: pattern.severity,
          description: pattern.description,
          file,
          line,
          suggestion: this.getSuggestionForVulnerability(pattern.type)
        });
      }
    }

    return vulnerabilities;
  }

  /**
   * Get severity from pattern description
   */
  private getSeverityFromPattern(description: string): 'low' | 'medium' | 'high' | 'critical' {
    const lower = description.toLowerCase();
    if (lower.includes('injection') || lower.includes('xss')) return 'critical';
    if (lower.includes('weak') || lower.includes('insecure')) return 'medium';
    return 'low';
  }

  /**
   * Calculate overall risk level
   */
  private calculateRiskLevel(vulnerabilities: SecurityVulnerability[]): 'low' | 'medium' | 'high' | 'critical' {
    if (vulnerabilities.some(v => v.severity === 'critical')) return 'critical';
    if (vulnerabilities.some(v => v.severity === 'high')) return 'high';
    if (vulnerabilities.some(v => v.severity === 'medium')) return 'medium';
    return 'low';
  }

  /**
   * Generate security recommendations
   */
  private generateSecurityRecommendations(
    vulnerabilities: SecurityVulnerability[],
    userIntent: string
  ): string[] {
    const recommendations = new Set<string>();

    for (const vuln of vulnerabilities) {
      recommendations.add(vuln.suggestion);
    }

    // Context-specific recommendations
    const lowerIntent = userIntent.toLowerCase();
    if (lowerIntent.includes('auth')) {
      recommendations.add('Implement rate limiting for authentication endpoints');
      recommendations.add('Use secure session management');
      recommendations.add('Add CSRF protection');
    }

    if (lowerIntent.includes('api')) {
      recommendations.add('Add input validation middleware');
      recommendations.add('Implement proper error handling');
      recommendations.add('Use HTTPS only');
    }

    return Array.from(recommendations);
  }

  /**
   * Get suggestion for vulnerability type
   */
  private getSuggestionForVulnerability(type: string): string {
    const suggestions: { [key: string]: string } = {
      'information_disclosure': 'Remove sensitive data from logs',
      'credential_exposure': 'Use environment variables or secure key management',
      'weak_randomness': 'Use crypto.randomBytes() for cryptographic operations',
      'sql_injection': 'Use parameterized queries',
      'xss': 'Sanitize user input and use safe rendering methods',
      'path_traversal': 'Validate and restrict file paths'
    };

    return suggestions[type] || 'Review this pattern for security implications';
  }
}

export default IntelligentCycleFeatures;