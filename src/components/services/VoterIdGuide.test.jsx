import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import VoterIdGuide from './VoterIdGuide';

describe('VoterIdGuide Component (#512)', () => {
  it('renders scannable Voter ID guide and ECI form pathways', () => {
    const html = renderToStaticMarkup(<VoterIdGuide />);

    expect(html).toContain('Voter ID (EPIC) Registration &amp; Correction Guide');
    expect(html).toContain('Election Commission of India (ECI)');
    expect(html).toContain('Form 6: New Voter (18+)');
    expect(html).toContain('4 Annual Qualifying Dates');
    expect(html).toContain('BLO Visit &amp; Roll Inclusion');
  });
});
