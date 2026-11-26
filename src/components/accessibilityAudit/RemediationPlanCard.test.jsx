import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RemediationPlanCard from './RemediationPlanCard.jsx';

describe('RemediationPlanCard', () => {
  it('renders remediation plan items with priority, target date, and action', () => {
    const plan = [
      {
        id: 'ramp_slope',
        label: 'Ramp Slope Gradient',
        priority: 'CRITICAL',
        critical: true,
        gap: 2,
        unit: 'ratio',
        recommendedAction: 'Re-grade ramp to 1:12',
        targetDate: '2026-12-18',
        responsibleParty: 'PWD Works Division',
        status: 'IDENTIFIED',
      },
    ];

    const html = renderToStaticMarkup(<RemediationPlanCard plan={plan} />);

    expect(html).toContain('Barrier Remediation Action Plan (1 items)');
    expect(html).toContain('CRITICAL');
    expect(html).toContain('Ramp Slope Gradient');
    expect(html).toContain('Gap: 2 ratio');
    expect(html).toContain('Re-grade ramp to 1:12');
  });

  it('renders empty state when no non-compliant barriers exist', () => {
    const html = renderToStaticMarkup(<RemediationPlanCard plan={[]} />);
    expect(html).toContain('Zero non-compliant barriers identified');
  });
});
