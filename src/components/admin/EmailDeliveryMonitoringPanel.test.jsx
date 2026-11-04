import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EmailDeliveryMonitoringPanel from './EmailDeliveryMonitoringPanel';

describe('EmailDeliveryMonitoringPanel Component (#462)', () => {
  it('renders monitoring panel with template test dispatch and data minimization assurances', () => {
    const html = renderToStaticMarkup(<EmailDeliveryMonitoringPanel />);

    expect(html).toContain('Transactional Email Delivery &amp; Sandbox Monitor');
    expect(html).toContain('Data Minimization Guardrail:');
    expect(html).toContain('Dispatch Template Test (Sandbox Safe)');
    expect(html).toContain('Application Submission Receipt');
    expect(html).toContain('Test Send');
  });
});
