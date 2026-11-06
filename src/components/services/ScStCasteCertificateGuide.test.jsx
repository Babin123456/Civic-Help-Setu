import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ScStCasteCertificateGuide from './ScStCasteCertificateGuide';

describe('ScStCasteCertificateGuide Component (#504)', () => {
  it('renders scannable constitutional guide for SC/ST caste certificate', () => {
    const html = renderToStaticMarkup(<ScStCasteCertificateGuide />);

    expect(html).toContain('SC / ST Caste Certificate Application Guide');
    expect(html).toContain('What This Certificate Proves');
    expect(html).toContain('No Creamy Layer Restriction');
    expect(html).toContain('Caste Certificate vs. Caste Validity Certificate');
  });

  it('supports central guidelines and state portals like Maharashtra and Tamil Nadu', () => {
    const html = renderToStaticMarkup(<ScStCasteCertificateGuide />);

    expect(html).toContain('Central Standard Guidelines');
    expect(html).toContain('Maharashtra (Aaple Sarkar)');
    expect(html).toContain('Tamil Nadu (e-Sevai)');
  });
});
