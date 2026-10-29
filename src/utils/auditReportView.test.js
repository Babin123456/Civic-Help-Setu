import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  formatAuditCategory,
  isAuditResolved,
  countOpenAudits,
  getAuditServiceName,
  describeAuditReport,
} from './auditReportView';
import { MOCK_SERVICES } from '../data/services';
import { setCurrentActor } from '../services/accessControl';

// These tests are about what the admin features do; who may use them is tested in accessControl.test.js.
setCurrentActor({ role: 'admin', username: 'Test Admin' });

describe('formatAuditCategory', () => {
  it('replaces every underscore', () => {
    expect(formatAuditCategory('FEES_UPDATE')).toBe('FEES UPDATE');
    expect(formatAuditCategory('A_B_C')).toBe('A B C');
  });

  it('does not throw when the category is missing or not a string', () => {
    expect(formatAuditCategory(undefined)).toBe('GENERAL DISCREPANCY');
    expect(formatAuditCategory(null)).toBe('GENERAL DISCREPANCY');
    expect(formatAuditCategory(42)).toBe('GENERAL DISCREPANCY');
    expect(formatAuditCategory('  ')).toBe('GENERAL DISCREPANCY');
  });
});

describe('isAuditResolved / countOpenAudits', () => {
  it('only the upper case RESOLVED status counts as resolved', () => {
    expect(isAuditResolved({ status: 'RESOLVED' })).toBe(true);
    expect(isAuditResolved({ status: 'resolved' })).toBe(false);
    expect(isAuditResolved({ status: 'COMMUNITY_VERIFIED' })).toBe(false);
    expect(isAuditResolved(undefined)).toBe(false);
  });

  it('counts pending, community verified and disputed reports as open', () => {
    const reports = [
      { status: 'PENDING_CORROBORATION' },
      { status: 'COMMUNITY_VERIFIED' },
      { status: 'DISPUTED' },
      { status: 'RESOLVED' },
    ];
    expect(countOpenAudits(reports)).toBe(3);
  });

  it('is 0 for an empty list or bad input', () => {
    expect(countOpenAudits([])).toBe(0);
    expect(countOpenAudits(null)).toBe(0);
    expect(countOpenAudits([null, { status: 'RESOLVED' }])).toBe(0);
  });
});

describe('getAuditServiceName', () => {
  it('looks the name up from the service list', () => {
    expect(getAuditServiceName({ serviceId: 'income-certificate' }, MOCK_SERVICES)).toBe('Income Certificate');
    expect(getAuditServiceName({ serviceId: 'driving-license' }, MOCK_SERVICES)).toBe('Driving License');
  });

  it('falls back to a readable version of the id', () => {
    expect(getAuditServiceName({ serviceId: 'zebra-crossing-permit' }, MOCK_SERVICES)).toBe('Zebra Crossing Permit');
    expect(getAuditServiceName({ serviceId: 'general' }, [])).toBe('General');
    expect(getAuditServiceName({}, undefined)).toBe('General');
  });
});

describe('describeAuditReport', () => {
  const seeded = {
    id: 'audit-inc-01',
    serviceId: 'income-certificate',
    category: 'FEES_UPDATE',
    title: 'CSC fee revised',
    description: 'Now Rs 50',
    reportedBy: 'Citizen_Voter_42',
    reportedDate: '2026-02-12',
    upvotes: 14,
    downvotes: 1,
    status: 'COMMUNITY_VERIFIED',
    adminNote: null,
  };

  it('maps the fields the audit service really stores', () => {
    const view = describeAuditReport(seeded, MOCK_SERVICES);
    expect(view).toMatchObject({
      id: 'audit-inc-01',
      title: 'CSC fee revised',
      reportedBy: 'Citizen_Voter_42',
      serviceName: 'Income Certificate',
      categoryLabel: 'FEES UPDATE',
      reportedDate: '2026-02-12',
      upvotes: 14,
      downvotes: 1,
      resolved: false,
      adminNote: '',
      tone: 'urgent',
    });
  });

  it('shows a resolved report with its admin note and no resolve button state', () => {
    const view = describeAuditReport({ ...seeded, status: 'RESOLVED', adminNote: 'Updated the notice' }, MOCK_SERVICES);
    expect(view.resolved).toBe(true);
    expect(view.adminNote).toBe('Updated the notice');
    expect(view.tone).toBe('resolved');
  });

  it('uses the pending tone for a report with fewer than 3 upvotes', () => {
    expect(describeAuditReport({ ...seeded, upvotes: 1, status: 'PENDING_CORROBORATION' }, MOCK_SERVICES).tone).toBe('pending');
  });

  it('does not throw on a record that has none of the expected fields', () => {
    const view = describeAuditReport({ id: 'x' }, MOCK_SERVICES);
    expect(view.categoryLabel).toBe('GENERAL DISCREPANCY');
    expect(view.upvotes).toBe(0);
    expect(view.downvotes).toBe(0);
    expect(view.resolved).toBe(false);
    expect(() => describeAuditReport(undefined, MOCK_SERVICES)).not.toThrow();
  });
});

describe('with the default records from communityAuditService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
    });
    vi.stubGlobal('window', {});
  });

  it('every seeded report can be described without throwing and shows a real service name', async () => {
    const { getAuditReports } = await import('../services/communityAuditService');
    const reports = getAuditReports();
    expect(reports.length).toBeGreaterThan(0);
    for (const report of reports) {
      const view = describeAuditReport(report, MOCK_SERVICES);
      expect(typeof view.categoryLabel).toBe('string');
      expect(view.serviceName).not.toBe('General');
      expect(view.resolved).toBe(false);
    }
    expect(countOpenAudits(reports)).toBe(reports.length);
  });

  it('a report is resolved after resolveAuditReport', async () => {
    const { setCurrentActor: signIn } = await import('../services/accessControl'); // fresh module copy after resetModules
    signIn({ role: 'admin', username: 'Test Admin' });
    const { getAuditReports, resolveAuditReport } = await import('../services/communityAuditService');
    const first = getAuditReports()[0];
    resolveAuditReport(first.id, 'Fixed at the counter');
    const after = getAuditReports().find((r) => r.id === first.id);
    const view = describeAuditReport(after, MOCK_SERVICES);
    expect(view.resolved).toBe(true);
    expect(view.adminNote).toBe('Fixed at the counter');
    expect(countOpenAudits(getAuditReports())).toBe(getAuditReports().length - 1);
  });
});
