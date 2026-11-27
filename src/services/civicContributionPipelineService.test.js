/**
 * src/services/civicContributionPipelineService.test.js
 *
 * Unit tests for Human-Reviewed Civic Data Contribution Pipeline (#1432).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeFieldDiffs,
  submitLocalProposal,
  reviewLocalProposal,
  rollbackLocalProposal,
} from './civicContributionPipelineService.js';

const createMockStorage = () => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  };
};

describe('civicContributionPipelineService (#1432)', () => {
  let storage;

  beforeEach(() => {
    storage = createMockStorage();
  });

  it('computes accurate field-level diffs', () => {
    const diffs = computeFieldDiffs(
      { officeHours: '09:30-17:30', phone: '1076' },
      { officeHours: '09:30-18:00', phone: '1076' }
    );
    expect(diffs).toEqual([{ field: 'officeHours', before: '09:30-17:30', after: '09:30-18:00' }]);
  });

  it('enforces contributor/publisher role separation (blocks self-review)', () => {
    const prop = submitLocalProposal({
      targetEntityId: 'office-1',
      contributorId: 'user-A',
      beforeFields: { hours: '9-5' },
      proposedFields: { hours: '9-6' },
      sourceUrl: 'https://edistrict.delhigovt.nic.in',
      customStorage: storage,
    });

    expect(() =>
      reviewLocalProposal({
        proposalId: prop.proposalId,
        publisherId: 'user-A',
        decision: 'PUBLISH',
        customStorage: storage,
      })
    ).toThrow(/role separation/i);
  });

  it('requires rejectionReason when rejecting and supports rollback after publish', () => {
    const prop = submitLocalProposal({
      targetEntityId: 'office-2',
      contributorId: 'user-A',
      beforeFields: { hours: '9-5' },
      proposedFields: { hours: '9-6' },
      sourceUrl: 'https://edistrict.delhigovt.nic.in',
      customStorage: storage,
    });

    expect(() =>
      reviewLocalProposal({
        proposalId: prop.proposalId,
        publisherId: 'pub-B',
        decision: 'REJECT',
        rejectionReason: '',
        customStorage: storage,
      })
    ).toThrow(/rejection reason/i);

    const published = reviewLocalProposal({
      proposalId: prop.proposalId,
      publisherId: 'pub-B',
      decision: 'PUBLISH',
      customStorage: storage,
    });
    expect(published.status).toBe('PUBLISHED');

    const rolled = rollbackLocalProposal({
      proposalId: prop.proposalId,
      publisherId: 'pub-B',
      reason: 'Reverted after audit',
      customStorage: storage,
    });
    expect(rolled.status).toBe('ROLLED_BACK');
  });

  it('rejects Aadhaar/PAN PII and non-HTTPS sources', () => {
    expect(() =>
      submitLocalProposal({
        targetEntityId: 'office-3',
        beforeFields: { a: 1 },
        proposedFields: { a: 2 },
        sourceUrl: 'http://insecure.example.com',
        customStorage: storage,
      })
    ).toThrow(/https/i);

    expect(() =>
      submitLocalProposal({
        targetEntityId: 'office-3',
        beforeFields: { a: 1 },
        proposedFields: { a: 2 },
        sourceUrl: 'https://gov.in',
        rationale: 'Aadhaar 1234 5678 9012',
        customStorage: storage,
      })
    ).toThrow(/Aadhaar or PAN/i);
  });
});

