import { CheckCircle2, XCircle, AlertCircle, HelpCircle, FileCheck, ExternalLink } from 'lucide-react';

const STATE_CONFIG = {
  satisfied: {
    icon: CheckCircle2,
    color: '#16a34a',
    bg: 'rgba(22, 163, 74, 0.1)',
    border: 'rgba(22, 163, 74, 0.3)',
    label: 'Statutory Requirement Satisfied',
  },
  unsatisfied: {
    icon: XCircle,
    color: '#dc2626',
    bg: 'rgba(220, 38, 38, 0.1)',
    border: 'rgba(220, 38, 38, 0.3)',
    label: 'Requirement Not Currently Met',
  },
  unknown: {
    icon: HelpCircle,
    color: '#ca8a04',
    bg: 'rgba(202, 138, 4, 0.1)',
    border: 'rgba(202, 138, 4, 0.3)',
    label: 'Information Missing / Unanswered',
  },
  conflicting: {
    icon: AlertCircle,
    color: '#ea580c',
    bg: 'rgba(234, 88, 12, 0.1)',
    border: 'rgba(234, 88, 12, 0.3)',
    label: 'Evidentiary Discrepancy Detected',
  },
  needs_official_verification: {
    icon: FileCheck,
    color: '#2563eb',
    bg: 'rgba(37, 99, 235, 0.1)',
    border: 'rgba(37, 99, 235, 0.3)',
    label: 'Requires Official Desk / Revenue Officer Verification',
  },
};

export default function ConditionAuditTree({ criteria = [] }) {
  if (!criteria || criteria.length === 0) {
    return <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>No criteria to display.</p>;
  }

  return (
    <div
      role="region"
      aria-label="Condition Audit Breakdown"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        marginTop: '1rem',
      }}
    >
      {criteria.map((node) => {
        const cfg = STATE_CONFIG[node.state] || STATE_CONFIG.unknown;
        const Icon = cfg.icon;

        return (
          <div
            key={node.id}
            style={{
              padding: '1rem',
              borderRadius: '0.75rem',
              background: cfg.bg,
              border: `1px solid ${cfg.border}`,
              transition: 'all 0.2s ease',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '0.75rem',
                flexWrap: 'wrap',
                marginBottom: '0.4rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icon size={18} style={{ color: cfg.color, flexShrink: 0 }} aria-hidden="true" />
                <span style={{ fontWeight: '700', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                  {node.label}
                </span>
              </div>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '99px',
                  color: cfg.color,
                  background: 'rgba(255, 255, 255, 0.6)',
                }}
              >
                {cfg.label}
              </span>
            </div>

            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {node.detail}
            </p>

            {/* Boundary warning note if present */}
            {node.isBoundary && node.boundaryNotice && (
              <div
                style={{
                  padding: '0.4rem 0.6rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(234, 179, 8, 0.15)',
                  border: '1px solid rgba(234, 179, 8, 0.3)',
                  color: '#ca8a04',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  marginBottom: '0.5rem',
                }}
              >
                ⚠️ {node.boundaryNotice}
              </div>
            )}

            {/* Evidentiary conflict warning */}
            {node.conflict && (
              <div
                style={{
                  padding: '0.4rem 0.6rem',
                  borderRadius: '0.5rem',
                  background: 'rgba(234, 88, 12, 0.15)',
                  border: '1px solid rgba(234, 88, 12, 0.3)',
                  color: '#ea580c',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  marginBottom: '0.5rem',
                }}
              >
                ⚡ {node.conflict.message}
              </div>
            )}

            {/* Statutory Citation Provenance */}
            {node.citation && (
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  flexWrap: 'wrap',
                  borderTop: '1px dashed var(--border-light)',
                  paddingTop: '0.4rem',
                }}
              >
                <span>
                  <strong>Statutory Authority:</strong> {node.citation.authority}
                </span>
                <span>•</span>
                <span>Order: {node.citation.orderNo}</span>
                {node.citation.sourceUrl && (
                  <>
                    <span>•</span>
                    <a
                      href={node.citation.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                        color: 'var(--accent-main)',
                        textDecoration: 'none',
                      }}
                    >
                      Official Source <ExternalLink size={11} aria-hidden="true" />
                    </a>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
