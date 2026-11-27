import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import DuplicateCaseDetectorWorkspace from './DuplicateCaseDetectorWorkspace';
import { AuthProvider } from '../context/AuthContext';
import { NetworkProvider } from '../context/NetworkContext';

const memStore = new Map();
globalThis.localStorage = {
  getItem: (k) => (memStore.has(k) ? memStore.get(k) : null),
  setItem: (k, v) => memStore.set(k, String(v)),
  removeItem: (k) => memStore.delete(k),
  clear: () => memStore.clear(),
};

describe('DuplicateCaseDetectorWorkspace (#1427)', () => {
  beforeEach(() => {
    memStore.clear();
  });

  it('renders candidate case parameters, synthetic eval metrics, and confidence reasons', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AuthProvider>
          <NetworkProvider>
            <DuplicateCaseDetectorWorkspace />
          </NetworkProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(html).toContain('Civic Application Duplicate &amp; Related-Case Detector');
    expect(html).toContain('Separate Case IDs Preserved');
    expect(html).toContain('Confidence Reasons:');
    expect(html).toContain('Confirm Duplicate (Keep Separate IDs)');
  });
});
