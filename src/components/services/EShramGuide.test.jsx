import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EShramGuide from './EShramGuide';

describe('EShramGuide Component (#527)', () => {
  it('renders scannable e-Shram guide with myth debunking and benefit caveats', () => {
    const html = renderToStaticMarkup(<EShramGuide />);

    expect(html).toContain('e-Shram Registration &amp; UAN Card Guide');
    expect(html).toContain('Dispelling the Myths: e-Shram is NOT an Automatic Cash Transfer Scheme');
    expect(html).toContain('Real Tangible Benefits');
    expect(html).toContain('What e-Shram Does NOT Provide');
  });

  it('renders ministry authority tags and navigation tabs', () => {
    const html = renderToStaticMarkup(<EShramGuide />);

    expect(html).toContain('Ministry of Labour &amp; Employment (MoLE)');
    expect(html).toContain('National Database of Unorganised Workers (NDUW)');
    expect(html).toContain('Eligibility &amp; Exclusions');
    expect(html).toContain('Self vs. CSC Registration');
    expect(html).toContain('Profile Updates &amp; Corrections');
  });
});
