import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SeniorCitizenTribunalWorkspace from './SeniorCitizenTribunalWorkspace.jsx';

describe('SeniorCitizenTribunalWorkspace page (#858)', () => {
  it('exports a valid React functional component', () => {
    expect(typeof SeniorCitizenTribunalWorkspace).toBe('function');
  });

  it('renders page header, Central Act 56 of 2007 statutory badge, and tab navigation', () => {
    const html = renderToStaticMarkup(<SeniorCitizenTribunalWorkspace />);

    expect(html).toContain('Senior Citizen Maintenance &amp; Property Protection Tribunal Workspace');
    expect(html).toContain('Central Act 56 of 2007');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('Petition Drafter');
    expect(html).toContain('Maintenance Calculator');
    expect(html).toContain('Section 23 Property Revocation');
    expect(html).toContain('90-Day SLA &amp; Escalations');
    expect(html).toContain('Evidence Checklist');
    expect(html).toContain('Saved Petitions');
  });

  it('renders default Petition Drafter view with form controls and statutory relief selector', () => {
    const html = renderToStaticMarkup(<SeniorCitizenTribunalWorkspace />);

    expect(html).toContain('SDM Maintenance Tribunal Petition Drafter');
    expect(html).toContain('Select Statutory Relief Type:');
    expect(html).toContain('FORM-A');
    expect(html).toContain('FORM-B');
    expect(html).toContain('Petitioner (Parent) Details');
    expect(html).toContain('Generate Formal Statutory SDM Petition');
  });
});
