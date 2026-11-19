import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import PropertyTaxNoDuesGuidePage from './PropertyTaxNoDuesGuidePage';

describe('PropertyTaxNoDuesGuidePage Component (#531)', () => {
  it('renders within the standard page section and includes back button and property tax guide', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PropertyTaxNoDuesGuidePage />
      </MemoryRouter>
    );

    expect(html).toContain('Back to All Services');
    expect(html).toContain('Property Tax No-Dues Certificate &amp; Payment Receipt Guide');
    expect(html).toContain('Verified Municipal Revenue Guide • Issue #531');
    expect(html).toContain('Select Jurisdiction (State / District / Urban Local Body)');
    expect(html).toContain('Receipt ≠ No-Dues Certificate');
  });
});
