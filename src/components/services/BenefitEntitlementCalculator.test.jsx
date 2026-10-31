import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import BenefitEntitlementCalculator from './BenefitEntitlementCalculator';

describe('BenefitEntitlementCalculator Component', () => {
  const renderComponent = (props) =>
    renderToStaticMarkup(
      <MemoryRouter>
        <BenefitEntitlementCalculator {...props} />
      </MemoryRouter>
    );

  it('renders nothing for services without statutory welfare subsidies', () => {
    const html = renderComponent({ serviceId: 'driving-license', serviceName: 'Driving License' });
    expect(html).toBe('');
  });

  it('renders full entitlement details for PM-KISAN Samman Nidhi', () => {
    const html = renderComponent({ serviceId: 'pm-kisan', serviceName: 'PM-KISAN Samman Nidhi' });

    expect(html).toContain('Statutory Welfare &amp; Subsidy Benefit');
    expect(html).toContain('PM-KISAN Samman Nidhi');
    expect(html).toContain('6,000');
    expect(html).toContain('Disbursement Schedule');
    expect(html).toContain('Quarterly');
    expect(html).toContain('Period 1');
  });

  it('renders in-kind nutritional subsidy details for NFSA ration card', () => {
    const html = renderComponent({ serviceId: 'ration-card', serviceName: 'Ration Card' });

    expect(html).toContain('National Food Security Act');
    expect(html).toContain('14,400');
    expect(html).toContain('Monthly Quota');
  });

  it('contains accessible landmark region and controls', () => {
    const html = renderComponent({ serviceId: 'pm-kisan', serviceName: 'PM-KISAN' });

    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Welfare Benefit &amp; Financial Assistance Estimator for PM-KISAN"');
    expect(html).toContain('id="benefit-income-select"');
    expect(html).toContain('id="benefit-occupation-select"');
  });
});
