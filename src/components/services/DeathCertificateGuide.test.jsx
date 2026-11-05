import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DeathCertificateGuide from './DeathCertificateGuide';

describe('DeathCertificateGuide Component (#502)', () => {
  it('renders scannable information cards and statutory details', () => {
    const html = renderToStaticMarkup(<DeathCertificateGuide />);

    expect(html).toContain('Death Certificate Issuance &amp; Certified Copies');
    expect(html).toContain('What This Document Proves');
    expect(html).toContain('What It Does NOT Prove');
    expect(html).toContain('Does NOT prove Legal Heirship');
    expect(html).toContain('Place of Occurrence');
  });

  it('contains state jurisdiction options and delayed registration magistrate tiers', () => {
    const html = renderToStaticMarkup(<DeathCertificateGuide />);

    expect(html).toContain('All-India / Central Standard');
    expect(html).toContain('Tamil Nadu (CRSTN)');
  });
});
