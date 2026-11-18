import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DefectiveMeterDiagnosticCard from './DefectiveMeterDiagnosticCard.jsx';

describe('DefectiveMeterDiagnosticCard Component (#891)', () => {
  it('renders defective meter diagnostic form and billing adjustment calculation', () => {
    const html = renderToStaticMarkup(<DefectiveMeterDiagnosticCard />);

    expect(html).toContain('Fast / Defective Meter Diagnostic &amp; Billing Adjustment Engine');
    expect(html).toContain('Historical 6-Month Monthly Average (kWh Units)');
    expect(html).toContain('Disputed Billing Cycle Units (kWh)');
    expect(html).toContain('Consumption Anomaly Ratio');
    expect(html).toContain('Estimated Billing Refund');
  });

  it('triggers onMeterAuditChange callback with diagnostic results', () => {
    let captured = null;
    renderToStaticMarkup(
      <DefectiveMeterDiagnosticCard onMeterAuditChange={(data) => { captured = data; }} />
    );

    expect(captured).not.toBeNull();
    expect(captured.unitSpikeRatio).toBeGreaterThan(0);
    expect(captured.estimatedRefundInr).toBeGreaterThan(0);
  });
});
