import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

const vaultStorageState = {
  encrypted: false,
  locked: false,
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'Citizen Demo', email: 'citizen@example.gov.in' },
  }),
}));

vi.mock('../context/ConfirmationDialogContext', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}));

vi.mock('../context/ToastContext', () => ({
  useToast: () => ({
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock('../services/vaultStorage', () => ({
  getDocuments: () => [],
  saveDocument: vi.fn(),
  saveDocumentEncrypted: vi.fn(),
  deleteDocument: vi.fn(),
  deleteDocumentEncrypted: vi.fn(),
  getExpiryStatus: () => 'valid',
  getExpiringDocuments: () => [],
  isVaultAtRestEncrypted: () => vaultStorageState.encrypted,
  isEncryptedVaultLocked: () => vaultStorageState.locked,
  unlockAtRestVault: vi.fn(),
  lockAtRestVault: vi.fn(),
}));

vi.mock('../services/sessionInactivityService', () => ({
  startInactivityTracker: vi.fn(),
  stopInactivityTracker: vi.fn(),
  resetInactivityTracker: vi.fn(),
}));

import Vault from './Vault';

describe('Vault Page UI & Upload Constraints (#588)', () => {
  beforeEach(() => {
    vaultStorageState.encrypted = false;
    vaultStorageState.locked = false;
  });

  it('renders local privacy banner and file constraints', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Vault />
      </MemoryRouter>
    );

    expect(html).toContain('Local Privacy Architecture &amp; File Constraints');
    expect(html).toContain('Zero Server Upload');
    expect(html).toContain('PDF documents, JPG images, and PNG scans');
    expect(html).toContain('Maximum file size: 5 MB per item');
    expect(html).toContain('Data Minimization');
    expect(html).toContain('Session Auto-Lock');
    expect(html).toContain('Encryption');
  });

  it('renders empty vault state with educational copy and add action', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Vault />
      </MemoryRouter>
    );

    expect(html).toContain('Your Digital Civic Vault is Empty');
    expect(html).toContain('Store masked credential references');
    expect(html).toContain('No sensitive file data leaves your device');
    expect(html).toContain('Add First Document');
  });

  it('renders passphrase unlock form when at-rest encrypted vault is locked', () => {
    vaultStorageState.encrypted = true;
    vaultStorageState.locked = true;

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Vault />
      </MemoryRouter>
    );

    expect(html).toContain('Vault Locked for Privacy');
    expect(html).toContain('Vault Passphrase');
    expect(html).toContain('Unlock Encrypted Vault');
  });
});
