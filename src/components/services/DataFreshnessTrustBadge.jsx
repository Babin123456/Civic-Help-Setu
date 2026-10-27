import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Info,
  Calendar,
  CheckCircle2,
  XCircle,
  HelpCircle,
  X,
  Layers,
} from 'lucide-react';
import {
  calculateDataTrustScore,
  TRUST_DISCLAIMER,
} from '../../services/dataFreshnessTrustService';

const DataFreshnessTrustBadge = ({ service }) => {
  const [modalOpen, setModalOpen] = useState(false);

  if (!service) return null;

  const evaluation = calculateDataTrustScore(service);
  const { score, tier, breakdown, defects, positiveNotes, lastReviewedAt, reviewedBy } = evaluation;

  const formattedDate = lastReviewedAt
    ? new Date(lastReviewedAt).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Not yet recorded';

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="glass-panel"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.45rem',
          padding: '0.35rem 0.8rem',
          borderRadius: '99px',
          background: tier.bgLight,
          border: `1px solid ${tier.badgeColor}`,
          color: tier.badgeColor,
          fontSize: '0.825rem',
          fontWeight: '700',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        aria-label={`Data Quality Score: ${score}/100, ${tier.label}. Click to see transparency details.`}
      >
        <ShieldCheck size={15} color={tier.badgeColor} />
        <span>
          Data Trust: {score}/100 • {tier.label}
        </span>
        <Info size={13} style={{ opacity: 0.8 }} />
      </button>

      {/* Trust & Freshness Explanation Modal */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="trust-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem',
          }}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: '640px',
              width: '100%',
              borderRadius: '1.25rem',
              background: 'var(--bg-card, #1e293b)',
              border: '1px solid var(--border-light, rgba(255, 255, 255, 0.15))',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid var(--border-light)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '0.75rem',
                    background: tier.bgLight,
                    color: tier.badgeColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h3 id="trust-modal-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800' }}>
                    Data Freshness & Trust Transparency
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Evaluation for <strong>{service.name}</strong>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close dialog"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '0.4rem',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Non-Government Endorsement Disclaimer */}
            <div
              style={{
                padding: '0.75rem 1.5rem',
                background: 'rgba(245, 158, 11, 0.08)',
                borderBottom: '1px solid rgba(245, 158, 11, 0.25)',
                display: 'flex',
                gap: '0.65rem',
                alignItems: 'flex-start',
                fontSize: '0.775rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.4,
              }}
            >
              <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: '#f59e0b' }}>Informational Indicator Only: </strong>
                {TRUST_DISCLAIMER}
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', maxHeight: '70vh', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Overall Score Badge */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem 1.25rem',
                  borderRadius: '0.75rem',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: `1px solid ${tier.badgeColor}`,
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                    Confidence Tier
                  </div>
                  <div style={{ fontSize: '1.15rem', fontWeight: '800', color: tier.badgeColor }}>
                    {tier.label}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    {tier.description}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '2.5rem', fontWeight: '900', color: tier.badgeColor, lineHeight: 1 }}>
                    {score}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>out of 100</div>
                </div>
              </div>

              {/* Formula & Breakdown */}
              <div>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  Transparent Scoring Formula
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(255, 255, 255, 0.03)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Source Provenance</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#38bdf8' }}>
                      {breakdown.provenance} / 30
                    </div>
                  </div>
                  <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(255, 255, 255, 0.03)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Review Freshness</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#10b981' }}>
                      {breakdown.freshness} / 30
                    </div>
                  </div>
                  <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(255, 255, 255, 0.03)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Completeness</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#a855f7' }}>
                      {breakdown.completeness} / 40
                    </div>
                  </div>
                </div>
              </div>

              {/* Factors Lowering Confidence (Defects) */}
              {defects.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', fontWeight: '700', color: '#f59e0b' }}>
                    Factors Lowering Confidence ({defects.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {defects.map((defect, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          fontSize: '0.8rem',
                          color: 'var(--text-secondary)',
                          background: 'rgba(239, 68, 68, 0.06)',
                          padding: '0.45rem 0.75rem',
                          borderRadius: '0.4rem',
                        }}
                      >
                        <XCircle size={15} color="#ef4444" style={{ flexShrink: 0 }} />
                        <span>{defect}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Positive Factors */}
              {positiveNotes.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', fontWeight: '700', color: '#10b981' }}>
                    Verified Source Elements
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {positiveNotes.map((note, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          fontSize: '0.8rem',
                          color: 'var(--text-secondary)',
                          background: 'rgba(16, 185, 129, 0.06)',
                          padding: '0.45rem 0.75rem',
                          borderRadius: '0.4rem',
                        }}
                      >
                        <CheckCircle2 size={15} color="#10b981" style={{ flexShrink: 0 }} />
                        <span>{note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Provenance & Cadence Metadata */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(0, 0, 0, 0.2)',
                  fontSize: '0.8rem',
                  color: 'var(--text-tertiary)',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                }}
              >
                <div>
                  <strong>Last Source Verification:</strong> {formattedDate}
                </div>
                <div>
                  <strong>Review Auditor:</strong> {reviewedBy}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid var(--border-light)',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="btn btn-secondary"
                style={{ padding: '0.45rem 1.25rem', fontSize: '0.85rem' }}
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DataFreshnessTrustBadge;
