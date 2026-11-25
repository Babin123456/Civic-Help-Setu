import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RoutePlanningWorkspace from './RoutePlanningWorkspace.jsx';
import { initializeStorage } from '../services/routePlanning/service.js';

let mockIsOnline = true;
let mockUser = { id: 'usr-1', username: 'SanitationSupervisor', role: 'supervisor' };

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('../context/NetworkContext', () => ({
  useNetwork: () => ({ isOnline: mockIsOnline }),
}));

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

const memStore = new Map();
globalThis.localStorage = {
  getItem: (k) => (memStore.has(k) ? memStore.get(k) : null),
  setItem: (k, v) => memStore.set(k, String(v)),
  removeItem: (k) => memStore.delete(k),
  clear: () => memStore.clear(),
};

const renderComponent = () =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={['/route-planning']}>
      <Routes>
        <Route path="/route-planning" element={<RoutePlanningWorkspace />} />
      </Routes>
    </MemoryRouter>
  );

describe('RoutePlanningWorkspace Page (#755)', () => {
  beforeEach(() => {
    memStore.clear();
    mockIsOnline = true;
    mockUser = { id: 'usr-1', username: 'SanitationSupervisor', role: 'supervisor' };
    initializeStorage(globalThis.localStorage);
  });

  it('renders workspace title, municipal sanitation badge, and role indicator', () => {
    const html = renderComponent();

    expect(html).toContain('AI-Assisted Municipal Waste Collection Route &amp; Segregation Audit Planner');
    expect(html).toContain('Municipal Sanitation v1.3.0');
    expect(html).toContain('Role: supervisor');
  });

  it('renders key performance indicator cards (Active Routes, Pickups, Capacity, Segregation)', () => {
    const html = renderComponent();

    expect(html).toContain('Active Routes');
    expect(html).toContain('Pickups Serviced Today');
    expect(html).toContain('Fleet Capacity Load');
    expect(html).toContain('Segregation Compliance');
  });

  it('renders the 5 primary tabs for end-to-end sanitation management', () => {
    const html = renderComponent();

    expect(html).toContain('Routes &amp; Schedules');
    expect(html).toContain('Vehicle Capacity');
    expect(html).toContain('Segregation Audits');
    expect(html).toContain('AI Recommendations');
    expect(html).toContain('Public Summary View');
  });

  it('renders offline warning banner when network connection drops', () => {
    mockIsOnline = false;
    const html = renderComponent();

    expect(html).toContain('Offline Mode:');
    expect(html).toContain('Working from local cache');
  });

  it('renders seeded municipal collection routes and pickup checkpoints', () => {
    const html = renderComponent();

    expect(html).toContain('Bellandur North Morning Loop');
    expect(html).toContain('Green Glen Layout Gate 1 Community Stand');
    expect(html).toContain('Run AI Optimizer');
  });
});
