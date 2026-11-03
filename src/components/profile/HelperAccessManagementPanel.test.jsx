import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import HelperAccessManagementPanel from './HelperAccessManagementPanel';

describe('HelperAccessManagementPanel Component (#477)', () => {
  beforeEach(() => {
    const store = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((k) => store[k] || null),
      setItem: vi.fn((k, v) => {
        store[k] = String(v);
      }),
      removeItem: vi.fn((k) => {
        delete store[k];
      }),
      clear: vi.fn(() => {
        Object.keys(store).forEach((k) => delete store[k]);
      }),
    });
  });

  const mockUser = { id: 'u101', name: 'Alok Nath' };

  it('renders trusted helper panel with consent protections and invite action', () => {
    const html = renderToStaticMarkup(
      <HelperAccessManagementPanel currentUser={mockUser} userApplications={[]} />
    );

    expect(html).toContain('Trusted Helper &amp; Emergency Contact Access');
    expect(html).toContain('Consent Protection:');
    expect(html).toContain('Invite Helper');
    expect(html).toContain('Active Delegations (0)');
  });
});
