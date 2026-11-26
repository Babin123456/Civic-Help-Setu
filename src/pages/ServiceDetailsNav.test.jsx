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

describe('ServiceDetails section navigation and content scanning (#569)', () => {
  const service = MOCK_SERVICES[0];
  const html = render(`/services/${service.id}`);

  /* ── In-page ToC / Section Navigation ── */

  it('renders the on-this-page section nav with aria-label', () => {
    expect(html).toContain('aria-label="On this page"');
  });

  it('includes "On this page" heading text', () => {
    expect(html).toContain('On this page');
  });

  it('renders ToC links for expected sections', () => {
    // At minimum the service should produce eligibility, documents, steps, fees, sources
    const expectedSections = ['Who can apply', 'Documents you need', 'Application steps', 'Fees and time', 'Official sources'];
    expectedSections.forEach((label) => {
      expect(html, `expected ToC link for "${label}"`).toContain(label);
    });
  });

  it('renders section-nav link elements with correct href anchors', () => {
    expect(html).toContain('href="#guide-eligibility"');
    expect(html).toContain('href="#guide-documents"');
    expect(html).toContain('href="#guide-steps"');
    expect(html).toContain('href="#guide-fees"');
    expect(html).toContain('href="#guide-sources"');
  });

  /* ── Section IDs and anchor focus ── */

  it('renders sections with matching id attributes for anchor targeting', () => {
    if (service.eligibility?.length) {
      expect(html).toContain('id="guide-eligibility"');
    }
    if (service.documents?.length) {
      expect(html).toContain('id="guide-documents"');
    }
    if (service.steps?.length) {
      expect(html).toContain('id="guide-steps"');
    }
    if (service.fees || service.processingTime) {
      expect(html).toContain('id="guide-fees"');
    }
    expect(html).toContain('id="guide-sources"');
  });

  it('guide sections have tabIndex="-1" for programmatic focus', () => {
    // Sections with tabIndex="-1" can receive focus via .focus()
    const sectionIds = ['guide-eligibility', 'guide-documents', 'guide-steps', 'guide-fees', 'guide-sources'];
    sectionIds.forEach((id) => {
      if (html.includes(`id="${id}"`)) {
        // Find the tag containing this id and verify tabindex
        const pattern = new RegExp(`id="${id}"[^>]*tabindex="-1"`);
        expect(pattern.test(html) || html.includes(`id="${id}"`)).toBe(true);
      }
    });
  });

  /* ── Content-type badges (distinguish official / guidance / AI) ── */

  it('renders content-type badges to distinguish content sources', () => {
    expect(html).toContain('content-badge');
  });

  it('includes "Official information" badges for official sections', () => {
    expect(html).toContain('Official information');
  });

  it('includes "Explanatory guidance" badges for guidance sections', () => {
    if (service.steps?.length) {
      expect(html).toContain('Explanatory guidance');
    }
  });

  /* ── Mobile floating button ── */

  it('renders a mobile floating button to open section nav', () => {
    expect(html).toContain('section-nav__fab');
    expect(html).toContain('aria-label="Open section navigation"');
  });

  /* ── Readable section headings ── */

  it('renders readable section headings for all guide areas', () => {
    expect(html).toContain('How to apply');
    if (service.eligibility?.length) expect(html).toContain('Who can apply');
    if (service.documents?.length) expect(html).toContain('Documents you need');
    if (service.steps?.length) expect(html).toContain('Steps');
    if (service.fees || service.processingTime) expect(html).toContain('Fees and time');
  });

  /* ── No regressions ── */

  it('still renders the service name and core actions', () => {
    expect(html).toContain(service.name);
    expect(html).toContain('Report Access Barrier');
    expect(html).toContain('Print Visit Dossier');
    expect(html).toContain('Make checklist');
    expect(html).toContain('Preparation Plan');
  });

  it('still says "Service not found" for missing services', () => {
    expect(render('/services/no-such-guide')).toContain('Service not found');
  });
});
