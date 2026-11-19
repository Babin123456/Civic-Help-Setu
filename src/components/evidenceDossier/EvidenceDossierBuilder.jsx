import { useState } from 'react';
import {
  UploadCloud,
  FileText,
  AlertTriangle,
  CheckCircle,
  Copy,
  Download,
  Save,
  Layers,
  Trash2,
} from 'lucide-react';
import {
  createManifest,
  duplicateGroups,
  generateEvidenceScheduleMarkdown,
  computeManifestDigest,
  EVIDENCE_CATEGORIES,
  MAX_FILE_BYTES,
  MAX_FILES,
} from '../../services/evidenceManifestService.js';
import { saveDossier } from '../../services/evidenceDossierStorage.js';

export default function EvidenceDossierBuilder({ onDossierSaved }) {
  const [title, setTitle] = useState('Evidence Dossier');
  const [caseReference, setCaseReference] = useState('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState([]);
  const [descriptions, setDescriptions] = useState({});
  const [categories, setCategories] = useState({});
  const [manifest, setManifest] = useState(null);
  const [manifestDigest, setManifestDigest] = useState(null);
  const [isHashing, setIsHashing] = useState(false);
  const [progressState, setProgressState] = useState({ done: 0, total: 0 });
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [copiedSchedule, setCopiedSchedule] = useState(false);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const handleFileSelection = (e) => {
    const selected = Array.from(e.target.files || []);
    setErrorMessage('');
    setStatusMessage('');

    if (selected.length > MAX_FILES) {
      setErrorMessage(`You can select at most ${MAX_FILES} files. You selected ${selected.length}.`);
      return;
    }

    const oversized = selected.find(f => f.size > MAX_FILE_BYTES);
    if (oversized) {
      setErrorMessage(`${oversized.name} exceeds the 20 MiB limit (${formatFileSize(oversized.size)}).`);
      return;
    }

    // Check duplicate filenames in selection
    const names = new Set();
    for (const f of selected) {
      if (names.has(f.name)) {
        setErrorMessage(`Duplicate filename detected: "${f.name}". Rename duplicate files before uploading.`);
        return;
      }
      names.add(f.name);
    }

    setFiles(selected);
    setManifest(null);
    setManifestDigest(null);
  };

  const handleRemoveFile = (indexToRemove) => {
    const newFiles = files.filter((_, idx) => idx !== indexToRemove);
    setFiles(newFiles);
    setManifest(null);
    setManifestDigest(null);
  };

  const handleBuildManifest = async () => {
    if (!files.length) {
      setErrorMessage('Please select at least one evidence file.');
      return;
    }

    setIsHashing(true);
    setErrorMessage('');
    setStatusMessage('Computing cryptographic SHA-256 digests locally...');
    setProgressState({ done: 0, total: files.length });

    try {
      const generated = await createManifest(
        files,
        {
          title: title.trim() || 'Evidence Dossier',
          caseReference: caseReference.trim(),
          notes: notes.trim(),
          descriptions,
          categories,
        },
        (done, total) => {
          setProgressState({ done, total });
        }
      );

      const digest = await computeManifestDigest(generated);
      setManifest(generated);
      setManifestDigest(digest);
      setStatusMessage(`Manifest generated successfully with ${generated.entries.length} sealed evidence items.`);
    } catch (err) {
      setErrorMessage(err.message || 'Error generating manifest');
    } finally {
      setIsHashing(false);
    }
  };

  const handleDownloadJson = () => {
    if (!manifest) return;
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const safeRef = (caseReference || 'manifest').replace(/[^a-zA-Z0-9_-]/g, '_');
    const a = document.createElement('a');
    a.href = url;
    a.download = `evidence-manifest-${safeRef}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopySchedule = async () => {
    if (!manifest) return;
    const markdown = generateEvidenceScheduleMarkdown(manifest);
    try {
      await navigator.clipboard.writeText(markdown);
      setCopiedSchedule(true);
      setTimeout(() => setCopiedSchedule(false), 2500);
    } catch {
      // Fallback
      setStatusMessage('Evidence schedule generated. Please copy from export.');
    }
  };

  const handleSaveToVault = async () => {
    if (!manifest) return;
    try {
      const saved = await saveDossier(manifest);
      setStatusMessage(`Dossier saved to offline vault with storage seal: ${saved.storageSeal.slice(0, 16)}...`);
      if (onDossierSaved) onDossierSaved(saved);
    } catch (err) {
      setErrorMessage(`Failed to save dossier: ${err.message}`);
    }
  };

  const duplicates = manifest ? duplicateGroups(manifest.entries) : [];

  return (
    <div
      style={{
        background: 'var(--surface-color, #ffffff)',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: '12px',
        padding: '1.5rem',
        marginBottom: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <Layers size={22} color="#0284c7" />
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
          1. Create Evidence Dossier Manifest
        </h2>
      </div>

      {/* Metadata Inputs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-secondary, #334155)' }}>
            Dossier Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Electricity Billing Dispute Dossier"
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color, #cbd5e1)',
              background: 'var(--bg-input, #f8fafc)',
              fontSize: '0.9rem',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-secondary, #334155)' }}>
            Grievance / Case Reference No.
          </label>
          <input
            type="text"
            value={caseReference}
            onChange={(e) => setCaseReference(e.target.value)}
            placeholder="e.g. CGRF-NORTH-2026-889"
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color, #cbd5e1)',
              background: 'var(--bg-input, #f8fafc)',
              fontSize: '0.9rem',
            }}
          />
        </div>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-secondary, #334155)' }}>
          General Case Notes / Factual Context (Optional)
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Briefly state dispute history or departmental submission background..."
          style={{
            width: '100%',
            padding: '0.6rem 0.75rem',
            borderRadius: '8px',
            border: '1px solid var(--border-color, #cbd5e1)',
            background: 'var(--bg-input, #f8fafc)',
            fontSize: '0.88rem',
          }}
        />
      </div>

      {/* File Picker */}
      <div
        style={{
          border: '2px dashed var(--border-color, #cbd5e1)',
          borderRadius: '10px',
          padding: '1.5rem',
          textAlign: 'center',
          background: 'var(--bg-card-subtle, #f8fafc)',
          marginBottom: '1.25rem',
        }}
      >
        <UploadCloud size={32} color="#0284c7" style={{ marginBottom: '0.5rem' }} />
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 0.25rem 0', color: 'var(--text-primary, #0f172a)' }}>
          Select or Drop Evidence Files
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #64748b)', margin: '0 0 1rem 0' }}>
          Supports PDF, PNG, JPG, JPEG, and TXT files. Max 20 files, up to 20 MiB each.
        </p>
        <input
          type="file"
          id="evidence-file-input"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.txt"
          onChange={handleFileSelection}
          disabled={isHashing}
          style={{ display: 'none' }}
        />
        <label
          htmlFor="evidence-file-input"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.55rem 1.1rem',
            background: '#0284c7',
            color: '#ffffff',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '0.88rem',
            fontWeight: 600,
          }}
        >
          Choose Files ({files.length} selected)
        </label>
      </div>

      {/* Error / Status Alerts */}
      {errorMessage && (
        <div
          role="alert"
          style={{
            padding: '0.75rem 1rem',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            borderRadius: '8px',
            fontSize: '0.85rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <AlertTriangle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {statusMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: '0.75rem 1rem',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#15803d',
            borderRadius: '8px',
            fontSize: '0.85rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <CheckCircle size={18} />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* File Items List */}
      {files.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary, #0f172a)' }}>
            Selected Evidence Files ({files.length} / {MAX_FILES})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {files.map((file, idx) => {
              const fileKey = file.name;
              return (
                <div
                  key={`${file.name}-${idx}`}
                  style={{
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '8px',
                    padding: '0.85rem',
                    background: 'var(--bg-card, #ffffff)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FileText size={18} color="#0284c7" />
                      <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary, #0f172a)' }}>{file.name}</strong>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #64748b)' }}>
                        ({formatFileSize(file.size)})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      disabled={isHashing}
                      title="Remove file"
                      aria-label={`Remove ${file.name}`}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: '2px',
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: '0.2rem' }}>
                        Evidence Category
                      </label>
                      <select
                        value={categories[fileKey] || EVIDENCE_CATEGORIES[0]}
                        onChange={(e) => setCategories({ ...categories, [fileKey]: e.target.value })}
                        disabled={isHashing}
                        style={{
                          width: '100%',
                          padding: '0.45rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color, #cbd5e1)',
                          fontSize: '0.82rem',
                          background: 'var(--bg-input, #ffffff)',
                        }}
                      >
                        {EVIDENCE_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary, #475569)', marginBottom: '0.2rem' }}>
                        Specific Description (max 500 chars)
                      </label>
                      <input
                        type="text"
                        maxLength={500}
                        placeholder="e.g. Official acknowledgment receipt with token 4098"
                        value={descriptions[fileKey] || ''}
                        onChange={(e) => setDescriptions({ ...descriptions, [fileKey]: e.target.value })}
                        disabled={isHashing}
                        style={{
                          width: '100%',
                          padding: '0.45rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color, #cbd5e1)',
                          fontSize: '0.82rem',
                          background: 'var(--bg-input, #ffffff)',
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {isHashing && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
            <span>Computing SHA-256 digests...</span>
            <span>{progressState.done} / {progressState.total}</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={progressState.total ? Math.round((progressState.done / progressState.total) * 100) : 0}
            aria-valuemin="0"
            aria-valuemax="100"
            style={{
              height: '8px',
              width: '100%',
              background: '#e2e8f0',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progressState.total ? (progressState.done / progressState.total) * 100 : 0}%`,
                background: '#0284c7',
                transition: 'width 0.2s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Compute Button */}
      {files.length > 0 && !manifest && (
        <button
          type="button"
          onClick={handleBuildManifest}
          disabled={isHashing}
          style={{
            padding: '0.65rem 1.25rem',
            background: '#0284c7',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: isHashing ? 'not-allowed' : 'pointer',
            opacity: isHashing ? 0.7 : 1,
          }}
        >
          {isHashing ? 'Hashing Files...' : 'Compute SHA-256 & Generate Manifest'}
        </button>
      )}

      {/* Manifest Overview & Actions */}
      {manifest && (
        <div
          style={{
            background: 'var(--bg-card-subtle, #f0fdf4)',
            border: '1px solid #bbf7d0',
            borderRadius: '10px',
            padding: '1.25rem',
            marginTop: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 0.2rem 0', color: '#166534' }}>
                Manifest Sealed ({manifest.entries.length} Evidence Items)
              </h3>
              <div style={{ fontSize: '0.8rem', color: '#15803d' }}>
                Root Digest: <code style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{manifestDigest}</code>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleDownloadJson}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.5rem 0.85rem',
                  background: '#059669',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Download size={14} />
                Export JSON
              </button>

              <button
                type="button"
                onClick={handleCopySchedule}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.5rem 0.85rem',
                  background: '#ffffff',
                  color: '#059669',
                  border: '1px solid #059669',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {copiedSchedule ? <CheckCircle size={14} /> : <Copy size={14} />}
                {copiedSchedule ? 'Copied!' : 'Copy Markdown'}
              </button>

              <button
                type="button"
                onClick={handleSaveToVault}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.5rem 0.85rem',
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Save size={14} />
                Save to Vault
              </button>
            </div>
          </div>

          {/* Duplicate Warnings */}
          {duplicates.length > 0 && (
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.6rem 0.85rem',
                background: '#fef3c7',
                border: '1px solid #fde68a',
                borderRadius: '6px',
                fontSize: '0.8rem',
                color: '#92400e',
              }}
            >
              <strong>Duplicate Content Detected:</strong> The following files have identical SHA-256 byte hashes:
              {duplicates.map((group, idx) => (
                <div key={idx} style={{ marginTop: '0.2rem' }}>
                  • {group.join(', ')}
                </div>
              ))}
            </div>
          )}

          {/* Entries Hash Table */}
          <div style={{ marginTop: '0.75rem', overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #cbd5e1', textAlign: 'left', color: '#334155' }}>
                  <th style={{ padding: '0.4rem' }}>File</th>
                  <th style={{ padding: '0.4rem' }}>Category</th>
                  <th style={{ padding: '0.4rem' }}>SHA-256 Hash</th>
                </tr>
              </thead>
              <tbody>
                {manifest.entries.map((entry) => (
                  <tr key={entry.name} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.4rem', fontWeight: 600 }}>{entry.name}</td>
                    <td style={{ padding: '0.4rem' }}>{entry.category || 'Other'}</td>
                    <td style={{ padding: '0.4rem' }}>
                      <code style={{ fontSize: '0.72rem', background: '#f1f5f9', padding: '2px 4px', borderRadius: '4px' }}>
                        {entry.sha256}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
