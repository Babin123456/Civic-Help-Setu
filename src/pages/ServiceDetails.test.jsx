import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ServiceDetails from './ServiceDetails.jsx';
import { MOCK_SERVICES } from '../data/services';
import { LanguageProvider } from '../context/LanguageContext';

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null }), useOptionalAuth: () => null }));
vi.mock('../context/ToastContext', () => ({ useToast: () => ({ toast: { success: vi.fn(), error: vi.fn() } }) }));

const render = (path) =>
  renderToStaticMarkup(
    <LanguageProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/services/:id" element={<ServiceDetails />} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>
  );

describe('ServiceDetails', () => {
  it('renders a published guide, including the actions that open modals', () => {
    const service = MOCK_SERVICES[0];
    const html = render(`/services/${service.id}`);
    expect(html).toContain(service.name);
    expect(html).toContain('Report Access Barrier');
    expect(html).toContain('Print Visit Dossier');
    expect(html).toContain('Make checklist');
    expect(html).toContain('Preparation Plan');
    expect(html).toContain('Simplify this service');
    expect(html).toContain('Trace Data Lineage');
  });

  it('says so when the guide does not exist', () => {
    expect(render('/services/no-such-guide')).toContain('Service not found');
  });

  it('renders the dedicated Aadhaar guide entry card when viewing the aadhaar-card service (#530)', () => {
    const html = render('/services/aadhaar-card');
    expect(html).toContain('Aadhaar Card Enrollment');
    expect(html).toContain('Dedicated Aadhaar Enrolment &amp; Demographic Update Guide');
    expect(html).toContain('Open Interactive Aadhaar Guide');
    expect(html).toContain('/services/aadhaar-guide');
  });

  it('renders the dedicated Property Tax No-Dues guide entry card when viewing the property-tax-no-dues service (#531)', () => {
    const html = render('/services/property-tax-no-dues');
    expect(html).toContain('Property Tax No-Dues Certificate &amp; Payment Receipt Guide');
    expect(html).toContain('Dedicated Property Tax No-Dues Certificate &amp; Payment Receipt Guide');
    expect(html).toContain('Open Interactive Property Tax Guide');
    expect(html).toContain('/services/property-tax-no-dues');
  });

  it('renders the dedicated Small-Business Licence Renewal & Closure Centre entry card (#721)', () => {
    const html = render('/services/business-licence-checklist');
    expect(html).toContain('Small-Business Licence Renewal &amp; Closure Checklist Centre');
    expect(html).toContain('Interactive Small-Business Licence Renewal &amp; Closure Checklist Centre');
    expect(html).toContain('Open Interactive Centre');
    expect(html).toContain('/services/business-licence-checklist');
  });

  it('renders the dedicated Fire NOC guide entry card when viewing the fire-noc service (#719)', () => {
    const html = render('/services/fire-noc');
    expect(html).toContain('Fire Safety Certificate / Fire NOC');
    expect(html).toContain('Dedicated Fire NOC &amp; Fire-Safety Compliance Preparation Guide');
    expect(html).toContain('Open Interactive Fire Guide');
    expect(html).toContain('/services/fire-noc-guide');
  });

  it('renders the dedicated Tree guide entry card when viewing the tree-pruning-permission service (#717)', () => {
    const html = render('/services/tree-pruning-permission');
    expect(html).toContain('Tree-Pruning Permission and Urban Tree Protection');
    expect(html).toContain('Dedicated Tree-Pruning Permission &amp; Urban Tree Protection Guide');
    expect(html).toContain('Open Interactive Tree Guide');
    expect(html).toContain('/services/tree-permission-guide');
  });

  it('renders the dedicated Counter Demand Forecasting workspace entry card (#764)', () => {
    const html = render('/services/counter-demand-forecasting');
    expect(html).toContain('Civic Service Counter Demand &amp; Queue Staffing Forecast');
    expect(html).toContain('Dedicated Counter Demand Forecasting &amp; Queue Staffing Workspace');
    expect(html).toContain('Open Forecasting Workspace');
    expect(html).toContain('/counter-demand');
  });

  it('renders the dedicated Ward Budget Proposal entry card when viewing the ward-budget-proposal service (#765)', () => {
    const html = render('/services/ward-budget-proposal');
    expect(html).toContain('Participatory Ward Budget Proposal &amp; Public Deliberation');
    expect(html).toContain('Open Ward Budget Platform');
    expect(html).toContain('/services/ward-budget-proposal');
    expect(html).toContain('/ward-budget');
  });

  it('renders the dedicated Civic Survey Builder entry card when viewing the civic-survey-builder service (#767)', () => {
    const html = render('/services/civic-survey-builder');
    expect(html).toContain('Civic Survey Builder &amp; Sampling Diagnostics');
    expect(html).toContain('Dedicated Civic Survey Builder &amp; Sampling Diagnostics Hub');
    expect(html).toContain('Launch Survey Workspace');
    expect(html).toContain('/surveys');
  });


  it('renders the dedicated Verifiable Evidence Bundles entry card when viewing verifiable-evidence-bundles (#1160)', () => {
    const html = render('/services/verifiable-evidence-bundles');
    expect(html).toContain('Verifiable Evidence Bundles for Civic Complaints');
    expect(html).toContain('Dedicated Verifiable Evidence Bundles &amp; Cryptographic Ledger Hub');
    expect(html).toContain('Launch Evidence Workspace');

  it('renders the dedicated Public Toilet Directory entry card when viewing the public-toilet-directory service (#758)', () => {
    const html = render('/services/public-toilet-directory');
    expect(html).toContain('Public Toilet Availability, Accessibility &amp; Maintenance Status');
    expect(html).toContain('Dedicated Public Toilet Availability &amp; Maintenance Directory');
    expect(html).toContain('Launch Sanitation Directory');
    expect(html).toContain('/public-toilets');
  });

  it('renders the dedicated Open Contracting Red-Flag Analytics entry card when viewing the open-contracting-red-flags service (#751)', () => {
    const html = render('/services/open-contracting-red-flags');
    expect(html).toContain('Open Contracting Red-Flag Analytics &amp; Audit Workspace');
    expect(html).toContain('Audit public procurement records across tender notice, bid, award, and amendment stages');
    expect(html).toContain('Open Contracting Workspace');
    expect(html).toContain('/open-contracting');
  });

  it('renders the dedicated Ward Issue Heatmap entry card when viewing the ward-issue-heatmap service', () => {
    const html = render('/services/ward-issue-heatmap');
    expect(html).toContain('Anonymized Ward-Level Civic Issue Heatmap &amp; Trend Explorer');
    expect(html).toContain('Open Heatmap &amp; Explorer');
    expect(html).toContain('/ward-issue-heatmap');
    expect(html).toContain('/services/ward-issue-heatmap');
  });

  it('renders the dedicated Transgender Certificate & Welfare Navigator entry card (#1104)', () => {
    const html = render('/services/transgender-certificate-welfare');
    expect(html).toContain('Transgender Identity Certificate &amp; Welfare Navigator');
    expect(html).toContain('Dedicated Transgender Certificate &amp; Welfare Application Navigator');
    expect(html).toContain('Open Interactive Navigator');
    expect(html).toContain('/services/transgender-certificate-welfare');
  });

  it('renders the dedicated provenance and data lineage action link (#777)', () => {
    const service = MOCK_SERVICES[0];
    const html = render(`/services/${service.id}`);
    expect(html).toContain('Trace Data Lineage');
    expect(html).toContain(`/provenance?service=${encodeURIComponent(service.id)}`);
  });

  it('renders the dedicated multi-authority jurisdiction hand-off card (#815)', () => {
    const service = MOCK_SERVICES[0];
    const html = render(`/services/${service.id}`);
    expect(html).toContain('Multi-Authority Jurisdiction Hand-off Map');
    expect(html).toContain(`/services/${service.id}/jurisdiction-map`);
    expect(html).toContain(`/jurisdiction-handoff?service=${service.id}`);

  });
});
