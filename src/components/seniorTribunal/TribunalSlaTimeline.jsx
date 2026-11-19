import { useState, useMemo } from 'react';
import { Clock, AlertTriangle, ArrowRight, FileText, CheckCircle2 } from 'lucide-react';
import { calculateTribunalSla } from '../../services/seniorCitizenTribunalService.js';

const TribunalSlaTimeline = ({ onDraftAppellateAppeal }) => {
  const [filingDate, setFilingDate] = useState(() => {
    // Default to 45 days ago to demonstrate active inquiry
    const d = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  });

  const [currentStage, setCurrentStage] = useState('INQUIRY');

  const sla = useMemo(() => {
    return calculateTribunalSla({ filingDate, currentStage });
  }, [filingDate, currentStage]);

  return (
    <div
      className="card"
      style={{
        padding: '1.5rem',
        borderRadius: '0.75rem',
        background: 'var(--bg-main, #0f172a)',
        border: '1px solid var(--border-main, #334155)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
        <div
          style={{
            padding: '0.5rem',
            borderRadius: '0.5rem',
            background: 'rgba(245, 158, 11, 0.1)',
            color: '#f59e0b',
          }}
        >
          <Clock size={20} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
            Tribunal 90-Day Statutory SLA & Inquiry Tracker
          </h3>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary, #94a3b8)' }}>
            Monitors compliance with Section 5(6) statutory inquiry ceiling and flags Section 16 DM Appellate appeals.
          </p>
        </div>
      </div>

      {/* Date Controls */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          padding: '0.85rem 1rem',
          borderRadius: '0.5rem',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-light, #334155)',
          marginBottom: '1.25rem',
          fontSize: '0.82rem',
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span>Filing Date:</span>
          <input
            type="date"
            value={filingDate}
            onChange={(e) => setFilingDate(e.target.value)}
            style={{
              padding: '0.3rem 0.5rem',
              borderRadius: '0.25rem',
              border: '1px solid var(--border-light, #334155)',
              background: 'var(--bg-card, #1e293b)',
              color: 'inherit',
            }}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span>Current Proceedings Stage:</span>
          <select
            value={currentStage}
            onChange={(e) => setCurrentStage(e.target.value)}
            style={{
              padding: '0.3rem 0.5rem',
              borderRadius: '0.25rem',
              border: '1px solid var(--border-light, #334155)',
              background: 'var(--bg-card, #1e293b)',
              color: 'inherit',
            }}
          >
            <option value="FILED">Stage 1: Application Filed</option>
            <option value="NOTICE_SERVED">Stage 1: Notice Served to Children</option>
            <option value="CONCILIATION">Stage 2: Conciliation Officer Conference</option>
            <option value="INQUIRY">Stage 3: Summary Tribunal Inquiry</option>
            <option value="DISPOSED">Stage 4: Order Pronounced & Disposed</option>
          </select>
        </label>
      </div>

      {/* Progress Bar & Countdown */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
              Statutory Resolution Window
            </span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: sla.isOverdue ? '#ef4444' : 'var(--text-primary)' }}>
              {sla.isOverdue ? `${sla.daysSinceFiling} Days (OVERDUE by ${sla.daysSinceFiling - sla.statutoryLimitDays} days)` : `${sla.daysRemaining} Days Remaining`}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
              Elapsed: {sla.daysSinceFiling} / {sla.statutoryLimitDays} Days ({sla.percentElapsed}%)
            </span>
          </div>
        </div>

        {/* Progress track */}
        <div
          style={{
            width: '100%',
            height: '10px',
            borderRadius: '5px',
            background: 'var(--bg-card, #1e293b)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${sla.percentElapsed}%`,
              height: '100%',
              background: sla.isOverdue ? '#ef4444' : sla.daysSinceFiling > 70 ? '#f59e0b' : '#10b981',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* 4 Statutory Milestone Stages */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ padding: '0.75rem', borderRadius: '0.375rem', background: sla.daysSinceFiling >= 1 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light, #334155)', fontSize: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700, color: '#10b981', marginBottom: '0.2rem' }}>
            <CheckCircle2 size={14} />
            <span>Stage 1: Days 1-15</span>
          </div>
          <strong style={{ display: 'block', color: 'var(--text-primary)' }}>Filing & Notice Service</strong>
          <span style={{ color: 'var(--text-tertiary)' }}>Summons issued to children by Registered Post/Process Server.</span>
        </div>

        <div style={{ padding: '0.75rem', borderRadius: '0.375rem', background: sla.daysSinceFiling >= 16 ? 'rgba(56, 189, 248, 0.05)' : 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light, #334155)', fontSize: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700, color: sla.daysSinceFiling >= 16 ? 'var(--accent-main)' : 'var(--text-tertiary)', marginBottom: '0.2rem' }}>
            <span>Stage 2: Days 16-30</span>
          </div>
          <strong style={{ display: 'block', color: 'var(--text-primary)' }}>Conciliation Referral</strong>
          <span style={{ color: 'var(--text-tertiary)' }}>Conciliation officer explores mutual settlement under Section 6.</span>
        </div>

        <div style={{ padding: '0.75rem', borderRadius: '0.375rem', background: sla.daysSinceFiling >= 31 ? 'rgba(245, 158, 11, 0.05)' : 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light, #334155)', fontSize: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700, color: sla.daysSinceFiling >= 31 ? '#f59e0b' : 'var(--text-tertiary)', marginBottom: '0.2rem' }}>
            <span>Stage 3: Days 31-70</span>
          </div>
          <strong style={{ display: 'block', color: 'var(--text-primary)' }}>Summary Inquiry</strong>
          <span style={{ color: 'var(--text-tertiary)' }}>SDM examines bank statements, income proof, and medical needs.</span>
        </div>

        <div style={{ padding: '0.75rem', borderRadius: '0.375rem', background: sla.daysSinceFiling >= 71 ? 'rgba(239, 68, 68, 0.05)' : 'rgba(255,255,255,0.02)', border: '1px solid var(--border-light, #334155)', fontSize: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: 700, color: sla.daysSinceFiling >= 71 ? '#ef4444' : 'var(--text-tertiary)', marginBottom: '0.2rem' }}>
            <span>Stage 4: Days 71-90</span>
          </div>
          <strong style={{ display: 'block', color: 'var(--text-primary)' }}>Order Pronouncement</strong>
          <span style={{ color: 'var(--text-tertiary)' }}>Binding maintenance or Section 23 void order with recovery powers.</span>
        </div>
      </div>

      {/* Escalation Callout */}
      {sla.isOverdue && (
        <div
          style={{
            padding: '1rem',
            borderRadius: '0.5rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
            <AlertTriangle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ color: '#ef4444', fontSize: '0.85rem' }}>
                Statutory 90-Day Breach Detected
              </strong>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {sla.escalationRemedy}
              </p>
            </div>
          </div>

          {onDraftAppellateAppeal && (
            <button
              type="button"
              onClick={onDraftAppellateAppeal}
              className="btn btn-primary"
              style={{ padding: '0.5rem 0.85rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <FileText size={15} />
              <span>Draft Section 16 DM Appeal</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TribunalSlaTimeline;
