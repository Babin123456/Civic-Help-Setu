import { useState } from 'react';
import {
  X,
  Lock,
  Unlock,
  Download,
  Upload
} from 'lucide-react';
import {
  isWalletAtRestEncrypted,
  isWalletLocked,
  enableWalletAtRestEncryption,
  disableWalletAtRestEncryption,
  lockWallet,
  unlockWallet,
  exportEncryptedWalletBackup,
  importEncryptedWalletBackup
} from '../../services/dataWalletStorageService';

export default function WalletSecurityModal({
  onClose,
  onStorageChanged
}) {
  const [encrypted, setEncrypted] = useState(isWalletAtRestEncrypted());
  const [locked, setLocked] = useState(isWalletLocked());

  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleEnableEncryption = async (e) => {
    e.preventDefault();
    if (passphrase.length < 8) {
      setErrorMessage('Passphrase must be at least 8 characters long.');
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setErrorMessage('Passphrases do not match.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    try {
      await enableWalletAtRestEncryption(passphrase);
      setEncrypted(true);
      setLocked(false);
      setStatusMessage('Wallet encryption enabled successfully using WebCrypto AES-256-GCM.');
      setPassphrase('');
      setConfirmPassphrase('');
      onStorageChanged();
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisableEncryption = async (e) => {
    e.preventDefault();
    if (!passphrase) {
      setErrorMessage('Enter your current passphrase to disable encryption.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    try {
      await disableWalletAtRestEncryption(passphrase);
      setEncrypted(false);
      setLocked(false);
      setStatusMessage('Encryption removed. Credentials reverted to standard local storage.');
      setPassphrase('');
      onStorageChanged();
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLock = () => {
    lockWallet();
    setLocked(true);
    setStatusMessage('Wallet locked. Decrypted records purged from memory.');
    onStorageChanged();
  };

  const handleUnlock = async (e) => {
    e.preventDefault();
    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const res = await unlockWallet(passphrase);
      if (res.success) {
        setLocked(false);
        setStatusMessage('Wallet unlocked successfully.');
        setPassphrase('');
        onStorageChanged();
      }
    } catch {
      setErrorMessage('Incorrect passphrase or corrupted encrypted envelope.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportBackup = async () => {
    if (!passphrase || passphrase.length < 8) {
      setErrorMessage('Provide a passphrase (minimum 8 characters) to encrypt your backup export.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const envelope = await exportEncryptedWalletBackup(passphrase);
      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `citizen-wallet-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMessage('Encrypted backup downloaded successfully.');
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImportBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!passphrase) {
      setErrorMessage('Enter the passphrase used when creating this backup.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    try {
      const text = await file.text();
      const envelope = JSON.parse(text);
      const res = await importEncryptedWalletBackup(envelope, passphrase);
      setStatusMessage(`Restored ${res.count} credentials from encrypted backup.`);
      onStorageChanged();
    } catch (err) {
      setErrorMessage(`Failed to restore backup: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="security-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 1000
      }}
    >
      <div
        className="modal-content"
        style={{
          background: 'var(--bg-card, #ffffff)',
          color: 'var(--text-primary)',
          borderRadius: '1rem',
          maxWidth: '540px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border-light, #e2e8f0)',
          padding: '1.5rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 id="security-modal-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
              Wallet Security & Zero-Escrow Backups
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              WebCrypto AES-256-GCM client-side encryption
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            aria-label="Close dialog"
            style={{ padding: '0.35rem' }}
          >
            <X size={20} />
          </button>
        </div>

        {statusMessage && (
          <div className="alert alert-success" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
            {statusMessage}
          </div>
        )}

        {errorMessage && (
          <div className="alert alert-danger" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
            {errorMessage}
          </div>
        )}

        {/* Current Security Status */}
        <div
          style={{
            background: 'var(--bg-secondary, #f8fafc)',
            padding: '1rem',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-light, #e2e8f0)',
            marginBottom: '1.25rem'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'block' }}>
                At-Rest Storage Encryption:
              </span>
              <strong style={{ fontSize: '0.95rem' }}>
                {encrypted ? (locked ? 'Encrypted & Locked' : 'Encrypted & Unlocked') : 'Unencrypted (Standard Local Storage)'}
              </strong>
            </div>

            {encrypted && !locked && (
              <button
                type="button"
                onClick={handleLock}
                className="btn btn-sm btn-outline-danger"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}
              >
                <Lock size={13} />
                Lock Wallet
              </button>
            )}
          </div>
        </div>

        {/* If locked, unlock prompt */}
        {encrypted && locked && (
          <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <label htmlFor="unlock-passphrase" style={{ fontSize: '0.82rem', fontWeight: 600 }}>
              Enter Wallet Passphrase to Unlock:
            </label>
            <input
              id="unlock-passphrase"
              type="password"
              placeholder="Passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="form-control"
              style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
            />
            <button type="submit" disabled={isProcessing || !passphrase} className="btn btn-primary btn-sm">
              <Unlock size={14} style={{ marginRight: '0.3rem' }} />
              Unlock Wallet
            </button>
          </form>
        )}

        {/* If unencrypted, enable encryption form */}
        {!encrypted && (
          <form onSubmit={handleEnableEncryption} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Enable Passphrase Protection</h4>
            <div>
              <label htmlFor="new-passphrase" style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                New Passphrase (min 8 characters):
              </label>
              <input
                id="new-passphrase"
                type="password"
                placeholder="Passphrase"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="form-control"
                style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
              />
            </div>
            <div>
              <label htmlFor="confirm-passphrase" style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                Confirm Passphrase:
              </label>
              <input
                id="confirm-passphrase"
                type="password"
                placeholder="Confirm Passphrase"
                value={confirmPassphrase}
                onChange={(e) => setConfirmPassphrase(e.target.value)}
                className="form-control"
                style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
              />
            </div>
            <button type="submit" disabled={isProcessing || passphrase.length < 8} className="btn btn-primary btn-sm">
              <Lock size={14} style={{ marginRight: '0.3rem' }} />
              Encrypt Wallet At Rest
            </button>
          </form>
        )}

        {/* If encrypted and unlocked, disable option */}
        {encrypted && !locked && (
          <form onSubmit={handleDisableEncryption} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Disable Encryption</h4>
            <input
              type="password"
              placeholder="Current Passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="form-control"
              style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
            />
            <button type="submit" disabled={isProcessing || !passphrase} className="btn btn-secondary btn-sm">
              Revert to Unencrypted Storage
            </button>
          </form>
        )}

        {/* Encrypted Backup & Restore */}
        <div style={{ borderTop: '1px solid var(--border-light, #e2e8f0)', paddingTop: '1rem' }}>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', fontWeight: 600 }}>
            Lost-Device Recovery & Encrypted Backups
          </h4>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Export a zero-escrow encrypted backup file to migrate your credentials to another device or browser.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleExportBackup}
              disabled={isProcessing}
              className="btn btn-outline btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <Download size={14} />
              Export Encrypted Backup
            </button>

            <label
              className="btn btn-outline btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', margin: 0 }}
            >
              <Upload size={14} />
              Restore From Backup
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
