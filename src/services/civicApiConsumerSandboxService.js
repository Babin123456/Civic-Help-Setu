import crypto from 'node:crypto';

export class CivicApiConsumerSandboxService {
  constructor() {
    this.sandboxCredentials = new Map();
    this.rateLimitTracker = new Map();
  }

  issueSandboxCredentials(consumerName, scope = ['SERVICES_READ', 'ELIGIBILITY_SIMULATE']) {
    if (!consumerName) throw new Error('consumerName is required.');

    const apiKey = `SBX_KEY_${crypto.randomBytes(16).toString('hex')}`;
    const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days expiry

    const cred = {
      apiKey,
      consumerName,
      scope,
      rateLimitRpm: 60,
      isSandbox: true,
      expiresAt
    };

    this.sandboxCredentials.set(apiKey, cred);
    return cred;
  }

  validateSandboxRequest(apiKey, endpoint) {
    const cred = this.sandboxCredentials.get(apiKey);
    if (!cred) {
      return { allowed: false, errorStatus: 401, message: 'Invalid or missing sandbox API key.' };
    }

    if (Date.now() > cred.expiresAt) {
      return { allowed: false, errorStatus: 403, message: 'Sandbox API key has expired.' };
    }

    // Rate limit check
    const currentMin = Math.floor(Date.now() / 60000);
    const rlKey = `${apiKey}:${currentMin}`;
    const count = (this.rateLimitTracker.get(rlKey) || 0) + 1;
    this.rateLimitTracker.set(rlKey, count);

    if (count > cred.rateLimitRpm) {
      return { allowed: false, errorStatus: 429, message: 'Sandbox rate limit exceeded (60 requests per minute).' };
    }

    return { allowed: true, consumer: cred.consumerName, scope: cred.scope };
  }

  getDeterministicSyntheticResponse(endpoint, params = {}) {
    if (endpoint === '/api/v1/sandbox/services') {
      return {
        isSyntheticFixture: true,
        total: 2,
        data: [
          {
            serviceId: 'SYN-SRV-01',
            title: 'Synthetic Ration Card Issuance',
            jurisdiction: 'TEST_STATE',
            statutoryDays: 15,
            feeInr: 25
          },
          {
            serviceId: 'SYN-SRV-02',
            title: 'Synthetic Income Certificate Verification',
            jurisdiction: 'TEST_STATE',
            statutoryDays: 7,
            feeInr: 50
          }
        ]
      };
    }

    if (endpoint === '/api/v1/sandbox/eligibility/evaluate') {
      const isEligible = (params.annualIncome || 50000) <= 100000;
      return {
        isSyntheticFixture: true,
        serviceId: params.serviceId || 'SYN-SRV-01',
        isEligible,
        evaluationTimestamp: new Date().toISOString()
      };
    }

    return { isSyntheticFixture: true, error: 'Endpoint contract not defined in sandbox registry.' };
  }
}
