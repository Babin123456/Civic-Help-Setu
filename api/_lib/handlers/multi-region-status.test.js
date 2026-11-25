import { describe, it, expect, beforeEach } from 'vitest';
import route from './multi-region-status.js';
import { resetMultiRegionInstance } from '../multiRegionReadIntegration.js';

const createMockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
};

describe('Multi-Region Status Handler (#1233)', () => {
  beforeEach(() => {
    resetMultiRegionInstance();
  });

  it('handles GET health status request', async () => {
    const req = {
      method: 'GET',
      url: '/api/multi-region-health',
      query: {},
      headers: {},
    };
    const res = createMockRes();

    await route(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.health).toBeDefined();
    expect(res.body.health.primaryRegion).toBe('asia-south1');
    expect(res.body.health.replicas).toBeDefined();
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('handles GET metrics request', async () => {
    const req = {
      method: 'GET',
      url: '/api/multi-region-metrics',
      query: { metrics: 'true' },
      headers: {},
    };
    const res = createMockRes();

    await route(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.metrics).toBeDefined();
    expect(res.body.metrics.health).toBeDefined();
    expect(res.body.metrics.tokens).toBeDefined();
    expect(res.body.metrics.controller).toBeDefined();
  });

  it('handles POST admin actions with authorization', async () => {
    const req = {
      method: 'POST',
      url: '/api/multi-region-health',
      headers: {
        'x-user-role': 'admin',
      },
      body: {
        action: 'set_rollout',
        percent: 50,
      },
    };
    const res = createMockRes();

    await route(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.percent).toBe(50);
  });

  it('rejects POST with invalid action', async () => {
    const req = {
      method: 'POST',
      url: '/api/multi-region-health',
      headers: {
        'x-user-role': 'admin',
      },
      body: {
        action: 'unknown_action',
      },
    };
    const res = createMockRes();

    await route(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('handles manual failover and recovery actions', async () => {
    const failoverReq = {
      method: 'POST',
      url: '/api/multi-region-health',
      headers: { 'x-user-role': 'admin' },
      body: { action: 'manual_failover', regionId: 'us-central1', reason: 'High replication lag' },
    };
    const failoverRes = createMockRes();
    await route(failoverReq, failoverRes);
    expect(failoverRes.statusCode).toBe(200);

    const recoveryReq = {
      method: 'POST',
      url: '/api/multi-region-health',
      headers: { 'x-user-role': 'admin' },
      body: { action: 'manual_recovery', regionId: 'us-central1' },
    };
    const recoveryRes = createMockRes();
    await route(recoveryReq, recoveryRes);
    expect(recoveryRes.statusCode).toBe(200);
  });
});
