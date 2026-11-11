import { useState } from 'react';
import { X, ShieldCheck, KeyRound, Lock, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react';
import {
  enableAtRestEncryption,
  rotateAtRestPassphrase,
  disableAtRestEncryption,
  isVaultAtRestEncrypted,
} from '../../services/vaultStorage';
import { validateVaultPassphrase } from '../../services/vaultCryptoService';
import {
  VAULT_HIGH_RISK_ACTION,
  vaultSecurityStore,
} from '../../services/vaultRiskBasedAccessService';
import { useToast } from '../../context/ToastContext';

const VaultSecurityControlsModal = ({
  isOpen,
  onClose,
  userId = 'local-citizen',
  currentSessionId = '',
  stepUpActive = false,
  onCompleteStepUp = () => {},
  onAuthorizeAction = null,
  onVaultUpdated = () => {},
}) => {
  const { toast } = useToast();
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [currentPassphrase, setCurrentPassphrase] = useState('');
  const [disablePassphrase, setDisablePassphrase] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [, setRefreshTick] = useState(0);

  if (!isOpen) return null;

  const isEncrypted = isVaultAtRestEncrypted();
  const activeSessions = vaultSecurityStore.getActiveSessions(userId);
  const recentLogs = vaultSecurityStore.securityAuditLogs.slice(-5).reverse();
  const passphraseCheck = passphrase ? validateVaultPassphrase(passphrase) : null;

  const clearInputs = () => {
    setPassphrase('');
    setConfirmPassphrase('');
    setCurrentPassphrase('');
    setDisablePassphrase('');
    setError('');
  };

  const handleEnableEncryption = async (e) => {
    e.preventDefault();
    setError('');
    const check = validateVaultPassphrase(passphrase);
    if (!check.valid) {
      setError(check.error);
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError('Passphrases do not match.');
      return;
    }
    setBusy(true);
    try {
      await enableAtRestEncryption(passphrase);
      vaultSecurityStore.logSecurityEvent({
        eventType: 'AT_REST_ENCRYPTION_ENABLED',
        sessionId: currentSessionId || 'LOCAL_SESSION',
        riskLevel: 'LOW',
        reason: 'User enabled client-side AES-256-GCM at-rest vault encryption.',
      });
      toast.success('Vault at-rest encryption enabled.');
      clearInputs();
      onVaultUpdated();
    } catch (err) {
      setError(err?.message || 'Could not enable vault encryption.');
    } finally {
      setBusy(false);
    }
  };

  const handleRotatePassphrase = async (e) => {
    e.preventDefault();
    setError('');
    const check = validateVaultPassphrase(passphrase);
    if (!check.valid) {
      setError(check.error);
      return;
    }
    if (passphrase !== confirmPassphrase) {
      setError('New passphrases do not match.');
      return;
    }
    if (typeof onAuthorizeAction === 'function') {
      const permitted = await onAuthorizeAction(VAULT_HIGH_RISK_ACTION.RECOVERY_KEYS_CHANGE);
      if (!permitted) {
        setError('Step-up verification is required before rotating your vault passphrase.');
        return;
      }
    }
    setBusy(true);
    try {
      await rotateAtRestPassphrase(currentPassphrase, passphrase);
      vaultSecurityStore.logSecurityEvent({
        eventType: 'VAULT_KEY_ROTATED',
        sessionId: currentSessionId || 'LOCAL_SESSION',
        riskLevel: 'MEDIUM',
        reason: 'Vault encryption passphrase rotated with fresh salt and IV.',
      });
      toast.success('Vault passphrase rotated successfully.');
      clearInputs();
      onVaultUpdated();
    } catch (err) {
      setError(err?.message || 'Could not rotate vault passphrase.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisableEncryption = async (e) => {
    e.preventDefault();
    setError('');
    if (!disablePassphrase) {
      setError('Enter your current passphrase to disable at-rest encryption.');
      return;
    }
    if (typeof onAuthorizeAction === 'function') {
      const permitted = await onAuthorizeAction(VAULT_HIGH_RISK_ACTION.RECOVERY_KEYS_CHANGE);
      if (!permitted) {
        setError('Step-up verification is required before disabling at-rest encryption.');
        return;
      }
    }
    setBusy(true);
    try {
      await disableAtRestEncryption(disablePassphrase);
      vaultSecurityStore.logSecurityEvent({
        eventType: 'AT_REST_ENCRYPTION_DISABLED',
        sessionId: currentSessionId || 'LOCAL_SESSION',
        riskLevel: 'HIGH',
        reason: 'User disabled at-rest encryption on local vault records.',
      });
      toast.info('At-rest encryption disabled.');
      clearInputs();
      onVaultUpdated();
    } catch (err) {
      setError(err?.message || 'Could not disable vault encryption.');
    } finally {
      setBusy(false);
    }
  };

  const handleRevokeSession = (sessionId) => {
    vaultSecurityStore.revokeSession(sessionId);
    toast.info('Session revoked.');
    setRefreshTick((t) => t + 1);
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
        aria-labelledby="vault-security-modal-title"
        className="card animate-fade-in"
        style={{
          width: '100%',
          maxWidth: '620px',
          padding: '2rem',
          borderRadius: '1.25rem',
          background: 'var(--bg-card, #131b2e)',
          border: '1px solid var(--border-main)',
          maxHeight: '92vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <KeyRound size={22} color="var(--accent-main)" aria-hidden="true" />
            <h3 id="vault-security-modal-title" style={{ fontSize: '1.3rem', fontWeight: '800', margin: 0 }}>
              Vault Encryption &amp; Session Security
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close vault security controls"
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

        {/* Status & Step-up Challenge Banner */}
        <section
          aria-label="Vault security status"
          style={{
            padding: '1rem',
            borderRadius: '0.75rem',
            background: 'var(--glass-bg)',
            border: '1px solid var(--border-light)',
            marginBottom: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={18} color={isEncrypted ? '#10b981' : '#f59e0b'} aria-hidden="true" />
              <strong style={{ fontSize: '0.92rem' }}>
                At-Rest Storage: {isEncrypted ? 'AES-256-GCM Encrypted' : 'Standard Minimized JSON'}
              </strong>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCompleteStepUp}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
            >
              {stepUpActive ? 'Step-Up Verified' : 'Verify Step-Up Session'}
            </button>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.5rem 0 0' }}>
            Encryption keys are derived in memory via PBKDF2-SHA256 and never stored on disk or sent to any server.
          </p>
        </section>

        {error && (
          <p role="alert" style={{ fontSize: '0.82rem', color: '#ef4444', marginBottom: '1rem' }}>
            {error}
          </p>
        )}

        {!isEncrypted ? (
          <form
            onSubmit={handleEnableEncryption}
            style={{
              padding: '1.25rem',
              borderRadius: '0.75rem',
              background: 'var(--glass-bg)',
              border: '1px solid var(--border-light)',
              marginBottom: '1.25rem',
            }}
          >
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Lock size={16} color="var(--accent-main)" aria-hidden="true" />
              Enable At-Rest Vault Encryption
            </h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 0.85rem' }}>
              Encrypt stored document metadata with your own passphrase. Locking the vault clears the key from memory until re-entered.
            </p>
            <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '0.9rem' }}>
              <div>
                <label htmlFor="atrest-enable-pass" style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                  Vault Passphrase
                </label>
                <input
                  id="atrest-enable-pass"
                  type="password"
                  value={passphrase}
                  onChange={(e) => {
                    setPassphrase(e.target.value);
                    setError('');
                  }}
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                  style={{ width: '100%' }}
                />
                {passphraseCheck && (
                  <p style={{ fontSize: '0.75rem', margin: '0.25rem 0 0', color: passphraseCheck.valid ? '#10b981' : '#f59e0b' }}>
                    {passphraseCheck.valid ? `Strength: ${passphraseCheck.strength}` : passphraseCheck.error}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="atrest-enable-confirm" style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                  Confirm Passphrase
                </label>
                <input
                  id="atrest-enable-confirm"
                  type="password"
                  value={confirmPassphrase}
                  onChange={(e) => {
                    setConfirmPassphrase(e.target.value);
                    setError('');
                  }}
                  placeholder="Re-enter passphrase"
                  autoComplete="new-password"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              <Lock size={15} aria-hidden="true" />
              {busy ? 'Encrypting Vault...' : 'Enable Vault Encryption'}
            </button>
          </form>
        ) : (
          <div style={{ display: 'grid', gap: '1.1rem', marginBottom: '1.25rem' }}>
            <form
              onSubmit={handleRotatePassphrase}
              style={{
                padding: '1.15rem',
                borderRadius: '0.75rem',
                background: 'var(--glass-bg)',
                border: '1px solid var(--border-light)',
              }}
            >
              <h4 style={{ margin: '0 0 0.65rem', fontSize: '0.98rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <RefreshCw size={15} color="var(--accent-main)" aria-hidden="true" />
                Rotate Encryption Passphrase
              </h4>
              <div style={{ display: 'grid', gap: '0.65rem', marginBottom: '0.85rem' }}>
                <div>
                  <label htmlFor="atrest-current-pass" style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.2rem' }}>
                    Current Passphrase
                  </label>
                  <input
                    id="atrest-current-pass"
                    type="password"
                    value={currentPassphrase}
                    onChange={(e) => setCurrentPassphrase(e.target.value)}
                    autoComplete="current-password"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label htmlFor="atrest-new-pass" style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.2rem' }}>
                    New Passphrase
                  </label>
                  <input
                    id="atrest-new-pass"
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label htmlFor="atrest-new-confirm" style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.2rem' }}>
                    Confirm New Passphrase
                  </label>
                  <input
                    id="atrest-new-confirm"
                    type="password"
                    value={confirmPassphrase}
                    onChange={(e) => setConfirmPassphrase(e.target.value)}
                    autoComplete="new-password"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                <RefreshCw size={14} aria-hidden="true" />
                {busy ? 'Rotating...' : 'Rotate Passphrase'}
              </button>
            </form>

            <form
              onSubmit={handleDisableEncryption}
              style={{
                padding: '1.15rem',
                borderRadius: '0.75rem',
                background: 'var(--glass-bg)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
              }}
            >
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ShieldAlert size={15} color="#ef4444" aria-hidden="true" />
                Disable At-Rest Encryption
              </h4>
              <div style={{ marginBottom: '0.75rem' }}>
                <label htmlFor="atrest-disable-pass" style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                  Current Passphrase
                </label>
                <input
                  id="atrest-disable-pass"
                  type="password"
                  value={disablePassphrase}
                  onChange={(e) => setDisablePassphrase(e.target.value)}
                  autoComplete="current-password"
                  style={{ width: '100%' }}
                />
              </div>
              <button type="submit" className="btn btn-secondary" disabled={busy}>
                <Trash2 size={14} aria-hidden="true" />
                Disable Encryption
              </button>
            </form>
          </div>
        )}

        {/* Active Sessions & Privacy-Safe Security Audit */}
        <section
          aria-label="Active vault sessions and audit trail"
          style={{
            padding: '1.1rem',
            borderRadius: '0.75rem',
            background: 'var(--glass-bg)',
            border: '1px solid var(--border-light)',
          }}
        >
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', fontWeight: '700' }}>
            Active Sessions ({activeSessions.length})
          </h4>
          {activeSessions.length === 0 ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem' }}>
              No active vault sessions registered.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 0.85rem', display: 'grid', gap: '0.5rem' }}>
              {activeSessions.map((s) => (
                <li
                  key={s.sessionId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.8rem',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-light)',
                  }}
                >
                  <span>
                    {s.deviceLabel} {s.isCurrent ? '(Current)' : ''}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleRevokeSession(s.sessionId)}
                    style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}

          <h4 style={{ margin: '0 0 0.4rem', fontSize: '0.9rem', fontWeight: '700' }}>
            Recent Security Events (No Document Data Logged)
          </h4>
          {recentLogs.length === 0 ? (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', margin: 0 }}>
              No security events recorded in this session.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {recentLogs.map((log) => (
                <li key={log.id}>
                  <strong>[{log.riskLevel}]</strong> {log.eventType} — {log.reason}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default VaultSecurityControlsModal;
