/**
 * In-Memory Git Store
 * Fallback storage when no database is configured
 */

export class InMemoryGitStore {
  private commits: Map<string, any> = new Map();
  private rules: Map<string, any> = new Map();

  async query(sql: string, params?: any[]): Promise<any[]> {
    // Simple mock implementation - in a real scenario you'd implement actual SQL parsing
    if (sql?.includes('INSERT INTO git_commits')) {
      const id = Date?.now().toString();
      this.commits?.set(id, { id, ...params });
      return [];
    } else if (sql?.includes('SELECT') && sql?.includes('git_commits')) {
      return Array.from(this.commits?.values()).slice(0, parseInt(params?.[0] || '10'));
    } else if (sql?.includes('INSERT INTO auto_commit_rules')) {
      const projectPath = params?.[0] || 'default';
      this.rules?.set(projectPath, {
        project_path: projectPath,
        enabled: params?.[1] || false,
        min_significance_score: params?.[2] || 2.0,
        requires_compilation: params?.[3] || true
      });
      return [];
    }
    return [];
  }
}