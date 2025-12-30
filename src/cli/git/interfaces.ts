/**
 * Git Integration Interfaces
 * SOLID Principles: Interface Segregation
 */

export interface GitCommitInfo {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: Date;
  changedFiles: string[];
  additions: number;
  deletions: number;
}

export interface GitDiffResult {
  file: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  linesAdded?: number;
  linesDeleted?: number;
  patch?: string;
  changes?: GitFileChange[];
}

export interface GitFileChange {
  type: 'added' | 'removed' | 'modified';
  lineNumber: number;
  content: string;
  context?: string;
}

export interface ChangeSignificance {
  score: number;
  factors: SignificanceFactor[];
  shouldAutoCommit: boolean;
  commitMessage?: string;
}

export interface SignificanceFactor {
  type: 'file_count' | 'line_changes' | 'new_features' | 'tests' | 'config' | 'dependencies';
  impact: number;
  description: string;
}

export interface AutoCommitRules {
  enabled: boolean;
  minSignificanceScore?: number;
  requiresCompilation?: boolean;
  watchPatterns?: string[];
  maxCommitFrequency?: number;
}

export interface CommitAnalysis {
  commit: GitCommitInfo;
  significance: ChangeSignificance;
  codeAnalysis?: {
    duplicationsChanged: number;
    dependenciesChanged: number;
    complexityDelta: number;
    newPatterns: string[];
  };
}


// Service Interfaces (SOLID: Interface Segregation)
export interface IGitOperationsService {
  getCurrentCommit(): Promise<GitCommitInfo | null>;
  getCommitsSince(since: string): Promise<GitCommitInfo[]>;
  getDiffBetweenCommits(from: string, to: string): Promise<GitDiffResult[]>;
  getWorkingDirectoryDiff(projectPath: string): Promise<GitDiffResult[]>;
  getStagedFiles(projectPath: string): Promise<string[]>;
  isGitRepository(): Promise<boolean>;
}

export interface IGitAnalysisService {
  analyzeChangeSignificance(diff: GitDiffResult[]): Promise<ChangeSignificance>;
  analyzeCommitRange(projectPath: string, from: string, to: string): Promise<any>;
  compilesSuccessfully(): Promise<boolean>;
}

export interface IGitDatabaseService {
  recordCommit(commit: GitCommitInfo, significance: ChangeSignificance, autoCommitted: boolean): Promise<void>;
  updateDatabaseFromGitHistory(): Promise<void>;
  getCommitHistory(limit: number): Promise<CommitAnalysis[]>;
  getIntegrationStatus(projectPath: string): Promise<any>;
}

export interface IGitAutoCommitService {
  performAutoCommit(significance: ChangeSignificance): Promise<boolean>;
  configureAutoCommit(projectPath: string, rules: Partial<AutoCommitRules>): Promise<void>;
  startAutoCommitWatcher(): Promise<void>;
  stopAutoCommitWatcher(): Promise<void>;
}