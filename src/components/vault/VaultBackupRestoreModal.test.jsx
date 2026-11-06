import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import VaultBackupRestoreModal from './VaultBackupRestoreModal';
import { ToastProvider } from '../../context/ToastContext';
import { validateBackupFile } from '../../services/vaultValidation';

describe('VaultBackupRestoreModal Component', () => {
  it('does not render when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <VaultBackupRestoreModal isOpen={false} onClose={() => {}} onVaultUpdated={() => {}} />
      </ToastProvider>
    );
    expect(html).toBe('');
  });

  it('renders modal with documented allowed file formats and maximum size', () => {
    const html = renderToStaticMarkup(
      <ToastProvider>
        <VaultBackupRestoreModal isOpen={true} onClose={() => {}} onVaultUpdated={() => {}} />
      </ToastProvider>
    );
    expect(html).toContain('Backup &amp; Restore Vault');
    expect(html).toContain('Allowed format: JSON (.json), up to 2 MB.');
    expect(html).toContain('accept=".json"');
    expect(html).toContain('id="backup-file-hint"');
  });

  it('validates backup file upload rejection and acceptance rules', () => {
    // Empty file
    expect(validateBackupFile({ name: 'backup.json', size: 0, type: 'application/json' }).valid).toBe(false);

    // Oversized (> 2 MB)
    expect(validateBackupFile({ name: 'backup.json', size: 3 * 1024 * 1024, type: 'application/json' }).valid).toBe(false);

    // Unsupported format
    expect(validateBackupFile({ name: 'backup.pdf', size: 1024, type: 'application/pdf' }).valid).toBe(false);

    // Mismatched extension and MIME type
    expect(validateBackupFile({ name: 'backup.json', size: 1024, type: 'image/png' }).valid).toBe(false);

    // Valid file
    expect(validateBackupFile({ name: 'backup.json', size: 100 * 1024, type: 'application/json' }).valid).toBe(true);
  });
});
