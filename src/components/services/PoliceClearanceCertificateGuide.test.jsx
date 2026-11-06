import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PoliceClearanceCertificateGuide from './PoliceClearanceCertificateGuide';

describe('PoliceClearanceCertificateGuide Component (#525)', () => {
  it('renders scannable Police Clearance Certificate guide with distinct international vs domestic routes', () => {
    const html = renderToStaticMarkup(<PoliceClearanceCertificateGuide />);

    expect(html).toContain('Police Clearance Certificate (PCC) Application Guide');
    expect(html).toContain('Crucial Warning: Never Submit a State Police Slip to an Embassy');
    expect(html).toContain('Route A: Passport Seva Kendra (PSK) PCC');
    expect(html).toContain('Route B: State Police Character Verification');
  });

  it('renders statutory authority tags and navigation tabs', () => {
    const html = renderToStaticMarkup(<PoliceClearanceCertificateGuide />);

    expect(html).toContain('Passports Act, 1967 &amp; State Police Acts');
    expect(html).toContain('CCTNS Crime Database Verification');
    expect(html).toContain('International (PSK) vs Domestic (State)');
    expect(html).toContain('PSK Passport PCC Journey');
    expect(html).toContain('Common Mistakes &amp; Validity');
  });
});
