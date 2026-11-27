import { describe, expect, it } from 'vitest';
import {
  OFFLINE_CARD_ERROR_CODES,
  OFFLINE_CARD_ROLES,
} from './offlineEmergencyCardConstants.js';
import {
  actorHasAllJurisdictions,
  assertOfflineCardCapability,
  assertOfflineCardJurisdiction,
  canOfflineCard,
  describeOfflineCardScope,
  filterByJurisdiction,
  isOfflineCardStaff,
  resolveActorJurisdictions,
  resolveOfflineCardRole,
} from './offlineEmergencyCardAccessControl.js';

const operator = {
  id: 'operator-1',
  role: 'operator',
  offlineCardRole: OFFLINE_CARD_ROLES.OPERATOR,
  jurisdictionId: 'LKO',
};
const reviewer = {
  id: 'reviewer-1',
  role: 'reviewer',
  offlineCardRole: OFFLINE_CARD_ROLES.REVIEWER,
  jurisdictionId: 'LKO',
};
const adminAll = {
  id: 'admin-1',
  role: 'admin',
  offlineCardRole: OFFLINE_CARD_ROLES.ADMIN,
};
const adminScoped = {
  id: 'admin-2',
  role: 'admin',
  offlineCardRole: OFFLINE_CARD_ROLES.ADMIN,
  jurisdictionId: 'NATIONAL',
};
const citizen = {
  id: 'citizen-1',
  role: 'citizen',
  offlineCardRole: OFFLINE_CARD_ROLES.CITIZEN,
  jurisdictionId: 'LKO',
};

const expectCode = (fn, code) => {
  let caught = null;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeTruthy();
  expect(caught.code).toBe(code);
};

describe('offline emergency card access control (#761)', () => {
  it('resolves public, citizen and staff roles without trusting a missing actor', () => {
    expect(resolveOfflineCardRole(null)).toBe(OFFLINE_CARD_ROLES.PUBLIC);
    expect(resolveOfflineCardRole({ role: 'citizen' })).toBe(OFFLINE_CARD_ROLES.CITIZEN);
    expect(resolveOfflineCardRole({ role: 'admin' })).toBe(OFFLINE_CARD_ROLES.ADMIN);
    expect(
      resolveOfflineCardRole({ role: 'citizen', offlineCardRole: OFFLINE_CARD_ROLES.REVIEWER })
    ).toBe(OFFLINE_CARD_ROLES.REVIEWER);
    expect(resolveOfflineCardRole({ role: 'staff', inventoryRole: 'operator' })).toBe(
      OFFLINE_CARD_ROLES.CITIZEN
    );
  });

  it('resolves assigned jurisdictions from both direct fields and metadata', () => {
    expect(resolveActorJurisdictions(operator)).toEqual(['LKO']);
    expect(
      resolveActorJurisdictions({
        role: 'reviewer',
        offlineCardRole: 'reviewer',
        raw: { publicMetadata: { jurisdictionIds: ['LKO', 'NATIONAL'] } },
      })
    ).toEqual(['LKO', 'NATIONAL']);
    expect(resolveActorJurisdictions(null)).toEqual([]);
  });

  it('applies least-privilege capabilities', () => {
    expect(canOfflineCard('card.view_public', null, { allowAnonymous: true })).toBe(true);
    expect(canOfflineCard('contact.create', operator)).toBe(true);
    expect(canOfflineCard('contact.create', citizen)).toBe(false);
    expect(canOfflineCard('contact.review', reviewer)).toBe(true);
    expect(canOfflineCard('contact.review', operator)).toBe(false);
    expect(canOfflineCard('contact.restore', reviewer)).toBe(false);
    expect(canOfflineCard('contact.restore', adminAll)).toBe(true);
    expect(canOfflineCard('migration.run', reviewer)).toBe(false);

    expectCode(
      () => assertOfflineCardCapability('contact.create', citizen),
      OFFLINE_CARD_ERROR_CODES.PERMISSION_DENIED
    );
    expectCode(
      () => assertOfflineCardCapability('contact.create', null),
      OFFLINE_CARD_ERROR_CODES.UNAUTHENTICATED
    );
  });

  it('treats only an unscoped administrator as all-jurisdiction', () => {
    expect(actorHasAllJurisdictions(adminAll)).toBe(true);
    expect(actorHasAllJurisdictions(adminScoped)).toBe(false);
    expect(actorHasAllJurisdictions(operator)).toBe(false);
    expect(isOfflineCardStaff(operator)).toBe(true);
    expect(isOfflineCardStaff(citizen)).toBe(false);
  });

  it('enforces jurisdiction scope for staff and permits public card reads', () => {
    expect(() => assertOfflineCardJurisdiction(reviewer, 'LKO')).not.toThrow();
    expect(() => assertOfflineCardJurisdiction(reviewer, 'NATIONAL')).toThrow();
    expectCode(
      () => assertOfflineCardJurisdiction(reviewer, 'NATIONAL'),
      OFFLINE_CARD_ERROR_CODES.JURISDICTION_DENIED
    );
    expect(() => assertOfflineCardJurisdiction(operator, 'LKO')).not.toThrow();
    expect(() => assertOfflineCardJurisdiction(adminAll, 'NATIONAL')).not.toThrow();
    expect(() => assertOfflineCardJurisdiction(adminAll, 'LKO')).not.toThrow();
    expectCode(
      () => assertOfflineCardJurisdiction(adminScoped, 'LKO'),
      OFFLINE_CARD_ERROR_CODES.JURISDICTION_DENIED
    );
    expect(() => assertOfflineCardJurisdiction(citizen, 'LKO', { allowPublic: true })).not.toThrow();
  });

  it('filters staff collections by assigned jurisdiction', () => {
    const records = [
      { id: '1', jurisdictionId: 'LKO' },
      { id: '2', jurisdictionId: 'NATIONAL' },
      { id: '3', jurisdictionId: 'LKO' },
    ];
    expect(filterByJurisdiction(records, reviewer).map((record) => record.id)).toEqual(['1', '3']);
    expect(filterByJurisdiction(records, adminAll)).toHaveLength(3);
    expect(filterByJurisdiction(records, { role: 'citizen', offlineCardRole: 'citizen' })).toEqual([]);
  });

  it('describes the active role and jurisdiction for the UI', () => {
    expect(describeOfflineCardScope(reviewer)).toMatchObject({
      role: 'reviewer',
      jurisdictionIds: ['LKO'],
      allJurisdictions: false,
    });
    expect(describeOfflineCardScope(adminAll).label).toContain('all jurisdictions');
  });
});
