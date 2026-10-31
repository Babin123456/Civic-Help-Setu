import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ApplicationPreparationPlanModal from './ApplicationPreparationPlanModal';

describe('ApplicationPreparationPlanModal Component (#398)', () => {
  const mockService = {
    id: 'ration-card-scheme',
    title: 'Priority Household Ration Card',
    eligibility: ['Annual family income below ₹1,00,000', 'Resident of state'],
    documents: ['Aadhaar card of all family members', 'Electricity bill or rent agreement'],
    fees: 'Free of Cost',
    process: ['Submit application at local food supply office', 'Verification by food inspector'],
  };

  it('renders grounded preparation plan when open', () => {
    const html = renderToStaticMarkup(
      <ApplicationPreparationPlanModal service={mockService} isOpen={true} onClose={() => {}} />
    );

    expect(html).toContain('Application Preparation Plan');
    expect(html).toContain('Priority Household Ration Card');
    expect(html).toContain('Preparation Progress');
    expect(html).toContain('Grounded Plan Notice:');
    expect(html).toContain('Verify eligibility: Annual family income below ₹1,00,000');
    expect(html).toContain('Gather document: Aadhaar card of all family members');
    expect(html).toContain('Suggested Order');
    expect(html).toContain('Add Personal Task');
  });

  it('renders nothing when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <ApplicationPreparationPlanModal service={mockService} isOpen={false} onClose={() => {}} />
    );
    expect(html).toBe('');
  });
});
