import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isEncryptedVaultEnvelope } from './vaultCryptoService';
import { exportUserData } from './privacyConsentService';

const makeStorage = () => {
  const data = new Map();
  return {
    getItem: vi.fn((k) => (data.has(k) ? data.get(k) : null)),
    setItem: vi.fn((k, v) => data.set(k, String(v))),
    removeItem: vi.fn((k) => data.delete(k)),
    key: vi.fn((i) => [...data.keys()][i] ?? null),
    get length() {
      return data.size;
    },
  };
};

describe('vaultStorage', () => {
  let storage;
  let mod;
  beforeEach(async () => {
    storage = makeStorage();
    vi.stubGlobal('localStorage', storage);
    mod = await import('./vaultStorage');
    mod.lockAtRestVault();
  });

  it('saveDocument sets createdAt on new documents', () => {
    const docs = mod.saveDocument({ type: 'Voter ID', number: 'V1' });
    expect(docs[0].createdAt).toBeTruthy();
    expect(docs[0].verified).toBe(false);
  });

  it('saveDocument throws a friendly error when storage is full', () => {
    mod.getDocuments();
    storage.setItem.mockImplementation(() => {
      const e = new Error('full');
      e.name = 'QuotaExceededError';
      throw e;
    });
    expect(() => mod.saveDocument({ type: 'X', number: '1' })).toThrow(/storage is full/i);
  });

  it('importVaultData skips invalid records and reports the count', () => {
    const backup = JSON.stringify({
      documents: [
        { id: 'ok-1', type: 'Passport', number: 'P1' },
        { id: 'bad-1', type: 'NoNumber' },
        null,
        'junk',
      ],
    });
    const res = mod.importVaultData(backup);
    expect(res.success).toBe(true);
    expect(res.count).toBe(1);
    expect(res.skipped).toBe(3);
    expect(mod.getDocuments().some((d) => d.id === 'ok-1')).toBe(true);
    expect(mod.getDocuments().some((d) => d.id === 'bad-1')).toBe(false);
  });

  it('importVaultData rejects a bad format', () => {
    expect(mod.importVaultData('{"nope":1}').success).toBe(false);
    expect(mod.importVaultData('not json').success).toBe(false);
  });

  it('exportEncryptedVaultData and importEncryptedVaultData round-trip encrypted backups', async () => {
    mod.saveDocument({ id: 'enc-1', type: 'Passport', category: 'Identity', number: 'Z9876543' });
    const exportedJson = await mod.exportEncryptedVaultData('VaultBackup#2026!');

    expect(isEncryptedVaultEnvelope(exportedJson)).toBe(true);
    expect(exportedJson).not.toContain('Passport');
    expect(exportedJson).not.toContain('6543');

    // Reset local storage before restore
    storage = makeStorage();
    vi.stubGlobal('localStorage', storage);

    const missingPass = await mod.importEncryptedVaultData(exportedJson, '');
    expect(missingPass.success).toBe(false);
    expect(missingPass.needsPassphrase).toBe(true);

    const wrongPass = await mod.importEncryptedVaultData(exportedJson, 'WrongPassphrase1!');
    expect(wrongPass.success).toBe(false);
    expect(wrongPass.error).toMatch(/incorrect passphrase|modified/i);

    const ok = await mod.importEncryptedVaultData(exportedJson, 'VaultBackup#2026!');
    expect(ok.success).toBe(true);
    expect(ok.encrypted).toBe(true);
    expect(ok.legacyUnencrypted).toBe(false);
    expect(mod.getDocuments().some((d) => d.id === 'enc-1' && d.number === 'XXXX 6543')).toBe(true);
  });

  it('importEncryptedVaultData imports legacy v2.0 unencrypted backups with a warning', async () => {
    const legacyBackup = JSON.stringify({
      app: 'CivicBridge Vault',
      version: '2.0',
      documents: [{ id: 'leg-1', type: 'PAN Card', number: 'ABCDE1234F' }],
    });

    const res = await mod.importEncryptedVaultData(legacyBackup);
    expect(res.success).toBe(true);
    expect(res.encrypted).toBe(false);
    expect(res.legacyUnencrypted).toBe(true);
    expect(res.warning).toMatch(/legacy unencrypted/i);
    expect(mod.getDocuments().some((d) => d.id === 'leg-1' && d.number === 'XXXX 234F')).toBe(true);
  });

  it('enables, locks, unlocks, rotates, and disables at-rest vault encryption safely', async () => {
    mod.saveDocument({ id: 'atrest-1', type: 'Driving License', number: 'DL123456' });
    await mod.enableAtRestEncryption('InitialPass#2026');

    expect(mod.isVaultAtRestEncrypted()).toBe(true);
    expect(mod.isEncryptedVaultLocked()).toBe(false);

    const storedRaw = storage.getItem('civicbridge_vault_docs');
    expect(isEncryptedVaultEnvelope(storedRaw)).toBe(true);
    expect(storedRaw).not.toContain('Driving License');

    // Privacy export does not crash or leak ciphertext when vault is encrypted at rest
    const exportedPrivacy = exportUserData('citizen-1');
    expect(exportedPrivacy.documentVaultMetadata).toEqual([]);
    expect(JSON.stringify(exportedPrivacy)).not.toContain('Driving License');

    // Locking clears memory cache and prevents silent plaintext overwrites
    mod.lockAtRestVault();
    expect(mod.isEncryptedVaultLocked()).toBe(true);
    expect(mod.getDocuments()).toEqual([]);
    expect(() => mod.saveDocument({ type: 'Blocked', number: '1234' })).toThrow(/locked/i);

    // Wrong passphrase rejects unlock
    await expect(mod.unlockAtRestVault('BadPass#2026')).rejects.toThrow(/incorrect passphrase/i);

    // Unlock restores minimized docs
    const unlocked = await mod.unlockAtRestVault('InitialPass#2026');
    expect(unlocked.some((d) => d.id === 'atrest-1')).toBe(true);
    expect(mod.isEncryptedVaultLocked()).toBe(false);

    // Save while encrypted persists ciphertext
    await mod.saveDocumentEncrypted({ id: 'atrest-2', type: 'Voter ID', number: 'VTR9988' });
    expect(storage.getItem('civicbridge_vault_docs')).not.toContain('Voter ID');

    // Rotate passphrase
    await mod.rotateAtRestPassphrase('InitialPass#2026', 'RotatedPass#2026');
    mod.lockAtRestVault();
    await expect(mod.unlockAtRestVault('InitialPass#2026')).rejects.toThrow();
    const afterRotate = await mod.unlockAtRestVault('RotatedPass#2026');
    expect(afterRotate.some((d) => d.id === 'atrest-2')).toBe(true);

    // Disable at-rest encryption
    await mod.disableAtRestEncryption('RotatedPass#2026');
    expect(mod.isVaultAtRestEncrypted()).toBe(false);
    expect(mod.getDocuments().some((d) => d.id === 'atrest-2')).toBe(true);
  });
});
