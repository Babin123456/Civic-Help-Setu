import { useState, useEffect, useMemo, useRef, useId, useCallback } from 'react';
import {
  FileBadge, ShieldCheck, Upload, CreditCard, Car, FileText,
  Plus, Search, Eye, AlertTriangle, Layers, Download, Tag, Stamp, Calendar, Camera, KeyRound
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmationDialogContext';
import { useToast } from '../context/ToastContext';
import {
  getDocuments,
  saveDocumentEncrypted,
  deleteDocumentEncrypted,
  getExpiryStatus,
  getExpiringDocuments,
  isVaultAtRestEncrypted,
  isEncryptedVaultLocked,
  unlockAtRestVault,
  lockAtRestVault,
} from '../services/vaultStorage';
import {
  VAULT_HIGH_RISK_ACTION,
  vaultSecurityStore,
  evaluateVaultAccessRisk,
  verifyAndConsumeStepUpToken,
} from '../services/vaultRiskBasedAccessService';
import VaultStats from '../components/vault/VaultStats';
import DocumentModal from '../components/vault/DocumentModal';
import DocumentPreviewModal from '../components/vault/DocumentPreviewModal';
import ExpiringDocumentsAlert from '../components/vault/ExpiringDocumentsAlert';
import VaultRenewalReminderBanner from '../components/vault/VaultRenewalReminderBanner';
import VaultBackupRestoreModal from '../components/vault/VaultBackupRestoreModal';
import VaultSecurityControlsModal from '../components/vault/VaultSecurityControlsModal';
import SharedDeviceNotice from '../components/privacy/SharedDeviceNotice';
import ServiceTaggingModal from '../components/vault/ServiceTaggingModal';
import DocumentPreflightChecker from '../components/vault/DocumentPreflightChecker';
import InactivityLockModal from '../components/vault/InactivityLockModal';
import WatermarkAttestationModal from '../components/vault/WatermarkAttestationModal';
import DocumentRenewalDigestModal from '../components/vault/DocumentRenewalDigestModal';
import DocumentQualityOcrInspectorModal from '../components/vault/DocumentQualityOcrInspectorModal';
import { Lock, Unlock, ShieldAlert } from 'lucide-react';
import {
  startInactivityTracker,
  stopInactivityTracker,
  resetInactivityTracker,
} from '../services/sessionInactivityService';

const CATEGORIES = ['All', 'Identity', 'Finance', 'Transport', 'Education', 'Welfare'];

const getDocumentIcon = (type = '', category = '') => {
  const t = type.toLowerCase();
  const c = category.toLowerCase();
  if (t.includes('aadhaar') || t.includes('voter') || c === 'identity') {
    return <FileBadge size={30} />;
  }
  if (t.includes('pan') || t.includes('tax') || c === 'finance') {
    return <CreditCard size={30} />;
  }
  if (t.includes('driving') || t.includes('license') || t.includes('vehicle') || c === 'transport') {
    return <Car size={30} />;
  }
  return <FileText size={30} />;
};

const FILE_TYPE_LABELS = { 'application/pdf': 'PDF', 'image/jpeg': 'JPG', 'image/png': 'PNG' };

const formatAddedDate = (iso) => {
  if (!iso) return 'Date not recorded';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'Date not recorded' : `Added ${d.toLocaleDateString()}`;
};

const Vault = () => {
  const { user } = useAuth();
  const confirm = useConfirm();
  const { toast } = useToast();
  const sessionIdSuffix = useId();
  const vaultSessionId = `vault_sess_${sessionIdSuffix}`;
  const lastVerifiedAtRef = useRef(0);

  const [documents, setDocuments] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isRenewalDigestOpen, setIsRenewalDigestOpen] = useState(false);
  const [isOcrInspectorOpen, setIsOcrInspectorOpen] = useState(false);
  const [taggingDoc, setTaggingDoc] = useState(null);
  const [watermarkDoc, setWatermarkDoc] = useState(null);
  const [expiringDocs, setExpiringDocs] = useState(() => getExpiringDocuments());
  const [isVaultLocked, setIsVaultLocked] = useState(() => isEncryptedVaultLocked());
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [warningSeconds, setWarningSeconds] = useState(30);
  const [unlockPassphrase, setUnlockPassphrase] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [stepUpVerified, setStepUpVerified] = useState(false);

  const refreshVault = useCallback(() => {
    const docs = getDocuments();
    setDocuments(docs);
    setExpiringDocs(getExpiringDocuments());
  }, []);

  useEffect(() => {
    refreshVault();
  }, [refreshVault]);

  useEffect(() => {
    lastVerifiedAtRef.current = Date.now();
    vaultSecurityStore.registerSession({
      id: vaultSessionId,
      userId: user?.id || 'local-citizen',
      deviceLabel: 'Current Browser Vault Session',
      isCurrent: true,
    });
  }, [vaultSessionId, user?.id]);

  const engagePrivacyLock = useCallback(() => {
    lockAtRestVault();
    setStepUpVerified(false);
    setUnlockPassphrase('');
    setUnlockError('');
    setSelectedDoc(null);
    setIsVaultLocked(true);
    refreshVault();
  }, [refreshVault]);

  useEffect(() => {
    if (isVaultLocked) {
      stopInactivityTracker();
      return undefined;
    }
    startInactivityTracker({
      timeoutSeconds: 300,
      warningSeconds: 30,
      onWarning: (remaining) => {
        setWarningSeconds(remaining);
        setShowInactivityWarning(true);
      },
      onTimeout: () => {
        setShowInactivityWarning(false);
        engagePrivacyLock();
      },
      onActivity: () => {
        setShowInactivityWarning(false);
      },
    });
    return () => stopInactivityTracker();
  }, [isVaultLocked, engagePrivacyLock]);

  const completeStepUpChallenge = () => {
    const token = `stepup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ok = verifyAndConsumeStepUpToken(vaultSessionId, token);
    if (ok) {
      lastVerifiedAtRef.current = Date.now();
      setStepUpVerified(true);
      toast.success('Step-up verification completed for this vault session.');
    }
    return ok;
  };

  const authorizeSensitiveAction = async (action) => {
    const authAgeSeconds = lastVerifiedAtRef.current
      ? Math.max(0, Math.round((Date.now() - lastVerifiedAtRef.current) / 1000))
      : 0;
    const assessment = evaluateVaultAccessRisk({
      sessionId: vaultSessionId,
      action,
      authAgeSeconds,
      mfaVerified: stepUpVerified,
    });

    if (assessment.allowed) {
      return true;
    }

    if (!assessment.requiresStepUp) {
      toast.error(assessment.reason);
      return false;
    }

    const approved = await confirm({
      title: 'Step-Up Verification Required',
      message: `${assessment.reason} Confirm step-up verification to continue with ${action.replaceAll('_', ' ').toLowerCase()}.`,
      confirmLabel: 'Verify & Continue',
      cancelLabel: 'Cancel',
    });

    if (!approved) {
      return false;
    }

    return completeStepUpChallenge();
  };

  const handleSaveDocument = async (docData) => {
    const updated = await saveDocumentEncrypted(docData);
    setDocuments(updated);
    setExpiringDocs(getExpiringDocuments());
  };

  const handleDeleteDocument = async (id) => {
    const targetDoc = documents.find((d) => d.id === id);
    const docName = targetDoc ? `${targetDoc.type} (${targetDoc.number})` : 'this document';

    const shouldDelete = await confirm({
      title: 'Permanently Delete Document?',
      message: `Are you sure you want to delete ${docName} from your secure document vault? All associated document files and service tags will be permanently removed.`,
      itemName: docName,
      confirmLabel: 'Permanently Delete',
      cancelLabel: 'Keep Document',
      variant: 'danger',
    });

    if (!shouldDelete) return;

    const authorized = await authorizeSensitiveAction(VAULT_HIGH_RISK_ACTION.PERMANENT_DELETE);
    if (!authorized) return;

    const updated = await deleteDocumentEncrypted(id);
    setDocuments(updated);
    setExpiringDocs(getExpiringDocuments());
    setSelectedDoc(null);
  };

  const handleUnlockVault = async (e) => {
    if (e) e.preventDefault();
    setUnlockError('');

    if (isVaultAtRestEncrypted()) {
      if (!unlockPassphrase) {
        setUnlockError('Enter your vault encryption passphrase to unlock.');
        return;
      }
      setIsUnlocking(true);
      try {
        const docs = await unlockAtRestVault(unlockPassphrase);
        setDocuments(docs);
        setExpiringDocs(getExpiringDocuments());
        setUnlockPassphrase('');
        setIsVaultLocked(false);
        resetInactivityTracker();
      } catch (err) {
        setUnlockError(err?.message || 'Incorrect passphrase or tampered vault storage.');
      } finally {
        setIsUnlocking(false);
      }
      return;
    }

    setIsVaultLocked(false);
    resetInactivityTracker();
  };

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesCategory =
        activeCategory === 'All' ||
        (doc.category && doc.category.toLowerCase() === activeCategory.toLowerCase());
      const query = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !query ||
        doc.type.toLowerCase().includes(query) ||
        doc.number.toLowerCase().includes(query) ||
        (doc.issuer && doc.issuer.toLowerCase().includes(query));
      return matchesCategory && matchesQuery;
    });
  }, [documents, activeCategory, searchQuery]);

  return (
    <div className="section animate-fade-in" style={{ paddingBottom: '6rem' }}>
      <div className="container" style={{ maxWidth: '1100px' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: '2rem',
            gap: '1.5rem',
          }}
        >
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-main)', fontSize: '0.875rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>
              <ShieldCheck size={18} /> Stored on this device
            </div>
            <h1 style={{ fontSize: 'clamp(2.25rem, 5vw, 3rem)', fontWeight: '800' }}>
              Digital Document Vault
            </h1>
            <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
              Store, organize, and inspect your civic credentials with expiration warnings.
            </p>
            <SharedDeviceNotice what="document details (only the last 4 characters of each number)" />
            {user && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  marginTop: '1rem',
                  padding: '0.35rem 0.85rem',
                  background: 'var(--glass-bg)',
                  borderRadius: '99px',
                  border: '1px solid var(--border-light)',
                }}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }}></div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '500' }}>
                  Vault Owner: <strong>{user.username}</strong> ({user.role === 'admin' ? 'Administrator' : 'Citizen'})
                </span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsBackupModalOpen(true)}
              style={{ padding: '0.75rem 1.25rem', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Download size={18} />
              <span>Backup & Restore</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsSecurityModalOpen(true)}
              aria-label="Encryption and Session Security"
              style={{ padding: '0.75rem 1.15rem', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <KeyRound size={17} />
              <span>{isVaultAtRestEncrypted() ? 'Encryption On' : 'Encryption'}</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsRenewalDigestOpen(true)}
              style={{ padding: '0.75rem 1.15rem', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Calendar size={17} />
              <span>Renewal Digest</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsOcrInspectorOpen(true)}
              aria-label="Consent-Based Document Quality & OCR Check"
              style={{ padding: '0.75rem 1.15rem', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Camera size={17} />
              <span>OCR Quality Check</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={engagePrivacyLock}
              aria-label="Lock Vault for Privacy"
              style={{ padding: '0.75rem 1.1rem', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Lock size={16} />
              <span>Lock Vault</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setIsModalOpen(true)}
              style={{ padding: '0.75rem 1.75rem', fontSize: '1rem' }}
            >
              <Plus size={18} />
              <span>Add Document</span>
            </button>
          </div>
        </div>

        {/* Statutory Document Renewal Reminders */}
        <VaultRenewalReminderBanner documents={documents} />

        {/* Document Expiration Warnings */}
        <ExpiringDocumentsAlert expiringList={expiringDocs} />

        {/* Pre-flight Inspection & Format Check */}
        <DocumentPreflightChecker onAuditComplete={refreshVault} />

        {isVaultLocked ? (
          <div
            className="glass-panel"
            role="alert"
            style={{
              padding: '3.5rem 2rem',
              textAlign: 'center',
              borderRadius: '1rem',
              marginTop: '1.5rem',
              background: 'var(--bg-card, rgba(30, 41, 59, 0.7))',
              border: '1px solid rgba(245, 158, 11, 0.35)',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
              }}
            >
              <Lock size={36} aria-hidden="true" />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Vault Locked for Privacy
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 1.5rem', lineHeight: '1.6' }}>
              {isVaultAtRestEncrypted()
                ? 'Your encrypted vault key was cleared from memory. Enter your passphrase to decrypt your document metadata locally.'
                : 'Your credentials and document numbers were obscured to protect your identity privacy at public kiosks and shared terminals.'}
            </p>
            {isVaultAtRestEncrypted() ? (
              <form
                onSubmit={handleUnlockVault}
                style={{ maxWidth: '360px', margin: '0 auto', display: 'grid', gap: '0.75rem', textAlign: 'left' }}
              >
                <div>
                  <label htmlFor="vault-unlock-passphrase" style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.3rem' }}>
                    Vault Passphrase
                  </label>
                  <input
                    id="vault-unlock-passphrase"
                    type="password"
                    value={unlockPassphrase}
                    onChange={(e) => {
                      setUnlockPassphrase(e.target.value);
                      setUnlockError('');
                    }}
                    placeholder="Enter your encryption passphrase"
                    autoComplete="current-password"
                    style={{ width: '100%' }}
                  />
                </div>
                {unlockError && (
                  <p role="alert" style={{ color: '#ef4444', fontSize: '0.82rem', margin: 0 }}>
                    {unlockError}
                  </p>
                )}
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isUnlocking}
                  style={{ padding: '0.75rem 1.75rem', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                >
                  <Unlock size={18} />
                  <span>{isUnlocking ? 'Decrypting Vault...' : 'Unlock Encrypted Vault'}</span>
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleUnlockVault}
                style={{ padding: '0.75rem 1.75rem', fontSize: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Unlock size={18} />
                <span>Unlock Vault</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Vault Stats Cards */}
            <VaultStats documents={documents} />

            {/* Document Constraints & Privacy Guide Banner */}
            <section
              className="vault-privacy-constraints-banner glass-panel"
              aria-label="Document storage constraints and privacy notice"
              style={{
                marginBottom: '1.75rem',
                padding: '1.25rem 1.5rem',
                borderRadius: '1rem',
                border: '1px solid var(--border-light)',
                background: 'var(--card-bg, rgba(255, 255, 255, 0.03))',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <ShieldCheck size={20} color="var(--accent-main)" aria-hidden="true" />
                  <h2 style={{ fontSize: '1rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
                    Local Privacy Architecture &amp; File Constraints
                  </h2>
                </div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '99px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: 'var(--success, #10b981)',
                  }}
                >
                  Zero Server Upload
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1rem',
                  fontSize: '0.84rem',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.5',
                }}
              >
                <div>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.2rem' }}>
                    📁 Supported Formats:
                  </strong>
                  <span>PDF documents, JPG images, and PNG scans. Maximum file size: 5 MB per item.</span>
                </div>
                <div>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.2rem' }}>
                    🛡️ Data Minimization:
                  </strong>
                  <span>Only metadata and masked numbers (last 4 characters) are stored on this device.</span>
                </div>
                <div>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '0.2rem' }}>
                    ⏱️ Session Auto-Lock:
                  </strong>
                  <span>Vault automatically engages inactivity protection after 5 minutes of idle time.</span>
                </div>
              </div>
            </section>

        {/* Toolbar: Search and Filter Tabs */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          {/* Category Chips */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: '0.45rem 1rem',
                  borderRadius: '99px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  background: activeCategory === cat ? 'var(--text-primary)' : 'var(--glass-bg)',
                  color: activeCategory === cat ? 'var(--bg-main)' : 'var(--text-secondary)',
                  border: activeCategory === cat ? '1px solid transparent' : '1px solid var(--border-light)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '300px',
            }}
          >
            <Search
              size={18}
              style={{
                position: 'absolute',
                left: '0.85rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-tertiary)',
              }}
            />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field"
              style={{
                padding: '0.5rem 1rem 0.5rem 2.5rem',
                fontSize: '0.9rem',
                borderRadius: '99px',
              }}
            />
          </div>
        </div>

        {/* Documents Grid */}
        <div className="grid-3">
          {filteredDocuments.map((doc) => {
            const expiryStatus = getExpiryStatus(doc.expiryDate);
            return (
              <div
                key={doc.id}
                className="card animate-fade-in"
                style={{
                  padding: '1.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedDoc(doc)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: '3.75rem',
                      height: '3.75rem',
                      borderRadius: '1rem',
                      background: 'var(--glass-bg)',
                      color: 'var(--accent-main)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {getDocumentIcon(doc.type, doc.category)}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {expiryStatus === 'expired' && (
                      <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '99px', background: 'rgba(239, 68, 68, 0.2)', color: 'var(--error, #ef4444)', fontWeight: '700' }}>
                        Expired
                      </span>
                    )}
                    {expiryStatus === 'expiring-soon' && (
                      <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '99px', background: 'rgba(245, 158, 11, 0.2)', color: 'var(--warning, #f59e0b)', fontWeight: '700' }}>
                        Expiring Soon
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTaggingDoc(doc);
                      }}
                      style={{ color: 'var(--accent-main)', padding: '0.35rem', background: 'none', border: 'none', cursor: 'pointer' }}
                      title="Tag to Civic Services"
                    >
                      <Tag size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setWatermarkDoc(doc);
                      }}
                      style={{ color: 'var(--accent-main)', padding: '0.35rem', background: 'none', border: 'none', cursor: 'pointer' }}
                      title="Watermark & Attest for Submission"
                      aria-label={`Watermark and attest ${doc.name || 'document'}`}
                    >
                      <Stamp size={17} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDoc(doc);
                      }}
                      style={{ color: 'var(--text-tertiary)', padding: '0.35rem', background: 'none', border: 'none', cursor: 'pointer' }}
                      title="Inspect Document"
                    >
                      <Eye size={18} />
                    </button>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>
                    {doc.category || 'General'}
                  </span>
                  <h3
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: '700',
                      color: 'var(--text-primary)',
                      marginTop: '0.2rem',
                      marginBottom: '0.25rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {doc.type}
                  </h3>
                  <p
                    style={{
                      fontSize: '0.95rem',
                      color: 'var(--text-secondary)',
                      fontFamily: 'monospace',
                      letterSpacing: '1px',
                    }}
                  >
                    {doc.number}
                  </p>

                  {doc.taggedServices && doc.taggedServices.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                      {doc.taggedServices.map((srvId) => (
                        <span
                          key={srvId}
                          style={{
                            fontSize: '0.68rem',
                            padding: '0.1rem 0.45rem',
                            borderRadius: '99px',
                            background: 'rgba(56, 189, 248, 0.15)',
                            color: 'var(--accent-main)',
                            fontWeight: '600',
                          }}
                        >
                          #{srvId}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    marginTop: 'auto',
                    paddingTop: '0.85rem',
                    borderTop: '1px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  {doc.verified ? (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        color: 'var(--success, #10b981)',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                      }}
                    >
                      <ShieldCheck size={15} /> Self-declared verified
                    </span>
                  ) : (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        color: 'var(--text-tertiary)',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                      }}
                    >
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--text-tertiary)' }}></div>
                      Not verified
                    </span>
                  )}

                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textAlign: 'right' }}>
                    {formatAddedDate(doc.createdAt)}
                    <br />
                    {[doc.fileType ? FILE_TYPE_LABELS[doc.fileType] : null, doc.fileSize || 'Digital Record']
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Quick Add Placeholder Card */}
          <div
            className="card"
            onClick={() => setIsModalOpen(true)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              borderStyle: 'dashed',
              cursor: 'pointer',
              minHeight: '220px',
              background: 'var(--glass-bg-subtle)',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-main)';
              e.currentTarget.style.background = 'var(--glass-bg-hover)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-main)';
              e.currentTarget.style.background = 'var(--glass-bg-subtle)';
            }}
          >
            <div
              style={{
                width: '3.5rem',
                height: '3.5rem',
                borderRadius: '50%',
                background: 'var(--glass-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-main)',
              }}
            >
              <Plus size={24} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                Add New Document
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: '0.2rem' }}>
                PDF, JPG or direct reference number
              </p>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {filteredDocuments.length === 0 && (
          <section
            className="vault-empty-state card glass-panel animate-fade-in"
            aria-labelledby="vault-empty-title"
            style={{
              textAlign: 'center',
              padding: 'clamp(2.5rem, 6vw, 4rem) clamp(1.25rem, 4vw, 2.5rem)',
              marginTop: '1.5rem',
              borderRadius: '1.25rem',
              border: '1px dashed var(--border-light)',
              maxWidth: '750px',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(56, 189, 248, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
                color: 'var(--accent-main)',
              }}
            >
              <FileBadge size={32} aria-hidden="true" />
            </div>

            <h3
              id="vault-empty-title"
              style={{
                color: 'var(--text-primary)',
                fontSize: '1.4rem',
                fontWeight: '700',
                marginBottom: '0.5rem',
              }}
            >
              {documents.length === 0
                ? 'Your Digital Civic Vault is Empty'
                : `No documents found in ${activeCategory}`}
            </h3>

            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: '0.95rem',
                maxWidth: '520px',
                margin: '0 auto 1.5rem',
                lineHeight: '1.6',
              }}
            >
              {documents.length === 0 ? (
                <>
                  Store masked credential references, track certificate expiration deadlines, and prepare
                  tamper-evident watermarked photocopies. <strong>No sensitive file data leaves your device.</strong>
                </>
              ) : searchQuery ? (
                <>
                  No stored records matched query <em>&ldquo;{searchQuery}&rdquo;</em> in category{' '}
                  <strong>{activeCategory}</strong>. Try relaxing your search terms or view all documents.
                </>
              ) : (
                <>
                  You haven&apos;t added any documents under <strong>{activeCategory}</strong> yet. You can catalog identity
                  cards, vehicle registrations, tax profiles, or welfare entitlements.
                </>
              )}
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsModalOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  borderRadius: '99px',
                  padding: '0.65rem 1.5rem',
                }}
              >
                <Plus size={16} aria-hidden="true" />
                <span>Add First Document</span>
              </button>

              {(searchQuery || activeCategory !== 'All') && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveCategory('All');
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    borderRadius: '99px',
                    padding: '0.65rem 1.5rem',
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          </section>
        )}

          </>
        )}

        {/* Add Document Modal */}
        <DocumentModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveDocument}
          existingDocs={documents}
        />

        {/* Preview Document Modal */}
        <DocumentPreviewModal
          doc={selectedDoc}
          isOpen={Boolean(selectedDoc)}
          onClose={() => setSelectedDoc(null)}
          onDelete={handleDeleteDocument}
        />

        {/* Purpose Watermark & Attestation Modal */}
        <WatermarkAttestationModal
          doc={watermarkDoc}
          isOpen={Boolean(watermarkDoc)}
          onClose={() => setWatermarkDoc(null)}
          defaultCitizenName={user?.name || user?.email?.split('@')[0] || ''}
        />

        {/* Secure Backup & Restore Modal */}
        <VaultBackupRestoreModal
          isOpen={isBackupModalOpen}
          onClose={() => setIsBackupModalOpen(false)}
          onVaultUpdated={refreshVault}
          onAuthorizeAction={authorizeSensitiveAction}
        />

        {/* Encryption & Session Security Modal */}
        <VaultSecurityControlsModal
          isOpen={isSecurityModalOpen}
          onClose={() => setIsSecurityModalOpen(false)}
          userId={user?.id || 'local-citizen'}
          currentSessionId={vaultSessionId}
          stepUpActive={stepUpVerified}
          onCompleteStepUp={completeStepUpChallenge}
          onAuthorizeAction={authorizeSensitiveAction}
          onVaultUpdated={refreshVault}
        />

        {/* Inactivity Privacy Lock Modal */}
        <InactivityLockModal
          isOpen={showInactivityWarning}
          secondsRemaining={warningSeconds}
          onExtend={() => {
            setShowInactivityWarning(false);
            resetInactivityTracker();
          }}
          onLockNow={() => {
            setShowInactivityWarning(false);
            engagePrivacyLock();
          }}
        />

        {/* Service Mapping / Tagging Modal */}
        <ServiceTaggingModal
          isOpen={Boolean(taggingDoc)}
          onClose={() => setTaggingDoc(null)}
          document={taggingDoc}
          onUpdated={refreshVault}
        />

        {/* Consent-Based Document Quality & OCR Inspector Modal */}
        <DocumentQualityOcrInspectorModal
          isOpen={isOcrInspectorOpen}
          onClose={() => setIsOcrInspectorOpen(false)}
          documents={documents}
        />

        {/* Document Renewal Digest & Expiry Alerts Modal */}
        <DocumentRenewalDigestModal
          isOpen={isRenewalDigestOpen}
          onClose={() => setIsRenewalDigestOpen(false)}
          documents={documents}
          onUpdated={refreshVault}
        />
      </div>
    </div>
  );
};

export default Vault;