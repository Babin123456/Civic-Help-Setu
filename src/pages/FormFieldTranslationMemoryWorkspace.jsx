import { useState, useMemo } from 'react';
import {
  Languages,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  WifiOff,
  Scale,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNetwork } from '../context/NetworkContext';
import {
  SUPPORTED_LANGUAGES,
  listFormFieldTranslations,
  resolveFormFieldLabel,
  proposeFormFieldTranslation,
  approveFormFieldTranslation,
} from '../services/formFieldTranslationMemoryExtension';

export default function FormFieldTranslationMemoryWorkspace() {
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const currentUserId = user?.id || 'contributor_local';

  const [entries, setEntries] = useState(() => {
    try {
      return listFormFieldTranslations();
    } catch {
      return [];
    }
  });
  const [lookupPhrase, setLookupPhrase] = useState('Annual Family Income');
  const [targetLang, setTargetLang] = useState('hi');
  const [newSource, setNewSource] = useState('');
  const [newTranslation, setNewTranslation] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [announcement, setAnnouncement] = useState('');

  const resolved = useMemo(
    () => resolveFormFieldLabel({ sourcePhrase: lookupPhrase, targetLanguage: targetLang }),
    [lookupPhrase, targetLang]
  );

  const handlePropose = (e) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const created = proposeFormFieldTranslation({
        sourcePhrase: newSource,
        proposedTranslation: newTranslation,
        language: targetLang,
        proposedBy: currentUserId,
      });
      setNewSource('');
      setNewTranslation('');
      setEntries(listFormFieldTranslations());
      setAnnouncement(`Proposed translation for "${created.sourcePhrase}" (${created.language}/${created.script}).`);
    } catch (err) {
      setErrorMsg(err.message || 'Proposal failed.');
    }
  };

  const handleReview = (entryId, decision) => {
    setErrorMsg('');
    try {
      const reviewerId = entries.find((e) => e.entryId === entryId)?.proposedBy === currentUserId
        ? 'reviewer_admin_1'
        : currentUserId;
      approveFormFieldTranslation({
        entryId,
        reviewerId,
        reviewerRole: 'reviewer',
        decision,
      });
      setEntries(listFormFieldTranslations());
      setAnnouncement(`Translation ${entryId} ${decision === 'APPROVE' ? 'approved' : 'rejected'}.`);
    } catch (err) {
      setErrorMsg(err.message || 'Review failed.');
    }
  };

  return (
    <div className="section" style={{ padding: '1.5rem 1rem', maxWidth: '1100px', margin: '0 auto' }}>
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>

      <header style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-main, #e2e8f0)', paddingBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Languages size={28} color="var(--primary, #2563eb)" aria-hidden="true" />
          Multilingual Civic Form Field Translation Memory
        </h1>
        <p style={{ margin: '0.35rem 0 0', color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Governed terminology registry storing source phrases, approved translations, language/script, reviewer, and version — with automatic fallback to original wording and mandatory human review for legal terms.
        </p>
      </header>

      {!isOnline && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.4)', marginBottom: '1rem', fontSize: '0.88rem' }}>
          <WifiOff size={16} aria-hidden="true" />
          <span>Offline mode: local terminology memory and fallback resolution remain active.</span>
        </div>
      )}

      {errorMsg && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', background: 'rgba(239,68,68,0.1)', color: '#b91c1c', marginBottom: '1rem' }}>
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Live Lookup with Fallback */}
      <section aria-label="Form Field Label Lookup" style={{ padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-main, #e2e8f0)', background: 'var(--bg-card, #fff)', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.75rem 0' }}>
          Lookup Form Field Label (with Original Wording Fallback)
        </h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <input
            type="text"
            aria-label="Source form field phrase"
            value={lookupPhrase}
            onChange={(e) => setLookupPhrase(e.target.value)}
            style={{ flex: '1 1 240px', padding: '0.45rem 0.7rem', borderRadius: '0.4rem', border: '1px solid var(--border-main, #cbd5e1)' }}
          />
          <select
            aria-label="Target language"
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            style={{ padding: '0.45rem 0.7rem', borderRadius: '0.4rem', border: '1px solid var(--border-main, #cbd5e1)' }}
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label} ({l.script})</option>
            ))}
          </select>
        </div>
        <div style={{ padding: '0.7rem 0.9rem', borderRadius: '0.45rem', background: resolved.fallbackUsed ? '#fef9c3' : '#dcfce7', fontSize: '0.86rem' }}>
          <strong>Resolved Label:</strong> {resolved.label}
          <div style={{ fontSize: '0.76rem', marginTop: '0.2rem' }}>
            {resolved.fallbackUsed
              ? resolved.fallbackReason
              : `Approved v${resolved.version} • Script: ${resolved.script} • Reviewer: ${resolved.reviewer}`}
          </div>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Left: Propose Translation */}
        <section aria-label="Propose Form Field Translation" style={{ padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--border-main, #e2e8f0)', background: 'var(--bg-card, #fff)' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.85rem 0' }}>Propose Translation</h2>
          <form onSubmit={handlePropose} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <label htmlFor="tm-source" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem' }}>Source Phrase (English)</label>
              <input id="tm-source" type="text" value={newSource} onChange={(e) => setNewSource(e.target.value)} placeholder="e.g. Caste Certificate Affidavit" style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '0.4rem', border: '1px solid var(--border-main, #cbd5e1)' }} />
            </div>
            <div>
              <label htmlFor="tm-trans" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem' }}>Proposed Translation</label>
              <input id="tm-trans" type="text" value={newTranslation} onChange={(e) => setNewTranslation(e.target.value)} placeholder="Translated form label" style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '0.4rem', border: '1px solid var(--border-main, #cbd5e1)' }} />
            </div>
            <button type="submit" style={{ padding: '0.55rem 1rem', borderRadius: '0.5rem', border: 'none', background: 'var(--primary, #2563eb)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              Submit for Human Review
            </button>
          </form>
        </section>

        {/* Right: Terminology Registry */}
        <section aria-label="Terminology Registry" style={{ padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--border-main, #e2e8f0)', background: 'var(--bg-card, #fff)' }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.85rem 0' }}>
            Terminology Registry ({entries.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {entries.map((entry) => (
              <div key={entry.entryId} style={{ padding: '0.7rem 0.85rem', borderRadius: '0.45rem', border: '1px solid var(--border-light, #e2e8f0)', fontSize: '0.82rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <strong>{entry.sourcePhrase} &rarr; {entry.approvedTranslation || entry.proposedTranslation}</strong>
                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    {entry.isLegalTerm && (
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: '999px', background: '#fef3c7', color: '#92400e', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                        <Scale size={11} aria-hidden="true" /> Legal Term (Human Review)
                      </span>
                    )}
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: '999px', background: entry.status === 'approved' ? '#dcfce7' : '#f1f5f9', color: entry.status === 'approved' ? '#166534' : '#475569' }}>
                      {entry.status} v{entry.version}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  Lang/Script: {entry.language} ({entry.script}) {entry.reviewer ? `• Reviewer: ${entry.reviewer}` : ''}
                </div>
                {entry.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.45rem' }}>
                    <button type="button" onClick={() => handleReview(entry.entryId, 'APPROVE')} style={{ padding: '0.2rem 0.55rem', borderRadius: '0.3rem', border: 'none', background: '#16a34a', color: '#fff', fontSize: '0.74rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                      <CheckCircle2 size={12} aria-hidden="true" /> Approve
                    </button>
                    <button type="button" onClick={() => handleReview(entry.entryId, 'REJECT')} style={{ padding: '0.2rem 0.55rem', borderRadius: '0.3rem', border: 'none', background: '#dc2626', color: '#fff', fontSize: '0.74rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                      <XCircle size={12} aria-hidden="true" /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
