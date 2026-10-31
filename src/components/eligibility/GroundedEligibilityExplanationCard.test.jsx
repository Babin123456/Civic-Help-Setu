import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import GroundedEligibilityExplanationCard from './GroundedEligibilityExplanationCard';

describe('GroundedEligibilityExplanationCard component', () => {
  const dummyAssessment = {
    status: 'eligible',
    schemeName: 'National Family Benefit Scheme',
    reason: 'Income and BPL family status verified.',
    criteria: [
      { id: 'age', label: 'Primary Breadwinner Age (18-59)', state: 'satisfied', detail: 'Age is 42' },
      { id: 'bpl', label: 'BPL Ration Card Holder', state: 'satisfied', detail: 'Valid BPL card' }
    ]
  };

  it('exports a valid React functional component', () => {
    expect(typeof GroundedEligibilityExplanationCard).toBe('function');
  });

  it('renders null when assessment is missing', () => {
    const html = renderToStaticMarkup(<GroundedEligibilityExplanationCard assessment={null} />);
    expect(html).toBe('');
  });

  it('renders grounded explanation, status badge, and legal verification notice', () => {
    const html = renderToStaticMarkup(<GroundedEligibilityExplanationCard assessment={dummyAssessment} />);

    expect(html).toContain('National Family Benefit Scheme: Grounded Eligibility Analysis');
    expect(html).toContain('Likely Eligible');
    expect(html).toContain('You meet all evaluated requirements');
    expect(html).toContain('Actionable Summary:');
    expect(html).toContain('Official eligibility determinations rest exclusively');
  });
});
