import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import BocwWelfareGuide from './BocwWelfareGuide';

describe('BocwWelfareGuide Component (#528)', () => {
  it('renders scannable BOCW Welfare Guide with statutory mandate and 90-day condition', () => {
    const html = renderToStaticMarkup(<BocwWelfareGuide />);

    expect(html).toContain('BOCW Labour Welfare Registration Card Guide');
    expect(html).toContain('Statutory Welfare Under BOCW Act, 1996');
    expect(html).toContain('Tangible Financial Assistance');
    expect(html).toContain('What a BOCW Welfare Card Establishes vs. Does Not Establish');
  });

  it('renders board authority tags and navigation tabs', () => {
    const html = renderToStaticMarkup(<BocwWelfareGuide />);

    expect(html).toContain('BOCW Act, 1996 &amp; Welfare Cess Act');
    expect(html).toContain('State Labour Welfare Board');
    expect(html).toContain('90-Day Condition &amp; Occupations');
    expect(html).toContain('State Welfare Boards &amp; Benefits');
    expect(html).toContain('BOCW Card vs. e-Shram Card');
  });
});
