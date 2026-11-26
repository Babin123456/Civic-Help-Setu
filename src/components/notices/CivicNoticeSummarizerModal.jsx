import { useState, useId, useCallback } from 'react';
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
  AlertTriangle,
  File,
  Plus,
  Shield,
  Lock,
  LogOut,
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
  const [showSideBySide, setShowSideBySide] = useState(false);
  const [confirmCreateReminder, setConfirmCreateReminder] = useState(false);

  if (!isOpen) return null;

  const handleGenerateSummary = (e) => {
    e?.preventDefault();
    const result = summarizeCivicNotice({
      title: inputTitle,
      text: inputText,
      sourceUrl: inputSourceUrl
    });
    setSummary(result);
    setShowSideBySide(true);
  };

  const handleCopySummary = async () => {
    if (!summary) return;
    const textToCopy = `CIVIC NOTICE SUMMARY: ${summary.title}
Purpose: ${summary.purpose}
Deadline: ${summary.primaryDeadline}
Target Audience: ${summary.audience}
Required Actions:
${summary.actions.map((a, i) => `${i + 1}. ${a}`).join('\n') || 'None explicitly specified'}
Official Source: ${summary.sourceUrl || 'Official Gazette / Bulletin'}

(Generated with clause-level source tracking. Verify all fields against the original notice.)`;

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

  const handleCreateReminder = () => {
    setConfirmCreateReminder(true);
  };

  const handleConfirmCreateReminder = () => {
    setConfirmCreateReminder(false);
    // TODO: Create reminder/draft with user confirmation
    onClose();
  };

  const handleCancelCreateReminder = () => {
    setConfirmCreateReminder(false);
  };

  const renderFieldWithConfidence = (fieldName, fieldValue, clauseRef, confidence) => {
    const confidenceColor = confidence >= 80 ? '#16a34a' : confidence >= 50 ? '#eab308' : '#f87171';
    const confidenceLabel = confidence >= 80 ? 'High confidence' : confidence >= 50 ? 'Medium confidence' : 'Low confidence - verify';

    return (
      <div key={fieldName} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <strong style={{ fontSize: '0.78rem', color: confidenceColor }}}>{confidenceLabel}</strong>
        {clauseRef && clauseRef.paragraph > 0 && (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
            Source: paragraph {clauseRef.paragraph}
          </span>
        )}
        {clauseRef && clauseRef.source && (
          <p style={{ margin: '0.1rem 0 0', fontSize: '0.72rem', color: 'var(--text-tertiary)', lineHeight: 1.3 }}>
            {clauseRef.source.substring(0, 80)}{clauseRef.source.length > 80 ? '...' : ''}
          </p>
        )}
        <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{fieldName}: {fieldValue}</span>
      </div>
    );
  };

  const renderUncertaintyWarnings = () => {
    if (!summary?.uncertainties?.length) return null;
    return (
      <div
        style={{
          padding: '0.75rem 1rem',
          background: 'rgba(254, 226, 226, 0.8)',
          borderRadius: '6px',
          border: '1px solid #fca5a5',
          margin: '1rem 0',
        }}
      >
        <AlertTriangle size={16} color="#f87171" style={{ marginRight: '0.3rem' }} />
        <strong style={{ fontSize: '0.78rem', color: '#dc2626' }}>Uncertainty warnings:</strong>
        <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          {summary.uncertainties.map((u, i) => (
            <li key={i}>{u}</li>
          ))}
        </ul>
      </div>
    );
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
          maxWidth: showSideBySide ? '1200px' : '720px',
          maxHeight: '90vh',
          display: showSideBySide ? 'flex' : 'column',
          flexDirection: showSideBySide ? 'row' : 'column',
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
                Civic Notice Plain-Language Summarizer
              </h2>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Extract key dates, jurisdiction, action items and contact route. Every statement links to a source passage. Uncertain fields are marked unknown.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="btn btn-secondary"
              style={{ padding: '0.35rem', borderRadius: '50%', border: 'none', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>

            {summary && (
              <button
                type="button"
                onClick={() => setShowSideBySide(!showSideBySide)}
                className="btn btn-secondary"
                style={{ padding: '0.35rem', borderRadius: '6px', border: '1px solid var(--border-main)', cursor: 'pointer', fontSize: '0.78rem' }}
              >
                {showSideBySide ? 'Summary View' : 'Side-by-Side Review'}
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            padding: '1.5rem',
            overflowY: 'auto',
            flex: 1,
            display: showSideBySide ? 'flex' : 'grid',
            gap: showSideBySide ? '1.5rem' : '1.25rem',
            justifyContent: showSideBySide ? 'flex-start' : 'start'
          }}
        >
          {showSideBySide ? renderSideBySidePanel() : renderSummaryPanel()}
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

          {summary && !showSideBySide && (
            <>
              <button
                type="button"
                onClick={handleCreateReminder}
                className="btn btn-primary"
                style={{ marginLeft: '0.5rem', padding: '0.5rem 1rem' }}
              >
                <Plus size={14} /> Create Reminder/Draft
              </button>
            </>
          )}

          {confirmCreateReminder && (
            <>
              <button type="button" className="btn btn-secondary" onClick={handleCancelCreateReminder}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleConfirmCreateReminder}>
                Create Reminder
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* Side-by-Side Review Panel */
const renderSideBySidePanel = () => {
  const { purpose, deadlines, deadlineStatus, primaryDeadline, hasDateAmbiguity, ambiguityNotice,
    actions, audience, isUniversal, sourceUrl, referenceNumber,
    jurisdiction, fieldConfidence, uncertainties, clauseReferences, rawTextLength, privacyNotice } = summary || {};

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {/* Left: Plain-Language Summary */}
      <div style={{ flex: 1, borderRight: '1px solid var(--border-main)' }}>
        <h3 style={{ margin: '0 1rem 1rem', fontSize: '1rem', fontWeight: 600, color: 'var(--accent-main)' }}>
          Plain-Language Summary
        </h3>

        {privacyNotice && (
          <div
            style={{
              padding: '0.75rem 1rem',
              background: 'rgba(241, 245, 249, 0.5)',
              borderRadius: '6px',
              border: '1px solid var(--border-main)',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              marginBottom: '1rem',
            }}
          >
            {privacyNotice}
          </div>
        )}

        {/* Purpose */}
        <div>
          <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)', display: 'block', marginBottom: '0.2rem' }}>
            Purpose / Core Announcement:
          </strong>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            {purpose || 'Not extracted'}
          </p>
          {fieldConfidence.purpose >= 50 && (
            <span style={{ fontSize: '0.68rem', color: fieldConfidence.purpose >= 80 ? '#16a34a' : '#eab308' }}>
              ({fieldConfidence.purpose}% confidence)
            </span>
          )}
        </div>

        {/* Deadline Box */}
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            margin: '0.75rem 0',
            backgroundStatusHasDateAmbiguity
              ? 'rgba(245, 158, 11, 0.1)'
              : deadlineStatus === 'EXPLICIT_DEADLINE'
              ? 'rgba(22, 163, 74, 0.1)'
              : 'rgba(100, 116, 139, 0.1)',
            border: `1px solid ${
              hasDateAmbiguity ? '#fcd34d' : deadlineStatus === 'EXPLICIT_DEADLINE' ? '#86efac' : '#cbd5e1'
            }`
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
            {hasDateAmbiguity ? (
              <AlertTriangle size={16} color="#d97706" />
            ) : deadlineStatus === 'EXPLICIT_DEADLINE' ? (
              <Calendar size={16} color="#16a34a"
            ) : (
              <AlertCircle size={16} color="#64748b"
            )}
            <strong style={{ fontSize: '0.85rem', color: hasDateAmbiguity ? '#b45309' : deadlineStatus === 'EXPLICIT_DEADLINE' ? '#15803d' : '#475569' }}>
              {hasDateAmbiguity ? 'Date Ambiguity' : 'Filing Deadline'}: {primaryDeadline}
            </strong>
          </div>
        </div>

        {ambiguityNotice && (
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#b45309', lineHeight: 1.4 }}>
            {ambiguityNotice}
          </p>
        )}

        {deadlines.length > 0 && (
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {deadlines.map((d, i) => (
              <li key={i}>
                <strong>{d.dateString}</strong>: <em>{d.context || 'no context'}</em>
              </li>
            ))}
          </ul>
        )}

        {/* Actions */}
        <div>
          <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)', display: 'block', marginBottom: '0.2rem' }}>
            Extracted Citizen Action Instructions:
          </strong>
          {actions.length === 0 ? (
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
              No explicit action instructions found in the supplied notice text.
            </p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.78rem', color: 'var(--text-secondary)', gap: '0.25rem' }}>
              {actions.map((act, idx) => (
                <li key={idx}>
                  <CheckCircle2 size={12} color="var(--accent-main)" style={{ display: 'inline', marginRight: '3px' }} />
                  {act}
                </li>
              ))}
            </ul>
          )}

          {fieldConfidence.actions >= 50 && (
            <span style={{ fontSize: '0.68rem', color: fieldConfidence.actions >= 80 ? '#16a34a' : '#eab308' }}>
              ({fieldConfidence.actions}% confidence)
            </span>
          )}
        </div>

        {/* Target Audience */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          <Users size={13} color="var(--accent-main)" />
          <span>{audience || 'Not extracted'}</span>
          {isUniversal === false && (
            <span style={{ fontSize: '0.68rem', color: '#6b7280' }}>(not universal - verify applicability)</span>
          )}
        </div>

        {/* Jurisdiction */}
        {jurisdiction && jurisdiction.label !== 'Unknown' && (
          <div style={{ margin: '0.5rem 0', padding: '0.5rem 0.75rem', background: 'rgba(220, 38, 38, 0.05)', borderRadius: '4px', border: '1px solid #dc2626' }}>
            <strong style={{ fontSize: '0.75rem', color: '#dc2626' }}>: Jurisdiction</strong>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
              {jurisdiction.label} ({jurisdiction.region})
            </span>
            {jurisdiction.confidence >= 50 && (
              <span style={{ fontSize: '0.68rem', color: jurisdiction.confidence >= 80 ? '#16a34a' : '#eab308' }}>
                ({jurisdiction.confidence}% confidence)
              </span>
            )}
          </div>
        )}

        {/* Uncertainty warnings */}
        {renderUncertaintyWarnings()}
      </div>

      {/* Right: Source Clause Review */}
      <div style={{ flex: 1, paddingLeft: '1rem', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 1rem 1rem', fontSize: '1rem', fontWeight: 600, color: 'var(--accent-main)' }}>
          Source Clause Review
        </h3>

        {privacyNotice && (
          <div
            style={{
              padding: '0.75rem 1rem',
              background: 'rgba(241, 245, 249, 0.5)',
              borderRadius: '6px',
              border: '1px solid var(--border-main)',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              marginBottom: '1rem',
            }}
          >
            {privacyNotice}
          </div>
        )}

        {/* Dates with clause references */}
        {deadlines.length > 0 && (
          <div>
            <strong style={{ fontSize: '0.78rem', color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
              Extracted Dates ({deadlines.length}):
            </strong>
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {deadlines.map((d, i) => (
                <li key={i} style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '0.3rem', marginBottom: '0.3rem' }}>
                  <strong>Date:</strong> {d.dateString}
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', float: 'right' }}>
                    Confidence: {clauseReferences.dates?.[i]?.confidence || 'N/A}%
                  </span>
                  <p style={{ margin: '0.1rem 0 0', fontSize: '0.68rem', color: 'var(--text-tertiary)', lineHeight: 1.3 }}>
                    {d.context || 'No context available'}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions with clause references */}
        {actions.length > 0 && (
          <div>
            <strong style={{ fontSize: '0.78rem', color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
              Action Items ({actions.length}):
            </strong>
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {actions.map((act, idx) => (
                <li key={idx} style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '0.3rem', marginBottom: '0.3rem' }}>
                  <CheckCircle2 size={12} color="var(--accent-main)" style={{ display: 'inline-block', marginRight: '3px' }} />
                  {act}
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', float: 'right' }}>
                    Para {clauseReferences.actions?.[idx]?.paragraph || 'N/A'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Jurisdiction clause */}
        {jurisdiction && jurisdiction.label !== 'Unknown' && (
          <div>
            <strong style={{ fontSize: '0.78rem', color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
              Jurisdiction Clause:
            </strong>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
              {jurisdiction.clauseReference?.source || 'No source available'}
            </p>
            {jurisdiction.clauseReference?.paragraph > 0 && (
              <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                Source: paragraph {jurisdiction.clauseReference.paragraph}
              </span>
            )}
            <span style={{ fontSize: '0.68rem', color: jurisdiction.confidence >= 80 ? '#16a34a' : '#eab308' }}>
              Confidence: {jurisdiction.confidence}%
            </span>
          </div>
        )}

        {/* Audience clause */}
        {audience && audience !== 'Not extracted' && (
          <div>
            <strong style={{ fontSize: '0.78rem', color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
              Audience Clause:
            </strong>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
              {audience}
            </p>
            {audienceInfo?.clauseReference?.paragraph > 0 && (
              <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                Source: paragraph {audienceInfo.clauseReference.paragraph}
              </span>
            )}
            <span style={{ fontSize: '0.68rem', color: audienceInfo.isUniversal === false && audience.text.includes('not explicitly restricted') ? '#eab308' : '#6b7280' }}>
              Confidence: {audienceInfo.clauseReference?.confidence || 0}%
            </span>
          </div>
        )}

        {/* Purpose clause */}
        {purpose && purpose !== 'Not extracted' && (
          <div>
            <strong style={{ fontSize: '0.78rem', color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
              Purpose Clause:
            </strong>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
              {purpose}
            </p>
            {purposeInfo?.clauseReference?.paragraph > 0 && (
              <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                Source: paragraph {purposeClause.clauseReference?.paragraph || 1}
              </span>
            )}
            <span style={{ fontSize: '0.68rem', color: fieldConfidence.purpose >= 80 ? '#16a34a' : '#eab308' }}>
              Confidence: {fieldConfidence.purpose}%
            </span>
          </div>
        )}

        {/* Reference number */}
        {referenceNumber && referenceNumber !== 'N/A' && (
          <div style={{ margin: '0.5rem 0', padding: '0.5rem 0.75rem', background: 'rgba(220, 38, 38, 0.05)', borderRadius: '4px', border: '1pxsolid #dc2626' }}>
            <strong style={{ fontSize: '0.75rem', color: '#dc2626' }}>: Reference Number</strong>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>{referenceNumber}</span>
          </div>
        )}

        {/* Source URL link */}
        {sourceUrl && (
          <div style={{ margin: '1rem 0 0', padding: '0.5rem 0', borderTop: '1px solid var(--border-main)' }}>
            <a
              href={safeHttpUrl(sourceUrl) || undefined}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: '0.78rem',
                color: 'var(--accent-main)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                fontWeight: 600
              }}
            >
              <ExternalLink size={13} /> View Full Original Notice Document
            </a>
          </div>
        )}

        {/* Copyright & guidance notice */}
        <div
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            background: 'rgba(254, 242, 242, 0.5)',
            borderRadius: '6px',
            border: '1px solid #fca5a5',
            fontSize: '0.72rem',
            color: '#991b1b'
          }}
        >
          <strong>Copyright & Usage Guidance:</strong> This notice text is provided for civic assistance purposes. The summarizer generates plain-language extracts with clause-level references. Users should verify all extracted information against the original official document. No part of this summary should be reproduced or distributed without permission from the original source.
        </div>
      </div>
    </div>
  );
};