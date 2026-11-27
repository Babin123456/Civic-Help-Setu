import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PatientRightsMatrixCard from './PatientRightsMatrixCard.jsx';

describe('PatientRightsMatrixCard Component (#881)', () => {
  it('renders patient rights charter items with statutory references', () => {
    const html = renderToStaticMarkup(<PatientRightsMatrixCard />);

    expect(html).toContain('Patient Rights Charter &amp; Violations Matrix');
    expect(html).toContain('Right to Emergency Medical Care');
    expect(html).toContain('Absolute Right against Detainment');
    expect(html).toContain('Right to Timely Medical Records');
    expect(html).toContain('Right to Standardized Rate Transparency');
    expect(html).toContain('Right to Source Medicines &amp; Consumables Externally');
  });

  it('triggers onViolationsChange callback with active violations', () => {
    let captured = null;
    renderToStaticMarkup(
      <PatientRightsMatrixCard onViolationsChange={(data) => { captured = data; }} />
    );

    expect(captured).not.toBeNull();
    expect(captured.count).toBeGreaterThanOrEqual(1);
    expect(captured.violations).toBeDefined();
  });
});
