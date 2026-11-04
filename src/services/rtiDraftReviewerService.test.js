import { describe, it, expect } from 'vitest';
import {
  reviewRtiDraft,
  RTI_ISSUE_TYPES,
  SAMPLE_RTI_DRAFTS,
} from './rtiDraftReviewerService.js';

describe('rtiDraftReviewerService', () => {
  it('identifies well-formed RTI requests with high compliance score', () => {
    const wellFormed = {
      publicAuthority: 'Public Works Department, Delhi',
      timePeriod: '01/01/2023 to 31/12/2023',
      fileReference: 'Tender Work Order #PWD-4912',
      questions: [
        'Certified copy of the work order and contract agreement for Tender #PWD-4912.',
        'Certified copy of the measurement book (MB) records for road carpeting on Ring Road.',
      ],
    };

    const result = reviewRtiDraft(wellFormed);
    expect(result.isValid).toBe(true);
    expect(result.status).toBe('READY_TO_SUBMIT');
    expect(result.complianceScore).toBe(100);
    expect(result.queryIssues.length).toBe(0);
    expect(result.structuralDeficiencies.length).toBe(0);
  });

  it('detects Section 2(f) opinion / "why" queries and generates record-based rewording', () => {
    const poorlyFormed = {
      publicAuthority: 'Municipal Corporation',
      timePeriod: 'Preceding 6 months',
      questions: [
        'Why was my mutation application delayed for four months?',
        'Who is responsible for the broken street lights on 5th Cross Road?',
      ],
    };

    const result = reviewRtiDraft(poorlyFormed);
    expect(result.isValid).toBe(true);
    expect(result.status).toBe('NEEDS_REWORDING');
    expect(result.complianceScore).toBeLessThan(70);

    const whyIssue = result.queryIssues.find((i) => i.type === RTI_ISSUE_TYPES.OPINION_OR_WHY_QUERY);
    expect(whyIssue).toBeDefined();
    expect(whyIssue.title).toContain('Section 2(f)');
    expect(whyIssue.suggestedRewording).toContain('certified copies of file notings');

    // Confirm suggestion list exists
    expect(result.suggestions.length).toBe(2);
    expect(result.suggestions[0].suggested).toContain('file notings');
    expect(result.suggestions[1].suggested).toContain('duty roster');
  });

  it('flags missing public authority and unbounded time period', () => {
    const draft = {
      publicAuthority: '', // missing
      timePeriod: '', // missing
      questions: ['Provide all expenditure details of development funds.'],
    };

    const result = reviewRtiDraft(draft);
    expect(result.isValid).toBe(true);
    expect(result.structuralDeficiencies.some((d) => d.type === RTI_ISSUE_TYPES.MISSING_PUBLIC_AUTHORITY)).toBe(true);
    expect(result.structuralDeficiencies.some((d) => d.type === RTI_ISSUE_TYPES.MISSING_TIME_PERIOD)).toBe(true);
  });

  it('detects Section 8 exemption risk for sensitive keywords', () => {
    const draft = {
      publicAuthority: 'Ministry of Home Affairs',
      timePeriod: '2023',
      fileReference: 'Internal',
      questions: ['Provide raw intelligence reports and secret service notes regarding border checkposts.'],
    };

    const result = reviewRtiDraft(draft);
    const sec8Issue = result.queryIssues.find((i) => i.type === RTI_ISSUE_TYPES.SECTION_8_EXEMPTION_RISK);
    expect(sec8Issue).toBeDefined();
    expect(sec8Issue.explanation).toContain('Section 8(1)(a)');
  });

  it('handles empty questions gracefully', () => {
    const result = reviewRtiDraft({ questions: [] });
    expect(result.isValid).toBe(false);
    expect(result.totalQuestions).toBe(0);
  });

  it('validates all curated sample RTI drafts successfully', () => {
    SAMPLE_RTI_DRAFTS.forEach((sample) => {
      const res = reviewRtiDraft({
        questions: sample.questions,
        publicAuthority: sample.authority,
        timePeriod: sample.timePeriod,
      });
      expect(res.isValid).toBe(true);
      expect(res.totalQuestions).toBe(sample.questions.length);
    });
  });
});
