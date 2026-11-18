import { useState, useMemo } from 'react';
import {
  ShieldAlert,
} from 'lucide-react';
import { auditScreeningAndCapitation } from '../../services/rteAdmissionService.js';

export default function CapitationFeeAuditorCard({ onScreeningAuditChange }) {
  const [childWrittenTest, setChildWrittenTest] = useState(false);
  const [childOralInterview, setChildOralInterview] = useState(true);
  const [parentInterview, setParentInterview] = useState(true);
  const [parentQualificationAudit, setParentQualificationAudit] = useState(false);
  const [capitationFeeDemandedInr, setCapitationFeeDemandedInr] = useState(25000);
  const [isSubsequentViolation, setIsSubsequentViolation] = useState(false);

  const screeningAnalysis = useMemo(() => {
    return auditScreeningAndCapitation({
      childWrittenTest,
      childOralInterview,
      parentInterview,
      parentQualificationAudit,
      capitationFeeDemandedInr: Number(capitationFeeDemandedInr) || 0,
      isSubsequentViolation,
    });
  }, [
    childWrittenTest,
    childOralInterview,
    parentInterview,
    parentQualificationAudit,
    capitationFeeDemandedInr,
    isSubsequentViolation,
  ]);

  useMemo(() => {
    if (onScreeningAuditChange) {
      onScreeningAuditChange(screeningAnalysis);
    }
  }, [screeningAnalysis, onScreeningAuditChange]);

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <ShieldAlert style={{ width: 28, height: 28, color: '#f87171' }} />
        <div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>
            Section 13 Illegal Screening &amp; Capitation Fee Penalty Auditor
          </h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Evaluates statutory civil liabilities: 10x capitation fine &amp; ₹25,000–₹50,000 screening penalties
          </span>
        </div>
      </div>

      {/* Prohibited Screening Checkboxes */}
      <div style={{ marginBottom: '1.25rem' }}>
        <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary, #f8fafc)', marginBottom: '0.65rem' }}>
          Prohibited Selection Procedures Audited (Section 13(1))
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={childWrittenTest}
              onChange={(e) => setChildWrittenTest(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <div>
              <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>Written Test / Evaluation for Child</strong>
              <div style={{ fontSize: '0.74rem' }}>Formal entrance exam or written assessment of applicant</div>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={childOralInterview}
              onChange={(e) => setChildOralInterview(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <div>
              <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>Oral Interaction / Child Interview</strong>
              <div style={{ fontSize: '0.74rem' }}>Subjecting young child to oral questions to test knowledge</div>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={parentInterview}
              onChange={(e) => setParentInterview(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <div>
              <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>Parent Personality / Interaction Interview</strong>
              <div style={{ fontSize: '0.74rem' }}>Interviewing parents or assessing their social background</div>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={parentQualificationAudit}
              onChange={(e) => setParentQualificationAudit(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <div>
              <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>Parent Educational Qualification Screening</strong>
              <div style={{ fontSize: '0.74rem' }}>Demanding parent graduation degrees or English fluency proof</div>
            </div>
          </label>
        </div>
      </div>

      {/* Capitation Demanded & Offense History */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Capitation / Building Donation Demanded (INR)
          </label>
          <input
            type="number"
            min="0"
            step="1000"
            value={capitationFeeDemandedInr}
            onChange={(e) => setCapitationFeeDemandedInr(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          />
          <span style={{ fontSize: '0.72rem', color: '#f87171' }}>
            Liable to 10x penalty under Section 13(2)(a)
          </span>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary, #94a3b8)', marginBottom: '0.35rem' }}>
            Offense History (Section 13(2)(b))
          </label>
          <select
            value={isSubsequentViolation ? 'subsequent' : 'first'}
            onChange={(e) => setIsSubsequentViolation(e.target.value === 'subsequent')}
            style={{
              width: '100%',
              padding: '0.55rem',
              borderRadius: '0.5rem',
              background: 'var(--bg-dark, #0f172a)',
              color: 'var(--text-primary, #f8fafc)',
              border: '1px solid var(--border-light, #334155)',
            }}
          >
            <option value="first">First Contravention (Max ₹25,000 fine)</option>
            <option value="subsequent">Subsequent Contravention (Max ₹50,000 fine)</option>
          </select>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            Statutory fine scales with repeat violations
          </span>
        </div>
      </div>

      {/* Statutory Penal Liability Output */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          padding: '1.25rem',
          borderRadius: '0.75rem',
          background: screeningAnalysis.hasViolations ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.12)',
          border: `1px solid ${screeningAnalysis.hasViolations ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.4)'}`,
        }}
      >
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>Capitation Fine (10x Cap)</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f87171' }}>
            ₹{screeningAnalysis.statutoryCapitationFineInr.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Sec 13(2)(a) RTE Act</div>
        </div>

        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>Screening Penalty</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#facc15' }}>
            ₹{screeningAnalysis.statutoryScreeningFineInr.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Sec 13(2)(b) RTE Act</div>
        </div>

        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>Total Statutory Liability</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: screeningAnalysis.hasViolations ? '#f87171' : '#4ade80' }}>
            ₹{screeningAnalysis.totalStatutoryPenalLiabilityInr.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Compounding Civil Fine</div>
        </div>
      </div>

      {screeningAnalysis.violations.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f87171' }}>
            Identified Statutory Contraventions:
          </span>
          <ul style={{ margin: '0.35rem 0 0 0', paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
            {screeningAnalysis.violations.map((v, i) => (
              <li key={i} style={{ marginBottom: '0.25rem' }}>
                <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>{v.rule}:</strong> {v.name} — {v.description}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
