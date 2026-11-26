import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  FileText,
  Upload,
  Download,
  Plus,
  Trash2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Eye,
  FileCheck,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import {
  PROVENANCE_TIERS,
  PROVENANCE_TIER_LABELS,
  PROVENANCE_TIER_DESCRIPTIONS,
  EVIDENCE_SOURCE_TYPES,
  EVIDENCE_SOURCE_LABELS,
  INTEGRITY_STATUS,
  STATUTORY_EVIDENCE_DISCLAIMER,
  computeSha256Hex,
} from '../data/verifiableEvidenceBundleContract.js';

import {
  createNewBundle,
  listBundles,
  getBundle,
  deleteExistingBundle,
  addEvidenceEntry,
  verifyExistingBundle,
  exportBundleAsJson,
  exportBundleAsMarkdownDossier,
  importBundleArchive,
} from '../services/verifiableEvidenceBundleService.js';

export default function VerifiableEvidenceBundleWorkspace() {
  let user;
  try {
    const auth = useAuth();
    user = auth?.user;
  } catch {
    user = null;
  }
  const userId = user?.id || 'anonymous_local';

  // Domain State
  const [bundles, setBundles] = useState(() => {
    try {
      return listBundles(userId);
    } catch {
      return [];
    }
  });
  const [selectedBundleId, setSelectedBundleId] = useState(() => {
    try {
      const all = listBundles(userId);
      return all[0]?.bundleId || null;
    } catch {
      return null;
    }
  });
  const [verificationReport, setVerificationReport] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Modals & Panels
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddEntryModal, setShowAddEntryModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [copiedHash, setCopiedHash] = useState(null);
  const [announcement, setAnnouncement] = useState('');

  // Form States - Create Bundle
  const [newBundleTitle, setNewBundleTitle] = useState('');
  const [newBundleDept, setNewBundleDept] = useState('Municipal Administration');
  const [newBundleComplaintId, setNewBundleComplaintId] = useState('');
  const [newBundleRefNums, setNewBundleRefNums] = useState('');

  // Form States - Add Entry
  const [entryTitle, setEntryTitle] = useState('');
  const [entrySource, setEntrySource] = useState(EVIDENCE_SOURCE_TYPES.CITIZEN_PHOTO);
  const [entryProvenance, setEntryProvenance] = useState(PROVENANCE_TIERS.CITIZEN_ASSERTION);
  const [entryAnnotation, setEntryAnnotation] = useState('');
  const [entryFile, setEntryFile] = useState(null);
  const [entryFilePayload, setEntryFilePayload] = useState(null);
  const [entryFileHash, setEntryFileHash] = useState('');
  const [isHashingFile, setIsHashingFile] = useState(false);
  const [formError, setFormError] = useState('');

  // Form States - Import
  const [importJsonText, setImportJsonText] = useState('');
  const [importError, setImportError] = useState('');

  const fileInputRef = useRef(null);

  // Load bundles scoped to user
  const refreshBundles = useCallback(() => {
    try {
      const all = listBundles(userId);
      setBundles(all);
      if (all.length > 0 && !selectedBundleId) {
        setSelectedBundleId(all[0].bundleId);
      } else if (all.length === 0) {
        setSelectedBundleId(null);
      }
    } catch {
      setBundles([]);
    }
  }, [userId, selectedBundleId]);

  const activeBundle = useMemo(() => {
    if (!selectedBundleId) return null;
    return getBundle(selectedBundleId, userId) || bundles.find((b) => b.bundleId === selectedBundleId) || null;
  }, [selectedBundleId, userId, bundles]);

  // Run integrity verification on active bundle
  const runVerification = useCallback(async (bundleIdToVerify) => {
    const targetId = bundleIdToVerify || selectedBundleId;
    if (!targetId) return;

    setIsVerifying(true);
    try {
      const rep = await verifyExistingBundle(targetId, userId);
      setVerificationReport(rep);
      setAnnouncement(`Integrity verification complete: status is ${rep.status}`);
    } catch (err) {
      setVerificationReport({
        isValid: false,
        status: INTEGRITY_STATUS.TAMPERED,
        errors: [err.message],
        warnings: [],
      });
      setAnnouncement('Integrity verification failed.');
    } finally {
      setIsVerifying(false);
    }
  }, [selectedBundleId, userId]);

  useEffect(() => {
    let isMounted = true;
    if (selectedBundleId) {
      verifyExistingBundle(selectedBundleId, userId)
        .then((rep) => {
          if (isMounted) setVerificationReport(rep);
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [selectedBundleId, userId]);

  // Handle Create Bundle
  const handleCreateBundle = (e) => {
    e.preventDefault();
    if (!newBundleTitle.trim()) {
      setFormError('Complaint title is required.');
      return;
    }

    const refArray = newBundleRefNums
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const created = createNewBundle(
      {
        title: newBundleTitle.trim(),
        department: newBundleDept.trim(),
        id: newBundleComplaintId.trim() || undefined,
        officialReferenceNumbers: refArray,
      },
      userId
    );

    setNewBundleTitle('');
    setNewBundleRefNums('');
    setShowCreateModal(false);
    setFormError('');
    refreshBundles();
    setSelectedBundleId(created.bundleId);
    setAnnouncement(`Evidence bundle "${created.complaintTitle}" created.`);
  };

  // Handle File Selection with real-time SHA-256 calculation
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFormError('File exceeds maximum size limit of 5 MB.');
      return;
    }

    setEntryFile(file);
    setIsHashingFile(true);
    setFormError('');

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const resultString = reader.result;
        setEntryFilePayload(resultString);
        const hash = await computeSha256Hex(resultString);
        setEntryFileHash(hash);
        setIsHashingFile(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setFormError('Failed to read file.');
      setIsHashingFile(false);
    }
  };

  // Handle Add Evidence Entry
  const handleAddEntry = async (e) => {
    e.preventDefault();
    if (!entryTitle.trim()) {
      setFormError('Evidence entry title is required.');
      return;
    }
    if (!activeBundle) return;

    try {
      const entryData = {
        title: entryTitle.trim(),
        source: entrySource,
        provenanceTier: entryProvenance,
        userAnnotation: entryAnnotation.trim(),
        attachment: entryFile
          ? {
              fileName: entryFile.name,
              mimeType: entryFile.type,
              byteSize: entryFile.size,
              sha256: entryFileHash,
            }
          : null,
      };

      await addEvidenceEntry(activeBundle.bundleId, entryData, userId, entryFilePayload);

      // Reset form
      setEntryTitle('');
      setEntryAnnotation('');
      setEntryFile(null);
      setEntryFilePayload(null);
      setEntryFileHash('');
      setShowAddEntryModal(false);
      setFormError('');

      refreshBundles();
      await runVerification(activeBundle.bundleId);
      setAnnouncement(`Entry "${entryData.title}" appended to cryptographic ledger.`);
    } catch (err) {
      setFormError(err.message || 'Failed to append entry.');
    }
  };

  // Handle Delete Bundle
  const handleDeleteBundle = (bundleId) => {
    if (!window.confirm('Are you sure you want to delete this evidence bundle and all local files?')) {
      return;
    }

    deleteExistingBundle(bundleId, userId);
    refreshBundles();
    setAnnouncement('Evidence bundle deleted.');
  };

  // Handle Export JSON
  const handleExportJson = () => {
    if (!activeBundle) return;
    const { jsonString, fileName } = exportBundleAsJson(activeBundle.bundleId, userId, true);

    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    setAnnouncement(`Exported JSON archive ${fileName}.`);
  };

  // Handle Export Markdown Dossier
  const handleExportMarkdown = () => {
    if (!activeBundle) return;
    const md = exportBundleAsMarkdownDossier(activeBundle.bundleId, userId);

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `complaint-dossier-${activeBundle.bundleId}.md`;
    link.click();
    URL.revokeObjectURL(url);
    setAnnouncement('Exported complaint dossier as Markdown.');
  };

  // Handle Import
  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!importJsonText.trim()) {
      setImportError('Please paste bundle JSON content.');
      return;
    }

    try {
      const res = await importBundleArchive(importJsonText.trim(), userId);
      if (res.success && res.bundle) {
        setImportJsonText('');
        setShowImportModal(false);
        setImportError('');
        refreshBundles();
        setSelectedBundleId(res.bundle.bundleId);
        setAnnouncement('Bundle archive imported and verified successfully.');
      } else {
        setImportError(`Verification Failed: ${res.verification.errors.join('; ')}`);
      }
    } catch (err) {
      setImportError(`Import error: ${err.message}`);
    }
  };

  const copyToClipboard = (text, key) => {
    navigator.clipboard?.writeText(text);
    setCopiedHash(key);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  return (
    <div className="section" style={{ padding: '1.5rem 1rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Screen Reader Live Announcement */}
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      {/* Hero Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Shield style={{ width: '2rem', height: '2rem', color: 'var(--primary, #2563eb)' }} aria-hidden="true" />
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>
            Verifiable Evidence Bundles for Civic Complaints
          </h1>
        </div>
        <p style={{ color: 'var(--text-secondary, #64748b)', fontSize: '0.95rem', margin: '0 0 1rem 0' }}>
          Organize photos, receipts, and correspondence into an append-only, cryptographically verifiable ledger.
          Distinguish your personal observations from independently verified government receipts to prevent evidence tampering.
        </p>

        {/* Legal Disclaimer Box */}
        <div
          role="note"
          aria-label="Statutory Evidence Disclaimer"
          style={{
            padding: '0.85rem 1rem',
            borderRadius: '0.5rem',
            background: 'rgba(234, 179, 8, 0.1)',
            border: '1px solid rgba(234, 179, 8, 0.4)',
            color: 'var(--text-primary)',
            fontSize: '0.82rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.6rem',
          }}
        >
          <AlertTriangle style={{ width: '1.2rem', height: '1.2rem', color: '#d97706', flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
          <div>
            <strong>Legal & Verification Notice:</strong> {STATUTORY_EVIDENCE_DISCLAIMER}
          </div>
        </div>
      </div>

      {/* Primary Toolbar */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <button
          type="button"
          onClick={() => { setShowCreateModal(true); setFormError(''); }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.6rem 1rem',
            borderRadius: '0.375rem',
            background: 'var(--primary, #2563eb)',
            color: '#fff',
            border: 'none',
            fontWeight: 600,
            fontSize: '0.88rem',
            cursor: 'pointer',
          }}
        >
          <Plus size={16} aria-hidden="true" /> New Evidence Bundle
        </button>

        <button
          type="button"
          onClick={() => { setShowImportModal(true); setImportError(''); }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.6rem 1rem',
            borderRadius: '0.375rem',
            background: 'var(--bg-card, #f8fafc)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-light, #cbd5e1)',
            fontWeight: 600,
            fontSize: '0.88rem',
            cursor: 'pointer',
          }}
        >
          <Upload size={16} aria-hidden="true" /> Import Bundle Archive
        </button>
      </div>

      {/* Main Content Layout */}
      {bundles.length === 0 ? (
        <div
          style={{
            padding: '3rem 1.5rem',
            textAlign: 'center',
            background: 'var(--bg-card, #fff)',
            borderRadius: '0.75rem',
            border: '1px dashed var(--border-light, #cbd5e1)',
          }}
        >
          <FileCheck style={{ width: '3rem', height: '3rem', color: 'var(--text-tertiary, #94a3b8)', margin: '0 auto 1rem' }} aria-hidden="true" />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>No Evidence Bundles Created Yet</h2>
          <p style={{ color: 'var(--text-secondary, #64748b)', maxWidth: '480px', margin: '0 auto 1.5rem auto', fontSize: '0.9rem' }}>
            Collect photos, challans, RTI replies, and official letters into a tamper-evident package before lodging complaints on CPGRAMS or municipal portals.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: '0.375rem',
              background: 'var(--primary, #2563eb)',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Create Your First Bundle
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) 1fr', gap: '1.5rem' }}>
          {/* Bundle Selector Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.25rem 0' }}>My Evidence Bundles ({bundles.length})</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {bundles.map((b) => {
                const isSelected = b.bundleId === selectedBundleId;
                return (
                  <button
                    key={b.bundleId}
                    type="button"
                    onClick={() => setSelectedBundleId(b.bundleId)}
                    style={{
                      textAlign: 'left',
                      padding: '0.85rem',
                      borderRadius: '0.5rem',
                      background: isSelected ? 'var(--primary-bg-light, #eff6ff)' : 'var(--bg-card, #fff)',
                      border: `1px solid ${isSelected ? 'var(--primary, #2563eb)' : 'var(--border-light, #e2e8f0)'}`,
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.3rem',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                      {b.complaintTitle}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #64748b)' }}>
                      {b.department}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                      <span style={{ color: 'var(--text-tertiary, #94a3b8)' }}>{b.entries?.length || 0} items</span>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>{b.bundleId.slice(0, 12)}...</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Bundle Workspace */}
          {activeBundle && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Active Bundle Card */}
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: '0.75rem',
                  background: 'var(--bg-card, #fff)',
                  border: '1px solid var(--border-light, #e2e8f0)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.35rem 0' }}>
                      {activeBundle.complaintTitle}
                    </h2>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #64748b)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <span><strong>Authority:</strong> {activeBundle.department}</span>
                      <span><strong>Bundle ID:</strong> <code>{activeBundle.bundleId}</code></span>
                      {activeBundle.officialReferenceNumbers?.length > 0 && (
                        <span><strong>Ref:</strong> {activeBundle.officialReferenceNumbers.join(', ')}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => runVerification(activeBundle.bundleId)}
                      disabled={isVerifying}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.45rem 0.75rem',
                        fontSize: '0.8rem',
                        borderRadius: '0.375rem',
                        border: '1px solid var(--border-light, #cbd5e1)',
                        background: 'var(--bg-card)',
                        cursor: 'pointer',
                      }}
                    >
                      <RefreshCw size={14} className={isVerifying ? 'animate-spin' : ''} aria-hidden="true" />
                      {isVerifying ? 'Verifying...' : 'Verify Ledger'}
                    </button>

                    <button
                      type="button"
                      onClick={handleExportJson}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.45rem 0.75rem',
                        fontSize: '0.8rem',
                        borderRadius: '0.375rem',
                        border: '1px solid var(--border-light, #cbd5e1)',
                        background: 'var(--bg-card)',
                        cursor: 'pointer',
                      }}
                    >
                      <Download size={14} aria-hidden="true" /> Export JSON
                    </button>

                    <button
                      type="button"
                      onClick={handleExportMarkdown}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.45rem 0.75rem',
                        fontSize: '0.8rem',
                        borderRadius: '0.375rem',
                        border: '1px solid var(--border-light, #cbd5e1)',
                        background: 'var(--bg-card)',
                        cursor: 'pointer',
                      }}
                    >
                      <FileText size={14} aria-hidden="true" /> Export Dossier
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteBundle(activeBundle.bundleId)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.45rem 0.75rem',
                        fontSize: '0.8rem',
                        borderRadius: '0.375rem',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        color: '#ef4444',
                        background: 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={14} aria-hidden="true" /> Delete
                    </button>
                  </div>
                </div>

                {/* Integrity Banner */}
                {verificationReport && (
                  <div
                    style={{
                      marginTop: '1rem',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                      background: verificationReport.isValid
                        ? 'rgba(34, 197, 94, 0.08)'
                        : 'rgba(239, 68, 68, 0.08)',
                      border: `1px solid ${verificationReport.isValid ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      {verificationReport.isValid ? (
                        <ShieldCheck style={{ color: '#16a34a', width: '1.4rem', height: '1.4rem' }} aria-hidden="true" />
                      ) : (
                        <ShieldAlert style={{ color: '#dc2626', width: '1.4rem', height: '1.4rem' }} aria-hidden="true" />
                      )}
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                          Status: {verificationReport.status} ({verificationReport.checkedEntriesCount} entries checked)
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          Merkle Root: <code style={{ fontSize: '0.72rem' }}>{activeBundle.chainState?.rootHash?.slice(0, 24)}...</code>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAuditModal(true)}
                      style={{
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.78rem',
                        borderRadius: '0.25rem',
                        background: 'transparent',
                        border: '1px solid var(--border-light)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                    >
                      <Eye size={13} aria-hidden="true" /> Inspect Proof
                    </button>
                  </div>
                )}
              </div>

              {/* Evidence Entries Section */}
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: '0.75rem',
                  background: 'var(--bg-card, #fff)',
                  border: '1px solid var(--border-light, #e2e8f0)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                    Append-Only Evidence Ledger ({activeBundle.entries?.length || 0})
                  </h3>
                  <button
                    type="button"
                    onClick={() => { setShowAddEntryModal(true); setFormError(''); }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.45rem 0.85rem',
                      fontSize: '0.82rem',
                      borderRadius: '0.375rem',
                      background: 'var(--primary, #2563eb)',
                      color: '#fff',
                      border: 'none',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={14} aria-hidden="true" /> Add Evidence Item
                  </button>
                </div>

                {(!activeBundle.entries || activeBundle.entries.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)' }}>
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>No evidence items recorded in this ledger yet.</p>
                    <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.8rem' }}>
                      Click <strong>"Add Evidence Item"</strong> to append photos, receipts, or correspondence.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {activeBundle.entries.map((entry, idx) => {
                      const isAssertion = entry.provenanceTier === PROVENANCE_TIERS.CITIZEN_ASSERTION;
                      const sourceLabel = EVIDENCE_SOURCE_LABELS[entry.source] || entry.source;

                      return (
                        <div
                          key={entry.entryId || idx}
                          style={{
                            padding: '1rem',
                            borderRadius: '0.5rem',
                            border: '1px solid var(--border-light, #e2e8f0)',
                            background: 'var(--bg-card-hover, rgba(0,0,0,0.01))',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.5rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span
                                style={{
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '99px',
                                  background: 'var(--text-primary)',
                                  color: 'var(--bg-primary, #fff)',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                }}
                              >
                                #{entry.sequence}
                              </span>
                              <strong style={{ fontSize: '0.95rem' }}>{entry.title}</strong>
                            </div>

                            {/* Provenance Pill */}
                            <span
                              style={{
                                padding: '0.2rem 0.6rem',
                                borderRadius: '99px',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                                background: isAssertion ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                color: isAssertion ? '#2563eb' : '#059669',
                                border: `1px solid ${isAssertion ? 'rgba(59, 130, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                              }}
                            >
                              {isAssertion ? 'Citizen Assertion' : 'Independently Verified Record'}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <strong>Source:</strong> {sourceLabel} &bull; <strong>Timestamp:</strong> {new Date(entry.timestamp).toLocaleString()}
                          </div>

                          {entry.userAnnotation && (
                            <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--text-primary)' }}>
                              "{entry.userAnnotation}"
                            </p>
                          )}

                          {entry.attachment && (
                            <div
                              style={{
                                padding: '0.5rem 0.75rem',
                                borderRadius: '0.375rem',
                                background: 'rgba(0,0,0,0.03)',
                                fontSize: '0.78rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '0.5rem',
                              }}
                            >
                              <span>
                                📄 <strong>{entry.attachment.fileName}</strong> ({Math.round(entry.attachment.byteSize / 1024)} KB)
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <span style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>
                                  SHA-256: {entry.attachment.sha256.slice(0, 16)}...
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(entry.attachment.sha256, entry.entryId)}
                                  title="Copy full SHA-256 hash"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}
                                >
                                  {copiedHash === entry.entryId ? <Check size={12} color="green" /> : <Copy size={12} />}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Cryptographic Link Footer */}
                          <div
                            style={{
                              marginTop: '0.25rem',
                              paddingTop: '0.4rem',
                              borderTop: '1px dashed var(--border-light, #e2e8f0)',
                              fontSize: '0.7rem',
                              color: 'var(--text-tertiary, #94a3b8)',
                              fontFamily: 'monospace',
                              display: 'flex',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '0.5rem',
                            }}
                          >
                            <span>Prev: {entry.previousEntryHash?.slice(0, 12)}...</span>
                            <span>Entry Hash: {entry.entryHash?.slice(0, 16)}...</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Redressal Filing Guidance */}
              <div
                style={{
                  padding: '1.25rem',
                  borderRadius: '0.75rem',
                  background: 'var(--bg-card, #fff)',
                  border: '1px solid var(--border-light, #e2e8f0)',
                  fontSize: '0.85rem',
                }}
              >
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 700 }}>
                  Statutory Submission Guidance
                </h4>
                <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-secondary)' }}>
                  To lodge this complaint formally, use official grievance redressal portals. Verifiable Evidence Bundles protect you against lost paperwork and unacknowledged complaints:
                </p>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  <a
                    href="https://pgportal.gov.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      color: 'var(--primary, #2563eb)',
                      textDecoration: 'none',
                      fontWeight: 600,
                    }}
                  >
                    CPGRAMS Central Redressal <ExternalLink size={13} aria-hidden="true" />
                  </a>
                  <a
                    href="https://rtionline.gov.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      color: 'var(--primary, #2563eb)',
                      textDecoration: 'none',
                      fontWeight: 600,
                    }}
                  >
                    RTI Online Portal <ExternalLink size={13} aria-hidden="true" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: Create Bundle */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-bundle-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'var(--bg-card, #fff)',
              borderRadius: '0.75rem',
              maxWidth: '520px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <h3 id="create-bundle-title" style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 1rem 0' }}>
              Create Verifiable Evidence Bundle
            </h3>

            {formError && (
              <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateBundle}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Complaint Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sewage Overflow in Ward 14"
                  value={newBundleTitle}
                  onChange={(e) => setNewBundleTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border-light, #cbd5e1)',
                    background: 'var(--bg-primary, #fff)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Target Authority / Department
                </label>
                <input
                  type="text"
                  placeholder="e.g. Municipal Corporation, PWD, DISCOM"
                  value={newBundleDept}
                  onChange={(e) => setNewBundleDept(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border-light, #cbd5e1)',
                    background: 'var(--bg-primary, #fff)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Complaint ID / Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. GRV-PWD-2026-091"
                  value={newBundleComplaintId}
                  onChange={(e) => setNewBundleComplaintId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border-light, #cbd5e1)',
                    background: 'var(--bg-primary, #fff)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Official Reference Numbers (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Comma separated: CPGRAMS-9921, PWD/2026/81"
                  value={newBundleRefNums}
                  onChange={(e) => setNewBundleRefNums(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border-light, #cbd5e1)',
                    background: 'var(--bg-primary, #fff)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border-light)',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.375rem',
                    border: 'none',
                    background: 'var(--primary, #2563eb)',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Create Bundle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Evidence Entry */}
      {showAddEntryModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-entry-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'var(--bg-card, #fff)',
              borderRadius: '0.75rem',
              maxWidth: '560px',
              width: '100%',
              padding: '1.5rem',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <h3 id="add-entry-title" style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 1rem 0' }}>
              Append Evidence Entry to Ledger
            </h3>

            {formError && (
              <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleAddEntry}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Entry Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Photographic Proof of Water Stagnation"
                  value={entryTitle}
                  onChange={(e) => setEntryTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border-light, #cbd5e1)',
                    background: 'var(--bg-primary, #fff)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              {/* Provenance Tier Selection */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Provenance Tier (Crucial for Legal Boundary)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                      padding: '0.5rem',
                      borderRadius: '0.375rem',
                      border: `1px solid ${entryProvenance === PROVENANCE_TIERS.CITIZEN_ASSERTION ? 'var(--primary)' : 'var(--border-light)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="provenanceTier"
                      value={PROVENANCE_TIERS.CITIZEN_ASSERTION}
                      checked={entryProvenance === PROVENANCE_TIERS.CITIZEN_ASSERTION}
                      onChange={() => setEntryProvenance(PROVENANCE_TIERS.CITIZEN_ASSERTION)}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <strong style={{ fontSize: '0.88rem' }}>{PROVENANCE_TIER_LABELS.CITIZEN_ASSERTION}</strong>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                        {PROVENANCE_TIER_DESCRIPTIONS.CITIZEN_ASSERTION}
                      </div>
                    </div>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                      padding: '0.5rem',
                      borderRadius: '0.375rem',
                      border: `1px solid ${entryProvenance === PROVENANCE_TIERS.INDEPENDENT_VERIFICATION ? '#059669' : 'var(--border-light)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="provenanceTier"
                      value={PROVENANCE_TIERS.INDEPENDENT_VERIFICATION}
                      checked={entryProvenance === PROVENANCE_TIERS.INDEPENDENT_VERIFICATION}
                      onChange={() => setEntryProvenance(PROVENANCE_TIERS.INDEPENDENT_VERIFICATION)}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <strong style={{ fontSize: '0.88rem' }}>{PROVENANCE_TIER_LABELS.INDEPENDENT_VERIFICATION}</strong>
                      <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                        {PROVENANCE_TIER_DESCRIPTIONS.INDEPENDENT_VERIFICATION}
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Evidence Source Select */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Evidence Source Category
                </label>
                <select
                  value={entrySource}
                  onChange={(e) => setEntrySource(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border-light, #cbd5e1)',
                    background: 'var(--bg-primary, #fff)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {Object.entries(EVIDENCE_SOURCE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Annotation */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  Citizen Annotation / Factual Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Record objective facts, dates, officer names, or meter readings..."
                  value={entryAnnotation}
                  onChange={(e) => setEntryAnnotation(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border-light, #cbd5e1)',
                    background: 'var(--bg-primary, #fff)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              {/* File Attachment */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                  File Attachment (Max 5 MB)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  style={{ fontSize: '0.85rem' }}
                />
                {isHashingFile && (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    Computing SHA-256 digest...
                  </div>
                )}
                {entryFileHash && (
                  <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#059669', marginTop: '0.25rem' }}>
                    SHA-256: {entryFileHash.slice(0, 32)}...
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddEntryModal(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border-light)',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isHashingFile}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.375rem',
                    border: 'none',
                    background: 'var(--primary, #2563eb)',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Append to Immutable Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Import Bundle */}
      {showImportModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-bundle-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'var(--bg-card, #fff)',
              borderRadius: '0.75rem',
              maxWidth: '540px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <h3 id="import-bundle-title" style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 1rem 0' }}>
              Import & Verify Bundle Archive
            </h3>

            {importError && (
              <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                {importError}
              </div>
            )}

            <form onSubmit={handleImportSubmit}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 0.5rem 0' }}>
                Paste the exported JSON archive content below. Civic Help Setu will verify the Merkle root, hash chains, and file checksums before accepting it into your local workspace.
              </p>
              <textarea
                rows={8}
                required
                placeholder='{"archiveType": "CIVIC_VERIFIABLE_EVIDENCE_BUNDLE", ...}'
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid var(--border-light, #cbd5e1)',
                  background: 'var(--bg-primary, #fff)',
                  color: 'var(--text-primary)',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--border-light)',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.375rem',
                    border: 'none',
                    background: 'var(--primary, #2563eb)',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Verify & Import
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Cryptographic Audit Inspector */}
      {showAuditModal && verificationReport && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="audit-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'var(--bg-card, #fff)',
              borderRadius: '0.75rem',
              maxWidth: '600px',
              width: '100%',
              padding: '1.5rem',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
          >
            <h3 id="audit-modal-title" style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 1rem 0' }}>
              Cryptographic Integrity Audit Report
            </h3>

            <div style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
              <div><strong>Status:</strong> {verificationReport.status}</div>
              <div><strong>Valid:</strong> {verificationReport.isValid ? 'YES' : 'NO'}</div>
              <div><strong>Checked Entries:</strong> {verificationReport.checkedEntriesCount}</div>
              <div><strong>Verified At:</strong> {verificationReport.verifiedAt}</div>
            </div>

            {verificationReport.errors.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ color: '#ef4444', fontSize: '0.85rem' }}>Integrity Failures:</strong>
                <ul style={{ color: '#ef4444', fontSize: '0.8rem', paddingLeft: '1.2rem', margin: '0.25rem 0' }}>
                  {verificationReport.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {verificationReport.warnings.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ color: '#d97706', fontSize: '0.85rem' }}>Audit Warnings (Clock Skew / Duplicates):</strong>
                <ul style={{ color: '#d97706', fontSize: '0.8rem', paddingLeft: '1.2rem', margin: '0.25rem 0' }}>
                  {verificationReport.warnings.map((w, idx) => (
                    <li key={idx}>{w.message || w.code}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.375rem',
                  border: '1px solid var(--border-light)',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
