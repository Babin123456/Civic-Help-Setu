import { useEffect, useRef } from 'react';
import { X, ExternalLink, ShieldCheck, AlertTriangle, Landmark } from 'lucide-react';

export default function RecordDetailModal({ record, onClose }) {
  const modalRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!record) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 1050,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-main)',
          borderRadius: '0.75rem',
          maxWidth: '750px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem',
            borderBottom: '1px solid var(--border-main)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Landmark size={18} color="var(--accent-main, #2563eb)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {record.authority.name}
              </span>
            </div>
            <h2 id="record-modal-title" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {record.name}
            </h2>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.25rem',
              borderRadius: '0.375rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>
          {/* Key metadata grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.75rem',
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-main)',
              padding: '0.85rem',
              borderRadius: '0.5rem',
              marginBottom: '1.25rem',
              fontSize: '0.8rem',
            }}
          >
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Statutory Basis:</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{record.statutoryBasis}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Prescribed Form:</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{record.formNumber}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Official Fee:</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{record.officialFee}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Estimated Timeline:</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{record.estimatedProcessingDays}</div>
            </div>
          </div>

          {/* Explicit Unavailable Data State (Requirement 7) */}
          {record.unavailableData?.isUnavailable && (
            <div
              role="alert"
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '0.5rem',
                padding: '0.85rem 1rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
              }}
            >
              <AlertTriangle size={20} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--warning, #f59e0b)' }}>
                  Unverified / State-Dependent Gaps (No Assumptions Made)
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem', lineHeight: 1.45 }}>
                  {record.unavailableData.reason}
                </div>
              </div>
            </div>
          )}

          {/* Accepted Address Proofs & Prerequisite Evidence */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              Accepted Proof of Address (POA) & Evidence
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {record.acceptedProofs.map((proof, idx) => (
                <div
                  key={idx}
                  style={{
                    border: '1px solid var(--border-main)',
                    borderRadius: '0.375rem',
                    padding: '0.75rem',
                    backgroundColor: 'var(--bg-main)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      {proof.name}
                    </span>
                    {proof.isConditional && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          backgroundColor: 'rgba(245, 158, 11, 0.15)',
                          color: 'var(--warning, #f59e0b)',
                          border: '1px solid rgba(245, 158, 11, 0.3)',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '9999px',
                          fontWeight: 600,
                        }}
                      >
                        Conditional
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    <strong>Issuing Authority:</strong> {proof.issuingAuthority}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', marginTop: '0.25rem', lineHeight: 1.4 }}>
                    {proof.description}
                  </div>
                  {proof.conditionNotes && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--warning, #f59e0b)', marginTop: '0.3rem', fontStyle: 'italic' }}>
                      ⚠️ {proof.conditionNotes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 1: Official Authority Instructions (Verbatim) */}
          <div
            style={{
              marginBottom: '1.25rem',
              backgroundColor: 'rgba(2, 132, 199, 0.08)',
              border: '1px solid rgba(2, 132, 199, 0.25)',
              borderLeft: '4px solid #0284c7',
              padding: '1rem',
              borderRadius: '0 0.5rem 0.5rem 0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
              <Landmark size={16} color="#0284c7" />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-main)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Official Government Notice / Gazette Text
              </span>
            </div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>
              &ldquo;{record.officialInstructions}&rdquo;
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <span>Effective Date: <strong>{record.effectiveDate}</strong></span>
              <span>Last Verified: <strong>{record.lastVerified}</strong></span>
              <a
                href={record.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent-main)', textDecoration: 'underline' }}
              >
                Official Gazette / Source Reference ↗
              </a>
            </div>
          </div>

          {/* Section 2: Civic Help Setu Editorial Guidance */}
          <div
            style={{
              backgroundColor: 'rgba(22, 163, 74, 0.08)',
              border: '1px solid rgba(22, 163, 74, 0.25)',
              borderLeft: '4px solid #16a34a',
              padding: '1rem',
              borderRadius: '0 0.5rem 0.5rem 0',
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
              <ShieldCheck size={16} color="#16a34a" />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Civic Help Setu Editorial Tip & Practical Guidance
              </span>
            </div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>
              {record.editorialNotes}
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderTop: '1px solid var(--border-main)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-main)',
          }}
        >
          <a
            href={record.authority.portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', textDecoration: 'none' }}
          >
            <ExternalLink size={16} /> Open Official {record.authority.name} Portal
          </a>

          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

