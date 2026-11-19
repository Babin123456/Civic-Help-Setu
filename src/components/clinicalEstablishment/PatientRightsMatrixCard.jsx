import { useState, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { PATIENT_RIGHTS_CHARTER } from '../../services/clinicalEstablishmentService.js';

export default function PatientRightsMatrixCard({ onViolationsChange }) {
  const [violations, setViolations] = useState({
    RIGHT_TO_EMERGENCY_TREATMENT: true,
    RIGHT_AGAINST_DETAINMENT: false,
    RIGHT_TO_MEDICAL_RECORDS: true,
    RIGHT_TO_TRANSPARENT_RATES: true,
    RIGHT_TO_EXTERNAL_PHARMACY: false,
    RIGHT_TO_INFORMED_CONSENT: false,
  });

  const [notes, setNotes] = useState({
    RIGHT_TO_MEDICAL_RECORDS: 'Hospital refused to provide indoor case sheets until final bill settled.',
    RIGHT_TO_EMERGENCY_TREATMENT: 'Admission delayed by 45 minutes demanding initial deposit of Rs 1,00,000.',
  });

  const charterKeys = Object.keys(PATIENT_RIGHTS_CHARTER);

  const toggleViolation = (key) => {
    setViolations((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      return next;
    });
  };

  const handleNoteChange = (key, text) => {
    setNotes((prev) => ({ ...prev, [key]: text }));
  };

  const activeViolationsCount = useMemo(() => {
    return Object.values(violations).filter(Boolean).length;
  }, [violations]);

  useMemo(() => {
    if (onViolationsChange) {
      onViolationsChange({
        violations,
        notes,
        count: activeViolationsCount,
      });
    }
  }, [violations, notes, activeViolationsCount, onViolationsChange]);

  return (
    <div
      style={{
        background: 'var(--bg-card, #1e293b)',
        borderRadius: '1rem',
        padding: '1.5rem',
        border: '1px solid var(--border-light, #334155)',
        marginBottom: '1.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              padding: '0.5rem',
              borderRadius: '0.5rem',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
            }}
          >
            <ShieldAlert size={22} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
              NHRC / MoHFW Patient Rights Charter & Violations Matrix
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
              Evaluate hospital non-compliances against statutory charter and Supreme Court precedents
            </p>
          </div>
        </div>

        <span
          style={{
            fontSize: '0.85rem',
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            background: activeViolationsCount > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
            color: activeViolationsCount > 0 ? '#ef4444' : '#22c55e',
            fontWeight: 600,
          }}
        >
          {activeViolationsCount} Rights Violated
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
        {charterKeys.map((key) => {
          const item = PATIENT_RIGHTS_CHARTER[key];
          const isViolated = violations[key];

          return (
            <div
              key={key}
              style={{
                borderRadius: '0.75rem',
                border: isViolated ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid var(--border-light, #334155)',
                background: isViolated ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-secondary, #0f172a)',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>
                    {item.title}
                  </h4>
                  <button
                    type="button"
                    onClick={() => toggleViolation(key)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      borderRadius: '0.375rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      background: isViolated ? '#ef4444' : 'var(--bg-card, #334155)',
                      color: '#ffffff',
                    }}
                  >
                    {isViolated ? (
                      <>
                        <ShieldAlert size={12} />
                        Violated
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={12} />
                        Compliant
                      </>
                    )}
                  </button>
                </div>

                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#38bdf8',
                    marginTop: '0.4rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <FileText size={12} />
                  <span>{item.statutoryRef}</span>
                </div>

                <p style={{ margin: '0.5rem 0 0.75rem 0', fontSize: '0.8rem', color: 'var(--text-secondary, #cbd5e1)', lineHeight: 1.4 }}>
                  {item.description}
                </p>

                <div
                  style={{
                    padding: '0.5rem',
                    borderRadius: '0.375rem',
                    background: isViolated ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                    fontSize: '0.75rem',
                    color: isViolated ? '#fca5a5' : 'var(--text-muted, #94a3b8)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.35rem',
                  }}
                >
                  <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                  <div>
                    <strong>Statutory Consequence: </strong>
                    {item.penalty}
                  </div>
                </div>
              </div>

              {isViolated && (
                <div style={{ marginTop: '0.75rem' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary, #94a3b8)',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Specific Incident Note / Fact:
                  </label>
                  <input
                    type="text"
                    value={notes[key] || ''}
                    onChange={(e) => handleNoteChange(key, e.target.value)}
                    placeholder="E.g. Refused to provide discharge summary until cash deposited..."
                    style={{
                      width: '100%',
                      padding: '0.375rem 0.5rem',
                      borderRadius: '0.375rem',
                      fontSize: '0.8rem',
                      background: 'var(--bg-input, #1e293b)',
                      color: 'var(--text-primary, #f8fafc)',
                      border: '1px solid var(--border-light, #475569)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
