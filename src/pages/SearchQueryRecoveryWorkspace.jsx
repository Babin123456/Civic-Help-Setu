import { useState } from 'react';
import {
  Search,
  Lock,
  Languages,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  WifiOff,
} from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';
import {
  understandAndRecoverQuery,
  recordReviewedQueryEvaluation,
  listQueryEvaluations,
} from '../services/civicSearchQueryRecoveryService';

export default function SearchQueryRecoveryWorkspace() {
  const { isOnline } = useNetwork();
  const [queryInput, setQueryInput] = useState('');
  const [recovery, setRecovery] = useState(null);
  const [forceOriginal, setForceOriginal] = useState(false);
  const [evaluations, setEvaluations] = useState(() => {
    try {
      return listQueryEvaluations();
    } catch {
      return [];
    }
  });
  const [errorMsg, setErrorMsg] = useState('');
  const [announcement, setAnnouncement] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setForceOriginal(false);
    if (!queryInput.trim()) {
      setErrorMsg('Please enter a civic search query.');
      return;
    }
    try {
      const res = understandAndRecoverQuery(queryInput);
      setRecovery(res);
      setAnnouncement(
        res.hasCorrection
          ? `Showing recovered results for "${res.correctedQuery}". Original query "${res.originalQuery}" preserved.`
          : `Searched for "${res.originalQuery}".`
      );
    } catch (err) {
      setErrorMsg(err.message || 'Search recovery failed.');
    }
  };

  const handleEvaluate = (accepted) => {
    if (!recovery) return;
    setErrorMsg('');
    try {
      recordReviewedQueryEvaluation({
        originalQuery: recovery.originalQuery,
        correctedQuery: recovery.correctedQuery,
        accepted,
      });
      setEvaluations(listQueryEvaluations());
      setAnnouncement(`Recorded query evaluation as ${accepted ? 'Helpful' : 'Needs Tuning'}.`);
    } catch (err) {
      setErrorMsg(err.message || 'Could not save evaluation.');
    }
  };

  return (
    <div className="section" style={{ padding: '1.5rem 1rem', maxWidth: '1050px', margin: '0 auto' }}>
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      <header style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-main, #e2e8f0)', paddingBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Languages size={28} color="var(--primary, #2563eb)" aria-hidden="true" />
          Civic Search Query Understanding &amp; Spelling Recovery
        </h1>
        <p style={{ margin: '0.35rem 0 0', color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Typo-tolerant civic search with Indic transliteration and curated department synonyms. Your original query is always preserved and legal identifiers (such as Form numbers, Sections, or PIN codes) are never altered.
        </p>
      </header>

      {!isOnline && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.4)', marginBottom: '1rem', fontSize: '0.88rem' }}>
          <WifiOff size={16} aria-hidden="true" />
          <span>Offline mode: query normalization and local civic catalogue search remain available.</span>
        </div>
      )}

      {errorMsg && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', color: '#b91c1c', marginBottom: '1rem', fontSize: '0.88rem' }}>
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <label htmlFor="sqr-input" className="sr-only">Civic Search Query</label>
        <input
          id="sqr-input"
          type="text"
          value={queryInput}
          onChange={(e) => setQueryInput(e.target.value)}
          placeholder="Try: 'incme certficate Form 16' or 'aay praman patra' or 'bijli'"
          style={{ flex: '1 1 280px', padding: '0.6rem 0.9rem', borderRadius: '0.5rem', border: '1px solid var(--border-main, #cbd5e1)', fontSize: '0.95rem' }}
        />
        <button
          type="submit"
          style={{ padding: '0.6rem 1.25rem', borderRadius: '0.5rem', border: 'none', background: 'var(--primary, #2563eb)', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Search size={16} aria-hidden="true" />
          Search &amp; Recover
        </button>
      </form>

      {!recovery ? (
        <div style={{ padding: '2rem 1rem', textAlign: 'center', borderRadius: '0.75rem', border: '1px dashed var(--border-main, #cbd5e1)', color: 'var(--text-secondary)' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Enter a search query above</p>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
            Supports spelling typos, Devanagari/Hinglish terms, department synonyms, and protected legal identifiers.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Transparency Banner */}
          <div style={{ padding: '1rem', borderRadius: '0.6rem', border: '1px solid var(--border-main, #e2e8f0)', background: 'var(--bg-card, #fff)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <strong>Original Query:</strong> <code>{recovery.originalQuery}</code>
                {recovery.hasCorrection && !forceOriginal && (
                  <div style={{ marginTop: '0.25rem', fontSize: '0.9rem' }}>
                    <strong>Showing results for:</strong> <span style={{ color: 'var(--primary, #2563eb)', fontWeight: 700 }}>{recovery.correctedQuery}</span>
                  </div>
                )}
              </div>
              {recovery.hasCorrection && (
                <button
                  type="button"
                  onClick={() => setForceOriginal((v) => !v)}
                  style={{ padding: '0.3rem 0.7rem', borderRadius: '0.4rem', border: '1px solid var(--border-main, #cbd5e1)', background: 'transparent', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  {forceOriginal ? 'Use Recovered Query' : 'Search Original Query Instead'}
                </button>
              )}
            </div>

            {recovery.lockedLegalTokens.length > 0 && (
              <div style={{ marginTop: '0.6rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <Lock size={13} aria-hidden="true" />
                <span>Protected Legal Identifiers (never altered):</span>
                {recovery.lockedLegalTokens.map((tok, i) => (
                  <span key={`${tok}-${i}`} style={{ padding: '0.1rem 0.45rem', borderRadius: '0.3rem', background: '#e0f2fe', color: '#0369a1', fontFamily: 'monospace', fontWeight: 600 }}>
                    {tok}
                  </span>
                ))}
              </div>
            )}

            {(recovery.corrections.length > 0 || recovery.transliterations.length > 0 || recovery.synonymsApplied.length > 0) && (
              <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.76rem' }}>
                {recovery.corrections.map((c, idx) => (
                  <span key={`corr-${idx}`} style={{ padding: '0.15rem 0.5rem', borderRadius: '999px', background: '#fef9c3', color: '#854d0e' }}>
                    Typo: {c.original} &rarr; {c.corrected}
                  </span>
                ))}
                {recovery.transliterations.map((t, idx) => (
                  <span key={`tr-${idx}`} style={{ padding: '0.15rem 0.5rem', borderRadius: '999px', background: '#ede9fe', color: '#5b21b6' }}>
                    Transliteration: {t.from} &rarr; {t.to}
                  </span>
                ))}
                {recovery.synonymsApplied.map((s, idx) => (
                  <span key={`syn-${idx}`} style={{ padding: '0.15rem 0.5rem', borderRadius: '999px', background: '#dcfce7', color: '#166534' }}>
                    Synonym: {s.from} &rarr; {s.to}
                  </span>
                ))}
              </div>
            )}

            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.78rem' }}>
              <span>Reviewed Query Evaluation:</span>
              <button
                type="button"
                onClick={() => handleEvaluate(true)}
                style={{ padding: '0.2rem 0.55rem', borderRadius: '0.3rem', border: '1px solid #16a34a', background: 'transparent', color: '#16a34a', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
              >
                <CheckCircle2 size={12} aria-hidden="true" /> Helpful
              </button>
              <button
                type="button"
                onClick={() => handleEvaluate(false)}
                style={{ padding: '0.2rem 0.55rem', borderRadius: '0.3rem', border: '1px solid #dc2626', background: 'transparent', color: '#dc2626', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
              >
                <XCircle size={12} aria-hidden="true" /> Needs Tuning
              </button>
              <span style={{ color: 'var(--text-secondary)' }}>({evaluations.length} logged)</span>
            </div>
          </div>

          {/* Results */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {recovery.results.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No matching services found in the official catalogue.</p>
            ) : (
              recovery.results.map((r) => (
                <div key={r.id} style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-light, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <strong>{r.title}</strong>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{r.category}</div>
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '999px', background: '#e3f2fd', color: '#1565c0' }}>
                    Official Catalogue
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
