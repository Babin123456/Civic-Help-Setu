import { describe, it, expect, beforeEach } from 'vitest';
import { wardBudgetService } from './wardBudgetService.js';
import { resetWardBudgetData } from './wardBudgetStorage.js';
import { findDuplicateCandidates, tokenizeText, computeJaccardSimilarity } from './proposalClusteringService.js';

describe('wardBudgetService (#765)', () => {
  beforeEach(() => {
    resetWardBudgetData();
  });

  it('lists initial seeded proposals and filters by category', () => {
    const all = wardBudgetService.listProposals();
    expect(all.proposals.length).toBeGreaterThan(0);

    const roads = wardBudgetService.listProposals({ category: 'roads_footpaths' });
    expect(roads.proposals.every((p) => p.category === 'roads_footpaths')).toBe(true);
  });

  it('creates a valid proposal and runs duplicate clustering', () => {
    const payload = {
      title: 'Pedestrian Crossing and Speed Calming near Public Park',
      category: 'traffic_safety',
      ward: 'Ward 150 - Bellandur',
      approximateLocation: 'Park View Road near Main Gate',
      description: 'Vehicles speed dangerously around the children park curve. A raised tabletop pedestrian crossing with reflective paint is urgently needed.',
      costEstimateRange: {
        min: 250000,
        max: 350000,
        basis: 'Standard municipal tabletop specifications',
      },
    };

    const res = wardBudgetService.createProposal(payload);
    expect(res.proposal.id).toMatch(/^PROP-\d{4}-\d{4}$/);
    expect(res.proposal.status).toBe('submitted');
    expect(res.duplicateAssessment).toBeDefined();

    const fetched = wardBudgetService.getProposalById(res.proposal.id);
    expect(fetched.title).toBe(payload.title);
  });

  it('rejects proposal submission containing PII (Aadhaar, phone)', () => {
    const payloadWithPii = {
      title: 'Call 9876543210 for potholes',
      category: 'roads_footpaths',
      ward: 'Ward 150 - Bellandur',
      approximateLocation: 'Road stretch',
      description: 'My Aadhaar is 1234 5678 9012 please fix this pothole.',
      costEstimateRange: { min: 10000, max: 20000 },
    };

    expect(() => wardBudgetService.createProposal(payloadWithPii)).toThrow(/PII|Aadhaar|contact/);
  });

  it('rejects proposal with invalid cost range', () => {
    const badCost = {
      title: 'Repair community shed roof',
      category: 'public_facilities',
      ward: 'Ward 150 - Bellandur',
      approximateLocation: 'Community Park',
      description: 'Rooftop repair for senior citizen community shed to prevent leaks.',
      costEstimateRange: { min: 500000, max: 200000 }, // min > max
    };

    expect(() => wardBudgetService.createProposal(badCost)).toThrow(/Cost estimate range/);
  });

  it('adds deliberation comments and updates proposal metrics', () => {
    const proposals = wardBudgetService.listProposals().proposals;
    const testId = proposals[0].id;
    const initialComments = wardBudgetService.listComments(testId);

    const newComment = wardBudgetService.addComment({
      proposalId: testId,
      content: 'This will benefit hundreds of school children in our neighborhood.',
    });

    expect(newComment.id).toMatch(/^COMM-\d+/);
    const updatedComments = wardBudgetService.listComments(testId);
    expect(updatedComments.length).toBe(initialComments.length + 1);
  });

  it('enforces role authorization on review decisions and updates status', () => {
    const proposals = wardBudgetService.listProposals().proposals;
    const testId = proposals[0].id;

    // Citizen cannot record a review decision
    expect(() =>
      wardBudgetService.recordReviewDecision(
        {
          proposalId: testId,
          decision: 'eligible',
          publicSummary: 'Technical review indicates compliant design and realistic budget.',
        },
        { role: 'citizen' }
      )
    ).toThrow(/Unauthorized/);

    // Official reviewer can record a review decision
    const res = wardBudgetService.recordReviewDecision(
      {
        proposalId: testId,
        decision: 'eligible',
        publicSummary: 'Technical review indicates compliant design and realistic budget.',
      },
      { id: 'REV-01', role: 'reviewer' }
    );

    expect(res.decision.decision).toBe('eligible');
    expect(res.proposal.status).toBe('eligible');
  });

  it('handles advisory voting with double-voting prevention', () => {
    const proposals = wardBudgetService.listProposals().proposals;
    const testId = proposals[0].id;
    const citizenId = 'CIT-TEST-001';

    const vote1 = wardBudgetService.castAdvisoryVote(testId, citizenId);
    expect(vote1.success).toBe(true);
    expect(vote1.voteReceipt).toBeDefined();

    // Second vote by the same citizen should be rejected
    expect(() => wardBudgetService.castAdvisoryVote(testId, citizenId)).toThrow(
      /already cast your advisory vote/
    );
  });
});

describe('proposalClusteringService (#765)', () => {
  it('tokenizes text and calculates Jaccard similarity', () => {
    const tokens1 = tokenizeText('Footpath construction and paving on 14th Main');
    const tokens2 = tokenizeText('Paving and repair of footpath on 14th Main');
    const similarity = computeJaccardSimilarity(tokens1, tokens2);
    expect(similarity).toBeGreaterThan(0.5);
  });

  it('identifies duplicate candidates and provides explainable provenance', () => {
    const existing = [
      {
        id: 'EXISTING-01',
        title: 'Tactile Footpath Paving along 14th Main Road',
        category: 'roads_footpaths',
        ward: 'Ward 150 - Bellandur',
        approximateLocation: '14th Main Road near ORR junction',
        description: 'New footpaths for pedestrians on 14th Main.',
        status: 'submitted',
      },
      {
        id: 'EXISTING-02',
        title: 'Community Tree Plantation in Lake Park',
        category: 'parks_greenery',
        ward: 'Ward 150 - Bellandur',
        approximateLocation: 'Bellandur Lake Park',
        description: 'Planting native shade trees.',
        status: 'submitted',
      },
    ];

    const draft = {
      title: 'Footpath Paving and Kerb Repair on 14th Main',
      category: 'roads_footpaths',
      ward: 'Ward 150 - Bellandur',
      approximateLocation: '14th Main Road',
      description: 'Pedestrian pavement fixing on 14th Main.',
    };

    const result = findDuplicateCandidates(draft, existing);
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].proposalId).toBe('EXISTING-01');
    expect(result.candidates[0].similarityScore).toBeGreaterThan(40);
    expect(result.candidates[0].influencingFactors.length).toBeGreaterThan(0);
    expect(result.metadata.rulesetVersion).toBeDefined();
  });
});

