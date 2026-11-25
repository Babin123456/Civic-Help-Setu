import { useState, useId } from 'react';
import {
  X,
  FileText,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Users,
  Copy,
  Check,
  Search,
  AlertTriangle
} from 'lucide-react';
import { summarizeCivicNotice } from '../../services/civicNoticeSummarizerService';
import { safeHttpUrl } from '../../utils/safeContent';

export default function CivicNoticeSummarizerModal({ isOpen, onClose, initialNotice = null }) {
  const headingId = useId();
  const [inputText, setInputText] = useState(initialNotice?.description || initialNotice?.text || '');
  const [inputTitle, setInputTitle] = useState(initialNotice?.title || '');
  const [inputSourceUrl, setInputSourceUrl] = useState(initialNotice?.sourceUrl || '');
  const [summary, setSummary] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleGenerateSummary = (e) => {
    e?.preventDefault();
    const result = summarizeCivicNotice({
      title: inputTitle,
      text: inputText,
      sourceUrl: inputSourceUrl
    });
    setSummary(result);
  };

  const handleCopySummary = async () => {
    if (!summary) return;
    const textToCopy = `CIVIC NOTICE SUMMARY: ${summary.title}
Purpose: ${summary.purpose}
Deadline: ${summary.primaryDeadline}
Target Audience: ${summary.audience}
Required Actions:
${summary.actions.map((a, i) => `${i + 1}. ${a}`).join('\n') || 'None explicitly specified'}
Official Source: ${summary.sourceUrl || 'Official Gazette / Bulletin'}`;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem'
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-main, #ffffff)',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-card, #f8fafc)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                color: 'var(--accent-main, #2563eb)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <FileText size={20} />
            </div>
            <div>
              <h2 id={headingId} style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                Civic Notice Summarizer & Deadline Extractor
              </h2>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Extract verified deadlines and mandatory action instructions without hallucinated assumptions.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="btn btn-secondary"
            style={{ padding: '0.35rem', borderRadius: '50%', border: 'none', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'grid', gap: '1.25rem' }}>
          {/* Notice Input Form */}
          <form onSubmit={handleGenerateSummary} style={{ display: 'grid', gap: '0.85rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                Notice Title / Subject (Optional)
              </label>
              <input
                type="text"
                value={inputTitle}
                onChange={(e) => setInputTitle(e.target.value)}
                placeholder="e.g. Mandatory Aadhaar e-KYC for PM-Kisan Beneficiaries"
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-main)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                Notice Full Text or Circular Excerpt
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                rows={4}
                required
                placeholder="Paste the full administrative notice or gazette notification text here..."
                style={{ width: '100%', padding: '0.65rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-main)', fontSize: '0.85rem', lineHeight: 1.4 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                Official Government Source URL
              </label>
              <input
                type="url"
                value={inputSourceUrl}
                onChange={(e) => setInputSourceUrl(e.target.value)}
                placeholder="https://..."
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-main)' }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.65rem 1rem' }}
            >
              <Search size={16} /> Summarize & Extract Deadlines
            </button>
          </form>

          {/* Generated Structured Summary Card */}
          {summary && (
            <div
              style={{
                border: '1px solid var(--border-main)',
                borderRadius: '12px',
                padding: '1.25rem',
                backgroundColor: 'var(--bg-card, #f8fafc)',
                display: 'grid',
                gap: '1rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent-main)' }}>
                    Extracted Notice Intelligence
                  </span>
                  <h3 style={{ margin: '0.2rem 0', fontSize: '1.1rem', fontWeight: 700 }}>{summary.title}</h3>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCopySummary}
                  style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : 'Copy Summary'}</span>
                </button>
              </div>

              {/* Purpose */}
              <div>
                <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'block', marginBottom: '0.25rem' }}>
                  Purpose / Core Announcement:
                </strong>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {summary.purpose}
                </p>
              </div>

              {/* Deadline Box */}
              <div
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: '8px',
                  backgroundColor: summary.hasDateAmbiguity
                    ? 'rgba(245, 158, 11, 0.1)'
                    : summary.deadlineStatus === 'EXPLICIT_DEADLINE'
                    ? 'rgba(22, 163, 74, 0.1)'
                    : 'rgba(100, 116, 139, 0.1)',
                  border: `1px solid ${
                    summary.hasDateAmbiguity
                      ? '#fcd34d'
                      : summary.deadlineStatus === 'EXPLICIT_DEADLINE'
                      ? '#86efac'
                      : '#cbd5e1'
                  }`
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                  {summary.hasDateAmbiguity ? (
                    <AlertTriangle size={16} color="#d97706" />
                  ) : summary.deadlineStatus === 'EXPLICIT_DEADLINE' ? (
                    <Calendar size={16} color="#16a34a" />
                  ) : (
                    <AlertCircle size={16} color="#64748b" />
                  )}
                  <strong style={{ fontSize: '0.88rem', color: summary.hasDateAmbiguity ? '#b45309' : summary.deadlineStatus === 'EXPLICIT_DEADLINE' ? '#15803d' : '#475569' }}>
                    {summary.hasDateAmbiguity ? 'Date Ambiguity Surfaced:' : 'Stated Filing Deadline:'} {summary.primaryDeadline}
                  </strong>
                </div>

                {summary.ambiguityNotice && (
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#b45309', lineHeight: 1.4 }}>
                    {summary.ambiguityNotice}
                  </p>
                )}

                {summary.deadlines.length > 0 && (
                  <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {summary.deadlines.map((d, i) => (
                      <li key={i}>
                        <strong>{d.dateString}</strong>: <em>{d.context}</em>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Actions Checklist */}
              <div>
                <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)', display: 'block', marginBottom: '0.35rem' }}>
                  Extracted Citizen Action Instructions ({summary.actions.length}):
                </strong>
                {summary.actions.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    No explicit action instructions found in the supplied notice text.
                  </p>
                ) : (
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.84rem', color: 'var(--text-secondary)', display: 'grid', gap: '0.35rem' }}>
                    {summary.actions.map((act, idx) => (
                      <li key={idx}>
                        <CheckCircle2 size={13} color="var(--accent-main)" style={{ display: 'inline', marginRight: '4px' }} />
                        {act}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Target Audience */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                <Users size={15} color="var(--accent-main)" />
                <span>{summary.audience}</span>
              </div>

              {/* Verified Source URL Link */}
              {summary.sourceUrl && (
                <div style={{ fontSize: '0.82rem', borderTop: '1px solid var(--border-main)', paddingTop: '0.5rem' }}>
                  <a
                    href={safeHttpUrl(summary.sourceUrl) || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent-main)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontWeight: 600 }}
                  >
                    <ExternalLink size={14} /> Verify Full Original Notice Document
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-main)',
            display: 'flex',
            justifyContent: 'flex-end',
            background: 'var(--bg-card, #f8fafc)'
          }}
        >
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
