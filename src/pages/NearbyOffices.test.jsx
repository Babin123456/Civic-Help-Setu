import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import NearbyOffices from './NearbyOffices';
import { ToastProvider } from '../context/ToastContext';

// Polyfill window.matchMedia & geolocation for test environment
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}
if (!globalThis.window.matchMedia) {
  globalThis.window.matchMedia = () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}
if (!globalThis.navigator.permissions) {
  globalThis.navigator.permissions = {
    query: vi.fn().mockResolvedValue({ state: 'prompt', addEventListener: vi.fn() }),
  };
}

describe('NearbyOffices page integration (#581)', () => {
  it('renders page header, discovery filters, and permission panel with manual options', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/nearby']}>
        <ToastProvider>
          <NearbyOffices />
        </ToastProvider>
      </MemoryRouter>
    );

    expect(html).toContain('Find Nearby Public Offices &amp; Seva Kendras');
    expect(html).toContain('Find offices near you');
    expect(html).toContain('Choose State / District manually');
    expect(html).toContain('Search by locality instead');
    expect(html).toContain('Accessibility Needs Planner');
    expect(html).toContain('Visit Dossier Checklist');
  });

  it('renders structured empty state when search filters return no results', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/nearby?service=xyz-unmatched-service-404']}>
        <ToastProvider>
          <NearbyOffices />
        </ToastProvider>
      </MemoryRouter>
    );

    expect(html).toContain('No Matching Civic Facilitation Centers');
    expect(html).toContain('Reset all filters');
    expect(html).toContain('Active filters narrowing these results');
  });
});
