/**
 * Synthetic Security & Governance Test Fixtures for Tool Registry (#1146)
 * All identities, session IDs, and arguments are strictly synthetic.
 */

export const SYNTHETIC_SIGNING_SECRET = 'synthetic-test-only-hmac-secret-32chars!';

export const SYNTHETIC_ACTORS = Object.freeze({
  CITIZEN_A: Object.freeze({
    actorUserId: 'syn-citizen-alpha-001',
    actorRole: 'citizen',
    sessionId: 'syn-sess-alpha-01',
  }),
  CITIZEN_B: Object.freeze({
    actorUserId: 'syn-citizen-beta-002',
    actorRole: 'citizen',
    sessionId: 'syn-sess-beta-02',
  }),
  ADMIN_MOD: Object.freeze({
    actorUserId: 'syn-admin-reviewer-900',
    actorRole: 'admin',
    sessionId: 'syn-sess-admin-01',
  }),
});

export const SYNTHETIC_PROVENANCE = Object.freeze({
  VALID: Object.freeze({
    sources: [
      {
        name: 'Synthetic National Services Portal',
        url: 'https://services.india.gov.in',
        verified: true,
      },
    ],
  }),
  INVALID: Object.freeze({
    sources: [{ name: 'Unverified Claim', url: 'http://insecure.example.invalid' }],
  }),
});

export const SYNTHETIC_ARGS = Object.freeze({
  VALID_LOOKUP: Object.freeze({ serviceId: 'ration-card' }),
  VALID_FAQ: Object.freeze({ query: 'birth certificate', limit: 3 }),
  VALID_DRAFT: Object.freeze({
    serviceId: 'income-certificate',
    caseId: 'syn-case-01',
    formData: {
      applicantLabel: 'Test Citizen Alpha',
      wardCode: 'WARD-01',
      checklistCompleted: true,
      notes: 'Synthetic draft fixture for automated validation.',
    },
  }),
  VALID_REMINDER: Object.freeze({
    grievanceId: 'SYN-GRV-101',
    reminderDate: '2026-12-15',
    reason: 'Follow up on synthetic grievance verification.',
  }),
  MALFORMED_EXTRA_PROP: Object.freeze({
    serviceId: 'ration-card',
    unexpectedAdminOverride: true,
  }),
  MALFORMED_BAD_ENUM: Object.freeze({
    serviceId: 'unregistered-service-999',
  }),
  SENSITIVE_AADHAAR_TEXT: Object.freeze({
    query: 'check status for 2345 6789 0123',
  }),
  SENSITIVE_VAULT_KEY: Object.freeze({
    serviceId: 'ration-card',
    formData: {
      applicantLabel: 'Test Citizen',
      notes: 'access vault password',
    },
  }),
});
