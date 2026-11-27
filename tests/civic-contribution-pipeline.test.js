/**
 * tests/civic-contribution-pipeline.test.js
 *
 * API integration, role separation, conflict resolution, rollback, and
 * immutable audit history tests for #1432.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryCivicContributionPipelineStore,
  PROPOSAL_STATUS,
} from '../api/_lib/civicContributionPipelineStore.js';
import handler from '../api/_lib/handlers/civic-contribution-pipeline.js';

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(code) { this.statusCode = code; return this; },
    end(raw) { try { this.body = JSON.parse(raw); } catch { this.body = raw; } return res; },
  };
  return res;
}

describe('civic-contribution-pipeline API & Store (#1432)', () => {
  let store;

  beforeEach(() => {
    store = new InMemoryCivicContributionPipelineStore();
    store.seedEntity('office-1', { officeHours: '09:30-17:30' }, 1);
  });

  it('enforces contributor/publisher separation, self-review block (403), publish (200), rollback (200), and immutable audit log', async () => {
    const contribAuth = { userId: 'contrib-1', role: 'citizen' };
    const pubAuth = { userId: 'pub-1', role: 'publisher' };

    // 1. Contributor submits proposal
    const submitRes = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/civic-contribution-pipeline',
        headers: { 'x-forwarded-for': '10.4.0.1' },
        body: {
          targetEntityId: 'office-1',
          baseRevision: 1,
          beforeFields: { officeHours: '09:30-17:30' },
          proposedFields: { officeHours: '09:30-18:00' },
          sourceAttachment: { sourceUrl: 'https://edistrict.delhigovt.nic.in', effectiveDate: '2026-11-01' },
        },
      },
      submitRes,
      { authUserOverride: contribAuth, storeOverride: store }
    );
    expect(submitRes.statusCode).toBe(201);
    const proposalId = submitRes.body.proposal.proposalId;

    // 2. Contributor cannot publish (403)
    const selfRes = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/civic-contribution-pipeline/review',
        headers: { 'x-forwarded-for': '10.4.0.2' },
        body: { proposalId, decision: 'PUBLISH' },
      },
      selfRes,
      { authUserOverride: contribAuth, storeOverride: store }
    );
    expect(selfRes.statusCode).toBe(403);

    // 3. Even a publisher cannot self-approve their own proposal (403)
    const selfPubSubmit = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/civic-contribution-pipeline',
        headers: { 'x-forwarded-for': '10.4.0.3' },
        body: {
          targetEntityId: 'office-1',
          beforeFields: { a: 1 },
          proposedFields: { a: 2 },
          sourceAttachment: { sourceUrl: 'https://gov.in' },
        },
      },
      selfPubSubmit,
      { authUserOverride: pubAuth, storeOverride: store }
    );
    const selfPubReview = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/civic-contribution-pipeline/review',
        headers: { 'x-forwarded-for': '10.4.0.4' },
        body: { proposalId: selfPubSubmit.body.proposal.proposalId, decision: 'PUBLISH' },
      },
      selfPubReview,
      { authUserOverride: pubAuth, storeOverride: store }
    );
    expect(selfPubReview.statusCode).toBe(403);

    // 4. Independent publisher approves & publishes (200)
    const pubRes = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/civic-contribution-pipeline/review',
        headers: { 'x-forwarded-for': '10.4.0.5' },
        body: { proposalId, decision: 'PUBLISH' },
      },
      pubRes,
      { authUserOverride: pubAuth, storeOverride: store }
    );
    expect(pubRes.statusCode).toBe(200);
    expect(pubRes.body.proposal.status).toBe(PROPOSAL_STATUS.PUBLISHED);
    expect(store.getEntity('office-1').snapshot.officeHours).toBe('09:30-18:00');

    // 5. Rollback restores previous snapshot
    const rbRes = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/civic-contribution-pipeline/rollback',
        headers: { 'x-forwarded-for': '10.4.0.6' },
        body: { proposalId, reason: 'Incorrect circular' },
      },
      rbRes,
      { authUserOverride: pubAuth, storeOverride: store }
    );
    expect(rbRes.statusCode).toBe(200);
    expect(rbRes.body.proposal.status).toBe(PROPOSAL_STATUS.ROLLED_BACK);
    expect(store.getEntity('office-1').snapshot.officeHours).toBe('09:30-17:30');

    // 6. Immutable audit log accessible to publisher (200), blocked for citizen (403)
    const citAudit = createMockRes();
    await handler(
      { method: 'GET', url: '/api/civic-contribution-pipeline/audit-log', headers: { 'x-forwarded-for': '10.4.0.7' } },
      citAudit,
      { authUserOverride: contribAuth, storeOverride: store }
    );
    expect(citAudit.statusCode).toBe(403);

    const pubAudit = createMockRes();
    await handler(
      { method: 'GET', url: '/api/civic-contribution-pipeline/audit-log', headers: { 'x-forwarded-for': '10.4.0.8' } },
      pubAudit,
      { authUserOverride: pubAuth, storeOverride: store }
    );
    expect(pubAudit.statusCode).toBe(200);
    expect(pubAudit.body.items.some((i) => i.action === 'PROPOSAL_ROLLED_BACK')).toBe(true);
  });

  it('detects revision conflicts (409) and allows explicit conflict resolution', async () => {
    const p1 = store.submitProposal({
      targetEntityId: 'office-1',
      contributorId: 'c1',
      baseRevision: 1,
      beforeFields: { officeHours: '09:30-17:30' },
      proposedFields: { officeHours: '09:30-18:00' },
      sourceAttachment: { sourceUrl: 'https://gov.in' },
    }).proposal;

    // Entity advances to revision 2
    store.seedEntity('office-1', { officeHours: '10:00-17:00' }, 2);

    const conflict = store.reviewProposal({ proposalId: p1.proposalId, publisherId: 'pub-1', decision: 'PUBLISH' });
    expect(conflict.status).toBe(409);
    expect(conflict.code).toBe('ERR_REVISION_CONFLICT');

    const resolved = store.reviewProposal({
      proposalId: p1.proposalId,
      publisherId: 'pub-1',
      decision: 'PUBLISH',
      resolveConflict: true,
    });
    expect(resolved.status).toBe(200);
    expect(resolved.proposal.status).toBe(PROPOSAL_STATUS.PUBLISHED);
  });
});

