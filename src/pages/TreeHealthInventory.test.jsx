import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import TreeHealthInventory from './TreeHealthInventory';
import { setCurrentActor } from '../services/accessControl';
import { ensureTreeInventoryData } from '../services/treeInventoryMigrations';

const mockAuthState = { user: null };
const mockNetworkState = { isOnline: true };

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('../context/NetworkContext', () => ({
  useNetwork: () => mockNetworkState,
}));

const createMemoryStorage = () => {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
};

const arborist = {
  id: 'staff_arborist',
  username: 'arborist user',
  fullName: 'Arborist User',
  role: 'admin',
  raw: { publicMetadata: { treeRole: 'arborist', jurisdictionId: 'blr' } },
};

describe('TreeHealthInventory page — public projection and role-aware navigation (#749)', () => {
  let storage;

  beforeEach(() => {
    storage = createMemoryStorage();
    ensureTreeInventoryData({ storage, nowMs: Date.parse('2026-11-15T08:00:00.000Z') });
    vi.stubGlobal('localStorage', storage);
    mockAuthState.user = null;
    mockNetworkState.isOnline = true;
    setCurrentActor(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setCurrentActor(null);
  });

  const renderPage = () =>
    renderToStaticMarkup(
      <MemoryRouter>
        <TreeHealthInventory />
      </MemoryRouter>
    );

  it('renders the approved public register and a list/table alternative to the map', () => {
    const html = renderPage();

    expect(html).toContain('Tree Health Inventory &amp; Preventive Maintenance Planner');
    expect(html).toContain('Approved public tree register');
    expect(html).toContain('8 public trees in this view');
    expect(html).toContain('BLR-TREE-0001');
    expect(html).toContain('DEL-TREE-0001');
    expect(html).toContain('Ward 14 - Indiranagar East');
    expect(html).toContain('geo_12.97_77.64');
    expect(html).toContain('Public tree register — text alternative');
    expect(html).toContain('List and table view');
    expect(html).toContain('Ward map and text table');
    expect(html).toContain('Public fields only');
  });

  it('never publishes private notes, precise coordinates or internal record identifiers', () => {
    const html = renderPage();

    expect(html).toContain('Precise coordinates and staff notes are not returned.');
    expect(html).not.toContain('Minor deadwood over the bus bay');
    expect(html).not.toContain('12.971612');
    expect(html).not.toContain('77.641234');
    expect(html).not.toContain('tree_demo_001');
    expect(html).not.toContain('reporterKey');
  });

  it('hides the staff workspace from anonymous and citizen visitors', () => {
    expect(renderPage()).not.toContain('Staff workspace');

    mockAuthState.user = { id: 'citizen_1', username: 'Resident', role: 'citizen' };
    setCurrentActor(mockAuthState.user);
    expect(renderPage()).not.toContain('Staff workspace');
  });

  it('shows the staff workspace to a scoped municipal arborist and narrows the public register to their jurisdiction', () => {
    mockAuthState.user = arborist;
    setCurrentActor(arborist);

    const html = renderPage();
    expect(html).toContain('Staff workspace');
    expect(html).toContain('6 public trees in this view');
    expect(html).not.toContain('DEL-TREE-0001');
  });

  it('shows the offline notice when the browser is offline', () => {
    mockNetworkState.isOnline = false;

    const html = renderPage();
    expect(html).toContain('Offline mode.');
    expect(html).toContain('browse the last saved register');
  });
});
