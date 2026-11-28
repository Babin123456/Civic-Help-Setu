import { useState, useMemo } from 'react';
import {
  FileText,
  AlertTriangle,
  WifiOff,
  Scale,
  BookOpen,
} from 'lucide-react';
import { useNetwork } from '../context/NetworkContext';
import { explainGovernmentNoticeOrOrder } from '../services/noticeOrderExplainerService';

const SAMPLE_NOTICE =
  'Pursuant to Revenue Department Circular No. 14/2026, all applicants shall furnish an updated income certificate before 31/12/2026.\n\n' +
  '---PAGE---\n\n' +
  'Applicants who face delays may submit a formal grievance to the District Magistrate Office. Processing times may vary depending on ward verification.';

export default function NoticeOrderExplainerWorkspace() {
  const { isOnline } = useNetwork();
  const [title, setTitle] = useState('Revenue Department Circular #14/2026');
  const [noticeText, setNoticeText] = useState(SAMPLE_NOTICE);
  const [ocrScore, setOcrScore] = useState(0.92);
  const [errorMsg, setErrorMsg] = useState('');

  const explanation = useMemo(() => {
    try {
      return explainGovernmentNoticeOrOrder({
        title,
        text: noticeText,
        ocrConfidence: Number(ocrScore),
      });
    } catch {
      return null;
    }
  }, [title, noticeText, ocrScore]);

  const handleAnalyze = (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!noticeText.trim()) {
      setErrorMsg('Please paste official notice or order text.');
    }
  };

  return (
    <div className="section" style={{ padding: '1.5rem 1rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--border-main, #e2e8f0)', paddingBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <BookOpen size={28} color="var(--primary, #2563eb)" aria-hidden="true" />
          Plain-Language Government Notice &amp; Order Explainer
        </h1>
        <p style={{ margin: '0.35rem 0 0', color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          Side-by-side authoritative official notice text and plain-language summaries with page/paragraph citations, OCR confidence, and uncertainty flags.
        </p>
      </header>

      {!isOnline && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.4)', marginBottom: '1rem', fontSize: '0.88rem' }}>
          <WifiOff size={16} aria-hidden="true" />
          <span>Offline mode: deterministic local notice parsing remains active.</span>
        </div>
      )}

      {errorMsg && (
        <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: '0.5rem', background: 'rgba(239,68,68,0.1)', color: '#b91c1c', marginBottom: '1rem' }}>
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Authoritative Notice Disclaimer */}
      <div role="note" style={{ padding: '0.75rem 1rem', borderRadius: '0.5rem', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e3a8a', fontSize: '0.84rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Scale size={16} aria-hidden="true" />
        <span><strong>Official Text Remains Authoritative:</strong> Plain-language summaries are assistive only; verify every claim against the cited passage.</span>
      </div>

      {/* Input Controls */}
      <form onSubmit={handleAnalyze} style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.5rem', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-main, #e2e8f0)', background: 'var(--bg-card, #fff)' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px' }}>
            <label htmlFor="ne-title" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem' }}>Notice / Order Title</label>
            <input id="ne-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '0.4rem', border: '1px solid var(--border-main, #cbd5e1)' }} />
          </div>
          <div style={{ flex: '0 1 180px' }}>
            <label htmlFor="ne-ocr" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem' }}>OCR Confidence (0-1)</label>
            <input id="ne-ocr" type="number" step="0.05" min="0" max="1" value={ocrScore} onChange={(e) => setOcrScore(e.target.value)} style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: '0.4rem', border: '1px solid var(--border-main, #cbd5e1)' }} />
          </div>
        </div>
        <div>
          <label htmlFor="ne-text" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem' }}>Official Notice Text (use ---PAGE--- for page breaks)</label>
          <textarea id="ne-text" rows={4} value={noticeText} onChange={(e) => setNoticeText(e.target.value)} style={{ width: '100%', padding: '0.5rem 0.7rem', borderRadius: '0.4rem', border: '1px solid var(--border-main, #cbd5e1)', fontFamily: 'inherit' }} />
        </div>
      </form>

      {!explanation ? (
        <p>Enter notice text above to generate a side-by-side plain-language breakdown.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.82rem' }}>
            <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', background: explanation.ocrLowConfidenceFlag ? '#fee2e2' : '#dcfce7', color: explanation.ocrLowConfidenceFlag ? '#991b1b' : '#166534', fontWeight: 700 }}>
              OCR Confidence: {Math.round(explanation.ocrConfidence * 100)}%
            </span>
            <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', background: '#f1f5f9', color: '#334155', fontWeight: 600 }}>
              Verification: {explanation.verificationStatus}
            </span>
          </div>

          {/* Side-by-Side Sections */}
          {explanation.sections.map((sec) => (
            <div key={sec.sectionId} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', padding: '1rem', borderRadius: '0.6rem', border: '1px solid var(--border-light, #e2e8f0)', background: 'var(--bg-card, #fff)' }}>
              <div>
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <FileText size={13} aria-hidden="true" />
                  Authoritative Official Text ({sec.citation})
                </div>
                <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-primary)' }}>{sec.originalPassage}</p>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem', flexWrap: 'wrap', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--primary, #2563eb)' }}>
                    Plain-Language Summary ({sec.citation})
                  </span>
                  {sec.uncertaintyFlag && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.45rem', borderRadius: '999px', background: '#fef9c3', color: '#854d0e' }}>
                      Uncertainty Flag
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-primary)' }}>{sec.plainLanguageSummary}</p>
                {sec.uncertaintyReason && (
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.74rem', color: '#854d0e' }}>{sec.uncertaintyReason}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
