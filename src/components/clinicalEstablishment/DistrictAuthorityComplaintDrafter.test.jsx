import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DistrictAuthorityComplaintDrafter from './DistrictAuthorityComplaintDrafter.jsx';

describe('DistrictAuthorityComplaintDrafter Component (#881)', () => {
  it('renders statutory complaint drafter with legal headers and input fields', () => {
    const html = renderToStaticMarkup(
      <DistrictAuthorityComplaintDrafter
        compliance={{ violations: [] }}
        billingAnalysis={{ totalInvoicedInr: 100000, totalStatutoryCeilingInr: 60000, totalOverchargeInr: 40000 }}
      />
    );

    expect(html).toContain('District Registering Authority Statutory Complaint Drafter');
    expect(html).toContain('FORMAL STATUTORY COMPLAINT UNDER SECTION 41 &amp; 42');
    expect(html).toContain('Complainant / Representative Name');
    expect(html).toContain('Clinical Establishment / Hospital Name');
    expect(html).toContain('Download Text Memorandum (.txt)');
    expect(html).toContain('Save Grievance to Vault');
  });
});
