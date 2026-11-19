import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PrintableAccessibilityReportModal from './PrintableAccessibilityReportModal.jsx';

describe('PrintableAccessibilityReportModal', () => {
  it('renders report modal with facility details and disclaimer when open', () => {
    const auditRecord = {
      facilityName: 'Community Health Centre',
      district: 'Bhopal',
      createdAt: '2026-11-18T10:00:00Z',
    };

    const evaluated = {
      score: 75,
      compliantCount: 3,
      nonCompliantCount: 1,
      items: [],
      criticalHazards: [],
    };

    const html = renderToStaticMarkup(
      <PrintableAccessibilityReportModal
        isOpen={true}
        auditRecord={auditRecord}
        evaluatedAudit={evaluated}
        remediationPlan={[]}
      />
    );

    expect(html).toContain('Printable Accessibility Audit &amp; Remediation Report');
    expect(html).toContain('Facility Accessibility Audit: Community Health Centre');
    expect(html).toContain('Statutory Caveat');
    expect(html).toContain('Preliminary Screening Notice');
  });

  it('renders null when not open', () => {
    const html = renderToStaticMarkup(
      <PrintableAccessibilityReportModal isOpen={false} />
    );
    expect(html).toBe('');
  });
});
