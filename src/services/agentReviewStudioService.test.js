import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createReviewStudioStore,
  validateReviewProposal,
  buildReviewProposalFromAssistantResponse,
  REVIEW_STATUS,
  REVIEW_DECISION,
  ReviewValidationError,
  VersionConflictError,
  SilentRegenerationForbiddenError,
} from './agentReviewStudioService.js';
import { setCurrentActor, PermissionDeniedError } from './accessControl.js';
import {
  SYNTHETIC_PROPOSAL_BIRTH_FEE,
  SYNTHETIC_PROPOSAL_PASSPORT_CONFLICT,
  SYNTHETIC_PROPOSAL_WITH_PII,
  SYNTHETIC_PROPOSAL_AUTONOMOUS_CLAIM,
} from '../test/fixtures/agentReviewFixtures.js';

function createMemoryAdapter() {
  const map = new Map();
  return {
    get: (k) => map.get(k),
    set: (k, v) => map.set(k, v),
  };
}

describe('agentReviewStudioService (#1150)', () => {
  let store;

  beforeEach(() => {
    setCurrentActor({ role: 'admin', username: 'ReviewerAdmin' });
    store = createReviewStudioStore([], createMemoryAdapter());
  });

  afterEach(() => {
    setCurrentActor(null);
  });

  it('rejects untrusted proposals containing PII, secrets, or autonomous government claims', () => {
    const piiRes = validateReviewProposal(SYNTHETIC_PROPOSAL_WITH_PII);
    expect(piiRes.valid).toBe(false);
    expect(piiRes.errors.some((e) => e.toLowerCase().includes('aadhaar') || e.toLowerCase().includes('phone'))).toBe(true);

    const autoRes = validateReviewProposal(SYNTHETIC_PROPOSAL_AUTONOMOUS_CLAIM);
    expect(autoRes.valid).toBe(false);
    expect(autoRes.errors.some((e) => e.toLowerCase().includes('autonomous'))).toBe(true);
  });

  it('rejects high-risk claims without any linked source passage and non-HTTPS URLs', () => {
    const badProposal = {
      ...SYNTHETIC_PROPOSAL_BIRTH_FEE,
      sourcePassages: [],
    };
    const res = validateReviewProposal(badProposal);
    expect(res.valid).toBe(false);

    const httpUrlProposal = {
      ...SYNTHETIC_PROPOSAL_BIRTH_FEE,
      sourcePassages: [
        { ...SYNTHETIC_PROPOSAL_BIRTH_FEE.sourcePassages[0], sourceUrl: 'http://insecure.example.gov.in' },
      ],
    };
    expect(validateReviewProposal(httpUrlProposal).valid).toBe(false);
  });

  it('enforces RBAC permission boundaries for unauthenticated and citizen actors', () => {
    const item = store.submitProposal(SYNTHETIC_PROPOSAL_BIRTH_FEE);

    setCurrentActor(null);
    expect(() => store.listItems()).toThrow(PermissionDeniedError);
    expect(() => store.submitProposal(SYNTHETIC_PROPOSAL_BIRTH_FEE)).toThrow(PermissionDeniedError);

    setCurrentActor({ role: 'citizen', username: 'CitizenUser' });
    // Citizens may flag/submit a proposal for review, but cannot read queue or record decisions
    const citizenSubmitted = store.submitProposal(SYNTHETIC_PROPOSAL_PASSPORT_CONFLICT);
    expect(citizenSubmitted.submittedByRole).toBe('citizen');
    expect(() => store.listItems()).toThrow(PermissionDeniedError);
    expect(() =>
      store.submitDecision(item.id, {
        decision: REVIEW_DECISION.APPROVE,
        expectedVersion: 1,
        rationale: 'Attempting unauthorized approval',
      })
    ).toThrow(PermissionDeniedError);
    expect(() => store.forkNewVersion(item.id, { rationale: 'Unauthorized fork attempt' })).toThrow(PermissionDeniedError);
  });

  it('supports approve, edit, reject, escalate decisions and prohibits silent regeneration after approval', () => {
    const item = store.submitProposal(SYNTHETIC_PROPOSAL_BIRTH_FEE);
    const approved = store.submitDecision(item.id, {
      decision: REVIEW_DECISION.APPROVE,
      expectedVersion: 1,
      rationale: 'Verified 21-day window against crsorgi.gov.in statutory schedule.',
    });

    expect(approved.status).toBe(REVIEW_STATUS.APPROVED);
    expect(approved.version).toBe(2);
    expect(approved.decisionHistory).toHaveLength(1);

    // Silent regeneration / in-place overwrite after approval must be blocked
    expect(() =>
      store.submitDecision(item.id, {
        decision: REVIEW_DECISION.REJECT,
        expectedVersion: 2,
        rationale: 'Trying to overwrite an approved record silently.',
      })
    ).toThrow(SilentRegenerationForbiddenError);

    // Explicit version fork is allowed and creates v3 in pending_review
    const forked = store.forkNewVersion(item.id, {
      rationale: 'Municipal gazette updated late-fee slab; re-review required.',
    });
    expect(forked.version).toBe(3);
    expect(forked.status).toBe(REVIEW_STATUS.PENDING_REVIEW);
    expect(store.getItem(item.id).status).toBe(REVIEW_STATUS.SUPERSEDED);

    // Edit & approve flow on forked version
    const edited = store.submitDecision(forked.id, {
      decision: REVIEW_DECISION.EDIT,
      expectedVersion: 3,
      rationale: 'Clarified municipal registrar office timing.',
      editedClaims: [
        {
          ...forked.claims[0],
          text: 'A birth must be reported to the local Registrar within 21 days during working hours.',
        },
      ],
    });
    expect(edited.status).toBe(REVIEW_STATUS.EDITED_APPROVED);
    expect(edited.version).toBe(4);
  });

  it('detects optimistic concurrency conflicts and supports idempotent retries', () => {
    const item = store.submitProposal({
      ...SYNTHETIC_PROPOSAL_PASSPORT_CONFLICT,
      idempotencyKey: 'idem-prop-1',
    });
    // Retry submission with same idempotencyKey returns the same record
    const retryProp = store.submitProposal({
      ...SYNTHETIC_PROPOSAL_PASSPORT_CONFLICT,
      idempotencyKey: 'idem-prop-1',
    });
    expect(retryProp.id).toBe(item.id);

    // Escalate v1 -> v2
    const escalated = store.submitDecision(item.id, {
      decision: REVIEW_DECISION.ESCALATE,
      expectedVersion: 1,
      rationale: 'Tatkal 24-hour claim conflicts with Passport Seva police verification rule.',
      idempotencyKey: 'idem-dec-1',
    });
    expect(escalated.status).toBe(REVIEW_STATUS.ESCALATED);
    expect(escalated.version).toBe(2);

    // Idempotent retry of the same decision returns v2 cleanly
    const retryDec = store.submitDecision(item.id, {
      decision: REVIEW_DECISION.ESCALATE,
      expectedVersion: 1,
      rationale: 'Tatkal 24-hour claim conflicts with Passport Seva police verification rule.',
      idempotencyKey: 'idem-dec-1',
    });
    expect(retryDec.version).toBe(2);

    // Stale expectedVersion without matching idempotencyKey throws VersionConflictError
    expect(() =>
      store.submitDecision(item.id, {
        decision: REVIEW_DECISION.REJECT,
        expectedVersion: 1,
        rationale: 'Stale reviewer tab attempting reject on v1.',
        idempotencyKey: 'idem-dec-stale',
      })
    ).toThrow(VersionConflictError);
  });

  it('requires non-empty rationale and builds proposals from Assistant responses', () => {
    const item = store.submitProposal(SYNTHETIC_PROPOSAL_BIRTH_FEE);
    expect(() =>
      store.submitDecision(item.id, {
        decision: REVIEW_DECISION.REJECT,
        expectedVersion: 1,
        rationale: 'short',
      })
    ).toThrow(ReviewValidationError);

    const built = buildReviewProposalFromAssistantResponse('Birth certificate deadline?', {
      serviceId: 'birth-certificate',
      confidenceScore: 0.88,
      grounded: true,
      data: { title: 'Birth Certificate', summary: 'Register within 21 days.' },
      retrievedChunks: [
        {
          chunkId: 'c1',
          sectionTitle: 'Statutory Deadline',
          excerpt: 'Register within 21 days at the local municipal registrar.',
          sourceUrl: 'https://crsorgi.gov.in',
          sourceName: 'CRS Portal',
        },
      ],
    });
    const created = store.submitProposal(built);
    expect(created.status).toBe(REVIEW_STATUS.PENDING_REVIEW);
    expect(store.getMetrics().total).toBeGreaterThanOrEqual(2);
  });
});
