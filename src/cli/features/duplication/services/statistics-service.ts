/**
 * Statistics Service
 * SOLID Principles: Single Responsibility - Handle duplication statistics and analytics only
 */

import { Logger } from '../../../../utils/logger';
import {
  IStatisticsService,
  DuplicationGroup,
  DuplicationStatistics,
  DuplicationType
} from '../interfaces/index';

export class StatisticsService implements IStatisticsService {
  private logger = Logger.getInstance();

  calculateStatistics(duplicates: DuplicationGroup[]): DuplicationStatistics {
    try {
      const totalDuplicates = duplicates.length;
      const byType = this.categorizeByType(duplicates);
      const bySeverity = this.categorizeBySeverity(duplicates);
      const estimatedTechnicalDebt = this.estimateTechnicalDebt(duplicates);

      const statistics: DuplicationStatistics = {
        totalDuplicates,
        byType,
        bySeverity,
        estimatedTechnicalDebt
      };

      this.logger.debug(`Calculated statistics for ${totalDuplicates} duplicate groups`);
      return statistics;

    } catch (error) {
      this.logger.error('Failed to calculate duplication statistics:', error);
      return this.getEmptyStatistics();
    }
  }

  estimateTechnicalDebt(duplicates: DuplicationGroup[]): {
    linesOfCode: number;
    maintenanceHours: number;
    riskScore: number;
  } {
    try {
      let totalLines = 0;
      let totalMaintenanceHours = 0;
      let totalRiskScore = 0;

      for (const group of duplicates) {
        // Count lines of code (subtract one copy to get the "extra" lines)
        const extraCopies = Math.max(0, group.locations.length - 1);
        const linesPerLocation = group.metadata.linesOfCode / group.locations.length;
        totalLines += Math.round(extraCopies * linesPerLocation);

        // Estimate maintenance hours based on complexity and duplication spread
        const maintenanceHours = this.calculateMaintenanceHours(group);
        totalMaintenanceHours += maintenanceHours;

        // Calculate risk score for this group
        const riskScore = this.calculateRiskScore(group);
        totalRiskScore += riskScore;
      }

      // Average risk score
      const averageRiskScore = duplicates.length > 0 ? totalRiskScore / duplicates.length : 0;

      return {
        linesOfCode: totalLines,
        maintenanceHours: Math.round(totalMaintenanceHours * 10) / 10, // Round to 1 decimal
        riskScore: Math.round(averageRiskScore)
      };

    } catch (error) {
      this.logger.error('Failed to estimate technical debt:', error);
      return { linesOfCode: 0, maintenanceHours: 0, riskScore: 0 };
    }
  }

  categorizeByType(duplicates: DuplicationGroup[]): Record<DuplicationType, number> {
    const counts: Record<DuplicationType, number> = {
      [DuplicationType.EXACT]: 0,
      [DuplicationType.STRUCTURAL]: 0,
      [DuplicationType.SEMANTIC]: 0,
      [DuplicationType.RENAMED]: 0
    };

    for (const group of duplicates) {
      counts[group.type]++;
    }

    return counts;
  }

  categorizeBySeverity(duplicates: DuplicationGroup[]): Record<'low' | 'medium' | 'high' | 'critical', number> {
    const counts = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    for (const group of duplicates) {
      const severity = this.calculateSeverity(group);
      counts[severity]++;
    }

    return counts;
  }

  private calculateMaintenanceHours(group: DuplicationGroup): number {
    // Base time for each duplicate location (time to modify + test)
    const baseTimePerLocation = 0.25; // 15 minutes per location

    // Additional time based on complexity
    const complexityMultiplier = Math.min(3, 1 + (group.metadata.complexity - 1) * 0.3);

    // Additional time for cross-file duplicates
    const uniqueFiles = new Set(group.locations.map(loc => loc.file)).size;
    const crossFileMultiplier = Math.min(2, 1 + (uniqueFiles - 1) * 0.2);

    // Additional time based on lines of code
    const linesPerLocation = group.metadata.linesOfCode / group.locations.length;
    const sizeMultiplier = Math.min(2.5, 1 + Math.max(0, linesPerLocation - 10) * 0.05);

    const totalTime = (group.locations.length * baseTimePerLocation) *
                      complexityMultiplier *
                      crossFileMultiplier *
                      sizeMultiplier;

    return Math.max(0.1, totalTime); // Minimum 6 minutes
  }

  private calculateRiskScore(group: DuplicationGroup): number {
    let riskScore = 20; // Base risk

    // Risk increases with number of locations
    if (group.locations.length > 2) riskScore += (group.locations.length - 2) * 8;
    if (group.locations.length > 5) riskScore += (group.locations.length - 5) * 5;

    // Risk increases with complexity
    if (group.metadata.complexity > 3) riskScore += (group.metadata.complexity - 3) * 10;

    // Risk increases with lines of code
    const avgLinesPerLocation = group.metadata.linesOfCode / group.locations.length;
    if (avgLinesPerLocation > 20) riskScore += Math.min(25, (avgLinesPerLocation - 20) * 0.5);

    // Risk decreases with higher similarity (more predictable refactoring)
    const similarityBonus = Math.max(0, (group.similarity - 0.7) * 20);
    riskScore -= similarityBonus;

    // Risk increases for cross-file duplicates
    const uniqueFiles = new Set(group.locations.map(loc => loc.file)).size;
    if (uniqueFiles > 2) riskScore += (uniqueFiles - 2) * 5;

    // Risk increases for certain file patterns (critical files)
    const hasCriticalFiles = group.locations.some(loc => {
      const fileName = loc.file.toLowerCase();
      return fileName.includes('main') || fileName.includes('index') ||
             fileName.includes('app') || fileName.includes('core');
    });
    if (hasCriticalFiles) riskScore += 15;

    return Math.max(0, Math.min(100, Math.round(riskScore)));
  }

