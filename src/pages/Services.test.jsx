import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Services from './Services';
import { LanguageProvider } from '../context/LanguageContext';
import { ThemeProvider } from '../context/ThemeContext';

// Polyfill localStorage for node SSR test
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
}

// Mock child modals and heavy components to test Services page header and layout
vi.mock('../components/services/RtiBuilderModal', () => ({
  default: () => null,
}));
vi.mock('../components/grievance/GrievanceClassificationRouterModal', () => ({
  default: () => null,
}));
vi.mock('../components/services/ServiceComparisonModal', () => ({
  default: () => null,
}));
vi.mock('../components/services/ComparisonFloatingTray', () => ({
  default: () => null,
}));

describe('Services page header and layout (#566)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithProviders = (initialEntry = '/services') => {
    return renderToStaticMarkup(
      <MemoryRouter initialEntries={[initialEntry]}>
        <ThemeProvider>
          <LanguageProvider>
            <Services />
          </LanguageProvider>
        </ThemeProvider>
      </MemoryRouter>
    );
  };

  it('renders directory heading, badge, and utility action buttons', () => {
    const html = renderWithProviders('/services');

    expect(html).toContain('Verified Citizen Portals &amp; Guides');
    expect(html).toContain('Public Services Directory');
    expect(html).toContain('Citizen RTI Request Builder (Section 6(1))');
    expect(html).toContain('Civic Grievance &amp; Department Router');
    expect(html).toContain('Filter services by category');
  });

  it('renders category pill options including All and active state', () => {
    const html = renderWithProviders('/services?cat=Identity');

    expect(html).toContain('All');
    expect(html).toContain('aria-pressed="true"');
  });
});
