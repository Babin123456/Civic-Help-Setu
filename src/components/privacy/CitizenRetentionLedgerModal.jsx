import { useState, useId } from 'react';
import {
  Shield,
  Trash2,
  FileCheck,
  Lock,
  Unlock,
  AlertTriangle,
  Download,
  Info,
  CheckCircle,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import {
  CIVIC_PURPOSE_REGISTRY,
  getPurposeLedger,
  getLegalHolds,
  isLegalHoldActive,
  applyLegalHold,
  releaseLegalHold,
  inspectPurposeRecordCount,
  generateAccessReceipt,
  executePurposeRetentionAction,
  evaluateAndEnforcePurposeRetention,
  verifyReceiptIntegrity,
  getStoredReceipts,
} from '../../services/citizenRetentionPurposeLedgerService';

export default function CitizenRetentionLedgerModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('ledger'); // 'ledger' | 'receipts' | 'holds'
  const [ledgerEntries, setLedgerEntries] = useState(() => getPurposeLedger());
  const [legalHolds, setLegalHolds] = useState(() => getLegalHolds());
  const [receipts, setReceipts] = useState(() => getStoredReceipts());
  const [feedback, setFeedback] = useState(null);

  const titleId = useId();
  const descId = useId();

  if (!isOpen) return null;

  const refreshState = () => {
    setLedgerEntries(getPurposeLedger());
    setLegalHolds(getLegalHolds());
    setReceipts(getStoredReceipts());
  };

  const handleDownloadReceipt = (receipt) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(receipt, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${receipt.receiptId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handlePurge = (purposeId) => {
    try {
      const receipt = executePurposeRetentionAction(purposeId, { actor: 'citizen_modal_ui' });
      refreshState();
      setFeedback({
        type: 'success',
        message: `Purged data for ${CIVIC_PURPOSE_REGISTRY[purposeId]?.title}. Deletion receipt generated (${receipt.receiptId}).`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message,
      });
    }
  };

  const handleGenerateAccessReceipt = (purposeId) => {
    try {
      const receipt = generateAccessReceipt(purposeId);
      refreshState();
      setFeedback({
        type: 'success',
        message: `Cryptographic access receipt generated: ${receipt.receiptId}`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message,
      });
    }
  };

  const handleToggleHold = (purposeId) => {
    if (isLegalHoldActive(purposeId)) {
      const hold = legalHolds.find((h) => h.purposeId === purposeId && h.active);
      if (hold) releaseLegalHold(hold.holdId);
      setFeedback({ type: 'info', message: 'Legal hold released.' });
    } else {
      applyLegalHold({
        purposeId,
        statutoryReference: 'Citizen Dispute Review & Grievance Protection',
        reason: 'Statutory freeze applied per user dispute notice',
      });
      setFeedback({ type: 'info', message: 'Legal hold applied. Data protected from automated erasure.' });
    }
    refreshState();
  };

  const handleEnforceAllExpired = () => {
    const res = evaluateAndEnforcePurposeRetention();
    refreshState();
    setFeedback({
      type: 'info',
      message: `Enforced retention: evaluated ${res.evaluatedCount} scopes, purged ${res.purgedPurposes.length} expired scope(s), protected ${res.heldPurposes.length} under hold.`,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          width: '100%',
          maxWidth: '56rem',
          backgroundColor: 'var(--card-bg, #18181b)',
          border: '1px solid var(--border-light, #27272a)',
          borderRadius: '1rem',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          color: 'var(--text-primary, #f4f4f5)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-light, #27272a)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Shield size={20} className="text-cyan-400" style={{ color: '#22d3ee' }} />
              <h2 id={titleId} style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                Citizen Data Retention &amp; Purpose Ledger
              </h2>
            </div>
            <p id={descId} style={{ fontSize: '0.85rem', color: '#a1a1aa', margin: 0 }}>
              Verify why data is held, inspect statutory expiry dates, and enforce cryptographic deletion receipts.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close retention ledger modal"
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '0.5rem',
              backgroundColor: '#27272a',
              border: 'none',
              color: '#f4f4f5',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Controls */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            borderBottom: '1px solid var(--border-light, #27272a)',
            backgroundColor: 'rgba(24, 24, 27, 0.5)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '99px',
              border: 'none',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: activeTab === 'ledger' ? '#0284c7' : 'transparent',
              color: activeTab === 'ledger' ? '#ffffff' : '#a1a1aa',
            }}
          >
            Active Purposes ({ledgerEntries.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('receipts')}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '99px',
              border: 'none',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: activeTab === 'receipts' ? '#0284c7' : 'transparent',
              color: activeTab === 'receipts' ? '#ffffff' : '#a1a1aa',
            }}
          >
            Cryptographic Receipts ({receipts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('holds')}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '99px',
              border: 'none',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              backgroundColor: activeTab === 'holds' ? '#0284c7' : 'transparent',
              color: activeTab === 'holds' ? '#ffffff' : '#a1a1aa',
            }}
          >
            Legal Holds ({legalHolds.filter((h) => h.active).length})
          </button>
          <button
            type="button"
            onClick={handleEnforceAllExpired}
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '0.5rem',
              backgroundColor: '#1e293b',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={14} />
            <span>Enforce All Expired Now</span>
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            style={{
              margin: '0.75rem 1.5rem 0',
              padding: '0.65rem 1rem',
              borderRadius: '0.5rem',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor:
                feedback.type === 'error'
                  ? 'rgba(239, 68, 68, 0.15)'
                  : feedback.type === 'success'
                    ? 'rgba(34, 197, 94, 0.15)'
                    : 'rgba(56, 189, 248, 0.15)',
              border: `1px solid ${
                feedback.type === 'error' ? '#ef4444' : feedback.type === 'success' ? '#22c55e' : '#38bdf8'
              }`,
              color: feedback.type === 'error' ? '#fca5a5' : feedback.type === 'success' ? '#86efac' : '#7dd3fc',
            }}
          >
            {feedback.type === 'error' ? (
              <AlertTriangle size={16} />
            ) : feedback.type === 'success' ? (
              <CheckCircle size={16} />
            ) : (
              <Info size={16} />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Tab Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem' }}>
          {activeTab === 'ledger' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {ledgerEntries.map((entry) => {
                const isHeld = isLegalHoldActive(entry.purposeId);
                const recordCount = inspectPurposeRecordCount(entry.purposeId);
                const expiryDate = new Date(entry.expiresAt).toLocaleDateString();
                const backupExpiry = new Date(entry.backupExpiresAt).toLocaleDateString();

                return (
                  <div
                    key={entry.purposeId}
                    style={{
                      padding: '1rem',
                      borderRadius: '0.75rem',
                      backgroundColor: '#27272a',
                      border: isHeld ? '1px solid #f59e0b' : '1px solid #3f3f46',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '1rem' }}>{entry.title}</span>
                          {isHeld && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '99px',
                                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                                color: '#fbbf24',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                              }}
                            >
                              <Lock size={12} /> Statutory Legal Hold
                            </span>
                          )}
                          <span
                            style={{
                              padding: '0.15rem 0.45rem',
                              borderRadius: '99px',
                              backgroundColor: recordCount > 0 ? 'rgba(56, 189, 248, 0.2)' : 'rgba(113, 113, 122, 0.2)',
                              color: recordCount > 0 ? '#38bdf8' : '#a1a1aa',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                            }}
                          >
                            {recordCount} record(s)
                          </span>
                        </div>
                        <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: '#d4d4d8' }}>
                          {entry.description}
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => handleGenerateAccessReceipt(entry.purposeId)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.4rem 0.75rem',
                            borderRadius: '0.375rem',
                            backgroundColor: '#3f3f46',
                            color: '#f4f4f5',
                            border: 'none',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <FileCheck size={14} />
                          <span>Access Receipt</span>
                        </button>
                        <button
                          type="button"
                          disabled={isHeld}
                          onClick={() => handlePurge(entry.purposeId)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.4rem 0.75rem',
                            borderRadius: '0.375rem',
                            backgroundColor: isHeld ? '#52525b' : '#dc2626',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: isHeld ? 'not-allowed' : 'pointer',
                            opacity: isHeld ? 0.6 : 1,
                          }}
                        >
                          <Trash2 size={14} />
                          <span>Purge Purpose Data</span>
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '0.5rem',
                        fontSize: '0.75rem',
                        color: '#a1a1aa',
                        backgroundColor: '#18181b',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '0.5rem',
                      }}
                    >
                      <div>
                        <strong style={{ color: '#e4e4e7' }}>Lawful Basis:</strong> {entry.lawfulBasis}
                      </div>
                      <div>
                        <strong style={{ color: '#e4e4e7' }}>Retention TTL:</strong> {entry.retentionDays} days (Expires: {expiryDate})
                      </div>
                      <div>
                        <strong style={{ color: '#e4e4e7' }}>Backup Purge:</strong> +{entry.backupRetentionDays} days (Purged: {backupExpiry})
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'receipts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {receipts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#a1a1aa' }}>
                  <FileCheck size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                  <p>No receipts issued yet. Generate an Access Receipt or execute a Purge to generate one.</p>
                </div>
              ) : (
                receipts.map((rcpt) => {
                  const check = verifyReceiptIntegrity(rcpt);
                  return (
                    <div
                      key={rcpt.receiptId}
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '0.5rem',
                        backgroundColor: '#27272a',
                        border: '1px solid #3f3f46',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{rcpt.receiptId}</span>
                          <span
                            style={{
                              padding: '0.15rem 0.45rem',
                              borderRadius: '99px',
                              backgroundColor: rcpt.receiptType === 'DELETION_RECEIPT' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                              color: rcpt.receiptType === 'DELETION_RECEIPT' ? '#fca5a5' : '#38bdf8',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                            }}
                          >
                            {rcpt.receiptType}
                          </span>
                          {check.valid ? (
                            <span style={{ color: '#22c55e', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                              <CheckCircle size={12} /> SHA-256 Verified
                            </span>
                          ) : (
                            <span style={{ color: '#ef4444', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                              <XCircle size={12} /> Corrupted
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '0.25rem' }}>
                          Scope: <strong>{rcpt.purposeTitle || rcpt.purposeId}</strong> &bull; Records: {rcpt.recordCount} &bull; Timestamp: {new Date(rcpt.timestamp).toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#71717a', fontFamily: 'monospace', marginTop: '0.2rem' }}>
                          Digest: {rcpt.integrityDigest}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDownloadReceipt(rcpt)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.35rem 0.65rem',
                          borderRadius: '0.375rem',
                          backgroundColor: '#3f3f46',
                          color: '#f4f4f5',
                          border: 'none',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <Download size={13} />
                        <span>Download JSON</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'holds' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#a1a1aa', margin: 0 }}>
                Legal holds freeze data from automated purge routines during active grievance inquiries or statutory reviews.
              </p>
              {Object.values(CIVIC_PURPOSE_REGISTRY).map((purpose) => {
                const isHeld = isLegalHoldActive(purpose.purposeId);
                return (
                  <div
                    key={purpose.purposeId}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                      backgroundColor: '#27272a',
                      border: isHeld ? '1px solid #f59e0b' : '1px solid #3f3f46',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{purpose.title}</div>
                      <div style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>
                        Status: {isHeld ? '🔒 Under active statutory hold' : '🔓 Normal automated retention lifecycle'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleHold(purpose.purposeId)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        padding: '0.4rem 0.75rem',
                        borderRadius: '0.375rem',
                        backgroundColor: isHeld ? '#f59e0b' : '#3f3f46',
                        color: isHeld ? '#000000' : '#ffffff',
                        border: 'none',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {isHeld ? <Unlock size={14} /> : <Lock size={14} />}
                      <span>{isHeld ? 'Release Hold' : 'Apply Legal Hold'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
