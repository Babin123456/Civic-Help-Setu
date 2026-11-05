import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RationCardGuide from './RationCardGuide';

describe('RationCardGuide Component (#511)', () => {
  it('renders scannable Ration Card guide and NFSA provisions', () => {
    const html = renderToStaticMarkup(<RationCardGuide />);

    expect(html).toContain('Ration Card Issuance &amp; Member Services Guide');
    expect(html).toContain('National Food Security Act, 2013');
    expect(html).toContain('What a Ration Card Proves');
    expect(html).toContain('Legal Caveat: Not Proof of Citizenship');
    expect(html).toContain('New Household Card');
  });

  it('provides state specific options including Tamil Nadu and Uttar Pradesh', () => {
    const html = renderToStaticMarkup(<RationCardGuide />);

    expect(html).toContain('All-India (NFSA Standard)');
    expect(html).toContain('Tamil Nadu (TNPDS)');
    expect(html).toContain('Uttar Pradesh (FCS UP)');
  });
});
