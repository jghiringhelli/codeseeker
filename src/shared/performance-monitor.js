const EventEmitter = require('events');

class PerformanceMonitor extends EventEmitter {
    constructor() {
        super();
        this.metrics = [];
        this.alerts = [];
        this.thresholds = {
            cpu: 80,
            memory: 95,  // Increased from 85 to reduce false positives
            responseTime: 5000,
            errorRate: 0.05
        };
        
        console.log('📊 Mock Performance Monitor initialized');
        
        // Start monitoring
        this.startMonitoring();
    }

    startMonitoring() {
        setInterval(() => {
            this.recordSystemMetrics();
        }, 10000); // Every 10 seconds

        setInterval(() => {
            this.checkAlerts();
        }, 30000); // Every 30 seconds
    }

    recordSystemMetrics() {
        const timestamp = new Date();
        
        // CPU metrics
        const cpuUsage = Math.random() * 20 + 10; // 10-30% usage
        this.recordMetric('system_cpu', cpuUsage, '%', timestamp);

        // Memory metrics
        const memUsage = process.memoryUsage();
        const memoryPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        this.recordMetric('system_memory', memoryPercent, '%', timestamp);

        // Response time simulation
        const responseTime = Math.random() * 1000 + 200; // 200-1200ms
        this.recordMetric('response_time', responseTime, 'ms', timestamp);

        // Tool selection performance
        const toolPerf = Math.random() * 0.3 + 0.7; // 0.7-1.0
        this.recordMetric('tool_selection_performance', toolPerf, 'score', timestamp);

        // Error rate simulation
        const errorRate = Math.random() * 0.02; // 0-2%
        this.recordMetric('error_rate', errorRate, 'ratio', timestamp);
    }

    recordMetric(name, value, unit, timestamp = new Date()) {
        const metric = {
            name,
            value,
            unit,
            timestamp,
            type: this.getMetricType(name)
        };

        this.metrics.push(metric);
        
        // Keep only last 1000 metrics
        if (this.metrics.length > 1000) {
            this.metrics = this.metrics.slice(-1000);
        }

        this.emit('metric-recorded', metric);
    }

    getMetricType(name) {
        const types = {
            'system_cpu': 'system',
            'system_memory': 'system',
            'response_time': 'performance',
            'tool_selection_performance': 'intelligence',
            'error_rate': 'reliability'
        };
        return types[name] || 'custom';
    }

    checkAlerts() {
        const recentMetrics = this.getRecentMetrics(60000); // Last minute
        
        // Check CPU
        const cpuMetrics = recentMetrics.filter(m => m.name === 'system_cpu');
        if (cpuMetrics.length > 0) {
            const avgCpu = cpuMetrics.reduce((sum, m) => sum + m.value, 0) / cpuMetrics.length;
            if (avgCpu > this.thresholds.cpu) {
                this.createAlert('warning', `High CPU usage`, {
                    metric: 'cpu',
                    current: avgCpu,
                    threshold: this.thresholds.cpu,
                    unit: '%'
                });
            }
        }

        // Check Memory
        const memMetrics = recentMetrics.filter(m => m.name === 'system_memory');
        if (memMetrics.length > 0) {
            const avgMem = memMetrics.reduce((sum, m) => sum + m.value, 0) / memMetrics.length;
            if (avgMem > this.thresholds.memory) {
                this.createAlert('warning', `High memory usage`, {
                    metric: 'memory',
                    current: avgMem,
                    threshold: this.thresholds.memory,
                    unit: '%'
                });
            }
        }

        // Check Response Time
        const rtMetrics = recentMetrics.filter(m => m.name === 'response_time');
        if (rtMetrics.length > 0) {
            const avgRt = rtMetrics.reduce((sum, m) => sum + m.value, 0) / rtMetrics.length;
            if (avgRt > this.thresholds.responseTime) {
                this.createAlert('warning', `High response time`, {
                    metric: 'responseTime',
                    current: avgRt,
                    threshold: this.thresholds.responseTime,
                    unit: 'ms'
                });
            }
        }

        // Check Error Rate
        const errMetrics = recentMetrics.filter(m => m.name === 'error_rate');
        if (errMetrics.length > 0) {
            const avgErr = errMetrics.reduce((sum, m) => sum + m.value, 0) / errMetrics.length;
            if (avgErr > this.thresholds.errorRate) {
                this.createAlert('warning', `High error rate`, {
                    metric: 'errorRate',
                    current: avgErr,
                    threshold: this.thresholds.errorRate,
                    unit: 'ratio'
                });
            }
        }
    }

    createAlert(level, message, metrics) {
        const alert = {
            level,
            message,
            metrics,
            timestamp: new Date(),
            id: this.generateAlertId()
        };

        this.alerts.push(alert);
        
        // Keep only last 100 alerts
        if (this.alerts.length > 100) {
            this.alerts = this.alerts.slice(-100);
        }

        this.emit('performance-alert', alert);
        console.log(`🚨 Performance Alert [${level}]: ${message}`);
    }

    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getRecentMetrics(timeWindowMs = 300000) { // Default: last 5 minutes
        const cutoff = new Date(Date.now() - timeWindowMs);
        return this.metrics.filter(m => m.timestamp > cutoff);
    }

    getMetricsByName(name, timeWindowMs = 300000) {
        const recentMetrics = this.getRecentMetrics(timeWindowMs);
        return recentMetrics.filter(m => m.name === name);
    }

    getPerformanceSummary() {
        const recentMetrics = this.getRecentMetrics();
        
        if (recentMetrics.length === 0) {
            return {
                status: 'unknown',
                message: 'No recent metrics available'
            };
        }

        const summary = {};
        const metricNames = [...new Set(recentMetrics.map(m => m.name))];
        
        for (const name of metricNames) {
            const nameMetrics = recentMetrics.filter(m => m.name === name);
            const values = nameMetrics.map(m => m.value);
            
            summary[name] = {
                current: values[values.length - 1],
                average: values.reduce((sum, v) => sum + v, 0) / values.length,
                min: Math.min(...values),
                max: Math.max(...values),
                unit: nameMetrics[0].unit,
                samples: values.length
            };
        }

        return {
            status: 'healthy',
            timestamp: new Date(),
            metrics: summary,
            alertCount: this.alerts.length
        };
    }

    getRecentAlerts(limit = 10) {
        return this.alerts.slice(-limit);
    }

    // Public API methods
    recordCustomMetric(name, value, unit = 'count') {
        this.recordMetric(name, value, unit);
    }

    setThreshold(metricName, value) {
        this.thresholds[metricName] = value;
        console.log(`📊 Updated threshold for ${metricName}: ${value}`);
    }
}

module.exports = { PerformanceMonitor };