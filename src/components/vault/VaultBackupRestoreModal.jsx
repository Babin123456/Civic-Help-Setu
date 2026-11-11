import { useState } from 'react';
import { X, Download, Upload, ShieldCheck, Lock, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { validateBackupFile } from '../../services/vaultValidation';
import { exportEncryptedVaultData, importEncryptedVaultData } from '../../services/vaultStorage';
import { isEncryptedVaultEnvelope, validateVaultPassphrase } from '../../services/vaultCryptoService';
import { VAULT_HIGH_RISK_ACTION } from '../../services/vaultRiskBasedAccessService';
import { useToast } from '../../context/ToastContext';
import { logDiagnostic } from '../../utils/diagnostics';

const VaultBackupRestoreModal = ({
  isOpen,
  onClose,
  onVaultUpdated = () => {},
  onAuthorizeAction = null,
}) => {
  const { toast } = useToast();
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [showExportPass, setShowExportPass] = useState(false);
  const [exportError, setExportError] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const [importText, setImportText] = useState('');
  const [importPassphrase, setImportPassphrase] = useState('');
  const [showImportPass, setShowImportPass] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [fileError, setFileError] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  if (!isOpen) return null;

  const isUploadedEncrypted = importText.trim() ? isEncryptedVaultEnvelope(importText) : false;
  const passphraseCheck = exportPassphrase ? validateVaultPassphrase(exportPassphrase) : null;

  const handleDownloadBackup = async (e) => {
    e.preventDefault();
    setExportError('');

    const check = validateVaultPassphrase(exportPassphrase);
    if (!check.valid) {
      setExportError(check.error);
      return;
    }
    if (exportPassphrase !== confirmPassphrase) {
      setExportError('Passphrases do not match.');
      return;
    }

    if (typeof onAuthorizeAction === 'function') {
      const permitted = await onAuthorizeAction(VAULT_HIGH_RISK_ACTION.BULK_EXPORT);
      if (!permitted) {
        setExportError('Step-up verification is required before exporting vault backups.');
        return;
      }
    }

    setIsExporting(true);
    try {
      const dataStr = await exportEncryptedVaultData(exportPassphrase);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `CivicBridge_Vault_Encrypted_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setExportPassphrase('');
      setConfirmPassphrase('');
      toast.success('Encrypted vault backup downloaded successfully.');
    } catch (err) {
      logDiagnostic('Vault backup encryption failed', err);
      const msg = err?.message || 'Failed to encrypt and export vault data.';
      setExportError(msg);
      toast.error(msg);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateBackupFile(file);
    if (!validation.valid) {
      setFileError(validation.error);
      setImportText('');
      setImportStatus(null);
      e.target.value = '';
      return;
    }

    setFileError('');
    setImportStatus(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      setImportText(String(event.target?.result || ''));
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importText.trim()) return;
    if (isUploadedEncrypted && !importPassphrase) {
      setImportStatus({ type: 'error', message: 'Enter the backup passphrase to decrypt this file.' });
      return;
    }

    setIsImporting(true);
    try {
      const result = await importEncryptedVaultData(importText, importPassphrase);
      if (result.success) {
        const skippedNote = result.skipped ? ` ${result.skipped} invalid record(s) were skipped.` : '';
        if (result.legacyUnencrypted && result.warning) {
          toast.info(result.warning);
          setImportStatus({
            type: 'warning',
            message: `${result.count} document(s) restored.${skippedNote} ${result.warning}`,
          });
        } else {
          toast.success(`Restored ${result.count} documents into your vault.${skippedNote}`);
          setImportStatus({ type: 'success', message: `${result.count} documents imported.${skippedNote}` });
        }
        setImportPassphrase('');
        onVaultUpdated();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        toast.error(`Import failed: ${result.error}`);
        setImportStatus({ type: 'error', message: result.error });
      }
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem',
        overflowY: 'auto',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="vault-backup-modal-title"
        className="card animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '580px',
          padding: '2rem',
          borderRadius: '1.25rem',
          background: 'var(--bg-card, #131b2e)',
          border: '1px solid var(--border-main)',
          maxHeight: '92vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ShieldCheck size={22} color="var(--accent-main)" aria-hidden="true" />
            <h3 id="vault-backup-modal-title" style={{ fontSize: '1.35rem', fontWeight: '800', margin: 0 }}>
              Backup &amp; Restore Vault
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close backup and restore dialog"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: '0.25rem',
            }}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
          CivicBridge never transmits your document records to external servers. Backups are encrypted locally in your browser using AES-256-GCM and a passphrase only you know.
        </p>

        {/* Section 1: Encrypted Export */}
        <form
          onSubmit={handleDownloadBackup}
          style={{
            padding: '1.25rem',
            borderRadius: '0.75rem',
            background: 'var(--glass-bg)',
            border: '1px solid var(--border-light)',
            marginBottom: '1.5rem',
          }}
        >
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Lock size={16} color="var(--accent-main)" aria-hidden="true" />
            1. Export Encrypted Vault Backup
          </h4>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: '0 0 0.9rem' }}>
            Protect your exported `.json` file with a passphrase (minimum 8 characters). Lost passphrases cannot be recovered.
          </p>

          <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '0.85rem' }}>
            <div>
              <label htmlFor="vault-export-passphrase" style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.3rem' }}>
                Backup Encryption Passphrase
              </label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  id="vault-export-passphrase"
                  type={showExportPass ? 'text' : 'password'}
                  value={exportPassphrase}
                  onChange={(e) => {
                    setExportPassphrase(e.target.value);
                    setExportError('');
                  }}
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowExportPass((v) => !v)}
                  aria-label={showExportPass ? 'Hide export passphrase' : 'Show export passphrase'}
                  style={{ padding: '0.45rem 0.7rem' }}
                >
                  {showExportPass ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                </button>
              </div>
              {passphraseCheck && (
                <p style={{ fontSize: '0.75rem', margin: '0.25rem 0 0', color: passphraseCheck.valid ? '#10b981' : '#f59e0b' }}>
                  {passphraseCheck.valid ? `Strength: ${passphraseCheck.strength}` : passphraseCheck.error}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="vault-export-confirm" style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.3rem' }}>
                Confirm Passphrase
              </label>
              <input
                id="vault-export-confirm"
                type={showExportPass ? 'text' : 'password'}
                value={confirmPassphrase}
                onChange={(e) => {
                  setConfirmPassphrase(e.target.value);
                  setExportError('');
                }}
                placeholder="Re-enter passphrase"
                autoComplete="new-password"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {exportError && (
            <p role="alert" style={{ fontSize: '0.8rem', color: '#ef4444', margin: '0 0 0.75rem' }}>
              {exportError}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isExporting}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1.25rem' }}
          >
            <Download size={16} aria-hidden="true" />
            {isExporting ? 'Encrypting Backup...' : 'Download Encrypted Backup (.json)'}
          </button>
        </form>

        {/* Section 2: Import */}
        <form
          onSubmit={handleImportSubmit}
          style={{
            padding: '1.25rem',
            borderRadius: '0.75rem',
            background: 'var(--glass-bg)',
            border: '1px solid var(--border-light)',
          }}
        >
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: '700' }}>
            2. Restore from Backup File
          </h4>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem' }}>
            Upload an encrypted or legacy CivicBridge backup file to restore records.
          </p>

          <p id="backup-file-hint" style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', margin: '0 0 0.5rem' }}>
            Allowed format: JSON (.json), up to 2 MB.
          </p>

          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            aria-invalid={fileError ? 'true' : undefined}
            aria-describedby={fileError ? 'backup-file-hint backup-file-error' : 'backup-file-hint'}
            style={{ marginBottom: fileError ? '0.25rem' : '0.75rem', fontSize: '0.85rem' }}
          />

          {fileError && (
            <p id="backup-file-error" role="alert" style={{ fontSize: '0.8rem', color: '#ef4444', margin: '0 0 0.75rem' }}>
              {fileError}
            </p>
          )}

          {importText.trim() && isUploadedEncrypted && (
            <div style={{ marginBottom: '0.85rem' }}>
              <p style={{ fontSize: '0.8rem', color: '#10b981', margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Lock size={14} aria-hidden="true" /> Encrypted backup detected. Enter passphrase to decrypt:
              </p>
              <label htmlFor="vault-import-passphrase" style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.3rem' }}>
                Backup Decryption Passphrase
              </label>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  id="vault-import-passphrase"
                  type={showImportPass ? 'text' : 'password'}
                  value={importPassphrase}
                  onChange={(e) => setImportPassphrase(e.target.value)}
                  placeholder="Enter backup passphrase"
                  autoComplete="current-password"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowImportPass((v) => !v)}
                  aria-label={showImportPass ? 'Hide import passphrase' : 'Show import passphrase'}
                  style={{ padding: '0.45rem 0.7rem' }}
                >
                  {showImportPass ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                </button>
              </div>
            </div>
          )}

          {importText.trim() && !isUploadedEncrypted && (
            <div
              role="note"
              style={{
                fontSize: '0.8rem',
                color: '#f59e0b',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '0.5rem',
                padding: '0.6rem 0.75rem',
                marginBottom: '0.85rem',
                display: 'flex',
                gap: '0.45rem',
                alignItems: 'flex-start',
              }}
            >
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
              <span>
                Legacy unencrypted backup detected (v2.0). Records can still be restored, but re-export with a passphrase afterward to encrypt your backup.
              </span>
            </div>
          )}

          {importStatus && (
            <div
              role={importStatus.type === 'error' ? 'alert' : 'status'}
              style={{
                fontSize: '0.8rem',
                color:
                  importStatus.type === 'success'
                    ? '#10b981'
                    : importStatus.type === 'warning'
                      ? '#f59e0b'
                      : '#ef4444',
                marginBottom: '0.75rem',
              }}
            >
              {importStatus.message}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
            >
              Close
            </button>
            <button
              type="submit"
              disabled={!importText.trim() || isImporting}
              className="btn btn-primary"
              style={{ padding: '0.45rem 1.25rem', fontSize: '0.85rem' }}
            >
              <Upload size={14} aria-hidden="true" />
              {isImporting ? 'Restoring...' : 'Restore Vault'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VaultBackupRestoreModal;
