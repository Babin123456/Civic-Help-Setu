import { describe, it, expect } from 'vitest';
import {
  assertGhgCapability,
  assertGhgJurisdiction,
  canGhg,
  describeActorScope,
  filterByJurisdiction,
  isGhgStaff,
  resolveActorJurisdictions,
  resolveGhgRole,
} from './ghgInventoryAccessControl.js';
import { GHG_ERROR_CODES, GHG_ROLES } from './ghgInventoryConstants.js';
import { GhgInventoryError } from './ghgInventoryValidation.js';

const admin = { id: 'admin-1', role: 'admin' };
const reviewer = { id: 'reviewer-1', role: 'staff', ghgRole: 'reviewer', jurisdictionId: 'WARD-042' };
const operator = { id: 'operator-1', role: 'staff', ghgRole: 'operator', jurisdictionId: 'WARD-042' };
const citizen = { id: 'citizen-1', role: 'citizen' };

const expectGhgError = (fn, code) => {
  try {
    fn();
    throw new Error('Expected a GhgInventoryError');
  } catch (error) {
    expect(error).toBeInstanceOf(GhgInventoryError);
    expect(error.code).toBe(code);
  }
};

describe('GHG inventory access control (#753)', () => {
  it('resolves public, staff and administrator roles from verified claims', () => {
    expect(resolveGhgRole(null)).toBe(GHG_ROLES.PUBLIC);
    expect(resolveGhgRole(citizen)).toBe(GHG_ROLES.CITIZEN);
    expect(resolveGhgRole(reviewer)).toBe(GHG_ROLES.REVIEWER);
    expect(resolveGhgRole(operator)).toBe(GHG_ROLES.OPERATOR);
    expect(resolveGhgRole(admin)).toBe(GHG_ROLES.ADMIN);
    expect(resolveGhgRole({ role: 'admin', ghgRole: 'reviewer' })).toBe(GHG_ROLES.REVIEWER);
    expect(isGhgStaff(reviewer)).toBe(true);
    expect(isGhgStaff(citizen)).toBe(false);
  });

  it('enforces capability rules on the trusted boundary', () => {
    expect(canGhg('inventory.view_public', citizen)).toBe(true);
    expect(canGhg('inventory.view_staff', citizen)).toBe(false);
    expect(canGhg('inventory.view_staff', operator)).toBe(true);
    expect(canGhg('submission.create', operator)).toBe(true);
    expect(canGhg('submission.create', reviewer)).toBe(false);
    expect(canGhg('submission.review', reviewer)).toBe(true);
    expect(canGhg('factor.publish', reviewer)).toBe(false);
    expect(canGhg('factor.publish', admin)).toBe(true);
    expect(canGhg('audit.read', operator)).toBe(false);
    expect(canGhg('audit.read', reviewer)).toBe(true);
  });

  it('rejects unauthenticated, under-privileged and unknown capabilities with stable codes', () => {
    expectGhgError(
      () => assertGhgCapability('inventory.view_staff', null),
      GHG_ERROR_CODES.UNAUTHENTICATED
    );
    expectGhgError(
      () => assertGhgCapability('inventory.view_staff', citizen),
      GHG_ERROR_CODES.PERMISSION_DENIED
    );
    expectGhgError(
      () => assertGhgCapability('does.not.exist', admin),
      GHG_ERROR_CODES.PERMISSION_DENIED
    );
    expect(assertGhgCapability('inventory.view_staff', operator)).toBe(GHG_ROLES.OPERATOR);
  });

  it('scopes every staff operation to an assigned jurisdiction', () => {
    expectGhgError(
      () => assertGhgJurisdiction(operator, 'WARD-084'),
      GHG_ERROR_CODES.JURISDICTION_DENIED
    );
    expectGhgError(
      () => assertGhgJurisdiction({ role: 'staff', ghgRole: 'operator' }, 'WARD-042'),
      GHG_ERROR_CODES.JURISDICTION_DENIED
    );
    expectGhgError(
      () => assertGhgJurisdiction(operator, ''),
      GHG_ERROR_CODES.VALIDATION_ERROR
    );
    expect(() => assertGhgJurisdiction(operator, 'ward-042')).not.toThrow();
    expect(() => assertGhgJurisdiction(admin, 'WARD-084')).not.toThrow();
  });

  it('filters collections by assigned jurisdictions', () => {
    const items = [
      { id: '1', jurisdictionId: 'WARD-042' },
      { id: '2', jurisdictionId: 'WARD-084' },
    ];
    expect(filterByJurisdiction(items, operator)).toEqual([items[0]]);
    expect(filterByJurisdiction(items, admin)).toEqual(items);
    expect(filterByJurisdiction(items, { role: 'staff', ghgRole: 'operator' })).toEqual([]);
  });

  it('describes the effective scope for the UI without widening permissions', () => {
    expect(resolveActorJurisdictions(operator)).toEqual(['WARD-042']);
    expect(describeActorScope(admin)).toMatchObject({
      role: 'admin',
      allJurisdictions: true,
      label: 'Administrator — all jurisdictions',
    });
    expect(describeActorScope(operator).label).toContain('WARD-042');
    expect(describeActorScope(citizen).role).toBe('citizen');
  });
});
