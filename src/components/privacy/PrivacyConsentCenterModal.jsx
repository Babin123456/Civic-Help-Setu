import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  Download,
  FileText,
  Trash2,
  Lock,
  CheckCircle2,
  AlertTriangle,
  X,
  Info,
  RefreshCw,
} from 'lucide-react';
import {
  CONSENT_CATEGORIES,
  getConsentPreferences,
  updateConsentPreference,
  revokeConsentAndPurge,
  getRetentionPolicyStatus,
  enforceRetentionPolicies,
  exportUserData,
  purgeAllUserData,
  getPrivacyAuditLogs,
  verifyPrivacyAuditLogIntegrity,
  verifyExportedDataIntegrity,
} from '../../services/privacyConsentService.js';
import { useToast } from '../../context/ToastContext';

/**
 * PrivacyConsentCenterModal Component (#80, #696)
 * Comprehensive privacy dashboard for managing consent preferences,
 * DPDP retention/revocation enforcement, tamper-evident audit verification,
 * signed data exports, and account purges.
 */
const PrivacyConsentCenterModalBody = ({
  onClose,
  onPrivacyDataChanged = () => {},
}) => {
  const { toast } = useToast?.() || {};
  let navigate = () => {};
  try {
    navigate = useNavigate();
  } catch {
    // Non-router / test fallback
  }
  let user = null;
  try {
    const auth = useAuth?.();
    user = auth?.user;
  } catch {
    // Non-auth-provider fallback
  }

  const [preferences, setPreferences] = useState(() => getConsentPreferences());
  const [auditLogs, setAuditLogs] = useState(() => getPrivacyAuditLogs());
  const [retentionStatus, setRetentionStatus] = useState(() => getRetentionPolicyStatus());
  const [activeTab, setActiveTab] = useState('consents'); // 'consents' | 'export_delete' | 'audit'
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmPurgeText, setConfirmPurgeText] = useState('');
  const [lastExportDigest, setLastExportDigest] = useState(null);
  const [verifyInput, setVerifyInput] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);

  const auditIntegrity = verifyPrivacyAuditLogIntegrity(auditLogs);

  const refreshModalState = () => {
    setPreferences(getConsentPreferences());
    setAuditLogs(getPrivacyAuditLogs());
    setRetentionStatus(getRetentionPolicyStatus());
    onPrivacyDataChanged();
  };

  // Handle consent toggle with revocation purge for non-essential categories
  const handleToggleConsent = (categoryId, currentValue, mandatory) => {
    if (mandatory) return;

    try {
      const nextGranted = !currentValue;
      const categoryTitle = CONSENT_CATEGORIES[categoryId]?.title || categoryId;

      if (nextGranted) {
        updateConsentPreference(categoryId, true);
        toast?.success?.(`${categoryTitle}: Consent granted.`);
      } else {
        const purgeRes = revokeConsentAndPurge(categoryId);
        const purgeNote =
          purgeRes.purgedCount > 0
            ? ` ${purgeRes.purgedCount} dependent local store(s) purged.`
            : '';
        toast?.success?.(`${categoryTitle}: Consent revoked.${purgeNote}`);
      }
      refreshModalState();
    } catch (err) {
      toast?.error?.(err.message);
    }
  };

  // Enforce retentionDays TTL & clean leftover revoked stores
  const handleEnforceRetention = () => {
    try {
      const res = enforceRetentionPolicies({ actorId: 'citizen_user' });
      refreshModalState();
      if (res.actionTaken) {
        toast?.success?.(
          `Retention enforced: ${res.purgedKeysCount} expired store(s) removed and ${res.prunedRecordsCount} stale record(s) pruned.`
        );
      } else {
        toast?.info?.('All non-essential data is within configured retention limits.');
      }
    } catch (err) {
      toast?.error?.(`Retention enforcement failed: ${err.message}`);
    }
  };

  // Handle signed data export download
  const handleExportData = () => {
    try {
      const data = exportUserData();
      setLastExportDigest(data?.exportMetadata?.integrityDigest || null);
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(data, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute(
        'download',
        `civicbridge_user_data_export_${new Date().toISOString().slice(0, 10)}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      refreshModalState();
      toast?.success?.('Your SHA-256 sealed personal data dossier has been exported.');
    } catch (err) {
      toast?.error?.(`Export failed: ${err.message}`);
    }
  };

  const evaluateExportText = (rawJson) => {
    if (!rawJson || !rawJson.trim()) {
      setVerifyResult({ valid: false, reason: 'EMPTY_INPUT' });
      return;
    }
    try {
      const parsed = JSON.parse(rawJson);
      setVerifyResult(verifyExportedDataIntegrity(parsed));
    } catch {
      setVerifyResult({ valid: false, reason: 'INVALID_JSON' });
    }
  };

  const handleVerifyFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      setVerifyInput(content);
      evaluateExportText(content);
    };
    reader.readAsText(file);
  };

  // Handle full account deletion
  const handleExecutePurge = () => {
    if (confirmPurgeText.trim().toLowerCase() !== 'delete my data') {
      toast?.error?.('Please type "DELETE MY DATA" exactly to confirm.');
      return;
    }

    try {
      purgeAllUserData(user?.id || 'anonymous', { preserveAuditTrail: true });
      setIsDeleting(false);
      setConfirmPurgeText('');
      refreshModalState();
      toast?.info?.('All your local records, vault items, and applications have been permanently purged.');
      onClose();
    } catch (err) {
      toast?.error?.(`Purge failed: ${err.message}`);
    }
  };

  return (
    <div
      className="privacy-modal-overlay animate-fade-in"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="privacy-modal-container"
        style={{
          background: 'var(--bg-main, #0a0a0a)',
          color: 'var(--text-primary, #ffffff)',
          border: '1px solid var(--border-main, rgba(255, 255, 255, 0.15))',
          borderRadius: '1.25rem',
          maxWidth: '860px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '0.6rem',
                background: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-main, #38bdf8)',
              }}
            >
              <Shield size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800' }}>
                Privacy & Consent Management Center
              </h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
                Granular consent enforcement, auditable controls, and DPDP-compliant data operations
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Privacy Center"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary, #94a3b8)',
              cursor: 'pointer',
              padding: '0.25rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '0 1.5rem',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('consents')}
            style={{
              padding: '0.85rem 1.25rem',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${activeTab === 'consents' ? 'var(--accent-main, #38bdf8)' : 'transparent'}`,
              color: activeTab === 'consents' ? 'var(--accent-main, #38bdf8)' : 'var(--text-secondary, #94a3b8)',
              fontWeight: activeTab === 'consents' ? '700' : '500',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Consent Preferences
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('export_delete')}
            style={{
              padding: '0.85rem 1.25rem',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${activeTab === 'export_delete' ? 'var(--accent-main, #38bdf8)' : 'transparent'}`,
              color: activeTab === 'export_delete' ? 'var(--accent-main, #38bdf8)' : 'var(--text-secondary, #94a3b8)',
              fontWeight: activeTab === 'export_delete' ? '700' : '500',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Data Export & Account Purge
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            style={{
              padding: '0.85rem 1.25rem',
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${activeTab === 'audit' ? 'var(--accent-main, #38bdf8)' : 'transparent'}`,
              color: activeTab === 'audit' ? 'var(--accent-main, #38bdf8)' : 'var(--text-secondary, #94a3b8)',
              fontWeight: activeTab === 'audit' ? '700' : '500',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Security Audit Log ({auditLogs.length})
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* TAB 1: Consents */}
          {activeTab === 'consents' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  fontSize: '0.8rem',
                  color: 'var(--accent-main, #38bdf8)',
                }}
              >
                <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  Civic-Help-Setu enforces strict data minimization. Revoking an optional category immediately purges its non-essential local stores, and expired records are cleaned up against configured retention windows.
                </span>
              </div>

              {/* Retention Policy Enforcement Bar */}
              <div
                role="status"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  padding: '0.8rem 1rem',
                  borderRadius: '0.75rem',
                  border: retentionStatus.actionRequired
                    ? '1px solid rgba(245, 158, 11, 0.4)'
                    : '1px solid rgba(16, 185, 129, 0.3)',
                  background: retentionStatus.actionRequired
                    ? 'rgba(245, 158, 11, 0.08)'
                    : 'rgba(16, 185, 129, 0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}>
                  {retentionStatus.actionRequired ? (
                    <AlertTriangle size={16} color="#fbbf24" />
                  ) : (
                    <CheckCircle2 size={16} color="#34d399" />
                  )}
                  <span>
                    {retentionStatus.actionRequired
                      ? `Retention Check: ${retentionStatus.totalExpiredKeys} expired and ${retentionStatus.totalLeftoverRevokedKeys} revoked store(s) awaiting cleanup.`
                      : 'Retention Check: All optional local stores are within configured TTL limits.'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleEnforceRetention}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.4rem 0.8rem',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-light, rgba(255, 255, 255, 0.2))',
                    background: 'rgba(255, 255, 255, 0.06)',
                    color: 'var(--text-primary, #ffffff)',
                    fontSize: '0.78rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={13} />
                  <span>Enforce Retention Policies Now</span>
                </button>
              </div>

              {Object.values(CONSENT_CATEGORIES).map((category) => {
                const isGranted = !!preferences[category.id];
                const catRetention = retentionStatus.categories?.find(
                  (c) => c.categoryId === category.id
                );

                return (
                  <div
                    key={category.id}
                    style={{
                      padding: '1rem',
                      borderRadius: '0.75rem',
                      border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
                      background: 'rgba(255, 255, 255, 0.02)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1rem',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700' }}>
                          {category.title}
                        </h4>
                        {category.mandatory && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: '800',
                              padding: '0.1rem 0.4rem',
                              borderRadius: '0.25rem',
                              background: 'rgba(255, 255, 255, 0.1)',
                              color: 'var(--text-secondary, #94a3b8)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                            }}
                          >
                            <Lock size={10} /> Mandatory
                          </span>
                        )}
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted, #94a3b8)' }}>
                          &bull; Max Retention: {category.retentionDays} days
                        </span>
                        {catRetention && !category.mandatory && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: '700',
                              padding: '0.1rem 0.45rem',
                              borderRadius: '99px',
                              background:
                                catRetention.status === 'EXPIRED' || catRetention.status === 'REVOKED_WITH_LEFTOVER'
                                  ? 'rgba(245, 158, 11, 0.15)'
                                  : 'rgba(56, 189, 248, 0.12)',
                              color:
                                catRetention.status === 'EXPIRED' || catRetention.status === 'REVOKED_WITH_LEFTOVER'
                                  ? '#fbbf24'
                                  : 'var(--accent-main, #38bdf8)',
                            }}
                          >
                            {catRetention.status === 'EXPIRED'
                              ? `${catRetention.expiredKeyCount} expired store(s)`
                              : catRetention.status === 'REVOKED_WITH_LEFTOVER'
                                ? `${catRetention.leftoverKeys.length} leftover store(s)`
                                : catRetention.status === 'ACTIVE'
                                  ? `${catRetention.storedKeyCount} active store(s)`
                                  : 'No local data'}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: '1.4' }}>
                        {category.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={category.mandatory}
                      onClick={() => handleToggleConsent(category.id, isGranted, category.mandatory)}
                      style={{
                        padding: '0.4rem 0.85rem',
                        borderRadius: '0.5rem',
                        border: isGranted
                          ? '1px solid #4ade80'
                          : '1px solid rgba(255, 255, 255, 0.2)',
                        background: isGranted ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                        color: isGranted ? '#4ade80' : 'var(--text-secondary, #94a3b8)',
                        fontWeight: '700',
                        fontSize: '0.8rem',
                        cursor: category.mandatory ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {category.mandatory ? 'Enforced' : isGranted ? 'Granted (Opt-In)' : 'Revoked (Opt-Out)'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: Export & Delete */}
          {activeTab === 'export_delete' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Data Export Section */}
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: '0.875rem',
                  border: '1px solid var(--border-light, rgba(255, 255, 255, 0.12))',
                  background: 'rgba(255, 255, 255, 0.03)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <Download size={18} color="var(--accent-main, #38bdf8)" />
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800' }}>
                    Create a Secure Personal Data Export
                  </h3>
                </div>
                <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: '1.5' }}>
                  Preview account-owned categories in the Privacy Centre. Recent authentication is required; the secure download link is account-bound, short-lived and single-use.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate('/privacy#privacy-centre');
                  }}
                  className="btn btn-primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.55rem 1.25rem',
                    fontSize: '0.875rem',
                    fontWeight: '700',
                  }}
                >
                  <Download size={15} />
                  <span>Export SHA-256 Sealed Dossier</span>
                </button>

                {lastExportDigest && (
                  <div
                    role="status"
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '0.5rem',
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      fontSize: '0.75rem',
                      color: '#34d399',
                      wordBreak: 'break-all',
                    }}
                  >
                    <strong>Latest Export SHA-256 Digest:</strong> {lastExportDigest}
                  </div>
                )}

                {/* Verify Exported JSON Integrity */}
                <div
                  style={{
                    marginTop: '1.15rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: '700' }}>
                    <FileText size={15} color="var(--accent-main, #38bdf8)" />
                    <span>Verify Export Dossier Integrity (SHA-256)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <input
                      type="file"
                      accept=".json,application/json"
                      aria-label="Upload exported JSON dossier to verify integrity"
                      onChange={handleVerifyFileChange}
                      style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #cbd5e1)' }}
                    />
                  </div>
                  <textarea
                    rows={3}
                    aria-label="Paste exported JSON dossier"
                    placeholder="Or paste exported Civic-Help-Setu JSON dossier here to check for modifications..."
                    value={verifyInput}
                    onChange={(e) => setVerifyInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '0.5rem',
                      background: 'rgba(0, 0, 0, 0.35)',
                      border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
                      color: 'var(--text-primary, #ffffff)',
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                    }}
                  />
                  <div>
                    <button
                      type="button"
                      onClick={() => evaluateExportText(verifyInput)}
                      style={{
                        padding: '0.4rem 0.85rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-light, rgba(255, 255, 255, 0.2))',
                        background: 'rgba(255, 255, 255, 0.08)',
                        color: 'var(--text-primary, #ffffff)',
                        fontSize: '0.78rem',
                        fontWeight: '700',
                        cursor: 'pointer',
                      }}
                    >
                      Verify Dossier Digest
                    </button>
                  </div>
                  {verifyResult && (
                    <div
                      role="status"
                      style={{
                        padding: '0.55rem 0.75rem',
                        borderRadius: '0.5rem',
                        fontSize: '0.78rem',
                        border: verifyResult.valid
                          ? '1px solid rgba(16, 185, 129, 0.35)'
                          : '1px solid rgba(239, 68, 68, 0.4)',
                        background: verifyResult.valid
                          ? 'rgba(16, 185, 129, 0.08)'
                          : 'rgba(239, 68, 68, 0.08)',
                        color: verifyResult.valid ? '#34d399' : '#fca5a5',
                      }}
                    >
                      {verifyResult.valid
                        ? `Integrity Verified (${verifyResult.algorithm}): File matches canonical digest.`
                        : `Verification Failed (${verifyResult.reason}): Dossier is unsigned or has been modified.`}
                    </div>
                  )}
                </div>
              </div>

              {/* Danger Zone: Account Purge */}
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: '0.875rem',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  background: 'rgba(239, 68, 68, 0.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <Trash2 size={18} color="#f87171" />
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: '#f87171' }}>
                    Danger Zone: Irreversible Account Data Purge
                  </h3>
                </div>
                <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: '1.5' }}>
                  Permanently deletes all records across the digital vault, active application trackers, saved guides, offline cache, and conversational memory on this browser. This action cannot be reversed.
                </p>

                {!isDeleting ? (
                  <button
                    type="button"
                    onClick={() => setIsDeleting(true)}
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid #ef4444',
                      color: '#f87171',
                      padding: '0.55rem 1.25rem',
                      borderRadius: '0.5rem',
                      fontWeight: '700',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <Trash2 size={15} />
                    <span>Initiate Full Account Purge</span>
                  </button>
                ) : (
                  <div
                    style={{
                      padding: '1rem',
                      borderRadius: '0.5rem',
                      background: 'rgba(0, 0, 0, 0.4)',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '0.825rem', color: '#fca5a5', fontWeight: '600' }}>
                      To confirm deletion, type <strong>DELETE MY DATA</strong> below:
                    </p>
                    <input
                      type="text"
                      placeholder="DELETE MY DATA"
                      value={confirmPurgeText}
                      onChange={(e) => setConfirmPurgeText(e.target.value)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.375rem',
                        background: 'rgba(0, 0, 0, 0.5)',
                        border: '1px solid rgba(239, 68, 68, 0.5)',
                        color: '#ffffff',
                        fontSize: '0.875rem',
                        width: '100%',
                        maxWidth: '300px',
                      }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={handleExecutePurge}
                        style={{
                          background: '#dc2626',
                          color: '#ffffff',
                          border: 'none',
                          padding: '0.5rem 1rem',
                          borderRadius: '0.375rem',
                          fontWeight: '700',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                        }}
                      >
                        Confirm & Delete Everything
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsDeleting(false);
                          setConfirmPurgeText('');
                        }}
                        style={{
                          background: 'rgba(255, 255, 255, 0.1)',
                          color: '#ffffff',
                          border: 'none',
                          padding: '0.5rem 1rem',
                          borderRadius: '0.375rem',
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Audit Log */}
          {activeTab === 'audit' && (
            <div>
              <div
                role="status"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '0.5rem',
                  marginBottom: '0.85rem',
                  border: auditIntegrity.valid
                    ? '1px solid rgba(16, 185, 129, 0.35)'
                    : '1px solid rgba(239, 68, 68, 0.45)',
                  background: auditIntegrity.valid
                    ? 'rgba(16, 185, 129, 0.08)'
                    : 'rgba(239, 68, 68, 0.1)',
                  color: auditIntegrity.valid ? '#34d399' : '#fca5a5',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                }}
              >
                {auditIntegrity.valid ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <AlertTriangle size={16} />
                )}
                <span>
                  {auditIntegrity.status === 'EMPTY'
                    ? 'Audit Chain Status: No audit events recorded yet.'
                    : auditIntegrity.status === 'LEGACY_UNCHAINED'
                      ? `Audit Chain Status: ${auditIntegrity.legacyEntries} legacy unchained entry(ies).`
                      : auditIntegrity.valid
                        ? `SHA-256 Hash Chain Verified (${auditIntegrity.verifiedEntries} chained entry(ies) intact)`
                        : `Tamper Alert (${auditIntegrity.issues?.[0]?.reason || 'CHAIN_ERROR'}): Audit integrity failed at ${auditIntegrity.tamperedIndices.length} entry(ies).`}
                </span>
              </div>

              <p style={{ margin: '0 0 0.75rem', fontSize: '0.825rem', color: 'var(--text-secondary, #94a3b8)' }}>
                Hash-chained security event log tracking authorization checks, retention enforcement, and consent changes. Credentials and document contents are strictly redacted.
              </p>

              {auditLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted, #94a3b8)', fontSize: '0.875rem' }}>
                  No security events recorded yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {auditLogs.slice(0, 25).map((log, index) => {
                    const isTampered = auditIntegrity.tamperedIndices.includes(index);
                    return (
                      <div
                        key={log.id}
                        style={{
                          padding: '0.625rem 0.875rem',
                          borderRadius: '0.5rem',
                          background: isTampered
                            ? 'rgba(239, 68, 68, 0.08)'
                            : 'rgba(255, 255, 255, 0.03)',
                          border: isTampered
                            ? '1px solid rgba(239, 68, 68, 0.45)'
                            : '1px solid var(--border-light, rgba(255, 255, 255, 0.08))',
                          fontSize: '0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: '700', color: isTampered ? '#fca5a5' : 'var(--accent-main, #38bdf8)' }}>
                              {log.action}
                            </span>
                            <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.75rem' }}>
                              Actor: {log.actorId}
                            </span>
                            {Number.isInteger(log.sequence) && log.entryHash && (
                              <span
                                title={log.entryHash}
                                style={{
                                  fontFamily: 'monospace',
                                  fontSize: '0.7rem',
                                  color: 'var(--text-secondary, #cbd5e1)',
                                  padding: '0.05rem 0.35rem',
                                  borderRadius: '0.25rem',
                                  background: 'rgba(255, 255, 255, 0.06)',
                                }}
                              >
                                #{log.sequence} &bull; {log.entryHash.slice(0, 10)}...
                              </span>
                            )}
                          </div>
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <div style={{ color: 'var(--text-secondary, #cbd5e1)', fontSize: '0.75rem', marginTop: '0.15rem' }}>
                              {JSON.stringify(log.metadata)}
                            </div>
                          )}
                        </div>

                        <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PrivacyConsentCenterModal = ({ isOpen, onClose, onPrivacyDataChanged = () => {} }) => {
  if (!isOpen) return null;
  return (
    <PrivacyConsentCenterModalBody
      onClose={onClose}
      onPrivacyDataChanged={onPrivacyDataChanged}
    />
  );
};

export default PrivacyConsentCenterModal;
