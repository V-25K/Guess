/**
 * Metrics Tracking Utility
 * Devvit-compatible metrics collection for monitoring and observability
 * 
 * Since Devvit doesn't have built-in metrics, we use Redis to store metrics
 * and structured logging to output them for analysis
 * 
 * Requirements: Phase 4.6 - Monitoring & Metrics
 */

import { redis } from '@devvit/web/server';
import { createLogger, type Logger } from './logger.js';

/**
 * Metric types supported
 */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'timer';

/**
 * Metric labels for categorization
 */
export type MetricLabels = Record<string, string>;

/**
 * Metric entry stored in Redis
 */
export type MetricEntry = {
  name: string;
  type: MetricType;
  value: number;
  labels: MetricLabels;
  timestamp: number;
};

/**
 * Histogram bucket configuration
 */
export type HistogramBuckets = number[];

/**
 * Default histogram buckets for response times (in ms)
 */
export const DEFAULT_RESPONSE_TIME_BUCKETS: HistogramBuckets = [
  10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000
];

/**
 * Redis key prefix for metrics
 */
const METRICS_PREFIX = 'metrics:';
const METRICS_COUNTER_PREFIX = `${METRICS_PREFIX}counter:`;
const METRICS_GAUGE_PREFIX = `${METRICS_PREFIX}gauge:`;
const METRICS_HISTOGRAM_PREFIX = `${METRICS_PREFIX}histogram:`;

/**
 * Metrics collector for tracking application performance
 */
export class MetricsCollector {
  private logger: Logger;

  constructor() {
    this.logger = createLogger({ service: 'MetricsCollector' });
  }

  /**
   * Increment a counter metric
   * Counters only go up and are used for counting events
   */
  async incrementCounter(
    name: string,
    labels: MetricLabels = {},
    delta: number = 1
  ): Promise<void> {
    try {
      const key = this.buildKey(METRICS_COUNTER_PREFIX, name, labels);
      await redis.incrBy(key, delta);
      
      this.logger.debug('Counter incremented', {
        metric: name,
        labels,
        delta,
      });
    } catch (error) {
      this.logger.error('Failed to increment counter', error, { metric: name });
    }
  }

  /**
   * Get current counter value
   */
  async getCounter(name: string, labels: MetricLabels = {}): Promise<number> {
    try {
      const key = this.buildKey(METRICS_COUNTER_PREFIX, name, labels);
      const value = await redis.get(key);
      return value ? parseInt(value, 10) : 0;
    } catch (error) {
      this.logger.error('Failed to get counter', error, { metric: name });
      return 0;
    }
  }

  /**
   * Set a gauge metric
   * Gauges can go up or down and represent current state
   */
  async setGauge(
    name: string,
    value: number,
    labels: MetricLabels = {}
  ): Promise<void> {
    try {
      const key = this.buildKey(METRICS_GAUGE_PREFIX, name, labels);
      await redis.set(key, value.toString());
      
      this.logger.debug('Gauge set', {
        metric: name,
        labels,
        value,
      });
    } catch (error) {
      this.logger.error('Failed to set gauge', error, { metric: name });
    }
  }

  /**
   * Get current gauge value
   */
  async getGauge(name: string, labels: MetricLabels = {}): Promise<number> {
    try {
      const key = this.buildKey(METRICS_GAUGE_PREFIX, name, labels);
      const value = await redis.get(key);
      return value ? parseFloat(value) : 0;
    } catch (error) {
      this.logger.error('Failed to get gauge', error, { metric: name });
      return 0;
    }
  }

  /**
   * Record a histogram observation
   * Histograms track distribution of values (e.g., response times)
   */
  async recordHistogram(
    name: string,
    value: number,
    labels: MetricLabels = {},
    buckets: HistogramBuckets = DEFAULT_RESPONSE_TIME_BUCKETS
  ): Promise<void> {
    try {
      // Increment count for each bucket the value falls into
      for (const bucket of buckets) {
        if (value <= bucket) {
          const bucketKey = this.buildKey(
            METRICS_HISTOGRAM_PREFIX,
            `${name}:bucket:${bucket}`,
            labels
          );
          await redis.incrBy(bucketKey, 1);
        }
      }

      // Also track sum and count for average calculation
      const sumKey = this.buildKey(METRICS_HISTOGRAM_PREFIX, `${name}:sum`, labels);
      const countKey = this.buildKey(METRICS_HISTOGRAM_PREFIX, `${name}:count`, labels);
      
      // Use string operations since we need floating point
      const currentSum = await redis.get(sumKey);
      const newSum = (currentSum ? parseFloat(currentSum) : 0) + value;
      await redis.set(sumKey, newSum.toString());
      await redis.incrBy(countKey, 1);

      this.logger.debug('Histogram recorded', {
        metric: name,
        labels,
        value,
      });
    } catch (error) {
      this.logger.error('Failed to record histogram', error, { metric: name });
    }
  }

