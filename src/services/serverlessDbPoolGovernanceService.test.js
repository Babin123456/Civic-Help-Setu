import { describe, it, expect, beforeEach } from 'vitest';
import {
  ServerlessDbPoolGovernanceService,
  DbPoolError
} from './serverlessDbPoolGovernanceService.js';

describe('ServerlessDbPoolGovernanceService', () => {
  let service;

  beforeEach(() => {
    service = new ServerlessDbPoolGovernanceService({
      maxConnections: 3,
      maxQueueDepth: 2,
      acquireTimeoutMs: 100,
      idleTimeoutMs: 500
    });
  });

  it('allocates and reuses connections up to maximum limit', async () => {
    const c1 = await service.acquireConnection('func_1');
    const c2 = await service.acquireConnection('func_2');
    const c3 = await service.acquireConnection('func_3');

    expect(c1.connectionId).toBe('conn_1');
    expect(c2.connectionId).toBe('conn_2');
    expect(c3.connectionId).toBe('conn_3');

    // Release conn_1 and acquire again -> should be reused
    service.releaseConnection(c1.connectionId);
    const reused = await service.acquireConnection('func_4');
    expect(reused.connectionId).toBe('conn_1');
    expect(reused.isReused).toBe(true);
  });

  it('rejects bursts exceeding queue admission depth with POOL_SATURATED', async () => {
    await service.acquireConnection('f1');
    await service.acquireConnection('f2');
    await service.acquireConnection('f3');

    // Fill queue (limit 2)
    const p1 = service.acquireConnection('f4');
    const p2 = service.acquireConnection('f5');

    // 6th concurrent request should be rejected immediately
    await expect(service.acquireConnection('f6')).rejects.toThrow(DbPoolError);
    await expect(service.acquireConnection('f6')).rejects.toThrow('pool saturated');

    // Clean up promises
    service.releaseConnection('conn_1');
    service.releaseConnection('conn_2');
    await p1;
    await p2;
  });

  it('detects and reclaims leaked connections held beyond idle threshold', async () => {
    const c1 = await service.acquireConnection('leaky_function');
    expect(service.getPoolStatus().activeInUse).toBe(1);

    // Artificially age the connection
    const conn = service.activeConnections.get(c1.connectionId);
    conn.acquiredAt = Date.now() - 2000; // 2 seconds ago, timeout is 500ms

    const leaked = service.scanForLeakedConnections();
    expect(leaked.length).toBe(1);
    expect(leaked[0].connectionId).toBe('conn_1');
    expect(service.getPoolStatus().activeInUse).toBe(0); // Reclaimed
  });
});
