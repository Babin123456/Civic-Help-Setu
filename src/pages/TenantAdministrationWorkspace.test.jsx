/**
 * src/pages/TenantAdministrationWorkspace.test.jsx
 * Component tests for TenantAdministrationWorkspace (#779).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TenantAdministrationWorkspace from './TenantAdministrationWorkspace';
import { LanguageProvider } from '../context/LanguageContext';
import { initializeTenantStorage, STORAGE_KEYS, SEED_MEMBERSHIPS } from '../services/tenantIsolationService';

let mockUser = { id: 'default_admin', email: 'admin@bmc.gov.in', role: 'admin' };

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

vi.mock('../context/NetworkContext', () => ({
  useNetwork: () => ({ isOnline: true }),
}));

const memStore = new Map();
globalThis.localStorage = {
  getItem: (k) => (memStore.has(k) ? memStore.get(k) : null),
  setItem: (k, v) => memStore.set(k, String(v)),
  removeItem: (k) => memStore.delete(k),
  clear: () => memStore.clear(),
};

const renderWorkspace = (path = '/tenants') =>
  renderToStaticMarkup(
    <LanguageProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/tenants" element={<TenantAdministrationWorkspace />} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>
  );

describe('TenantAdministrationWorkspace (#779)', () => {
  beforeEach(() => {
    memStore.clear();
    mockUser = { id: 'default_admin', email: 'admin@bmc.gov.in', role: 'admin' };
    initializeTenantStorage(true);
  });

  it('renders the workspace with title, authority switcher, and metrics', () => {
    const html = renderWorkspace();
    expect(html).toContain('Multi-Authority Administration Workspace');
    expect(html).toContain('Active Sovereign Authority');
    expect(html).toContain('Brihanmumbai Municipal Corporation');
    expect(html).toContain('MH-MC-001');
  });

  it('renders the 7 primary functional tabs for the sovereign authority', () => {
    const html = renderWorkspace();
    expect(html).toContain('Overview');
    expect(html).toContain('Staff &amp; Roles');
    expect(html).toContain('Authority Datasets');
    expect(html).toContain('Public Catalogue');
    expect(html).toContain('Bounded AI Advisor');
    expect(html).toContain('Tamper-Evident Audit');
    expect(html).toContain('Authority Settings');
  });

  it('displays isolation invariants and sovereign metrics on the overview tab', () => {
    const html = renderWorkspace();
    expect(html).toContain('Multi-Authority Isolation Invariants');
    expect(html).toContain('Zero Cross-Tenant Leakage');
    expect(html).toContain('Anti-IDOR Protection');
    expect(html).toContain('Controlled Public Catalogue');
  });

  it('renders an accessible permission-denied state when user has no authority memberships', () => {
    // Set user to an unauthorized citizen
    mockUser = { id: 'random_citizen_999', email: 'unauthorized@example.com', role: 'citizen' };
    // Clear storage and do not grant memberships to random_citizen_999
    initializeTenantStorage(true);

    const html = renderWorkspace();
    expect(html).toContain('Authority Workspace Access Restricted');
    expect(html).toContain('unauthorized@example.com');
    expect(html).toContain('Statutory Tenancy Notice');
    expect(html).toContain('Return to Citizen Home');
  });

  it('renders active jurisdiction role badge and synchronized status indicator', () => {
    const html = renderWorkspace();
    expect(html).toContain('Active Workspace: MH-MC-001');
    expect(html).toContain('Role: TENANT_ADMIN');
    expect(html).toContain('Online (Synchronized)');
    expect(html).toContain('Mumbai Suburban, Maharashtra');
  });
});
