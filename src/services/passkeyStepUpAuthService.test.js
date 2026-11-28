import { describe, it, expect, beforeEach } from 'vitest';
import {
  PasskeyStepUpAuthService,
  ACTION_RISK_TIER
} from './passkeyStepUpAuthService.js';

describe('PasskeyStepUpAuthService (#1254)', () => {
  let authService;

  beforeEach(() => {
    authService = new PasskeyStepUpAuthService();
  });

  it('triggers step-up requirement for high risk actions or new device anomalies', () => {
    const highRisk = authService.evaluateStepUpRequirement(ACTION_RISK_TIER.HIGH);
    expect(highRisk.requiresStepUp).toBe(true);

    const anomalousDevice = authService.evaluateStepUpRequirement(ACTION_RISK_TIER.LOW, { isNewDevice: true });
    expect(anomalousDevice.requiresStepUp).toBe(true);

    const normal = authService.evaluateStepUpRequirement(ACTION_RISK_TIER.LOW, { isNewDevice: false });
    expect(normal.requiresStepUp).toBe(false);
  });

  it('verifies passkey assertions and returns time-bounded step-up tokens', () => {
    const credId = authService.registerPasskey('user_101', { deviceName: 'Security Key' });
    const challenge = authService.createAuthenticationChallenge('user_101');

    const result = authService.verifyPasskeyAssertion('user_101', credId, {
      signature: 'valid_mock_webauthn_signature',
      clientDataJSON: Buffer.from(JSON.stringify({ challenge })).toString('base64url')
    });

    expect(result.verified).toBe(true);
    expect(result.stepUpToken).toMatch(/^STEPUP-[0-9a-f]{32}$/);
  });
});
