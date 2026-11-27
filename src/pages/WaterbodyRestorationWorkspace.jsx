/**
 * src/pages/WaterbodyRestorationWorkspace.jsx
 *
 * Accessible Public Waterbody Restoration Milestone & Evidence Tracker (#1442).
 * Links official restoration work plans to measurable milestones (inlet_cleanup,
 * desilting, water_testing, boundary_protection), separates official claims from
 * community evidence, preserves corrections, and blocks unsupported health claims.
 */

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Droplets,
  FileCheck2,
  Plus,
  Sparkles,
  UserCheck,
  WifiOff,
} from 'lucide-react';
import { RESTORATION_MILESTONE_TYPES } from '../services/waterbodyRestorationService.js';
import {
  addLocalWaterbodyObservation,
  loadLocalWaterbodyState,
} from '../services/waterbodyRestorationStorage.js';

export default function WaterbodyRestorationWorkspace() {
  const initial = (() => {
    try {
      const loaded = loadLocalWaterbodyState();
      return {
        status: loaded.waterbodies.length === 0 ? 'empty' : 'ready',
        errorMsg: '',
        data: loaded,
        selectedId: loaded.waterbodies[0]?.waterbodyId || null,
      };
    } catch (err) {
      return {
        status: 'error',
        errorMsg: err?.message || 'Unable to load waterbody restoration tracker.',
        data: null,
        selectedId: null,
      };
    }
  })();

  const [viewStatus, setViewStatus] = useState(initial.status);
  const [errorMsg, setErrorMsg] = useState(initial.errorMsg);
  const [wbState, setWbState] = useState(initial.data);
  const [selectedId, setSelectedId] = useState(initial.selectedId);
  const [milestoneType, setMilestoneType] = useState('desilting');
  const [note, setNote] = useState('');
  const [evidenceRef, setEvidenceRef] = useState('');
  const [notice, setNotice] = useState('');
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== 'undefined' && navigator.onLine === false
  );

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

  const activeWb =
    wbState?.waterbodies?.find((w) => w.waterbodyId === selectedId) || wbState?.waterbodies?.[0] || null;

  const handleAddObservation = (e) => {
    e.preventDefault();
    if (!activeWb) return;
    setErrorMsg('');
    setNotice('');
    try {
      const { state } = addLocalWaterbodyObservation(activeWb.waterbodyId, {
        milestoneType,
        note,
        evidenceRef,
      });
      setWbState(state);
      setNote('');
      setEvidenceRef('');
      setViewStatus('ready');
      setNotice(`Independent community observation added for ${milestoneType}.`);
    } catch (err) {
      setErrorMsg(err?.message || 'Unable to add observation.');
    }
  };

  return (
    <main className="section" aria-labelledby="waterbody-heading">
      <div className="container" style={{ maxWidth: '1120px', margin: '0 auto' }}>
        <header className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
            <div>
              <h1 id="waterbody-heading" style={{ margin: 0, fontSize: '1.65rem' }}>
                Public Waterbody Restoration Milestone &amp; Evidence Tracker
              </h1>
              <p style={{ marginTop: '0.4rem', opacity: 0.85 }}>
                Compare official restoration work plans against measurable milestones (inlet cleanup, desilting, water testing, boundary protection), independent community evidence, and preserved corrections.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="badge" data-origin="official_record">
                <FileCheck2 size={14} aria-hidden="true" /> Official Work Plan &amp; Milestone
              </span>
              <span className="badge" data-origin="citizen_entered_fact">
                <UserCheck size={14} aria-hidden="true" /> Community Observation
              </span>
              <span className="badge" data-origin="ai_community_suggestion">
                <Sparkles size={14} aria-hidden="true" /> AI / Community Advisory
              </span>
            </div>
          </div>
        </header>

        {isOffline && (
          <div role="status" aria-live="polite" className="glass-panel" style={{ padding: '0.9rem 1.2rem', marginBottom: '1rem', borderLeft: '4px solid #f59e0b', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <WifiOff size={18} aria-hidden="true" />
            <span><strong>Offline Mode:</strong> Cached restoration milestones and observations are available offline.</span>
          </div>
        )}

        {errorMsg && (
          <div role="alert" className="glass-panel" style={{ padding: '0.9rem 1.2rem', marginBottom: '1rem', borderLeft: '4px solid #ef4444', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <AlertTriangle size={18} aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        {notice && (
          <div role="status" aria-live="polite" className="glass-panel" style={{ padding: '0.9rem 1.2rem', marginBottom: '1rem', borderLeft: '4px solid #10b981', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <CheckCircle2 size={18} aria-hidden="true" />
            <span>{notice}</span>
          </div>
        )}

        {viewStatus === 'empty' && (
          <section className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
            <h2>No Waterbody Restoration Projects</h2>
            <p>No official restoration work plans are currently registered.</p>
          </section>
        )}

        {viewStatus === 'ready' && activeWb && (
          <>
            {/* Baseline & Milestones */}
            <section className="glass-panel" aria-labelledby="milestones-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem', overflowX: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h2 id="milestones-heading" style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Droplets size={18} aria-hidden="true" />
                  {activeWb.name} ({activeWb.wardId}, {activeWb.jurisdiction})
                </h2>
                <select aria-label="Select Waterbody Project" value={activeWb.waterbodyId} onChange={(e) => setSelectedId(e.target.value)} style={{ padding: '0.4rem' }}>
                  {wbState.waterbodies.map((w) => (
                    <option key={w.waterbodyId} value={w.waterbodyId}>{w.name}</option>
                  ))}
                </select>
              </div>
              <p style={{ fontSize: '0.9rem', opacity: 0.85 }}>
                <strong>Baseline Source:</strong> {activeWb.baselineSource?.source} ({activeWb.baselineSource?.jurisdiction} • {activeWb.baselineSource?.verified ? `Verified ${activeWb.baselineSource.effectiveDate}` : 'Unverified'})
              </p>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <caption style={{ textAlign: 'left', marginBottom: '0.5rem', opacity: 0.8 }}>
                  Official restoration milestones with target dates, verification status, and provenance.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Milestone</th>
                    <th scope="col">Target Date</th>
                    <th scope="col">Official Status</th>
                    <th scope="col">Source &amp; Verification</th>
                  </tr>
                </thead>
                <tbody>
                  {activeWb.officialMilestones.map((m) => (
                    <tr key={m.milestoneType}>
                      <th scope="row">{m.milestoneType}</th>
                      <td>{m.targetDate}</td>
                      <td>{m.status}</td>
                      <td>
                        {m.officialSource?.source} ({m.officialSource?.verified ? `Verified ${m.officialSource.effectiveDate}` : 'Unverified'})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {activeWb.aiAdvisory && (
                <p style={{ marginTop: '0.75rem', marginBottom: 0, fontSize: '0.88rem', opacity: 0.85 }}>
                  {activeWb.aiAdvisory.note}
                </p>
              )}
            </section>

            {/* Independent Community Evidence */}
            <section className="glass-panel" aria-labelledby="observations-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
              <h2 id="observations-heading" style={{ marginTop: 0, fontSize: '1.15rem' }}>
                Independent Community Evidence ({activeWb.communityObservations.length})
              </h2>
              <ul>
                {activeWb.communityObservations.map((obs) => (
                  <li key={obs.observationId} style={{ marginBottom: '0.45rem' }}>
                    <strong>[{obs.milestoneType}]</strong> {obs.observedDate}: {obs.note}
                    {obs.evidenceRef && <span> (Ref: <code>{obs.evidenceRef}</code>)</span>}
                  </li>
                ))}
              </ul>

              <form onSubmit={handleAddObservation} style={{ display: 'grid', gap: '0.7rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(148,163,184,0.25)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  <div>
                    <label htmlFor="wb-milestone" style={{ display: 'block', fontWeight: 600 }}>Milestone</label>
                    <select id="wb-milestone" value={milestoneType} onChange={(e) => setMilestoneType(e.target.value)} style={{ width: '100%', padding: '0.45rem' }}>
                      {RESTORATION_MILESTONE_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="wb-ref" style={{ display: 'block', fontWeight: 600 }}>Photo / Evidence Ref (Optional)</label>
                    <input id="wb-ref" value={evidenceRef} onChange={(e) => setEvidenceRef(e.target.value)} placeholder="e.g. photo-hash-abc123" style={{ width: '100%', padding: '0.45rem' }} />
                  </div>
                </div>
                <div>
                  <label htmlFor="wb-note" style={{ display: 'block', fontWeight: 600 }}>
                    Observation Note (No PII or unsupported health claims)
                  </label>
                  <input id="wb-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Describe observable work progress..." required style={{ width: '100%', padding: '0.45rem' }} />
                </div>
                <div>
                  <button type="submit" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Plus size={16} aria-hidden="true" /> Add Community Observation
                  </button>
                </div>
              </form>
            </section>

            {/* Preserved Corrections */}
            <section className="glass-panel" aria-labelledby="corrections-heading" style={{ padding: '1.25rem' }}>
              <h2 id="corrections-heading" style={{ marginTop: 0, fontSize: '1.1rem' }}>
                Preserved Official Corrections ({activeWb.corrections.length})
              </h2>
              {activeWb.corrections.length === 0 ? (
                <p style={{ marginBottom: 0 }}>No corrections recorded; prior baseline and milestone claims are preserved.</p>
              ) : (
                <ul style={{ marginBottom: 0 }}>
                  {activeWb.corrections.map((c) => (
                    <li key={c.correctionId}>
                      <strong>{c.milestoneType}</strong>: {c.previousStatus} → {c.correctedStatus} ({c.reason}, {c.correctedAt})
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
