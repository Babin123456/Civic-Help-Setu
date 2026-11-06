import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EwsCertificateGuide from './EwsCertificateGuide';

describe('EwsCertificateGuide Component (#506)', () => {
  it('renders scannable EWS certificate issuance cards and DoPT criteria', () => {
    const html = renderToStaticMarkup(<EwsCertificateGuide />);

    expect(html).toContain('EWS Income &amp; Asset Certificate Guide');
    expect(html).toContain('103rd Constitutional Amendment');
    expect(html).toContain('Who Can Apply for EWS?');
    expect(html).toContain('Valid Year vs. Assessment Year Confusion');
    expect(html).toContain('Central Form (Annexure-I)');
  });
});
