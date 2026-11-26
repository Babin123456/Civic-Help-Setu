import { ShieldAlert, Info, AlertTriangle } from 'lucide-react';

export default function CleanRoomDifferencingAlert({ error, message }) {
  if (!error) return null;

  const isDifferencing = error === 'CLEAN_ROOM_DIFFERENCING_ATTACK_DETECTED';
  const isThreshold = error === 'CLEAN_ROOM_RE_IDENTIFICATION_RISK' || error === 'CLEAN_ROOM_THRESHOLD_VIOLATION';
  const isBudget = error === 'CLEAN_ROOM_BUDGET_EXHAUSTED';

  return (
    <div
      role="alert"
      style={{
        padding: '1rem 1.25rem',
        borderRadius: '0.6rem',
        marginBottom: '1.5rem',
        background: isDifferencing
          ? 'rgba(239, 68, 68, 0.12)'
          : isThreshold
          ? 'rgba(245, 158, 11, 0.12)'
          : 'rgba(59, 130, 246, 0.12)',
        border: `1px solid ${
          isDifferencing ? '#ef4444' : isThreshold ? '#f59e0b' : '#3b82f6'
        }`,
        color: isDifferencing ? '#ef4444' : isThreshold ? '#d97706' : '#2563eb',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div style={{ marginTop: '0.1rem' }}>
          {isDifferencing ? (
            <ShieldAlert size={20} />
          ) : isThreshold ? (
            <AlertTriangle size={20} />
          ) : (
            <Info size={20} />
          )}
        </div>
        <div>
          <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.95rem', fontWeight: 700 }}>
            {isDifferencing
              ? 'Security Block: Differencing Attack Guard Triggered'
              : isThreshold
              ? 'Privacy Guard: k-Anonymity Minimum Threshold Enforced'
              : isBudget
              ? 'Query Budget Exhausted'
              : 'Clean Room Execution Blocked'}
          </h4>
          <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--text-primary)' }}>
            {message}
          </p>
          {isDifferencing && (
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <strong>Why this occurred:</strong> Clean room analytics tracks predicate history. When consecutive queries isolate a small cohort difference (&lt; 5 records), execution is automatically halted to prevent citizen re-identification under DPDP Act 2023.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
