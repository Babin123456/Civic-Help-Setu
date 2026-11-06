import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PoliceCharacterCertificateGuide from './PoliceCharacterCertificateGuide';

describe('PoliceCharacterCertificateGuide Component (#526)', () => {
  it('renders scannable Police Character Certificate guide with executive purpose and domestic scope', () => {
    const html = renderToStaticMarkup(<PoliceCharacterCertificateGuide />);

    expect(html).toContain('State Police Character Certificate Guide');
    expect(html).toContain('Executive Purpose of Character Certificate');
    expect(html).toContain('Primary Domestic Use Cases');
    expect(html).toContain('What a State Police Character Certificate Establishes vs. Does Not Establish');
  });

  it('renders police authority tags and navigation tabs', () => {
    const html = renderToStaticMarkup(<PoliceCharacterCertificateGuide />);

    expect(html).toContain('State Police Acts &amp; Regulations');
    expect(html).toContain('Domestic Employment &amp; Tenancy');
    expect(html).toContain('State Police Portals &amp; Fees');
    expect(html).toContain('Distinction from Passport PCC');
    expect(html).toContain('Required Evidence &amp; Verification');
  });
});
