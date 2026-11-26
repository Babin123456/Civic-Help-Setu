import crypto from 'crypto';

/**
 * @file federatedIdentityRoleMappingService.js
 * @description Provides OpenID Connect (OIDC) / SAML federated identity verification and role mapping
 * for institutional partner portals (e.g. State e-District, DigiLocker, MeriPehchaan).
 * Validates issuer/audience, maps partner assertions to local Civic Help Setu roles, and creates short-lived sessions.
 */

export class FederatedIdentityError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'FederatedIdentityError';
    this.code = code;
  }
}

export class FederatedIdentityRoleMappingService {
  constructor(options = {}) {
    this.trustedIssuers = new Map();
    this.activeSessions = new Map();
    this.sessionTtlMs = options.sessionTtlMs || 3600 * 1000; // 1 hour default
    this.revocationList = new Set();

    // Register standard partner providers
    this.registerPartnerProvider({
      issuerId: 'https://meripehchaan.gov.in',
      name: 'MeriPehchaan (National Single Sign-On)',
      allowedAudiences: ['civic-help-setu-prod'],
      roleMappings: {
        'GOV_OFFICER_REVENUE': 'ward_officer',
        'VERIFIED_CITIZEN': 'citizen',
        'DISTRICT_MAGISTRATE_ADMIN': 'state_admin'
      }
    });

    this.registerPartnerProvider({
      issuerId: 'https://edistrict.karnataka.gov.in/auth',
      name: 'Karnataka Seva Sindhu / e-District SSO',
      allowedAudiences: ['civic-help-setu-ka'],
      roleMappings: {
        'SEVA_SINDHU_VERIFIER': 'verifier',
        'TAHSILDAR': 'ward_officer',
        'CITIZEN_USER': 'citizen'
      }
    });
  }

  registerPartnerProvider(provider) {
    if (!provider || !provider.issuerId) {
      throw new FederatedIdentityError('Provider must include valid issuerId', 'INVALID_PROVIDER');
    }
    this.trustedIssuers.set(provider.issuerId, {
      ...provider,
      allowedAudiences: provider.allowedAudiences || [],
      roleMappings: provider.roleMappings || {}
    });
  }

  getProvider(issuerId) {
    return this.trustedIssuers.get(issuerId) || null;
  }

  /**
   * Validates partner token claims and maps roles to local authorization context.
   */
  authenticatePartnerToken(tokenClaims) {
    if (!tokenClaims || !tokenClaims.iss || !tokenClaims.sub) {
      throw new FederatedIdentityError('Missing mandatory token claims (iss, sub)', 'INVALID_CLAIMS');
    }

    const provider = this.trustedIssuers.get(tokenClaims.iss);
    if (!provider) {
      throw new FederatedIdentityError(`Untrusted token issuer: ${tokenClaims.iss}`, 'UNTRUSTED_ISSUER');
    }

    // Audience verification
    if (provider.allowedAudiences.length > 0) {
      if (!tokenClaims.aud || !provider.allowedAudiences.includes(tokenClaims.aud)) {
        throw new FederatedIdentityError(`Audience mismatch for partner: ${tokenClaims.aud}`, 'AUDIENCE_MISMATCH');
      }
    }

    // Expiration check
    const now = Math.floor(Date.now() / 1000);
    if (tokenClaims.exp && tokenClaims.exp < now) {
      throw new FederatedIdentityError('Partner token is expired', 'EXPIRED_TOKEN');
    }

    // Check revocation
    if (this.revocationList.has(tokenClaims.jti || tokenClaims.sub)) {
      throw new FederatedIdentityError('Token or subject has been explicitly revoked', 'REVOKED_IDENTITY');
    }

    // Map external claims to local roles
    const externalRole = tokenClaims.partnerRole || tokenClaims.role || 'CITIZEN_USER';
    const localRole = provider.roleMappings[externalRole] || 'citizen'; // Default to least-privilege citizen

    const sessionId = `sess_fed_${crypto.randomUUID()}`;
    const expiresAt = new Date(Date.now() + this.sessionTtlMs).toISOString();

    const session = {
      sessionId,
      sub: tokenClaims.sub,
      email: tokenClaims.email || null,
      issuer: tokenClaims.iss,
      providerName: provider.name,
      mappedRole: localRole,
      assignedJurisdictions: tokenClaims.jurisdictions || ['IN-CENTRAL'],
      createdAt: new Date().toISOString(),
      expiresAt
    };

    this.activeSessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;

    if (new Date(session.expiresAt) < new Date()) {
      this.activeSessions.delete(sessionId);
      return null;
    }

    return session;
  }

  revokeSession(sessionId) {
    return this.activeSessions.delete(sessionId);
  }

  revokeSubject(subjectId) {
    this.revocationList.add(subjectId);
    // Purge existing active sessions for this subject
    for (const [sId, sess] of this.activeSessions.entries()) {
      if (sess.sub === subjectId) {
        this.activeSessions.delete(sId);
      }
    }
  }
}

export const defaultFederatedAuthService = new FederatedIdentityRoleMappingService();
