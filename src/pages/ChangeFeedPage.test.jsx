import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ChangeFeedPage from './ChangeFeedPage';
import { LanguageProvider } from '../context/LanguageContext';
import { changeFeedService } from '../services/changeFeedService';
import { setCurrentActor } from '../services/accessControl';

const memStore = new Map();
vi.stubGlobal('localStorage', {
  getItem: (k) => (memStore.has(k) ? memStore.get(k) : null),
  setItem: (k, v) => memStore.set(k, String(v)),
  removeItem: (k) => memStore.delete(k),
  clear: () => memStore.clear(),
});

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'admin_test', email: 'officer@gov.in', role: 'admin' },
    isAuthenticated: true,
  }),
}));

vi.mock('../context/NetworkContext', () => ({
  useNetwork: () => ({ isOnline: true, isOffline: false }),
}));

const render = (path = '/change-feed') =>
  renderToStaticMarkup(
    <LanguageProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/change-feed" element={<ChangeFeedPage />} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>
  );

describe('ChangeFeedPage (#762)', () => {
  beforeEach(() => {
    memStore.clear();
    setCurrentActor({ id: 'admin_test', role: 'admin' });
    changeFeedService.resetChangeFeedStorage();
  });

  it('renders standard page header and primary tabs', () => {
    const html = render();
    expect(html).toContain('Civic Service Change Feed');
    expect(html).toContain('Public Change Feed');
    expect(html).toContain('Saved-Items Impact');
    expect(html).toContain('My Subscriptions');
    expect(html).toContain('Editorial Review Desk');
  });

  it('renders search bar and type filters', () => {
    const html = render();
    expect(html).toContain('Search changes by title or service slug');
    expect(html).toContain('All Types');
    expect(html).toContain('All Levels');
    expect(html).toContain('All Jurisdictions');
  });

  it('renders empty state when no changes exist', () => {
    const html = render();
    expect(html).toContain('No Change Events Found');
  });

  it('renders change event card when data is seeded', () => {
    changeFeedService.createChangeEvent({
      serviceId: 'trade-licence',
      changeTitle: 'Revised Fire Safety Clearance Mandate',
      changeType: 'POLICY_CHANGE',
      changeReason: 'regulatory',
      effectiveDate: '2026-12-01',
      officialGazetteCitation: 'Gazette No. 104',
      requiredDocuments: ['Fire Safety NOC'],
    });

    const pending = changeFeedService.listPendingChangeEvents();
    changeFeedService.approveChange(pending.events[0].id, 'admin_test');

    const html = render();
    expect(html).toContain('Revised Fire Safety Clearance Mandate');
    expect(html).toContain('trade-licence');
    expect(html).toContain('Gazette Citation: Gazette No. 104');
    expect(html).toContain('Inspect Version Diff');
  });
});
