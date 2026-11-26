import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RteAdmissionWorkspace from './RteAdmissionWorkspace.jsx';

describe('RteAdmissionWorkspace Page (#889)', () => {
  it('renders workspace with header, legal citation, and navigation tabs', () => {
    const html = renderToStaticMarkup(<RteAdmissionWorkspace />);

    expect(html).toContain('Right to Education (RTE) Section 12(1)(c) Quota &amp; Child Rights Workspace');
    expect(html).toContain('Society for Unaided Private Schools of Rajasthan v. Union of India');
    expect(html).toContain('EWS/DG Quota Eligibility');
    expect(html).toContain('Screening &amp; Capitation Audit');
    expect(html).toContain('Free Entitlements Reconciler');
    expect(html).toContain('Section 32 Petition Drafter');
    expect(html).toContain('Confidential Vault');
  });
});