  /**
   * Get histogram statistics
   */
  async getHistogramStats(
    name: string,
    labels: MetricLabels = {}
  ): Promise<{ count: number; sum: number; avg: number }> {
    try {
      const sumKey = this.buildKey(METRICS_HISTOGRAM_PREFIX, `${name}:sum`, labels);
      const countKey = this.buildKey(METRICS_HISTOGRAM_PREFIX, `${name}:count`, labels);

      const [sumStr, countStr] = await Promise.all([
        redis.get(sumKey),
        redis.get(countKey),
      ]);

      const sum = sumStr ? parseFloat(sumStr) : 0;
      const count = countStr ? parseInt(countStr, 10) : 0;
      const avg = count > 0 ? sum / count : 0;

      return { count, sum, avg };
    } catch (error) {
      this.logger.error('Failed to get histogram stats', error, { metric: name });
      return { count: 0, sum: 0, avg: 0 };
    }
  }

  /**
   * Record request duration (convenience method)
   */
  async recordRequestDuration(
    endpoint: string,
    method: string,
    statusCode: number,
    durationMs: number
  ): Promise<void> {
    const labels: MetricLabels = {
      endpoint,
      method,
      status: statusCode.toString(),
    };

    await Promise.all([
      this.recordHistogram('http_request_duration_ms', durationMs, labels),
      this.incrementCounter('http_requests_total', labels),
    ]);

    // Track errors separately
    if (statusCode >= 400) {
      await this.incrementCounter('http_errors_total', labels);
    }
  }

  /**
   * Record cache hit/miss
   */
  async recordCacheAccess(
    cacheName: string,
    hit: boolean
  ): Promise<void> {
    const labels: MetricLabels = {
      cache: cacheName,
      result: hit ? 'hit' : 'miss',
    };
    await this.incrementCounter('cache_accesses_total', labels);
  }

  /**
   * Record database query duration
   */
  async recordDatabaseQuery(
    operation: string,
    table: string,
    durationMs: number,
    success: boolean
  ): Promise<void> {
    const labels: MetricLabels = {
      operation,
      table,
      success: success.toString(),
    };
    await this.recordHistogram('database_query_duration_ms', durationMs, labels);
    await this.incrementCounter('database_queries_total', labels);
  }

  /**
   * Build a Redis key from metric name and labels
   */
  private buildKey(prefix: string, name: string, labels: MetricLabels): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    
    return labelStr ? `${prefix}${name}:{${labelStr}}` : `${prefix}${name}`;
  }

  /**
   * Get all metrics summary (for health check / debugging)
   */
  async getMetricsSummary(): Promise<Record<string, unknown>> {
    try {
      const [
        requestStats,
        errorCount,
        cacheHits,
        cacheMisses,
      ] = await Promise.all([
        this.getHistogramStats('http_request_duration_ms'),
        this.getCounter('http_errors_total'),
        this.getCounter('cache_accesses_total', { result: 'hit' }),
        this.getCounter('cache_accesses_total', { result: 'miss' }),
      ]);

      const cacheHitRate = (cacheHits + cacheMisses) > 0
        ? (cacheHits / (cacheHits + cacheMisses)) * 100
        : 0;

      return {
        requests: {
          total: requestStats.count,
          avgDurationMs: Math.round(requestStats.avg * 100) / 100,
          errors: errorCount,
        },
        cache: {
          hits: cacheHits,
          misses: cacheMisses,
          hitRate: `${Math.round(cacheHitRate * 100) / 100}%`,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get metrics summary', error);
      return { error: 'Failed to collect metrics' };
    }
  }
}

/**
 * Global metrics collector instance
 */
export const metrics = new MetricsCollector();

/**
 * Express middleware for tracking request metrics
 */
export function metricsMiddleware() {
  return async (req: any, res: any, next: any) => {
    const startTime = Date.now();

    // Store original end function
    const originalEnd = res.end;

    // Override end to capture metrics
    res.end = function(...args: any[]) {
      const duration = Date.now() - startTime;
      
      // Record metrics asynchronously (don't block response)
      metrics.recordRequestDuration(
        req.path || req.url,
        req.method,
        res.statusCode,
        duration
      ).catch(() => {
        // Silently ignore metric recording failures
      });

      // Call original end
      return originalEnd.apply(this, args);
    };

    next();
  };
}
