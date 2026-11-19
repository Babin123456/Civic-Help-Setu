import { useEffect, useState } from 'react';
import {
  X,
  ExternalLink,
  ShieldCheck,
  Clock,
  History,
  FileText,
  AlertTriangle,
  RotateCcw,
  BookOpen,
} from 'lucide-react';
import {
  verifyLegalSourceIntegrity,
} from '../../services/legalSourceStorage.js';
import {
  STATUTORY_DISCLAIMER,
  TEMPLATE_REGISTRY,
} from '../../services/legalSourceService.js';

export default function LegalSourceDetailModal({
  source,
  onClose,
  canReview = false,
  onRollback,
}) {
  const [integrity, setIntegrity] = useState({ valid: true, calculatedDigest: '', storedDigest: '' });

  useEffect(() => {
    let active = true;
    if (source) {
      verifyLegalSourceIntegrity(source).then((res) => {
        if (active) setIntegrity(res);
      });
    }
    return () => {
      active = false;
    };
  }, [source]);

  if (!source) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-source-detail-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'var(--bg-modal, #1e293b)',
          borderRadius: '1rem',
          maxWidth: '800px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--border-light, #334155)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          color: 'var(--text-main, #f8fafc)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-light, #334155)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span
                style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                {source.provision}
              </span>
              <span
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#e2e8f0',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                }}
              >
                v{source.currentVersion}
              </span>
              <span
                style={{
                  background:
                    source.status === 'REVIEWED'
                      ? 'rgba(34, 197, 94, 0.15)'
                      : source.status === 'DRAFT'
                      ? 'rgba(245, 158, 11, 0.15)'
                      : 'rgba(239, 68, 68, 0.15)',
                  color:
                    source.status === 'REVIEWED'
                      ? '#22c55e'
                      : source.status === 'DRAFT'
                      ? '#f59e0b'
                      : '#ef4444',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                {source.status}
              </span>
            </div>
            <h2
              id="legal-source-detail-title"
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                margin: '0.25rem 0',
                color: '#ffffff',
              }}
            >
              {source.title}
            </h2>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              {source.actName} • Jurisdiction: <strong>{source.jurisdiction}</strong>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            aria-label="Close details"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '0.25rem',
              borderRadius: '0.375rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          {/* Review Metadata Banner */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              borderRadius: '0.75rem',
              padding: '1rem',
              marginBottom: '1.25rem',
              border: '1px solid #334155',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.75rem',
              fontSize: '0.85rem',
            }}
          >
            <div>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.75rem' }}>
                Reviewed By
              </span>
              <strong style={{ color: '#f8fafc' }}>{source.reviewedBy || 'Pending Review'}</strong>
            </div>
            <div>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.75rem' }}>
                Review Date
              </span>
              <strong style={{ color: '#f8fafc' }}>
                {source.reviewedAt ? new Date(source.reviewedAt).toLocaleDateString() : 'Unreviewed Draft'}
              </strong>
            </div>
            <div>
              <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.75rem' }}>
                Cryptographic Integrity
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  color: integrity.valid ? '#22c55e' : '#ef4444',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                }}
              >
                <ShieldCheck size={14} /> {integrity.valid ? 'Verified SHA-256' : 'Seal Mismatch'}
              </span>
            </div>
            {source.officialUrl && (
              <div>
                <span style={{ color: '#94a3b8', display: 'block', fontSize: '0.75rem' }}>
                  Official Citation
                </span>
                <a
                  href={source.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    color: '#38bdf8',
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  View Gazette / Code <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>

          {/* Reviewer Notes */}
          {source.reviewerNotes && (
            <div
              style={{
                background: 'rgba(56, 189, 248, 0.08)',
                borderLeft: '3px solid #38bdf8',
                padding: '0.75rem 1rem',
                borderRadius: '0.25rem',
                marginBottom: '1.25rem',
                fontSize: '0.85rem',
              }}
            >
              <strong style={{ color: '#38bdf8', display: 'block', marginBottom: '0.2rem' }}>
                Reviewer Certification Note:
              </strong>
              <div style={{ color: '#cbd5e1' }}>{source.reviewerNotes}</div>
            </div>
          )}

          {/* Plain-Language Statutory Summary */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h3
              style={{
                fontSize: '0.95rem',
                fontWeight: 600,
                color: '#cbd5e1',
                marginBottom: '0.4rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <BookOpen size={16} style={{ color: '#38bdf8' }} /> Plain-Language Legal Summary
            </h3>
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.5)',
                padding: '1rem',
                borderRadius: '0.5rem',
                border: '1px solid #334155',
                color: '#e2e8f0',
                fontSize: '0.9rem',
                lineHeight: 1.6,
              }}
            >
              {source.summary || 'No summary provided.'}
            </div>
          </div>

          {/* Full Statutory Provision Text */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3
              style={{
                fontSize: '0.95rem',
                fontWeight: 600,
                color: '#cbd5e1',
                marginBottom: '0.4rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <FileText size={16} style={{ color: '#38bdf8' }} /> Canonical Statutory Provision Text
            </h3>
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                padding: '1rem',
                borderRadius: '0.5rem',
                border: '1px solid #334155',
                color: '#cbd5e1',
                fontFamily: 'serif',
                fontSize: '0.92rem',
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
                fontStyle: 'italic',
              }}
            >
              "{source.fullText || 'Provision text not recorded.'}"
            </div>
          </div>

          {/* Applicable Templates */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
              Associated Workspace Templates
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {(source.applicableTemplates || []).map((tId) => {
                const t = TEMPLATE_REGISTRY[tId];
                return (
                  <span
                    key={tId}
                    style={{
                      background: 'rgba(99, 102, 241, 0.15)',
                      color: '#a5b4fc',
                      padding: '0.35rem 0.65rem',
                      borderRadius: '0.375rem',
                      fontSize: '0.8rem',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                    }}
                  >
                    {t?.name || tId}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Version History & Revisions */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3
              style={{
                fontSize: '0.95rem',
                fontWeight: 600,
                color: '#cbd5e1',
                marginBottom: '0.6rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <History size={16} style={{ color: '#eab308' }} /> Historical Revisions & Rollback Log
            </h3>

            {(source.versionHistory || []).length === 0 ? (
              <div
                style={{
                  fontSize: '0.85rem',
                  color: '#94a3b8',
                  padding: '0.75rem',
                  background: 'rgba(15, 23, 42, 0.4)',
                  borderRadius: '0.5rem',
                  fontStyle: 'italic',
                }}
              >
                No historical revisions recorded. This is the initial certified statutory baseline.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {source.versionHistory.map((rev, idx) => (
                  <div
                    key={`${rev.version}-${idx}`}
                    style={{
                      background: 'rgba(15, 23, 42, 0.5)',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #334155',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '1rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            color: '#e2e8f0',
                            fontSize: '0.85rem',
                          }}
                        >
                          v{rev.version}
                        </span>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            color: '#94a3b8',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem',
                          }}
                        >
                          <Clock size={11} />
                          {rev.reviewedAt ? new Date(rev.reviewedAt).toLocaleDateString() : 'Archived'}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>by {rev.reviewedBy || 'Reviewer'}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                        {rev.reviewerNotes || rev.summary || 'Historical snapshot.'}
                      </div>
                    </div>

                    {canReview && onRollback && (
                      <button
                        onClick={() => onRollback(rev.version)}
                        type="button"
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: '0.375rem',
                          background: 'rgba(234, 179, 8, 0.15)',
                          color: '#eab308',
                          border: '1px solid rgba(234, 179, 8, 0.3)',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <RotateCcw size={12} /> Rollback to v{rev.version}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Statutory Outcome Neutrality Advisory */}
          <div
            style={{
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px dashed #475569',
              borderRadius: '0.5rem',
              padding: '0.75rem 1rem',
              fontSize: '0.75rem',
              color: '#94a3b8',
              lineHeight: 1.5,
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'flex-start',
            }}
          >
            <AlertTriangle size={15} style={{ color: '#eab308', flexShrink: 0, marginTop: '0.1rem' }} />
            <div>{STATUTORY_DISCLAIMER}</div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-light, #334155)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            type="button"
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '0.5rem',
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#f8fafc',
              border: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
