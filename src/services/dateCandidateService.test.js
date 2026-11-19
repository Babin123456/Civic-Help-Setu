import { describe, it, expect } from 'vitest';
import {
  normalizeDateString,
  extractDateCandidates,
  ACTION_TYPES,
  CONFIRMATION_STATES,
  calculateDependencies,
  exportConfirmedDatesToIcs,
  getReadableList,
} from './dateCandidateService';

describe('dateCandidateService - normalizeDateString', () => {
  it('parses ISO format YYYY-MM-DD', () => {
    expect(normalizeDateString('2026-11-15')).toBe('2026-11-15');
  });

  it('parses Indian format DD/MM/YYYY', () => {
    expect(normalizeDateString('15/11/2026')).toBe('2026-11-15');
  });

  it('parses Indian format DD-MM-YYYY', () => {
    expect(normalizeDateString('15-11-2026')).toBe('2026-11-15');
  });

  it('parses US format MM/DD/YYYY', () => {
    expect(normalizeDateString('11/15/2026')).toBe('2026-11-15');
  });

  it('parses US short format MM/DD/YY', () => {
    expect(normalizeDateString('11/15/26')).toBe('2026-11-15');
  });

  it('parses YYYY/MM/DD format', () => {
    expect(normalizeDateString('2026/11/15')).toBe('2026-11-15');
  });

  it('returns null for invalid date 2026-02-30', () => {
    expect(normalizeDateString('2026-02-30')).toBe(null);
  });

  it('returns null for empty string', () => {
    expect(normalizeDateString('')).toBe(null);
  });

  it('returns null for null input', () => {
    expect(normalizeDateString(null)).toBe(null);
  });

  it('returns null for undefined', () => {
    expect(normalizeDateString(undefined)).toBe(null);
  });
});

describe('dateCandidateService - extractDateCandidates', () => {
  it('extracts date candidates with action types from notice text', () => {
    const text = `
      GOVERNMENT OF MAHARASHTRA
      Revenue Department
      Notice No: REV-2026/89

      All beneficiaries must submit their land record affidavits before 15/11/2026.
      Submissions received after the deadline will not be processed.
      Attend the hearing on 02/12/2026 at the district collectorate.
      Pay the processing fee of Rs. 500 by 30/11/2026.
    `;

    const candidates = extractDateCandidates(text);

    expect(candidates).toBeDefined();
    expect(candidates.length).toBeGreaterThan(0);

    // Should find dates with action types
    const hasResponse = candidates.some((c) => c.actionType === ACTION_TYPES.RESPONSE);
    const hasHearing = candidates.some((c) => c.actionType === ACTION_TYPES.HEARING);
    const hasPayment = candidates.some((c) => c.actionType === ACTION_TYPES.PAYMENT);

    expect(hasResponse).toBe(true);
    expect(hasHearing).toBe(true);
    expect(hasPayment).toBe(true);
  });

  it('marks AI suggestions with _aiSuggestion flag', () => {
    const text = 'Submit your application before 15/11/2026.';

    const candidates = extractDateCandidates(text);

    expect(candidates.length).toBeGreaterThan(0);
    const candidate = candidates[0];
    expect(candidate._aiSuggestion).toBe(true);
    expect(candidate._confirmationSource).toBe('ai-extraction');
    expect(candidate.confirmationState).toBe(CONFIRMATION_STATES.PENDING);
  });

  it('deduplicates same normalized date + action type', () => {
    const text = `
      Submit your application before 15/11/2026.
      The last date for submission is 15/11/2026.
    `;

    const candidates = extractDateCandidates(text);

    // Should deduplicate the same date

    expect(candidates.length).toBeLessThanOrEqual(4); // at most 4 action types
  });

  it('handles text with no dates', () => {
    const text = 'This notice has no dates at all.';

    const candidates = extractDateCandidates(text);
    expect(candidates).toEqual([]);
  });

  it('handles empty text', () => {
    const candidates = extractDateCandidates('');
    expect(candidates).toEqual([]);
  });

  it('handles null/undefined text', () => {
    expect(extractDateCandidates(null)).toEqual([]);
    expect(extractDateCandidates(undefined)).toEqual([]);
  });
});

