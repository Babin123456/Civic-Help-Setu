import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import PublicProjectsWorkspace from './PublicProjectsWorkspace';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { NetworkProvider } from '../context/NetworkContext';
import { ensurePublicProjectsSeedData } from '../services/publicProjectService';

const createMemoryStorage = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
};

describe('PublicProjectsWorkspace UI (#752)', () => {
  let storage;

  beforeEach(() => {
    storage = createMemoryStorage();
    ensurePublicProjectsSeedData(storage);
    vi.stubGlobal('localStorage', storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const renderComponent = () => {
    return renderToString(
      <AuthProvider>
        <ToastProvider>
          <NetworkProvider>
            <PublicProjectsWorkspace />
          </NetworkProvider>
        </ToastProvider>
      </AuthProvider>
    );
  };

  it('renders standard page header and subtitle', () => {
    const html = renderComponent();
    expect(html).toContain('Geospatial Public Project Verification &amp; Evidence Timeline');
    expect(html).toContain('Civic Infrastructure Transparency');
    expect(html).toContain('Map-linked register of municipal roads, drains, schools');
  });

  it('renders summary metric cards (Total Projects, Active Construction, Completed, Outlay)', () => {
    const html = renderComponent();
    expect(html).toContain('Total Projects');
    expect(html).toContain('Active Construction');
    expect(html).toContain('Verified Completed');
    expect(html).toContain('Sanctioned Outlay');
  });

  it('renders filter bar with search input, category dropdown, status dropdown, and view toggles', () => {
    const html = renderComponent();
    expect(html).toContain('Search projects by corridor, ward, or title...');
    expect(html).toContain('All Categories');
    expect(html).toContain('Corridors &amp; Road Infrastructure');
    expect(html).toContain('Stormwater Drains &amp; Culverts');
    expect(html).toContain('Map View');
    expect(html).toContain('Accessible Table');
  });

  it('renders geospatial map viewer with initial active corridors and status legend', () => {
    const html = renderComponent();
    expect(html).toContain('Geospatial Infrastructure Map');
    expect(html).toContain('Active Corridors');
    expect(html).toContain('PLANNED');
    expect(html).toContain('ACTIVE');
    expect(html).toContain('COMPLETED');
  });

  it('renders milestone evidence timeline for the default selected project', () => {
    const html = renderComponent();
    expect(html).toContain('Milestone Execution &amp; Verifiable Evidence Timeline');
    expect(html).toContain('Hebbal to Bellary Road Underpass Corridor Paving');
    expect(html).toContain('Topographic Survey &amp; Sub-Grade Earthwork Excavation');
    expect(html).toContain('Granular Sub-Base (GSB) &amp; Wet Mix Macadam (WMM)');
    expect(html).toContain('Statutory Verification Criteria');
  });

  it('displays cryptographic evidence hashes and privacy redaction badges', () => {
    const html = renderComponent();
    expect(html).toContain('Submitted Evidence Assets');
    expect(html).toContain('Redacted');
    expect(html).toContain('Hash:');
  });

  it('auto-seeds and renders projects when storage starts completely empty or uninitialized', () => {
    vi.stubGlobal('localStorage', createMemoryStorage());
    const html = renderComponent();
    expect(html).toContain('Total Projects');
    expect(html).toContain('>4<');
    expect(html).toContain('Hebbal to Bellary Road Underpass Corridor Paving');
  });
});
