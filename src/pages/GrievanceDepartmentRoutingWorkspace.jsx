/**
 * src/pages/GrievanceDepartmentRoutingWorkspace.jsx
 *
 * Accessible AI-Assisted Grievance Department Routing Classifier with Human Override (#1445).
 * Displays ranked multi-department suggestions with evidence phrases, confidence threshold
 * human confirmation, deterministic fallback toggle, per-class metrics, and visibly
 * distinct Citizen-Entered Complaint, AI Routing Suggestion, and Official Department Rule origins.
 */

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  GitFork,
  ShieldCheck,
  Sparkles,
  UserCheck,
  WifiOff,
} from 'lucide-react';
import {
  DEPARTMENT_CATALOG,
  evaluatePerClassRoutingMetrics,
} from '../services/grievanceDepartmentRoutingService.js';
import {
  classifyAndStoreLocalCase,
  loadLocalRoutingState,
  overrideLocalRoutingCase,
} from '../services/grievanceDepartmentRoutingStorage.js';

export default function GrievanceDepartmentRoutingWorkspace() {
  const initial = (() => {
    try {
      const loaded = loadLocalRoutingState();
      return {
        status: loaded.cases.length === 0 ? 'empty' : 'ready',
        errorMsg: '',
        data: loaded,
        activeCase: loaded.cases[0] || null,
      };
    } catch (err) {
      return {
        status: 'error',
        errorMsg: err?.message || 'Unable to load routing classifier.',
        data: null,
        activeCase: null,
      };
    }
  })();

  const [viewStatus, setViewStatus] = useState(initial.status);
  const [errorMsg, setErrorMsg] = useState(initial.errorMsg);
  const [routingState, setRoutingState] = useState(initial.data);
  const [activeCase, setActiveCase] = useState(initial.activeCase);
  const [description, setDescription] = useState('');
  const [jurisdiction, setJurisdiction] = useState('IN-UP');
  const [forceFallback, setForceFallback] = useState(false);
  const [selectedOverrides, setSelectedOverrides] = useState(() =>
    initial.activeCase?.rankedDepartments?.map((d) => d.category) || []
  );
  const [overrideRationale, setOverrideRationale] = useState('');
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

  const perClassMetrics = evaluatePerClassRoutingMetrics();

  const handleClassify = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setNotice('');
    try {
      const { routing, state } = classifyAndStoreLocalCase({
        description,
        jurisdiction,
        forceDeterministicFallback: forceFallback,
      });
      setRoutingState(state);
      setActiveCase(routing);
      setSelectedOverrides(routing.rankedDepartments.map((d) => d.category));
      setViewStatus('ready');
      setNotice(`Classified case ${routing.caseId} (${routing.status}).`);
    } catch (err) {
      setErrorMsg(err?.message || 'Classification failed.');
    }
  };

  const handleToggleOverride = (cat) => {
    setSelectedOverrides((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleConfirmOverride = () => {
    if (!activeCase) return;
    setErrorMsg('');
    setNotice('');
    try {
      const { routing, state } = overrideLocalRoutingCase(activeCase.caseId, {
        actorId: 'operator-local',
        role: 'admin',
        selectedCategories: selectedOverrides,
        rationale: overrideRationale || 'Confirmed multi-department routing.',
      });
      setRoutingState(state);
      setActiveCase(routing);
      setOverrideRationale('');
      setNotice(`Human routing confirmation saved for ${routing.caseId}.`);
    } catch (err) {
      setErrorMsg(err?.message || 'Unable to save human override.');
    }
  };

  return (
    <main className="section" aria-labelledby="routing-heading">
      <div className="container" style={{ maxWidth: '1120px', margin: '0 auto' }}>
        <header className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
            <div>
              <h1 id="routing-heading" style={{ margin: 0, fontSize: '1.65rem' }}>
                AI-Assisted Grievance Department Routing &amp; Human Override
              </h1>
              <p style={{ marginTop: '0.4rem', opacity: 0.85 }}>
                Constrained multi-department classifier with evidence phrases, confidence thresholds, deterministic fallback, and mandatory human confirmation below threshold.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="badge" data-origin="citizen_entered_fact">
                <UserCheck size={14} aria-hidden="true" /> Citizen-Entered Complaint
              </span>
              <span className="badge" data-origin="ai_community_suggestion">
                <Sparkles size={14} aria-hidden="true" /> AI Routing Suggestion
              </span>
              <span className="badge" data-origin="official_record">
                <FileCheck2 size={14} aria-hidden="true" /> Official Department Rule
              </span>
            </div>
          </div>
        </header>

        {isOffline && (
          <div role="status" aria-live="polite" className="glass-panel" style={{ padding: '0.9rem 1.2rem', marginBottom: '1rem', borderLeft: '4px solid #f59e0b', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <WifiOff size={18} aria-hidden="true" />
            <span><strong>Offline Mode:</strong> Running constrained local classifier and deterministic fallback without external calls.</span>
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

        {/* Classification Form */}
        <section className="glass-panel" aria-labelledby="classify-form-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <h2 id="classify-form-heading" style={{ marginTop: 0, fontSize: '1.15rem' }}>
            Classify Citizen Complaint (Zero PII)
          </h2>
          <form onSubmit={handleClassify} style={{ display: 'grid', gap: '0.8rem' }}>
            <div>
              <label htmlFor="grv-desc" style={{ display: 'block', fontWeight: 600 }}>
                Complaint Description (Do not include Aadhaar, PAN, OTP, password, or phone numbers)
              </label>
              <textarea
                id="grv-desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Pipeline burst and broken road pothole near Ward 14 market..."
                required
                style={{ width: '100%', padding: '0.5rem' }}
              />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
              <div>
                <label htmlFor="grv-jur" style={{ fontWeight: 600, marginRight: '0.5rem' }}>Jurisdiction</label>
                <input id="grv-jur" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} style={{ padding: '0.4rem' }} />
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                <input type="checkbox" checked={forceFallback} onChange={(e) => setForceFallback(e.target.checked)} />
                <span>Force Deterministic Fallback</span>
              </label>
              <button type="submit" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <GitFork size={16} aria-hidden="true" />
                Route Complaint
              </button>
            </div>
          </form>
        </section>

        {viewStatus === 'empty' && (
          <section className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
            <h2>No Classified Complaints Yet</h2>
            <p>Submit a de-identified complaint description above to view ranked department routing.</p>
          </section>
        )}

        {viewStatus === 'ready' && activeCase && routingState && (
          <>
            <section className="glass-panel" aria-labelledby="ranked-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
              <h2 id="ranked-heading" style={{ marginTop: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <ShieldCheck size={18} aria-hidden="true" />
                Ranked Department Suggestions — {activeCase.caseId} ({activeCase.status})
              </h2>
              <p>
                <strong>Citizen Complaint:</strong> {activeCase.citizenComplaint.text}
              </p>
              <p>
                <strong>Multi-Department:</strong> {activeCase.isMultiDepartment ? 'Yes' : 'No'} •{' '}
                <strong>Human Confirmation Required:</strong> {activeCase.requiresHumanConfirmation ? 'Yes' : 'No'} •{' '}
                <strong>Deterministic Fallback:</strong> {activeCase.usedDeterministicFallback ? 'Yes' : 'No'}
              </p>

              <ul>
                {activeCase.rankedDepartments.map((dept) => (
                  <li key={dept.category} style={{ marginBottom: '0.6rem' }}>
                    <strong>{dept.department}</strong> ({dept.category}) — Confidence: {(dept.confidence * 100).toFixed(1)}%
                    <div>Evidence phrases: {dept.evidencePhrases.length > 0 ? dept.evidencePhrases.join(', ') : 'None (fallback)'}</div>
                    <div style={{ fontSize: '0.85rem', opacity: 0.85 }}>
                      Official Rule: {dept.officialRule.source} ({dept.officialRule.jurisdiction} • {dept.officialRule.verified ? `Verified ${dept.officialRule.effectiveDate}` : 'Unverified'})
                    </div>
                  </li>
                ))}
              </ul>

              {/* Human Override Controls */}
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(148,163,184,0.25)' }}>
                <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Human Confirmation / Multi-Department Override</h3>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
                  {DEPARTMENT_CATALOG.map((d) => (
                    <label key={d.category} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <input
                        type="checkbox"
                        checked={selectedOverrides.includes(d.category)}
                        onChange={() => handleToggleOverride(d.category)}
                      />
                      <span>{d.category}</span>
                    </label>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    aria-label="Override Rationale"
                    value={overrideRationale}
                    onChange={(e) => setOverrideRationale(e.target.value)}
                    placeholder="Optional confirmation or override rationale..."
                    style={{ flex: '1 1 260px', padding: '0.45rem' }}
                  />
                  <button type="button" className="btn btn-primary" onClick={handleConfirmOverride}>
                    Confirm Routing
                  </button>
                </div>
              </div>
            </section>

            {/* Per-Class Metrics */}
            <section className="glass-panel" aria-labelledby="metrics-heading" style={{ padding: '1.25rem', overflowX: 'auto' }}>
              <h2 id="metrics-heading" style={{ marginTop: 0, fontSize: '1.15rem' }}>
                Per-Class Classifier Evaluation Metrics (Reviewed De-Identified Set: {perClassMetrics.totalExamples} cases, Accuracy: {(perClassMetrics.accuracy * 100).toFixed(1)}%)
              </h2>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <caption style={{ textAlign: 'left', marginBottom: '0.5rem', opacity: 0.8 }}>
                  Per-class precision, recall, F1 score, and support across reviewed de-identified complaints.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Department Category</th>
                    <th scope="col">Precision</th>
                    <th scope="col">Recall</th>
                    <th scope="col">F1 Score</th>
                    <th scope="col">Support</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(perClassMetrics.perClass).map(([cat, m]) => (
                    <tr key={cat}>
                      <th scope="row">{cat}</th>
                      <td>{(m.precision * 100).toFixed(1)}%</td>
                      <td>{(m.recall * 100).toFixed(1)}%</td>
                      <td>{(m.f1 * 100).toFixed(1)}%</td>
                      <td>{m.support}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
