import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import WelfareEligibilityMatrixTable from './WelfareEligibilityMatrixTable';

describe('WelfareEligibilityMatrixTable', () => {
  it('renders quick parameter sliders and scheme rows', () => {
    const html = renderToStaticMarkup(<WelfareEligibilityMatrixTable />);
    expect(html).toContain('Quick Welfare Eligibility Matrix');
    expect(html).toContain('Applicant Age');
    expect(html).toContain('Annual Family Income');
    expect(html).toContain('Occupation');
    expect(html).toContain('Ayushman Bharat (PM-JAY)');
    expect(html).toContain('PM-Kisan Samman Nidhi');
    expect(html).toContain('PM Awas Yojana (PMAY - Housing)');
    expect(html).toContain('National Old Age Pension Scheme (IGNOAPS)');
    expect(html).toContain('Sukanya Samriddhi Yojana (SSY)');
  });

  it('contains search filter input for schemes', () => {
    const html = renderToStaticMarkup(<WelfareEligibilityMatrixTable />);
    expect(html).toContain('Filter schemes by name or category');
  });
});
