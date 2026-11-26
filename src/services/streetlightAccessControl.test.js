import { describe, it, expect } from 'vitest';
import {
  resolveStreetlightRole,
  canStreetlight,
  assertStreetlightCapability,
  assertStreetlightJurisdiction,
  isStreetlightStaff,
} from './streetlightAccessControl';
import {
  STREETLIGHT_ROLES,
} from './streetlightConstants';
import { toPublicReportProjection } from './streetlightService';

describe('Streetlight Access Control & Privacy Scope Suite (#756)', () => {
  it('resolves roles with least privilege', () => {
    expect(resolveStreetlightRole(null)).toBe(STREETLIGHT_ROLES.PUBLIC);
    expect(resolveStreetlightRole({})).toBe(STREETLIGHT_ROLES.CITIZEN);
    expect(resolveStreetlightRole({ role: 'citizen' })).toBe(STREETLIGHT_ROLES.CITIZEN);
    expect(resolveStreetlightRole({ role: 'admin' })).toBe(STREETLIGHT_ROLES.ADMIN);
    expect(resolveStreetlightRole({ role: 'admin', streetlightRole: 'technician' })).toBe(STREETLIGHT_ROLES.TECHNICIAN);
    expect(resolveStreetlightRole({ role: 'operator', streetlightRole: 'operator' })).toBe(STREETLIGHT_ROLES.OPERATOR);
  });

  it('verifies staff vs public role determination', () => {
    expect(isStreetlightStaff(null)).toBe(false);
    expect(isStreetlightStaff({ role: 'citizen' })).toBe(false);
    expect(isStreetlightStaff({ role: 'admin' })).toBe(true);
    expect(isStreetlightStaff({ role: 'operator', streetlightRole: 'operator' })).toBe(true);
    expect(isStreetlightStaff({ role: 'technician', streetlightRole: 'technician' })).toBe(true);
  });

  it('enforces capabilities across roles', () => {
    const anon = null;
    const citizen = { id: 'c1', role: 'citizen' };
    const operator = { id: 'op1', role: 'operator', streetlightRole: 'operator' };
    const technician = { id: 'tech1', role: 'technician', streetlightRole: 'technician' };

    // Public / Anonymous can submit reports and view public status
    expect(canStreetlight('report.submit', anon, { allowAnonymous: true })).toBe(true);
    expect(canStreetlight('report.track', anon, { allowAnonymous: true })).toBe(true);

    // Citizen cannot triage clusters or create work orders
    expect(canStreetlight('cluster.triage', citizen)).toBe(false);
    expect(canStreetlight('workOrder.create', citizen)).toBe(false);

    // Operator can triage and create work orders, but not record repair
    expect(canStreetlight('cluster.triage', operator)).toBe(true);
    expect(canStreetlight('workOrder.create', operator)).toBe(true);

    // Technician can record repairs and update work orders
    expect(canStreetlight('workOrder.update', technician)).toBe(true);
    expect(canStreetlight('repair.record', technician)).toBe(true);
    expect(canStreetlight('admin.migration', technician)).toBe(false);
  });

  it('asserts capabilities and throws descriptive errors on denial', () => {
    const citizen = { id: 'c1', role: 'citizen' };
    expect(() => {
      assertStreetlightCapability('workOrder.create', citizen);
    }).toThrow(/Role "citizen" is not permitted/);
  });

  it('enforces jurisdiction scoping for staff actors', () => {
    const scopedOperator = {
      id: 'op1',
      role: 'operator',
      streetlightRole: 'operator',
      jurisdictionId: 'WARD-042',
    };

    // Allowed within assigned ward
    expect(() => {
      assertStreetlightJurisdiction(scopedOperator, 'WARD-042');
    }).not.toThrow();

    // Denied for different ward
    expect(() => {
      assertStreetlightJurisdiction(scopedOperator, 'WARD-084');
    }).toThrow(/Actor is not assigned to jurisdiction/);
  });

  it('guarantees public report projection never exposes reporter PII or private hashes', () => {
    const rawReport = {
      id: 'REP-101',
      trackingToken: 'TRK-STLT-123456',
      assetId: 'POLE-042-101',
      location: {
        addressText: '100ft Road',
        landmark: 'Metro Pillar',
        lat: 12.9782,
        lng: 77.6405,
      },
      faultCategory: 'completely_dark',
      status: 'clustered',
      reporterHash: 'secret_hash_value_do_not_leak',
      contactNumber: '+91 9999988888',
      internalStaffNotes: 'Sensitive note',
    };

    const pub = toPublicReportProjection(rawReport);
    expect(pub.id).toBe('REP-101');
    expect(pub.trackingToken).toBe('TRK-STLT-123456');
    expect(pub.reporterHash).toBeUndefined();
    expect(pub.contactNumber).toBeUndefined();
    expect(pub.internalStaffNotes).toBeUndefined();
  });
});
