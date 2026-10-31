import { describe, it, expect } from 'vitest';
import { summarizeCivicNotice } from './civicNoticeSummarizerService';

describe('civicNoticeSummarizerService', () => {
  it('extracts a single explicit deadline cleanly', () => {
    const text = `
      GOVERNMENT OF MAHARASHTRA
      REVENUE & FOREST DEPARTMENT
      Notification No: REV-2026/89

      All beneficiaries of the farmer subsidy scheme must submit their land record affidavits
      before 15/11/2026. Submissions received after the deadline will not be processed.
    `;

    const summary = summarizeCivicNotice({ text, sourceUrl: 'https://maharashtra.gov.in/notices/89' });

    expect(summary.deadlineStatus).toBe('EXPLICIT_DEADLINE');
    expect(summary.primaryDeadline).toBe('15/11/2026');
    expect(summary.hasDateAmbiguity).toBe(false);
    expect(summary.sourceUrl).toBe('https://maharashtra.gov.in/notices/89');
    expect(summary.actions.some((a) => a.includes('submit'))).toBe(true);
    expect(summary.audience).toContain('farmer beneficiaries');
  });

  it('marks missing deadline as "Not found in the supplied notice."', () => {
    const text = `
      MUNICIPAL CORPORATION OF DELHI
      Public Advisory

      Citizens are advised that water main maintenance will be carried out across South Delhi wards.
      Residents should register for emergency water tankers by contacting their zonal helpline.
    `;

    const summary = summarizeCivicNotice(text);

    expect(summary.deadlineStatus).toBe('NO_DEADLINE');
    expect(summary.primaryDeadline).toBe('Not found in the supplied notice.');
    expect(summary.deadlines).toHaveLength(0);
    expect(summary.hasDateAmbiguity).toBe(false);
  });

  it('surfaces date ambiguity rather than silently resolving when multiple dates exist', () => {
    const text = `
      MINISTRY OF SOCIAL JUSTICE
      Circular No. MSJ/2026/401

      Scholarship applications will open on 01/10/2026. The initial submission window closes on 15/11/2026.
      However, institutional verification can be completed until 30/11/2026.
      Students must apply online and upload their income certificates.
    `;

    const summary = summarizeCivicNotice(text);

    expect(summary.deadlineStatus).toBe('AMBIGUOUS_DATES');
    expect(summary.hasDateAmbiguity).toBe(true);
    expect(summary.deadlines.length).toBeGreaterThanOrEqual(2);
    expect(summary.ambiguityNotice).toContain('3 distinct dates');
    expect(summary.primaryDeadline).toContain('Multiple dates found');
  });

  it('does not assume universal applicability when audience is not general', () => {
    const text = `
      All students applying for post-matric scholarships must verify their bank accounts.
    `;

    const summary = summarizeCivicNotice(text);
    expect(summary.isUniversal).toBe(false);
    expect(summary.audience).toContain('Students');
  });

  it('sanitizes unsafe source URLs and rejects javascript: protocol', () => {
    const summary = summarizeCivicNotice({
      text: 'Public Notice on pension payments.',
      sourceUrl: 'javascript:alert(1)'
    });

    expect(summary.sourceUrl).toBe('');
  });

  it('safely handles empty or missing input', () => {
    const summary = summarizeCivicNotice('');
    expect(summary.deadlineStatus).toBe('NO_DEADLINE');
    expect(summary.primaryDeadline).toBe('Not found in the supplied notice.');
    expect(summary.actions).toHaveLength(0);
  });
});
