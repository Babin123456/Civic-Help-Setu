import { useState } from 'react';
import { X, Download, Upload, ShieldCheck, Check, AlertCircle } from 'lucide-react';
import { exportVaultData, importVaultData } from '../../services/vaultStorage';
import { useToast } from '../../context/ToastContext';
import { logDiagnostic } from '../../utils/diagnostics';

const VaultBackupRestoreModal = ({
  isOpen,
  onClose,
  onVaultUpdated = () => {},
}) => {
  const { toast } = useToast();
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState(null);

  if (!isOpen) return null;

  const handleDownloadBackup = () => {
    try {
      const dataStr = exportVaultData();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `CivicBridge_Vault_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Encrypted vault backup downloaded successfully.');
    } catch (err) {
      logDiagnostic('Vault backup or restore failed', err);
      toast.error('Failed to export vault data.');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setImportText(event.target?.result || '');
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = (e) => {
    e.preventDefault();
    if (!importText.trim()) return;

    const result = importVaultData(importText);
    if (result.success) {
      const skippedNote = result.skipped ? ` ${result.skipped} invalid record(s) were skipped.` : '';
      toast.success(`Restored ${result.count} documents into your vault.${skippedNote}`);
      setImportStatus({ type: 'success', message: `${result.count} documents imported.${skippedNote}` });
      onVaultUpdated();
      setTimeout(() => {
        onClose();
      }, 1200);
    } else {
      toast.error(`Import failed: ${result.error}`);
      setImportStatus({ type: 'error', message: result.error });
    }
  };

  return (
    <div
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
      }}
    >
      <div
        className="card animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '560px',
          padding: '2rem',
          borderRadius: '1.25rem',
          background: 'var(--bg-card, #131b2e)',
          border: '1px solid var(--border-main)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <ShieldCheck size={22} color="var(--accent-main)" />
            <h3 style={{ fontSize: '1.35rem', fontWeight: '800', margin: 0 }}>
              Backup & Restore Vault
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: '0.25rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
          CivicBridge never transmits your sensitive document records to external servers. Export encrypted backups to your local machine or restore previous backups anytime.
        </p>

        {/* Section 1: Export */}
        <div
          style={{
            padding: '1.25rem',
            borderRadius: '0.75rem',
            background: 'var(--glass-bg)',
            border: '1px solid var(--border-light)',
            marginBottom: '1.5rem',
          }}
        >
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: '700' }}>
            1. Export Local Vault Backup
          </h4>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', margin: '0 0 1rem' }}>
            Save your vault credentials, metadata, and service linkings into a secure JSON backup file.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleDownloadBackup}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1.25rem' }}
          >
            <Download size={16} /> Download Backup (.json)
          </button>
        </div>

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
            Upload a previously exported CivicBridge vault backup file to restore records.
          </p>

          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}
          />

          {importStatus && (
            <div
              style={{
                fontSize: '0.8rem',
                color: importStatus.type === 'success' ? '#10b981' : '#ef4444',
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
              disabled={!importText.trim()}
              className="btn btn-primary"
              style={{ padding: '0.45rem 1.25rem', fontSize: '0.85rem' }}
            >
              <Upload size={14} /> Restore Vault
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VaultBackupRestoreModal;
