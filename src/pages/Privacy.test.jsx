import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({
    toast: { success: vi.fn(), error: vi.fn() },
  }),
}));

vi.mock('../context/ConfirmationDialogContext', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('../services/privacyConsentService.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    CONSENT_CATEGORIES: {
      NECESSARY: { id: 'nec', title: 'Strictly Necessary' },
      ANALYTICS: { id: 'ana', title: 'Local Analytics' },
    },
    getConsentPreferences: () => ({ nec: true, ana: false }),
    exportUserData: () => ({ version: 1, exportedAt: '2026-11-07' }),
    getPrivacyAuditLogs: () => [{ id: '1', action: 'INIT' }],
  };
});

import Privacy from './Privacy';

describe('Privacy Page Navigation & Readability (#589)', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <Privacy />
    </MemoryRouter>
  );

  it('renders table of contents navigation sidebar', () => {
    expect(html).toContain('Policy Navigation');
    expect(html).toContain('1. Principles of Data Minimization');
    expect(html).toContain('2. Enforceable Consent Architecture');
    expect(html).toContain('3. Data Portability &amp; Complete Erasure');
    expect(html).toContain('4. Statutory DPDP Act 2023 Compliance');
    expect(html).toContain('5. Transparency &amp; Client Audit Trail');
  });

  it('contains statutory compliance sections and enforceable settings panel', () => {
    expect(html).toContain('DPDP Act 2023 • Citizen-First Privacy');
    expect(html).toContain('Your Enforced Privacy Settings');
    expect(html).toContain('Export My Data (JSON)');
    expect(html).toContain('Principles of Data Minimization &amp; Client-Side Privacy');
    expect(html).toContain('Right to Data Portability &amp; Complete Erasure');
  });

  it('renders quick action buttons with accessible labels', () => {
    expect(html).toContain('Manage Consent Preferences');
    expect(html).toContain('aria-labelledby="privacy-settings-title"');
  });
});
