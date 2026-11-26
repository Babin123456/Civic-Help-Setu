import { describe, it, expect, beforeEach } from 'vitest';
import handler from '../api/_lib/handlers/agent-incident-response.js';
import { civicAgentIncidentResponse, BREAKER_STATES } from '../src/services/incidentResponse/civicAgentIncidentResponseService.js';

function createMockReqRes({ method = 'GET', body = null, headers = {} } = {}) {
  const req = {
    method,
    body,
    headers: { 'x-forwarded-for': '127.0.0.1', ...headers }
  };
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(k, v) {
      this.headers[k] = v;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return { req, res };
}

describe('Agent Incident Response API Endpoint', () => {
  beforeEach(() => {
    // Reset singleton state
    civicAgentIncidentResponse.globalKillSwitchActive = false;
    civicAgentIncidentResponse.globalKillReason = null;
    civicAgentIncidentResponse.revokedTools.clear();
    civicAgentIncidentResponse.quarantinedQueue.length = 0;
  });

  it('GET returns operational snapshot', async () => {
    const { req, res } = createMockReqRes({ method: 'GET' });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.globalKillSwitch.active).toBe(false);
    expect(res.body.data.agents['civic-assistant']).toBeDefined();
  });

  it('POST validates required fields and fails gracefully on malformed payload', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      body: { action: 'INVALID_ACTION' }
    });
    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('POST ENGAGE_KILL_SWITCH triggers global lockdown', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      body: {
        action: 'ENGAGE_KILL_SWITCH',
        actorId: 'ADMIN_OPERATOR_1',
        reason: 'Suspected LLM prompt leakage across sessions'
      }
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(civicAgentIncidentResponse.globalKillSwitchActive).toBe(true);
    expect(civicAgentIncidentResponse.globalKillReason).toContain('prompt leakage');
  });

  it('POST TRIP_BREAKER trips a specific agent into OPEN state', async () => {
    const { req, res } = createMockReqRes({
      method: 'POST',
      body: {
        action: 'TRIP_BREAKER',
        agentId: 'service-simplifier',
        actorId: 'OPERATOR_42',
        reason: 'Excessive latency on Marathi translation synthesis'
      }
    });
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(civicAgentIncidentResponse.getBreaker('service-simplifier').state).toBe(BREAKER_STATES.OPEN);
  });

  it('POST REVOKE_TOOL and RESTORE_TOOL updates tool revocation list', async () => {
    // Revoke
    const { req: req1, res: res1 } = createMockReqRes({
      method: 'POST',
      body: {
        action: 'REVOKE_TOOL',
        toolName: 'saveApplicationDraft',
        actorId: 'SECOPS_OFFICER',
        reason: 'Database lock contention'
      }
    });
    await handler(req1, res1);

    expect(res1.statusCode).toBe(200);
    expect(civicAgentIncidentResponse.isToolRevoked('saveApplicationDraft')).toBe(true);

    // Restore
    const { req: req2, res: res2 } = createMockReqRes({
      method: 'POST',
      body: {
        action: 'RESTORE_TOOL',
        toolName: 'saveApplicationDraft',
        actorId: 'SECOPS_OFFICER',
        reason: 'Lock contention resolved'
      }
    });
    await handler(req2, res2);

    expect(res2.statusCode).toBe(200);
    expect(civicAgentIncidentResponse.isToolRevoked('saveApplicationDraft')).toBe(false);
  });

  it('POST manages recovery checklist progression and sign-off', async () => {
    // 1. Create Checklist
    const { req: req1, res: res1 } = createMockReqRes({
      method: 'POST',
      body: {
        action: 'CREATE_CHECKLIST',
        incidentId: 'inc-999',
        agentId: 'civic-assistant',
        actorId: 'INCIDENT_LEAD'
      }
    });
    await handler(req1, res1);
    expect(res1.statusCode).toBe(200);

    // 2. Step Checklist
    const { req: req2, res: res2 } = createMockReqRes({
      method: 'POST',
      body: {
        action: 'STEP_CHECKLIST',
        incidentId: 'inc-999',
        stepId: 'ROOT_CAUSE_IDENTIFIED',
        completed: true,
        notes: 'Root cause was network latency',
        actorId: 'INCIDENT_LEAD'
      }
    });
    await handler(req2, res2);
    expect(res2.statusCode).toBe(200);
  });
});
