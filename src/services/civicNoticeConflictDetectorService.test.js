import { describe, it, expect } from 'vitest';
import {
  normalizeNoticeIdentifier,
  evaluateNoticeGrouping,
  detectNoticeConflicts,
  buildNoticeConflictDossier,
  reviewNoticeConflictDossier,
  CONFLICT_TYPE,
  RELATIONSHIP_STATE,
  NOTICE_DISCLAIMER,
} from './civicNoticeConflictDetectorService.js';

describe('Civic Notice and Public-Order Deduplication and Conflict Detector', () => {
  const originalNotice = {
    id: 'notice-orig-101',
    noticeNumber: 'REC/2025/EXAM/04',
    title: 'Recruitment Notice for Junior Revenue Inspector',
    authority: 'Staff Selection Board',
    publicationDate: '2025-01-10',
    deadlineDate: '2025-02-15',
    venue: 'District Examination Hall A',
    bodyText: 'Applications invited for Junior Revenue Inspector. Examination at District Examination Hall A.',
    sourceUrl: 'https://ssb.gov.in/notice_04.pdf',
  };

  const amendedNotice = {
    id: 'notice-amend-102',
    noticeNumber: 'REC/2025/EXAM/04-CORR',
    title: 'Corrigendum to Recruitment Notice REC/2025/EXAM/04',
    authority: 'Staff Selection Board',
    publicationDate: '2025-01-25',
    deadlineDate: '2025-02-28', // Extended!
    venue: 'Government Polytechnic Auditorium', // Changed!
    bodyText: 'In continuation of notice REC/2025/EXAM/04, deadline extended to 28-02-2025 and venue shifted to Government Polytechnic Auditorium.',
    sourceUrl: 'https://ssb.gov.in/corr_04.pdf',
  };

  it('normalizes alphanumeric notice identifiers', () => {
    expect(normalizeNoticeIdentifier('REC / 2025 - EXAM / 04')).toBe('REC2025EXAM04');
    expect(normalizeNoticeIdentifier('G.S.R. 512(E)')).toBe('GSR512E');
  });

  it('evaluates candidate grouping using identifier relationship and text citations', () => {
    const grouping = evaluateNoticeGrouping(originalNotice, amendedNotice);
    expect(grouping.isCandidateGroup).toBe(true);
    expect(grouping.groupingConfidence).toBeGreaterThanOrEqual(0.9);
    expect(grouping.linkReason).toContain('REC/2025/EXAM/04');
  });

  it('detects date extension and venue location conflicts side-by-side', () => {
    const conflicts = detectNoticeConflicts(originalNotice, amendedNotice);
    expect(conflicts.length).toBe(2);

    const dateConflict = conflicts.find((c) => c.conflictType === CONFLICT_TYPE.DATE_MODIFIED);
    expect(dateConflict).toBeDefined();
    expect(dateConflict.originalValue).toBe('2025-02-15');
    expect(dateConflict.candidateValue).toBe('2025-02-28');

    const venueConflict = conflicts.find((c) => c.conflictType === CONFLICT_TYPE.VENUE_LOCATION_CHANGED);
    expect(venueConflict).toBeDefined();
    expect(venueConflict.originalValue).toBe('District Examination Hall A');
    expect(venueConflict.candidateValue).toBe('Government Polytechnic Auditorium');
  });

  it('detects explicit cancellation and withdrawal notices', () => {
    const cancellationNotice = {
      id: 'notice-cancel-103',
      noticeNumber: 'REC/2025/EXAM/04-CANCEL',
      title: 'Notice of Cancellation for REC/2025/EXAM/04',
      authority: 'Staff Selection Board',
      publicationDate: '2025-02-01',
      bodyText: 'The recruitment process initiated under notice REC/2025/EXAM/04 stands cancelled due to administrative reasons.',
      sourceUrl: 'https://ssb.gov.in/cancel_04.pdf',
    };

    const conflicts = detectNoticeConflicts(originalNotice, cancellationNotice);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].conflictType).toBe(CONFLICT_TYPE.WITHDRAWAL_CANCELLATION);
    expect(conflicts[0].candidateValue).toBe('WITHDRAWN');
  });

  it('builds a conflict dossier and supports editorial review without destructive source changes', () => {
    const dossier = buildNoticeConflictDossier(originalNotice, amendedNotice);

    expect(dossier.hasConflicts).toBe(true);
    expect(dossier.originalNoticePreserved).toBe(true);
    expect(dossier.relationshipState).toBe(RELATIONSHIP_STATE.SUGGESTED_CONFLICT);
    expect(dossier.disclaimer).toBe(NOTICE_DISCLAIMER);

    // Editorial review gate
    const reviewed = reviewNoticeConflictDossier(
      dossier,
      'editor_lead_02',
      RELATIONSHIP_STATE.CONFIRMED_AMENDMENT,
      'Confirmed officially extended deadline and shifted examination center.'
    );

    expect(reviewed.relationshipState).toBe(RELATIONSHIP_STATE.CONFIRMED_AMENDMENT);
    expect(reviewed.reviewedBy).toBe('editor_lead_02');
    expect(reviewed.editorialAnnotation).toContain('shifted examination center');
  });
});
