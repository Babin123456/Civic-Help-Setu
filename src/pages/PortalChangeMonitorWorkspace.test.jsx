import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import PortalChangeMonitorWorkspace from './PortalChangeMonitorWorkspace';
import { AuthProvider } from '../context/AuthContext';
import { NetworkProvider } from '../context/NetworkContext';

const memStore = new Map();
globalThis.localStorage = {
  getItem: (k) => (memStore.has(k) ? memStore.get(k) : null),
  setItem: (k, v) => memStore.set(k, String(v)),
  removeItem: (k) => memStore.delete(k),
  clear: () => memStore.clear(),
};

describe('PortalChangeMonitorWorkspace (#1428)', () => {
  beforeEach(() => {
    memStore.clear();
  });

  it('renders monitored official sources, last-checked metadata, and human review queue', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AuthProvider>
          <NetworkProvider>
            <PortalChangeMonitorWorkspace />
          </NetworkProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(html).toContain('Government Portal Change Detection &amp; Broken-Link Monitor');
    expect(html).toContain('Monitored Official Sources');
    expect(html).toContain('Revenue Department, GNCTD');
    expect(html).toContain('Human Review Queue');
  });
});
