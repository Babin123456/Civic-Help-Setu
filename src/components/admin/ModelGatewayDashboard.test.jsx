import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ModelGatewayDashboard from './ModelGatewayDashboard';
import { setActiveResidencyPolicy } from '../../services/gateway/residencyPolicyEngine';
import { clearGatewayTelemetry } from '../../services/gateway/gatewayTelemetry';
import { circuitBreaker } from '../../services/gateway/circuitBreaker';
import { RESIDENCY_TIER } from '../../services/gateway/gatewayTypes';

describe('ModelGatewayDashboard (#1153)', () => {
  beforeEach(() => {
    setActiveResidencyPolicy(RESIDENCY_TIER.LOCAL_ONLY);
    clearGatewayTelemetry();
    circuitBreaker.reset();
  });

  it('renders heading, residency options, metrics, and circuit breaker panels', () => {
    const html = renderToStaticMarkup(<ModelGatewayDashboard />);

    expect(html).toContain('Civic Model Gateway &amp; Data Residency');
    expect(html).toContain('Global Civic Data Residency Policy');
    expect(html).toContain('Local Only (Default)');
    expect(html).toContain('Sovereign Domestic');
    expect(html).toContain('Cross-Border Scrubbed');
    expect(html).toContain('Provider Circuit Breaker States');
    expect(html).toContain('Total Requests');
    expect(html).toContain('Fallback Rate');
    expect(html).toContain('Recent Gateway Invocations');
  });
});
