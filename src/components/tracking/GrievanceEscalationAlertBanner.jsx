import { useState } from 'react';
import { AlertCircle, Clock, ShieldAlert, Copy, Check, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import {
  calculateSlaStatus,
  generateEscalationNoticeDraft,
  getRecommendedEscalationChannel,
} from '../../services/grievanceEscalationService';

export default function GrievanceEscalationAlertBanner({ application, citizenName = 'Applicant Citizen' }) {
  const [copied, setCopied] = useState(false);
  const [showDraft, setShowDraft] = useState(false);

  if (!application) return null;

  const sla = calculateSlaStatus(application);
  const channel = getRecommendedEscalationChannel(application.serviceName);

  // If application is already completed or early in progress, don't overwhelm user
  if (sla.urgencyLevel === 'COMPLETED' || sla.urgencyLevel === 'ON_TRACK') {
    return (
      <div
        className="glass-panel"
        role="status"
        aria-label="Statutory SLA Timeline Progress"
        style={{
          marginTop: '1rem',
          padding: '0.875rem 1.25rem',
          borderRadius: '0.75rem',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(255, 255, 255, 0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={16} color="var(--accent-main, #3b82f6)" aria-hidden="true" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Statutory Timeline (Citizens' Charter):</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Day {sla.elapsedDays} of {sla.standardSlaDays} ({sla.remainingDays} days remaining)
            </span>
          </div>
          <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '999px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-main, #3b82f6)', fontWeight: 600 }}>
            On Schedule
          </span>
        </div>
      </div>
    );
  }

  const isBreach = sla.urgencyLevel === 'CRITICAL_BREACH';
  const noticeDraft = generateEscalationNoticeDraft(application, { citizenName });

  const handleCopyNotice = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(noticeDraft);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // fallback
    }
  };

  return (
    <div
      className="glass-panel"
      role={isBreach ? 'alert' : 'status'}
      aria-label="Statutory Service Timeline Alert"
      style={{
        marginTop: '1.25rem',
        padding: '1.25rem',
        borderRadius: '0.875rem',
        border: isBreach ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
        background: isBreach ? 'rgba(239, 68, 68, 0.06)' : 'rgba(245, 158, 11, 0.06)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', flex: 1, minWidth: '260px' }}>
          {isBreach ? (
            <ShieldAlert size={22} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
          ) : (
            <AlertCircle size={22} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: isBreach ? '#ef4444' : '#f59e0b' }}>
                {isBreach
                  ? `Statutory SLA Breached by ${sla.overdueDays} Days`
                  : `Statutory Deadline Imminent (${sla.remainingDays} Days Left)`}
              </h4>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '999px',
                  background: isBreach ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                  color: isBreach ? '#fca5a5' : '#fcd34d',
                }}
              >
                {sla.statutoryAct}
              </span>
            </div>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Under the public service charter, this application was guaranteed disposal within{' '}
              <strong>{sla.standardSlaDays} days</strong>. You are legally entitled to file a First Appeal before the{' '}
              <strong>{channel.authority}</strong>.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowDraft(!showDraft)}
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            {showDraft ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {showDraft ? 'Hide Notice' : 'Prepare Escalation'}
          </button>
          <a
            href={channel.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <ExternalLink size={14} /> Official Portal
          </a>
        </div>
      </div>

      {showDraft && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            borderRadius: '0.5rem',
            background: 'var(--bg-card, rgba(0, 0, 0, 0.3))',
            border: '1px solid var(--border-light, rgba(255, 255, 255, 0.1))',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Statutory Escalation Notice Template
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleCopyNotice}
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
            >
              {copied ? <Check size={13} color="#22c55e" /> : <Copy size={13} />}
              {copied ? 'Copied to Clipboard' : 'Copy Notice'}
            </button>
          </div>
          <pre
            style={{
              margin: 0,
              fontSize: '0.78rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: 'var(--text-primary)',
              fontFamily: 'monospace',
              maxHeight: '220px',
              overflowY: 'auto',
              padding: '0.75rem',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '0.375rem',
            }}
          >
            {noticeDraft}
          </pre>
        </div>
      )}
    </div>
  );
}
