/**
 * Search Quality Metrics Service
 * Tracks and reports precision, recall, and F1 scores for semantic search
 *
 * Since we don't have ground truth labels, we use Claude's file reads as a proxy:
 * - If Claude reads a file we suggested → it was relevant (true positive)
 * - If Claude doesn't read a suggested file → potentially not relevant (may be false positive)
 * - If Claude reads a file we didn't suggest → we missed it (false negative)
 *
 * This gives us an approximation of search quality that improves over time.
 */

import { Logger } from '../../../utils/logger';

export interface SearchSession {
  query: string;
  timestamp: Date;
  suggestedFiles: string[];      // Files we suggested via semantic search
  claudeReadFiles: string[];     // Files Claude actually read
  claudeModifiedFiles: string[]; // Files Claude modified
}

export interface QualityMetrics {
  // Core metrics
  precision: number;       // TP / (TP + FP) - of what we suggested, how many were used
  recall: number;          // TP / (TP + FN) - of what was needed, how many did we find
  f1Score: number;         // 2 * (P * R) / (P + R) - harmonic mean

  // Counts
  truePositives: number;   // We suggested AND Claude used
  falsePositives: number;  // We suggested but Claude didn't use
  falseNegatives: number;  // We didn't suggest but Claude needed

  // Coverage stats
  suggestionCoverage: number;   // What % of Claude's reads were in our suggestions
  suggestionUtilization: number; // What % of our suggestions did Claude actually use
}

export interface AggregateMetrics extends QualityMetrics {
  sessionCount: number;
  avgSuggestionsPerQuery: number;
  avgClaudeReadsPerQuery: number;
}

export class SearchQualityMetrics {
  private logger = Logger.getInstance();
  private sessions: SearchSession[] = [];
  private maxSessions = 100; // Keep last N sessions for rolling metrics

  /**
   * Record a new search session with suggested files
   */
  startSession(query: string, suggestedFiles: string[]): string {
    const session: SearchSession = {
      query,
      timestamp: new Date(),
      suggestedFiles: [...suggestedFiles],
      claudeReadFiles: [],
      claudeModifiedFiles: []
    };

    this.sessions.push(session);

    // Trim old sessions if over limit
    if (this.sessions.length > this.maxSessions) {
      this.sessions = this.sessions.slice(-this.maxSessions);
    }

    const sessionId = `${session.timestamp.getTime()}`;
    this.logger.debug(`Started search quality session: ${sessionId} with ${suggestedFiles.length} suggestions`);
    return sessionId;
  }

  /**
   * Record files that Claude read during the session
   */
  recordClaudeReads(readFiles: string[]): void {
    const currentSession = this.sessions[this.sessions.length - 1];
    if (currentSession) {
      // Merge with existing reads, avoid duplicates
      const allReads = new Set([...currentSession.claudeReadFiles, ...readFiles]);
      currentSession.claudeReadFiles = Array.from(allReads);
      this.logger.debug(`Recorded ${readFiles.length} Claude reads (total: ${currentSession.claudeReadFiles.length})`);
    }
  }

  /**
   * Record files that Claude modified during the session
   */
  recordClaudeModifications(modifiedFiles: string[]): void {
    const currentSession = this.sessions[this.sessions.length - 1];
    if (currentSession) {
      const allMods = new Set([...currentSession.claudeModifiedFiles, ...modifiedFiles]);
      currentSession.claudeModifiedFiles = Array.from(allMods);
    }
  }

  /**
   * Calculate metrics for a single session
   */
  calculateSessionMetrics(session: SearchSession): QualityMetrics {
    const suggested = new Set(session.suggestedFiles.map(f => this.normalizePath(f)));
    const claudeUsed = new Set([
      ...session.claudeReadFiles.map(f => this.normalizePath(f)),
      ...session.claudeModifiedFiles.map(f => this.normalizePath(f))
    ]);

    // True Positives: we suggested AND Claude used
    const truePositives = Array.from(suggested).filter(f => claudeUsed.has(f)).length;

    // False Positives: we suggested but Claude didn't use
    const falsePositives = Array.from(suggested).filter(f => !claudeUsed.has(f)).length;

    // False Negatives: Claude used but we didn't suggest
    const falseNegatives = Array.from(claudeUsed).filter(f => !suggested.has(f)).length;

    // Calculate precision and recall
    const precision = suggested.size > 0 ? truePositives / suggested.size : 1;
    const recall = claudeUsed.size > 0 ? truePositives / claudeUsed.size : 1;

    // F1 Score: harmonic mean of precision and recall
    const f1Score = (precision + recall) > 0
      ? 2 * (precision * recall) / (precision + recall)
      : 0;

    // Coverage metrics
    const suggestionCoverage = claudeUsed.size > 0 ? truePositives / claudeUsed.size : 1;
    const suggestionUtilization = suggested.size > 0 ? truePositives / suggested.size : 1;

    return {
      precision,
      recall,
      f1Score,
      truePositives,
      falsePositives,
      falseNegatives,
      suggestionCoverage,
      suggestionUtilization
    };
  }

