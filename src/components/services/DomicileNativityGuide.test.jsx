import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DomicileNativityGuide from './DomicileNativityGuide';

describe('DomicileNativityGuide Component (#508)', () => {
  it('renders scannable Domicile and Nativity guide and single domicile principle', () => {
    const html = renderToStaticMarkup(<DomicileNativityGuide />);

    expect(html).toContain('Domicile &amp; Nativity Certificate Guide');
    expect(html).toContain('What a Domicile Certificate Does');
    expect(html).toContain('Single Domicile Principle');
    expect(html).toContain('Standard Framework');
  });

  it('provides state specific jurisdiction options including Maharashtra and Tamil Nadu', () => {
    const html = renderToStaticMarkup(<DomicileNativityGuide />);

    expect(html).toContain('Maharashtra (Aaple Sarkar)');
    expect(html).toContain('Tamil Nadu (Nativity)');
  });
});
