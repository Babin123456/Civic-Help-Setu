import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import SmallBusinessLicencePage from './SmallBusinessLicencePage';

describe('SmallBusinessLicencePage Component (#721)', () => {
  it('renders within the standard page section and includes navigation and checklist centre', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <SmallBusinessLicencePage />
      </MemoryRouter>
    );

    expect(html).toContain('Back to All Services');
    expect(html).toContain('Small-Business Licence Renewal &amp; Closure Checklist Centre');
    expect(html).toContain('Statutory Compliance Centre');
    expect(html).toContain('Official Boundary Notice');
  });
});
