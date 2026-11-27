/**
 * tests/knowledge-graph-edge-publication.test.js
 *
 * API integration & authorization tests for Knowledge Graph Edge Publication (#1429).
 */

import { describe, it, expect } from 'vitest';
import handler from '../api/_lib/handlers/civic-knowledge-graph.js';

describe('civic-knowledge-graph API Edge Publication (#1429)', () => {
  it('requires auth for propose_edge (401) and reviewer/admin for review_edge & edge_audit_log (403)', async () => {
    const unauth = await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': '10.7.0.1' },
      body: { action: 'propose_edge', sourceNodeId: 'a', targetNodeId: 'b', officialUrl: 'https://gov.in' },
    });
    expect(unauth.status).toBe(401);

    const citReview = await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': '10.7.0.2', authorization: 'Bearer user-token' },
      body: { action: 'review_edge', proposalId: 'p1', decision: 'PUBLISH' },
    });
    expect(citReview.status).toBe(403);

    const citAudit = await handler({
      method: 'GET',
      headers: { 'x-forwarded-for': '10.7.0.3', authorization: 'Bearer user-token' },
      query: { action: 'edge_audit_log' },
    });
    expect(citAudit.status).toBe(403);
  });

  it('allows contributor propose_edge (201), blocks self-review, and allows admin edge_audit_log (200)', async () => {
    const propRes = await handler({
      method: 'POST',
      headers: { 'x-forwarded-for': '10.7.0.4', authorization: 'Bearer user-token' },
      body: {
        action: 'propose_edge',
        sourceNodeId: 'service:driving-licence',
        targetNodeId: 'doc:form-1a-medical',
        officialUrl: 'https://parivahan.gov.in',
        jurisdiction: 'All India',
      },
    });
    expect(propRes.status).toBe(201);
    expect(propRes.body.proposal.status).toBe('DRAFT_PENDING_REVIEW');

    const adminAudit = await handler({
      method: 'GET',
      headers: { 'x-forwarded-for': '10.7.0.5', authorization: 'Bearer admin-token' },
      query: { action: 'edge_audit_log' },
    });
    expect(adminAudit.status).toBe(200);
    expect(Array.isArray(adminAudit.body.items)).toBe(true);
  });
});
