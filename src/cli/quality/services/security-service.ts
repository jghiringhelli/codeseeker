/**
 * Security Service
 * SOLID Principles: Single Responsibility - Handle security vulnerability scanning only
 */

import { Logger } from '../../../utils/logger';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  ISecurityService,
  SecurityResult,
  SubTaskResult
} from '../interfaces/index';

export class SecurityService implements ISecurityService {
  private logger = Logger.getInstance();

  constructor(private projectRoot: string) {}

  async runSecurityChecks(subTaskResults: SubTaskResult[]): Promise<SecurityResult> {
    this.logger.debug('Running security checks...');

    const vulnerabilities: SecurityResult['vulnerabilities'] = [];

    // Check for common security issues in modified files
    for (const result of subTaskResults) {
      for (const filePath of result.filesModified) {
        try {
          const fullPath = path.join(this.projectRoot, filePath);
          const content = await fs.readFile(fullPath, 'utf-8');
          const fileVulns = this.scanFileForSecurityIssues(filePath, content);
          vulnerabilities.push(...fileVulns);
        } catch (error) {
          this.logger.warn(`Could not scan ${filePath} for security issues:`, error);
        }
      }
    }

    // Calculate security score based on vulnerabilities
    const overallScore = this.calculateSecurityScore(vulnerabilities);

    return {
      vulnerabilities,
      overallScore
    };
  }

  async scanForVulnerabilities(filePaths: string[]): Promise<SecurityResult> {
    const vulnerabilities: SecurityResult['vulnerabilities'] = [];

    for (const filePath of filePaths) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const fileVulns = this.scanFileForSecurityIssues(filePath, content);
        vulnerabilities.push(...fileVulns);
      } catch (error) {
        this.logger.warn(`Could not scan ${filePath} for security issues:`, error);
      }
    }

    const overallScore = this.calculateSecurityScore(vulnerabilities);

    return {
      vulnerabilities,
      overallScore
    };
  }

  private scanFileForSecurityIssues(filePath: string, content: string): SecurityResult['vulnerabilities'] {
    const vulnerabilities: SecurityResult['vulnerabilities'] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // Check for hardcoded secrets
      if (/(?:password|secret|key|token)\s*[:=]\s*['"][^'"]+['"]/.test(line.toLowerCase())) {
        vulnerabilities.push({
          severity: 'high',
          type: 'Hardcoded Secret',
          file: filePath,
          line: lineNum,
          description: 'Potential hardcoded secret detected'
        });
      }

      // Check for SQL injection risks
      if (/query\s*\+|WHERE.*\+/.test(line) && !line.includes('?')) {
        vulnerabilities.push({
          severity: 'high',
          type: 'SQL Injection',
          file: filePath,
          line: lineNum,
          description: 'Potential SQL injection vulnerability'
        });
      }

      // Check for XSS risks
      if (/innerHTML|outerHTML/.test(line) && !line.includes('sanitize')) {
        vulnerabilities.push({
          severity: 'medium',
          type: 'XSS',
          file: filePath,
          line: lineNum,
          description: 'Potential XSS vulnerability - unsanitized HTML'
        });
      }

      // Check for weak crypto
      if (/md5|sha1(?!\w)/.test(line.toLowerCase())) {
        vulnerabilities.push({
          severity: 'medium',
          type: 'Weak Cryptography',
          file: filePath,
          line: lineNum,
          description: 'Weak hashing algorithm detected'
        });
      }

      // Check for console.log with sensitive data
      if (/console\.log.*(?:password|secret|key|token)/i.test(line)) {
        vulnerabilities.push({
          severity: 'medium',
          type: 'Information Disclosure',
          file: filePath,
          line: lineNum,
          description: 'Sensitive information potentially logged to console'
        });
      }

      // Check for eval usage
      if (/eval\s*\(/.test(line)) {
        vulnerabilities.push({
          severity: 'critical',
          type: 'Code Injection',
          file: filePath,
          line: lineNum,
          description: 'Use of eval() can lead to code injection vulnerabilities'
        });
      }

      // Check for insecure HTTP requests
      if (/http:\/\/(?!localhost|127\.0\.0\.1)/i.test(line)) {
        vulnerabilities.push({
          severity: 'low',
          type: 'Insecure Transport',
          file: filePath,
          line: lineNum,
          description: 'HTTP connection detected, consider using HTTPS'
        });
      }

      // Check for weak random number generation
      if (/Math\.random\(\)/.test(line)) {
        vulnerabilities.push({
          severity: 'low',
          type: 'Weak Randomness',
          file: filePath,
          line: lineNum,
          description: 'Math.random() is not cryptographically secure'
        });
      }

      // Check for file path traversal
      if (/\.\.\//g.test(line) && /path\.join|fs\.|readFile|writeFile/.test(line)) {
        vulnerabilities.push({
          severity: 'high',
          type: 'Path Traversal',
          file: filePath,
          line: lineNum,
          description: 'Potential path traversal vulnerability'
        });
      }

      // Check for command injection
      if (/exec\(.*\+|spawn\(.*\+|system\(.*\+/.test(line)) {
        vulnerabilities.push({
          severity: 'critical',
          type: 'Command Injection',
          file: filePath,
          line: lineNum,
          description: 'Potential command injection vulnerability'
        });
      }
    });

    return vulnerabilities;
  }

  private calculateSecurityScore(vulnerabilities: SecurityResult['vulnerabilities']): number {
    const criticalCount = vulnerabilities.filter(v => v.severity === 'critical').length;
    const highCount = vulnerabilities.filter(v => v.severity === 'high').length;
    const mediumCount = vulnerabilities.filter(v => v.severity === 'medium').length;
    const lowCount = vulnerabilities.filter(v => v.severity === 'low').length;

    let overallScore = 100;
    overallScore -= criticalCount * 30;
    overallScore -= highCount * 20;
    overallScore -= mediumCount * 10;
    overallScore -= lowCount * 5;

    return Math.max(0, overallScore);
  }
}