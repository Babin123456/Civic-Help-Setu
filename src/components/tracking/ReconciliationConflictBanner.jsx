import { AlertTriangle, ShieldCheck, ShieldAlert, GitCompare, ArrowRight } from 'lucide-react';
import { getCanonicalStatusMeta } from '../../services/statusVocabularyNormalizer';
import { CONFLICT_SEVERITY } from '../../services/statusReconciliationEngine';

export default function ReconciliationConflictBanner({
  record,
  onOpenModal,
}) {
  const hasRecord = Boolean(record && record.lastReport && record.evidenceList?.length > 0);

  if (!hasRecord) {
    return (
      <div
        role="region"
        aria-label="Cross-portal status reconciliation banner"
        style={{
          background: 'var(--card-bg, #ffffff)',
          border: '1px dashed var(--border-color, #cbd5e1)',
          borderRadius: '0.75rem',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              padding: '0.5rem',
              borderRadius: '0.5rem',
              background: 'rgba(56, 189, 248, 0.1)',
              color: '#0284c7',
            }}
          >
            <GitCompare className="w-5 h-5" />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
              Cross-Portal Status Reconciliation
            </h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary, #64748b)' }}>
              Receive different updates via SMS, portal, or paper receipt? Compare and reconcile sources.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenModal}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.45rem 0.9rem',
            borderRadius: '0.45rem',
            background: 'var(--primary, #2563eb)',
            color: '#ffffff',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Reconcile Updates
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (record.isTampered) {
    return (
      <div
        role="alert"
        aria-label="Tampered reconciliation record alert"
        style={{
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid #ef4444',
          borderRadius: '0.75rem',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ShieldAlert className="w-5 h-5 text-red-600" style={{ color: '#ef4444', flexShrink: 0 }} />
          <div>
            <strong style={{ color: '#b91c1c', fontSize: '0.92rem' }}>
              Integrity Seal Invalid (Tamper Detected)
            </strong>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#991b1b' }}>
              Stored status evidence failed cryptographic checksum verification. Please re-import your records.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenModal}
          style={{
            padding: '0.45rem 0.85rem',
            borderRadius: '0.45rem',
            background: '#ef4444',
            color: '#fff',
            border: 'none',
            fontSize: '0.82rem',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Review Data
        </button>
      </div>
    );
  }

  const { lastReport, evidenceList } = record;
  const { hasConflicts, conflicts, consensusStatus, confidenceScore, guidance } = lastReport;
  const statusMeta = getCanonicalStatusMeta(consensusStatus);
  const hasHighConflict = conflicts?.some((c) => c.severity === CONFLICT_SEVERITY.HIGH);

  if (hasConflicts) {
    return (
      <div
        role="alert"
        aria-label="Status discrepancies detected alert"
        style={{
          background: hasHighConflict ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
          border: `1px solid ${hasHighConflict ? '#ef4444' : '#f59e0b'}`,
          borderRadius: '0.75rem',
          padding: '1.1rem 1.25rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <AlertTriangle
              className="w-5 h-5"
              style={{ color: hasHighConflict ? '#ef4444' : '#f59e0b', flexShrink: 0, marginTop: '2px' }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    color: hasHighConflict ? '#b91c1c' : '#b45309',
                  }}
                >
                  {`Status Conflict Detected (${conflicts.length} ${conflicts.length === 1 ? 'discrepancy' : 'discrepancies'})`}
                </span>
                <span
                  style={{
                    padding: '0.15rem 0.55rem',
                    borderRadius: '1rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: hasHighConflict ? '#fee2e2' : '#fef3c7',
                    color: hasHighConflict ? '#991b1b' : '#92400e',
                  }}
                >
                  {`${confidenceScore}% Confidence`}
                </span>
              </div>
              <p style={{ margin: '0.35rem 0 0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary, #475569)' }}>
                {guidance?.summary || 'Updates received across portals or receipts contain contradictory information.'}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {conflicts.map((c, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: '0.75rem',
                      background: 'rgba(0,0,0,0.06)',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '0.25rem',
                      color: 'var(--text-primary, #1e293b)',
                    }}
                  >
                    {c.type.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenModal}
            style={{
              padding: '0.45rem 0.95rem',
              borderRadius: '0.45rem',
              background: hasHighConflict ? '#b91c1c' : '#b45309',
              color: '#ffffff',
              border: 'none',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              alignSelf: 'center',
            }}
          >
            Resolve Conflicts
          </button>
        </div>
      </div>
    );
  }

  // Consensus achieved without conflicts
  return (
    <div
      role="region"
      aria-label="Reconciled application status banner"
      style={{
        background: 'rgba(16, 185, 129, 0.08)',
        border: '1px solid #10b981',
        borderRadius: '0.75rem',
        padding: '1rem 1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <ShieldCheck className="w-5 h-5" style={{ color: '#10b981', flexShrink: 0 }} />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
              Reconciled Status:
            </span>
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                padding: '0.15rem 0.6rem',
                borderRadius: '0.75rem',
                background: statusMeta.background,
                color: statusMeta.color,
              }}
            >
              {statusMeta.label}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #64748b)' }}>
              {`(${confidenceScore}% confidence across ${evidenceList.length} sources)`}
            </span>
          </div>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary, #64748b)' }}>
            {guidance?.summary}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenModal}
        style={{
          padding: '0.45rem 0.85rem',
          borderRadius: '0.45rem',
          background: 'transparent',
          border: '1px solid #10b981',
          color: '#047857',
          fontSize: '0.85rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {`View Reconciliation (${evidenceList.length})`}
      </button>
    </div>
  );
}
