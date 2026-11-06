import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LegalHeirCertificateGuide from './LegalHeirCertificateGuide';

describe('LegalHeirCertificateGuide Component (#523)', () => {
  it('renders scannable Legal Heir guide with executive purpose and caveats', () => {
    const html = renderToStaticMarkup(<LegalHeirCertificateGuide />);

    expect(html).toContain('Legal Heir &amp; Surviving Member Certificate Guide');
    expect(html).toContain('Executive Purpose of the Certificate');
    expect(html).toContain('Common Practical Uses');
    expect(html).toContain('What a Legal Heir Certificate Establishes vs. Does Not Establish');
  });

  it('renders revenue administration tags and navigation tabs', () => {
    const html = renderToStaticMarkup(<LegalHeirCertificateGuide />);

    expect(html).toContain('State Revenue Administration');
    expect(html).toContain('Administrative Survivor Record');
    expect(html).toContain('Legal Heir vs. Succession Certificate');
    expect(html).toContain('Recognized Heirs &amp; Documents');
    expect(html).toContain('State Revenue Variations');
  });
});
