import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import Services from './Services';
import * as serviceCatalog from '../services/serviceCatalog';
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

  describe('Directory empty states (#567)', () => {
    it('renders search empty state with Clear search action when search has no matches', () => {
      const html = renderWithProviders('/services?q=zzzznomatchquery999');

      expect(html).toContain('No Search Results Found');
      expect(html).toContain('zzzznomatchquery999');
      expect(html).toContain('Clear search');
      expect(html).not.toContain('<span>Reset all filters</span>');
      expect(html).not.toContain('<span>Reset filters</span>');
    });

    it('renders filter empty state with Reset filters action when filter combinations yield no matches', () => {
      const html = renderWithProviders('/services?mode=Offline&speed=Urgent&diff=Hard&cat=Housing');

      expect(html).toContain('No Services Match Selected Filters');
      expect(html).toContain('Reset filters');
      expect(html).not.toContain('Clear search');
    });

    it('renders combined empty state with Clear search and Reset all filters when both are active', () => {
      const html = renderWithProviders('/services?cat=Identity&q=unrelatedterm999');

      expect(html).toContain('No Matching Services Found');
      expect(html).toContain('unrelatedterm999');
      expect(html).toContain('Clear search');
      expect(html).toContain('Reset all filters');
    });

    it('renders empty catalogue state without misleading reset button when catalogue has no services', () => {
      const spy = vi.spyOn(serviceCatalog, 'getAllServices').mockReturnValue([]);
      const html = renderWithProviders('/services');

      expect(html).toContain('No Civic Services Available');
      expect(html).not.toContain('<span>Reset filters</span>');
      expect(html).not.toContain('<span>Reset all filters</span>');
      expect(html).not.toContain('Clear search');
      spy.mockRestore();
    });
  });
});
