import {
  evaluateReraEvidenceReadiness,
} from '../../services/reraDisputeService.js';
import { FileCheck2, AlertCircle } from 'lucide-react';

export default function ReraEvidenceChecklist({ checklistState = {}, onToggleItem }) {
  const readiness = evaluateReraEvidenceReadiness(checklistState);

  return (
    <div
      style={{
        background: 'var(--bg-card, #1e293b)',
        border: '1px solid var(--border-light, #334155)',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        marginBottom: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              padding: '0.5rem',
              borderRadius: '0.5rem',
              background: 'rgba(34, 197, 94, 0.15)',
              color: '#22c55e',
              display: 'flex',
            }}
          >
            <FileCheck2 size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary, #f8fafc)' }}>
              RERA Dispute Evidence & Document Readiness
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
              Mandatory and supporting exhibits for Form M (Authority) and Form N (Adjudicating Officer)
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: readiness.allMandatoryAttached ? '#22c55e' : '#f59e0b' }}>
            {readiness.readinessPercentage}% Complete
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
            {readiness.totalAttached} of {readiness.totalItems} documents verified
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div
        style={{
          width: '100%',
          height: '6px',
          background: 'rgba(255, 255, 255, 0.08)',
          borderRadius: '999px',
          overflow: 'hidden',
          marginBottom: '1.25rem',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${readiness.readinessPercentage}%`,
            background: readiness.allMandatoryAttached ? '#22c55e' : '#f59e0b',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Missing Mandatory Alert */}
      {!readiness.allMandatoryAttached && (
        <div
          style={{
            padding: '0.75rem 1rem',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '0.5rem',
            color: '#ef4444',
            fontSize: '0.82rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
          }}
        >
          <AlertCircle size={16} style={{ marginTop: '0.15rem', flexShrink: 0 }} />
          <div>
            <strong>Missing Mandatory Exhibits:</strong>
            <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0 }}>
              {readiness.missingMandatory.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Checklist Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {readiness.items.map((item) => (
          <label
            key={item.id}
            htmlFor={`chk-${item.id}`}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              background: item.attached ? 'rgba(34, 197, 94, 0.06)' : 'var(--bg-primary, #0f172a)',
              border: item.attached ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--border-light, #334155)',
              cursor: 'pointer',
              transition: 'background 0.2s ease',
            }}
          >
            <input
              id={`chk-${item.id}`}
              type="checkbox"
              checked={item.attached}
              onChange={() => onToggleItem?.(item.id)}
              style={{
                marginTop: '0.25rem',
                accentColor: '#22c55e',
                width: '16px',
                height: '16px',
                cursor: 'pointer',
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
                  {item.label}
                </span>
                {item.mandatory && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.1rem 0.4rem',
                      borderRadius: '0.25rem',
                      background: 'rgba(239, 68, 68, 0.2)',
                      color: '#ef4444',
                    }}
                  >
                    MANDATORY
                  </span>
                )}
              </div>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)' }}>
                {item.description}
              </p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
