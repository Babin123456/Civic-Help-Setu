import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LearnerLicenceGuide from './LearnerLicenceGuide';

describe('LearnerLicenceGuide Component (#515)', () => {
  it('renders scannable Learner Licence guide and Sarathi portal provisions', () => {
    const html = renderToStaticMarkup(<LearnerLicenceGuide />);

    expect(html).toContain('Learner’s Licence (LL) Application &amp; Validity Guide');
    expect(html).toContain('Motor Vehicles Act, 1988 (Section 8)');
    expect(html).toContain('Sarathi Parivahan');
    expect(html).toContain('Accompanied Driver Rule');
    expect(html).toContain('Red &#x27;L&#x27; Plate Rule');
  });
});
