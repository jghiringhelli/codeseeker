/**
 * Validation Report Service
 * SOLID Principles: Single Responsibility - Handle report generation only
 */

import { Logger } from '../../logger';
import {
  IValidationReportService,
  CycleResult,
  ProjectContext
} from '../interfaces/index';

export class ValidationReportService implements IValidationReportService {
  private logger = Logger.getInstance();

  generateReport(result: CycleResult, context: ProjectContext): string {
    const summary = this.generateSummary(result);

    const report = [
      '🔍 CodeMind Validation Report',
      '=' .repeat(40),
      '',
      `📊 Summary: ${summary.status}`,
      summary.summary,
      '',
      `⏱️ Duration: ${result.duration}ms`,
      `📁 Project: ${context.projectPath}`,
      `🔧 Request Type: ${context.requestType}`,
      context.language ? `💻 Language: ${context.language}` : '',
      context.framework ? `🛠️ Framework: ${context.framework}` : '',
      '',
      this.generateErrorsSection(result),
      this.generateWarningsSection(result),
      this.generateRecommendationsSection(result),
      '',
      '━'.repeat(40),
      `Generated at ${new Date().toLocaleString()}`
    ].filter(line => line !== '').join('\n');

    return report;
  }

  generateSummary(result: CycleResult): { status: string; summary: string } {
    const errorCount = result.errors.length;
    const warningCount = result.warnings.length;
    const blockingErrors = result.errors.filter(e => e.blocking).length;

    let status: string;
    let summary: string;

    if (!result.success || blockingErrors > 0) {
      status = '❌ Failed';
      summary = `Validation failed with ${blockingErrors} blocking errors and ${errorCount} total errors`;
    } else if (errorCount > 0 || warningCount > 5) {
      status = '⚠️ Issues Found';
      summary = `Validation passed but found ${errorCount} errors and ${warningCount} warnings`;
    } else if (warningCount > 0) {
      status = '✅ Passed with Warnings';
      summary = `Validation passed with ${warningCount} minor warnings`;
    } else {
      status = '✅ Passed';
      summary = 'All validations passed successfully';
    }

    return { status, summary };
  }

