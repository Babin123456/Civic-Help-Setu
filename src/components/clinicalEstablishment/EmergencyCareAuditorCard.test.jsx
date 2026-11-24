import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import EmergencyCareAuditorCard from './EmergencyCareAuditorCard.jsx';

describe('EmergencyCareAuditorCard Component (#881)', () => {
  it('renders emergency care audit form with statutory provisions', () => {
    const html = renderToStaticMarkup(<EmergencyCareAuditorCard />);

    expect(html).toContain('Emergency Care Non-Refusal &amp; Stabilization Auditor');
    expect(html).toContain('Section 56 of CEA 2010');
    expect(html).toContain('Parmanand Katara');
    expect(html).toContain('Advance Deposit Demanded');
    expect(html).toContain('Hospital refused triage');
  });

  it('invokes onComplianceChange callback with evaluation results', () => {
    let captured = null;
    renderToStaticMarkup(
      <EmergencyCareAuditorCard onComplianceChange={(data) => { captured = data; }} />
    );

    expect(captured).not.toBeNull();
    expect(captured.severityScore).toBeGreaterThanOrEqual(0);
    expect(captured.violations).toBeDefined();
    expect(captured.statutoryStatus).toBeDefined();
  });
});
