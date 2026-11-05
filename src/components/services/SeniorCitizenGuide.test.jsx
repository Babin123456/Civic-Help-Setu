import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SeniorCitizenGuide from './SeniorCitizenGuide';

describe('SeniorCitizenGuide Component (#510)', () => {
  it('renders scannable Senior Citizen guide and state welfare provisions', () => {
    const html = renderToStaticMarkup(<SeniorCitizenGuide />);

    expect(html).toContain('Senior Citizen Certificate &amp; ID Card Guide');
    expect(html).toContain('Maintenance &amp; Welfare of Senior Citizens Act');
    expect(html).toContain('Purpose of the Card / Certificate');
    expect(html).toContain('Not a Uniform National Card');
    expect(html).toContain('Standard Central Framework');
  });

  it('provides state specific options including Delhi and Maharashtra', () => {
    const html = renderToStaticMarkup(<SeniorCitizenGuide />);

    expect(html).toContain('Delhi (e-District SDM)');
    expect(html).toContain('Maharashtra (Aaple Sarkar)');
  });
});
