import { describe, it, expect, afterEach } from 'vitest';
import { setCurrentActor } from './accessControl';
import {
  actorIdentity,
  assertTreeJurisdiction,
  canTree,
  getScopedJurisdictions,
  isTreeStaff,
  listTreeCapabilities,
  resolveTreeRole,
  assertTreeCapability,
} from './treeAccessControl';
import { TREE_ERROR_CODES } from './treeInventoryConstants';

const adminWithTreeRole = (treeRole, jurisdictionId = 'blr') => ({
  id: `staff_${treeRole}`,
  username: `${treeRole} user`,
  role: 'admin',
  raw: { publicMetadata: { treeRole, jurisdictionId } },
});

const citizen = { id: 'citizen_1', username: 'Resident', role: 'citizen' };

const expectCode = (fn, code) => {
  try {
    fn();
    throw new Error('Expected the call to be refused');
  } catch (error) {
    expect(error.code).toBe(code);
  }
};

describe('treeAccessControl — least privilege and jurisdiction scoping', () => {
  afterEach(() => setCurrentActor(null));

  it('treats a signed-out or citizen actor as a citizen', () => {
    setCurrentActor(null);
    expect(resolveTreeRole()).toBe('citizen');
    expect(isTreeStaff()).toBe(false);
    setCurrentActor(citizen);
    expect(resolveTreeRole()).toBe('citizen');
    expect(canTree('tree.public.read')).toBe(true);
    expect(canTree('report.submit')).toBe(true);
    expect(canTree('tree.staff.read')).toBe(false);
  });

  it('never lets a citizen elevate themselves by putting a staff role in request data', () => {
    setCurrentActor({
      ...citizen,
      treeRole: 'arborist',
      raw: { publicMetadata: { treeRole: 'arborist', jurisdictionId: 'blr' } },
    });
    expect(resolveTreeRole()).toBe('citizen');
    expect(isTreeStaff()).toBe(false);
    expect(canTree('tree.create')).toBe(false);
  });

  it('narrows a site-wide administrator to the claimed tree role', () => {
    setCurrentActor(adminWithTreeRole('operator'));
    expect(resolveTreeRole()).toBe('operator');
    expect(canTree('inspection.schedule')).toBe(true);
    expect(canTree('inspection.complete')).toBe(true);
    expect(canTree('order.manage')).toBe(true);
    expect(canTree('report.triage')).toBe(true);
    expect(canTree('tree.create')).toBe(false);
    expect(canTree('tree.risk.confirm')).toBe(false);
    expect(canTree('inventory.import')).toBe(false);
    expect(canTree('audit.read')).toBe(false);
  });

  it('gives a plain administrator full inventory capabilities across jurisdictions', () => {
    setCurrentActor({ id: 'admin_1', username: 'Administrator', role: 'admin' });
    expect(resolveTreeRole()).toBe('admin');
    expect(getScopedJurisdictions()).toBeNull();
    expect(canTree('inventory.import')).toBe(true);
    expect(canTree('audit.read')).toBe(true);
    expect(canTree('tree.risk.confirm')).toBe(true);
    expect(canTree('order.close')).toBe(true);
  });

  it('gives operators inspection and order work but not expert decisions', () => {
    setCurrentActor(adminWithTreeRole('operator'));
    expect(canTree('inspection.schedule')).toBe(true);
    expect(canTree('inspection.complete')).toBe(true);
    expect(canTree('inspection.verify')).toBe(false);
    expect(canTree('tree.risk.propose')).toBe(false);
    expect(canTree('tree.risk.confirm')).toBe(false);
    expect(canTree('report.review')).toBe(false);
    expect(canTree('triage.review')).toBe(false);
  });

  it('gives reviewers expert confirmation, verification, closure and audit access', () => {
    setCurrentActor(adminWithTreeRole('reviewer'));
    expect(canTree('tree.risk.confirm')).toBe(true);
    expect(canTree('inspection.verify')).toBe(true);
    expect(canTree('order.close')).toBe(true);
    expect(canTree('report.review')).toBe(true);
    expect(canTree('triage.review')).toBe(true);
    expect(canTree('audit.read')).toBe(true);
    expect(canTree('tree.create')).toBe(false);
    expect(canTree('inventory.import')).toBe(false);
  });

  it('scopes staff to their assigned jurisdiction and refuses another jurisdiction', () => {
    setCurrentActor(adminWithTreeRole('arborist', 'blr'));
    expect(getScopedJurisdictions()).toEqual(['blr']);
    expect(assertTreeJurisdiction({ ...adminWithTreeRole('arborist', 'blr') }, 'blr')).toBe(true);
    expectCode(
      () => assertTreeJurisdiction(adminWithTreeRole('arborist', 'blr'), 'del'),
      TREE_ERROR_CODES.JURISDICTION_FORBIDDEN
    );

    setCurrentActor({ id: 'admin_1', role: 'admin' });
    expect(assertTreeJurisdiction({ id: 'admin_1', role: 'admin' }, 'del')).toBe(true);
  });

  it('returns a compact identity and refuses unknown capabilities', () => {
    setCurrentActor(adminWithTreeRole('arborist', 'blr'));
    const identity = actorIdentity();
    expect(identity).toEqual({
      id: 'staff_arborist',
      label: 'arborist user',
      role: 'arborist',
      jurisdictions: ['blr'],
    });
    expect(listTreeCapabilities()).toContain('tree.create');
    expectCode(() => assertTreeCapability('tree.unknown'), 'TREE_UNKNOWN_CAPABILITY');
  });
});
