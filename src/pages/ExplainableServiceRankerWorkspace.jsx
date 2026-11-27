import { useState, useMemo } from 'react';
import {
  SlidersHorizontal,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  WifiOff,
} from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';
import {
  TASK_STAGES,
  rankCivicServices,
  evaluateRankerOffline,
} from '../services/explainableServiceRanker';

export default function ExplainableServiceRankerWorkspace() {
  const { isOnline } = useNetwork();
  const [query, setQuery] = useState('');
  const [jurisdiction, setJurisdiction] = useState('All');
  const [taskStage, setTaskStage] = useState('discovery');
  const [intentOverride, setIntentOverride] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const ranking = useMemo(() => {
    try {
      return rankCivicServices({ query, jurisdiction, taskStage, intentOverride });
    } catch {
      return { results: [], fallbackUsed: true };
    }
  }, [query, jurisdiction, taskStage, intentOverride]);

  const evalSummary = useMemo(() => evaluateRankerOffline(), []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');
  };

  return (
    <div className="section" style={{ padding: '1.5rem 1rem', maxWidth: '1100px', margin: '0 auto' }}>
      <header style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-main, #e2e8f0)', paddingBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <SlidersHorizontal size={28} color="var(--primary, #2563eb)" aria-hidden="true" />
          Explainable Civic Service Recommendation Ranker
        </h1>
        <p style={{ margin: '0.35rem 0 0', color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Transparent multi-factor service ranking combining query relevance, jurisdiction match, task stage, and verified freshness — with zero sensitive-feature inference and explicit intent correction.
        </p>
      </header>

      {!isOnline && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.4)', marginBottom: '1rem', fontSize: '0.88rem' }}>
          <WifiOff size={16} aria-hidden="true" />
          <span>Offline mode: deterministic local ranking continues without network access.</span>
        </div>
      )}

      {errorMsg && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', background: 'rgba(239,68,68,0.1)', color: '#b91c1c', marginBottom: '1rem' }}>
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-main, #e2e8f0)', background: 'var(--bg-card, #fff)' }}>
        <div>
          <label htmlFor="rank-query" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem' }}>
            Service Query
          </label>
          <input
            id="rank-query"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. income certificate, ration card"
            style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '0.4rem', border: '1px solid var(--border-main, #cbd5e1)' }}
          />
        </div>

        <div>
          <label htmlFor="rank-jur" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem' }}>
            Jurisdiction
          </label>
          <select
            id="rank-jur"
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '0.4rem', border: '1px solid var(--border-main, #cbd5e1)' }}
          >
            <option value="All">All India</option>
            <option value="Delhi">Delhi</option>
            <option value="Maharashtra">Maharashtra</option>
            <option value="Karnataka">Karnataka</option>
            <option value="Uttar Pradesh">Uttar Pradesh</option>
          </select>
        </div>

        <div>
          <label htmlFor="rank-stage" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem' }}>
            Task Stage
          </label>
          <select
            id="rank-stage"
            value={taskStage}
            onChange={(e) => setTaskStage(e.target.value)}
            style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '0.4rem', border: '1px solid var(--border-main, #cbd5e1)' }}
          >
            {TASK_STAGES.map((st) => (
              <option key={st.id} value={st.id}>{st.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="rank-intent" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem' }}>
            Correct Intent (Optional)
          </label>
          <input
            id="rank-intent"
            type="text"
            value={intentOverride}
            onChange={(e) => setIntentOverride(e.target.value)}
            placeholder="e.g. grievance or pension"
            style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '0.4rem', border: '1px solid var(--border-main, #cbd5e1)' }}
          />
        </div>
      </form>

      {/* Fairness & Offline Eval Summary */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <ShieldCheck size={15} color="#16a34a" aria-hidden="true" />
          Fairness Invariance: <strong>{evalSummary.fairnessInvariantPassed ? 'PASSED' : 'FAILED'}</strong> &bull; Offline MRR: <strong>{evalSummary.mrr}</strong>
        </span>
        {ranking.fallbackUsed && (
          <span style={{ padding: '0.15rem 0.55rem', borderRadius: '999px', background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
            Deterministic Fallback Active
          </span>
        )}
      </div>

      {/* Ranked Results with Visible Explanation Factors */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {ranking.results.map((r, idx) => (
          <article key={r.id} style={{ padding: '1rem', borderRadius: '0.6rem', border: '1px solid var(--border-light, #e2e8f0)', background: 'var(--bg-card, #fff)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span style={{ fontWeight: 700, marginRight: '0.4rem', color: 'var(--primary, #2563eb)' }}>#{idx + 1}</span>
                <strong>{r.title}</strong>
                <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  ({r.department} &bull; {r.jurisdiction})
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '999px', background: '#e3f2fd', color: '#1565c0' }}>
                  Official Catalogue
                </span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: '999px', background: '#f1f5f9', color: '#334155' }}>
                  Score: {r.score.toFixed(2)}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginTop: '0.65rem', fontSize: '0.76rem' }}>
              {r.explanationFactors.map((f) => (
                <div key={f.factor} style={{ padding: '0.45rem 0.6rem', borderRadius: '0.4rem', background: 'rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                    <span><Sparkles size={11} aria-hidden="true" /> {f.factor}</span>
                    <span>{f.score.toFixed(2)} / {f.maxScore.toFixed(2)}</span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{f.rationale}</div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
