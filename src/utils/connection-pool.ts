/**
 * HTTP connection pool configuration and management.
 * Prevents connection exhaustion under high load.
 */

import { AxiosInstance } from 'axios';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';

export interface PoolConfig {
  /** Maximum number of sockets to keep alive per host. Defaults to 50. */
  maxSockets?: number;
  /** Maximum number of requests to queue when sockets are at max. Defaults to 256. */
  maxFreeSockets?: number;
  /** Socket timeout in milliseconds. Defaults to 60000. */
  socketTimeoutMs?: number;
  /** Keep-alive timeout in milliseconds. Defaults to 30000. */
  keepAliveTimeoutMs?: number;
  /** Keep-alive initial delay in milliseconds. Defaults to 1000. */
  keepAliveInitialDelayMs?: number;
}

export const DEFAULT_POOL_CONFIG: Required<PoolConfig> = {
  maxSockets: 50,
  maxFreeSockets: 256,
  socketTimeoutMs: 60_000,
  keepAliveTimeoutMs: 30_000,
  keepAliveInitialDelayMs: 1_000,
};

/**
 * Creates HTTP agent with connection pooling.
 */
export function createHttpAgent(config?: PoolConfig): HttpAgent {
  const finalConfig = { ...DEFAULT_POOL_CONFIG, ...config };

  const agent = new HttpAgent({
    keepAlive: true,
    maxSockets: finalConfig.maxSockets,
    maxFreeSockets: finalConfig.maxFreeSockets,
    timeout: finalConfig.socketTimeoutMs,
    keepAliveMsecs: finalConfig.keepAliveInitialDelayMs,
  });

  if (finalConfig.keepAliveTimeoutMs > 0) {
    agent.keepSocketAlive = true;
  }

  return agent;
}

/**
 * Creates HTTPS agent with connection pooling.
 */
export function createHttpsAgent(config?: PoolConfig): HttpsAgent {
  const finalConfig = { ...DEFAULT_POOL_CONFIG, ...config };

  const agent = new HttpsAgent({
    keepAlive: true,
    maxSockets: finalConfig.maxSockets,
    maxFreeSockets: finalConfig.maxFreeSockets,
    timeout: finalConfig.socketTimeoutMs,
    keepAliveMsecs: finalConfig.keepAliveInitialDelayMs,
  });

  if (finalConfig.keepAliveTimeoutMs > 0) {
    agent.keepSocketAlive = true;
  }

  return agent;
}

/**
 * Applies connection pool configuration to an Axios instance.
 * Configures both HTTP and HTTPS agents.
 */
export function configureAxiosConnectionPool(instance: AxiosInstance, config?: PoolConfig): void {
  const httpAgent = createHttpAgent(config);
  const httpsAgent = createHttpsAgent(config);

  instance.defaults.httpAgent = httpAgent;
  instance.defaults.httpsAgent = httpsAgent;
}

/**
 * Pool statistics for monitoring and debugging.
 */
export interface PoolStats {
  totalSockets: number;
  freeSockets: number;
  socketsPerHost: Record<string, number>;
  requestsQueued: number;
}

/**
 * Gets current pool statistics from an HTTP agent.
 */
export function getHttpAgentStats(agent: HttpAgent): PoolStats {
  return {
    totalSockets: agent.sockets ? Object.keys(agent.sockets).length : 0,
    freeSockets: agent.freeSockets ? Object.keys(agent.freeSockets).length : 0,
    socketsPerHost: agent.sockets ?? {},
    requestsQueued: agent.requests ? Object.keys(agent.requests).length : 0,
  };
}

/**
 * Closes all connections in a pool agent.
 * Should be called during graceful shutdown.
 */
export function destroyPoolAgent(agent: HttpAgent | HttpsAgent): void {
  agent.destroy();
}

/**
 * Configuration for monitoring pool health.
 */
export interface PoolMonitorConfig {
  /** Interval to check pool stats in milliseconds. Defaults to 10000. */
  checkIntervalMs?: number;
  /** Callback when pool stats are collected. */
  onStats?: (stats: PoolStats) => void;
  /** Callback when warnings are triggered. */
  onWarning?: (warning: string) => void;
  /** Warning threshold for free sockets. If below this, triggers warning. */
  warningFreeSocketsThreshold?: number;
}

/**
 * Monitors pool agent health and collects statistics.
 * Returns a cleanup function to stop monitoring.
 */
export function monitorPoolHealth(
  agent: HttpAgent | HttpsAgent,
  config?: PoolMonitorConfig,
): () => void {
  const finalConfig = {
    checkIntervalMs: config?.checkIntervalMs ?? 10_000,
    warningFreeSocketsThreshold: config?.warningFreeSocketsThreshold ?? 10,
  };

  const interval = setInterval(() => {
    const stats = getHttpAgentStats(agent as HttpAgent);

    if (config?.onStats) {
      config.onStats(stats);
    }

    if (stats.freeSockets < finalConfig.warningFreeSocketsThreshold) {
      const warning = `Connection pool running low: ${stats.freeSockets} free sockets remaining`;
      if (config?.onWarning) {
        config.onWarning(warning);
      }
    }
  }, finalConfig.checkIntervalMs);

  return () => clearInterval(interval);
}
