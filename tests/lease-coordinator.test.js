import { describe, it, expect, vi } from 'vitest';
import {
  createInMemoryLeaseStore,
  createLeaseCoordinator,
} from '../api/_lib/leaseCoordinator.js';

describe('Distributed Lease & Leader Election Coordinator (#1461)', () => {
  it('elects a single leader among competing workers and increments fencing tokens on re-acquisition', async () => {
    let clock = 10_000;
    const store = createInMemoryLeaseStore({ now: () => clock });
    const coordinator = createLeaseCoordinator({ store, defaultTtlMs: 5000 });

    const w1 = await coordinator.acquire('retention-job', { holderId: 'worker-1', ttlMs: 5000 });
    const w2 = await coordinator.acquire('retention-job', { holderId: 'worker-2', ttlMs: 5000 });

    expect(w1.acquired).toBe(true);
    expect(w1.fencingToken).toBe(1);
    expect(w2.acquired).toBe(false);
    expect(w2.holderId).toBe('worker-1');

    // Lease expires after TTL; worker-2 reclaims with higher fencing token
    clock += 6000;
    const w2Reclaim = await coordinator.acquire('retention-job', { holderId: 'worker-2', ttlMs: 5000 });
    expect(w2Reclaim.acquired).toBe(true);
    expect(w2Reclaim.fencingToken).toBe(2);

    // Stale worker-1 cannot renew or release worker-2's lease
    const staleRenew = await coordinator.renew('retention-job', { holderId: 'worker-1', fencingToken: 1 });
    expect(staleRenew.renewed).toBe(false);
    expect(staleRenew.reason).toBe('fenced_out');
    expect(coordinator.validateFencingToken('retention-job', 2)).toBe(true);
    expect(coordinator.validateFencingToken('retention-job', 1)).toBe(false);
  });

  it('executes work once under concurrent withLease contention and releases cleanly', async () => {
    const coordinator = createLeaseCoordinator();
    let executions = 0;

    const results = await Promise.all([
      coordinator.withLease('digest-job', 'node-a', async (ctx) => {
        executions += 1;
        await new Promise((r) => setTimeout(r, 20));
        return ctx.fencingToken;
      }),
      coordinator.withLease('digest-job', 'node-b', async () => {
        executions += 1;
        return 'should-not-run';
      }),
    ]);

    expect(executions).toBe(1);
    expect(results.filter((r) => r.executed)).toHaveLength(1);
    expect(results.filter((r) => r.reason === 'held_by_other')).toHaveLength(1);

    // After release, another worker can acquire
    const after = await coordinator.withLease('digest-job', 'node-b', async () => 'ok');
    expect(after.executed).toBe(true);
    expect(after.result).toBe('ok');
  });

  it('fails safe when the backing lease store is unavailable', async () => {
    const brokenStore = {
      acquire: vi.fn().mockRejectedValue(new Error('firestore unavailable')),
      renew: vi.fn(),
      release: vi.fn(),
    };
    const coordinator = createLeaseCoordinator({ store: brokenStore });
    const res = await coordinator.withLease('digest-job', 'node-a', async () => 'never');
    expect(res.executed).toBe(false);
    expect(res.reason).toBe('store_unavailable');
  });
});
