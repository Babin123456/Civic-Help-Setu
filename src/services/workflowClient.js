/**
 * Client service for Durable Civic Agent Workflows (/api/agent-workflows).
 * Generates stable idempotency keys per user action so retries never duplicate side effects.
 */

export function generateIdempotencyKey(prefix = 'wf') {
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`;
}

async function requestWorkflowApi(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data.error || 'request_failed';
    err.data = data;
    throw err;
  }
  return data;
}

export function createWorkflowClient({ getToken } = {}) {
  async function authToken() {
    return typeof getToken === 'function' ? getToken() : null;
  }

  return {
    async listWorkflows() {
      return requestWorkflowApi('/api/agent-workflows', { token: await authToken() });
    },
    async getWorkflow(workflowId) {
      return requestWorkflowApi(`/api/agent-workflows?workflowId=${encodeURIComponent(workflowId)}`, {
        token: await authToken(),
      });
    },
    async startWorkflow({ workflowType, query, serviceId, idempotencyKey = generateIdempotencyKey('start') }) {
      return requestWorkflowApi('/api/agent-workflows', {
        method: 'POST',
        token: await authToken(),
        body: { action: 'start', workflowType, query, serviceId, idempotencyKey },
      });
    },
    async advanceWorkflow({ workflowId, expectedSequence, idempotencyKey = generateIdempotencyKey('step') }) {
      return requestWorkflowApi('/api/agent-workflows', {
        method: 'POST',
        token: await authToken(),
        body: { action: 'advance', workflowId, expectedSequence, idempotencyKey },
      });
    },
    async approveWorkflow({ workflowId, expectedSequence, decision, note = '', idempotencyKey = generateIdempotencyKey('approve') }) {
      return requestWorkflowApi('/api/agent-workflows', {
        method: 'POST',
        token: await authToken(),
        body: { action: 'approve', workflowId, expectedSequence, decision, note, idempotencyKey },
      });
    },
    async deleteWorkflow(workflowId) {
      return requestWorkflowApi(`/api/agent-workflows?workflowId=${encodeURIComponent(workflowId)}`, {
        method: 'DELETE',
        token: await authToken(),
      });
    },
    async listDeadLetters() {
      return requestWorkflowApi('/api/agent-workflows?view=dlq', { token: await authToken() });
    },
    async replayDeadLetter({ workflowId, idempotencyKey = generateIdempotencyKey('replay') }) {
      return requestWorkflowApi('/api/agent-workflows', {
        method: 'POST',
        token: await authToken(),
        body: { action: 'replay_dlq', workflowId, idempotencyKey },
      });
    },
  };
}
