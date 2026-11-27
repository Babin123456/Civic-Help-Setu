/**
 * src/pages/GrievanceCompletenessCoachWorkspace.jsx
 *
 * Accessible Public Grievance Language Quality & Completeness Coach (#1444).
 * Highlights missing fields, provides neutral wording suggestions with explicit
 * user approval, preserves original citizen text verbatim, and supports multilingual prompts.
 */

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  Languages,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  UserCheck,
  WifiOff,
} from 'lucide-react';
import {
  analyzeAndSaveLocalDraft,
  decideLocalDraftSuggestion,
  loadLocalCoachState,
} from '../services/grievanceCompletenessCoachStorage.js';

const LANG_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'bn', label: 'বাংলা (Bengali)' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
];

export default function GrievanceCompletenessCoachWorkspace() {
  const initial = (() => {
    try {
      const loaded = loadLocalCoachState();
      return {
        status: loaded.drafts.length === 0 ? 'empty' : 'ready',
        errorMsg: '',
        data: loaded,
        activeDraft: loaded.drafts[0] || null,
      };
    } catch (err) {
      return {
        status: 'error',
        errorMsg: err?.message || 'Unable to load completeness coach.',
        data: null,
        activeDraft: null,
      };
    }
  })();

  const [viewStatus, setViewStatus] = useState(initial.status);
  const [errorMsg, setErrorMsg] = useState(initial.errorMsg);
  const [activeDraft, setActiveDraft] = useState(initial.activeDraft);
  const [language, setLanguage] = useState(initial.activeDraft?.language || 'en');
  const [draftInput, setDraftInput] = useState('');
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

  const handleAnalyze = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setNotice('');
    try {
      const { draft } = analyzeAndSaveLocalDraft({
        originalText: draftInput,
        language,
        jurisdiction: 'IN-UP',
      });
      setActiveDraft(draft);
      setViewStatus('ready');
      setNotice(`Draft analyzed locally (${draft.completenessScore}% complete). Original text preserved.`);
    } catch (err) {
      setErrorMsg(err?.message || 'Unable to analyze draft.');
    }
  };

  const handleDecision = (suggestionId, decision) => {
    if (!activeDraft) return;
    setErrorMsg('');
    setNotice('');
    try {
      const { draft } = decideLocalDraftSuggestion(activeDraft.draftId, { suggestionId, decision });
      setActiveDraft(draft);
      setNotice(`Suggestion ${decision === 'approve' ? 'approved' : 'rejected'}; original citizen text preserved.`);
    } catch (err) {
      setErrorMsg(err?.message || 'Unable to update suggestion.');
    }
  };

  return (
    <main className="section" aria-labelledby="coach-heading">
      <div className="container" style={{ maxWidth: '1120px', margin: '0 auto' }}>
        <header className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
            <div>
              <h1 id="coach-heading" style={{ margin: 0, fontSize: '1.65rem' }}>
                Public Grievance Language Quality &amp; Completeness Coach
              </h1>
              <p style={{ marginTop: '0.4rem', opacity: 0.85 }}>
                Local-first drafting coach that highlights missing fields, offers neutral wording suggestions with explicit user approval, and preserves your original text verbatim.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="badge" data-origin="citizen_entered_fact">
                <UserCheck size={14} aria-hidden="true" /> Citizen-Entered Draft
              </span>
              <span className="badge" data-origin="ai_community_suggestion">
                <Sparkles size={14} aria-hidden="true" /> Coach Suggestion (Approval Required)
              </span>
              <span className="badge" data-origin="official_record">
                <FileCheck2 size={14} aria-hidden="true" /> Official Filing Rule
              </span>
            </div>
          </div>
        </header>

        {isOffline && (
          <div role="status" aria-live="polite" className="glass-panel" style={{ padding: '0.9rem 1.2rem', marginBottom: '1rem', borderLeft: '4px solid #f59e0b', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <WifiOff size={18} aria-hidden="true" />
            <span><strong>Offline Mode:</strong> Local-first completeness and neutral-wording checks active without network calls.</span>
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

        {/* Draft Input */}
        <section className="glass-panel" aria-labelledby="draft-form-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
          <h2 id="draft-form-heading" style={{ marginTop: 0, fontSize: '1.15rem' }}>
            Draft Your Grievance (Zero PII)
          </h2>
          <form onSubmit={handleAnalyze} style={{ display: 'grid', gap: '0.85rem' }}>
            <div>
              <label htmlFor="cqc-lang" style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginRight: '0.5rem' }}>
                <Languages size={16} aria-hidden="true" /> Prompt Language
              </label>
              <select id="cqc-lang" value={language} onChange={(e) => setLanguage(e.target.value)} style={{ padding: '0.4rem' }}>
                {LANG_OPTIONS.map((opt) => (
                  <option key={opt.code} value={opt.code}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="cqc-text" style={{ display: 'block', fontWeight: 600 }}>
                Complaint Text (Do not include Aadhaar, PAN, OTP, password, or phone numbers)
              </label>
              <textarea
                id="cqc-text"
                rows={3}
                value={draftInput}
                onChange={(e) => setDraftInput(e.target.value)}
                placeholder="Describe the civic issue, date, location, requested outcome, and any reference number..."
                required
                style={{ width: '100%', padding: '0.5rem' }}
              />
            </div>
            <div>
              <button type="submit" className="btn btn-primary">
                Check Completeness &amp; Clarity
              </button>
            </div>
          </form>
        </section>

        {viewStatus === 'empty' && (
          <section className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
            <h2>No Grievance Drafts Analyzed</h2>
            <p>Enter a complaint draft above to receive multilingual completeness prompts and neutral wording suggestions.</p>
          </section>
        )}

        {viewStatus === 'ready' && activeDraft && (
          <>
            <section className="glass-panel" aria-labelledby="missing-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
              <h2 id="missing-heading" style={{ marginTop: 0, fontSize: '1.15rem' }}>
                Completeness Score: {activeDraft.completenessScore}% ({activeDraft.missingFields.length} Missing Field(s))
              </h2>
              {activeDraft.missingFields.length === 0 ? (
                <p>All key fields (date, location, requested outcome, supporting reference) are present.</p>
              ) : (
                <ul>
                  {activeDraft.missingFields.map((mf) => (
                    <li key={mf.field} style={{ marginBottom: '0.45rem' }}>
                      <strong>{mf.label}:</strong> {mf.prompt}
                    </li>
                  ))}
                </ul>
              )}
              <div style={{ fontSize: '0.85rem', opacity: 0.85 }}>
                Official Rule: {activeDraft.officialRule.source} ({activeDraft.officialRule.jurisdiction} • {activeDraft.officialRule.verified ? `Verified ${activeDraft.officialRule.effectiveDate}` : 'Unverified'})
              </div>
            </section>

            <section className="glass-panel" aria-labelledby="suggestions-heading" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
              <h2 id="suggestions-heading" style={{ marginTop: 0, fontSize: '1.15rem' }}>
                Neutral Wording Suggestions ({activeDraft.suggestions.length})
              </h2>
              {activeDraft.suggestions.length === 0 ? (
                <p>No loaded or accusatory phrases detected.</p>
              ) : (
                <ul>
                  {activeDraft.suggestions.map((sug) => (
                    <li key={sug.id} style={{ marginBottom: '0.75rem' }}>
                      <div>
                        Replace <code>{sug.originalPhrase}</code> → <strong>{sug.suggestedPhrase}</strong> ({sug.status})
                      </div>
                      <div style={{ fontSize: '0.85rem', opacity: 0.85 }}>{sug.reason}</div>
                      {sug.status === 'pending_approval' && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
                          <button type="button" className="btn btn-primary" onClick={() => handleDecision(sug.id, 'approve')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <ThumbsUp size={14} aria-hidden="true" /> Approve Suggestion
                          </button>
                          <button type="button" className="btn" onClick={() => handleDecision(sug.id, 'reject')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <ThumbsDown size={14} aria-hidden="true" /> Reject
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="glass-panel" aria-labelledby="comparison-heading" style={{ padding: '1.25rem' }}>
              <h2 id="comparison-heading" style={{ marginTop: 0, fontSize: '1.15rem' }}>
                Preserved Original Text vs. User-Approved Draft
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem' }}>Original Citizen Text (Preserved Verbatim)</h3>
                  <p>{activeDraft.originalText}</p>
                </div>
                <div>
                  <h3 style={{ fontSize: '0.95rem' }}>User-Approved Draft</h3>
                  <p>{activeDraft.approvedDraftText}</p>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
