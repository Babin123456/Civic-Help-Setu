import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CaseSummaryCard from './CaseSummaryCard.jsx';
import { INITIAL_SAMPLE_CASES } from '../../services/accessibilityEscalationStorage.js';

describe('CaseSummaryCard Component (#950)', () => {
  const sampleCase = INITIAL_SAMPLE_CASES[0];

  it('returns null when caseData is missing', () => {
    const html = renderToStaticMarkup(<CaseSummaryCard caseData={null} />);
    expect(html).toBe('');
  });

  it('renders case details, title, facility name, and complaint number', () => {
    const html = renderToStaticMarkup(
      <CaseSummaryCard
        caseData={sampleCase}
        onStatusChange={vi.fn()}
        onEditCase={vi.fn()}
        onDeleteCase={vi.fn()}
        onExportJson={vi.fn()}
        onExportMarkdown={vi.fn()}
        onGenerateDraft={vi.fn()}
      />
    );

    expect(html).toContain('Wheelchair Ramp &amp; Lift Inaccessibility at District Civil Hospital');
    expect(html).toContain('District Civil Hospital, Block B');
    expect(html).toContain('Civil Hospital Road, Ward 7');
    expect(html).toContain('HEALTH/2026/G-88219');
  });

  it('renders official status disclaimer and citizen tracker notice', () => {
    const html = renderToStaticMarkup(<CaseSummaryCard caseData={sampleCase} />);

    expect(html).toContain('Citizen Record vs Official Status:');
    expect(html).toContain('CITIZEN TRACKER NOTICE');
    expect(html).toContain('This timeline reflects citizen-recorded milestones');
  });

  it('renders target follow-up milestone disclaimer', () => {
    const html = renderToStaticMarkup(<CaseSummaryCard caseData={sampleCase} />);

    expect(html).toContain('Target follow-up dates are citizen-managed organizational milestones');
    expect(html).toContain('does not automatically constitute court contempt or statutory default');
  });

  it('renders action buttons for export, escalation draft, and edit', () => {
    const html = renderToStaticMarkup(<CaseSummaryCard caseData={sampleCase} />);

    expect(html).toContain('Draft Follow-Up / Escalation');
    expect(html).toContain('JSON');
    expect(html).toContain('Markdown Log');
    expect(html).toContain('Edit Case Details');
    expect(html).toContain('Delete');
  });
});
