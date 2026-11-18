import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import FollowUpEscalationDraftModal from './FollowUpEscalationDraftModal.jsx';
import { INITIAL_SAMPLE_CASES } from '../../services/accessibilityEscalationStorage.js';

describe('FollowUpEscalationDraftModal Component (#950)', () => {
  const sampleCase = INITIAL_SAMPLE_CASES[0];

  it('renders modal with tabs for Follow-Up and Escalation Petition', () => {
    const html = renderToStaticMarkup(
      <FollowUpEscalationDraftModal
        caseData={sampleCase}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('Editable Follow-Up &amp; Escalation Drafter');
    expect(html).toContain('1. Authority Follow-Up Representation');
    expect(html).toContain('2. Disabilities Commissioner Petition (RPwD Sec 75/80)');
  });

  it('renders non-automated submission legal advisory banner', () => {
    const html = renderToStaticMarkup(
      <FollowUpEscalationDraftModal
        caseData={sampleCase}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('Non-Automatic Submission Notice:');
    expect(html).toContain('CivicBridge generates this draft locally on your device');
    expect(html).toContain('This document is <strong>NOT</strong> transmitted automatically.');
  });

  it('renders statutory provisions and draft content in textarea', () => {
    const html = renderToStaticMarkup(
      <FollowUpEscalationDraftModal
        caseData={sampleCase}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('Section 45(1) of the Rights of Persons with Disabilities Act, 2016');
    expect(html).toContain('Harmonised Guidelines and Space Standards');
    expect(html).toContain('HEALTH/2026/G-88219');
  });

  it('renders action buttons for copy and export', () => {
    const html = renderToStaticMarkup(
      <FollowUpEscalationDraftModal
        caseData={sampleCase}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('Copy Draft Text');
    expect(html).toContain('Download .txt');
    expect(html).toContain('Download .md');
  });
});