  exportResults(result: CycleResult, format: 'json' | 'markdown' | 'text'): string {
    switch (format) {
      case 'json':
        return this.exportAsJson(result);
      case 'markdown':
        return this.exportAsMarkdown(result);
      case 'text':
        return this.exportAsText(result);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private generateErrorsSection(result: CycleResult): string {
    if (result.errors.length === 0) {
      return '✅ No errors found';
    }

    const lines = [
      `❌ Errors (${result.errors.length}):`,
      '─'.repeat(20)
    ];

    result.errors.forEach((error, index) => {
      lines.push(`${index + 1}. ${error.blocking ? '🚫' : '⚠️'} ${error.type.toUpperCase()}`);
      lines.push(`   ${error.message}`);
      if (error.file) {
        lines.push(`   📄 File: ${error.file}${error.line ? `:${error.line}` : ''}`);
      }
      lines.push('');
    });

    return lines.join('\n');
  }

  private generateWarningsSection(result: CycleResult): string {
    if (result.warnings.length === 0) {
      return '✅ No warnings';
    }

    const lines = [
      `⚠️ Warnings (${result.warnings.length}):`,
      '─'.repeat(20)
    ];

    // Group warnings by severity
    const grouped = this.groupWarningsBySeverity(result.warnings);

    for (const [severity, warnings] of Object.entries(grouped)) {
      if (warnings.length > 0) {
        lines.push(`${this.getSeverityEmoji(severity)} ${severity.toUpperCase()} (${warnings.length}):`);

        warnings.forEach((warning, index) => {
          lines.push(`  ${index + 1}. ${warning.type}`);
          lines.push(`     ${warning.message}`);
          if (warning.file) {
            lines.push(`     📄 ${warning.file}${warning.line ? `:${warning.line}` : ''}`);
          }
        });
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  private generateRecommendationsSection(result: CycleResult): string {
    if (result.recommendations.length === 0) {
      return '💡 No specific recommendations';
    }

    const lines = [
      `💡 Recommendations (${result.recommendations.length}):`,
      '─'.repeat(25)
    ];

    result.recommendations.forEach((recommendation, index) => {
      lines.push(`${index + 1}. ${recommendation}`);
    });

    return lines.join('\n');
  }

  private groupWarningsBySeverity(warnings: any[]): Record<string, any[]> {
    return warnings.reduce((groups, warning) => {
      const severity = warning.severity || 'info';
      if (!groups[severity]) {
        groups[severity] = [];
      }
      groups[severity].push(warning);
      return groups;
    }, {} as Record<string, any[]>);
  }

  private getSeverityEmoji(severity: string): string {
    const emojis: Record<string, string> = {
      'error': '🔴',
      'warning': '🟡',
      'info': '🔵'
    };
    return emojis[severity] || '⚪';
  }

  private exportAsJson(result: CycleResult): string {
    const exportData = {
      timestamp: new Date().toISOString(),
      summary: this.generateSummary(result),
      success: result.success,
      duration: result.duration,
      errors: result.errors,
      warnings: result.warnings,
      recommendations: result.recommendations,
      statistics: {
        totalIssues: result.errors.length + result.warnings.length,
        blockingErrors: result.errors.filter(e => e.blocking).length,
        criticalWarnings: result.warnings.filter(w => w.severity === 'error').length
      }
    };

    return JSON.stringify(exportData, null, 2);
  }

  private exportAsMarkdown(result: CycleResult): string {
    const summary = this.generateSummary(result);

    const lines = [
      '# CodeMind Validation Report',
      '',
      `**Status:** ${summary.status}`,
      `**Summary:** ${summary.summary}`,
      `**Duration:** ${result.duration}ms`,
      '',
      '## Issues Summary',
      '',
      `- Errors: ${result.errors.length}`,
      `- Warnings: ${result.warnings.length}`,
      `- Recommendations: ${result.recommendations.length}`,
      ''
    ];

    // Errors section
    if (result.errors.length > 0) {
      lines.push('## ❌ Errors', '');
      result.errors.forEach((error, index) => {
        lines.push(`### ${index + 1}. ${error.type}`);
        lines.push('');
        lines.push(error.message);
        if (error.file) {
          lines.push('');
          lines.push(`**File:** \`${error.file}\`${error.line ? ` (line ${error.line})` : ''}`);
        }
        lines.push(`**Blocking:** ${error.blocking ? 'Yes' : 'No'}`);
        lines.push('');
      });
    }

    // Warnings section
    if (result.warnings.length > 0) {
      lines.push('## ⚠️ Warnings', '');
      result.warnings.forEach((warning, index) => {
        lines.push(`### ${index + 1}. ${warning.type}`);
        lines.push('');
        lines.push(warning.message);
        if (warning.file) {
          lines.push('');
          lines.push(`**File:** \`${warning.file}\`${warning.line ? ` (line ${warning.line})` : ''}`);
        }
        lines.push(`**Severity:** ${warning.severity}`);
        lines.push('');
      });
    }

    // Recommendations section
    if (result.recommendations.length > 0) {
      lines.push('## 💡 Recommendations', '');
      result.recommendations.forEach((recommendation, index) => {
        lines.push(`${index + 1}. ${recommendation}`);
      });
      lines.push('');
    }

    lines.push('---');
    lines.push(`*Generated at ${new Date().toLocaleString()}*`);

    return lines.join('\n');
  }

  private exportAsText(result: CycleResult): string {
    const summary = this.generateSummary(result);

    const lines = [
      'CODEMIND VALIDATION REPORT',
      '='.repeat(40),
      '',
      `Status: ${summary.status}`,
      `Summary: ${summary.summary}`,
      `Duration: ${result.duration}ms`,
      '',
      'ERRORS:',
      result.errors.length === 0 ? '  None' : ''
    ];

    result.errors.forEach((error, index) => {
      lines.push(`  ${index + 1}. [${error.type}] ${error.message}`);
      if (error.file) {
        lines.push(`     File: ${error.file}${error.line ? `:${error.line}` : ''}`);
      }
      lines.push(`     Blocking: ${error.blocking ? 'YES' : 'NO'}`);
    });

    lines.push('', 'WARNINGS:');
    if (result.warnings.length === 0) {
      lines.push('  None');
    } else {
      result.warnings.forEach((warning, index) => {
        lines.push(`  ${index + 1}. [${warning.severity.toUpperCase()}] ${warning.message}`);
        if (warning.file) {
          lines.push(`     File: ${warning.file}${warning.line ? `:${warning.line}` : ''}`);
        }
      });
    }

    lines.push('', 'RECOMMENDATIONS:');
    if (result.recommendations.length === 0) {
      lines.push('  None');
    } else {
      result.recommendations.forEach((recommendation, index) => {
        lines.push(`  ${index + 1}. ${recommendation}`);
      });
    }

    lines.push('', '='.repeat(40));
    lines.push(`Generated: ${new Date().toLocaleString()}`);

    return lines.join('\n');
  }

  // Additional utility methods
  generateQuickStatus(result: CycleResult): string {
    const blockingErrors = result.errors.filter(e => e.blocking).length;

    if (blockingErrors > 0) {
      return `❌ ${blockingErrors} blocking error(s)`;
    } else if (result.errors.length > 0) {
      return `⚠️ ${result.errors.length} error(s), ${result.warnings.length} warning(s)`;
    } else if (result.warnings.length > 0) {
      return `✅ Passed with ${result.warnings.length} warning(s)`;
    } else {
      return '✅ All checks passed';
    }
  }

  generateMetrics(result: CycleResult): {
    totalIssues: number;
    issuesByType: Record<string, number>;
    severityDistribution: Record<string, number>;
  } {
    const totalIssues = result.errors.length + result.warnings.length;

    const issuesByType: Record<string, number> = {};
    result.errors.forEach(error => {
      issuesByType[error.type] = (issuesByType[error.type] || 0) + 1;
    });
    result.warnings.forEach(warning => {
      issuesByType[warning.type] = (issuesByType[warning.type] || 0) + 1;
    });

    const severityDistribution = {
      'blocking': result.errors.filter(e => e.blocking).length,
      'error': result.warnings.filter(w => w.severity === 'error').length,
      'warning': result.warnings.filter(w => w.severity === 'warning').length,
      'info': result.warnings.filter(w => w.severity === 'info').length
    };

    return {
      totalIssues,
      issuesByType,
      severityDistribution
    };
  }
}