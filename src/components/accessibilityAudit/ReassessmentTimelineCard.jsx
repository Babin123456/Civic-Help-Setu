import { useState } from 'react';
import {
  History,
  CheckCircle2,
  Clock,
  TrendingUp,
  FileEdit,
} from 'lucide-react';
import { addReassessmentRecord } from '../../services/accessibilityAuditService.js';

export default function ReassessmentTimelineCard({
  auditRecord,
  currentMeasurements = {},
  currentAnswers = {},
  onReassessmentAdded,
  readOnly = false,
}) {
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [assessorNotes, setAssessorNotes] = useState('');

  const history = Array.isArray(auditRecord?.reassessments) ? auditRecord.reassessments : [];

  const handleRecordNewRound = () => {
    if (!assessorNotes.trim()) return;

    const updated = addReassessmentRecord(auditRecord, {
      reassessedMeasurements: currentMeasurements,
      reassessedAnswers: currentAnswers,
      assessorNotes: assessorNotes.trim(),
    });

    if (onReassessmentAdded) onReassessmentAdded(updated);
    setAssessorNotes('');
    setShowRecordForm(false);
  };

  return (
    <div
      role="region"
      aria-label="Reassessment History and Progress Tracker"
      style={{
        background: 'var(--surface-color, #ffffff)',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <History size={22} color="#0284c7" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
            Reassessment History &amp; Progress ({history.length} rounds)
          </h3>
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={() => setShowRecordForm(!showRecordForm)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid #0284c7',
              background: '#e0f2fe',
              color: '#0369a1',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <FileEdit size={14} />
            Record Reassessment Round
          </button>
        )}
      </div>

      {showRecordForm && (
        <div
          style={{
            border: '1px solid #bae6fd',
            background: '#f0f9ff',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem',
          }}
        >
          <h4 style={{ margin: '0 0 0.4rem 0', fontSize: '0.9rem', color: '#0369a1' }}>
            Snapshot Current Measurements as Reassessment Round
          </h4>
          <p style={{ margin: '0 0 0.6rem 0', fontSize: '0.78rem', color: 'var(--text-secondary, #64748b)' }}>
            This compares your current measurements against earlier rounds, records newly resolved barriers, and preserves an immutable progress checkpoint.
          </p>
          <textarea
            rows={2}
            placeholder="Assessor notes (e.g. Post-renovation follow-up inspection by Joint Committee)"
            value={assessorNotes}
            onChange={(e) => setAssessorNotes(e.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.82rem',
              marginBottom: '0.6rem',
            }}
          />
          <button
            type="button"
            onClick={handleRecordNewRound}
            style={{
              padding: '0.4rem 0.85rem',
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Commit Reassessment Snapshot
          </button>
        </div>
      )}

      {history.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '1.25rem', color: 'var(--text-secondary, #64748b)' }}>
          <Clock size={28} color="#94a3b8" style={{ marginBottom: '0.3rem' }} />
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            No follow-up reassessment rounds recorded yet. Initial baseline is stored.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {history.map((round, idx) => (
            <div
              key={round.reassessmentId || idx}
              style={{
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: '8px',
                padding: '0.85rem',
                background: 'var(--bg-card-subtle, #f8fafc)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <TrendingUp size={16} color="#059669" />
                  <strong style={{ fontSize: '0.9rem' }}>
                    Reassessment Round {idx + 1}
                  </strong>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)' }}>
                    • {new Date(round.reassessedAt).toLocaleDateString()}
                  </span>
                </div>

                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: '#dcfce7',
                    color: '#166534',
                  }}
                >
                  Score: {round.evaluation?.score !== null ? `${round.evaluation.score}%` : 'N/A'}
                </span>
              </div>

              {round.assessorNotes && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #475569)', marginBottom: '0.4rem', fontStyle: 'italic' }}>
                  &quot;{round.assessorNotes}&quot;
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.6rem', fontSize: '0.78rem' }}>
                <div>
                  <strong style={{ color: '#166534', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <CheckCircle2 size={13} /> Newly Resolved Barriers ({round.resolvedBarriers?.length || 0}):
                  </strong>
                  {round.resolvedBarriers && round.resolvedBarriers.length > 0 ? (
                    <ul style={{ margin: '0.2rem 0 0 1.2rem', padding: 0 }}>
                      {round.resolvedBarriers.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  ) : (
                    <span style={{ color: 'var(--text-secondary, #64748b)' }}>None in this round</span>
                  )}
                </div>

                <div>
                  <strong style={{ color: '#991b1b' }}>
                    Remaining Barriers ({round.unresolvedBarriers?.length || 0}):
                  </strong>
                  {round.unresolvedBarriers && round.unresolvedBarriers.length > 0 ? (
                    <ul style={{ margin: '0.2rem 0 0 1.2rem', padding: 0 }}>
                      {round.unresolvedBarriers.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  ) : (
                    <span style={{ color: '#166534', fontWeight: 600 }}>All assessed barriers resolved!</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
