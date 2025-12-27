/**
 * Cache Analytics Service
 * 
 * Monitors cache performance and provides insights
 */

import { cacheManager } from './CacheManager';

export interface CacheHealthReport {
  timestamp: Date;
  hitRate: {
    memory: number;
    disk: number;
    overall: number;
  };
  performance: 'excellent' | 'good' | 'fair' | 'poor';
  recommendations: string[];
  stats: {
    memoryHits: number;
    memoryMisses: number;
    diskHits: number;
    diskMisses: number;
    memorySize: number;
    memoryEntries: number;
    evictions: number;
    errors: number;
  };
}

class CacheAnalyticsService {
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: ((report: CacheHealthReport) => void)[] = [];

  /**
   * Start monitoring cache performance
   */
  startMonitoring(intervalMinutes: number = 30): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.checkHealth();
    }, intervalMinutes * 60 * 1000);

    // Run initial check
    this.checkHealth();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Get current cache health report
   */
  checkHealth(): CacheHealthReport {
    const stats = cacheManager.getStats();
    const hitRate = cacheManager.getHitRate();
    const recommendations: string[] = [];

    // Analyze performance
    let performance: CacheHealthReport['performance'] = 'excellent';
    
    if (hitRate.overall < 50) {
      performance = 'poor';
      recommendations.push('Overall hit rate is low. Consider increasing cache TTL or preloading critical data.');
    } else if (hitRate.overall < 70) {
      performance = 'fair';
      recommendations.push('Hit rate could be improved. Review cache TTL settings.');
    } else if (hitRate.overall < 85) {
      performance = 'good';
    }

    // Memory cache analysis
    if (hitRate.memory < 60) {
      recommendations.push('Memory cache hit rate is low. Consider increasing maxMemoryCacheSize.');
    }

    // Eviction analysis
    const totalRequests = stats.memoryHits + stats.memoryMisses;
    if (totalRequests > 0) {
      const evictionRate = (stats.evictions / totalRequests) * 100;
      if (evictionRate > 10) {
        recommendations.push(`High eviction rate (${evictionRate.toFixed(1)}%). Consider increasing memory cache size.`);
      }
    }

    // Error analysis
    if (stats.errors > 10) {
      recommendations.push(`Cache has ${stats.errors} errors. Check logs for details.`);
      performance = 'poor';
    }

    // Memory size analysis
    const memoryMB = stats.memorySize / (1024 * 1024);
    if (memoryMB > 8) {
      recommendations.push(`Memory cache is large (${memoryMB.toFixed(1)}MB). Consider lowering TTL for large objects.`);
    }

    const report: CacheHealthReport = {
      timestamp: new Date(),
      hitRate,
      performance,
      recommendations,
      stats,
    };

    // Notify listeners
    this.notifyListeners(report);

    return report;
  }

  /**
   * Add listener for cache health updates
   */
  addListener(callback: (report: CacheHealthReport) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(report: CacheHealthReport): void {
    this.listeners.forEach(listener => {
      try {
        listener(report);
      } catch (error) {
        console.error('CacheAnalytics: Error in listener', error);
      }
    });
  }

  /**
   * Log cache performance to console (disabled in production)
   */
  logPerformance(): void {
    // Disabled to reduce console noise in production
    // Use getSummary() for UI display instead
  }

  /**
   * Get formatted summary for display in UI
   */
  getSummary(): string {
    const report = this.checkHealth();
    const hitRate = report.hitRate.overall.toFixed(0);
    const memoryMB = (report.stats.memorySize / (1024 * 1024)).toFixed(1);
    
    return `Cache: ${hitRate}% hit rate • ${report.stats.memoryEntries} entries • ${memoryMB}MB`;
  }
}

export const cacheAnalytics = new CacheAnalyticsService();
