/**
 * tests/office-verification-campaigns.test.js
 *
 * API integration & authorization tests for Civic Office Contact Verification Campaign Manager (#1433).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryOfficeVerificationCampaignStore, PUBLIC_STALE_BADGE } from '../api/_lib/officeVerificationCampaignStore.js';
import handler from '../api/_lib/handlers/office-verification-campaigns.js';

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(code) { this.statusCode = code; return this; },
    end(raw) { try { this.body = JSON.parse(raw); } catch { this.body = raw; } return this; },
  };
  return res;
}

describe('office-verification-campaigns API & Store (#1433)', () => {
  let store;

  beforeEach(() => {
    store = new InMemoryOfficeVerificationCampaignStore();
  });

  it('rejects unauthenticated campaign creation (401) and non-admin batch assignment (403)', async () => {
    const unauthRes = createMockRes();
    await handler(
      { method: 'POST', url: '/api/office-verification-campaigns', headers: { 'x-forwarded-for': '10.3.0.1' }, body: {} },
      unauthRes,
      { storeOverride: store }
    );
    expect(unauthRes.statusCode).toBe(401);

    const citizenRes = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/office-verification-campaigns',
        headers: { 'x-forwarded-for': '10.3.0.2' },
        body: { title: 'Test', assigneeId: 'v1', officeIds: ['o1'] },
      },
      citizenRes,
      { authUserOverride: { userId: 'cit-1', role: 'citizen' }, storeOverride: store }
    );
    expect(citizenRes.statusCode).toBe(403);
  });

  it('completes full lifecycle: batch assign (201) -> submit evidence (200) -> approve (200) -> public list (200) -> audit log (200)', async () => {
    const adminAuth = { userId: 'admin-1', role: 'admin' };
    const verifierAuth = { userId: 'verifier-1', role: 'citizen' };

    // 1. Admin creates campaign
    const createRes = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/office-verification-campaigns',
        headers: { 'x-forwarded-for': '10.3.0.3' },
        body: {
          title: 'Delhi Offices Audit',
          jurisdiction: 'Delhi',
          assigneeId: 'verifier-1',
          officeIds: ['delhi-south-collectorate'],
          expiryPolicyDays: 90,
        },
      },
      createRes,
      { authUserOverride: adminAuth, storeOverride: store }
    );
    expect(createRes.statusCode).toBe(201);
    const campaignId = createRes.body.campaign.campaignId;

    // 2. Verifier submits official-source evidence
    const evRes = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/office-verification-campaigns/submit-evidence',
        headers: { 'x-forwarded-for': '10.3.0.4' },
        body: {
          campaignId,
          officeId: 'delhi-south-collectorate',
          sourceUrl: 'https://edistrict.delhigovt.nic.in',
          effectiveDate: '2026-11-01',
        },
      },
      evRes,
      { authUserOverride: verifierAuth, storeOverride: store }
    );
    expect(evRes.statusCode).toBe(200);
    expect(evRes.body.campaign.offices[0].verificationStatus).toBe('PENDING_REVIEW');

    // 3. Citizen cannot approve (403)
    const citRevRes = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/office-verification-campaigns/review',
        headers: { 'x-forwarded-for': '10.3.0.5' },
        body: { campaignId, officeId: 'delhi-south-collectorate', decision: 'APPROVE' },
      },
      citRevRes,
      { authUserOverride: verifierAuth, storeOverride: store }
    );
    expect(citRevRes.statusCode).toBe(403);

    // 4. Admin approves (200)
    const revRes = createMockRes();
    await handler(
      {
        method: 'POST',
        url: '/api/office-verification-campaigns/review',
        headers: { 'x-forwarded-for': '10.3.0.6' },
        body: { campaignId, officeId: 'delhi-south-collectorate', decision: 'APPROVE', rationale: 'Verified' },
      },
      revRes,
      { authUserOverride: adminAuth, storeOverride: store }
    );
    expect(revRes.statusCode).toBe(200);
    expect(revRes.body.campaign.offices[0].publicBadge).toBe(PUBLIC_STALE_BADGE.VERIFIED_FRESH);

    // 5. Public GET returns campaign with fresh badge
    const listRes = createMockRes();
    await handler(
      { method: 'GET', url: '/api/office-verification-campaigns', headers: { 'x-forwarded-for': '10.3.0.7' } },
      listRes,
      { storeOverride: store }
    );
    expect(listRes.statusCode).toBe(200);
    expect(listRes.body.items[0].offices[0].publicBadge).toBe(PUBLIC_STALE_BADGE.VERIFIED_FRESH);

    // 6. Audit log gated to admin (403 for citizen, 200 for admin)
    const citAudit = createMockRes();
    await handler(
      { method: 'GET', url: '/api/office-verification-campaigns/audit-log', headers: { 'x-forwarded-for': '10.3.0.8' } },
      citAudit,
      { authUserOverride: verifierAuth, storeOverride: store }
    );
    expect(citAudit.statusCode).toBe(403);

    const adminAudit = createMockRes();
    await handler(
      { method: 'GET', url: '/api/office-verification-campaigns/audit-log', headers: { 'x-forwarded-for': '10.3.0.9' } },
      adminAudit,
      { authUserOverride: adminAuth, storeOverride: store }
    );
    expect(adminAudit.statusCode).toBe(200);
    expect(adminAudit.body.items.length).toBe(3);
  });
});
