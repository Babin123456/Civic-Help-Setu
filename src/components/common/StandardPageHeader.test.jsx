import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Shield } from 'lucide-react';
import StandardPageHeader from './StandardPageHeader';

describe('StandardPageHeader Component (#590)', () => {
  it('renders title and subtitle with proper hierarchy', () => {
    const html = renderToStaticMarkup(
      <StandardPageHeader
        title="Civic Services Directory"
        subtitle="Explore official government guides and procedural steps."
      />
    );

    expect(html).toContain('<h1 class="page-header-title"');
    expect(html).toContain('Civic Services Directory');
    expect(html).toContain('<p class="page-header-subtitle"');
    expect(html).toContain('Explore official government guides');
  });

  it('renders eyebrow text, icon, and status badge', () => {
    const html = renderToStaticMarkup(
      <StandardPageHeader
        eyebrow="Identity &amp; Civil Registration"
        eyebrowIcon={<Shield size={16} />}
        badgeText="Verified Official"
        badgeType="success"
        title="Death Certificate Guide"
      />
    );

    expect(html).toContain('page-header-eyebrow');
    expect(html).toContain('Identity &amp; Civil Registration');
    expect(html).toContain('page-header-badge');
    expect(html).toContain('Verified Official');
  });

  it('renders optional action children slot', () => {
    const html = renderToStaticMarkup(
      <StandardPageHeader title="Nearby Civic Offices">
        <button type="button">Use My Location</button>
      </StandardPageHeader>
    );

    expect(html).toContain('page-header-actions');
    expect(html).toContain('Use My Location');
  });

  it('supports left-alignment and custom max-width', () => {
    const html = renderToStaticMarkup(
      <StandardPageHeader
        title="Left Aligned Heading"
        subtitle="Descriptive subheader with left alignment"
        align="left"
        maxWidth="600px"
      />
    );

    expect(html).toContain('text-align:left');
    expect(html).toContain('max-width:600px');
  });

  it('handles badges with different semantic status tokens', () => {
    const html = renderToStaticMarkup(
      <StandardPageHeader
        title="Notice Header"
        badgeText="Warning Status"
        badgeType="warning"
      />
    );

    expect(html).toContain('Warning Status');
    expect(html).toContain('rgba(245, 158, 11, 0.15)');
  });
});
