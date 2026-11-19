import { useState } from 'react';
import {
  FolderLock,
  Layers,
  FileCheck,
  Archive,
  Download,
  Trash2,
  ShieldCheck,
  CheckCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';
import EvidenceDossierDisclaimer from '../components/evidenceDossier/EvidenceDossierDisclaimer.jsx';
import EvidenceDossierBuilder from '../components/evidenceDossier/EvidenceDossierBuilder.jsx';
import EvidenceDossierVerifier from '../components/evidenceDossier/EvidenceDossierVerifier.jsx';
import {
  listSavedDossiers,
  deleteSavedDossier,
  exportDossierJson,
  verifySavedDossierIntegrity,
} from '../services/evidenceDossierStorage.js';

export default function EvidenceDossierWorkspace() {
  const [activeTab, setActiveTab] = useState('builder'); // 'builder' | 'verifier' | 'vault'
  const [verifierInitialManifest, setVerifierInitialManifest] = useState(null);
  const [savedDossiers, setSavedDossiers] = useState(() => listSavedDossiers());
  const [vaultFeedback, setVaultFeedback] = useState({});

  const refreshSavedDossiers = () => {
    setSavedDossiers(listSavedDossiers());
  };

  const handleVerifyDossierInTab = (dossier) => {
    setVerifierInitialManifest(dossier);
    setActiveTab('verifier');
  };

  const handleDeleteSavedDossier = (id) => {
    deleteSavedDossier(id);
    refreshSavedDossiers();
  };

  const handleExportSavedJson = (dossier) => {
    const jsonStr = exportDossierJson(dossier);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `evidence-manifest-${(dossier.caseReference || dossier.id).replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCheckVaultIntegrity = async (dossier) => {
    const check = await verifySavedDossierIntegrity(dossier);
    setVaultFeedback((prev) => ({
      ...prev,
      [dossier.id]: check.isIntact
        ? 'Storage Seal Valid: Record has not been altered in browser storage.'
        : 'Warning: Seal mismatch! Record in storage differs from sealed state.',
    }));
  };

  return (
    <div className="section" style={{ padding: '2rem 1rem', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
          <FolderLock size={28} color="#0284c7" />
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
            Evidence Dossier Integrity &amp; Manifest Workspace
          </h1>
        </div>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary, #475569)', margin: 0 }}>
          Organize complaint evidence, compute client-side SHA-256 integrity proofs, and verify dossiers before sharing with authorities.
        </p>
      </div>

      {/* Cryptographic & Legal Disclaimer */}
      <EvidenceDossierDisclaimer />

      {/* Tabs Navigation */}
      <div
        role="tablist"
        aria-label="Evidence dossier workspace sections"
        style={{
          display: 'flex',
          borderBottom: '2px solid var(--border-color, #e2e8f0)',
          gap: '0.5rem',
          marginBottom: '1.5rem',
          overflowX: 'auto',
        }}
      >
        <button
          type="button"
          role="tab"
          id="tab-builder"
          aria-selected={activeTab === 'builder'}
          aria-controls="panel-builder"
          onClick={() => setActiveTab('builder')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.75rem 1.1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'builder' ? '3px solid #0284c7' : '3px solid transparent',
            color: activeTab === 'builder' ? '#0284c7' : 'var(--text-secondary, #64748b)',
            fontWeight: activeTab === 'builder' ? 700 : 500,
            fontSize: '0.92rem',
            cursor: 'pointer',
            marginBottom: '-2px',
          }}
        >
          <Layers size={17} />
          Create Manifest
        </button>

        <button
          type="button"
          role="tab"
          id="tab-verifier"
          aria-selected={activeTab === 'verifier'}
          aria-controls="panel-verifier"
          onClick={() => setActiveTab('verifier')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.75rem 1.1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'verifier' ? '3px solid #0284c7' : '3px solid transparent',
            color: activeTab === 'verifier' ? '#0284c7' : 'var(--text-secondary, #64748b)',
            fontWeight: activeTab === 'verifier' ? 700 : 500,
            fontSize: '0.92rem',
            cursor: 'pointer',
            marginBottom: '-2px',
          }}
        >
          <FileCheck size={17} />
          Verify Files
        </button>

        <button
          type="button"
          role="tab"
          id="tab-vault"
          aria-selected={activeTab === 'vault'}
          aria-controls="panel-vault"
          onClick={() => {
            setActiveTab('vault');
            refreshSavedDossiers();
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.75rem 1.1rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'vault' ? '3px solid #0284c7' : '3px solid transparent',
            color: activeTab === 'vault' ? '#0284c7' : 'var(--text-secondary, #64748b)',
            fontWeight: activeTab === 'vault' ? 700 : 500,
            fontSize: '0.92rem',
            cursor: 'pointer',
            marginBottom: '-2px',
          }}
        >
          <Archive size={17} />
          Saved Vault Dossiers ({savedDossiers.length})
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'builder' && (
        <div id="panel-builder" role="tabpanel" aria-labelledby="tab-builder">
          <EvidenceDossierBuilder onDossierSaved={refreshSavedDossiers} />
        </div>
      )}

      {activeTab === 'verifier' && (
        <div id="panel-verifier" role="tabpanel" aria-labelledby="tab-verifier">
          <EvidenceDossierVerifier initialManifest={verifierInitialManifest} />
        </div>
      )}

      {activeTab === 'vault' && (
        <div id="panel-vault" role="tabpanel" aria-labelledby="tab-vault">
          <div
            style={{
              background: 'var(--surface-color, #ffffff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '12px',
              padding: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
                Offline Evidence Vault
              </h2>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #64748b)' }}>
                Saved locally in browser (Metadata &amp; Hashes Only)
              </span>
            </div>

            {savedDossiers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-secondary, #64748b)' }}>
                <Archive size={36} color="#94a3b8" style={{ marginBottom: '0.5rem' }} />
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600 }}>No saved evidence dossiers yet.</p>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                  Build a manifest in the &quot;Create Manifest&quot; tab and click &quot;Save to Vault&quot; to keep offline records.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {savedDossiers.map((dossier) => (
                  <div
                    key={dossier.id}
                    style={{
                      border: '1px solid var(--border-color, #e2e8f0)',
                      borderRadius: '8px',
                      padding: '1rem',
                      background: 'var(--bg-card-subtle, #f8fafc)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <div>
                        <strong style={{ fontSize: '1rem', color: 'var(--text-primary, #0f172a)' }}>
                          {dossier.title}
                        </strong>
                        {dossier.caseReference && (
                          <div style={{ fontSize: '0.82rem', color: '#0284c7', fontWeight: 600 }}>
                            Ref: {dossier.caseReference}
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--text-secondary, #64748b)', marginTop: '0.2rem' }}>
                          <Clock size={13} />
                          <span>Saved: {new Date(dossier.updatedAt || dossier.createdAt).toLocaleString()}</span>
                          <span>• {dossier.entries.length} items</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => handleVerifyDossierInTab(dossier)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.4rem 0.75rem',
                            background: '#0284c7',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Verify Candidate Files
                          <ArrowRight size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExportSavedJson(dossier)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.4rem 0.7rem',
                            background: '#ffffff',
                            color: '#334155',
                            border: '1px solid var(--border-color, #cbd5e1)',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <Download size={13} />
                          JSON
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCheckVaultIntegrity(dossier)}
                          title="Verify tamper seal of saved dossier"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            padding: '0.4rem 0.7rem',
                            background: '#ffffff',
                            color: '#059669',
                            border: '1px solid #059669',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <ShieldCheck size={13} />
                          Check Seal
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteSavedDossier(dossier.id)}
                          title="Delete dossier"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '0.4rem',
                            background: 'transparent',
                            color: '#ef4444',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {vaultFeedback[dossier.id] && (
                      <div style={{ fontSize: '0.78rem', color: vaultFeedback[dossier.id].includes('Valid') ? '#15803d' : '#b91c1c', marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <CheckCircle size={13} />
                        <span>{vaultFeedback[dossier.id]}</span>
                      </div>
                    )}

                    {dossier.storageSeal && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #64748b)', marginTop: '0.35rem' }}>
                        Seal: <code style={{ fontFamily: 'monospace' }}>{dossier.storageSeal.slice(0, 32)}...</code>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
