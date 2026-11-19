import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import StandardBillingAnalyzerCard from './StandardBillingAnalyzerCard.jsx';

describe('StandardBillingAnalyzerCard Component (#881)', () => {
  it('renders hospital billing line items and standard rate caps', () => {
    const html = renderToStaticMarkup(<StandardBillingAnalyzerCard />);

    expect(html).toContain('Hospital Billing &amp; Standard Tariff Overcharge Analyzer');
    expect(html).toContain('Section 12(2)(o)');
    expect(html).toContain('Add Item');
    expect(html).toContain('Total Invoiced by Hospital');
    expect(html).toContain('Illegal Extracted Overcharge');
  });

  it('triggers onBillingAnalysisChange callback with computed overcharges', () => {
    let captured = null;
    renderToStaticMarkup(
      <StandardBillingAnalyzerCard onBillingAnalysisChange={(data) => { captured = data; }} />
    );

    expect(captured).not.toBeNull();
    expect(captured.totalInvoicedInr).toBeGreaterThan(0);
    expect(captured.totalStatutoryCeilingInr).toBeGreaterThan(0);
  });
});
