/**
 * src/pages/CatalogueVisualQaWorkspace.test.jsx
 * Server-rendered interaction, responsive, state and accessibility tests (#841).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CatalogueVisualQaWorkspace from './CatalogueVisualQaWorkspace.jsx';
import { LanguageProvider } from '../context/LanguageContext';

const mocks = vi.hoisted(() => ({
  auth: {
    loading: false,
    user: { id: 'synthetic-reviewer', role: 'admin', username: 'Synthetic Reviewer' },
    getSessionToken: null,
    isClerkConfigured: false,
  },
  network: { isOnline: true },
}));

const auth = mocks.auth;
const network = mocks.network;

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({
    toast: {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    },
  }),
}));

vi.mock('../context/NetworkContext', () => ({
  useNetwork: () => mocks.network,
}));

const render = (path = '/services/catalogue-visual-qa') =>
  renderToStaticMarkup(
    <LanguageProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/services/catalogue-visual-qa" element={<CatalogueVisualQaWorkspace />} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>
  );

describe('CatalogueVisualQaWorkspace (#841)', () => {
  beforeEach(() => {
    auth.loading = false;
    auth.user = { id: 'synthetic-reviewer', role: 'admin', username: 'Synthetic Reviewer' };
    auth.getSessionToken = null;
    auth.isClerkConfigured = false;
    network.isOnline = true;
  });

  it('renders the reviewer workspace, synthetic boundary and named viewports', () => {
    const html = render();
    expect(html).toContain('Civic service catalogue visual QA');
    expect(html).toContain('Synthetic fixtures only');
    expect(html).toContain('Private review progress, not official status');
    expect(html).toContain('Not an official government application status.');
    expect(html).toContain('Scan controls');
    expect(html).toContain('Responsive card previews');
    expect(html).toContain('Accessible scan results');
    expect(html).toContain('Fixture-text suggestions');
    expect(html).toContain('qa-lane--desktop');
    expect(html).toContain('qa-lane--tablet');
    expect(html).toContain('qa-lane--mobile');
    expect(html).toContain('1024px');
    expect(html).toContain('768px');
    expect(html).toContain('390px');
  });

  it('renders long synthetic content and reproduces overflow warnings at the named mobile viewport', () => {
    const html = render('/services/catalogue-visual-qa?contentLength=long&language=hi&viewport=mobile&pageSize=6');
    expect(html).toContain('नमूना');
    expect(html).toContain('TITLE_OVERFLOW');
    expect(html).toContain('UNBREAKABLE_TOKEN');
    expect(html).toContain('MIXED_SCRIPT_METADATA');
    expect(html).toContain('at Mobile');
    expect(html).not.toContain('qa-lane--desktop');
    expect(html).toContain('Long (stress test)');
  });

  it('renders missing-metadata findings and a text alternative for every finding', () => {
    const html = render('/services/catalogue-visual-qa?pageSize=9');
    expect(html).toContain('MISSING_DEPARTMENT');
    expect(html).toContain('Detected layout findings at');
    expect(html).toContain('Measured:');
    expect(html).toContain('Suggested action:');
    expect(html).toContain('synthetic fixture / viewport rows at page 1');
  });

  it('renders the accessible results table with caption, scopes and a keyboard focus target', () => {
    const html = render();
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Scrollable visual QA results table"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('<caption>');
    expect(html).toContain('scope="col"');
    expect(html).toContain('scope="row"');
    expect(html).toContain('Reviewer action');
    expect(html).toContain('Issue codes');
  });

  it('labels synthetic suggestions and keeps confirm/reject actions explicit', () => {
    const html = render();
    expect(html).toContain('Suggested (not applied)');
    expect(html).toContain('Confirm suggestion');
    expect(html).toContain('Reject suggestion');
    expect(html).toContain('Confirm synthetic fixture text for');
    expect(html).toContain('Confidence');
    expect(html).toContain('docs/TEST_FIXTURES.md');
  });

  it('renders pagination, sources and the official catalogue cross-link', () => {
    const html = render('/services/catalogue-visual-qa?page=2&pageSize=6');
    expect(html).toContain('Page <strong>2</strong> of');
    expect(html).toContain('24 synthetic fixtures');
    expect(html).toContain('Previous');
    expect(html).toContain('Next');
    expect(html).toContain('docs/SERVICE_DATA_CONTRACT.md');
    expect(html).toContain('service-schema-v1');
    expect(html).toContain('Official service catalogue');
    expect(html).toContain('href="/services"');
  });

  it('renders the empty state for a page outside the scan', () => {
    const html = render('/services/catalogue-visual-qa?page=9&pageSize=12');
    expect(html).toContain('No fixtures on this page');
    expect(html).toContain('Return to page 1');
    expect(html).toContain('No fixture / viewport rows on this page.');
  });

  it('renders the permission-denied state without loading catalogue or citizen data', () => {
    auth.user = { id: 'citizen-1', role: 'citizen', username: 'Citizen' };
    const html = render();
    expect(html).toContain('Reviewer permission required');
    expect(html).toContain('does not have the admin permission');
    expect(html).toContain('Go to sign in');
    expect(html).not.toContain('Scan controls');
    expect(html).not.toContain('Responsive card previews');
  });

  it('renders the loading state while reviewer permission is checked', () => {
    auth.loading = true;
    const html = render();
    expect(html).toContain('Preparing the visual QA workspace');
    expect(html).toContain('Checking reviewer permission');
    expect(html).not.toContain('Scan controls');
  });

  it('renders the offline state while keeping the local deterministic scan available', () => {
    network.isOnline = false;
    const html = render();
    expect(html).toContain('Offline: local scan only');
    expect(html).toContain('The deterministic scan still works in this browser.');
    expect(html).toContain('Run local scan');
  });

  it('renders the export and baseline controls without claiming an official status', () => {
    const html = render();
    expect(html).toContain('Export review snapshot');
    expect(html).toContain('Set as screenshot baseline');
    expect(html).toContain('Verify on server');
    expect(html).toContain('Export is a browser download only.');
    expect(html).toContain('excludes reviewer identity');
    expect(html).toContain('Private review progress here never changes an application');
  });

  it('exposes the local-draft consent, retention window and deletion controls', () => {
    const html = render();
    expect(html).toContain('Keep confirmed non-sensitive inputs in this browser for up to 7 days');
    expect(html).toContain('No citizen data');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked=""');
    expect(html).toContain('Delete local draft and decisions');
  });

  it('offers cancel-and-return alongside save-and-return for the resume flow', () => {
    const html = render();
    expect(html).toContain('Save draft &amp; return');
    expect(html).toContain('Cancel &amp; return');
    expect(html).toContain('Confirmed non-sensitive inputs stay in the private local draft');
  });

  it('renders the short content fixture by default and the long content fixture on request', () => {
    const shortHtml = render();
    const longHtml = render('/services/catalogue-visual-qa?contentLength=long');
    expect(shortHtml).toContain('Short (typical)');
    expect(longHtml).toContain('Long (stress test)');
    expect(longHtml.length).toBeGreaterThan(shortHtml.length);
  });
});
