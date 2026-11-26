import { describe, it, expect, beforeEach } from 'vitest';
import {
  ServerAuthorizationPolicyService,
  CivicRole,
  CivicAction,
  AuthorizationError
} from './serverAuthorizationPolicyService.js';

describe('ServerAuthorizationPolicyService', () => {
  let authService;

  beforeEach(() => {
    authService = new ServerAuthorizationPolicyService();
  });

  it('rejects unauthenticated principals by default', () => {
    const result = authService.evaluate({
      principal: null,
      action: CivicAction.VIEW,
      resourceType: 'application'
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('UNAUTHENTICATED');
  });

  it('prevents IDOR: citizens cannot access another user resource', () => {
    const citizenUser = { id: 'usr_citizen_101', role: CivicRole.CITIZEN };
    const foreignResource = { id: 'doc_999', ownerId: 'usr_citizen_202', jurisdictionId: 'IN-KA-BLR' };

    const result = authService.evaluate({
      principal: citizenUser,
      action: CivicAction.UPDATE,
      resourceType: 'civic_document',
      resource: foreignResource
    });

    expect(result.allowed).toBe(false);
    expect(result.code).toBe('IDOR_PREVENTED');
  });

  it('allows citizens to modify their own owned resources', () => {
    const citizenUser = { id: 'usr_citizen_101', role: CivicRole.CITIZEN };
    const ownResource = { id: 'doc_101', ownerId: 'usr_citizen_101', jurisdictionId: 'IN-KA-BLR' };

    const result = authService.evaluate({
      principal: citizenUser,
      action: CivicAction.UPDATE,
      resourceType: 'civic_document',
      resource: ownResource
    });

    expect(result.allowed).toBe(true);
    expect(result.code).toBe('AUTHORIZED_CITIZEN_OWNER');
  });

  it('enforces ward jurisdiction boundary for ward officers', () => {
    const wardOfficer = {
      id: 'officer_44',
      role: CivicRole.WARD_OFFICER,
      jurisdictions: ['IN-KA-BLR-W044']
    };

    const outOfBoundsResource = {
      id: 'case_77',
      jurisdictionId: 'IN-KA-BLR-W088'
    };

    const inBoundsResource = {
      id: 'case_44',
      jurisdictionId: 'IN-KA-BLR-W044'
    };

    const denied = authService.evaluate({
      principal: wardOfficer,
      action: CivicAction.APPROVE,
      resourceType: 'permit',
      resource: outOfBoundsResource
    });
    expect(denied.allowed).toBe(false);
    expect(denied.code).toBe('TENANT_MISMATCH');

    const allowed = authService.evaluate({
      principal: wardOfficer,
      action: CivicAction.APPROVE,
      resourceType: 'permit',
      resource: inBoundsResource
    });
    expect(allowed.allowed).toBe(true);
  });

  it('assertAuthorized throws AuthorizationError on denial', () => {
    const citizen = { id: 'usr_1', role: CivicRole.CITIZEN };

    expect(() => {
      authService.assertAuthorized({
        principal: citizen,
        action: CivicAction.EXPORT_AUDIT,
        resourceType: 'system_audit'
      });
    }).toThrow(AuthorizationError);
  });

  it('maintains tamper-evident audit logs of authorization decisions', () => {
    authService.evaluate({
      principal: { id: 'intruder', role: CivicRole.ANONYMOUS },
      action: CivicAction.DELETE,
      resourceType: 'user_account'
    });

    const logs = authService.getAuditLogs({ allowed: false });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].principalId).toBe('intruder');
    expect(logs[0].reason).toBe('ANONYMOUS_PRIVILEGED_ACTION_BLOCKED');
  });
});
