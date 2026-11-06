import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LandMutationGuide from './LandMutationGuide';

describe('LandMutationGuide Component (#521)', () => {
  it('renders scannable Land Mutation guide with key judicial principles', () => {
    const html = renderToStaticMarkup(<LandMutationGuide />);

    expect(html).toContain('Land Mutation (Dakhil Kharij / Ferfar) Guide');
    expect(html).toContain('Fundamental Legal Principle: Mutation is NOT Conclusive Proof of Title');
    expect(html).toContain('Why Mutation is Crucial for Buyers');
    expect(html).toContain('What Mutation Establishes vs. Does Not Establish');
  });

  it('renders navigation tabs and statutory revenue tags', () => {
    const html = renderToStaticMarkup(<LandMutationGuide />);

    expect(html).toContain('DILRMP &amp; State Revenue Codes');
    expect(html).toContain('Fiscal Land Assessment Entry');
    expect(html).toContain('Sale vs. Inheritance Routes');
    expect(html).toContain('Notice &amp; Objection Stages');
    expect(html).toContain('State Portals &amp; Revenue Offices');
  });
});
