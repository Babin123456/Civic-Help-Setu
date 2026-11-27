import { describe, it, expect } from 'vitest';
import { createShadowMirror, diffResponses } from '../api/_lib/shadowMirror.js';

function createMockRes() {
  const res = {
    statusCode: 200,
    body: undefined,
    setHeader() { return res; },
    status(c) { res.statusCode = c; return res; },
    json(p) { res.body = p; return res; },
    send(p) { res.body = p; return res; },
  };
  return res;
}

describe('Deterministic Request Replay & Shadow-Traffic Mirroring (#1463)', () => {
  it('returns primary response immediately and reports PII-scrubbed diffs', async () => {
    const reports = [];
    const mirror = createShadowMirror({
      sampleRatePercent: 100,
      onReport: (r) => reports.push(r),
    });

    const primary = async (req, res) =>
      res.status(200).json({ ok: true, email: 'citizen@example.com', timestamp: 1 });
    const shadow = async (req, res) =>
      res.status(200).json({ ok: false, email: 'citizen@example.com', timestamp: 999 });

    const wrapped = mirror.wrap('public-toilets', primary, shadow);
    const res = createMockRes();
    await wrapped({ method: 'GET', url: '/api/public-toilets', headers: { 'x-correlation-id': 'c-1' } }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);

    await mirror.flush();
    expect(reports).toHaveLength(1);
    expect(reports[0].event).toBe('shadow_comparison');
    expect(reports[0].matched).toBe(false);
    expect(JSON.stringify(reports[0])).not.toContain('citizen@example.com');
  });

  it('isolates shadow timeouts and errors without affecting primary responses', async () => {
    const reports = [];
    const mirror = createShadowMirror({
      sampleRatePercent: 100,
      timeoutMs: 20,
      onReport: (r) => reports.push(r),
    });

    const primary = async (req, res) => res.status(200).json({ healthy: true });
    const slowShadow = async () => new Promise((r) => setTimeout(() => r({ status: 200, body: {} }), 200));

    const wrapped = mirror.wrap('civic-surveys', primary, slowShadow);
    const res = createMockRes();
    await wrapped({ method: 'GET', url: '/api/civic-surveys', headers: {} }, res);
    expect(res.statusCode).toBe(200);

    await mirror.flush();
    expect(reports[0].event).toBe('shadow_error');
    expect(reports[0].error).toContain('Shadow timeout');
  });

  it('skips non-safe methods by default and ignores configured volatile fields', async () => {
    const reports = [];
    const mirror = createShadowMirror({
      sampleRatePercent: 100,
      onReport: (r) => reports.push(r),
    });

    const primary = async (req, res) => res.status(201).json({ id: 1 });
    const shadow = async (req, res) => res.status(201).json({ id: 2 });

    const wrapped = mirror.wrap('public-toilets', primary, shadow);
    await wrapped({ method: 'POST', url: '/api/public-toilets', headers: {} }, createMockRes());
    await mirror.flush();
    expect(reports).toHaveLength(0);

    const diff = diffResponses(
      { status: 200, body: { ok: true, generatedAt: 't1' } },
      { status: 200, body: { ok: true, generatedAt: 't2' } },
      { ignoreFields: ['generatedAt'] },
    );
    expect(diff.matched).toBe(true);
  });
});
