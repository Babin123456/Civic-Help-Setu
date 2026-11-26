import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import TransgenderCertificateWelfarePage from './TransgenderCertificateWelfarePage';

describe('TransgenderCertificateWelfarePage Component (#1104)', () => {
  it('renders within standard page section and includes back navigation and navigator', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <TransgenderCertificateWelfarePage />
      </MemoryRouter>
    );

    expect(html).toContain('Back to Services');
    expect(html).toContain('Transgender Certificate &amp; Welfare Scheme Application Navigator');
    expect(html).toContain('Transgender Persons (Protection of Rights) Act, 2019');
    expect(html).toContain('Quick Exit (ESC)');
  });
});
