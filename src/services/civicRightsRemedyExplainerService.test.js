import { describe, it, expect } from 'vitest';
import {
  validateSituationDescription,
  explainCivicRightsAndRemedies,
  generateHelpdeskQuestionsDossier,
  calculateLimitationWindow,
  REMEDY_TYPE,
  REMEDY_DISCLAIMER,
} from './civicRightsRemedyExplainerService.js';

describe('Plain-Language Civic Rights and Remedy Explainer Service', () => {
  const mockRemedyCorpus = [
    {
      id: 'rem-rts-delay',
      category: REMEDY_TYPE.CITIZEN_CHARTER_ESCALATION,
      jurisdiction: 'MAHARASHTRA',
      title: 'Right to Public Services Statutory Escalation',
      statutoryCitation: 'Maharashtra Right to Public Services Act 2015, Section 8',
      verbatimClause:
        'Section 8: Any eligible person whose application is not disposed of within the stipulated time limit or has been rejected may file a First Appeal to the First Appellate Authority within 30 days.',
      plainExplanation:
        'If the department fails to process your application within the published deadline, you have a legal right to file a First Appeal at no cost without hiring an advocate.',
      limitationDays: 30,
      triggers: ['delayed', 'stipulated time', 'exceeded deadline', 'rts', 'pending for months'],
      escalationAuthority: 'First Appellate Authority (Sub-Divisional Officer)',
      practicalOptions: [
        'Collect your original submission receipt with application tracking token.',
        'File a Form 1 First Appeal under RTS Act 2015 before the Sub-Divisional Officer.',
        'Request daily progress status report under Section 8(2).',
      ],
    },
    {
      id: 'rem-rti-denial',
      category: REMEDY_TYPE.RTI_INFORMATION_REQUEST,
      jurisdiction: 'ALL_INDIA',
      title: 'Information Access on Arbitrary Rejection',
      statutoryCitation: 'Right to Information Act 2005, Section 6(1)',
      verbatimClause:
        'A person who desires to obtain any information under this Act shall make a request in writing or through electronic means to the Central or State Public Information Officer.',
      plainExplanation:
        'You can formally demand the written file inspection notes, junior engineer reports, or departmental reason files that led to your application rejection.',
      triggers: ['arbitrary rejection', 'no reason given', 'rejected without cause', 'demanded bribe'],
      escalationAuthority: 'Central / State Public Information Officer',
      practicalOptions: [
        'Submit online RTI application specifying your original application token number.',
        'Request certified true copy of file notings on your file.',
      ],
    },
  ];

  it('requires adequate situation detail and prompts clarification on vague inputs', () => {
    const val = validateSituationDescription('help me please');
    expect(val.isDetailed).toBe(false);
    expect(val.promptClarification).toContain('Please describe your situation in more detail');

    const res = explainCivicRightsAndRemedies({
      situationText: 'help me',
      remedyCorpus: mockRemedyCorpus,
    });
    expect(res.status).toBe('NEEDS_CLARIFICATION');
    expect(res.remedies.length).toBe(0);
  });

  it('maps delayed application to Right to Public Services Act with verbatim clause', () => {
    const res = explainCivicRightsAndRemedies({
      situationText: 'My caste certificate application is pending for months and has exceeded deadline.',
      jurisdiction: 'MAHARASHTRA',
      remedyCorpus: mockRemedyCorpus,
    });

    expect(res.status).toBe('EXPLAINED_WITH_AUTHORITY');
    expect(res.remedies.length).toBe(1);

    const remedy = res.remedies[0];
    expect(remedy.category).toBe(REMEDY_TYPE.CITIZEN_CHARTER_ESCALATION);
    expect(remedy.statutoryCitation).toContain('Maharashtra Right to Public Services Act');
    expect(remedy.verbatimLegalClause).toContain('Section 8');
    expect(remedy.plainLanguageExplanation).toContain('legal right to file a First Appeal');
    expect(remedy.limitationDays).toBe(30);
  });

  it('abstains with explicit caveat when no statutory provision matches', () => {
    const res = explainCivicRightsAndRemedies({
      situationText: 'My neighbour is playing loud electronic music from a drone over my garden.',
      jurisdiction: 'ALL_INDIA',
      remedyCorpus: mockRemedyCorpus,
    });

    expect(res.status).toBe('ABSTAIN_NO_STATUTORY_PROVISION');
    expect(res.message).toContain('No verified statutory citizen remedy or service guarantee was found');
    expect(res.remedies.length).toBe(0);
    expect(res.helpdeskQuestions.length).toBeGreaterThan(0);
    expect(res.disclaimer).toBe(REMEDY_DISCLAIMER);
  });

  it('exports structured helpdesk presentation dossier with questions and citations', () => {
    const res = explainCivicRightsAndRemedies({
      situationText: 'My application has exceeded deadline without any progress update.',
      jurisdiction: 'MAHARASHTRA',
      remedyCorpus: mockRemedyCorpus,
    });

    const markdownDossier = generateHelpdeskQuestionsDossier(res);

    expect(markdownDossier).toContain('# Official Citizen Rights and Remedy Dossier');
    expect(markdownDossier).toContain('Maharashtra Right to Public Services Act 2015');
    expect(markdownDossier).toContain('Quoted Legal Provision');
    expect(markdownDossier).toContain('Questions to ask at the Official Helpdesk Counter');
    expect(markdownDossier).toContain(REMEDY_DISCLAIMER);
  });

  it('calculates statutory limitation window correctly', () => {
    const futureLimit = calculateLimitationWindow('2026-11-01', 30);
    expect(futureLimit.expiryDateStr).toBe('2026-12-01');

    const pastLimit = calculateLimitationWindow('2020-01-01', 30);
    expect(pastLimit.isExpired).toBe(true);
  });
});
