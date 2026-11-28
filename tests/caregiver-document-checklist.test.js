import { describe, it, expect } from 'vitest';
import handler from '../api/_lib/handlers/caregiver-document-checklist.js';

function mockRes() {
  const out = { statusCode: 200, body: null };
  return {
    status(code) {
      out.statusCode = code;
      return this;
    },
    json(payload) {
      out.body = payload;
      return out;
    },
  };
}

describe('caregiver-document-checklist API handler', () => {
  it('returns 401 when unauthenticated and 400 when PII is supplied', async () => {
    const unauth = await handler(
      { method: 'GET', url: '/', headers: {}, query: {} },
      mockRes()
    );
    expect(unauth.statusCode).toBe(401);

    const piiBlocked = await handler(
      {
        method: 'POST',
        url: '/households',
        headers: { 'x-user-id': 'caregiver-api-1' },
        body: { householdName: 'Family 1234 5678 9012' },
      },
      mockRes()
    );
    expect(piiBlocked.statusCode).toBe(400);
    expect(piiBlocked.body.error).toBe('pii_rejected');
  });

  it('enforces cross-profile authorization and supports scoped export & delete', async () => {
    const hhRes = await handler(
      {
        method: 'POST',
        url: '/households',
        headers: { 'x-user-id': 'caregiver-api-1' },
        body: { householdName: 'API Household' },
      },
      mockRes()
    );
    expect(hhRes.statusCode).toBe(201);
    const householdId = hhRes.body.household.householdId;

    const personRes = await handler(
      {
        method: 'POST',
        url: '/persons',
        headers: { 'x-user-id': 'caregiver-api-1' },
        body: {
          householdId,
          displayLabel: 'Dependant One',
          consentBasis: 'minor_guardian',
        },
      },
      mockRes()
    );
    expect(personRes.statusCode).toBe(201);
    const personId = personRes.body.person.personId;

    // Cross-profile export attempt by another user -> 403
    const crossExport = await handler(
      {
        method: 'GET',
        url: '/export',
        headers: { 'x-user-id': 'intruder-99' },
        query: { householdId, personId },
      },
      mockRes()
    );
    expect(crossExport.statusCode).toBe(403);

    // Owner export -> 200
    const ownerExport = await handler(
      {
        method: 'GET',
        url: '/export',
        headers: { 'x-user-id': 'caregiver-api-1' },
        query: { householdId, personId },
      },
      mockRes()
    );
    expect(ownerExport.statusCode).toBe(200);
    expect(ownerExport.body.exportPayload.personId).toBe(personId);

    // Owner delete -> 200
    const del = await handler(
      {
        method: 'DELETE',
        url: '/',
        headers: { 'x-user-id': 'caregiver-api-1' },
        query: { householdId, personId },
      },
      mockRes()
    );
    expect(del.statusCode).toBe(200);
  });
});
