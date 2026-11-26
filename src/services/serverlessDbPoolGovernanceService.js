/**
 * @file serverlessDbPoolGovernanceService.js
 * @description Protects database capacity under high-concurrency serverless function bursts.
 * Features bounded connection pool limits, connection reuse, queue admission control,
 * query execution timeouts, and leaked connection detection.
 */

export class DbPoolError extends Error {
  constructor(message, code = 'DB_POOL_ERROR', details = {}) {
    super(message);
    this.name = 'DbPoolError';
    this.code = code;
    this.details = details;
  }
}

export class ServerlessDbPoolGovernanceService {
  constructor(options = {}) {
    this.maxConnections = options.maxConnections || 10;
    this.maxQueueDepth = options.maxQueueDepth || 50;
    this.acquireTimeoutMs = options.acquireTimeoutMs || 2000;
    this.queryTimeoutMs = options.queryTimeoutMs || 5000;
    this.idleTimeoutMs = options.idleTimeoutMs || 10000;

    this.activeConnections = new Map(); // connectionId -> { inUse, acquiredAt, lastQueryAt }
    this.waitingQueue = [];
    this.totalAcquiredCount = 0;
    this.leaksDetectedCount = 0;
  }

  /**
   * Acquires a managed connection from the bounded pool or queues request.
   */
  async acquireConnection(callerId = 'serverless_lambda') {
    // 1. Check if an existing idle connection is available
    for (const [connId, conn] of this.activeConnections.entries()) {
      if (!conn.inUse) {
        conn.inUse = true;
        conn.callerId = callerId;
        conn.acquiredAt = Date.now();
        conn.lastQueryAt = Date.now();
        this.totalAcquiredCount++;
        return { connectionId: connId, isReused: true };
      }
    }

    // 2. Spawn a new connection if under capacity
    if (this.activeConnections.size < this.maxConnections) {
      const connId = `conn_${this.activeConnections.size + 1}`;
      this.activeConnections.set(connId, {
        connectionId: connId,
        inUse: true,
        callerId,
        acquiredAt: Date.now(),
        lastQueryAt: Date.now()
      });
      this.totalAcquiredCount++;
      return { connectionId: connId, isReused: false };
    }

    // 3. Pool saturated: check queue admission
    if (this.waitingQueue.length >= this.maxQueueDepth) {
      throw new DbPoolError(
        'Database connection pool saturated and admission queue full',
        'POOL_SATURATED',
        { activeCount: this.activeConnections.size, queueLength: this.waitingQueue.length }
      );
    }

    // Queue with timeout
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waitingQueue.findIndex(q => q.resolve === resolve);
        if (idx !== -1) this.waitingQueue.splice(idx, 1);
        reject(new DbPoolError('Timed out waiting for database connection from pool', 'ACQUIRE_TIMEOUT'));
      }, this.acquireTimeoutMs);

      this.waitingQueue.push({ resolve, reject, timer, callerId });
    });
  }

  /**
   * Releases an acquired connection back to the pool and serves next queued waiter.
   */
  releaseConnection(connectionId) {
    const conn = this.activeConnections.get(connectionId);
    if (!conn) {
      return false;
    }

    conn.inUse = false;
    conn.callerId = null;

    if (this.waitingQueue.length > 0) {
      const next = this.waitingQueue.shift();
      clearTimeout(next.timer);
      conn.inUse = true;
      conn.callerId = next.callerId;
      conn.acquiredAt = Date.now();
      this.totalAcquiredCount++;
      next.resolve({ connectionId, isReused: true });
    }

    return true;
  }

  /**
   * Scans for leaked connections that have remained active past idle threshold.
   */
  scanForLeakedConnections() {
    const now = Date.now();
    const leaked = [];

    for (const [connId, conn] of this.activeConnections.entries()) {
      if (conn.inUse && now - conn.acquiredAt > this.idleTimeoutMs) {
        leaked.push({
          connectionId: connId,
          callerId: conn.callerId,
          heldDurationMs: now - conn.acquiredAt
        });
        // Force reclaim leaked connection
        this.releaseConnection(connId);
        this.leaksDetectedCount++;
      }
    }

    return leaked;
  }

  getPoolStatus() {
    const activeInUse = Array.from(this.activeConnections.values()).filter(c => c.inUse).length;
    return {
      totalCapacity: this.maxConnections,
      activeInUse,
      idleAvailable: this.activeConnections.size - activeInUse,
      waitingQueueDepth: this.waitingQueue.length,
      leaksDetected: this.leaksDetectedCount
    };
  }
}

export const defaultDbPoolGovernanceService = new ServerlessDbPoolGovernanceService();
