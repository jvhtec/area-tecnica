import { supabase } from '@/lib/supabase-client';
import { withRetry, safeQuery } from '@/lib/supabaseRetry';

/**
 * Emergency database client with strict connection limits and graceful degradation
 */

// Connection pool management
class ConnectionPool {
  private activeConnections = 0;
  private maxConnections = 3; // Severely limit connections
  private queue: Array<() => void> = [];
  private connectionTimeouts = new Map<string, NodeJS.Timeout>();

  async acquireConnection<T>(operation: () => Promise<T>, timeoutMs = 5000): Promise<T> {
    return new Promise((resolve, reject) => {
      const executeOperation = async () => {
        if (this.activeConnections >= this.maxConnections) {
          // Queue the operation
          this.queue.push(() => this.executeWithConnection(operation, resolve, reject, timeoutMs));
          return;
        }

        await this.executeWithConnection(operation, resolve, reject, timeoutMs);
      };

      executeOperation().catch(reject);
    });
  }

  private async executeWithConnection<T>(
    operation: () => Promise<T>,
    resolve: (value: T) => void,
    reject: (error: any) => void,
    timeoutMs: number
  ) {
    this.activeConnections++;
    
    const connectionId = `conn_${Date.now()}_${Math.random()}`;
    
    // Set connection timeout
    const timeout = setTimeout(() => {
      this.activeConnections--;
      this.processQueue();
      reject(new Error('Connection timeout'));
    }, timeoutMs);
    
    this.connectionTimeouts.set(connectionId, timeout);

    try {
      const result = await operation();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      // Cleanup
      clearTimeout(timeout);
      this.connectionTimeouts.delete(connectionId);
      this.activeConnections--;
      this.processQueue();
    }
  }

  private processQueue() {
    if (this.queue.length > 0 && this.activeConnections < this.maxConnections) {
      const next = this.queue.shift();
      if (next) {
        setTimeout(next, 100); // Small delay between operations
      }
    }
  }

  getStats() {
    return {
      activeConnections: this.activeConnections,
      queuedOperations: this.queue.length,
      maxConnections: this.maxConnections
    };
  }
}

const connectionPool = new ConnectionPool();

/**
 * Emergency query function with strict timeouts and fallbacks
 */
export const emergencyQuery = async <T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  fallbackValue: T,
  maxRetries = 1
): Promise<{ data: T; error: any; fromCache?: boolean }> => {
  try {
    const result = await connectionPool.acquireConnection(async () => {
      return await withRetry(queryFn, maxRetries, 1000);
    }, 3000); // 3 second timeout

    return await safeQuery(async () => result, fallbackValue);
  } catch (error) {
    console.warn('Emergency query failed, using fallback:', error);
    return {
      data: fallbackValue,
      error: null,
      fromCache: true
    };
  }
};

/**
 * Critical data queries with absolute minimal complexity
 */
export const emergencyQueries = {
  // Simplified jobs query - no joins, no complex relations
  async getJobs() {
    return emergencyQuery(
      async () => {
        const result = await supabase
          .from('jobs')
          .select('id, title, start_time, end_time, status, color, job_type')
          .order('start_time', { ascending: true })
          .limit(50);
        return result;
      },
      []
    );
  },

  // Simplified profiles query
  async getProfiles() {
    return emergencyQuery(
      async () => {
        const result = await supabase
          .from('profiles')
          .select('id, first_name, last_name, department, role')
          .limit(100);
        return result;
      },
      []
    );
  },

  // Simplified assignments query
  async getJobAssignments(jobId?: string) {
    return emergencyQuery(
      async () => {
        const query = supabase
          .from('job_assignments')
          .select('id, job_id, technician_id, sound_role, lights_role, video_role, status');
        
        if (jobId) {
          query.eq('job_id', jobId);
        }
        
        const result = await query.limit(200);
        return result;
      },
      []
    );
  },

  // User preferences with fallback
  async getUserPreferences(userId: string) {
    return emergencyQuery(
      async () => {
        const result = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', userId)
          .single();
        return result;
      },
      {
        user_id: userId,
        calendar_view: 'month',
        theme: 'system',
        notifications_enabled: true,
        email_notifications: true
      }
    );
  }
};

/**
 * Database health checker with minimal overhead
 */
export const checkDatabaseHealth = async (): Promise<{
  isHealthy: boolean;
  responseTime: number;
  connectionStats: any;
}> => {
  const startTime = Date.now();
  
  try {
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);
    
    const responseTime = Date.now() - startTime;
    
    return {
      isHealthy: !error && responseTime < 2000,
      responseTime,
      connectionStats: connectionPool.getStats()
    };
  } catch (error) {
    return {
      isHealthy: false,
      responseTime: Date.now() - startTime,
      connectionStats: connectionPool.getStats()
    };
  }
};