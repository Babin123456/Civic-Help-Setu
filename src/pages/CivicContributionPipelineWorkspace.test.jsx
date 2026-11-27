import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import CivicContributionPipelineWorkspace from './CivicContributionPipelineWorkspace';
import { AuthProvider } from '../context/AuthContext';
import { NetworkProvider } from '../context/NetworkContext';

const memStore = new Map();
globalThis.localStorage = {
  getItem: (k) => (memStore.has(k) ? memStore.get(k) : null),
  setItem: (k, v) => memStore.set(k, String(v)),
  removeItem: (k) => memStore.delete(k),
  clear: () => memStore.clear(),
};

describe('CivicContributionPipelineWorkspace (#1432)', () => {
  beforeEach(() => {
    memStore.clear();
  });

  it('renders proposal form, field-level diff inputs, and empty review queue', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AuthProvider>
          <NetworkProvider>
            <CivicContributionPipelineWorkspace />
          </NetworkProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(html).toContain('Human-Reviewed Civic Data Contribution Pipeline');
    expect(html).toContain('Propose Field-Level Edit');
    expect(html).toContain('No Pending Contribution Proposals');
  });
});

