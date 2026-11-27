import { useState } from 'react';
import {
  STRUCTURAL_DEFECT_CATEGORIES,
  evaluateStructuralDefectLiability,
} from '../../services/reraDisputeService.js';
import { ShieldAlert, CheckCircle2, Wrench } from 'lucide-react';

export default function ReraDefectLiabilityCard() {
  const [possessionHandoverDate, setPossessionHandoverDate] = useState('2023-01-15');
  const [defectNoticeDate, setDefectNoticeDate] = useState('2024-05-10');
  const [defectCategory, setDefectCategory] = useState('RCC_STRUCTURAL');

  const evaluation = evaluateStructuralDefectLiability({
    possessionHandoverDate,
    defectNoticeDate,
    defectCategory,
  });

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div
          style={{
            padding: '0.5rem',
            borderRadius: '0.5rem',
            background: 'rgba(245, 158, 11, 0.15)',
            color: '#f59e0b',
            display: 'flex',
          }}
        >
          <ShieldAlert size={22} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary, #f8fafc)' }}>
            Section 14(3) 5-Year Structural Defect & 30-Day Rectification Tracker
          </h3>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Statutory builder warranty requiring rectification without charge within 30 days
          </p>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <label
            htmlFor="possession-handover-date"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Physical Handover Date *
          </label>
          <input
            id="possession-handover-date"
            type="date"
            value={possessionHandoverDate}
            onChange={(e) => setPossessionHandoverDate(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-primary, #0f172a)',
              border: '1px solid var(--border-light, #334155)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '0.9rem',
            }}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Date possession letter was signed
          </span>
        </div>

        <div>
          <label
            htmlFor="defect-notice-date"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Written Notice Served Date
          </label>
          <input
            id="defect-notice-date"
            type="date"
            value={defectNoticeDate}
            onChange={(e) => setDefectNoticeDate(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-primary, #0f172a)',
              border: '1px solid var(--border-light, #334155)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '0.9rem',
            }}
          />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Date defect communicated to builder
          </span>
        </div>

        <div>
          <label
            htmlFor="defect-category-select"
            style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-primary, #f8fafc)' }}
          >
            Defect Classification *
          </label>
          <select
            id="defect-category-select"
            value={defectCategory}
            onChange={(e) => setDefectCategory(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-primary, #0f172a)',
              border: '1px solid var(--border-light, #334155)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: '0.9rem',
            }}
          >
            {Object.entries(STRUCTURAL_DEFECT_CATEGORIES).map(([key, val]) => (
              <option key={key} value={key}>
                {val.label}
              </option>
            ))}
          </select>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Classified under RERA Section 14(3)
          </span>
        </div>
      </div>

      {/* Status Alert */}
      {evaluation.isValid && (
        <div
          style={{
            background: 'var(--bg-primary, #0f172a)',
            border: '1px solid var(--border-light, #334155)',
            borderRadius: '0.5rem',
            padding: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {evaluation.withinFiveYearWindow ? (
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  background: 'rgba(34, 197, 94, 0.15)',
                  color: '#22c55e',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <CheckCircle2 size={13} /> WITHIN 5-YEAR STATUTORY WARRANTY WINDOW (Expires: {evaluation.fiveYearExpiryDate})
              </span>
            ) : (
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  color: '#ef4444',
                }}
              >
                EXPIRED: 5-YEAR WARRANTY CONCLUDED ON {evaluation.fiveYearExpiryDate}
              </span>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.75rem',
              marginBottom: '0.75rem',
            }}
          >
            <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '0.375rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', display: 'block' }}>Days Since Notice</span>
              <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary, #f8fafc)' }}>{evaluation.daysSinceNotice} Days</strong>
            </div>

            <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '0.375rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', display: 'block' }}>Remaining 30-Day SLA</span>
              <strong style={{ fontSize: '0.95rem', color: evaluation.isPromoterSlaBreached ? '#ef4444' : '#f59e0b' }}>
                {evaluation.isPromoterSlaBreached ? 'BREACHED (0 Days)' : `${evaluation.remainingSlaDays} Days Left`}
              </strong>
            </div>

            <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '0.375rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)', display: 'block' }}>Defect Severity</span>
              <strong style={{ fontSize: '0.95rem', color: evaluation.severity === 'CRITICAL' ? '#ef4444' : '#f59e0b' }}>
                {evaluation.severity}
              </strong>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary, #f8fafc)', fontSize: '0.85rem' }}>
            <Wrench size={16} color="#3b82f6" />
            <span>{evaluation.statutoryRemedy}</span>
          </div>
        </div>
      )}
    </div>
  );
}
