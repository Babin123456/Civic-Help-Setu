import crypto from 'node:crypto';

export const ACTION_RISK_TIER = Object.freeze({
  LOW: 'LOW', // Standard browse / search
  MEDIUM: 'MEDIUM', // Profile update
  HIGH: 'HIGH' // Account recovery, consent revocation, export data, admin action
});

export class PasskeyStepUpAuthService {
  constructor() {
    this.passkeyCredentials = new Map();
    this.activeChallenges = new Map();
  }

  registerPasskey(userId, credential = {}) {
    const { credentialId, publicKey, deviceName = 'Authenticator' } = credential;
    const credId = credentialId || `CRED-${crypto.randomBytes(8).toString('hex')}`;

    this.passkeyCredentials.set(credId, {
      userId,
      credentialId: credId,
      publicKey: publicKey || 'MOCK_PUBLIC_KEY',
      deviceName,
      counter: 0,
      createdAt: new Date().toISOString()
    });

    return credId;
  }

  evaluateStepUpRequirement(actionRiskTier, sessionContext = {}) {
    const { isNewDevice = false, ipReputationScore = 1.0, hasRecentStepUp = false } = sessionContext;

    if (actionRiskTier === ACTION_RISK_TIER.HIGH) {
      return { requiresStepUp: true, reason: 'High-risk sensitive action requires biometric/passkey verification.' };
    }

    if (isNewDevice || ipReputationScore < 0.5) {
      return { requiresStepUp: true, reason: 'Risk anomaly detected: unrecognized device or network.' };
    }

    return { requiresStepUp: false, reason: 'Session risk within standard baseline.' };
  }

  createAuthenticationChallenge(userId) {
    const challenge = crypto.randomBytes(32).toString('base64url');
    this.activeChallenges.set(userId, {
      challenge,
      expiresAt: Date.now() + (5 * 60 * 1000) // 5 min TTL
    });

    return challenge;
  }

  verifyPasskeyAssertion(userId, credentialId, clientResponse = {}) {
    const storedChallenge = this.activeChallenges.get(userId);
    if (!storedChallenge || Date.now() > storedChallenge.expiresAt) {
      throw new Error('Challenge expired or not found.');
    }

    const cred = this.passkeyCredentials.get(credentialId);
    if (!cred || cred.userId !== userId) {
      throw new Error('Credential not bound to user.');
    }

    // Verify assertion signature and client data (mocked verification for node runtime)
    const { signature, clientDataJSON } = clientResponse;
    if (!signature) {
      throw new Error('Missing authenticator signature.');
    }

    cred.counter += 1;
    this.activeChallenges.delete(userId);

    return {
      verified: true,
      stepUpToken: `STEPUP-${crypto.randomBytes(16).toString('hex')}`,
      expiresInSeconds: 900 // 15 mins step-up window
    };
  }
}
