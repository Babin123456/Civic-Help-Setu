import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PersonalisedApplicationPlanModal from './PersonalisedApplicationPlanModal';

describe('PersonalisedApplicationPlanModal Component (#476)', () => {
  const mockService = {
    id: 'srv-pension',
    title: 'Disability Support Pension',
    department: 'Department of Empowerment of Persons with Disabilities',
    documents: ['Disability Certificate (40%+)', 'Aadhaar Card'],
    eligibility: ['Permanent benchmark disability', 'Annual income under Rs 2,50,000'],
    fees: 'Free of cost',
    officialUrl: 'https://disabilityaffairs.gov.in',
  };

  it('renders modal with situational inputs, grounded official steps, and print action', () => {
    const html = renderToStaticMarkup(
      <PersonalisedApplicationPlanModal
        isOpen={true}
        onClose={() => {}}
        service={mockService}
      />
    );

    expect(html).toContain('AI Personalised Application Plan');
    expect(html).toContain('Grounded in Official Catalogue Records:');
    expect(html).toContain('Personalise For Your Current Situation:');
    expect(html).toContain('Disability Certificate (40%+)');
    expect(html).toContain('OFFICIAL REQUIREMENT');
    expect(html).toContain('Print Plan');
    expect(html).toContain('Email Plan');
  });

  it('does not render when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <PersonalisedApplicationPlanModal
        isOpen={false}
        onClose={() => {}}
        service={mockService}
      />
    );

    expect(html).toBe('');
  });
});
