import { describe, it, expect } from 'vitest';
import {
  ingestGazettePublication,
  searchGazetteCorpus,
  answerWithGazetteCitations,
  submitResearchForEditorialReview,
  reviewResearchProposal,
  PUBLICATION_STATUS,
  PROMOTION_STATE,
  RESEARCH_DISCLAIMER,
} from './gazetteResearchWorkspaceService.js';

describe('Government Circular and Gazette Research Workspace Service', () => {
  const samplePub1 = {
    id: 'gazette-2024-42',
    documentNumber: 'G.S.R. 512(E)',
    authority: 'Ministry of Road Transport and Highways',
    jurisdiction: 'ALL_INDIA',
    notificationDate: '2024-05-15',
    sourceUrl: 'https://egazette.gov.in/WriteReadData/2024/254123.pdf',
    checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    status: PUBLICATION_STATUS.ACTIVE_IN_FORCE,
    pages: [
      {
        pageNumber: 1,
        section: 'Preamble',
        text: 'In exercise of powers conferred by section 110 of the Motor Vehicles Act 1988, Central Government hereby makes rules.',
      },
      {
        pageNumber: 2,
        section: 'Rule 4 - Digital Medical Certificate',
        text: 'The medical certificate in Form 1A shall be electronically transmitted by registered medical practitioner through Sarathi portal.',
      },
    ],
  };

  const samplePub2 = {
    id: 'circular-old-12',
    documentNumber: 'MoRTH/Cir/2019/12',
    authority: 'Ministry of Road Transport and Highways',
    jurisdiction: 'ALL_INDIA',
    notificationDate: '2019-01-10',
    sourceUrl: 'https://morth.nic.in/circ-2019-12.pdf',
    checksum: 'a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e',
    status: PUBLICATION_STATUS.SUPERSEDED,
    supersededBy: 'G.S.R. 512(E)',
    pages: [
      {
        pageNumber: 1,
        section: 'Physical Verification',
        text: 'Physical Form 1A submission is permitted at RTO counter with physical seal.',
      },
    ],
  };

  it('validates and ingests publication metadata preserving page boundaries', () => {
    const ingested = ingestGazettePublication(samplePub1);
    expect(ingested.totalPages).toBe(2);
    expect(ingested.pages[1].pageNumber).toBe(2);
    expect(ingested.pages[1].section).toContain('Rule 4');
  });

  it('searches the corpus using document identifier, department, and keywords', () => {
    const corpus = [ingestGazettePublication(samplePub1), ingestGazettePublication(samplePub2)];

    const results = searchGazetteCorpus(corpus, {
      identifier: '512(E)',
      query: 'medical certificate Form 1A',
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].documentNumber).toBe('G.S.R. 512(E)');
    expect(results[0].pageNumber).toBe(2);
    expect(results[0].section).toBe('Rule 4 - Digital Medical Certificate');
  });

  it('answers queries with exact page-level citations and flags superseded rules', () => {
    const corpus = [ingestGazettePublication(samplePub1), ingestGazettePublication(samplePub2)];

    const response = answerWithGazetteCitations(
      'How is Form 1A medical certificate submitted for driving licence?',
      corpus
    );

    expect(response.status).toBe('ANSWERED_WITH_CITATIONS');
    expect(response.citations.length).toBeGreaterThanOrEqual(1);
    expect(response.citations[0].pageNumber).toBe(2);
    expect(response.citations[0].documentNumber).toBe('G.S.R. 512(E)');
    expect(response.citations[0].checksum).toBeDefined();
    expect(response.hasConflictingPublications).toBe(true);
    expect(response.supersededAlert).toContain('has been superseded');
  });

  it('abstains with explicit message when no relevant gazette passages exist', () => {
    const corpus = [ingestGazettePublication(samplePub1)];

    const response = answerWithGazetteCitations(
      'Spaceflight passenger customs clearance rules in India',
      corpus
    );

    expect(response.status).toBe('ABSTAIN_NO_CITATIONS');
    expect(response.answer).toContain('No authoritative gazette notification or circular passage was found');
    expect(response.citations.length).toBe(0);
    expect(response.disclaimer).toBe(RESEARCH_DISCLAIMER);
  });

  it('routes research finding through editorial review gate before catalogue promotion', () => {
    const corpus = [ingestGazettePublication(samplePub1)];
    const research = answerWithGazetteCitations('medical certificate Form 1A', corpus);

    const proposal = submitResearchForEditorialReview(research, 'legal_researcher_09');
    expect(proposal.promotionState).toBe(PROMOTION_STATE.PENDING_EDITORIAL_REVIEW);
    expect(proposal.reviewedBy).toBeNull();

    const approved = reviewResearchProposal(
      proposal,
      'editor_chief_01',
      true,
      'Verified with Gazette of India notification database.'
    );

    expect(approved.promotionState).toBe(PROMOTION_STATE.APPROVED_FOR_CATALOGUE);
    expect(approved.reviewedBy).toBe('editor_chief_01');
    expect(approved.reviewComments).toContain('Gazette of India');
  });
});
