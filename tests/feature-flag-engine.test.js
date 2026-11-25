import { describe, it, expect, vi } from 'vitest';
import {
  computeBucketBps,
  createFeatureFlagEngine,
  validateFlagRegistry,
} from '../src/services/featureFlagEngine.js';
import { createServerFeatureFlagGateway } from '../api/_lib/featureFlagGateway.js';

function createMockRes() {
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

describe('Deterministic Feature Flag & Gradual Rollout Engine (#1337)', () => {
  it('evaluates sticky and monotonic percentage rollouts deterministically', () => {
    const bpsA = computeBucketBps('civic.ward.heatmap_v2', 'user-101');
    const bpsB = computeBucketBps('civic.ward.heatmap_v2', 'user-101');
    expect(bpsA).toBe(bpsB);

    const engine = createFeatureFlagEngine({
      initialFlags: {
        'civic.ward.heatmap_v2': {
          defaultEnabled: false,
          rolloutPercentage: 10,
          killSwitch: false,
        },
      },
    });

    // Monotonicity: any user enabled at 10% must remain enabled at 50% and 100%
    const enabledAt10 = [];
    for (let i = 0; i < 200; i += 1) {
      if (engine.isEnabled('civic.ward.heatmap_v2', { userId: `u-${i}` })) {
        enabledAt10.push(`u-${i}`);
      }
    }

    engine.upsertFlag('civic.ward.heatmap_v2', {
      defaultEnabled: false,
      rolloutPercentage: 50,
      killSwitch: false,
    });

    for (const userId of enabledAt10) {
      expect(engine.isEnabled('civic.ward.heatmap_v2', { userId })).toBe(true);
    }
  });

  it('enforces emergency kill-switch override and blocklist/allowlist precedence', () => {
    const audits = [];
    const engine = createFeatureFlagEngine({
      onAudit: (e) => audits.push(e),
      initialFlags: {
        'civic.ai.assistant': {
          defaultEnabled: false,
          rolloutPercentage: 0,
          killSwitch: false,
          allowlist: { tenantIds: ['pune-mc'] },
          blocklist: { userIds: ['blocked-user'] },
        },
      },
    });

    expect(engine.isEnabled('civic.ai.assistant', { tenantId: 'pune-mc', userId: 'u-1' })).toBe(true);
    expect(engine.isEnabled('civic.ai.assistant', { tenantId: 'pune-mc', userId: 'blocked-user' })).toBe(false);

    engine.setKillSwitch('civic.ai.assistant', true, { actorId: 'ops-1', reason: 'upstream outage' });
    const res = engine.evaluate('civic.ai.assistant', { tenantId: 'pune-mc', userId: 'u-1' });
    expect(res.enabled).toBe(false);
    expect(res.reason).toBe('kill_switch');
    expect(audits[0].action).toBe('kill_switch_activated');
  });

  it('validates flag schemas and rejects malformed definitions', () => {
    const invalid = validateFlagRegistry({
      'Bad Key!': { defaultEnabled: 'yes', rolloutPercentage: 150 },
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('falls back to static defaults when remote config fails and protects server flags', async () => {
    const gateway = await createServerFeatureFlagGateway({
      remoteLoader: vi.fn().mockRejectedValue(new Error('network timeout')),
      adminToken: 'super-secret-token',
    });

    expect(gateway.isDegraded()).toBe(true);

    // Client GET strips exposure: 'server' flags
    const getRes = createMockRes();
    await gateway.handler({ method: 'GET', headers: {}, query: { userId: 'u-1' } }, getRes);
    expect(getRes.statusCode).toBe(200);
    expect(getRes.body.degraded).toBe(true);
    expect(getRes.body.flags['civic.offline.draft_sync']).toBeDefined();
    expect(getRes.body.flags['civic.ai.grounded_citations']).toBeUndefined();

    // Unauthorized kill-switch mutation is rejected with 403
    const unauthRes = createMockRes();
    await gateway.handler(
      { method: 'POST', headers: {}, body: { flagKey: 'civic.offline.draft_sync', killSwitch: true } },
      unauthRes,
    );
    expect(unauthRes.statusCode).toBe(403);

    // Authorized kill-switch mutation succeeds
    const authRes = createMockRes();
    await gateway.handler(
      {
        method: 'POST',
        headers: { 'x-feature-flag-admin-token': 'super-secret-token' },
        body: { flagKey: 'civic.offline.draft_sync', killSwitch: true, reason: 'emergency' },
      },
      authRes,
    );
    expect(authRes.statusCode).toBe(200);
    expect(authRes.body.evaluation.enabled).toBe(false);
  });
});
