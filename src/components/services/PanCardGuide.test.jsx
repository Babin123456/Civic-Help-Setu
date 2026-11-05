import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PanCardGuide from './PanCardGuide';

describe('PanCardGuide Component (#513)', () => {
  it('renders scannable PAN Card allotment guide and IT department provisions', () => {
    const html = renderToStaticMarkup(<PanCardGuide />);

    expect(html).toContain('PAN Card Allotment &amp; Correction Guide');
    expect(html).toContain('Income Tax Department (Section 139A)');
    expect(html).toContain('What a PAN Card Proves');
    expect(html).toContain('Penalty for Duplicate PAN');
    expect(html).toContain('Instant e-PAN (Free, 10 Mins)');
  });
});
