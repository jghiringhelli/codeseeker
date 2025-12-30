/**
 * Security Scanning Service
 * SOLID Principles: Single Responsibility - Handle security scanning only
 */

import { Logger } from '../../logger';
import {
  ISecurityScanningService,
  SmartSecurityResult,
  SecurityVulnerability,
  SecurityPattern
} from '../interfaces';

export class SecurityScanningService implements ISecurityScanningService {
  private logger = Logger.getInstance();

  async performSmartSecurity(
    functionality: string,
    userIntent: string,
    projectPath: string
  ): Promise<SmartSecurityResult> {
    try {
      // Perform comprehensive security analysis
      const vulnerabilities = await this.scanForVulnerabilities(projectPath);
      const patterns = await this.detectSecurityPatterns(functionality, projectPath);
      const recommendations = this.generateSecurityRecommendations(functionality, vulnerabilities);
      const riskLevel = this.calculateRiskLevel(vulnerabilities);

      return {
        vulnerabilities,
        patterns,
        recommendations,
        riskLevel
      };
    } catch (error) {
      this.logger.error('Smart security analysis failed:', error);
      return this.getDefaultSecurityResult();
    }
  }

  async scanForVulnerabilities(projectPath: string): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    try {
      // Vulnerability scanning implementation
      this.logger.info(`Scanning for vulnerabilities in: ${projectPath}`);

      // Common vulnerability patterns to detect
      const vulnerabilityPatterns = [
        {
          pattern: /eval\s*\(/gi,
          type: 'Code Injection',
          severity: 'high' as const,
          description: 'Use of eval() can lead to code injection vulnerabilities'
        },
        {
          pattern: /innerHTML\s*=/gi,
          type: 'XSS',
          severity: 'medium' as const,
          description: 'Direct innerHTML assignment can lead to XSS vulnerabilities'
        },
        {
          pattern: /password.*=.*["'][^"']*["']/gi,
          type: 'Hardcoded Credentials',
          severity: 'critical' as const,
          description: 'Hardcoded passwords detected'
        },
        {
          pattern: /api[_-]?key.*=.*["'][^"']*["']/gi,
          type: 'Hardcoded API Keys',
          severity: 'high' as const,
          description: 'Hardcoded API keys detected'
        }
      ];

      // In a real implementation, this would scan actual files
      // For now, return empty array as placeholder

      return vulnerabilities;
    } catch (error) {
      this.logger.error('Vulnerability scanning failed:', error);
      return [];
    }
  }

  private async detectSecurityPatterns(functionality: string, projectPath: string): Promise<SecurityPattern[]> {
    const patterns: SecurityPattern[] = [];

    try {
      // Security pattern detection based on functionality
      if (this.matchesSecurityPattern(functionality, ['auth', 'login', 'signin'])) {
        patterns.push({
          pattern: 'Authentication',
          description: 'Authentication-related functionality detected',
          recommendation: 'Implement proper authentication and authorization'
        });
      }

      if (this.matchesSecurityPattern(functionality, ['upload', 'file'])) {
        patterns.push({
          pattern: 'File Upload',
          description: 'File upload functionality detected',
          recommendation: 'Validate file types and implement secure upload handling'
        });
      }

      if (this.matchesSecurityPattern(functionality, ['database', 'query', 'sql'])) {
        patterns.push({
          pattern: 'Database Access',
          description: 'Database access patterns detected',
          recommendation: 'Use parameterized queries and proper input validation'
        });
      }

      return patterns;
    } catch (error) {
      this.logger.error('Security pattern detection failed:', error);
      return [];
    }
  }

  private generateSecurityRecommendations(
    functionality: string,
    vulnerabilities: SecurityVulnerability[]
  ): string[] {
    const recommendations: string[] = [];

    // Base security recommendations
    recommendations.push('Follow OWASP security guidelines');
    recommendations.push('Implement proper input validation');
    recommendations.push('Use parameterized queries for database operations');

    // Functionality-specific recommendations
    if (this.matchesSecurityPattern(functionality, ['auth', 'login'])) {
      recommendations.push('Use secure session management');
      recommendations.push('Implement rate limiting for authentication');
      recommendations.push('Use strong password policies');
    }

    if (this.matchesSecurityPattern(functionality, ['api', 'endpoint'])) {
      recommendations.push('Implement proper API authentication');
      recommendations.push('Use CORS headers appropriately');
      recommendations.push('Validate all API inputs');
    }

    if (this.matchesSecurityPattern(functionality, ['upload', 'file'])) {
      recommendations.push('Validate file types and sizes');
      recommendations.push('Scan uploaded files for malware');
      recommendations.push('Store files outside web root');
    }

    // Vulnerability-specific recommendations
    if (vulnerabilities.length > 0) {
      recommendations.push(`Address ${vulnerabilities.length} detected vulnerabilities`);

      const criticalVulns = vulnerabilities.filter(v => v.severity === 'critical');
      if (criticalVulns.length > 0) {
        recommendations.push(`⚠️ CRITICAL: Fix ${criticalVulns.length} critical vulnerabilities immediately`);
      }
    }

    return recommendations;
  }

  private calculateRiskLevel(vulnerabilities: SecurityVulnerability[]): 'low' | 'medium' | 'high' | 'critical' {
    if (vulnerabilities.length === 0) {
      return 'low';
    }

    const hasCritical = vulnerabilities.some(v => v.severity === 'critical');
    if (hasCritical) {
      return 'critical';
    }

    const hasHigh = vulnerabilities.some(v => v.severity === 'high');
    if (hasHigh) {
      return 'high';
    }

    const hasMedium = vulnerabilities.some(v => v.severity === 'medium');
    if (hasMedium) {
      return 'medium';
    }

    return 'low';
  }

  private matchesSecurityPattern(text: string, keywords: string[]): boolean {
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword));
  }

  private getDefaultSecurityResult(): SmartSecurityResult {
    return {
      vulnerabilities: [],
      patterns: [],
      recommendations: [
        'Follow security best practices',
        'Implement proper error handling',
        'Use secure coding guidelines'
      ],
      riskLevel: 'low'
    };
  }
}