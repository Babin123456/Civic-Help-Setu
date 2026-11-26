import { describe, it, expect, vi } from 'vitest';
import { normalizeFeedback, FirestoreFeedbackPipeline } from '../api/_lib/feedbackPipeline.js';
import { createFeedbackHandler } from '../api/_lib/handlers/bottleneck-feedback.js';
import { withRequestSecurity } from '../api/_lib/requestSecurity.js';
import { createApiDispatcher } from '../api/[...path].js';
import { resolveTenantContext, checkTenantAccess } from '../src/services/tenantContext.js';

const valid = { serviceId: 'driving-licence', category: 'other', rating: 3, notes: 'Unclear guide' };
const response = () => ({ code: 200, headers: {}, status(code) { this.code = code; return this; },
  setHeader(key, value) { this.headers[key] = value; }, json(body) { this.body = body; return this; }, end() { return this; } });

describe('public guide-feedback trust boundary', () => {
  it('loads through the actual catchall dispatcher, retaining its Origin protection', async () => {
    const handler = withRequestSecurity(createApiDispatcher({ extraHandlers: { 'bottleneck-feedback':
      createFeedbackHandler({ getPipeline: async () => ({ publicMetrics: async () => ({ totalReports: 0 }) }) }),
    } }));
    const res = response();
    await handler({ method: 'GET', url: '/api/bottleneck-feedback', headers: {}, query: { path: 'bottleneck-feedback' } }, res);
    expect(res.code).toBe(200); expect(res.body.totalReports).toBe(0);
  });
  it('keeps the existing tenant jurisdiction fallback without inventing authorization grants', () => {
    const actor = { role: 'operator', jurisdictionIds: ['MUNICIPALITY:IN-KA-BLR-BBMP'] };
    expect(resolveTenantContext(actor).tenantId).toBe('MUNICIPALITY:IN-KA-BLR-BBMP');
    expect(checkTenantAccess(actor, 'MUNICIPALITY:IN-KA-BLR-BBMP').allowed).toBe(true);
    expect(checkTenantAccess(actor, 'MUNICIPALITY:IN-MH-PN-PMC').allowed).toBe(false);
  });
  it('minimizes PII across every free-text field, not only the notes', () => {
    const { data } = normalizeFeedback({ ...valid, serviceName: 'mail@example.com', stepTitle: '9876543210', notes: 'ABCDE1234F' });
    expect(data.piiDetected).toBe(true);
    expect(JSON.stringify(data)).not.toMatch(/mail@example.com|9876543210|ABCDE1234F/);
  });
  it.each([
    null, [], { ...valid, serviceId: '../private' }, { ...valid, category: '__proto__' },
    { ...valid, rating: 2.5 }, { ...valid, rating: '3' }, { ...valid, notes: 'x'.repeat(1501) },
    { ...valid, stepIndex: -1 }, { ...valid, stepTitle: {} },
    { ...valid, attachment: { base64: '%%%=', contentType: 'application/pdf' } },
    { ...valid, attachment: { base64: 'YQ==', contentType: 'text/html' } },
    { ...valid, attachment: { base64: 'YQ=='.repeat(100000), contentType: 'image/png' } },
  ])('rejects malformed/unbounded input %#', body => expect(() => normalizeFeedback(body)).toThrow());
  it('does not turn an allowed MIME label into a scanner verdict', () => {
    const { attachment } = normalizeFeedback({ ...valid, attachment: { base64: 'YQ==', contentType: 'image/png', state: 'clean' } });
    expect(attachment.size).toBe(1); expect(attachment.state).toBeUndefined();
  });
  it('fails closed without a configured secret or with invalid limits', () => {
    expect(() => new FirestoreFeedbackPipeline({}, {})).toThrow('feedback_configuration_unavailable');
    expect(() => new FirestoreFeedbackPipeline({}, { secret: 's'.repeat(32), limit: NaN })).toThrow();
  });
  it.each([401, 403, 503])('does not access storage after moderator authorization fails (%s)', async status => {
    const getPipeline = vi.fn(), handler = createFeedbackHandler({ getPipeline, authorizeModerator: async () => ({ status }) });
    for (const req of [{ method: 'PATCH', body: { role: 'admin' } }, { method: 'GET', query: { view: 'moderation' } },
      { method: 'GET', query: { view: 'audit' } }, { method: 'GET', query: { view: 'attachment' } }]) {
      const res = response(); await handler(req, res); expect(res.code).toBe(status);
    }
    expect(getPipeline).not.toHaveBeenCalled();
  });
  it('uses the verified identity, not spoofed body actor or review timestamp', async () => {
    const review = vi.fn(async () => ({ revision: 1 }));
    const handler = createFeedbackHandler({ getPipeline: async () => ({ review }), authorizeModerator: async () => ({ userId: 'verified-admin' }) });
    const res = response(); await handler({ method: 'PATCH', body: { id: 'id', status: 'addressed', revision: 0, reviewedBy: 'attacker' } }, res);
    expect(review.mock.calls[0][2]).toBe('verified-admin'); expect(res.code).toBe(200);
  });
  it('returns a retryable generic failure without leaking dependency secrets', async () => {
    const handler = createFeedbackHandler({ getPipeline: async () => { throw new Error('credential-secret'); } });
    const res = response(); await handler({ method: 'GET', query: {} }, res);
    expect(res.code).toBe(503); expect(res.body).toEqual({ error: 'feedback_unavailable' });
  });
  it('never acknowledges a write that failed; preserves the idempotency key for safe retry', async () => {
    const submit = vi.fn().mockRejectedValueOnce(new Error('storage offline')).mockResolvedValueOnce({ id: 'receipt' });
    const handler = createFeedbackHandler({ getPipeline: async () => ({ submit }), identify: async () => ({ id: 'network:synthetic' }) });
    const req = { method: 'POST', headers: { 'Idempotency-Key': 'test-'.repeat(4) }, body: valid };
    const first = response(); await handler(req, first); expect(first.code).toBe(503);
    const retry = response(); await handler(req, retry); expect(retry.code).toBe(201);
    expect(submit.mock.calls[0][1]).toBe(submit.mock.calls[1][1]);
  });
  it('keeps the shared Origin/CSRF wrapper in front of public mutations', async () => {
    const submit = vi.fn(), handler = withRequestSecurity(createFeedbackHandler({ getPipeline: async () => ({ submit }) }));
    const res = response(); await handler({ method: 'POST', headers: { origin: 'https://attacker.invalid' }, body: valid }, res);
    expect(res.code).toBe(403); expect(submit).not.toHaveBeenCalled();
  });
  it('returns Retry-After on a durable quota rejection', async () => {
    const handler = createFeedbackHandler({ identify: async () => ({ id: 'network:fixture' }), getPipeline: async () => ({ submit: async () => { throw Object.assign(new Error(), { code: 'rate_limited' }); } }) });
    const res = response(); await handler({ method: 'POST', headers: {}, body: valid }, res);
    expect(res.code).toBe(429); expect(res.headers['Retry-After']).toBe('60');
  });
});
