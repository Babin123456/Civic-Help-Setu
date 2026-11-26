import { describe, it, expect } from 'vitest';
import {
  classifyRoutePriority,
  createLoadShedder,
  PRIORITY_TIERS,
} from '../api/_lib/loadShedder.js';

function createMockRes() {
  const headers = {};
  const res = {
    statusCode: 200,
    writableEnded: false,
    setHeader(name, value) {
      headers[String(name).toLowerCase()] = value;
      return res;
    },
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.body = payload;
      res.writableEnded = true;
      return res;
    },
  };
  return { res, headers };
}

describe('Priority-Aware Load Shedding Middleware (#1349)', () => {
  it('classifies routes server-side into critical, standard, and sheddable tiers', () => {
    expect(classifyRoutePriority('flood-incident-reports', 'POST')).toBe(PRIORITY_TIERS.CRITICAL);
    expect(classifyRoutePriority('public-toilets', 'GET')).toBe(PRIORITY_TIERS.STANDARD);
    expect(classifyRoutePriority('ward-analytics/summary', 'GET')).toBe(PRIORITY_TIERS.SHEDDABLE);
    expect(classifyRoutePriority('synthetic-datasets', 'POST')).toBe(PRIORITY_TIERS.SHEDDABLE);
  });

  it('sheds sheddable traffic under elevated concurrency while preserving critical writes', async () => {
    const shedder = createLoadShedder({
      mode: 'enforce',
      maxInflight: 5,
      sheddableThresholdRatio: 0.4, // 2 inflight triggers elevated
      standardThresholdRatio: 0.8,  // 4 inflight triggers critical
    });

    let releaseSlow;
    const slowGate = new Promise((resolve) => { releaseSlow = resolve; });

    // Hold 2 concurrent requests inflight
    const p1 = shedder.execute({ method: 'GET' }, createMockRes().res, 'public-toilets', () => slowGate);
    const p2 = shedder.execute({ method: 'GET' }, createMockRes().res, 'public-toilets', () => slowGate);

    // Sheddable route is rejected with 503 + Retry-After
    const shedMock = createMockRes();
    await shedder.execute({ method: 'GET' }, shedMock.res, 'ward-analytics', async () => ({ status: 200 }));
    expect(shedMock.res.statusCode).toBe(503);
    expect(shedMock.headers['retry-after']).toBe('10');
    expect(shedMock.headers['x-load-shed-tier']).toBe(PRIORITY_TIERS.SHEDDABLE);

    // Critical citizen write still succeeds
    const critMock = createMockRes();
    const critRes = await shedder.execute(
      { method: 'POST' },
      critMock.res,
      'flood-incident-reports',
      async () => critMock.res.status(201).json({ ok: true }),
    );
    expect(critRes.statusCode).toBe(201);

    releaseSlow();
    await Promise.all([p1, p2]);
  });

  it('supports shadow mode without blocking requests and tracks EWMA latency pressure', async () => {
    let clock = 1000;
    const metrics = [];
    const shedder = createLoadShedder({
      mode: 'shadow',
      maxInflight: 10,
      ewmaLatencyWarningMs: 100,
      now: () => clock,
      onMetric: (m) => metrics.push(m),
    });

    await shedder.execute({ method: 'GET' }, createMockRes().res, 'public-toilets', async () => {
      clock += 500; // simulate slow downstream
      return 'ok';
    });

    const m = createMockRes();
    const result = await shedder.execute({ method: 'GET' }, m.res, 'synthetic-datasets', async () => 'allowed-in-shadow');
    expect(result).toBe('allowed-in-shadow');
    expect(metrics.some((e) => e.event === 'load_shed' && e.mode === 'shadow')).toBe(true);
  });
});
