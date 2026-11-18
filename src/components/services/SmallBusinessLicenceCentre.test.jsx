import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SmallBusinessLicenceCentre from './SmallBusinessLicenceCentre';
import {
  _resetInternalStores,
  createEstablishmentProfile,
  submitCorrectionProposal
} from '../../services/smallBusinessLicenceService';

describe('SmallBusinessLicenceCentre Component (#721)', () => {
  beforeEach(() => {
    _resetInternalStores();
  });

  it('renders scannable header, statutory badge, and legal boundary notice', () => {
    const html = renderToStaticMarkup(<SmallBusinessLicenceCentre />);

    expect(html).toContain('Small-Business Licence Renewal &amp; Closure Checklist Centre');
    expect(html).toContain('Statutory Compliance Centre');
    expect(html).toContain('Official Boundary Notice');
    expect(html).toContain('does not constitute formal legal representation');
  });

  it('renders accessible navigation tabs and tab panels with correct ARIA roles', () => {
    const html = renderToStaticMarkup(<SmallBusinessLicenceCentre initialTab="renewal" />);

    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('1. Annual Renewal Checklist');
    expect(html).toContain('2. Amendments (Address / Ownership)');
    expect(html).toContain('3. Temporary Suspension');
    expect(html).toContain('4. Closure &amp; Surrender');
  });

  it('renders dual-track licensing cards in renewal tab with official and editorial separation', () => {
    const html = renderToStaticMarkup(<SmallBusinessLicenceCentre initialTab="renewal" />);

    expect(html).toContain('Municipal General Trade Licence');
    expect(html).toContain('Shops &amp; Commercial Establishments Act Registration');
    expect(html).toContain('Official Statutory Instruction');
    expect(html).toContain('Citizen Advice &amp; Operational Tip');
    expect(html).toContain('MUNICIPAL');
    expect(html).toContain('SECTOR-SPECIFIC');
  });

  it('renders amendment evidence checklist when amendment tab is active', () => {
    const html = renderToStaticMarkup(<SmallBusinessLicenceCentre initialTab="amendment" />);

    expect(html).toContain('Premises Relocation / Address Change');
    expect(html).toContain('Registered Lease Agreement or Ownership Title Deed');
    expect(html).toContain('No-Objection Certificate (NOC) from Property Owner');
    expect(html).toContain('Recent Commercial Electricity / Utility Meter Bill');
    expect(html).toContain('MANDATORY');
  });

  it('renders suspension protocol and voluntary checkpoints when suspension tab is active', () => {
    const html = renderToStaticMarkup(<SmallBusinessLicenceCentre initialTab="suspension" />);

    expect(html).toContain('Temporary Suspension &amp; Voluntary Holding Protocol');
    expect(html).toContain('Written Intimation of Suspension to Municipal Ward Inspector');
    expect(html).toContain('Labour Act Compliance &amp; Wage Settlement Notice');
  });

  it('renders 3-phase closure checklist and surrender acknowledgement retainer in closure tab', () => {
    const html = renderToStaticMarkup(<SmallBusinessLicenceCentre initialTab="closure" />);

    expect(html).toContain('Surrender Acknowledgement Tracking');
    expect(html).toContain('Phase 1: Final Dues &amp; Statutory Liabilities Settlement');
    expect(html).toContain('Phase 2: Formal Licence Surrender &amp; Cancellation Applications');
    expect(html).toContain('Phase 3: Surrender Acknowledgement Tracking &amp; Permanent Archival');
    expect(html).toContain('Municipal Stamped / Digital Surrender Acknowledgement Order');
    expect(html).toContain('GSTR-10 Final Return Filing ARN &amp; Cancellation Order');
  });

  it('renders establishment bar with active establishment profile and branch addition button', () => {
    const html = renderToStaticMarkup(<SmallBusinessLicenceCentre />);

    expect(html).toContain('Active Establishment');
    expect(html).toContain('Add Branch');
    expect(html).toContain('Export (Redacted)');
    expect(html).toContain('Propose Correction');
    expect(html).toContain('Admin Review Queue');
  });

  it('displays explicit unverified warning banner when active establishment has an unlisted jurisdiction', () => {
    const unlistedEst = createEstablishmentProfile({
      establishmentName: 'Remote Tehsil Branch',
      category: 'RETAIL',
      jurisdictionKey: 'UNLISTED_JURISDICTION',
      municipalWard: 'Rural Tehsil Ward'
    });

    const html = renderToStaticMarkup(<SmallBusinessLicenceCentre initialEstablishmentId={unlistedEst.id} />);

    expect(html).toContain('Uncatalogued / Unverified Municipal Jurisdiction');
    expect(html).toContain('have not been verified against a dated municipal gazette');
    expect(html).toContain('Do not rely on assumed deadlines');
  });

  it('renders administrator review queue count when community proposals exist', () => {
    submitCorrectionProposal({
      jurisdictionKey: 'DELHI_MCD',
      officialSourceUrl: 'https://mcdonline.nic.in/gazette-2026',
      notes: 'New trade tariff notified'
    });

    const html = renderToStaticMarkup(<SmallBusinessLicenceCentre />);
    expect(html).toContain('Admin Review Queue (1)');
  });
});
