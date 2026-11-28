import { useState, useMemo } from 'react';
import {
  Copy,
  Link2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  WifiOff,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import {
  LINK_DECISIONS,
  detectDuplicateAndRelatedCases,
  confirmCaseRelationship,
  listCaseLinks,
  evaluateDuplicateDetector,
} from '../services/civicCaseDuplicateDetectorService';

const SAMPLE_EXISTING_CASES = [
  {
    caseId: 'CASE-RC-2026-01',
    title: 'Ration Card Address Update',
    category: 'Ration Card',
    jurisdiction: 'Delhi Ward 5',
    confirmedReferenceId: 'RC/2026/441',
    submittedAt: '2026-11-24T10:00:00Z',
  },
  {
    caseId: 'CASE-WS-2026-09',
    title: 'Water Pipeline Pressure Issue',
    category: 'Water Supply',
    jurisdiction: 'Delhi Ward 5',
    confirmedReferenceId: 'WS/2026/009',
    submittedAt: '2026-11-25T10:00:00Z',
  },
];

export default function DuplicateCaseDetectorWorkspace() {
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const userId = user?.id || 'citizen_local';

  const [caseId, setCaseId] = useState('CASE-RC-2026-99');
  const [category, setCategory] = useState('Ration Card');
  const [jurisdiction, setJurisdiction] = useState('Delhi Ward 5');
  const [confirmedRef, setConfirmedRef] = useState('RC/2026/441');
  const [links, setLinks] = useState(() => {
    try {
      return listCaseLinks();
    } catch {
      return [];
    }
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [announcement, setAnnouncement] = useState('');

  const detection = useMemo(() => {
    try {
      return detectDuplicateAndRelatedCases(
        {
          caseId,
          category,
          jurisdiction,
          confirmedReferenceId: confirmedRef,
          submittedAt: new Date().toISOString(),
        },
        SAMPLE_EXISTING_CASES
      );
    } catch {
      return { primaryCaseId: caseId, suggestions: [], separateCaseIdsPreserved: true };
    }
  }, [caseId, category, jurisdiction, confirmedRef]);

  const evalMetrics = useMemo(() => evaluateDuplicateDetector(), []);

  const handleConfirm = (candidateCaseId, decision) => {
    setErrorMsg('');
    try {
      confirmCaseRelationship({
        primaryCaseId: caseId,
        candidateCaseId,
        decision,
        confirmedBy: userId,
        reason: `Human confirmed ${decision} while preserving separate case IDs`,
      });
      setLinks(listCaseLinks());
      setAnnouncement(`Recorded ${decision} between ${caseId} and ${candidateCaseId}. Separate case IDs preserved.`);
    } catch (err) {
      setErrorMsg(err.message || 'Confirmation failed.');
    }
  };

  return (
    <div className="section" style={{ padding: '1.5rem 1rem', maxWidth: '1100px', margin: '0 auto' }}>
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      <header style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-main, #e2e8f0)', paddingBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Copy size={28} color="var(--primary, #2563eb)" aria-hidden="true" />
          Civic Application Duplicate &amp; Related-Case Detector
        </h1>
        <p style={{ margin: '0.35rem 0 0', color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Explainable duplicate and related-case suggestions using category, jurisdiction, time window, and user-confirmed references. Explicit human confirmation is required and separate case IDs are always preserved.
        </p>
      </header>

      {!isOnline && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.4)', marginBottom: '1rem', fontSize: '0.88rem' }}>
          <WifiOff size={16} aria-hidden="true" />
          <span>Offline mode: local duplicate detection and link confirmations remain active.</span>
        </div>
      )}

      {errorMsg && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', background: 'rgba(239,68,68,0.1)', color: '#b91c1c', marginBottom: '1rem' }}>
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Candidate Case Inputs */}
      <section aria-label="Candidate Case Parameters" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-main, #e2e8f0)', background: 'var(--bg-card, #fff)', marginBottom: '1rem' }}>
        <div>
          <label htmlFor="dcd-id" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>Case ID</label>
          <input id="dcd-id" type="text" value={caseId} onChange={(e) => setCaseId(e.target.value)} style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '0.35rem', border: '1px solid var(--border-main, #cbd5e1)' }} />
        </div>
        <div>
          <label htmlFor="dcd-cat" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>Category</label>
          <input id="dcd-cat" type="text" value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '0.35rem', border: '1px solid var(--border-main, #cbd5e1)' }} />
        </div>
        <div>
          <label htmlFor="dcd-jur" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>Jurisdiction</label>
          <input id="dcd-jur" type="text" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '0.35rem', border: '1px solid var(--border-main, #cbd5e1)' }} />
        </div>
        <div>
          <label htmlFor="dcd-ref" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>Confirmed Reference (no PII)</label>
          <input id="dcd-ref" type="text" value={confirmedRef} onChange={(e) => setConfirmedRef(e.target.value)} style={{ width: '100%', padding: '0.4rem 0.6rem', borderRadius: '0.35rem', border: '1px solid var(--border-main, #cbd5e1)' }} />
        </div>
      </section>

      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <ShieldCheck size={15} color="#16a34a" aria-hidden="true" />
        Synthetic Fixture Eval — Precision: <strong>{evalMetrics.precision}</strong> &bull; Recall: <strong>{evalMetrics.recall}</strong> &bull; Separate Case IDs Preserved
      </div>

      {/* Suggestions */}
      <section aria-label="Duplicate and Related-Case Suggestions" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.75rem 0' }}>
          Suggested Matches ({detection.suggestions.length})
        </h2>
        {detection.suggestions.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>No duplicate or related cases detected for the current parameters.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {detection.suggestions.map((s) => (
              <div key={s.candidateCaseId} style={{ padding: '0.9rem 1rem', borderRadius: '0.6rem', border: '1px solid var(--border-light, #e2e8f0)', background: 'var(--bg-card, #fff)', fontSize: '0.84rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <strong>{s.candidateCaseId}</strong> — {s.candidateTitle}
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '999px', background: '#fff8e1', color: '#f57f17' }}>
                      System Suggestion (Confirm)
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px', background: s.classification === 'LIKELY_DUPLICATE' ? '#fee2e2' : '#e0f2fe', color: s.classification === 'LIKELY_DUPLICATE' ? '#991b1b' : '#0369a1' }}>
                      {s.classification} ({Math.round(s.confidence * 100)}%)
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                  Confidence Reasons: {s.confidenceReasons.join(' • ')}
                </div>
                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.6rem' }}>
                  <button type="button" onClick={() => handleConfirm(s.candidateCaseId, LINK_DECISIONS.LINK_DUPLICATE)} style={{ padding: '0.25rem 0.6rem', borderRadius: '0.35rem', border: 'none', background: '#2563eb', color: '#fff', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Link2 size={12} aria-hidden="true" /> Confirm Duplicate (Keep Separate IDs)
                  </button>
                  <button type="button" onClick={() => handleConfirm(s.candidateCaseId, LINK_DECISIONS.LINK_RELATED)} style={{ padding: '0.25rem 0.6rem', borderRadius: '0.35rem', border: '1px solid #2563eb', background: 'transparent', color: '#2563eb', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <CheckCircle2 size={12} aria-hidden="true" /> Link as Related
                  </button>
                  <button type="button" onClick={() => handleConfirm(s.candidateCaseId, LINK_DECISIONS.MARK_DISTINCT)} style={{ padding: '0.25rem 0.6rem', borderRadius: '0.35rem', border: '1px solid #64748b', background: 'transparent', color: '#475569', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <XCircle size={12} aria-hidden="true" /> Mark Distinct
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {links.length > 0 && (
        <section aria-label="Confirmed Case Links">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
            Confirmed Case Links ({links.length})
          </h3>
          {links.slice(0, 5).map((l) => (
            <div key={l.linkId} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              {l.primaryCaseId} &harr; {l.candidateCaseId}: <strong>{l.decision}</strong> (Separate IDs preserved)
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