describe('dateCandidateService - calculateDependencies', () => {
  it('calculates dependencies between date candidates', () => {
    const candidates = [
      {
        id: '1',
        normalizedDate: '2026-11-15',
        actionType: ACTION_TYPES.RESPONSE,
        confirmationState: CONFIRMATION_STATES.CONFIRMED,
        sourceAnchor: 'Submit application',
        calculationRule: 'ai-extraction',
        confidence: 0.8,
      },
      {
        id: '2',
        normalizedDate: '2026-12-02',
        actionType: ACTION_TYPES.HEARING,
        confirmationState: CONFIRMATION_STATES.PENDING,
        sourceAnchor: 'Attend hearing',
        calculationRule: 'ai-extraction',
        confidence: 0.7,
      },
      {
        id: '3',
        normalizedDate: '2026-12-30',
        actionType: ACTION_TYPES.PAYMENT,
        confirmationState: CONFIRMATION_STATES.PENDING,
        sourceAnchor: 'Pay fee',
        calculationRule: 'ai-extraction',
        confidence: 0.6,
      },
    ];

    const withDeps = calculateDependencies(candidates);

    // Later dates should have dependency markers from earlier confirmed dates
    expect(withDeps).toBeDefined();
    expect(withDeps[1].dependsOn).toBeDefined();
    expect(withDeps[2].dependsOn).toBeDefined();
  });

  it('returns original order when no candidates', () => {
    const withDeps = calculateDependencies([]);
    expect(withDeps).toEqual([]);
  });

  it('returns original order when single candidate', () => {
    const withDeps = calculateDependencies([
      {
        id: '1',
        normalizedDate: '2026-11-15',
        actionType: ACTION_TYPES.RESPONSE,
        confirmationState: CONFIRMATION_STATES.PENDING,
        sourceAnchor: 'Submit',
        calculationRule: 'ai-extraction',
        confidence: 0.8,
      },
    ]);
    expect(withDeps).toHaveLength(1);
  });
});

describe('dateCandidateService - exportConfirmedDatesToIcs', () => {
  it('exports confirmed dates as ICS content', () => {
    const candidates = [
      {
        id: '1',
        normalizedDate: '2026-11-15',
        actionType: 'response',
        confirmationState: 'confirmed',
        sourceAnchor: 'Submit application',
        calculationRule: 'ai-extraction',
        confidence: 0.8,
      },
      {
        id: '2',
        normalizedDate: '2026-12-02',
        actionType: 'hearing',
        confirmationState: 'confirmed',
        sourceAnchor: 'Attend hearing',
        calculationRule: 'ai-extraction',
        confidence: 0.7,
      },
    ];

    const icsContent = exportConfirmedDatesToIcs(candidates);

    expect(icsContent).toBeDefined();
    expect(icsContent).toContain('BEGIN:VCALENDAR');
    expect(icsContent).toContain('END:VCALENDAR');
    expect(icsContent).toContain('DTSTART');
    expect(icsContent).toContain('DTEND');
    expect(icsContent).toContain('RESPONSE');
    expect(icsContent).toContain('HEARING');
  });

  it('returns null when no confirmed dates', () => {
    const candidates = [
      {
        id: '1',
        normalizedDate: '2026-11-15',
        actionType: 'response',
        confirmationState: 'pending',
        sourceAnchor: 'Submit application',
        calculationRule: 'ai-extraction',
        confidence: 0.8,
      },
    ];

    const icsContent = exportConfirmedDatesToIcs(candidates);
    expect(icsContent).toBeNull();
  });

  it('returns null when candidates have no normalized dates', () => {
    const candidates = [
      {
        id: '1',
        normalizedDate: null,
        actionType: 'response',
        confirmationState: 'confirmed',
        sourceAnchor: 'Submit application',
        calculationRule: 'ai-extraction',
        confidence: 0.8,
      },
    ];

    const icsContent = exportConfirmedDatesToIcs(candidates);
    expect(icsContent).toBeNull();
  });
});

describe('dateCandidateService - getReadableList', () => {
  it('returns readable list with no confirmed candidates', () => {
    const candidates = [
      {
        id: '1',
        normalizedDate: '2026-11-15',
        actionType: 'response',
        confirmationState: 'pending',
        sourceAnchor: 'Submit application',
        calculationRule: 'ai-extraction',
        confidence: 0.8,
      },
    ];

    const result = getReadableList(candidates);
    expect(result.lines).toBeDefined();
    expect(result.lines.length > 0).toBe(true);
    expect(result.table).toBeNull();
  });

  it('returns table with confirmed candidates', () => {
    const candidates = [
      {
        id: '1',
        normalizedDate: '2026-11-15',
        actionType: 'response',
        confirmationState: 'confirmed',
        sourceAnchor: 'Submit application before due date',
        calculationRule: 'ai-extraction',
        confidence: 0.8,
      },
      {
        id: '2',
        normalizedDate: '2026-12-02',
        actionType: 'hearing',
        confirmationState: 'confirmed',
        sourceAnchor: 'Attend hearing at district collectorate',
        calculationRule: 'ai-extraction',
        confidence: 0.7,
      },
    ];

    const result = getReadableList(candidates);
    expect(result.table).toBeDefined();
    expect(result.table.headers).toBeDefined();
    expect(result.table.rows).toBeDefined();
    expect(result.table.rows.length).toBe(2);
    expect(result.table.headers.length).toBe(4); // Action, Date, Source Anchor, Confirmation
  });

  it('handles empty candidates', () => {
    const result = getReadableList([]);
    expect(result.lines).toBeDefined();
    expect(result.table).toBeNull();
  });
});