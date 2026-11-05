import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import MarriageCertificateGuide from './MarriageCertificateGuide';

describe('MarriageCertificateGuide Component (#503)', () => {
  it('renders scannable marriage registration cards and statutory routes', () => {
    const html = renderToStaticMarkup(<MarriageCertificateGuide />);

    expect(html).toContain('Marriage Registration Certificate Guide');
    expect(html).toContain('Special Marriage Act');
    expect(html).toContain('Religious Personal Law');
    expect(html).toContain('Solemnisation vs. Registration');
    expect(html).toContain('Witness Obligations');
  });

  it('contains state options including Tamil Nadu and Delhi e-District', () => {
    const html = renderToStaticMarkup(<MarriageCertificateGuide />);

    expect(html).toContain('All-India Standard');
    expect(html).toContain('Tamil Nadu (TNREGINET)');
    expect(html).toContain('Delhi (e-District SDM)');
  });
});