  private calculateSeverity(group: DuplicationGroup): 'low' | 'medium' | 'high' | 'critical' {
    const linesOfCode = group.metadata.linesOfCode;
    const locations = group.locations.length;
    const complexity = group.metadata.complexity;
    const uniqueFiles = new Set(group.locations.map(loc => loc.file)).size;

    // Calculate severity score
    let severityScore = 0;

    // Lines of code factor
    if (linesOfCode > 100) severityScore += 3;
    else if (linesOfCode > 50) severityScore += 2;
    else if (linesOfCode > 20) severityScore += 1;

    // Number of locations factor
    if (locations > 5) severityScore += 3;
    else if (locations > 3) severityScore += 2;
    else if (locations > 2) severityScore += 1;

    // Complexity factor
    if (complexity > 6) severityScore += 3;
    else if (complexity > 4) severityScore += 2;
    else if (complexity > 2) severityScore += 1;

    // Cross-file factor
    if (uniqueFiles > 3) severityScore += 2;
    else if (uniqueFiles > 2) severityScore += 1;

    // Type factor
    switch (group.type) {
      case DuplicationType.EXACT:
        severityScore += 2; // Exact duplicates are more severe
        break;
      case DuplicationType.STRUCTURAL:
        severityScore += 1;
        break;
      case DuplicationType.SEMANTIC:
        severityScore += 1;
        break;
      case DuplicationType.RENAMED:
        severityScore += 2; // Often indicates copy-paste without thinking
        break;
    }

    // Determine severity level
    if (severityScore >= 8) return 'critical';
    if (severityScore >= 5) return 'high';
    if (severityScore >= 3) return 'medium';
    return 'low';
  }

  private getEmptyStatistics(): DuplicationStatistics {
    return {
      totalDuplicates: 0,
      byType: {
        [DuplicationType.EXACT]: 0,
        [DuplicationType.STRUCTURAL]: 0,
        [DuplicationType.SEMANTIC]: 0,
        [DuplicationType.RENAMED]: 0
      },
      bySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      },
      estimatedTechnicalDebt: {
        linesOfCode: 0,
        maintenanceHours: 0,
        riskScore: 0
      }
    };
  }

  // Additional analysis methods
  generateSummaryReport(duplicates: DuplicationGroup[]): string {
    const stats = this.calculateStatistics(duplicates);

    const report = [
      '🔍 Duplication Analysis Report',
      '=' .repeat(30),
      `Total Duplicate Groups: ${stats.totalDuplicates}`,
      '',
      'By Type:',
      `  📍 Exact: ${stats.byType[DuplicationType.EXACT]}`,
      `  🏗️ Structural: ${stats.byType[DuplicationType.STRUCTURAL]}`,
      `  🧠 Semantic: ${stats.byType[DuplicationType.SEMANTIC]}`,
      `  📝 Renamed: ${stats.byType[DuplicationType.RENAMED]}`,
      '',
      'By Severity:',
      `  🟢 Low: ${stats.bySeverity.low}`,
      `  🟡 Medium: ${stats.bySeverity.medium}`,
      `  🟠 High: ${stats.bySeverity.high}`,
      `  🔴 Critical: ${stats.bySeverity.critical}`,
      '',
      'Technical Debt:',
      `  📏 Duplicated Lines: ${stats.estimatedTechnicalDebt.linesOfCode}`,
      `  ⏰ Maintenance Hours: ${stats.estimatedTechnicalDebt.maintenanceHours}`,
      `  ⚠️ Risk Score: ${stats.estimatedTechnicalDebt.riskScore}/100`,
      ''
    ].join('\n');

    return report;
  }

  identifyPriorityGroups(duplicates: DuplicationGroup[], topN: number = 10): DuplicationGroup[] {
    // Sort by priority score (combination of severity factors)
    const prioritizedGroups = duplicates
      .map(group => ({
        group,
        priorityScore: this.calculatePriorityScore(group)
      }))
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, topN)
      .map(item => item.group);

    return prioritizedGroups;
  }

  private calculatePriorityScore(group: DuplicationGroup): number {
    let score = 0;

    // Lines of code impact
    score += group.metadata.linesOfCode * 0.5;

    // Number of locations impact
    score += group.locations.length * 10;

    // Complexity impact
    score += group.metadata.complexity * 8;

    // Type priority (exact duplicates are higher priority)
    switch (group.type) {
      case DuplicationType.EXACT: score += 30; break;
      case DuplicationType.RENAMED: score += 25; break;
      case DuplicationType.STRUCTURAL: score += 15; break;
      case DuplicationType.SEMANTIC: score += 10; break;
    }

    // Cross-file impact
    const uniqueFiles = new Set(group.locations.map(loc => loc.file)).size;
    if (uniqueFiles > 2) score += (uniqueFiles - 2) * 5;

    return Math.round(score);
  }
}