import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SuccessionCertificateExplainer from './SuccessionCertificateExplainer';

describe('SuccessionCertificateExplainer Component (#524)', () => {
  it('renders scannable Succession Certificate explainer with legal nature and caveats', () => {
    const html = renderToStaticMarkup(<SuccessionCertificateExplainer />);

    expect(html).toContain('Succession Certificate Court Process Explainer');
    expect(html).toContain('Informational Guidance, Not Legal Advice');
    expect(html).toContain('Conclusive Indemnity to Debtors (Section 381)');
    expect(html).toContain('Distinction from Revenue Legal Heir Slips');
  });

  it('renders judicial authority tags and navigation tabs', () => {
    const html = renderToStaticMarkup(<SuccessionCertificateExplainer />);

    expect(html).toContain('Indian Succession Act, 1925 (Part X)');
    expect(html).toContain('Civil Court Judicial Process');
    expect(html).toContain('Judicial Stages &amp; Timelines');
    expect(html).toContain('Debts &amp; Securities vs. Real Estate');
    expect(html).toContain('Court Fees &amp; Indemnity Bond');
  });
});
