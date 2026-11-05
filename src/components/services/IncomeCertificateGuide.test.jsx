import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import IncomeCertificateGuide from './IncomeCertificateGuide';

describe('IncomeCertificateGuide Component (#507)', () => {
  it('renders scannable Income Certificate guide and state rules', () => {
    const html = renderToStaticMarkup(<IncomeCertificateGuide />);

    expect(html).toContain('Income Certificate Application &amp; Assessment Guide');
    expect(html).toContain('What an Income Certificate Proves');
    expect(html).toContain('Scholarships &amp; Welfare Caps');
    expect(html).toContain('Assessment Period &amp; Validity');
  });

  it('provides state specific jurisdiction options including Tamil Nadu and Uttar Pradesh', () => {
    const html = renderToStaticMarkup(<IncomeCertificateGuide />);

    expect(html).toContain('Standard State Rules');
    expect(html).toContain('Tamil Nadu (TNeGA e-Sevai)');
    expect(html).toContain('Uttar Pradesh (e-Sathi)');
  });
});
