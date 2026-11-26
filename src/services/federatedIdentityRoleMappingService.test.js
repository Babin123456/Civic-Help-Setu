import { describe, it, expect, beforeEach } from 'vitest';
import {
  FederatedIdentityRoleMappingService,
  FederatedIdentityError
} from './federatedIdentityRoleMappingService.js';

describe('FederatedIdentityRoleMappingService', () => {
  let fedAuth;

  beforeEach(() => {
    fedAuth = new FederatedIdentityRoleMappingService();
  });

  it('rejects untrusted issuers', () => {
    const bogusClaims = {
      iss: 'https://malicious-idp.example.com',
      sub: 'user_123',
      aud: 'civic-help-setu-prod'
    };

    expect(() => fedAuth.authenticatePartnerToken(bogusClaims)).toThrow(FederatedIdentityError);
    expect(() => fedAuth.authenticatePartnerToken(bogusClaims)).toThrow('Untrusted token issuer');
  });

  it('verifies audience and maps MeriPehchaan partner role to local ward_officer', () => {
    const validClaims = {
      iss: 'https://meripehchaan.gov.in',
      sub: 'officer_sharma_99',
      aud: 'civic-help-setu-prod',
      partnerRole: 'GOV_OFFICER_REVENUE',
      jurisdictions: ['IN-KA-BLR-W044'],
      exp: Math.floor(Date.now() / 1000) + 3600
    };

    const session = fedAuth.authenticatePartnerToken(validClaims);
    expect(session.sessionId).toMatch(/^sess_fed_/);
    expect(session.mappedRole).toBe('ward_officer');
    expect(session.assignedJurisdictions).toContain('IN-KA-BLR-W044');

    const retrieved = fedAuth.getSession(session.sessionId);
    expect(retrieved).toBeDefined();
    expect(retrieved.sub).toBe('officer_sharma_99');
  });

  it('rejects expired partner tokens', () => {
    const expiredClaims = {
      iss: 'https://meripehchaan.gov.in',
      sub: 'user_old',
      aud: 'civic-help-setu-prod',
      exp: Math.floor(Date.now() / 1000) - 600
    };

    expect(() => fedAuth.authenticatePartnerToken(expiredClaims)).toThrow('expired');
  });

  it('enforces subject revocation and invalidates active sessions', () => {
    const claims = {
      iss: 'https://edistrict.karnataka.gov.in/auth',
      sub: 'revoked_officer_01',
      aud: 'civic-help-setu-ka',
      partnerRole: 'SEVA_SINDHU_VERIFIER',
      exp: Math.floor(Date.now() / 1000) + 3600
    };

    const session = fedAuth.authenticatePartnerToken(claims);
    expect(fedAuth.getSession(session.sessionId)).not.toBeNull();

    // Revoke subject
    fedAuth.revokeSubject('revoked_officer_01');
    expect(fedAuth.getSession(session.sessionId)).toBeNull();

    // Attempting login after revocation fails
    expect(() => fedAuth.authenticatePartnerToken(claims)).toThrow('revoked');
  });
});
