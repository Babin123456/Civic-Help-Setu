import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getEnrichmentQueue,
  saveEnrichmentQueue,
  createEnrichmentProposal,
  reviewFieldProposal,
  finalizeProposalReview,
  rejectEntireProposal,
  getEnrichmentStats,
  ENRICHMENT_QUEUE_STORAGE_KEY,
  SEED_PROPOSALS,
} from './catalogueEnrichmentReviewService';

describe('catalogueEnrichmentReviewService (#407)', () => {
  let mockStore = {};

  beforeEach(() => {
    mockStore = {};
    vi.stubGlobal('localStorage', {
      getItem: (key) => mockStore[key] || null,
      setItem: (key, val) => {
        mockStore[key] = String(val);
      },
      removeItem: (key) => {
        delete mockStore[key];
      },
      clear: () => {
        mockStore = {};
      },
    });
    // Reset seed data
    saveEnrichmentQueue(JSON.parse(JSON.stringify(SEED_PROPOSALS)));
  });

  it('initializes queue with seed proposals in pending status', () => {
    const queue = getEnrichmentQueue();
    expect(queue.length).toBeGreaterThanOrEqual(2);
    expect(queue[0].status).toBe('pending');
    expect(queue[0].fields.shortDescription).toBeDefined();
    expect(queue[0].fields.shortDescription.decision).toBe('pending');
  });

  it('creates an enrichment proposal keeping it separate from published catalogue', () => {
    const mockService = {
      id: 'srv-ration-card',
      name: 'Ration Card NFSA',
      shortDescription: 'National food security ration card',
    };

    const proposed = {
      shortDescription: 'Subsidized food grain entitlement card issued by Department of Food.',
      plainLanguageSummary: 'Allows eligible families to purchase subsidized rice and wheat monthly.',
      tags: 'ration, nfsa, bpl, food grains',
    };

    const proposal = createEnrichmentProposal(mockService, proposed);
    expect(proposal).toBeDefined();
    expect(proposal.id).toMatch(/^prop-srv-ration-card/);
    expect(proposal.status).toBe('pending');
    expect(proposal.fields.shortDescription.proposed).toBe(proposed.shortDescription);
    expect(proposal.fields.plainLanguageSummary.proposed).toBe(proposed.plainLanguageSummary);

    // Published service object remains completely unchanged
    expect(mockService.shortDescription).toBe('National food security ration card');
  });

  it('allows field-by-field review: approve, edit, and reject', () => {
    const proposalId = 'prop-voter-id-01';

    // 1. Approve shortDescription
    const appRes = reviewFieldProposal(proposalId, 'shortDescription', 'approved');
    expect(appRes.success).toBe(true);
    expect(appRes.proposal.fields.shortDescription.decision).toBe('approved');

    // 2. Edit tags prior to approval
    const editRes = reviewFieldProposal(proposalId, 'tags', 'edited', 'voters, eci, free card');
    expect(editRes.success).toBe(true);
    expect(editRes.proposal.fields.tags.decision).toBe('edited');
    expect(editRes.proposal.fields.tags.editedValue).toBe('voters, eci, free card');

    // 3. Reject plainLanguageSummary
    const rejRes = reviewFieldProposal(proposalId, 'plainLanguageSummary', 'rejected');
    expect(rejRes.success).toBe(true);
    expect(rejRes.proposal.fields.plainLanguageSummary.decision).toBe('rejected');
  });

  it('finalizes partial approval, records reviewer audit, and returns only accepted changes', () => {
    const proposalId = 'prop-voter-id-01';

    // Set field decisions
    reviewFieldProposal(proposalId, 'shortDescription', 'approved');
    reviewFieldProposal(proposalId, 'tags', 'edited', 'voter, id, eci');
    reviewFieldProposal(proposalId, 'plainLanguageSummary', 'rejected');
    reviewFieldProposal(proposalId, 'applicationTips', 'rejected');

    const finalizeRes = finalizeProposalReview(
      proposalId,
      'admin_moderator@civic.org',
      'Accepted updated description and tags; rejected generic tips.'
    );

    expect(finalizeRes.success).toBe(true);
    expect(finalizeRes.overallStatus).toBe('partially_approved');
    expect(finalizeRes.proposal.reviewedBy).toBe('admin_moderator@civic.org');
    expect(finalizeRes.proposal.reviewedAt).toBeTruthy();
    expect(finalizeRes.proposal.reviewNotes).toContain('Accepted updated description');

    // Applied changes only contains approved and edited fields
    expect(finalizeRes.appliedChanges.shortDescription).toBeTruthy();
    expect(finalizeRes.appliedChanges.tags).toBe('voter, id, eci');
    expect(finalizeRes.appliedChanges.plainLanguageSummary).toBeUndefined();
    expect(finalizeRes.appliedChanges.applicationTips).toBeUndefined();
  });

  it('rejects an entire proposal without publishing any fields', () => {
    const proposalId = 'prop-pension-02';
    const rejectRes = rejectEntireProposal(proposalId, 'supervisor@civic.org', 'Information not verified from state gazette');

    expect(rejectRes.success).toBe(true);
    expect(rejectRes.proposal.status).toBe('rejected');
    expect(rejectRes.proposal.reviewedBy).toBe('supervisor@civic.org');
    expect(rejectRes.proposal.reviewNotes).toContain('not verified');
    expect(rejectRes.proposal.fields.shortDescription.decision).toBe('rejected');
  });

  it('calculates enrichment statistics accurately', () => {
    const stats = getEnrichmentStats();
    expect(stats.total).toBeGreaterThanOrEqual(2);
    expect(stats.pending).toBeGreaterThanOrEqual(2);
    expect(stats.approved).toBe(0);
  });
});
