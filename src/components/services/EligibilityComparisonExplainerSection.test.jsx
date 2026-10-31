import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EligibilityComparisonExplainerSection from './EligibilityComparisonExplainerSection';

describe('EligibilityComparisonExplainerSection Component (#401)', () => {
  const serviceA = {
    id: 's1',
    title: 'Senior Citizen Pension',
    department: 'Social Welfare',
    eligibility: ['Age must be 60 years or above', 'Resident of Karnataka'],
  };

  const serviceB = {
    id: 's2',
    title: 'Disability Pension',
    department: 'Empowerment Dept',
    eligibility: ['Person with 40% disability', 'Resident of Karnataka'],
  };

  it('renders comparative eligibility table with shared and differing badges', () => {
    const html = renderToStaticMarkup(
      <EligibilityComparisonExplainerSection comparedServices={[serviceA, serviceB]} />
    );

    expect(html).toContain('Eligibility Criteria Comparison Explainer');
    expect(html).toContain('Shared Conditions');
    expect(html).toContain('Shared Condition');
    expect(html).toContain('Resident of Karnataka');
    expect(html).toContain('Age must be 60 years or above');
    expect(html).toContain('Not stated in catalogue');
    expect(html).toContain('Grounding Disclosure:');
    expect(html).toContain('does NOT mean you are ineligible');
  });

  it('returns null when fewer than 2 services are compared', () => {
    const html = renderToStaticMarkup(
      <EligibilityComparisonExplainerSection comparedServices={[serviceA]} />
    );
    expect(html).toBe('');
  });
});
