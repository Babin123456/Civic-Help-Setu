import { useState, useMemo } from 'react';
import {
  BOUNDARY_DATASET_VERSIONS,
  RESOLUTION_STATUS,
  PROVENANCE_KIND,
  resolveBoundaryConflict,
  applyManualJurisdictionOverride,
  listProvenanceLogs,
} from '../../services/jurisdictionBoundaryConflictService';

const PROVENANCE_BADGE = {
  [PROVENANCE_KIND.OFFICIAL_DATASET]: {
    label: 'Official Boundary Dataset',
    bg: '#e3f2fd',
    color: '#1565c0',
  },
  [PROVENANCE_KIND.CITIZEN_CONFIRMED]: {
    label: 'Citizen Confirmed Override',
    bg: '#e8f5e9',
    color: '#2e7d32',
  },
  [PROVENANCE_KIND.AI_SUGGESTION]: {
    label: 'AI Suggestion (Verify)',
    bg: '#fff8e1',
    color: '#f57f17',
  },
  [PROVENANCE_KIND.UNVERIFIED]: {
    label: 'Unverified / Unknown Rule',
    bg: '#fef2f2',
    color: '#b91c1c',
  },
};

export default function BoundaryConflictResolverPanel({
  locality = '',
  stateCode = '',
}) {
  const [boundaryVersion, setBoundaryVersion] = useState(BOUNDARY_DATASET_VERSIONS[0].version);
  const [areaInput, setAreaInput] = useState(locality);
  const [resolution, setResolution] = useState(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [error, setError] = useState('');
  const [logs, setLogs] = useState(() => {
    try {
      return listProvenanceLogs();
    } catch {
      return [];
    }
  });

  const activeDataset = useMemo(
    () => BOUNDARY_DATASET_VERSIONS.find((v) => v.version === boundaryVersion) || BOUNDARY_DATASET_VERSIONS[0],
    [boundaryVersion]
  );

  const handleResolve = (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = resolveBoundaryConflict({
        locality: areaInput || locality,
        stateCode: stateCode && stateCode !== 'All' ? stateCode : '',
        boundaryVersion,
      });
      setResolution(res);
      setLogs(listProvenanceLogs());
    } catch (err) {
      setError(err.message || 'Failed to resolve boundary conflict.');
    }
  };

  const handleSelectAlternative = (candidate) => {
    if (!resolution) return;
    setError('');
    try {
      const updated = applyManualJurisdictionOverride({
        resolution,
        selectedAuthorityId: candidate.authorityId,
        selectedAuthorityName: candidate.authorityName,
        reason: overrideReason.trim() || `Confirmed ${candidate.authorityName} for border area`,
      });
      setResolution(updated);
      setOverrideReason('');
      setLogs(listProvenanceLogs());
    } catch (err) {
      setError(err.message || 'Manual override failed.');
    }
  };

  const badge = resolution ? PROVENANCE_BADGE[resolution.provenanceKind] || PROVENANCE_BADGE.unverified : null;

  return (
    <section
      aria-label="Jurisdiction Boundary Conflict Resolver"
      style={{
        marginTop: '2rem',
        padding: '1.25rem',
        borderRadius: '0.75rem',
        border: '1px solid var(--border-main, #e2e8f0)',
        background: 'var(--bg-card, #fff)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
          Boundary Conflict &amp; Border-Area Resolver
        </h2>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          Source: <strong>{activeDataset.source}</strong> &bull; Effective: {activeDataset.effectiveDate} &bull; Verified: {new Date(activeDataset.lastVerifiedAt).toLocaleDateString()}
        </div>
      </div>

      <form onSubmit={handleResolve} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '1rem' }}>
        <div style={{ flex: '1 1 220px' }}>
          <label htmlFor="bcr-area" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            Border Area / PIN Code (e.g. Wakad 411057, Connaught Place 110001, Electronic City 560100)
          </label>
          <input
            id="bcr-area"
            type="text"
            value={areaInput}
            onChange={(e) => setAreaInput(e.target.value)}
            placeholder="Enter locality or 6-digit PIN"
            style={{ width: '100%', padding: '0.45rem 0.7rem', borderRadius: '0.4rem', border: '1px solid var(--border-main, #cbd5e1)' }}
          />
        </div>

        <div style={{ flex: '0 1 260px' }}>
          <label htmlFor="bcr-version" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
            Boundary Dataset Version
          </label>
          <select
            id="bcr-version"
            value={boundaryVersion}
            onChange={(e) => setBoundaryVersion(e.target.value)}
            style={{ width: '100%', padding: '0.45rem 0.7rem', borderRadius: '0.4rem', border: '1px solid var(--border-main, #cbd5e1)' }}
          >
            {BOUNDARY_DATASET_VERSIONS.map((v) => (
              <option key={v.version} value={v.version}>
                {v.version} — {v.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '0.4rem',
            border: 'none',
            background: 'var(--accent-main, #2563eb)',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Check Boundary Conflicts
        </button>
      </form>

      {error && (
        <div role="alert" style={{ padding: '0.6rem 0.85rem', borderRadius: '0.4rem', background: '#fef2f2', color: '#b91c1c', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
          {error}
        </div>
      )}

      {resolution && (
        <div style={{ padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border-light, #e2e8f0)', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <strong>Status: {resolution.status}</strong>
            {badge && (
              <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: '999px', background: badge.bg, color: badge.color }}>
                {badge.label}
              </span>
            )}
          </div>

          {resolution.overlapReason && (
            <p style={{ margin: '0 0 0.65rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {resolution.overlapReason}
            </p>
          )}

          {resolution.primaryCandidate && (
            <div style={{ padding: '0.6rem 0.8rem', borderRadius: '0.4rem', background: 'rgba(37,99,235,0.06)', marginBottom: '0.65rem', fontSize: '0.85rem' }}>
              <div>
                <strong>Primary Authority:</strong> {resolution.primaryCandidate.authorityName} ({Math.round(resolution.primaryCandidate.confidence * 100)}% confidence)
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Source: {resolution.primaryCandidate.source} &bull; Effective: {resolution.primaryCandidate.effectiveDate} &bull; Status: {resolution.primaryCandidate.verificationStatus}
              </div>
            </div>
          )}

          {resolution.alternatives.length > 0 && (
            <div style={{ marginTop: '0.6rem' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                Competing Border-Area Alternatives (Manual Override):
              </div>
              <input
                type="text"
                aria-label="Manual override reason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Optional reason for confirming an alternative office (no PII)"
                style={{ width: '100%', padding: '0.35rem 0.6rem', borderRadius: '0.35rem', border: '1px solid var(--border-main, #cbd5e1)', marginBottom: '0.5rem', fontSize: '0.8rem' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {[resolution.primaryCandidate, ...resolution.alternatives].filter(Boolean).map((cand) => (
                  <div
                    key={cand.authorityId}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.7rem', borderRadius: '0.4rem', border: '1px solid var(--border-light, #e2e8f0)', fontSize: '0.82rem' }}
                  >
                    <div>
                      <strong>{cand.authorityName}</strong> ({Math.round(cand.confidence * 100)}%)
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                        {cand.jurisdiction} &bull; {cand.source}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectAlternative(cand)}
                      style={{ padding: '0.3rem 0.65rem', borderRadius: '0.35rem', border: '1px solid var(--accent-main, #2563eb)', background: 'transparent', color: 'var(--accent-main, #2563eb)', fontWeight: 600, fontSize: '0.76rem', cursor: 'pointer' }}
                    >
                      Confirm This Office
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {resolution.status === RESOLUTION_STATUS.UNVERIFIED && (
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', color: '#b91c1c' }}>
              Boundary unverified. Please confirm your local office manually before submitting an application.
            </p>
          )}
        </div>
      )}

      {logs.length > 0 && (
        <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
          <strong>Provenance Log ({logs.length} entries, PII-free):</strong>
          {logs.slice(0, 4).map((l) => (
            <div key={l.logId} style={{ fontFamily: 'monospace', marginTop: '0.2rem' }}>
              [{new Date(l.timestamp).toLocaleTimeString()}] {l.action} | v{l.boundaryVersion} | {l.selectedAuthorityId} ({l.provenanceKind})
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

