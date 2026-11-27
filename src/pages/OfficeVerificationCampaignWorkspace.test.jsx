import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import OfficeVerificationCampaignWorkspace from './OfficeVerificationCampaignWorkspace';
import { AuthProvider } from '../context/AuthContext';
import { NetworkProvider } from '../context/NetworkContext';

const memStore = new Map();
globalThis.localStorage = {
  getItem: (k) => (memStore.has(k) ? memStore.get(k) : null),
  setItem: (k, v) => memStore.set(k, String(v)),
  removeItem: (k) => memStore.delete(k),
  clear: () => memStore.clear(),
};

describe('OfficeVerificationCampaignWorkspace (#1433)', () => {
  beforeEach(() => {
    memStore.clear();
  });

  it('renders batch assignment form, expiry policy selector, and empty state', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AuthProvider>
          <NetworkProvider>
            <OfficeVerificationCampaignWorkspace />
          </NetworkProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(html).toContain('Civic Office Contact Verification Campaign Manager');
    expect(html).toContain('Assign Verification Batch');
    expect(html).toContain('Expiry Policy');
    expect(html).toContain('No Verification Campaigns Yet');
  });
});
