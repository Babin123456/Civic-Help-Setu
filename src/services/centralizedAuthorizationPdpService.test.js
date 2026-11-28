import { describe, it, expect, beforeEach } from 'vitest';
import {
  CentralizedAuthorizationPdpService,
  DECISION_EFFECT
} from './centralizedAuthorizationPdpService.js';

describe('CentralizedAuthorizationPdpService (#1253)', () => {
  let pdp;

  beforeEach(() => {
    pdp = new CentralizedAuthorizationPdpService();
  });

  it('permits authorized roles and serves subsequent checks from cache', () => {
    pdp.registerPolicy({
      role: 'DISTRICT_OFFICER',
      action: 'APPROVE_RATION_CARD',
      resource: 'APPLICATION',
      effect: DECISION_EFFECT.PERMIT
    });

    const eval1 = pdp.evaluateAccess({
      actorRole: 'DISTRICT_OFFICER',
      action: 'APPROVE_RATION_CARD',
      resource: 'APPLICATION'
    });
    expect(eval1.effect).toBe(DECISION_EFFECT.PERMIT);
    expect(eval1.fromCache).toBe(false);

    const eval2 = pdp.evaluateAccess({
      actorRole: 'DISTRICT_OFFICER',
      action: 'APPROVE_RATION_CARD',
      resource: 'APPLICATION'
    });
    expect(eval2.effect).toBe(DECISION_EFFECT.PERMIT);
    expect(eval2.fromCache).toBe(true);
  });

  it('enforces explicit deny precedence and cross-tenant jurisdiction boundaries', () => {
    pdp.registerPolicy({
      role: 'DISTRICT_OFFICER',
      action: 'VIEW_DOCUMENT',
      resource: 'CITIZEN_DOSSIER',
      effect: DECISION_EFFECT.PERMIT
    });

    // Cross-tenant attempt from State DL to State UP
    const crossTenantEval = pdp.evaluateAccess({
      actorRole: 'DISTRICT_OFFICER',
      action: 'VIEW_DOCUMENT',
      resource: 'CITIZEN_DOSSIER',
      actorJurisdiction: 'DL',
      resourceJurisdiction: 'UP'
    });

    expect(crossTenantEval.effect).toBe(DECISION_EFFECT.DENY);
    expect(crossTenantEval.reason).toContain('Cross-jurisdiction');
  });
});
