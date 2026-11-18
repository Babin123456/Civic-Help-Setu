import { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileSearch,
  Upload,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import {
  parseManifest,
  verifyManifest,
  MAX_MANIFEST_BYTES,
} from '../../services/evidenceManifestService.js';
import { listSavedDossiers } from '../../services/evidenceDossierStorage.js';

export default function EvidenceDossierVerifier({ initialManifest = null }) {
  const [manifest, setManifest] = useState(initialManifest);
  const [candidateFiles, setCandidateFiles] = useState([]);
  const [verificationOutput, setVerificationOutput] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [progressState, setProgressState] = useState({ done: 0, total: 0 });
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const savedDossiers = listSavedDossiers();

  const handleManifestFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage('');
    setStatusMessage('');
    setVerificationOutput(null);

    if (file.size > MAX_MANIFEST_BYTES) {
      setErrorMessage('Manifest file exceeds the 1 MiB limit.');
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseManifest(text);
      setManifest(parsed);
      setStatusMessage(`Loaded manifest "${parsed.title || 'Evidence Dossier'}" with ${parsed.entries.length} items.`);
    } catch (err) {
      setErrorMessage(`Invalid manifest file: ${err.message}`);
      setManifest(null);
    } finally {
      e.target.value = '';
    }
  };

  const handleSelectSavedDossier = (dossierId) => {
    setErrorMessage('');
    setStatusMessage('');
    setVerificationOutput(null);

    const found = savedDossiers.find(d => d.id === dossierId);
    if (found) {
      setManifest(found);
      setStatusMessage(`Selected saved dossier "${found.title}" (${found.entries.length} items).`);
    }
  };

  const handleCandidateFilesSelection = (e) => {
    const files = Array.from(e.target.files || []);
    setCandidateFiles(files);
    setVerificationOutput(null);
    setErrorMessage('');
  };

  const handleRunVerification = async () => {
    if (!manifest) {
      setErrorMessage('Please load or select an evidence manifest first.');
      return;
    }
    if (!candidateFiles.length) {
      setErrorMessage('Please select candidate files to verify against the manifest.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage('');
    setStatusMessage('Verifying file SHA-256 signatures...');
    setProgressState({ done: 0, total: manifest.entries.length });

    try {
      const result = await verifyManifest(manifest, candidateFiles, (done, total) => {
        setProgressState({ done, total });
      });
      setVerificationOutput(result);
      if (result.summary.isFullyIntact) {
        setStatusMessage('Verification complete: All files are 100% authentic and unaltered.');
      } else if (result.summary.changedCount > 0) {
        setStatusMessage(`Verification complete: Detected ${result.summary.changedCount} modified/tampered file(s)!`);
      } else {
        setStatusMessage('Verification complete with warnings (missing or extra files).');
      }
    } catch (err) {
      setErrorMessage(`Verification error: ${err.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const resetAll = () => {
    setManifest(null);
    setCandidateFiles([]);
    setVerificationOutput(null);
    setStatusMessage('');
    setErrorMessage('');
  };

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileSearch size={22} color="#0284c7" />
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
            2. Verify Evidence Files Against Manifest
          </h2>
        </div>
        {manifest && (
          <button
            type="button"
            onClick={resetAll}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.35rem 0.65rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #cbd5e1)',
              background: 'transparent',
              fontSize: '0.8rem',
              cursor: 'pointer',
              color: 'var(--text-secondary, #64748b)',
            }}
          >
            <RefreshCw size={13} />
            Reset Verification
          </button>
        )}
      </div>

      {/* Step 1: Load Manifest */}
      {!manifest ? (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.92rem', fontWeight: 600, marginBottom: '0.6rem', color: 'var(--text-primary, #0f172a)' }}>
            Step A: Load Manifest JSON or Pick Saved Dossier
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
            <div
              style={{
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: '8px',
                padding: '1rem',
                background: 'var(--bg-card-subtle, #f8fafc)',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', color: '#0284c7' }}>
                <Upload size={18} />
                <span>Upload Exported .json Manifest</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleManifestFileUpload}
                  style={{ display: 'none' }}
                />
              </label>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #64748b)', margin: '0.5rem 0 0 0' }}>
                Loads a previously downloaded evidence manifest file.
              </p>
            </div>

            <div
              style={{
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: '8px',
                padding: '1rem',
                background: 'var(--bg-card-subtle, #f8fafc)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.88rem', color: '#059669', marginBottom: '0.4rem' }}>
                <HardDrive size={18} />
                <span>Select from Saved Vault Dossiers</span>
              </div>
              {savedDossiers.length > 0 ? (
                <select
                  defaultValue=""
                  onChange={(e) => handleSelectSavedDossier(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.45rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color, #cbd5e1)',
                    fontSize: '0.82rem',
                    background: 'var(--bg-input, #ffffff)',
                  }}
                >
                  <option value="" disabled>-- Select a saved dossier --</option>
                  {savedDossiers.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d.entries.length} items) - {new Date(d.createdAt).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              ) : (
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #64748b)', margin: 0 }}>
                  No saved dossiers found in local vault. Create and save one first.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Manifest Information Banner */
        <div
          style={{
            background: 'var(--bg-card-subtle, #f0fdf4)',
            border: '1px solid #bbf7d0',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <strong style={{ fontSize: '0.95rem', color: '#166534' }}>
                Loaded Manifest: {manifest.title || 'Evidence Dossier'}
              </strong>
              {manifest.caseReference && (
                <div style={{ fontSize: '0.82rem', color: '#15803d' }}>
                  Case Reference: {manifest.caseReference}
                </div>
              )}
              <div style={{ fontSize: '0.78rem', color: '#15803d', marginTop: '0.2rem' }}>
                Created: {new Date(manifest.createdAt).toLocaleString()} | Expected Files: {manifest.entries.length}
              </div>
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                background: '#dcfce7',
                color: '#166534',
                padding: '3px 8px',
                borderRadius: '999px',
                fontWeight: 600,
              }}
            >
              Algorithm: {manifest.algorithm || 'SHA-256'}
            </span>
          </div>
        </div>
      )}

      {/* Step 2: Select Candidate Files */}
      {manifest && (
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '0.92rem', fontWeight: 600, marginBottom: '0.6rem', color: 'var(--text-primary, #0f172a)' }}>
            Step B: Select Candidate Files to Verify
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #64748b)', margin: '0 0 0.75rem 0' }}>
            Select the local files from your drive that correspond to the manifest entries. The service will hash them and verify if byte-level modifications occurred.
          </p>
          <input
            type="file"
            id="candidate-files-input"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.txt"
            onChange={handleCandidateFilesSelection}
            disabled={isVerifying}
            style={{ display: 'none' }}
          />
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <label
              htmlFor="candidate-files-input"
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
              Choose Candidate Files ({candidateFiles.length} selected)
            </label>

            {candidateFiles.length > 0 && (
              <button
                type="button"
                onClick={handleRunVerification}
                disabled={isVerifying}
                style={{
                  padding: '0.55rem 1.25rem',
                  background: '#059669',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: isVerifying ? 'not-allowed' : 'pointer',
                  opacity: isVerifying ? 0.7 : 1,
                }}
              >
                {isVerifying ? 'Verifying Files...' : 'Run Integrity Verification'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {isVerifying && (
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
            <span>Computing verification hashes...</span>
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
                background: '#059669',
                transition: 'width 0.2s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Error & Status Feedback */}
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
          <CheckCircle2 size={18} />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Verification Results Panel */}
      {verificationOutput && (
        <div
          style={{
            marginTop: '1.25rem',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: '10px',
            padding: '1.25rem',
            background: 'var(--bg-card, #ffffff)',
          }}
        >
          {/* Main Verdict Badge */}
          {verificationOutput.summary.isFullyIntact ? (
            <div
              style={{
                padding: '0.85rem 1.25rem',
                background: '#dcfce7',
                border: '1px solid #86efac',
                borderRadius: '8px',
                color: '#166534',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <ShieldCheck size={28} />
              <div>
                <strong style={{ fontSize: '1rem', display: 'block' }}>
                  DOSSIER FULLY INTACT (100% Match)
                </strong>
                <span style={{ fontSize: '0.82rem' }}>
                  All candidate files precisely match the SHA-256 byte signatures recorded in the manifest. Zero tampering detected.
                </span>
              </div>
            </div>
          ) : verificationOutput.summary.changedCount > 0 ? (
            <div
              style={{
                padding: '0.85rem 1.25rem',
                background: '#fee2e2',
                border: '1px solid #fca5a5',
                color: '#991b1b',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <ShieldAlert size={28} />
              <div>
                <strong style={{ fontSize: '1rem', display: 'block' }}>
                  TAMPERING / FILE MODIFICATIONS DETECTED
                </strong>
                <span style={{ fontSize: '0.82rem' }}>
                  {verificationOutput.summary.changedCount} file(s) do not match the expected cryptographic hash. Their contents have been edited or corrupted.
                </span>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: '0.85rem 1.25rem',
                background: '#fef3c7',
                border: '1px solid #fde68a',
                color: '#92400e',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '1rem',
              }}
            >
              <AlertTriangle size={28} />
              <div>
                <strong style={{ fontSize: '1rem', display: 'block' }}>
                  INCOMPLETE VERIFICATION
                </strong>
                <span style={{ fontSize: '0.82rem' }}>
                  {verificationOutput.summary.missingCount} file(s) listed in the manifest were not provided in your candidate selection.
                </span>
              </div>
            </div>
          )}

          {/* Metric Summary Counter Pills */}
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '0.78rem', background: '#e0f2fe', color: '#0369a1', fontWeight: 600 }}>
              Expected: {verificationOutput.summary.totalExpected}
            </span>
            <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '0.78rem', background: '#dcfce7', color: '#15803d', fontWeight: 600 }}>
              Matched: {verificationOutput.summary.matchedCount}
            </span>
            <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '0.78rem', background: '#fee2e2', color: '#b91c1c', fontWeight: 600 }}>
              Changed / Tampered: {verificationOutput.summary.changedCount}
            </span>
            <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '0.78rem', background: '#fef3c7', color: '#b45309', fontWeight: 600 }}>
              Missing: {verificationOutput.summary.missingCount}
            </span>
            {verificationOutput.summary.extraCount > 0 && (
              <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '0.78rem', background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
                Untracked Extra: {verificationOutput.summary.extraCount}
              </span>
            )}
          </div>

          {/* Detailed Per-File Results */}
          <h4 style={{ fontSize: '0.88rem', fontWeight: 700, margin: '0 0 0.6rem 0', color: 'var(--text-primary, #0f172a)' }}>
            Per-Item Integrity Breakdown
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {verificationOutput.details.map((item) => {
              const isMatch = item.status === 'Match';
              const isChanged = item.status === 'Changed';

              return (
                <div
                  key={item.name}
                  style={{
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    background: isMatch ? '#f8fafc' : isChanged ? '#fef2f2' : '#fffbeb',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <strong style={{ fontSize: '0.85rem' }}>{item.name}</strong>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: isMatch ? '#dcfce7' : isChanged ? '#fee2e2' : '#fef3c7',
                        color: isMatch ? '#15803d' : isChanged ? '#b91c1c' : '#b45309',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      {isMatch ? <CheckCircle2 size={12} /> : isChanged ? <XCircle size={12} /> : <AlertTriangle size={12} />}
                      {item.status}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)' }}>
                    Category: {item.category} {item.description && `• "${item.description}"`}
                  </div>

                  {isChanged && (
                    <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', fontFamily: 'monospace' }}>
                      <div style={{ color: '#15803d' }}>Expected: {item.expectedHash}</div>
                      <div style={{ color: '#b91c1c' }}>Actual:   {item.actualHash}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Untracked Extra Files */}
          {verificationOutput.extra.length > 0 && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.78rem', color: '#475569' }}>
              <strong>Untracked files not in manifest:</strong> {verificationOutput.extra.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
