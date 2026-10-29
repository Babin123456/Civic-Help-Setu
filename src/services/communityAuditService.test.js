import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAuditReports,
  saveAuditReport,
  voteAuditReport,
  resolveAuditReport
} from './communityAuditService';
import { setCurrentActor } from './accessControl';

// These tests are about what the admin features do; who may use them is tested in accessControl.test.js.
setCurrentActor({ role: 'admin', username: 'Test Admin' });

describe('communityAuditService - Crowdsourced Discrepancy Audits', () => {
  it('retrieves default verified audit reports for services', () => {
    const list = getAuditReports('income-certificate');
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[0].serviceId).toBe('income-certificate');
    expect(list[0].status).toBe('COMMUNITY_VERIFIED');
  });

  it('saves new report with initial PENDING_CORROBORATION state', () => {
    const rep = saveAuditReport({
      serviceId: 'driving-license',
      title: 'Slot booking timings shifted to 10:00 AM',
      description: 'Daily token release happens at 10 AM instead of 8 AM.'
    });
    expect(rep.id).toBeDefined();
    expect(rep.status).toBe('PENDING_CORROBORATION');
    expect(rep.upvotes).toBe(1);
  });

  it('elevates report to COMMUNITY_VERIFIED when net upvotes reach 5', () => {
    const rep = saveAuditReport({
      serviceId: 'ration-card',
      title: 'e-KYC biometric update required for all family members'
    });

    // Cast 4 more upvotes to reach 5 net
    voteAuditReport(rep.id, 'UP');
    voteAuditReport(rep.id, 'UP');
    voteAuditReport(rep.id, 'UP');
    const finalRep = voteAuditReport(rep.id, 'UP');

    expect(finalRep.status).toBe('COMMUNITY_VERIFIED');
  });

  it('allows administrator to mark report as officially RESOLVED with note', () => {
    const rep = saveAuditReport({
      serviceId: 'passport-seva',
      title: 'Police verification dispatch delay'
    });

    const resolved = resolveAuditReport(rep.id, 'Updated official guide with 2026 circular.');
    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.adminNote).toContain('Updated official guide');
  });
});
