/**
 * Result Integrator - Single Responsibility: Integrating multiple task results
 */

export class ResultIntegrator {
  async integrate(results: any[]): Promise<any> {
    console.log(`🔗 Integrating ${results.length} task results...`);

    const integrated = {
      summary: `Completed ${results.length} tasks`,
      totalDuration: results.reduce((sum, r) => sum + (r.duration || 0), 0),
      successfulTasks: results.filter(r => r.status === 'completed').length,
      findings: [],
      recommendations: []
    };

    results.forEach(result => {
      if (result.result?.findings) {
        integrated.findings.push(...result.result.findings);
      }
      if (result.result?.suggestions) {
        integrated.recommendations.push(...result.result.suggestions);
      }
    });

    integrated.findings = [...new Set(integrated.findings)];
    integrated.recommendations = [...new Set(integrated.recommendations)];

    return integrated;
  }
}