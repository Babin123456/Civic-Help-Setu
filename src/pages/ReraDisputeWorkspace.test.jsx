import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ReraDisputeWorkspace from './ReraDisputeWorkspace.jsx';

describe('ReraDisputeWorkspace Page (#858 follow-up)', () => {
  it('exports a valid React functional component', () => {
    expect(typeof ReraDisputeWorkspace).toBe('function');
  });

  it('renders page header, statutory badges, and tab list', () => {
    const html = renderToStaticMarkup(<ReraDisputeWorkspace />);

    expect(html).toContain('RERA Homebuyer Dispute &amp; Delayed Possession Workspace');
    expect(html).toContain('Sec. 18 Interest: SBI MCLR + 2.0% p.a.');
    expect(html).toContain('Sec. 14(3): 5-Year Structural Warranty');
    expect(html).toContain('Sec. 29(4): 60-Day Adjudication Ceiling');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('Delay Interest &amp; Refund');
    expect(html).toContain('Section 14 Defect Liability');
    expect(html).toContain('Form M / Form N Drafter');
    expect(html).toContain('Evidence Checklist');
    expect(html).toContain('Saved Case Locker');
  });

  it('renders default Delay Interest calculator tab and statutory disclaimer', () => {
    const html = renderToStaticMarkup(<ReraDisputeWorkspace />);

    expect(html).toContain('RERA Section 18 Statutory Delay Interest &amp; Refund Calculator');
    expect(html).toContain('Committed Possession Date');
    expect(html).toContain('Statutory Notice:');
    expect(html).toContain('Real Estate (Regulation and Development) Act, 2016');
  });
});
