import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ModelGatewayBadge from './ModelGatewayBadge';
import { RESIDENCY_TIER, ADAPTER_TYPE } from '../../services/gateway/gatewayTypes';

describe('ModelGatewayBadge (#1153)', () => {
  it('returns null when meta is null or undefined', () => {
    expect(renderToStaticMarkup(<ModelGatewayBadge meta={null} />)).toBe('');
    expect(renderToStaticMarkup(<ModelGatewayBadge meta={undefined} />)).toBe('');
  });

  it('renders local in-browser badge with zero data egress notice', () => {
    const meta = {
      residencyTier: RESIDENCY_TIER.LOCAL_ONLY,
      adapterType: ADAPTER_TYPE.LOCAL_BROWSER,
      modelName: 'Local Catalog Engine',
      latencyMs: 45,
      fallbackTriggered: false,
    };

    const html = renderToStaticMarkup(<ModelGatewayBadge meta={meta} />);
    expect(html).toContain('Local In-Browser (Zero Data Egress)');
    expect(html).toContain('45ms');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Model Gateway Residency: Local In-Browser (Zero Data Egress)"');
  });

  it('renders sovereign domestic region badge', () => {
    const meta = {
      residencyTier: RESIDENCY_TIER.SOVEREIGN_DOMESTIC,
      adapterType: ADAPTER_TYPE.SOVEREIGN_CLOUD,
      modelName: 'Sovereign National Engine',
      latencyMs: 280,
      fallbackTriggered: false,
    };

    const html = renderToStaticMarkup(<ModelGatewayBadge meta={meta} />);
    expect(html).toContain('Sovereign Domestic Region (India Cloud)');
    expect(html).toContain('280ms');
  });

  it('renders deterministic fallback badge when fallback occurred', () => {
    const meta = {
      residencyTier: RESIDENCY_TIER.LOCAL_ONLY,
      adapterType: ADAPTER_TYPE.DETERMINISTIC_FALLBACK,
      modelName: 'Deterministic Catalog & Office Fallback',
      latencyMs: 35,
      fallbackTriggered: true,
      fallbackReason: 'TIMEOUT_EXCEEDED: Provider timed out',
    };

    const html = renderToStaticMarkup(<ModelGatewayBadge meta={meta} />);
    expect(html).toContain('Deterministic Fallback Active');
  });
});
