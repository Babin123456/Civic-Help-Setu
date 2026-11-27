import { describe, it, expect, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import RedactedSharingRoomWorkspace from './RedactedSharingRoomWorkspace';
import { AuthProvider } from '../context/AuthContext';
import { NetworkProvider } from '../context/NetworkContext';

const memStore = new Map();
globalThis.localStorage = {
  getItem: (k) => (memStore.has(k) ? memStore.get(k) : null),
  setItem: (k, v) => memStore.set(k, String(v)),
  removeItem: (k) => memStore.delete(k),
  clear: () => memStore.clear(),
};

describe('RedactedSharingRoomWorkspace (#1426)', () => {
  beforeEach(() => {
    memStore.clear();
  });

  it('renders sharing room creator, empty state, provenance badges, and noindex notice', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <AuthProvider>
          <NetworkProvider>
            <RedactedSharingRoomWorkspace />
          </NetworkProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(html).toContain('Secure Redacted Document Sharing Room');
    expect(html).toContain('noindex, nofollow');
    expect(html).toContain('New Expiring Share Room');
    expect(html).toContain('No Active Sharing Rooms');
    expect(html).toContain('Official Record');
    expect(html).toContain('Citizen Entered');
    expect(html).toContain('AI Suggestion (Verify)');
  });
});
