import { EventEmitter } from 'events';
export interface PerformanceMetric {
    name: string;
    value: number;
    unit: string;
    timestamp: Date;
    type: 'system' | 'performance' | 'intelligence' | 'reliability' | 'custom';
}
export interface PerformanceAlert {
    level: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    metrics: {
        metric: string;
        current: number;
        threshold: number;
        unit: string;
    };
    timestamp: Date;
    id: string;
}
export interface PerformanceSummary {
    status: 'healthy' | 'warning' | 'error' | 'unknown';
    timestamp: Date;
    metrics: Record<string, {
        current: number;
        average: number;
        min: number;
        max: number;
        unit: string;
        samples: number;
    }>;
    alertCount: number;
    message?: string;
}
export interface PerformanceThresholds {
    cpu: number;
    memory: number;
    responseTime: number;
    errorRate: number;
    [key: string]: number;
}
export declare class PerformanceMonitor extends EventEmitter {
    private metrics;
    private alerts;
    private thresholds;
    constructor();
    private startMonitoring;
    private recordSystemMetrics;
    recordMetric(name: string, value: number, unit: string, timestamp?: Date): void;
    private getMetricType;
    private checkAlerts;
    private createAlert;
    private generateAlertId;
    getRecentMetrics(timeWindowMs?: number): PerformanceMetric[];
    getMetricsByName(name: string, timeWindowMs?: number): PerformanceMetric[];
    getPerformanceSummary(): PerformanceSummary;
    getRecentAlerts(limit?: number): PerformanceAlert[];
    recordCustomMetric(name: string, value: number, unit?: string): void;
    record(operation: string, data: any): void;
    setThreshold(metricName: string, value: number): void;
    getThresholds(): PerformanceThresholds;
    getAllMetrics(): PerformanceMetric[];
    getAllAlerts(): PerformanceAlert[];
    clearMetrics(): void;
    clearAlerts(): void;
}
export declare const performanceMonitor: PerformanceMonitor;
export default performanceMonitor;
//# sourceMappingURL=performance-monitor.d.ts.map