import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ReraEscrowAuditCard from './ReraEscrowAuditCard.jsx';

describe('ReraEscrowAuditCard Component (#875)', () => {
  it('renders escrow audit form and statutory callout', () => {
    const html = renderToStaticMarkup(<ReraEscrowAuditCard />);

    expect(html).toContain('Section 4(2)(l)(D)');
    expect(html).toContain('70% Dedicated Escrow Account Audit');
    expect(html).toContain('Nirvana Lifespaces Ltd.');
    expect(html).toContain('Mandatory 70% Escrow');
    expect(html).toContain('Max Allowable Withdrawal');
    expect(html).toContain('Section 35 &amp; 36 Forensic Investigation');
    expect(html).toContain('Copy Petition');
    expect(html).toContain('Download Slip');
  });

  it('renders save button when onSaveAudit is provided', () => {
    const html = renderToStaticMarkup(<ReraEscrowAuditCard onSaveAudit={() => {}} />);

    expect(html).toContain('Save Audit');
  });
});
