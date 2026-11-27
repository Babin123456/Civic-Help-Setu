/**
 * src/pages/RecommendationFairnessAuditWorkspace.jsx
 *
 * Accessible Civic Recommendation Fairness & Coverage Audit Suite (#1449).
 * Supports loading, empty, error, and offline states; small-group suppression;
 * 95% confidence intervals; dataset provenance; and visibly distinct
 * Official Record vs Citizen-Consented Cohort vs AI/Community Suggestion origins.
 */

import { useEffect, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  WifiOff,
  Play,
  RefreshCw,
  FileCheck2,
  EyeOff,
  Sparkles,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { COHORT_AXES } from '../services/recommendationFairnessAuditContract.js';
import {
  loadLocalFairnessAuditState,
  runLocalOrRemoteAudit,
} from '../services/recommendationFairnessAuditStorage.js';

const AXIS_LABELS = {
  language: 'Language',
  district: 'District',
  deviceType: 'Device Type',
  connectivityTier: 'Connectivity Tier',
};

function formatPct(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function formatCI(ci) {
  if (!ci || typeof ci.estimate !== 'number') return '—';
  return `${(ci.estimate * 100).toFixed(1)}% [${(ci.lower * 100).toFixed(1)}%, ${(ci.upper * 100).toFixed(1)}%]`;
}

export default function RecommendationFairnessAuditWorkspace() {
  const initialSnapshot = (() => {
    try {
      const loaded = loadLocalFairnessAuditState();
      if (!loaded.datasets || loaded.datasets.length === 0) {
        return { status: 'empty', errorMsg: '', auditState: loaded, datasetId: '', run: null };
      }
      return {
        status: 'ready',
        errorMsg: '',
        auditState: loaded,
        datasetId: loaded.datasets[0].id,
        run: loaded.runs?.[0] || null,
      };
    } catch (err) {
      return {
        status: 'error',
        errorMsg: err?.message || 'Unable to load fairness audit workspace.',
        auditState: null,
        datasetId: '',
        run: null,
      };
    }
  })();

  const [status, setStatus] = useState(initialSnapshot.status); // 'loading' | 'ready' | 'empty' | 'error'
  const [errorMsg, setErrorMsg] = useState(initialSnapshot.errorMsg);
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false
  );
  const [auditState, setAuditState] = useState(initialSnapshot.auditState);
  const [selectedAxis, setSelectedAxis] = useState('language');
  const [selectedDatasetId, setSelectedDatasetId] = useState(initialSnapshot.datasetId);
  const [activeRun, setActiveRun] = useState(initialSnapshot.run);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    if (typeof window !== 'undefined') {
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      }
    };
  }, []);

  const handleRunAudit = async () => {
    setRunning(true);
    setErrorMsg('');
    try {
      const baseline = activeRun || null;
      const { run } = await runLocalOrRemoteAudit({
        datasetId: selectedDatasetId,
        cohortAxis: selectedAxis,
        baselineRunId: baseline?.runId || null,
      });
      const refreshed = loadLocalFairnessAuditState();
      setAuditState(refreshed);
      setActiveRun(run);
      setStatus('ready');
    } catch (err) {
      setErrorMsg(err?.message || 'Audit execution failed.');
    } finally {
      setRunning(false);
    }
  };

  const selectedDataset =
    auditState?.datasets?.find((d) => d.id === selectedDatasetId) || auditState?.datasets?.[0] || null;

  return (
    <main className="section" aria-labelledby="fairness-audit-heading">
      <div className="container" style={{ maxWidth: '1120px', margin: '0 auto' }}>
        <header className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
            <div>
              <h1 id="fairness-audit-heading" style={{ margin: 0, fontSize: '1.65rem' }}>
                Civic Recommendation Fairness &amp; Coverage Audit Suite
              </h1>
              <p style={{ marginTop: '0.4rem', opacity: 0.85 }}>
                Offline evaluation of retrieval and completion outcomes across non-sensitive, user-consented cohorts with small-group suppression, 95% confidence intervals, and release regression gates.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="badge" data-origin="official_record">
                <FileCheck2 size={14} aria-hidden="true" /> Official Gate Policy
              </span>
              <span className="badge" data-origin="citizen_consented_cohort">
                <ShieldCheck size={14} aria-hidden="true" /> Citizen-Consented Cohorts
              </span>
              <span className="badge" data-origin="ai_community_suggestion">
                <Sparkles size={14} aria-hidden="true" /> AI Suggestions (Non-binding)
              </span>
            </div>
          </div>
        </header>

        {isOffline && (
          <div
            role="status"
            aria-live="polite"
            className="glass-panel"
            style={{ padding: '0.9rem 1.2rem', marginBottom: '1rem', borderLeft: '4px solid #f59e0b', display: 'flex', alignItems: 'center', gap: '0.6rem' }}
          >
            <WifiOff size={18} aria-hidden="true" />
            <span>
              <strong>Offline Mode:</strong> Running deterministic local cohort audits using cached consented datasets.
            </span>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="glass-panel"
            style={{ padding: '0.9rem 1.2rem', marginBottom: '1rem', borderLeft: '4px solid #ef4444', display: 'flex', alignItems: 'center', gap: '0.6rem' }}
          >
            <AlertTriangle size={18} aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        {status === 'loading' && (
          <section className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }} aria-busy="true">
            <RefreshCw size={22} aria-hidden="true" />
            <p>Loading offline fairness evaluation datasets and gate policies…</p>
          </section>
        )}

        {status === 'empty' && (
          <section className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
            <h2>No Offline Evaluation Datasets Available</h2>
            <p>Register a non-sensitive, user-consented evaluation dataset to run fairness and coverage audits.</p>
          </section>
        )}

        {status === 'ready' && (
          <>
            {/* Controls */}
            <section className="glass-panel" aria-label="Audit Controls" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 240px' }}>
                  <label htmlFor="audit-dataset-select" style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Offline Evaluation Dataset
                  </label>
                  <select
                    id="audit-dataset-select"
                    value={selectedDatasetId}
                    onChange={(e) => setSelectedDatasetId(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem' }}
                  >
                    {(auditState?.datasets || []).map((ds) => (
                      <option key={ds.id} value={ds.id}>
                        {ds.name} (v{ds.version})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ flex: '1 1 200px' }}>
                  <label htmlFor="audit-axis-select" style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Cohort Axis
                  </label>
                  <select
                    id="audit-axis-select"
                    value={selectedAxis}
                    onChange={(e) => setSelectedAxis(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem' }}
                  >
                    {COHORT_AXES.map((axis) => (
                      <option key={axis} value={axis}>
                        {AXIS_LABELS[axis] || axis}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleRunAudit}
                  disabled={running}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                >
                  <Play size={16} aria-hidden="true" />
                  {running ? 'Running Audit…' : 'Run Fairness Audit'}
                </button>
              </div>
            </section>

            {/* Dataset Provenance */}
            {selectedDataset && (
              <section className="glass-panel" aria-labelledby="provenance-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h2 id="provenance-heading" style={{ margin: 0, fontSize: '1.15rem' }}>
                    Dataset Provenance &amp; Consent Boundary
                  </h2>
                  <span className="badge">
                    {selectedDataset.provenance?.verified ? 'Verified Provenance' : 'Unverified Provenance'}
                  </span>
                </div>
                <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
                  <div>
                    <dt style={{ fontWeight: 600, fontSize: '0.85rem' }}>Source</dt>
                    <dd style={{ margin: 0 }}>{selectedDataset.provenance?.source || 'Unknown'}</dd>
                  </div>
                  <div>
                    <dt style={{ fontWeight: 600, fontSize: '0.85rem' }}>Jurisdiction</dt>
                    <dd style={{ margin: 0 }}>{selectedDataset.provenance?.jurisdiction || 'UNSPECIFIED'}</dd>
                  </div>
                  <div>
                    <dt style={{ fontWeight: 600, fontSize: '0.85rem' }}>Effective Date</dt>
                    <dd style={{ margin: 0 }}>{selectedDataset.provenance?.effectiveDate || 'Unverified'}</dd>
                  </div>
                  <div>
                    <dt style={{ fontWeight: 600, fontSize: '0.85rem' }}>Last Verified</dt>
                    <dd style={{ margin: 0 }}>{selectedDataset.provenance?.lastVerifiedAt || 'Unverified'}</dd>
                  </div>
                  <div>
                    <dt style={{ fontWeight: 600, fontSize: '0.85rem' }}>Consent Mode</dt>
                    <dd style={{ margin: 0 }}>{selectedDataset.consentMode}</dd>
                  </div>
                </dl>
                <p style={{ marginTop: '0.75rem', marginBottom: 0, fontSize: '0.88rem', opacity: 0.85 }}>
                  Privacy Guarantee: Zero Aadhaar, PAN, OTP, password, biometric, or sensitive-trait inference signals permitted. Cohorts with fewer than {auditState?.policy?.minCohortSize || 10} records are suppressed.
                </p>
              </section>
            )}

            {/* Release Regression Gate + Summary */}
            {activeRun && (
              <>
                <section className="glass-panel" aria-labelledby="gate-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <h2 id="gate-heading" style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {activeRun.gate.status === 'PASS' ? (
                        <CheckCircle2 size={20} color="#10b981" aria-hidden="true" />
                      ) : activeRun.gate.status === 'WARN' ? (
                        <AlertTriangle size={20} color="#f59e0b" aria-hidden="true" />
                      ) : (
                        <XCircle size={20} color="#ef4444" aria-hidden="true" />
                      )}
                      Release Regression Gate: {activeRun.gate.status} ({activeRun.gate.action})
                    </h2>
                    <span className="badge">
                      Rule Provenance: {activeRun.gate.ruleProvenance?.verified ? 'Verified' : 'Unverified'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.85rem', marginTop: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Retrieval Parity Ratio</div>
                      <strong style={{ fontSize: '1.2rem' }}>{activeRun.summary.retrievalParityRatio}</strong>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Completion Parity Ratio</div>
                      <strong style={{ fontSize: '1.2rem' }}>{activeRun.summary.completionParityRatio}</strong>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Overall Retrieval (95% CI)</div>
                      <strong style={{ fontSize: '1.05rem' }}>{formatCI(activeRun.summary.overallRetrievalRate)}</strong>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Overall Completion (95% CI)</div>
                      <strong style={{ fontSize: '1.05rem' }}>{formatCI(activeRun.summary.overallCompletionRate)}</strong>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Catalog Coverage</div>
                      <strong style={{ fontSize: '1.2rem' }}>{formatPct(activeRun.summary.catalogCoverageRatio)}</strong>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Suppressed Cohorts</div>
                      <strong style={{ fontSize: '1.2rem' }}>{activeRun.summary.suppressedCohortCount}</strong>
                    </div>
                  </div>

                  {activeRun.gate.violations?.length > 0 && (
                    <ul style={{ marginTop: '0.9rem', color: '#dc2626' }} aria-label="Gate Violations">
                      {activeRun.gate.violations.map((v, idx) => (
                        <li key={idx}>{v}</li>
                      ))}
                    </ul>
                  )}
                  {activeRun.gate.warnings?.length > 0 && (
                    <ul style={{ marginTop: '0.6rem', color: '#b45309' }} aria-label="Gate Warnings">
                      {activeRun.gate.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Accessible Cohort Comparison Table */}
                <section className="glass-panel" aria-labelledby="cohort-table-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem', overflowX: 'auto' }}>
                  <h2 id="cohort-table-heading" style={{ marginTop: 0, fontSize: '1.15rem' }}>
                    Cohort Retrieval &amp; Completion Outcomes ({AXIS_LABELS[activeRun.cohortAxis] || activeRun.cohortAxis})
                  </h2>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <caption style={{ textAlign: 'left', marginBottom: '0.5rem', opacity: 0.8 }}>
                      Citizen-consented offline cohort metrics with 95% confidence intervals and small-group suppression (min n = {activeRun.summary.minCohortSize}).
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Cohort</th>
                        <th scope="col">Sample Size (n)</th>
                        <th scope="col">Retrieval Rate (95% CI)</th>
                        <th scope="col">Completion Rate (95% CI)</th>
                        <th scope="col">Recall@{activeRun.k} (95% CI)</th>
                        <th scope="col">nDCG@{activeRun.k} (95% CI)</th>
                        <th scope="col">Coverage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeRun.cohorts.map((row) => (
                        <tr key={row.cohort}>
                          <th scope="row">{row.cohort}</th>
                          <td>{row.sampleCount}</td>
                          {row.suppressed ? (
                            <td colSpan={5}>
                              <span className="badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                                <EyeOff size={14} aria-hidden="true" />
                                Suppressed ({row.suppressionReason})
                              </span>
                            </td>
                          ) : (
                            <>
                              <td>{formatCI(row.metrics.retrievalRate)}</td>
                              <td>{formatCI(row.metrics.completionRate)}</td>
                              <td>{formatCI(row.metrics.recallAtK)}</td>
                              <td>{formatCI(row.metrics.ndcgAtK)}</td>
                              <td>{formatPct(row.metrics.catalogCoverageRatio)}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                {/* AI / Community Suggestions (Visibly Distinct) */}
                {activeRun.aiSuggestions?.length > 0 && (
                  <section className="glass-panel" aria-labelledby="suggestions-heading" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
                    <h2 id="suggestions-heading" style={{ marginTop: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <ShieldAlert size={18} aria-hidden="true" />
                      AI / Community Advisory Suggestions (Non-Binding)
                    </h2>
                    <ul>
                      {activeRun.aiSuggestions.map((sug) => (
                        <li key={sug.id} style={{ marginBottom: '0.5rem' }}>
                          <strong>{sug.title}</strong> — {sug.detail}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