  /**
   * Get metrics for the most recent session
   */
  getLatestSessionMetrics(): QualityMetrics | null {
    if (this.sessions.length === 0) return null;
    return this.calculateSessionMetrics(this.sessions[this.sessions.length - 1]);
  }

  /**
   * Get aggregate metrics across all recent sessions
   */
  getAggregateMetrics(): AggregateMetrics | null {
    if (this.sessions.length === 0) return null;

    let totalTP = 0;
    let totalFP = 0;
    let totalFN = 0;
    let totalSuggestions = 0;
    let totalClaudeReads = 0;

    for (const session of this.sessions) {
      const metrics = this.calculateSessionMetrics(session);
      totalTP += metrics.truePositives;
      totalFP += metrics.falsePositives;
      totalFN += metrics.falseNegatives;
      totalSuggestions += session.suggestedFiles.length;
      totalClaudeReads += session.claudeReadFiles.length + session.claudeModifiedFiles.length;
    }

    // Aggregate precision and recall
    const precision = (totalTP + totalFP) > 0 ? totalTP / (totalTP + totalFP) : 1;
    const recall = (totalTP + totalFN) > 0 ? totalTP / (totalTP + totalFN) : 1;
    const f1Score = (precision + recall) > 0
      ? 2 * (precision * recall) / (precision + recall)
      : 0;

    return {
      precision,
      recall,
      f1Score,
      truePositives: totalTP,
      falsePositives: totalFP,
      falseNegatives: totalFN,
      suggestionCoverage: recall, // Same as recall in aggregate
      suggestionUtilization: precision, // Same as precision in aggregate
      sessionCount: this.sessions.length,
      avgSuggestionsPerQuery: totalSuggestions / this.sessions.length,
      avgClaudeReadsPerQuery: totalClaudeReads / this.sessions.length
    };
  }

  /**
   * Format metrics for verbose output display
   */
  formatMetricsForDisplay(metrics: QualityMetrics, includeAggregate = false): string {
    const lines: string[] = [];

    lines.push('📊 Search Quality Metrics:');
    lines.push(`   Precision: ${(metrics.precision * 100).toFixed(1)}% (${metrics.truePositives}/${metrics.truePositives + metrics.falsePositives} suggestions used)`);
    lines.push(`   Recall: ${(metrics.recall * 100).toFixed(1)}% (${metrics.truePositives}/${metrics.truePositives + metrics.falseNegatives} needed files found)`);
    lines.push(`   F1 Score: ${(metrics.f1Score * 100).toFixed(1)}%`);

    if (metrics.falseNegatives > 0) {
      lines.push(`   ⚠️  Missed ${metrics.falseNegatives} files that Claude needed`);
    }

    if (includeAggregate) {
      const aggregate = this.getAggregateMetrics();
      if (aggregate && aggregate.sessionCount > 1) {
        lines.push('');
        lines.push(`📈 Rolling Average (${aggregate.sessionCount} sessions):`);
        lines.push(`   Precision: ${(aggregate.precision * 100).toFixed(1)}%`);
        lines.push(`   Recall: ${(aggregate.recall * 100).toFixed(1)}%`);
        lines.push(`   F1 Score: ${(aggregate.f1Score * 100).toFixed(1)}%`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Get a brief one-line summary for non-verbose output
   */
  getBriefSummary(metrics: QualityMetrics): string {
    return `Search quality: F1=${(metrics.f1Score * 100).toFixed(0)}% (P=${(metrics.precision * 100).toFixed(0)}% R=${(metrics.recall * 100).toFixed(0)}%)`;
  }

  /**
   * Normalize file paths for comparison
   */
  private normalizePath(filePath: string): string {
    return filePath
      .replace(/\\/g, '/') // Normalize path separators
      .toLowerCase() // Case insensitive
      .replace(/^\.\//, ''); // Remove leading ./
  }

  /**
   * Clear all session data
   */
  clear(): void {
    this.sessions = [];
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.length;
  }
}

// Singleton instance
let metricsInstance: SearchQualityMetrics | null = null;

export function getSearchQualityMetrics(): SearchQualityMetrics {
  if (!metricsInstance) {
    metricsInstance = new SearchQualityMetrics();
  }
  return metricsInstance;
}

export function resetSearchQualityMetrics(): void {
  if (metricsInstance) {
    metricsInstance.clear();
  }
  metricsInstance = null;
}