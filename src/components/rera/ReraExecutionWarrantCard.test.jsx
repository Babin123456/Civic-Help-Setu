import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ReraExecutionWarrantCard from './ReraExecutionWarrantCard.jsx';

describe('ReraExecutionWarrantCard Component (#875)', () => {
  it('renders execution particulars form and statutory callout', () => {
    const html = renderToStaticMarkup(<ReraExecutionWarrantCard />);

    expect(html).toContain('Section 40 Execution Petition');
    expect(html).toContain('Revenue Recovery Certificate');
    expect(html).toContain('Lodha Skyline Developers Pvt. Ltd.');
    expect(html).toContain('MahaRERA/CC/2025/9482');
    expect(html).toContain('Total Recoverable Debt');
    expect(html).toContain('Copy Petition');
    expect(html).toContain('Download Slip');
  });

  it('renders decree holder and judgment debtor labels', () => {
    const html = renderToStaticMarkup(<ReraExecutionWarrantCard onSavePetition={() => {}} />);

    expect(html).toContain('Decree Holder (Allottee)');
    expect(html).toContain('Judgment Debtor (Promoter)');
    expect(html).toContain('Save Execution');
  });
});
