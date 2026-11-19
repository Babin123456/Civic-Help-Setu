import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import FreeEntitlementReconcilerCard from './FreeEntitlementReconcilerCard.jsx';

describe('FreeEntitlementReconcilerCard Component (#889)', () => {
  it('renders Section 3(2) mandatory free entitlement reconciler table', () => {
    const html = renderToStaticMarkup(<FreeEntitlementReconcilerCard />);

    expect(html).toContain('Section 3(2) Mandatory Free Entitlement &amp; Auxiliary Fee Reconciler');
    expect(html).toContain('Total Billed Invoice');
    expect(html).toContain('Permissible EWS Charge');
    expect(html).toContain('Total Illegal Overcharge');
    expect(html).toContain('Tuition &amp; Academic Term Fee');
    expect(html).toContain('₹0 (Free)');
  });
});
