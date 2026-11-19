import { describe, it, expect } from 'vitest';
import {
  createPetitionDraft,
  isValidPetitionTransition,
  submitPetitionSignature,
  withdrawPetitionSignature,
  reviewPetition,
  recordAuthorityResponse,
  findDuplicatePetitionSuggestions,
  exportPetitionSummary,
  PETITION_STATUSES,
  SIGNATURE_STATUSES,
  GEOGRAPHIC_SCOPES,
  NON_BINDING_CIVIC_NOTICE
} from './civicPetitionWorkflowService';

describe('civicPetitionWorkflowService', () => {
  it('should define statutory constants and notice', () => {
    expect(PETITION_STATUSES.ACTIVE).toBe('ACTIVE');
    expect(SIGNATURE_STATUSES.VERIFIED).toBe('VERIFIED');
    expect(GEOGRAPHIC_SCOPES.WARD).toBe('WARD');
    expect(NON_BINDING_CIVIC_NOTICE).toContain('statutory elections');
  });

  it('should create valid petition draft and validate input fields', () => {
    const validPayload = {
      title: 'Installation of Streetlights on 4th Main Road',
      targetAuthority: 'BBMP Ward 150 Executive Engineer',
      description: 'The 4th Main road lacks adequate streetlights causing safety concerns for pedestrians at night.',
      geographicScope: 'WARD',
      jurisdiction: 'Bruhat Bengaluru Mahanagara Palike'
    };

    const res = createPetitionDraft(validPayload, 'user_123');
    expect(res.success).toBe(true);
    expect(res.petition.status).toBe(PETITION_STATUSES.DRAFT);
    expect(res.petition.schemaVersion).toBe('1.0');

    // Invalid short title
    const invalid = createPetitionDraft({ title: 'Hi', description: 'Short' });
    expect(invalid.success).toBe(false);
    expect(invalid.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('should validate allowed status transitions', () => {
    expect(isValidPetitionTransition(PETITION_STATUSES.DRAFT, PETITION_STATUSES.PENDING_MODERATION)).toBe(true);
    expect(isValidPetitionTransition(PETITION_STATUSES.PENDING_MODERATION, PETITION_STATUSES.ACTIVE)).toBe(true);
    expect(isValidPetitionTransition(PETITION_STATUSES.ACTIVE, PETITION_STATUSES.UNDER_REVIEW)).toBe(true);
    expect(isValidPetitionTransition(PETITION_STATUSES.ACTIVE, PETITION_STATUSES.DRAFT)).toBe(false);
  });

  it('should record verified signature and allow withdrawal', () => {
    const activePetition = {
      petitionId: 'pet_test',
      status: PETITION_STATUSES.ACTIVE,
      closingDate: new Date(Date.now() + 100000).toISOString()
    };

    const signRes = submitPetitionSignature(activePetition, { voterOrResidentToken: 'tok_res_123' });
    expect(signRes.success).toBe(true);
    expect(signRes.signature.status).toBe(SIGNATURE_STATUSES.VERIFIED);
    expect(signRes.disclaimer).toBe(NON_BINDING_CIVIC_NOTICE);

    // Withdraw signature
    const withdrawRes = withdrawPetitionSignature(signRes.signature);
    expect(withdrawRes.success).toBe(true);
    expect(withdrawRes.signature.status).toBe(SIGNATURE_STATUSES.WITHDRAWN);
    expect(withdrawRes.signature.withdrawn).toBe(true);
  });

  it('should moderate petition submissions', () => {
    const pendingPetition = {
      petitionId: 'pet_mod',
      status: PETITION_STATUSES.PENDING_MODERATION
    };

    const reviewRes = reviewPetition(pendingPetition, 'APPROVE', 'Verified community civic issue', 'mod_1');
    expect(reviewRes.success).toBe(true);
    expect(reviewRes.nextStatus).toBe(PETITION_STATUSES.ACTIVE);
    expect(reviewRes.reviewRecord.decision).toBe('APPROVE');
  });

  it('should attach official authority responses', () => {
    const activePetition = {
      petitionId: 'pet_resp',
      status: PETITION_STATUSES.ACTIVE,
      targetAuthority: 'Municipal Health Officer'
    };

    const respRes = recordAuthorityResponse(activePetition, {
      officialOrderNumber: 'MHO/2024/CIRCULAR/88',
      summary: 'Fogging drive sanctioned and budget allocated under vector control programme.',
      decision: 'ACCEPTED'
    });

    expect(respRes.success).toBe(true);
    expect(respRes.nextStatus).toBe(PETITION_STATUSES.RESPONDED);
    expect(respRes.authorityResponse.officialOrderNumber).toBe('MHO/2024/CIRCULAR/88');
  });

  it('should detect duplicate petition suggestions without identity profiling', () => {
    const existing = [
      { petitionId: 'p1', title: 'Installation of LED streetlights on 4th Main road' },
      { petitionId: 'p2', title: 'Drinking water pipeline leakage at 2nd cross' }
    ];

    const matches = findDuplicatePetitionSuggestions('Repair and installation of streetlights on 4th main', existing);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches[0].petitionId).toBe('p1');
    expect(matches[0].similarityScore).toBeGreaterThan(0.4);
  });

  it('should export formatted markdown petition dossier', () => {
    const petition = {
      petitionId: 'pet_export',
      title: 'Desilting of Stormwater Drain Ahead of Monsoon',
      targetAuthority: 'Ward Nodal Officer',
      geographicScope: 'WARD',
      jurisdiction: 'Chennai Corporation',
      status: 'ACTIVE',
      verifiedSignaturesCount: 142,
      closingDate: '2024-06-30T00:00:00.000Z',
      description: 'The stormwater drain in Zone 7 is severely silted, risking waterlogging in residential clusters.'
    };

    const text = exportPetitionSummary(petition);
    expect(text).toContain('# Local Civic Petition Dossier');
    expect(text).toContain('Desilting of Stormwater Drain Ahead of Monsoon');
    expect(text).toContain('Chennai Corporation');
    expect(text).toContain('**Verified Signatures:** 142');
  });
});
