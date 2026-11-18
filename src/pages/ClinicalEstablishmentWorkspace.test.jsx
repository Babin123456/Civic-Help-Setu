import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ClinicalEstablishmentWorkspace from './ClinicalEstablishmentWorkspace.jsx';

describe('ClinicalEstablishmentWorkspace Page (#881)', () => {
  it('renders workspace with tabs and statutory mandate disclaimer', () => {
    const html = renderToStaticMarkup(<ClinicalEstablishmentWorkspace />);

    expect(html).toContain('Clinical Establishment Emergency Care &amp; Patient Rights Workspace');
    expect(html).toContain('Section 56 CEA 2010');
    expect(html).toContain('Pt. Parmanand Katara');
    expect(html).toContain('Emergency Care Auditor (Sec 56)');
    expect(html).toContain('Rate Overbilling Analyzer (Sec 12)');
    expect(html).toContain('Patient Rights Charter Matrix');
    expect(html).toContain('Statutory Drafter (DM / CMO)');
    expect(html).toContain('Vault &amp; Digital Seals');
  });
});
